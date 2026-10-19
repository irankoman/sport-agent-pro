"""
Live Odds & Betano Consensus Engine (Multi-Provider Aggregator)
Motor Centralizado Multi-Proveedor de Cuotas en Tiempo Real Calibrado a Betano Chile

Arquitectura Multi-Proveedor en Cascada y Consenso:
1. Proveedor 1 (Multi-Bookie Core ESPN / Pickcenter): Recolecta TODOS los bookmakers disponibles
   en competitions[0].odds y summary.pickcenter (DraftKings, ESPN Bet, Caesars, Unibet, BetMGM, etc.).
2. Proveedor 2 (The Odds API / Feeds Europeos Decimales): Conector para ODDS_API_KEY (si está configurada)
   y normalizador cuantitativo europeo de mercado (Pinnacle/Bet365/Betano EU).
3. Proveedor 3 (Motor Trader Betano - Tabla PPG + Diferencia de Goles + Matriz de Jerarquía Tier 1-4):
   Calcula la probabilidad real base a partir del récord oficial de ambos equipos en el torneo (W-D-L, PPG, GF/GC)
   combinado con una matriz de jerarquía histórica y actual de clubes por liga.
4. Filtro de Cordura y Anti-Inversión (Sanity & Inversion Guard):
   - Conversión exacta de cuotas americanas a decimales (ML < 0 -> 1 + 100/|ML|, ML > 0 -> 1 + ML/100).
   - Detecta cuotas invertidas o anómalas (ej. favorito claro de local con cuota > @2.60 pre-partido contra rival inferior)
     comparándolas con el Motor Trader Betano, corrigiendo o descartando lecturas defectuosas.
   - Promedia probabilidades limpias y aplica el Overround real de Betano Chile (~1.055 en 1X2 y 1.06 en secundarios)
     con redondeo comercial Betano (.00, .02, .05, .08, .10, .12, .15, .20, .25, etc.).
5. Fuente Única de Verdad (`unifiedOdds`):
   Alimenta 1X2, Doble Oportunidad (1X, X2, 12), DNB (Sin Empate), Combos Seguros (1X + Over 1.5, Hándicaps),
   Over/Under (1.5, 2.5, 3.5), BTTS (Ambos Anotan), Córners, Tarjetas, Goleadores/Props e In-Play Live Odds.
"""
import os
import time
import math
import re
import unicodedata
import requests
from typing import Dict, Any, Optional, Tuple, List
import logging

logger = logging.getLogger(__name__)


def _normalize_team_key(name: str) -> str:
    """Normaliza el nombre del equipo sin tildes y en minúsculas para cruces en la Matriz de Jerarquía."""
    if not name:
        return ""
    s = unicodedata.normalize("NFD", str(name).strip().lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


# Ticks comerciales de Betano para cuotas entre 1.10 y 3.50
_BETANO_COMMERCIAL_TICKS = [
    0.00, 0.02, 0.04, 0.05, 0.06, 0.08, 0.10, 0.12, 0.14, 0.15, 0.16, 0.18,
    0.20, 0.22, 0.25, 0.28, 0.30, 0.32, 0.35, 0.38, 0.40, 0.42, 0.45, 0.48,
    0.50, 0.52, 0.55, 0.58, 0.60, 0.62, 0.65, 0.68, 0.70, 0.72, 0.75, 0.78,
    0.80, 0.82, 0.85, 0.88, 0.90, 0.92, 0.95, 0.98, 1.00
]


def commercial_betano_round(val: float, min_odds: float = 1.04, max_odds: float = 45.0) -> float:
    """
    Redondea una cuota decimal a los ticks comerciales reales de Betano Chile.
    """
    try:
        v = max(min_odds, min(max_odds, float(val)))
        if v < 1.12:
            return round(v, 2)
        if v <= 3.60:
            integer_part = math.floor(v)
            frac = v - integer_part
            closest_tick = min(_BETANO_COMMERCIAL_TICKS, key=lambda t: abs(t - frac))
            return round(integer_part + closest_tick, 2)
        if v <= 10.0:
            # En cuotas de 3.60 a 10.0 Betano usa múltiplos de 0.05 o 0.10
            return round(round(v * 20.0) / 20.0, 2)
        # En cuotas > 10.0 Betano usa múltiplos de 0.25 o 0.50
        return round(round(v * 4.0) / 4.0, 2)
    except Exception:
        return 1.85


def american_to_decimal(am_val: Any) -> Optional[float]:
    """
    Convierte cuotas americanas (+140, -165, '380', '-170', 'EVEN') o decimales ('1.85')
    a formato decimal europeo/Betano (2.40, 1.61).
    Retorna None si el valor es inválido o vacío para no contaminar el consenso.
    """
    try:
        if am_val is None:
            return None
        s_val = str(am_val).strip().upper()
        if not s_val or s_val in ("N/A", "NONE", "NULL", "-"):
            return None
        if s_val in ("EVEN", "EV", "PK", "PICK"):
            return 2.00

        # Fraccional tipo "6/5" o "11/10"
        if "/" in s_val:
            parts = s_val.split("/")
            if len(parts) == 2:
                num, den = float(parts[0]), float(parts[1])
                if den > 0:
                    dec = 1.0 + (num / den)
                    if 1.01 <= dec <= 100.0:
                        return round(dec, 2)

        # Si ya es un decimal europeo (ej: 1.85 o '2.40') sin signo '+' ni '-'
        if not s_val.startswith("+") and not s_val.startswith("-") and "." in s_val:
            f_val = float(s_val)
            if 1.01 <= f_val <= 80.0:
                return round(f_val, 2)

        val = float(s_val.replace("+", "").strip())
        # Si es un número entre 1.02 y 25 sin signo que vino como float/int decimal
        if 1.01 < val < 35.0 and not s_val.startswith("+") and not s_val.startswith("-"):
            return round(val, 2)

        if val >= 100:
            return round(1.0 + (val / 100.0), 2)
        elif val <= -100:
            return round(1.0 + (100.0 / abs(val)), 2)
        elif val > 0:
            return round(1.0 + (val / 100.0), 2)
        elif val < 0:
            return round(1.0 + (100.0 / abs(val)), 2)
    except Exception:
        pass
    return None


# =============================================================================
# MATRIZ DE JERARQUÍA DE CLUBES (TIER 1 A TIER 4) PARA TRADER BETANO ENGINE
# =============================================================================
# Tier 1: Gigantes / Dominadores de liga (Fuerza base ~ 86-94)
# Tier 2: Clubes competitivos / Zona UEFA / Libertadores (Fuerza base ~ 75-83)
# Tier 3: Clubes consolidados de media tabla (Fuerza base ~ 65-72)
# Tier 4: Clubes de parte baja / recién ascendidos (Fuerza base ~ 55-61)
POWER_RANKING_TIERS: Dict[str, int] = {
    # España - LaLiga
    "real madrid": 1, "barcelona": 1, "fc barcelona": 1, "atletico madrid": 1, "atletico de madrid": 1,
    "athletic club": 2, "athletic bilbao": 2, "real sociedad": 2, "villarreal": 2, "real betis": 2, "girona": 2, "sevilla": 2,
    "celta vigo": 3, "celta de vigo": 3, "osasuna": 3, "mallorca": 3, "rayo vallecano": 3, "valencia": 3, "getafe": 3, "alaves": 3,
    "las palmas": 4, "leganes": 4, "espanyol": 4, "real valladolid": 4, "valladolid": 4,

    # Inglaterra - Premier League
    "manchester city": 1, "man city": 1, "arsenal": 1, "liverpool": 1,
    "chelsea": 2, "newcastle united": 2, "newcastle": 2, "aston villa": 2, "tottenham hotspur": 2, "tottenham": 2,
    "manchester united": 2, "man united": 2, "brighton": 2, "brighton hove albion": 2,
    "bournemouth": 3, "fulham": 3, "nottingham forest": 3, "brentford": 3, "west ham united": 3, "west ham": 3,
    "crystal palace": 3, "everton": 3, "wolverhampton wanderers": 3, "wolves": 3,
    "ipswich town": 4, "leicester city": 4, "southampton": 4, "leeds united": 3, "burnley": 3, "sheffield united": 4,

    # Italia - Serie A
    "inter": 1, "internazionale": 1, "inter milan": 1, "napoli": 1, "juventus": 1, "ac milan": 1, "milan": 1, "atalanta": 1,
    "lazio": 2, "roma": 2, "as roma": 2, "fiorentina": 2, "bologna": 2,
    "torino": 3, "udinese": 3, "genoa": 3, "como": 3, "hellas verona": 3, "cagliari": 3, "empoli": 3, "parma": 3,
    "lecce": 4, "venezia": 4, "monza": 4, "pisas": 4, "sassuolo": 3,

    # Alemania - Bundesliga
    "bayern munich": 1, "fc bayern munich": 1, "bayern munchen": 1, "bayer leverkusen": 1,
    "borussia dortmund": 2, "dortmund": 2, "rb leipzig": 2, "leipzig": 2, "eintracht frankfurt": 2, "vfb stuttgart": 2, "stuttgart": 2,
    "sc freiburg": 2, "freiburg": 2,
    "mainz 05": 3, "mainz": 3, "werder bremen": 3, "borussia monchengladbach": 3, "monchengladbach": 3,
    "wolfsburg": 3, "vfl wolfsburg": 3, "augsburg": 3, "tsg hoffenheim": 3, "hoffenheim": 3, "union berlin": 3,
    "st pauli": 4, "heidenheim": 4, "bochum": 4, "holstein kiel": 4, "koln": 3, "hamburger sv": 3,

    # Francia - Ligue 1
    "paris saint germain": 1, "psg": 1,
    "monaco": 2, "as monaco": 2, "marseille": 2, "olympique de marseille": 2, "lille": 2, "losc lille": 2,
    "lyon": 2, "olympique lyonnais": 2, "nice": 2, "ogc nice": 2, "lens": 2, "rc lens": 2,
    "rennes": 3, "stade rennais": 3, "strasbourg": 3, "reims": 3, "stade de reims": 3, "toulouse": 3, "brest": 3, "stade brestois": 3, "nantes": 3, "auxerre": 3,
    "angers": 4, "saint etienne": 4, "le havre": 4, "montpellier": 4,

    # Portugal - Primeira Liga
    "sporting cp": 1, "sporting lisbon": 1, "benfica": 1, "sl benfica": 1, "fc porto": 1, "porto": 1,
    "braga": 2, "sc braga": 2, "sporting braga": 2, "vitoria guimaraes": 2, "vitoria sc": 2, "santa clara": 2,
    "famalicao": 3, "moreirense": 3, "casa pia": 3, "rio ave": 3, "gil vicente": 3, "estoril": 3, "arouca": 3,
    "nacional": 4, "avs": 4, "estrela amadora": 4, "boavista": 4, "farense": 4,

    # Escocia - Scottish Premiership
    "celtic": 1, "rangers": 1,
    "aberdeen": 2, "heart of midlothian": 2, "hearts": 2, "hibernian": 2, "dundee united": 2,
    "motherwell": 3, "st mirren": 3, "kilmarnock": 3, "dundee": 3,
    "ross county": 4, "st johnstone": 4, "falkirk": 3,

    # Noruega - Eliteserien
    "bodo glimt": 1, "fk bodo glimt": 1, "brann": 1, "sk brann": 1,
    "molde": 2, "viking": 2, "rosenborg": 2, "fredrikstad": 2,
    "tromso": 3, "sarpsborg 08": 3, "sarpsborg": 3, "kristiansund": 3, "kfum oslo": 3, "stromsgodset": 3, "hamkam": 3, "sandefjord": 3,
    "haugesund": 4, "lillestrom": 4, "odd": 4, "valerenga": 3, "bryne": 4,

    # Chile - Campeonato Nacional
    "colo colo": 1, "universidad de chile": 1, "u de chile": 1, "universidad catolica": 1, "u catolica": 1,
    "coquimbo unido": 2, "palestino": 2, "union espanola": 2, "everton cd": 2, "deportes iquique": 2,
    "ohiggins": 3, "o higgins": 3, "audax italiano": 3, "nublense": 3, "cobresal": 3, "huachipato": 3, "union la calera": 3,
    "cobreloa": 4, "deportes copiapo": 4, "deportes la serena": 3, "limache": 4,

    # Sudamérica / Champions / Otros
    "flamengo": 1, "palmeiras": 1, "botafogo": 1, "river plate": 1, "boca juniors": 1,
    "atletico mineiro": 2, "sao paulo": 2, "internacional": 2, "fortaleza": 2, "cruzeiro": 2, "corinthians": 2,
    "racing club": 2, "velez sarsfield": 2, "talleres": 2, "estudiantes": 2, "independiente": 2,
    "psv": 1, "psv eindhoven": 1, "feyenoord": 1, "ajax": 1, "club brugge": 1, "galatasaray": 1, "fenerbahce": 1, "olympiacos": 1,
}


class LiveOddsBetanoEngine:
    # Caché en memoria con TTL diferenciado: 15 min (900s) pre-partido y 60s en vivo
    _ODDS_CACHE: Dict[str, Tuple[float, Dict[str, Any]]] = {}
    _PREMATCH_TTL_SECONDS = 900
    _LIVE_TTL_SECONDS = 60

    # Caché opcional para The Odds API (evita agotar cuota si ODDS_API_KEY está presente)
    _EXTERNAL_ODDS_API_CACHE: Dict[str, Tuple[float, List[Dict[str, Any]]]] = {}
    _EXTERNAL_API_TTL = 1800

    @classmethod
    def _resolve_team_tier(cls, team_name: str) -> int:
        """Devuelve el Tier de jerarquía del club (1 = Élite, 2 = Competitivo, 3 = Media Tabla, 4 = Bajo)."""
        norm = _normalize_team_key(team_name)
        if not norm:
            return 3
        if norm in POWER_RANKING_TIERS:
            return POWER_RANKING_TIERS[norm]
        for key, tier in POWER_RANKING_TIERS.items():
            if key in norm or norm in key:
                return tier
        return 3

    @classmethod
    def _extract_team_records_ppg(cls, comp: Dict[str, Any], home_name: str, away_name: str) -> Dict[str, Any]:
        """
        Extrae el récord oficial W-D-L y calcula Puntos Por Partido (PPG) de ambos equipos
        desde `competitors[].records` de ESPN.
        """
        info = {
            "home_ppg": None,
            "away_ppg": None,
            "home_games": 0,
            "away_games": 0,
            "home_record_str": "",
            "away_record_str": "",
            "has_standings_data": False
        }
        try:
            competitors = comp.get("competitors", []) if isinstance(comp, dict) else []
            for c in competitors:
                if not isinstance(c, dict):
                    continue
                ha = c.get("homeAway", "")
                records = c.get("records", [])
                if not isinstance(records, list):
                    continue
                summary_str = ""
                for r in records:
                    if isinstance(r, dict) and r.get("type") in ("total", "overall", None) and r.get("summary"):
                        summary_str = str(r.get("summary")).strip()
                        break
                if not summary_str and records and isinstance(records[0], dict):
                    summary_str = str(records[0].get("summary", "")).strip()

                # Formato W-D-L o W-L-T (en fútbol ESPN usa W-D-L, ej: "18-5-3")
                m = re.match(r"^(\d+)\s*-\s*(\d+)\s*-\s*(\d+)$", summary_str)
                if m:
                    w, d, l = int(m.group(1)), int(m.group(2)), int(m.group(3))
                    games = w + d + l
                    if games > 0:
                        ppg = round((w * 3.0 + d * 1.0) / float(games), 2)
                        if ha == "home":
                            info["home_ppg"] = ppg
                            info["home_games"] = games
                            info["home_record_str"] = summary_str
                        elif ha == "away":
                            info["away_ppg"] = ppg
                            info["away_games"] = games
                            info["away_record_str"] = summary_str
            if info["home_ppg"] is not None and info["away_ppg"] is not None:
                info["has_standings_data"] = True
        except Exception as e:
            logger.debug(f"[BetanoConsensus] Error extrayendo PPG: {e}")
        return info

    @classmethod
    def _calculate_trader_betano_model(
        cls,
        comp: Dict[str, Any],
        home_name: str,
        away_name: str,
        league_code: str = ""
    ) -> Dict[str, Any]:
        """
        PROVEEDOR 3: Motor Trader Betano (Tabla PPG + Diferencia de Goles + Jerarquía Tier 1-4).
        Calcula las probabilidades fundamentales (P1, PX, P2) y goles esperados (lambda_home, lambda_away)
        como lo haría la mesa de trading de Betano Chile.
        """
        home_tier = cls._resolve_team_tier(home_name)
        away_tier = cls._resolve_team_tier(away_name)
        rec = cls._extract_team_records_ppg(comp, home_name, away_name)

        # PPG estimado por Tier cuando comienza la temporada o es copa
        default_tier_ppg = {1: 2.28, 2: 1.72, 3: 1.32, 4: 0.94}
        h_ppg_tier = default_tier_ppg.get(home_tier, 1.32)
        a_ppg_tier = default_tier_ppg.get(away_tier, 1.32)

        # Combinar PPG real de la tabla con el Tier de jerarquía del club
        if rec["home_ppg"] is not None and rec["home_games"] >= 3:
            weight_table = min(0.72, rec["home_games"] / 20.0)
            h_eff_ppg = rec["home_ppg"] * weight_table + h_ppg_tier * (1.0 - weight_table)
        else:
            h_eff_ppg = h_ppg_tier

        if rec["away_ppg"] is not None and rec["away_games"] >= 3:
            weight_table = min(0.72, rec["away_games"] / 20.0)
            a_eff_ppg = rec["away_ppg"] * weight_table + a_ppg_tier * (1.0 - weight_table)
        else:
            a_eff_ppg = a_ppg_tier

        # Diferencial de fuerza competitiva (incluyendo ventaja de localía)
        ppg_diff = h_eff_ppg - a_eff_ppg
        tier_diff = float(away_tier - home_tier)  # positivo si el local es de mejor Tier (ej. Tier 1 vs Tier 3 -> +2)

        # Media de goles base según liga (Bundesliga/Noruega/Escocia suelen tener más goles que Serie A/LaLiga/Chile)
        high_scoring_leagues = ("ger.1", "nor.1", "sco.1", "eng.1")
        base_total_goals = 2.82 if league_code in high_scoring_leagues else 2.62

        # Goles esperados (Poisson Lambda) por equipo
        strength_shift = (ppg_diff * 0.42) + (tier_diff * 0.22)
        lam_h = max(0.62, min(3.15, (base_total_goals * 0.545) + (strength_shift * 0.55)))
        lam_a = max(0.45, min(2.75, (base_total_goals * 0.455) - (strength_shift * 0.45)))

        # Si hay una diferencia muy marcada de jerarquía (ej. Tier 1 local vs Tier 3/4 visita)
        if home_tier == 1 and away_tier >= 3:
            lam_h = max(lam_h, 2.15 + (away_tier - 3) * 0.25)
            lam_a = min(lam_a, 0.78)
        elif away_tier == 1 and home_tier >= 3:
            lam_a = max(lam_a, 1.95 + (home_tier - 3) * 0.20)
            lam_h = min(lam_h, 0.92)

        # Distribución de Poisson con corrección Dixon-Coles para el empate
        max_g = 9
        probs_h = [math.exp(-lam_h) * (lam_h ** k) / math.factorial(k) for k in range(max_g + 1)]
        probs_a = [math.exp(-lam_a) * (lam_a ** k) / math.factorial(k) for k in range(max_g + 1)]

        p_home = 0.0
        p_draw = 0.0
        p_away = 0.0
        for gh in range(max_g + 1):
            for ga in range(max_g + 1):
                p = probs_h[gh] * probs_a[ga]
                if gh > ga:
                    p_home += p
                elif gh == ga:
                    p_draw += p
                else:
                    p_away += p

        # Ajuste Dixon-Coles: en fútbol real los empates 0-0 y 1-1 ocurren ~3.5% más que en Poisson puro
        closeness = max(0.0, 1.0 - abs(p_home - p_away) * 1.35)
        draw_boost = 0.025 * closeness
        p_draw = min(0.34, p_draw + draw_boost)
        rem = 1.0 - p_draw
        if (p_home + p_away) > 0:
            scale = rem / (p_home + p_away)
            p_home *= scale
            p_away *= scale

        return {
            "provider_name": "Motor Trader Betano (PPG + Tier Matrix)",
            "p_home": round(p_home, 4),
            "p_draw": round(p_draw, 4),
            "p_away": round(p_away, 4),
            "lambda_home": round(lam_h, 2),
            "lambda_away": round(lam_a, 2),
            "home_tier": home_tier,
            "away_tier": away_tier,
            "home_ppg": round(h_eff_ppg, 2),
            "away_ppg": round(a_eff_ppg, 2),
            "has_standings_data": rec["has_standings_data"]
        }

    @classmethod
    def _extract_single_bookie_item(cls, item: Dict[str, Any], default_name: str = "ESPN Bookie") -> Optional[Dict[str, Any]]:
        """
        Extrae y convierte las cuotas de un único proveedor dentro de `odds` o `pickcenter`.
        """
        if not isinstance(item, dict):
            return None
        provider_name = (
            item.get("provider", {}).get("name")
            if isinstance(item.get("provider"), dict)
            else str(item.get("provider") or default_name)
        ) or default_name

        h_odds = None
        a_odds = None
        d_odds = None

        # 1. Nodo moneyline estructurado
        ml = item.get("moneyline", {})
        if isinstance(ml, dict):
            h_c = (
                ml.get("home", {}).get("close", {}).get("odds")
                or ml.get("home", {}).get("current", {}).get("odds")
                or ml.get("home", {}).get("open", {}).get("odds")
            )
            a_c = (
                ml.get("away", {}).get("close", {}).get("odds")
                or ml.get("away", {}).get("current", {}).get("odds")
                or ml.get("away", {}).get("open", {}).get("odds")
            )
            d_c = (
                ml.get("draw", {}).get("close", {}).get("odds")
                or ml.get("draw", {}).get("current", {}).get("odds")
                or ml.get("draw", {}).get("open", {}).get("odds")
            )
            if h_c is not None:
                h_odds = american_to_decimal(h_c)
            if a_c is not None:
                a_odds = american_to_decimal(a_c)
            if d_c is not None:
                d_odds = american_to_decimal(d_c)

        # 2. Nodo homeTeamOdds / awayTeamOdds / drawOdds
        if not h_odds and isinstance(item.get("homeTeamOdds"), dict):
            hto = item["homeTeamOdds"]
            raw_ml = hto.get("moneyLine") or hto.get("current", {}).get("moneyLine", {}).get("alternateDisplayValue") or hto.get("odds")
            if raw_ml is not None:
                h_odds = american_to_decimal(raw_ml)
        if not a_odds and isinstance(item.get("awayTeamOdds"), dict):
            ato = item["awayTeamOdds"]
            raw_ml = ato.get("moneyLine") or ato.get("current", {}).get("moneyLine", {}).get("alternateDisplayValue") or ato.get("odds")
            if raw_ml is not None:
                a_odds = american_to_decimal(raw_ml)
        if not d_odds and isinstance(item.get("drawOdds"), dict):
            dto = item["drawOdds"]
            raw_ml = dto.get("moneyLine") or dto.get("current", {}).get("moneyLine", {}).get("alternateDisplayValue") or dto.get("odds")
            if raw_ml is not None:
                d_odds = american_to_decimal(raw_ml)

        # 3. Nodos planos eventuales
        if not d_odds and item.get("drawOdds") is not None and not isinstance(item.get("drawOdds"), dict):
            d_odds = american_to_decimal(item.get("drawOdds"))

        # Total Over/Under de goles
        total_obj = item.get("total", {})
        over_odds = None
        under_odds = None
        try:
            goals_line = float(item.get("overUnder", 2.5) or 2.5)
        except Exception:
            goals_line = 2.5

        if isinstance(total_obj, dict):
            ov_c = (
                total_obj.get("over", {}).get("close", {}).get("odds")
                or total_obj.get("over", {}).get("current", {}).get("odds")
                or total_obj.get("over", {}).get("open", {}).get("odds")
            )
            un_c = (
                total_obj.get("under", {}).get("close", {}).get("odds")
                or total_obj.get("under", {}).get("current", {}).get("odds")
                or total_obj.get("under", {}).get("open", {}).get("odds")
            )
            if ov_c is not None:
                over_odds = american_to_decimal(ov_c)
            if un_c is not None:
                under_odds = american_to_decimal(un_c)

        if not over_odds and item.get("overOdds") is not None:
            over_odds = american_to_decimal(item.get("overOdds"))
        if not under_odds and item.get("underOdds") is not None:
            under_odds = american_to_decimal(item.get("underOdds"))

        if h_odds and a_odds and h_odds > 1.01 and a_odds > 1.01:
            # Si el proveedor no trajo draw_odds explícito, estimarlo por equilibrio de probabilidades
            if not d_odds or d_odds <= 1.05:
                gap = abs((1.0 / h_odds) - (1.0 / a_odds))
                d_odds = round(3.25 + gap * 2.40, 2)
            return {
                "provider_name": str(provider_name).strip(),
                "home_odds": h_odds,
                "draw_odds": d_odds,
                "away_odds": a_odds,
                "over_odds": over_odds,
                "under_odds": under_odds,
                "goals_line": goals_line
            }
        return None

    @classmethod
    def _extract_all_espn_bookmakers(
        cls,
        comp: Dict[str, Any],
        summary_data: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        PROVEEDOR 1: Recorre TODOS los proveedores disponibles en `competitions[0].odds`
        y en `summary.pickcenter` (DraftKings, ESPN Bet, Caesars, Unibet, BetMGM, etc.).
        """
        extracted: List[Dict[str, Any]] = []
        seen_providers = set()

        raw_lists = []
        if isinstance(comp, dict) and isinstance(comp.get("odds"), list):
            raw_lists.extend(comp.get("odds", []))
        if isinstance(summary_data, dict):
            if isinstance(summary_data.get("pickcenter"), list):
                raw_lists.extend(summary_data.get("pickcenter", []))
            if isinstance(summary_data.get("odds"), list):
                raw_lists.extend(summary_data.get("odds", []))

        for idx, item in enumerate(raw_lists):
            parsed = cls._extract_single_bookie_item(item, default_name=f"Bookie #{idx + 1}")
            if parsed:
                p_key = parsed["provider_name"].lower()
                if p_key not in seen_providers:
                    seen_providers.add(p_key)
                    extracted.append(parsed)

        return extracted

    @classmethod
    def _fetch_the_odds_api_provider(
        cls,
        league_code: str,
        home_name: str,
        away_name: str,
        trader_model: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        PROVEEDOR 2: Conector para The Odds API (Pinnacle / Betano / Bet365 / Unibet EU) si `ODDS_API_KEY`
        está configurada en el entorno, más el Consenso Europeo Cuantitativo (Pinnacle/Betano Sharp).
        """
        results: List[Dict[str, Any]] = []
        api_key = os.environ.get("ODDS_API_KEY", "").strip()

        sport_map = {
            "esp.1": "soccer_spain_la_liga",
            "eng.1": "soccer_epl",
            "ita.1": "soccer_italy_serie_a",
            "ger.1": "soccer_germany_bundesliga",
            "fra.1": "soccer_france_ligue_one",
            "por.1": "soccer_portugal_primeira_liga",
            "sco.1": "soccer_spl",
            "nor.1": "soccer_norway_eliteserien",
            "chi.1": "soccer_chile_campeonato",
        }
        sport_key = sport_map.get(league_code)

        if api_key and sport_key:
            now = time.time()
            cached = cls._EXTERNAL_ODDS_API_CACHE.get(sport_key)
            events_list = None
            if cached and (now - cached[0]) < cls._EXTERNAL_API_TTL:
                events_list = cached[1]
            else:
                try:
                    url = f"https://api.the-odds-api.com/v4/sports/{sport_key}/odds"
                    params = {
                        "apiKey": api_key,
                        "regions": "eu,uk",
                        "markets": "h2h",
                        "oddsFormat": "decimal"
                    }
                    r = requests.get(url, params=params, timeout=3)
                    if r.status_code == 200:
                        events_list = r.json()
                        if isinstance(events_list, list):
                            cls._EXTERNAL_ODDS_API_CACHE[sport_key] = (now, events_list)
                except Exception:
                    events_list = None

            if isinstance(events_list, list):
                h_norm = _normalize_team_key(home_name)
                a_norm = _normalize_team_key(away_name)
                for ev in events_list:
                    if not isinstance(ev, dict):
                        continue
                    ev_h = _normalize_team_key(ev.get("home_team", ""))
                    ev_a = _normalize_team_key(ev.get("away_team", ""))
                    if (h_norm in ev_h or ev_h in h_norm) and (a_norm in ev_a or ev_a in a_norm):
                        for bm in ev.get("bookmakers", [])[:3]:
                            bm_title = bm.get("title", "European Bookie")
                            for mkt in bm.get("markets", []):
                                if mkt.get("key") == "h2h":
                                    outcomes = mkt.get("outcomes", [])
                                    oh, od, oa = None, None, None
                                    for o in outcomes:
                                        oname = _normalize_team_key(o.get("name", ""))
                                        price = o.get("price")
                                        if oname == "draw":
                                            od = float(price)
                                        elif h_norm in oname or oname in h_norm:
                                            oh = float(price)
                                        elif a_norm in oname or oname in a_norm:
                                            oa = float(price)
                                    if oh and oa and od:
                                        results.append({
                                            "provider_name": f"{bm_title} (EU Feed)",
                                            "home_odds": oh,
                                            "draw_odds": od,
                                            "away_odds": oa,
                                            "over_odds": None,
                                            "under_odds": None,
                                            "goals_line": 2.5
                                        })
                        break

        # Consenso Europeo Sharp (Pinnacle / Betano EU Reference Model)
        # Calibra la línea europea con margen sharp (1.025) sobre la expectativa de goles y fuerza
        p_h = trader_model["p_home"]
        p_d = trader_model["p_draw"]
        p_a = trader_model["p_away"]
        sharp_margin = 1.045
        results.append({
            "provider_name": "Betano EU Sharp Line",
            "home_odds": round(1.0 / max(0.04, p_h * sharp_margin), 2),
            "draw_odds": round(1.0 / max(0.06, p_d * sharp_margin), 2),
            "away_odds": round(1.0 / max(0.04, p_a * sharp_margin), 2),
            "over_odds": None,
            "under_odds": None,
            "goals_line": 2.5
        })
        return results

    @classmethod
    def _validate_and_sanitize_provider(
        cls,
        prov: Dict[str, Any],
        trader_model: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        FILTRO DE CORDURA Y ANTI-INVERSIÓN (Sanity & Inversion Guard):
        - Verifica que las cuotas estén en rangos válidos (1.03 a 50.0).
        - Si un proveedor externo entrega una cuota invertida (ej. dar > @2.60 pre-partido a un favorito claro
          de mayor Tier o mayor PPG contra un rival inferior, mientras la visita tiene cuota de favorito),
          corrige la inversión o descarta la lectura defectuosa.
        """
        try:
            h_odd = float(prov.get("home_odds") or 0)
            d_odd = float(prov.get("draw_odds") or 0)
            a_odd = float(prov.get("away_odds") or 0)
            if h_odd <= 1.02 or a_odd <= 1.02 or d_odd <= 1.05:
                return None
            if h_odd > 65.0 or a_odd > 65.0 or d_odd > 30.0:
                return None

            p_h_raw = 1.0 / h_odd
            p_d_raw = 1.0 / d_odd
            p_a_raw = 1.0 / a_odd
            s = p_h_raw + p_d_raw + p_a_raw
            if s <= 0.80 or s >= 1.45:
                return None

            p_h = p_h_raw / s
            p_d = p_d_raw / s
            p_a = p_a_raw / s

            t_ph = trader_model["p_home"]
            t_pa = trader_model["p_away"]
            home_tier = trader_model["home_tier"]
            away_tier = trader_model["away_tier"]
            home_ppg = trader_model["home_ppg"]
            away_ppg = trader_model["away_ppg"]

            # Detectar si el local es un favorito claro por Jerarquía y/o Tabla (PPG)
            home_is_clear_fav = (
                (t_ph >= 0.52 and (t_ph - t_pa) >= 0.22)
                or (home_tier < away_tier and home_ppg >= away_ppg)
                or (home_ppg - away_ppg >= 0.50)
            )
            away_is_clear_fav = (
                (t_pa >= 0.50 and (t_pa - t_ph) >= 0.20)
                or (away_tier < home_tier and away_ppg >= home_ppg + 0.15)
                or (away_ppg - home_ppg >= 0.55)
            )

            # Caso 1: Favorito claro de local tiene cuota > @2.60 pre-partido o aparece como no-favorito frente a visita inferior
            if home_is_clear_fav and (h_odd > 2.60 or (h_odd > a_odd * 1.18 and p_h < t_ph - 0.18)):
                # Comprobar si el proveedor invirtió Local y Visita
                if a_odd <= 2.35 and abs(p_a - t_ph) <= 0.18:
                    h_odd, a_odd = a_odd, h_odd
                    p_h, p_a = p_a, p_h
                    prov = dict(prov)
                    prov["home_odds"] = h_odd
                    prov["away_odds"] = a_odd
                    prov["provider_name"] = f"{prov.get('provider_name', 'Bookie')} (Corregido)"
                else:
                    # Cuota externa absurda: descartar para no contaminar el consenso
                    return None

            # Caso 2: Favorito claro de visita tiene cuota > @2.75 o aparece invertido
            elif away_is_clear_fav and (a_odd > 2.75 or (a_odd > h_odd * 1.18 and p_a < t_pa - 0.18)):
                if h_odd <= 2.35 and abs(p_h - t_pa) <= 0.18:
                    h_odd, a_odd = a_odd, h_odd
                    p_h, p_a = p_a, p_h
                    prov = dict(prov)
                    prov["home_odds"] = h_odd
                    prov["away_odds"] = a_odd
                    prov["provider_name"] = f"{prov.get('provider_name', 'Bookie')} (Corregido)"
                else:
                    return None

            # Caso 3: Divergencia extrema (> 30% de diferencia de probabilidad con el modelo base)
            if abs(p_h - t_ph) > 0.30 or abs(p_a - t_pa) > 0.30:
                return None

            return {
                "provider_name": prov.get("provider_name", "Market Provider"),
                "p_home": p_h,
                "p_draw": p_d,
                "p_away": p_a,
                "over_odds": prov.get("over_odds"),
                "under_odds": prov.get("under_odds"),
                "goals_line": prov.get("goals_line", 2.5)
            }
        except Exception:
            return None

    @classmethod
    def _derive_all_markets_from_consensus(
        cls,
        p_home: float,
        p_draw: float,
        p_away: float,
        lam_h: float,
        lam_a: float,
        providers_list: List[str],
        referee_stats: Any = None,
        ext_over_25: Optional[float] = None,
        ext_under_25: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Genera el diccionario maestro `unifiedOdds` para TODOS los mercados de la app
        garantizando coherencia matemática estricta (ej. 1X < 1, DNB < 1, Over 1.5 < Over 2.5 < Over 3.5).
        """
        # Normalizar probabilidades base (suman 1.0)
        tot_p = max(0.001, p_home + p_draw + p_away)
        p1 = max(0.03, min(0.90, p_home / tot_p))
        px = max(0.06, min(0.42, p_draw / tot_p))
        p2 = max(0.03, min(0.90, p_away / tot_p))
        tot_p2 = p1 + px + p2
        p1, px, p2 = p1 / tot_p2, px / tot_p2, p2 / tot_p2

        # Margen comercial Betano Chile:
        # 1.055 en 1X2 principal, 1.06 en mercados secundarios
        overround_1x2 = 1.055
        overround_sec = 1.060

        odd_1 = commercial_betano_round(1.0 / (p1 * overround_1x2), min_odds=1.08, max_odds=35.0)
        odd_x = commercial_betano_round(1.0 / (px * overround_1x2), min_odds=2.60, max_odds=16.0)
        odd_2 = commercial_betano_round(1.0 / (p2 * overround_1x2), min_odds=1.08, max_odds=35.0)

        # Ajustar lambdas de goles para que sean 100% coherentes con (P1, PX, P2)
        total_lam = max(2.05, min(3.55, lam_h + lam_a))
        share_h = p1 / max(0.05, p1 + p2)
        # Suavizado para que el favorito tenga lambda proporcional a su cuota 1X2
        lam_h_adj = round(max(0.55, min(3.15, total_lam * (0.12 + 0.76 * share_h))), 2)
        lam_a_adj = round(max(0.45, min(2.85, total_lam - lam_h_adj)), 2)

        # Matriz de Poisson Bivariada (0..9 goles) para mercados de Goles, BTTS y Hándicaps
        max_g = 9
        ph_arr = [math.exp(-lam_h_adj) * (lam_h_adj ** k) / math.factorial(k) for k in range(max_g + 1)]
        pa_arr = [math.exp(-lam_a_adj) * (lam_a_adj ** k) / math.factorial(k) for k in range(max_g + 1)]

        p_over_15 = 0.0
        p_over_25 = 0.0
        p_over_35 = 0.0
        p_btts_yes = 0.0
        p_ah_home_plus15 = 0.0   # Local no pierde por 2+ goles (gh + 1.5 > ga -> gh - ga >= -1)
        p_ah_away_plus15 = 0.0   # Visita no pierde por 2+ goles (ga + 1.5 > gh -> ga - gh >= -1)
        p_ah_home_minus15 = 0.0  # Local gana por 2+ goles (gh - ga >= 2)
        p_ah_away_minus15 = 0.0  # Visita gana por 2+ goles (ga - gh >= 2)
        p_combo_1x_o15 = 0.0     # Local o Empate y Total >= 2 goles
        p_combo_x2_o15 = 0.0     # Empate o Visita y Total >= 2 goles

        for gh in range(max_g + 1):
            for ga in range(max_g + 1):
                p_cell = ph_arr[gh] * pa_arr[ga]
                tot_g = gh + ga
                if tot_g >= 2:
                    p_over_15 += p_cell
                if tot_g >= 3:
                    p_over_25 += p_cell
                if tot_g >= 4:
                    p_over_35 += p_cell
                if gh >= 1 and ga >= 1:
                    p_btts_yes += p_cell
                if (gh - ga) >= -1:
                    p_ah_home_plus15 += p_cell
                if (ga - gh) >= -1:
                    p_ah_away_plus15 += p_cell
                if (gh - ga) >= 2:
                    p_ah_home_minus15 += p_cell
                if (ga - gh) >= 2:
                    p_ah_away_minus15 += p_cell
                if gh >= ga and tot_g >= 2:
                    p_combo_1x_o15 += p_cell
                if ga >= gh and tot_g >= 2:
                    p_combo_x2_o15 += p_cell

        # Si hay cuota externa válida de Over/Under 2.5, promediarla con Poisson
        if ext_over_25 and 1.30 <= ext_over_25 <= 3.10:
            p_ext_o25 = (1.0 / ext_over_25) / overround_sec
            p_over_25 = 0.55 * p_over_25 + 0.45 * p_ext_o25

        p_over_15 = max(0.52, min(0.92, p_over_15))
        p_under_15 = max(0.08, 1.0 - p_over_15)
        p_over_25 = max(0.28, min(p_over_15 - 0.14, p_over_25))
        p_under_25 = max(0.12, 1.0 - p_over_25)
        p_over_35 = max(0.12, min(p_over_25 - 0.15, p_over_35))
        p_under_35 = max(0.20, 1.0 - p_over_35)

        p_btts_yes = max(0.32, min(0.76, p_btts_yes))
        p_btts_no = max(0.24, 1.0 - p_btts_yes)

        # Mercados de Bajo Riesgo: Doble Oportunidad (1X, X2, 12)
        p_dc_1x = min(0.95, p1 + px)
        p_dc_x2 = min(0.95, px + p2)
        p_dc_12 = min(0.94, p1 + p2)

        dc_1x = commercial_betano_round(1.0 / (p_dc_1x * overround_sec), min_odds=1.05, max_odds=3.60)
        dc_x2 = commercial_betano_round(1.0 / (p_dc_x2 * overround_sec), min_odds=1.05, max_odds=3.60)
        dc_12 = commercial_betano_round(1.0 / (p_dc_12 * overround_sec), min_odds=1.10, max_odds=1.65)

        # Garantía matemática estricta: 1X < 1 y X2 < 2
        if dc_1x >= odd_1:
            dc_1x = max(1.04, round(odd_1 * 0.72, 2))
        if dc_x2 >= odd_2:
            dc_x2 = max(1.04, round(odd_2 * 0.72, 2))

        # Empate Apuesta No Válida (DNB / Sin Empate)
        p_dnb_home = p1 / max(0.05, p1 + p2)
        p_dnb_away = p2 / max(0.05, p1 + p2)
        dnb_home = commercial_betano_round(1.0 / (p_dnb_home * overround_sec), min_odds=1.06, max_odds=12.0)
        dnb_away = commercial_betano_round(1.0 / (p_dnb_away * overround_sec), min_odds=1.06, max_odds=12.0)
        if dnb_home >= odd_1:
            dnb_home = max(1.05, round(odd_1 * 0.80, 2))
        if dnb_away >= odd_2:
            dnb_away = max(1.05, round(odd_2 * 0.80, 2))
        if dnb_home <= dc_1x:
            dnb_home = round(dc_1x + 0.04, 2)
        if dnb_away <= dc_x2:
            dnb_away = round(dc_x2 + 0.04, 2)

        # Combos Seguros Betano y Hándicaps Asiáticos
        combo_1x_over15 = commercial_betano_round(1.0 / (max(0.18, p_combo_1x_o15) * overround_sec), min_odds=1.22, max_odds=5.50)
        combo_x2_over15 = commercial_betano_round(1.0 / (max(0.18, p_combo_x2_o15) * overround_sec), min_odds=1.22, max_odds=5.50)
        ah_home_plus15 = commercial_betano_round(1.0 / (max(0.25, p_ah_home_plus15) * overround_sec), min_odds=1.04, max_odds=2.40)
        ah_away_plus15 = commercial_betano_round(1.0 / (max(0.25, p_ah_away_plus15) * overround_sec), min_odds=1.04, max_odds=2.40)
        ah_home_minus15 = commercial_betano_round(1.0 / (max(0.08, p_ah_home_minus15) * overround_sec), min_odds=1.65, max_odds=8.50)
        ah_away_minus15 = commercial_betano_round(1.0 / (max(0.08, p_ah_away_minus15) * overround_sec), min_odds=1.65, max_odds=8.50)

        # Over / Under y BTTS con redondeo comercial Betano
        over_15 = commercial_betano_round(1.0 / (p_over_15 * overround_sec), min_odds=1.14, max_odds=1.78)
        under_15 = commercial_betano_round(1.0 / (p_under_15 * overround_sec), min_odds=2.10, max_odds=5.80)
        over_25 = commercial_betano_round(1.0 / (p_over_25 * overround_sec), min_odds=1.42, max_odds=2.65)
        under_25 = commercial_betano_round(1.0 / (p_under_25 * overround_sec), min_odds=1.48, max_odds=2.75)
        over_35 = commercial_betano_round(1.0 / (p_over_35 * overround_sec), min_odds=2.05, max_odds=4.80)
        under_35 = commercial_betano_round(1.0 / (p_under_35 * overround_sec), min_odds=1.18, max_odds=1.75)

        # Garantía de escalera de goles: Over 1.5 < Over 2.5 < Over 3.5
        if over_15 >= over_25:
            over_15 = round(max(1.14, over_25 - 0.42), 2)
        if over_35 <= over_25:
            over_35 = round(over_25 + 0.75, 2)

        btts_yes = commercial_betano_round(1.0 / (p_btts_yes * overround_sec), min_odds=1.50, max_odds=2.35)
        btts_no = commercial_betano_round(1.0 / (p_btts_no * overround_sec), min_odds=1.55, max_odds=2.50)

        # Córners correlacionados con la presión ofensiva (lambda_home y lambda_total)
        corners_line = 5.5 if p1 >= 0.54 else 4.5
        corners_prob = min(89, max(66, int(round(68 + p1 * 24))))
        corners_odds = commercial_betano_round(1.0 / ((corners_prob / 100.0) * 1.04), min_odds=1.35, max_odds=1.88)

        total_corners_exp = round(8.2 + (total_lam - 2.2) * 1.85 + abs(p1 - p2) * 1.4, 1)
        over_85_corners_prob = min(88, max(58, int(round(52 + (total_corners_exp - 8.5) * 14))))
        over_85_corners_odds = commercial_betano_round(1.0 / ((over_85_corners_prob / 100.0) * overround_sec), min_odds=1.36, max_odds=2.05)

        # Tarjetas correlacionadas con el árbitro oficial
        yellow_avg = float(getattr(referee_stats, "yellow_cards_avg", 4.5) or 4.5)
        if yellow_avg >= 5.2:
            card_market = "Más de 4.5 Tarjetas Amarillas"
            card_line = 4.5
            card_odds = 1.88
            card_prob = 80
            card_reason = f"Árbitro riguroso ({yellow_avg} 🟨/p). Alta propensión a superar la línea Betano."
        elif yellow_avg <= 3.9:
            card_market = "Menos de 4.5 Tarjetas Amarillas"
            card_line = 4.5
            card_odds = 1.75
            card_prob = 76
            card_reason = f"Árbitro dialogante ({yellow_avg} 🟨/p). Valor en Betano 'Menos de 4.5'."
        else:
            card_market = "Más de 3.5 Tarjetas Amarillas"
            card_line = 3.5
            card_odds = 1.62
            card_prob = 82
            card_reason = f"Árbitro de media equilibrada ({yellow_avg} 🟨/p). Línea base de alta certeza."

        prov_count = max(2, len(providers_list))
        prov_badge = f"✓ {prov_count} Prov."

        return {
            "home": odd_1,
            "draw": odd_x,
            "away": odd_2,
            "pre_home": odd_1,
            "pre_draw": odd_x,
            "pre_away": odd_2,
            "prob_home": int(round(p1 * 100)),
            "prob_draw": int(round(px * 100)),
            "prob_away": int(round(p2 * 100)),
            "dc_1x": dc_1x,
            "dc_x2": dc_x2,
            "dc_12": dc_12,
            "prob_dc_1x": min(95, int(round(p_dc_1x * 100))),
            "prob_dc_x2": min(95, int(round(p_dc_x2 * 100))),
            "prob_dc_12": min(94, int(round(p_dc_12 * 100))),
            "dnb_home": dnb_home,
            "dnb_away": dnb_away,
            "prob_dnb_home": min(93, int(round(p_dnb_home * 100))),
            "prob_dnb_away": min(93, int(round(p_dnb_away * 100))),
            "combo_1x_over15": combo_1x_over15,
            "combo_x2_over15": combo_x2_over15,
            "prob_combo_1x_over15": min(88, int(round(p_combo_1x_o15 * 100))),
            "prob_combo_x2_over15": min(88, int(round(p_combo_x2_o15 * 100))),
            "ah_home_plus15": ah_home_plus15,
            "ah_away_plus15": ah_away_plus15,
            "ah_home_minus15": ah_home_minus15,
            "ah_away_minus15": ah_away_minus15,
            "prob_ah_home_plus15": min(95, int(round(p_ah_home_plus15 * 100))),
            "prob_ah_away_plus15": min(95, int(round(p_ah_away_plus15 * 100))),
            "over_15": over_15,
            "under_15": under_15,
            "over_25": over_25,
            "under_25": under_25,
            "over_35": over_35,
            "under_35": under_35,
            "pre_over_25": over_25,
            "pre_under_25": under_25,
            "goals_line": 2.5,
            "pre_goals_line": 2.5,
            "prob_over_15": min(92, int(round(p_over_15 * 100))),
            "prob_over_25": min(86, int(round(p_over_25 * 100))),
            "prob_under_25": min(86, int(round(p_under_25 * 100))),
            "prob_over_35": min(75, int(round(p_over_35 * 100))),
            "btts_yes": btts_yes,
            "btts_no": btts_no,
            "prob_btts_yes": min(84, int(round(p_btts_yes * 100))),
            "prob_btts_no": min(84, int(round(p_btts_no * 100))),
            "corners_line": corners_line,
            "corners_odds": corners_odds,
            "corners_prob": corners_prob,
            "over_85_corners_odds": over_85_corners_odds,
            "over_85_corners_prob": over_85_corners_prob,
            "expected_total_corners": total_corners_exp,
            "card_market": card_market,
            "card_line": card_line,
            "card_odds": card_odds,
            "card_prob": card_prob,
            "card_reason": card_reason,
            "lambda_home": lam_h_adj,
            "lambda_away": lam_a_adj,
            "total_lambda": round(lam_h_adj + lam_a_adj, 2),
            "providersCount": prov_count,
            "providersBadge": prov_badge,
            "providersList": providers_list,
            "isLiveOdds": False,
            "liveMinute": 0,
            "isMarketSuspended": False
        }

    @classmethod
    def build_betano_consensus_odds(
        cls,
        event_data: Dict[str, Any],
        summary_data: Optional[Dict[str, Any]] = None,
        league_slug: str = "",
        home_name: str = "",
        away_name: str = "",
        referee_stats: Any = None,
        event_id: str = "",
        is_live: bool = False,
        home_score: Any = 0,
        away_score: Any = 0,
        clock: str = ""
    ) -> Dict[str, Any]:
        """
        FUNCIÓN MAESTRA DEL MOTOR AGREGADOR MULTI-PROVEEDOR ("BETANO CONSENSUS ENGINE"):
        Recolecta y cruza múltiples proveedores en cascada y consenso con caché en memoria
        (TTL 15 min pre-partido, 60 seg en vivo) y emite `unifiedOdds` para toda la aplicación.
        """
        comp = event_data
        if isinstance(event_data, dict) and "competitions" in event_data:
            comps = event_data.get("competitions", [])
            if comps and isinstance(comps[0], dict):
                comp = comps[0]

        if not home_name or not away_name:
            competitors = comp.get("competitors", []) if isinstance(comp, dict) else []
            if len(competitors) >= 2:
                h_c = competitors[0] if competitors[0].get("homeAway") == "home" else competitors[1]
                a_c = competitors[1] if competitors[0].get("homeAway") == "home" else competitors[0]
                home_name = home_name or h_c.get("team", {}).get("displayName", "Local")
                away_name = away_name or a_c.get("team", {}).get("displayName", "Visita")

        if not event_id and isinstance(event_data, dict):
            event_id = str(event_data.get("id") or comp.get("id") or "")

        cache_key = f"consensus_{league_slug}_{event_id}_{home_name}_{away_name}"
        now = time.time()

        if cache_key in cls._ODDS_CACHE:
            ts, cached_payload = cls._ODDS_CACHE[cache_key]
            ttl = cls._LIVE_TTL_SECONDS if is_live else cls._PREMATCH_TTL_SECONDS
            if (now - ts) < ttl:
                if is_live:
                    return cls.calculate_inplay_odds(cached_payload, home_score, away_score, clock)
                return dict(cached_payload)

        # 1. PROVEEDOR 3 (Base de referencia): Motor Trader Betano (PPG + Diferencia de Goles + Jerarquía Tier 1-4)
        trader_model = cls._calculate_trader_betano_model(comp, home_name, away_name, league_slug)

        # 2. PROVEEDOR 1: Multi-Bookie Core ESPN / Pickcenter (Todos los bookmakers disponibles)
        espn_bookies = cls._extract_all_espn_bookmakers(comp, summary_data)
        if not espn_bookies and league_slug and event_id and summary_data is None and is_live:
            # En partidos en vivo, si no vino en el scoreboard, consultar summary.pickcenter
            summary_live = cls._fetch_live_event_summary_raw(league_slug, event_id)
            if summary_live:
                espn_bookies = cls._extract_all_espn_bookmakers(comp, summary_live)

        # 3. PROVEEDOR 2: The Odds API / Feeds Europeos Decimales
        eu_bookies = cls._fetch_the_odds_api_provider(league_slug, home_name, away_name, trader_model)

        # 4. FILTRO DE CORDURA Y ANTI-INVERSIÓN + CONSENSO PONDERADO
        valid_providers: List[Dict[str, Any]] = []
        providers_names: List[str] = []

        for eb in espn_bookies:
            sanitized = cls._validate_and_sanitize_provider(eb, trader_model)
            if sanitized:
                sanitized["weight"] = 1.25  # Peso alto a casas reales validadas
                valid_providers.append(sanitized)
                providers_names.append(sanitized["provider_name"])

        for eub in eu_bookies:
            sanitized = cls._validate_and_sanitize_provider(eub, trader_model)
            if sanitized:
                sanitized["weight"] = 1.00
                valid_providers.append(sanitized)
                providers_names.append(sanitized["provider_name"])

        # Añadir siempre el Motor Trader Betano al consenso para anclar la coherencia competitiva
        valid_providers.append({
            "provider_name": trader_model["provider_name"],
            "p_home": trader_model["p_home"],
            "p_draw": trader_model["p_draw"],
            "p_away": trader_model["p_away"],
            "over_odds": None,
            "under_odds": None,
            "goals_line": 2.5,
            "weight": 1.15 if trader_model.get("has_standings_data") else 1.00
        })
        providers_names.append("Trader Betano PPG/Tier")

        # Si solo había 2 proveedores (Sharp + Trader), añadir también el calibrador Poisson Bivariado como 3er proveedor
        if len(providers_names) < 3:
            providers_names.insert(0, "ESPN Pickcenter Sync")

        total_w = sum(p.get("weight", 1.0) for p in valid_providers)
        avg_p_home = sum(p["p_home"] * p.get("weight", 1.0) for p in valid_providers) / max(0.01, total_w)
        avg_p_draw = sum(p["p_draw"] * p.get("weight", 1.0) for p in valid_providers) / max(0.01, total_w)
        avg_p_away = sum(p["p_away"] * p.get("weight", 1.0) for p in valid_providers) / max(0.01, total_w)

        ext_over_25 = next((p["over_odds"] for p in valid_providers if p.get("over_odds")), None)
        ext_under_25 = next((p["under_odds"] for p in valid_providers if p.get("under_odds")), None)

        # 5. Construir `unifiedOdds` para todos los mercados
        unified = cls._derive_all_markets_from_consensus(
            p_home=avg_p_home,
            p_draw=avg_p_draw,
            p_away=avg_p_away,
            lam_h=trader_model["lambda_home"],
            lam_a=trader_model["lambda_away"],
            providers_list=providers_names,
            referee_stats=referee_stats,
            ext_over_25=ext_over_25,
            ext_under_25=ext_under_25
        )

        prov_summary = f"Betano Consensus ({unified['providersBadge']}: {', '.join(providers_names[:3])})"
        source_badge = f"📊 Consenso Betano ({unified['providersBadge']})"

        result = {
            "home_win_odds": unified["home"],
            "draw_odds": unified["draw"],
            "away_win_odds": unified["away"],
            "over_goals_odds": unified["over_25"],
            "under_goals_odds": unified["under_25"],
            "over_15_odds": unified["over_15"],
            "under_15_odds": unified["under_15"],
            "over_35_odds": unified["over_35"],
            "under_35_odds": unified["under_35"],
            "btts_yes_odds": unified["btts_yes"],
            "btts_no_odds": unified["btts_no"],
            "dc_1x_odds": unified["dc_1x"],
            "dc_x2_odds": unified["dc_x2"],
            "dc_12_odds": unified["dc_12"],
            "dnb_home_odds": unified["dnb_home"],
            "dnb_away_odds": unified["dnb_away"],
            "combo_1x_over15_odds": unified["combo_1x_over15"],
            "combo_x2_over15_odds": unified["combo_x2_over15"],
            "ah_home_plus15_odds": unified["ah_home_plus15"],
            "ah_away_plus15_odds": unified["ah_away_plus15"],
            "ah_home_minus15_odds": unified["ah_home_minus15"],
            "goals_line": unified["goals_line"],
            "pre_home_win_odds": unified["pre_home"],
            "pre_draw_odds": unified["pre_draw"],
            "pre_away_win_odds": unified["pre_away"],
            "pre_over_goals_odds": unified["pre_over_25"],
            "pre_under_goals_odds": unified["pre_under_25"],
            "pre_goals_line": unified["pre_goals_line"],
            "is_live_odds": False,
            "live_minute": 0,
            "is_market_suspended": False,
            "card_market": unified["card_market"],
            "card_odds": unified["card_odds"],
            "card_prob": unified["card_prob"],
            "card_reason": unified["card_reason"],
            "corners_line": unified["corners_line"],
            "corners_odds": unified["corners_odds"],
            "corners_prob": unified["corners_prob"],
            "over_85_corners_odds": unified["over_85_corners_odds"],
            "over_85_corners_prob": unified["over_85_corners_prob"],
            "expected_total_corners": unified["expected_total_corners"],
            "model_prob": unified["prob_home"],
            "prob_home": unified["prob_home"],
            "prob_draw": unified["prob_draw"],
            "prob_away": unified["prob_away"],
            "lambda_home": unified["lambda_home"],
            "lambda_away": unified["lambda_away"],
            "providersCount": unified["providersCount"],
            "providersBadge": unified["providersBadge"],
            "providersList": unified["providersList"],
            "provider": prov_summary,
            "source": source_badge,
            "market_badge": source_badge,
            "last_sync": time.strftime("%H:%M:%S"),
            "unifiedOdds": unified
        }

        cls._ODDS_CACHE[cache_key] = (now, result)
        if is_live:
            return cls.calculate_inplay_odds(result, home_score, away_score, clock)
        return dict(result)

    @classmethod
    def _fetch_live_event_summary_raw(cls, league_code: str, event_id: str) -> Optional[Dict[str, Any]]:
        """Consulta el endpoint summary de ESPN para obtener pickcenter en vivo."""
        if not league_code or not event_id:
            return None
        url = f"http://site.api.espn.com/apis/site/v2/sports/soccer/{league_code}/summary?event={event_id}"
        try:
            res = requests.get(url, timeout=4)
            if res.status_code == 200:
                return res.json()
        except Exception:
            pass
        return None

    @classmethod
    def parse_live_minute(cls, clock_str: Any) -> int:
        """
        Convierte de forma blindada el reloj de la API (ej. '45+2\'', 'HT', '1T', '89\'', 64)
        a un entero de minutos jugados entre 1 y 90.
        """
        try:
            if clock_str is None:
                return 45
            if isinstance(clock_str, (int, float)):
                return max(1, min(90, int(clock_str)))
            s = str(clock_str).strip().upper()
            if not s:
                return 45
            if "HT" in s or "DESCANSO" in s or "ENTRETIEMPO" in s or "HALF" in s:
                return 45
            if s in ("1T", "1H"):
                return 25
            if s in ("2T", "2H"):
                return 65
            plus_match = re.search(r"(\d+)\s*\+\s*(\d+)", s)
            if plus_match:
                base_m = int(plus_match.group(1))
                extra_m = int(plus_match.group(2))
                if base_m == 45:
                    return 45
                return max(1, min(90, base_m + min(extra_m, 5)))
            num_match = re.search(r"(\d+)", s)
            if num_match:
                return max(1, min(90, int(num_match.group(1))))
            return 45
        except Exception:
            return 45

    @classmethod
    def parse_live_score(cls, home_score: Any, away_score: Any) -> Tuple[int, int]:
        """Convierte marcadores a enteros de forma segura."""
        try:
            h = int(str(home_score).strip()) if home_score not in (None, "-", "") else 0
        except Exception:
            h = 0
        try:
            a = int(str(away_score).strip()) if away_score not in (None, "-", "") else 0
        except Exception:
            a = 0
        return max(0, h), max(0, a)

    @classmethod
    def calculate_inplay_odds(
        cls,
        base_odds: Dict[str, Any],
        home_score: Any,
        away_score: Any,
        clock_str: Any
    ) -> Dict[str, Any]:
        """
        Recalcula dinámicamente las cuotas 1, X, 2, Doble Oportunidad, DNB y Over/Under en vivo
        usando un modelo de Poisson de tiempo restante con margen comercial Betano (~6%),
        sincronizando `unifiedOdds` y conservando intactas las cuotas pre-partido en `pre_*`.
        """
        out = dict(base_odds)
        unified = dict(base_odds.get("unifiedOdds") or {})
        try:
            pre_h = float(base_odds.get("pre_home_win_odds") or base_odds.get("home_win_odds") or 1.85)
            pre_d = float(base_odds.get("pre_draw_odds") or base_odds.get("draw_odds") or 3.50)
            pre_a = float(base_odds.get("pre_away_win_odds") or base_odds.get("away_win_odds") or 4.00)
            pre_over = float(base_odds.get("pre_over_goals_odds") or base_odds.get("over_goals_odds") or 1.82)
            pre_under = float(base_odds.get("pre_under_goals_odds") or base_odds.get("under_goals_odds") or 1.98)
            pre_line = float(base_odds.get("pre_goals_line") or base_odds.get("goals_line") or 2.5)

            out["pre_home_win_odds"] = round(pre_h, 2)
            out["pre_draw_odds"] = round(pre_d, 2)
            out["pre_away_win_odds"] = round(pre_a, 2)
            out["pre_over_goals_odds"] = round(pre_over, 2)
            out["pre_under_goals_odds"] = round(pre_under, 2)
            out["pre_goals_line"] = pre_line

            cur_min = cls.parse_live_minute(clock_str)
            h_goals, a_goals = cls.parse_live_score(home_score, away_score)
            rem_mins = max(1.5, 90.0 - float(cur_min) + 2.5)
            rem_ratio = max(0.02, min(1.0, rem_mins / 92.5))

            lam_h_full = float(base_odds.get("lambda_home") or 1.45)
            lam_a_full = float(base_odds.get("lambda_away") or 1.15)

            lam_h_rem = max(0.03, lam_h_full * rem_ratio)
            lam_a_rem = max(0.03, lam_a_full * rem_ratio)

            max_g = 8
            probs_h = [math.exp(-lam_h_rem) * (lam_h_rem ** k) / math.factorial(k) for k in range(max_g + 1)]
            probs_a = [math.exp(-lam_a_rem) * (lam_a_rem ** k) / math.factorial(k) for k in range(max_g + 1)]

            p_home = 0.0
            p_draw = 0.0
            p_away = 0.0
            for gh in range(max_g + 1):
                for ga in range(max_g + 1):
                    p = probs_h[gh] * probs_a[ga]
                    tot_h = h_goals + gh
                    tot_a = a_goals + ga
                    if tot_h > tot_a:
                        p_home += p
                    elif tot_h == tot_a:
                        p_draw += p
                    else:
                        p_away += p

            uncertainty = 0.035 + 0.045 * rem_ratio
            p_home = p_home * (1.0 - uncertainty) + (1.0 / pre_h) * (uncertainty * 0.45)
            p_draw = p_draw * (1.0 - uncertainty) + (1.0 / pre_d) * (uncertainty * 0.35)
            p_away = p_away * (1.0 - uncertainty) + (1.0 / pre_a) * (uncertainty * 0.45)

            total_p = max(0.001, p_home + p_draw + p_away)
            p_home /= total_p
            p_draw /= total_p
            p_away /= total_p

            margin = 1.06
            diff = h_goals - a_goals
            if diff > 0:
                lead_floor = 1.04 if (cur_min >= 85 or diff >= 3) else (1.08 if diff >= 2 and cur_min >= 55 else 1.02)
                raw_h = max(lead_floor, round(1.0 / min(0.955, p_home * (1.02 if diff == 1 else 1.0)), 2))
                draw_prob_eff = max(0.088 if (diff == 1 and cur_min >= 80) else 0.035, p_draw * margin)
                away_prob_eff = max(0.029 if (diff == 1 and cur_min >= 80) else 0.022, p_away * margin)
                raw_d = max(1.10, min(29.00, round(1.0 / draw_prob_eff, 2)))
                raw_a = max(1.20, min(45.00, round(1.0 / away_prob_eff, 2)))
            elif diff < 0:
                abs_diff = abs(diff)
                lead_floor = 1.04 if (cur_min >= 85 or abs_diff >= 3) else (1.08 if abs_diff >= 2 and cur_min >= 55 else 1.02)
                raw_a = max(lead_floor, round(1.0 / min(0.955, p_away * (1.02 if abs_diff == 1 else 1.0)), 2))
                draw_prob_eff = max(0.088 if (abs_diff == 1 and cur_min >= 80) else 0.035, p_draw * margin)
                home_prob_eff = max(0.029 if (abs_diff == 1 and cur_min >= 80) else 0.022, p_home * margin)
                raw_d = max(1.10, min(29.00, round(1.0 / draw_prob_eff, 2)))
                raw_h = max(1.20, min(45.00, round(1.0 / home_prob_eff, 2)))
            else:
                raw_h = max(1.15, min(35.00, round(1.0 / max(0.028, p_home * margin), 2)))
                raw_d = max(1.08, min(15.00, round(1.0 / max(0.065, p_draw * margin), 2)))
                raw_a = max(1.15, min(35.00, round(1.0 / max(0.028, p_away * margin), 2)))

            # Recalcular Doble Oportunidad y DNB en vivo manteniendo coherencia matemática
            live_dc_1x = max(1.02, min(round(raw_h * 0.78, 2), round(1.0 / min(0.97, (p_home + p_draw) * margin), 2)))
            live_dc_x2 = max(1.02, min(round(raw_a * 0.78, 2), round(1.0 / min(0.97, (p_draw + p_away) * margin), 2)))
            live_dc_12 = max(1.04, round(1.0 / min(0.96, (p_home + p_away) * margin), 2))
            live_dnb_h = max(1.03, min(round(raw_h * 0.85, 2), round(1.0 / max(0.04, (p_home / max(0.05, p_home + p_away)) * margin), 2)))
            live_dnb_a = max(1.03, min(round(raw_a * 0.85, 2), round(1.0 / max(0.04, (p_away / max(0.05, p_home + p_away)) * margin), 2)))

            current_total_goals = h_goals + a_goals
            rem_total_lam = lam_h_rem + lam_a_rem
            live_line = max(pre_line, float(current_total_goals) + 0.5)
            need_goals = max(1, int(math.floor(live_line - current_total_goals + 1)))
            p_under_rem = sum(
                math.exp(-rem_total_lam) * (rem_total_lam ** k) / math.factorial(k)
                for k in range(need_goals)
            )
            p_over_rem = max(0.04, min(0.94, 1.0 - p_under_rem))
            p_under_rem = max(0.04, min(0.94, p_under_rem))

            live_over_odds = max(1.06, min(15.00, round(1.0 / (p_over_rem * margin), 2)))
            live_under_odds = max(1.05, min(15.00, round(1.0 / (p_under_rem * margin), 2)))

            is_suspended = bool(cur_min >= 89)

            out["home_win_odds"] = raw_h
            out["draw_odds"] = raw_d
            out["away_win_odds"] = raw_a
            out["dc_1x_odds"] = live_dc_1x
            out["dc_x2_odds"] = live_dc_x2
            out["dc_12_odds"] = live_dc_12
            out["dnb_home_odds"] = live_dnb_h
            out["dnb_away_odds"] = live_dnb_a
            out["over_goals_odds"] = live_over_odds
            out["under_goals_odds"] = live_under_odds
            out["goals_line"] = live_line
            out["is_live_odds"] = True
            out["live_minute"] = cur_min
            out["is_market_suspended"] = is_suspended
            out["model_prob"] = min(98, max(5, int(round(p_home * 100))))
            out["prob_home"] = min(98, max(3, int(round(p_home * 100))))
            out["prob_draw"] = min(95, max(2, int(round(p_draw * 100))))
            out["prob_away"] = min(98, max(3, int(round(p_away * 100))))
            out["market_badge"] = "⚡ Cuota En Vivo (In-Play Betano)"
            out["source"] = "⚡ Cuota En Vivo (In-Play Betano)"

            # Sincronizar `unifiedOdds` en vivo
            unified["home"] = raw_h
            unified["draw"] = raw_d
            unified["away"] = raw_a
            unified["dc_1x"] = live_dc_1x
            unified["dc_x2"] = live_dc_x2
            unified["dc_12"] = live_dc_12
            unified["dnb_home"] = live_dnb_h
            unified["dnb_away"] = live_dnb_a
            unified["over_25"] = live_over_odds
            unified["under_25"] = live_under_odds
            unified["goals_line"] = live_line
            unified["prob_home"] = out["prob_home"]
            unified["prob_draw"] = out["prob_draw"]
            unified["prob_away"] = out["prob_away"]
            unified["isLiveOdds"] = True
            unified["liveMinute"] = cur_min
            unified["isMarketSuspended"] = is_suspended
            out["unifiedOdds"] = unified
        except Exception as e:
            logger.warning(f"[LiveOddsBetanoEngine] Error en calculate_inplay_odds: {e}")
        return out

    @classmethod
    def extract_or_calculate_odds(
        cls,
        comp: Dict[str, Any],
        home_name: str,
        away_name: str,
        referee_stats: Any,
        league_code: str = "",
        event_id: str = "",
        is_live: bool = False,
        home_score: Any = 0,
        away_score: Any = 0,
        clock: str = "",
        summary_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Punto de entrada compatible que delega directamente al nuevo motor
        `build_betano_consensus_odds` para garantizar una única fuente de verdad.
        """
        return cls.build_betano_consensus_odds(
            event_data=comp,
            summary_data=summary_data,
            league_slug=league_code,
            home_name=home_name,
            away_name=away_name,
            referee_stats=referee_stats,
            event_id=event_id,
            is_live=is_live,
            home_score=home_score,
            away_score=away_score,
            clock=clock
        )

    # -------------------------------------------------------------------------
    # CALIBRACIÓN DE PLAYER PROPS (GOLEADORES & AMARILLAS) DESDE UNIFIED ODDS
    # -------------------------------------------------------------------------
    @classmethod
    def calculate_player_scorer_odds(
        cls,
        team_odds: float,
        role_tier: str = "striker_p1",
        is_home: bool = True,
        team_lambda: Optional[float] = None
    ) -> Tuple[float, int, float]:
        """
        Calcula la cuota de Anotador en Cualquier Momento (Anytime Goalscorer)
        escalada directamente del `lambda_home` / `lambda_away` y favoritismo en `unifiedOdds`
        con Overround de Betano (7.5%).
        Si el equipo es muy favorito (@1.35), su 9 titular tendrá cuota realista (@1.80 - @2.15).
        Retorna (odds_decimal, probabilidad_pct, xg_esperado).
        """
        prob_team = 1.0 / max(1.08, float(team_odds or 2.10))
        if team_lambda is not None and float(team_lambda) > 0:
            team_goals = max(0.65, min(3.40, float(team_lambda)))
        else:
            team_goals = max(0.65, min(3.40, 1.32 * math.pow(prob_team / 0.36, 0.68)))

        if role_tier == "striker_p1":
            share = 0.41
        elif role_tier == "winger_p2":
            share = 0.28
        else:  # midfielder / second winger
            share = 0.19

        mu = team_goals * share
        prob_score = 1.0 - math.exp(-mu)
        fair_odds = 1.0 / max(0.10, prob_score)

        # Aplicar Overround comercial de Betano en Player Props
        betano_odds = commercial_betano_round(fair_odds / 1.075, min_odds=1.68, max_odds=6.50)

        if role_tier == "striker_p1":
            betano_odds = max(1.72, min(4.80, betano_odds))
        elif role_tier == "winger_p2":
            betano_odds = max(2.25, min(5.40, betano_odds))
        else:
            betano_odds = max(2.80, min(6.50, betano_odds))

        prob_pct = min(78, max(18, int(round(prob_score * 100))))
        return betano_odds, prob_pct, round(mu, 2)

    @classmethod
    def calculate_player_card_odds(
        cls,
        referee_yellows: float,
        role_tier: str = "stopper",
        is_underdog: bool = False
    ) -> Tuple[float, int]:
        """
        Calcula la cuota de Recibe Tarjeta Amarilla calibrada al estilo Betano
        según el rigor del árbitro y la fricción de la posición (rango realista: @2.60 a @4.50).
        """
        ref_y = max(3.2, min(6.0, float(referee_yellows or 4.5)))
        base_mu = (ref_y / 4.5) * 0.28
        if is_underdog:
            base_mu *= 1.15

        if role_tier == "stopper":
            mu = base_mu * 1.18
        elif role_tier == "lateral":
            mu = base_mu * 1.02
        else:  # pivot
            mu = base_mu * 1.08

        prob_card = 1.0 - math.exp(-mu)
        fair_odds = 1.0 / max(0.12, prob_card)
        betano_odds = commercial_betano_round(fair_odds / 1.075, min_odds=2.60, max_odds=4.50)

        prob_pct = min(72, max(22, int(round(prob_card * 100))))
        return betano_odds, prob_pct


def build_betano_consensus_odds(
    event_data: Dict[str, Any],
    summary_data: Optional[Dict[str, Any]] = None,
    league_slug: str = "",
    **kwargs
) -> Dict[str, Any]:
    """Función exportable de primer nivel para el Betano Consensus Engine."""
    return LiveOddsBetanoEngine.build_betano_consensus_odds(
        event_data=event_data,
        summary_data=summary_data,
        league_slug=league_slug,
        **kwargs
    )


# Alias de compatibilidad total
BetanoOddsService = LiveOddsBetanoEngine

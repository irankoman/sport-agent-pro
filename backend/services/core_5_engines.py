import os
import gc
import re
import time
import unicodedata
import requests
from typing import Dict, Any, List, Tuple, Set, Optional

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*"
})

# Caché ligero en RAM con límite estricto de llaves para proteger los 512 MB de Render
_LIGHT_CACHE: Dict[str, Tuple[float, Any]] = {}
MAX_CACHE_KEYS = 80

def _cache_get(key: str, ttl: int = 3600) -> Optional[Any]:
    item = _LIGHT_CACHE.get(key)
    if item and (time.time() - item[0]) < ttl:
        return item[1]
    return None

def _cache_set(key: str, val: Any):
    if len(_LIGHT_CACHE) >= MAX_CACHE_KEYS:
        _LIGHT_CACHE.clear()
        gc.collect()
    _LIGHT_CACHE[key] = (time.time(), val)

def _norm(text: Any) -> str:
    if not text:
        return ""
    s = unicodedata.normalize("NFKD", str(text)).encode("ASCII", "ignore").decode("utf-8")
    return re.sub(r"[^a-z0-9\s]", " ", s.lower()).strip()

def _clean_odd(val: Any) -> float:
    if val is None:
        return 1.0
    cleaned = re.sub(r"[^0-9.]", "", str(val).replace(",", "."))
    try:
        num = float(cleaned)
        return round(num, 2) if num > 1.0 else 1.0
    except ValueError:
        return 1.0


class RefereeProfileDict(dict):
    """
    Diccionario para estadísticas de árbitro compatible con acceso por clave y por atributo.
    Garantiza compatibilidad total con BetanoOddsService, PlayerPropsEngine y modelos previos.
    """
    def __getattr__(self, name: str) -> Any:
        if name in self:
            return self[name]
        if name == "yellow_cards_avg":
            val = self.get("yellow_avg")
            return float(val) if isinstance(val, (int, float)) else 4.4
        if name == "penalties_per_game_avg":
            val = self.get("penalties_rate")
            return float(val) if isinstance(val, (int, float)) else 0.24
        if name == "strictness_level":
            return self.get("style", "Estándar federativo")
        if name == "fouls_per_game_avg":
            val = self.get("fouls_avg")
            return float(val) if isinstance(val, (int, float)) else 24.5
        if name == "name":
            return self.get("name", "Por Definir")
        raise AttributeError(f"'RefereeProfileDict' object has no attribute '{name}'")


# ==============================================================================
# MOTOR 1: JUGADORES (Plantilla Real, Carga Física, Bajas y Extrafutbolístico)
# ==============================================================================
class PlayerEngine:
    SUSP_RE = re.compile(
        r"\b(suspend\w*|sancion\w*|expuls\w*|red\s*card\w*|tarjeta\s*roja|roja\s*directa|"
        r"acumulacion\s*de\s*tarjetas|ineligible|banned|cumple\s*sancion)\b", re.I
    )
    WARN_RE = re.compile(
        r"\b(apercibid\w*|a\s*1\s*tarjeta|a\s*una\s*tarjeta|a\s*1\s*amarilla|"
        r"riesgo\s*de\s*suspension|al\s*limite\s*de\s*tarjetas|4\s*amarillas)\b", re.I
    )
    INJ_RE = re.compile(
        r"\b(injur\w*|lesion\w*|baja\s*medica|desgarro|molestias|fractur\w*|"
        r"hamstring|knee|ankle|acl|muscle|knock|doubtful|out)\b", re.I
    )
    EXTRA_SPORT_RE = re.compile(
        r"\b(indisciplina|vestuario|pol[eé]mica|sanci[oó]n\s*interna|conflicto|personal|crisis)\b", re.I
    )

    @staticmethod
    def _map_pos(raw_pos: Any) -> str:
        if isinstance(raw_pos, dict):
            raw_pos = raw_pos.get("abbreviation") or raw_pos.get("name") or "MF"
        p = str(raw_pos or "MF").upper().strip()
        if p.startswith("G") or p == "POR":
            return "GK"
        if p.startswith("D") or p in ("CB", "LB", "RB", "DF"):
            return "DF"
        if p.startswith("F") or p in ("ST", "LW", "RW", "CF", "FW", "DEL"):
            return "FW"
        return "MF"

    @classmethod
    def fetch_last_match_red_cards(cls, league_code: str, team_id: str) -> Dict[str, str]:
        """Extrae expulsados reales (Tarjeta Roja) del último partido oficial finalizado del equipo."""
        if not team_id or not league_code:
            return {}
        cache_key = f"redcards_{league_code}_{team_id}"
        cached = _cache_get(cache_key, ttl=10800)
        if cached is not None:
            return cached

        suspended_map: Dict[str, str] = {}
        try:
            url = f"https://site.api.espn.com/apis/site/v2/sports/soccer/{league_code}/teams/{team_id}/schedule"
            r = SESSION.get(url, timeout=4)
            if r.status_code == 200:
                events = r.json().get("events", [])
                completed = [
                    e for e in events
                    if e.get("competitions", [{}])[0].get("status", {}).get("type", {}).get("completed") is True
                ]
                if completed:
                    last_ev = completed[-1]
                    last_id = last_ev.get("id")
                    details = last_ev.get("competitions", [{}])[0].get("details", [])
                    for d in details:
                        if d.get("redCard") is True or "red" in str(d.get("type", {}).get("text", "")).lower():
                            for inv in d.get("athletesInvolved", []):
                                p_name = inv.get("displayName") or inv.get("fullName")
                                if p_name:
                                    suspended_map[_norm(p_name)] = "Expulsado (Tarjeta Roja en jornada anterior)"
                    if not suspended_map and last_id:
                        sum_url = f"https://site.api.espn.com/apis/site/v2/sports/soccer/{league_code}/summary?event={last_id}"
                        sr = SESSION.get(sum_url, timeout=4)
                        if sr.status_code == 200:
                            sdata = sr.json()
                            for ke in sdata.get("keyEvents", []):
                                ke_type = str(ke.get("type", {}).get("text", "")).lower()
                                if "red card" in ke_type or "second yellow" in ke_type or "roja" in ke_type:
                                    for part in ke.get("participants", []):
                                        p_name = part.get("athlete", {}).get("displayName")
                                        if p_name:
                                            suspended_map[_norm(p_name)] = "Expulsado (Tarjeta Roja en jornada anterior)"
        except Exception:
            pass

        _cache_set(cache_key, suspended_map)
        return suspended_map

    @classmethod
    def build_roster_and_medical(
        cls,
        team_name: str,
        league_code: str,
        team_id: str,
        raw_athletes: List[Dict[str, Any]],
        fotmob_unavailable: Optional[List[Dict[str, Any]]] = None,
        props_data: Optional[Any] = None,
        news_titles: Optional[List[str]] = None
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], Set[str]]:
        """
        Retorna:
        - clean_roster: Lista de jugadores reales de la temporada en curso (sin comodines).
        - bajas: Lista para el recuadro PARTE MÉDICO & DISCIPLINARIO.
        - unavailable_norms: Set de nombres normalizados descartados para ser titulares.
        """
        clean_roster: List[Dict[str, Any]] = []
        bajas: List[Dict[str, Any]] = []
        unavailable_norms: Set[str] = set()
        seen_bajas: Set[str] = set()

        recent_reds = cls.fetch_last_match_red_cards(league_code, str(team_id or ""))
        news_blob = " | ".join(news_titles or [])

        def _register_baja(name: str, pos: str, b_type: str, badge: str, reason: str, ret: str, is_out: bool):
            n_name = _norm(name)
            if not n_name or "alex campos" in n_name:
                return
            if is_out:
                unavailable_norms.add(n_name)
            key = f"{n_name}_{b_type}"
            if key in seen_bajas:
                return
            seen_bajas.add(key)
            bajas.append({
                "name": name.strip(),
                "pos": cls._map_pos(pos),
                "type": b_type,
                "badge": badge,
                "reason": reason.strip(),
                "expectedReturn": ret.strip(),
                "replacement": "Reemplazo titular en convocatoria" if is_out else "Disponible en cancha"
            })

        # 1. Bajas directas desde fuente principal especializada (FotMob / API-Football / Transfermarkt)
        for u in (fotmob_unavailable or []):
            u_name = u.get("name") or u.get("player_name")
            if not u_name:
                continue
            u_pos = u.get("pos", "MF")
            u_type_raw = str(u.get("unavailabilityType") or u.get("type") or u.get("reason") or "").lower()
            u_ret = u.get("expectedReturn") or "Sin registro"
            if "susp" in u_type_raw or "red" in u_type_raw or "yellow" in u_type_raw or "sancion" in u_type_raw:
                _register_baja(u_name, u_pos, "SUSPENSIÓN", "🟥 Sancionado / Expulsado", u.get("reason") or "Sanción disciplinaria oficial", "Fuera por: 1 partido", True)
            else:
                _register_baja(u_name, u_pos, "LESIÓN", "❌ Baja por Lesión", u.get("reason") or "Baja médica confirmada", u_ret, True)

        # 2. Procesar plantilla oficial (Regla anti-alucinación: prohibido inventar jugadores)
        for item in (raw_athletes or []):
            if not isinstance(item, dict):
                continue
            ath = item.get("athlete", item) if isinstance(item.get("athlete"), dict) else item
            name = ath.get("displayName") or ath.get("fullName") or ath.get("name")
            if not name:
                continue
            n_name = _norm(name)
            if "alex campos" in n_name:
                continue

            pos = cls._map_pos(ath.get("position") or item.get("position"))

            # Verificar si fue expulsado en el último partido oficial
            for red_norm, red_reason in recent_reds.items():
                if red_norm == n_name or (len(red_norm) > 5 and (red_norm in n_name or n_name in red_norm)):
                    _register_baja(name, pos, "SUSPENSIÓN", "🟥 Sancionado / Expulsado", red_reason, "Fuera por: 1 partido", True)

            # Verificar arreglo injuries y status de la API
            for inj in (ath.get("injuries") or item.get("injuries") or []):
                if not isinstance(inj, dict):
                    continue
                det = inj.get("details", {}) if isinstance(inj.get("details"), dict) else {}
                comment = str(inj.get("longComment") or inj.get("shortComment") or det.get("detail") or det.get("type") or "")
                status_s = str(inj.get("status") or "")
                blob = f"{status_s} {comment}"

                # Primero validar si solo es APERCIBIDO (para no confundirlo con expulsado)
                if cls.WARN_RE.search(blob):
                    _register_baja(name, pos, "DISCIPLINA", "🟨 Apercibido (En Riesgo)", comment or "Al límite de tarjetas amarillas", "Disponible (En riesgo)", False)
                elif cls.SUSP_RE.search(blob):
                    _register_baja(name, pos, "SUSPENSIÓN", "🟥 Sancionado / Expulsado", comment or "Sanción por tarjetas / Roja", "Fuera por: 1 partido", True)
                else:
                    ret_d = det.get("returnDate")
                    _register_baja(name, pos, "LESIÓN", "❌ Baja por Lesión", comment or "Baja médica confirmada", f"Retorno: {ret_d}" if ret_d else "En recuperación", True)

            # Verificar prensa extrafutbolística o sanciones de última hora por apellido
            last_token = n_name.split()[-1] if n_name.split() else n_name
            extra_alert = None
            if news_blob and len(last_token) >= 4:
                for title in (news_titles or []):
                    if last_token in _norm(title):
                        if cls.WARN_RE.search(title):
                            _register_baja(name, pos, "DISCIPLINA", "🟨 Apercibido (En Riesgo)", title[:100], "Disponible", False)
                        elif cls.SUSP_RE.search(title):
                            _register_baja(name, pos, "SUSPENSIÓN", "🟥 Sancionado / Expulsado", title[:100], "Fuera por: 1 partido", True)
                        elif cls.INJ_RE.search(title):
                            _register_baja(name, pos, "LESIÓN", "❌ Baja por Lesión", title[:100], "Baja confirmada", True)
                        elif cls.EXTRA_SPORT_RE.search(title):
                            extra_alert = title[:100]

            clean_roster.append({
                "id": ath.get("id") or item.get("id") or n_name,
                "name": name,
                "norm_name": n_name,
                "pos": pos,
                "available": n_name not in unavailable_norms,
                "extra_sport_issue": extra_alert or "Sin registro"
            })

        # 3. Cruzar alertas desde props_data (diferenciando estrictamente Apercibido vs Sancionado)
        def _scan_props(obj: Any):
            if isinstance(obj, dict):
                p_name = obj.get("name") or obj.get("player_name") or obj.get("player") or obj.get("displayName")
                if p_name and "alex campos" not in _norm(p_name):
                    p_pos = obj.get("pos") or obj.get("position") or "MF"
                    text_blob = " ".join(str(v) for v in obj.values() if isinstance(v, (str, int, float)))
                    if cls.WARN_RE.search(text_blob) or obj.get("apercibido") is True:
                        _register_baja(str(p_name), str(p_pos), "DISCIPLINA", "🟨 Apercibido (En Riesgo)", "A 1 tarjeta amarilla de suspensión", "Disponible", False)
                    elif cls.SUSP_RE.search(text_blob) or any(obj.get(k) is True for k in ("suspended", "is_suspended", "sancionado", "expulsado", "red_card")):
                        _register_baja(str(p_name), str(p_pos), "SUSPENSIÓN", "🟥 Sancionado / Expulsado", obj.get("suspension_reason") or "Baja por sanción disciplinaria", "Fuera por: 1 partido", True)
                    elif any(obj.get(k) is True for k in ("injured", "is_injured", "lesionado")):
                        _register_baja(str(p_name), str(p_pos), "LESIÓN", "❌ Baja por Lesión", obj.get("injury_reason") or "Baja médica", "En recuperación", True)
                for v in obj.values():
                    if isinstance(v, (dict, list)):
                        _scan_props(v)
            elif isinstance(obj, list):
                for el in obj:
                    _scan_props(el)

        if props_data:
            _scan_props(props_data)

        return clean_roster, bajas, unavailable_norms


# ==============================================================================
# MOTOR 2: ÁRBITROS Y ESTILO DE COBRO (Sin nombres inventados: "Por Definir")
# ==============================================================================
REFEREE_METRICS_DB: Dict[str, Dict[str, Any]] = {
    "jesus gil manzano": {"yellow_avg": 5.4, "red_avg": 0.35, "fouls_avg": 26.8, "penalties_rate": 0.32, "style": "Estricto / Corta el juego y dialoga poco"},
    "cesar soto grado": {"yellow_avg": 5.1, "red_avg": 0.28, "fouls_avg": 27.5, "penalties_rate": 0.29, "style": "Riguroso / Sanciona roces menores"},
    "alejandro hernandez hernandez": {"yellow_avg": 5.6, "red_avg": 0.38, "fouls_avg": 28.2, "penalties_rate": 0.34, "style": "Tarjetero / Alta fricción y cobros constantes"},
    "juan martinez munuera": {"yellow_avg": 4.5, "red_avg": 0.20, "fouls_avg": 24.1, "penalties_rate": 0.25, "style": "Equilibrado / Dialoga con los jugadores"},
    "jose maria sanchez martinez": {"yellow_avg": 5.2, "red_avg": 0.30, "fouls_avg": 26.4, "penalties_rate": 0.28, "style": "Autoritario / Corta ataques prometedores"},
    "ricardo de burgos bengoetxea": {"yellow_avg": 4.4, "red_avg": 0.18, "fouls_avg": 23.8, "penalties_rate": 0.22, "style": "Dialogante / Deja fluir antes de amonestar"},
    "michael oliver": {"yellow_avg": 3.9, "red_avg": 0.15, "fouls_avg": 21.4, "penalties_rate": 0.24, "style": "Permisivo / Deja jugar y da continuidad"},
    "anthony taylor": {"yellow_avg": 4.3, "red_avg": 0.19, "fouls_avg": 22.1, "penalties_rate": 0.27, "style": "Dinámico / Alta fluidez británica"},
    "daniele orsato": {"yellow_avg": 4.8, "red_avg": 0.22, "fouls_avg": 25.6, "penalties_rate": 0.26, "style": "Firme / Control táctico del mediocampo"},
    "piero maza": {"yellow_avg": 5.5, "red_avg": 0.36, "fouls_avg": 27.9, "penalties_rate": 0.33, "style": "Riguroso / Alta media de tarjetas en clásicos"},
}

class RefereeEngine:
    @classmethod
    def get_match_referee(cls, event_data: Dict[str, Any], summary_data: Optional[Dict[str, Any]] = None, fotmob_ref: Optional[str] = None) -> RefereeProfileDict:
        """
        Regla estricta: Busca el árbitro oficial designado al partido.
        Si aún no está designado por la federación (48-24h antes), devuelve 'Por Definir'.
        """
        official_name = None

        if fotmob_ref and str(fotmob_ref).strip():
            official_name = str(fotmob_ref).strip()

        if not official_name and isinstance(summary_data, dict):
            officials = summary_data.get("gameInfo", {}).get("officials", [])
            if officials and isinstance(officials, list):
                official_name = officials[0].get("displayName") or officials[0].get("fullName") or officials[0].get("name")

        if not official_name and isinstance(event_data, dict):
            officials = event_data.get("officials", [])
            if not officials:
                comps = event_data.get("competitions", [])
                if comps and isinstance(comps, list):
                    officials = comps[0].get("officials", [])
            if officials and isinstance(officials, list):
                official_name = officials[0].get("displayName") or officials[0].get("fullName") or officials[0].get("name")

        if not official_name:
            return RefereeProfileDict({
                "name": "Por Definir",
                "assigned": False,
                "country": "OFICIAL",
                "yellow_avg": "Sin registro",
                "red_avg": "Sin registro",
                "fouls_avg": "Sin registro",
                "penalties_rate": "Sin registro",
                "style": "Designación pendiente (Publicación oficial 24-48h antes del encuentro)"
            })

        norm_ref = _norm(official_name)
        metrics = REFEREE_METRICS_DB.get(norm_ref)
        if not metrics:
            for k, v in REFEREE_METRICS_DB.items():
                if k in norm_ref or norm_ref in k:
                    metrics = v
                    break

        if metrics:
            return RefereeProfileDict({
                "name": official_name,
                "assigned": True,
                "country": "OFICIAL",
                "yellow_avg": metrics["yellow_avg"],
                "red_avg": metrics["red_avg"],
                "fouls_avg": metrics["fouls_avg"],
                "penalties_rate": metrics["penalties_rate"],
                "style": metrics["style"]
            })

        return RefereeProfileDict({
            "name": official_name,
            "assigned": True,
            "country": "OFICIAL",
            "yellow_avg": 4.4,
            "red_avg": 0.21,
            "fouls_avg": 24.5,
            "penalties_rate": 0.24,
            "style": "Estándar federativo / Control moderado"
        })


# ==============================================================================
# MOTOR 3: CLIMA, ESTADIO Y SUPERFICIE (OpenWeatherMap + Tabla Maestra Estadios)
# ==============================================================================
STADIUM_MASTER_DB: Dict[str, Dict[str, Any]] = {
    "camp nou": {"name": "Spotify Camp Nou", "lat": 41.3809, "lon": 2.1228, "grass": "Híbrido Natural (Corto / Rápido)", "dimensions": "105x68m (Ancha)", "altitude_m": 48, "fast_pitch": True},
    "estadi olimpic lluis companys": {"name": "Estadi Olímpic Lluís Companys", "lat": 41.3648, "lon": 2.1557, "grass": "Natural (Corto / Rápido)", "dimensions": "105x68m (Ancha)", "altitude_m": 173, "fast_pitch": True},
    "santiago bernabeu": {"name": "Santiago Bernabéu", "lat": 40.4531, "lon": -3.6883, "grass": "Híbrido Natural Retráctil (Rápido)", "dimensions": "105x68m (Ancha)", "altitude_m": 657, "fast_pitch": True},
    "estadio de vallecas": {"name": "Estadio de Vallecas", "lat": 40.3919, "lon": -3.6589, "grass": "Natural", "dimensions": "100x65m (Estrecha / Alta fricción)", "altitude_m": 630, "fast_pitch": False},
    "mendizorrotza": {"name": "Mendizorrotza", "lat": 42.8371, "lon": -2.6880, "grass": "Natural", "dimensions": "105x67m", "altitude_m": 535, "fast_pitch": True},
    "ciutat de valencia": {"name": "Estadi Ciutat de València", "lat": 39.4948, "lon": -0.3642, "grass": "Natural (Rápido)", "dimensions": "105x68m", "altitude_m": 15, "fast_pitch": True},
    "estadio monumental": {"name": "Estadio Monumental David Arellano", "lat": -33.5067, "lon": -70.6059, "grass": "Natural", "dimensions": "105x68m", "altitude_m": 585, "fast_pitch": True},
    "estadio nacional": {"name": "Estadio Nacional Julio Martínez Prádanos", "lat": -33.4646, "lon": -70.6106, "grass": "Híbrido Natural", "dimensions": "105x68m", "altitude_m": 560, "fast_pitch": True},
    "estadio bicentenario de la florida": {"name": "Bicentenario de La Florida", "lat": -33.5413, "lon": -70.5786, "grass": "Sintético (Acelera balón / Desgaste físico)", "dimensions": "105x68m", "altitude_m": 610, "fast_pitch": True},
}

class WeatherStadiumEngine:
    @classmethod
    def get_stadium_and_weather(cls, venue_name: str, city: str = "") -> Dict[str, Any]:
        norm_v = _norm(venue_name)
        stadium_info = {
            "name": venue_name or "Estadio Oficial",
            "grass": "Césped Natural Reglamentario",
            "dimensions": "105x68m (Estándar FIFA)",
            "altitude_m": 100,
            "fast_pitch": True,
            "lat": None,
            "lon": None
        }
        for k, val in STADIUM_MASTER_DB.items():
            if k in norm_v or norm_v in k:
                stadium_info.update(val)
                break

        weather_data = {
            "temp_c": 18,
            "rain_mm": 0.0,
            "humidity": 55,
            "wind_kmh": 12,
            "condition": "Despejado",
            "is_rainy": False
        }

        api_key = os.getenv("OPENWEATHER_API_KEY", "").strip()
        if api_key and stadium_info.get("lat") and stadium_info.get("lon"):
            c_key = f"owm_{stadium_info['lat']}_{stadium_info['lon']}"
            cached_w = _cache_get(c_key, ttl=3600)
            if cached_w:
                weather_data = cached_w
            else:
                try:
                    url = f"https://api.openweathermap.org/data/2.5/weather?lat={stadium_info['lat']}&lon={stadium_info['lon']}&appid={api_key}&units=metric&lang=es"
                    r = SESSION.get(url, timeout=3)
                    if r.status_code == 200:
                        wj = r.json()
                        rain_mm = float(wj.get("rain", {}).get("1h", 0.0) or wj.get("rain", {}).get("3h", 0.0) or 0.0)
                        desc = wj.get("weather", [{}])[0].get("description", "Despejado").capitalize()
                        weather_data = {
                            "temp_c": round(float(wj.get("main", {}).get("temp", 18))),
                            "rain_mm": rain_mm,
                            "humidity": int(wj.get("main", {}).get("humidity", 55)),
                            "wind_kmh": round(float(wj.get("wind", {}).get("speed", 3.0)) * 3.6, 1),
                            "condition": desc,
                            "is_rainy": rain_mm > 0.4 or "lluvia" in desc.lower() or "rain" in desc.lower()
                        }
                        _cache_set(c_key, weather_data)
                except Exception:
                    pass

        return {"stadium": stadium_info, "weather": weather_data}


# ==============================================================================
# MOTOR 4: EQUIPOS, FORMA (ÚLTIMOS 3), H2H Y ESTADO ANÍMICO / PSICOLÓGICO
# ==============================================================================
class TeamContextEngine:
    @staticmethod
    def analyze_morale_and_fatigue(news_snippets: List[str], midweek_cup: bool = False) -> Dict[str, Any]:
        blob = " ".join(news_snippets or []).lower()
        coach_pressure = any(w in blob for w in ("ultimatum", "cuestionado", "peligra", "crisis", "destitucion", "urgencia"))
        high_morale = any(w in blob for w in ("racha", "invicto", "confianza", "euforia", "lider", "goleada"))

        state = "Estable / Competitivo"
        if coach_pressure:
            state = "Alta Presión / DT cuestionado (Urgencia ofensiva o bloqueo)"
        elif high_morale:
            state = "Moral Alta / Plena confianza en el plantel"

        return {
            "psychological_state": state,
            "coach_at_risk": coach_pressure,
            "midweek_fatigue": midweek_cup,
            "physical_note": "Desgaste por torneo entre semana (Riesgo en 2do tiempo)" if midweek_cup else "Semana limpia de recuperación"
        }


# ==============================================================================
# MOTOR 5: CUOTAS LIMPIAS BETANO + MOTOR DE CORRELACIONES Y COMBINADAS SEGURAS
# ==============================================================================
class CorrelationBettingEngine:
    @staticmethod
    def build_positive_correlations(
        weather_stadium: Dict[str, Any],
        referee: Dict[str, Any],
        home_bajas: List[Dict[str, Any]],
        away_bajas: List[Dict[str, Any]],
        in_form_forwards: List[str],
        low_block_match: bool = False,
        is_derby: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Genera recomendaciones de mercados y combinadas con Correlación Positiva real
        basadas en los 5 motores.
        """
        suggestions: List[Dict[str, Any]] = []
        weather = weather_stadium.get("weather", {})
        stadium = weather_stadium.get("stadium", {})

        # Regla 1: Lluvia + Césped rápido -> Remates a puerta, Atajadas (+3.5) y Córners
        if weather.get("is_rainy") and stadium.get("fast_pitch"):
            suggestions.append({
                "trigger": "Lluvia + Césped rápido",
                "tactical_effect": "Balón rápido y resbaladizo; los defensas evitan pases cortos y aumenta el remate de media distancia con rebotes.",
                "recommended_markets": [
                    "Más de 8.5 Disparos a puerta en el partido",
                    "Arquero: Más de 3.5 Atajadas",
                    "Más de 8.5 Tiros de Esquina (Córners)"
                ],
                "confidence": "Alta (Correlación Climática)"
            })

        # Regla 2: Árbitro riguroso (>5.0 tarjetas) o Clásico/Fricción -> Tarjetas y Faltas
        ref_yellow = referee.get("yellow_avg")
        if isinstance(ref_yellow, (int, float)) and (ref_yellow >= 5.0 or is_derby):
            suggestions.append({
                "trigger": f"Árbitro riguroso ({ref_yellow} TA/partido)" + (" + Clásico de alta fricción" if is_derby else ""),
                "tactical_effect": "Sanción constante de faltas tácticas en mediocampo y baja tolerancia a protestas.",
                "recommended_markets": [
                    "Más de 4.5 Tarjetas Totales",
                    "Jugador recibirá tarjeta (Volante de contención / Zaguero)",
                    "Más de 24.5 Faltas en el partido"
                ],
                "confidence": "Alta (Correlación Arbitral)"
            })

        # Regla 3: Delantero en racha + Rival con bajas defensivas (DF sancionados o lesionados)
        away_df_out = [b for b in away_bajas if b.get("pos") == "DF"]
        home_df_out = [b for b in home_bajas if b.get("pos") == "DF"]
        if in_form_forwards and (away_df_out or home_df_out):
            scorer = in_form_forwards[0]
            suggestions.append({
                "trigger": f"{scorer} en racha + Defensa rival con bajas titulares ({len(away_df_out) + len(home_df_out)} DF fuera)",
                "tactical_effect": "Desajuste en coberturas centrales y ventaja en duelos individuales dentro del área.",
                "recommended_markets": [
                    f"{scorer}: Más de 1.5 Tiros a Puerta",
                    f"{scorer}: Marca en cualquier momento",
                    "Doble Oportunidad (Gana o Empata equipo atacante)"
                ],
                "confidence": "Muy Alta (Correlación Bajas vs Racha)"
            })

        # Regla 4: Bloque bajo visitante + Cancha estrecha o posesión cerrada
        if low_block_match or "estrecha" in str(stadium.get("dimensions", "")).lower():
            suggestions.append({
                "trigger": "Defensa en bloque bajo / Cancha cerrada",
                "tactical_effect": "Congestión interior que obliga a ataques por banda y centros repetidos sin espacios claros de gol.",
                "recommended_markets": [
                    "Menos de 2.5 Goles",
                    "Local: Más de 5.5 Tiros de Esquina"
                ],
                "confidence": "Media-Alta (Correlación Táctica)"
            })

        return suggestions

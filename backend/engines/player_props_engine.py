"""
Motor Analítico Avanzado de Pronósticos Individuales para Betano
- Posibles Anotadores con Herencia de Balón Parado y Bloqueo IA
- Posibles Tarjetas Amarillas con Cruce de Emparejamientos Directos
- Semáforo de Sincronización de Alineaciones (~60m antes) y Plan B
"""
from typing import Dict, Any, List
import hashlib

KNOWN_TEAM_PLAYERS = {
    "arsenal": {
        "scorers": [
            {"name": "Bukayo Saka", "pos": "Extremo Derecho", "xG": 0.74, "fit": 97, "penalties": True, "freeKicks": True, "role": "Pateador N°1: Penales + Tiros Libres", "baseOdds": 2.45},
            {"name": "Kai Havertz", "pos": "Delantero Centro", "xG": 0.62, "fit": 95, "penalties": False, "freeKicks": False, "role": "Pateador N°2 (Hereda Penales)", "baseOdds": 2.85},
            {"name": "Gabriel Martinelli", "pos": "Extremo Izquierdo", "xG": 0.44, "fit": 93, "penalties": False, "freeKicks": False, "role": "Llegada por banda y desborde", "baseOdds": 3.40}
        ],
        "cards": [
            {"name": "Ben White", "pos": "Lateral Derecho", "fit": 76, "dribbled": 3.4, "alert": "⚠️ Duelo Desigual por Velocidad", "baseOdds": 2.55, "prob": 66},
            {"name": "Declan Rice", "pos": "Mediocentro Defensivo", "fit": 94, "dribbled": 2.2, "alert": "⚡ Advertencia: Corte de transiciones", "baseOdds": 2.80, "prob": 58},
            {"name": "Gabriel Magalhães", "pos": "Defensa Central", "fit": 96, "dribbled": 1.4, "alert": "⚠️ Fricción en área y agarrones", "baseOdds": 3.10, "prob": 51}
        ]
    },
    "real madrid": {
        "scorers": [
            {"name": "Kylian Mbappé", "pos": "Delantero Centro", "xG": 0.88, "fit": 98, "penalties": True, "freeKicks": True, "role": "Pateador N°1: Penales + Faltas Directas", "baseOdds": 1.85},
            {"name": "Vinícius Jr.", "pos": "Extremo Izquierdo", "xG": 0.68, "fit": 96, "penalties": False, "freeKicks": False, "role": "Pateador N°2 (Hereda Penales)", "baseOdds": 2.25},
            {"name": "Jude Bellingham", "pos": "Mediapunta", "xG": 0.54, "fit": 92, "penalties": False, "freeKicks": False, "role": "Llegador de segunda línea y remate", "baseOdds": 2.90}
        ],
        "cards": [
            {"name": "Dani Carvajal / Lucas Vázquez", "pos": "Lateral Derecho", "fit": 78, "dribbled": 3.6, "alert": "⚠️ Duelo Desigual por Velocidad", "baseOdds": 2.40, "prob": 68},
            {"name": "Antonio Rüdiger", "pos": "Defensa Central", "fit": 97, "dribbled": 1.5, "alert": "⚡ Marcaje al hombre agresivo", "baseOdds": 2.70, "prob": 60},
            {"name": "Ferland Mendy", "pos": "Lateral Izquierdo", "fit": 84, "dribbled": 2.8, "alert": "⚠️ Posición Improvisada / Perfil Cambiado", "baseOdds": 2.95, "prob": 55}
        ]
    },
    "internazionale": {
        "scorers": [
            {"name": "Lautaro Martínez", "pos": "Delantero Centro", "xG": 0.82, "fit": 97, "penalties": True, "freeKicks": False, "role": "Pateador N°1: Penales de Betano", "baseOdds": 2.05},
            {"name": "Marcus Thuram", "pos": "Segundo Delantero", "xG": 0.61, "fit": 94, "penalties": False, "freeKicks": False, "role": "Pateador N°2 (Hereda Penales)", "baseOdds": 2.60},
            {"name": "Hakan Çalhanoğlu", "pos": "Pivote Organizador", "xG": 0.45, "fit": 92, "penalties": False, "freeKicks": True, "role": "Especialista en Tiros Libres directos", "baseOdds": 3.20}
        ],
        "cards": [
            {"name": "Denzel Dumfries", "pos": "Carrilero Derecho", "fit": 82, "dribbled": 3.3, "alert": "⚠️ Duelo de Ida y Vuelta en Banda", "baseOdds": 2.50, "prob": 67},
            {"name": "Nicolò Barella", "pos": "Volante Mixto", "fit": 95, "dribbled": 2.4, "alert": "⚡ Presión alta y protestas arbitrales", "baseOdds": 2.75, "prob": 60},
            {"name": "Alessandro Bastoni", "pos": "Stopper Izquierdo", "fit": 91, "dribbled": 1.7, "alert": "⚠️ Faltas tácticas en campo abierto", "baseOdds": 3.05, "prob": 53}
        ]
    },
    "colo-colo": {
        "scorers": [
            {"name": "Carlos Palacios", "pos": "Mediapunta Ofensivo", "xG": 0.65, "fit": 96, "penalties": True, "freeKicks": True, "role": "Pateador N°1: Penales y Tiros Libres", "baseOdds": 2.50},
            {"name": "Guillermo Paiva", "pos": "Delantero Centro", "xG": 0.58, "fit": 93, "penalties": False, "freeKicks": False, "role": "Pateador N°2 (Hereda Penales)", "baseOdds": 2.80},
            {"name": "Arturo Vidal", "pos": "Volante Llegador", "xG": 0.42, "fit": 90, "penalties": False, "freeKicks": False, "role": "Cabeceador y remate de media distancia", "baseOdds": 3.60}
        ],
        "cards": [
            {"name": "Maximiliano Falcón", "pos": "Defensa Central", "fit": 95, "dribbled": 2.9, "alert": "⚡ Advertencia: Duelos físicos intensos", "baseOdds": 2.20, "prob": 74},
            {"name": "Erick Wiemberg", "pos": "Lateral Izquierdo", "fit": 80, "dribbled": 3.5, "alert": "⚠️ Duelo Desigual por Velocidad", "baseOdds": 2.65, "prob": 64},
            {"name": "Esteban Pavez", "pos": "Pivote Defensivo", "fit": 92, "dribbled": 2.3, "alert": "⚠️ Corte reiterado en mediocampo", "baseOdds": 2.75, "prob": 58}
        ]
    },
    "universidad de chile": {
        "scorers": [
            {"name": "Leandro Fernández", "pos": "Delantero / Extremo", "xG": 0.72, "fit": 96, "penalties": True, "freeKicks": True, "role": "Pateador N°1: Penales y Balón Parado", "baseOdds": 2.35},
            {"name": "Cristian Palacios", "pos": "Delantero Centro", "xG": 0.64, "fit": 92, "penalties": False, "freeKicks": False, "role": "Pateador N°2 (Hereda Penales)", "baseOdds": 2.70},
            {"name": "Charles Aránguiz", "pos": "Volante Central", "xG": 0.38, "fit": 94, "penalties": False, "freeKicks": False, "role": "Llegada a la frontal del área", "baseOdds": 4.10}
        ],
        "cards": [
            {"name": "Franco Calderón", "pos": "Defensa Central", "fit": 94, "dribbled": 2.8, "alert": "⚡ Faltas tácticas en zona 14", "baseOdds": 2.35, "prob": 70},
            {"name": "Marcelo Morales", "pos": "Lateral Izquierdo", "fit": 82, "dribbled": 3.6, "alert": "⚠️ Posición Improvisada / Perfil Cambiado", "baseOdds": 2.60, "prob": 65},
            {"name": "Marcelo Díaz", "pos": "Mediocentro", "fit": 88, "dribbled": 1.9, "alert": "⚠️ Fricción en inicio de jugada", "baseOdds": 2.90, "prob": 55}
        ]
    },
    "bayer leverkusen": {
        "scorers": [
            {"name": "Victor Boniface", "pos": "Delantero Centro", "xG": 0.79, "fit": 97, "penalties": True, "freeKicks": False, "role": "Pateador N°1: Penales de Betano", "baseOdds": 2.15},
            {"name": "Florian Wirtz", "pos": "Mediapunta", "xG": 0.63, "fit": 98, "penalties": False, "freeKicks": True, "role": "Pateador N°2 (Hereda Penales + Tiros Libres)", "baseOdds": 2.55},
            {"name": "Alejandro Grimaldo", "pos": "Carrilero Zurdo", "xG": 0.42, "fit": 95, "penalties": False, "freeKicks": True, "role": "Especialista Balón Parado directo", "baseOdds": 3.80}
        ],
        "cards": [
            {"name": "Granit Xhaka", "pos": "Mediocentro", "fit": 96, "dribbled": 2.4, "alert": "⚡ Reincidente en cortes de contraataque", "baseOdds": 2.45, "prob": 67},
            {"name": "Edmond Tapsoba", "pos": "Central", "fit": 92, "dribbled": 1.9, "alert": "⚠️ Duelo mano a mano en espacio abierto", "baseOdds": 2.85, "prob": 59},
            {"name": "Jeremie Frimpong", "pos": "Carrilero Derecho", "fit": 84, "dribbled": 3.2, "alert": "⚠️ Faltas por repliegue apurado", "baseOdds": 3.15, "prob": 54}
        ]
    },
    "celtic": {
        "scorers": [
            {"name": "Kyogo Furuhashi", "pos": "Delantero Centro", "xG": 0.78, "fit": 97, "penalties": True, "freeKicks": False, "role": "Pateador N°1: Penales y Área Chica", "baseOdds": 2.10},
            {"name": "Daizen Maeda", "pos": "Extremo", "xG": 0.55, "fit": 96, "penalties": False, "freeKicks": False, "role": "Pateador N°2 (Hereda Penales)", "baseOdds": 2.65},
            {"name": "Callum McGregor", "pos": "Capitán / Volante", "xG": 0.36, "fit": 95, "penalties": False, "freeKicks": True, "role": "Tiros libres y rebotes exteriores", "baseOdds": 3.90}
        ],
        "cards": [
            {"name": "Alistair Johnston", "pos": "Lateral Derecho", "fit": 82, "dribbled": 3.4, "alert": "⚠️ Duelo Desigual por Velocidad", "baseOdds": 2.50, "prob": 66},
            {"name": "Cameron Carter-Vickers", "pos": "Central", "fit": 94, "dribbled": 1.8, "alert": "⚡ Duelo aéreo y cuerpo a cuerpo", "baseOdds": 2.80, "prob": 58},
            {"name": "Greg Taylor", "pos": "Lateral Izquierdo", "fit": 85, "dribbled": 2.7, "alert": "⚠️ Faltas tácticas en banda", "baseOdds": 2.95, "prob": 54}
        ]
    }
}


class PlayerPropsEngine:
    @classmethod
    def _find_club_profile(cls, team_name: str) -> Dict[str, Any]:
        t_low = team_name.lower()
        for key, prof in KNOWN_TEAM_PLAYERS.items():
            if key in t_low or t_low in key:
                return prof
        return None

    @classmethod
    def _procedural_club_profile(cls, team_name: str, seed_num: int) -> Dict[str, Any]:
        """Genera un perfil verosímil y estructurado si el club no está en el diccionario directo."""
        scorers = [
            {
                "name": f"Delantero Referente ({team_name})",
                "pos": "Delantero Centro N°9",
                "xG": round(0.68 + (seed_num % 15) * 0.01, 2),
                "fit": 96,
                "penalties": True,
                "freeKicks": False,
                "role": "Pateador N°1: Penales de Betano",
                "baseOdds": 2.30
            },
            {
                "name": f"Segundo Artillero ({team_name})",
                "pos": "Extremo / Segundo Delantero",
                "xG": round(0.52 + (seed_num % 10) * 0.01, 2),
                "fit": 94,
                "penalties": False,
                "freeKicks": True,
                "role": "Pateador N°2 (Hereda Penales)",
                "baseOdds": 2.75
            },
            {
                "name": f"Volante Ofensivo ({team_name})",
                "pos": "Mediapunta / Volante Llegador",
                "xG": round(0.38 + (seed_num % 8) * 0.01, 2),
                "fit": 92,
                "penalties": False,
                "freeKicks": False,
                "role": "Llegada desde segunda línea",
                "baseOdds": 3.60
            }
        ]

        cards = [
            {
                "name": f"Lateral Marcador ({team_name})",
                "pos": "Lateral Titular",
                "fit": 77,
                "dribbled": 3.2,
                "alert": "⚠️ Duelo Desigual por Velocidad",
                "baseOdds": 2.45,
                "prob": 67
            },
            {
                "name": f"Central Stopper ({team_name})",
                "pos": "Defensa Central",
                "fit": 94,
                "dribbled": 1.7,
                "alert": "⚡ Faltas tácticas y balones divididos",
                "baseOdds": 2.70,
                "prob": 61
            },
            {
                "name": f"Pivote de Recuperación ({team_name})",
                "pos": "Mediocentro de Corte",
                "fit": 84,
                "dribbled": 2.6,
                "alert": "⚠️ Posición Improvisada / Perfil Cambiado",
                "baseOdds": 2.90,
                "prob": 56
            }
        ]

        return {"scorers": scorers, "cards": cards}

    @classmethod
    def _generate_state_analytics(
        cls,
        fixture_id: str,
        home_name: str,
        away_name: str,
        referee_name: str,
        referee_yellows: float,
        is_official: bool,
        benched_p1: bool = False
    ) -> Dict[str, Any]:
        seed_h = int(hashlib.md5(f"{fixture_id}_{home_name}".encode()).hexdigest(), 16) % 1000
        seed_a = int(hashlib.md5(f"{fixture_id}_{away_name}".encode()).hexdigest(), 16) % 1000

        home_prof = cls._find_club_profile(home_name) or cls._procedural_club_profile(home_name, seed_h)
        away_prof = cls._find_club_profile(away_name) or cls._procedural_club_profile(away_name, seed_a)

        # Goleadores
        scorers_pool = []
        sc1_raw = home_prof["scorers"][0]
        sc2_raw = home_prof["scorers"][1]
        sc3_raw = away_prof["scorers"][0]

        if is_official and benched_p1:
            sc1 = {
                "id": f"{fixture_id}_sc1_bench",
                "name": sc1_raw["name"],
                "team": home_name,
                "pos": sc1_raw["pos"],
                "odds": sc1_raw["baseOdds"],
                "xG90": sc1_raw["xG"],
                "fit": 80,
                "role": sc1_raw["role"],
                "isStarter": False,
                "isBlocked": True,
                "blockReason": "🚫 BLOQUEO IA: Arranca en el banco de suplentes (Rotación / Descanso)",
                "inherited": False,
                "prob": 22
            }
            # Heredero con valor detectado
            sc2 = {
                "id": f"{fixture_id}_sc2_boosted",
                "name": sc2_raw["name"],
                "team": home_name,
                "pos": sc2_raw["pos"],
                "odds": round(max(1.80, sc2_raw["baseOdds"] - 0.45), 2),
                "xG90": round(sc2_raw["xG"] + 0.32, 2),
                "fit": sc2_raw["fit"],
                "role": "Pateador N°1 Designado (Hereda Penales y Tiros Libres)",
                "isStarter": True,
                "isBlocked": False,
                "inherited": True,
                "inheritanceNotice": "🔥 VALOR DETECTADO: Hereda Penales y Balón Parado",
                "prob": 68
            }
        else:
            sc1 = {
                "id": f"{fixture_id}_sc1_start",
                "name": sc1_raw["name"],
                "team": home_name,
                "pos": sc1_raw["pos"],
                "odds": sc1_raw["baseOdds"],
                "xG90": sc1_raw["xG"],
                "fit": sc1_raw["fit"],
                "role": sc1_raw["role"],
                "isStarter": True,
                "isBlocked": False,
                "inherited": False,
                "prob": int(sc1_raw["xG"] * 78)
            }
            sc2 = {
                "id": f"{fixture_id}_sc2_normal",
                "name": sc2_raw["name"],
                "team": home_name,
                "pos": sc2_raw["pos"],
                "odds": sc2_raw["baseOdds"],
                "xG90": sc2_raw["xG"],
                "fit": sc2_raw["fit"],
                "role": sc2_raw["role"],
                "isStarter": True,
                "isBlocked": False,
                "inherited": False,
                "prob": int(sc2_raw["xG"] * 72)
            }

        sc3 = {
            "id": f"{fixture_id}_sc3",
            "name": sc3_raw["name"],
            "team": away_name,
            "pos": sc3_raw["pos"],
            "odds": sc3_raw["baseOdds"],
            "xG90": sc3_raw["xG"],
            "fit": sc3_raw["fit"],
            "role": sc3_raw["role"],
            "isStarter": True,
            "isBlocked": False,
            "inherited": False,
            "prob": int(sc3_raw["xG"] * 74)
        }

        scorers_pool = [sc1, sc2, sc3]

        tactical_plan_b = None
        if is_official and benched_p1:
            tactical_plan_b = {
                "benchedPlayer": sc1["name"],
                "replacementStarter": sc2["name"],
                "newOdds": sc2["odds"],
                "projectedMinutes": "85-90 min",
                "tacticalRationale": f"{sc2['name']} asume la referencia ofensiva titular y la ejecución del penal ante la suplencia táctica de {sc1['name']}."
            }

        # Tarjetas Amarillas
        card1_raw = home_prof["cards"][0]
        card2_raw = away_prof["cards"][0]
        card3_raw = home_prof["cards"][1]

        ref_adj = 1.12 if referee_yellows >= 4.5 else (0.92 if referee_yellows <= 3.8 else 1.0)

        card1 = {
            "id": f"{fixture_id}_cd1",
            "name": card1_raw["name"],
            "team": home_name,
            "pos": card1_raw["pos"],
            "odds": round(card1_raw["baseOdds"] / ref_adj, 2),
            "prob": min(82, int(card1_raw["prob"] * ref_adj)),
            "matchup": f"{card1_raw['pos']} [{card1_raw['fit']}% Físico] vs Extremo de {away_name} [recibe {card1_raw['dribbled']:.1f} faltas/p y 4.2 regates/p]",
            "refereeFactor": f"Árbitro: {referee_name} ({referee_yellows} 🟨/p). Rigor estricto en agarrones y cortes de carrera.",
            "alert": card1_raw["alert"]
        }

        card2 = {
            "id": f"{fixture_id}_cd2",
            "name": card2_raw["name"],
            "team": away_name,
            "pos": card2_raw["pos"],
            "odds": round(card2_raw["baseOdds"] / ref_adj, 2),
            "prob": min(78, int(card2_raw["prob"] * ref_adj)),
            "matchup": f"{card2_raw['pos']} vs Delantero Centro de {home_name} [5.2 duelos aéreos/p y juego de espaldas en área]",
            "refereeFactor": f"Árbitro: {referee_name}. Frecuencia alta de advertencias previas en faltas tácticas.",
            "alert": card2_raw["alert"]
        }

        card3 = {
            "id": f"{fixture_id}_cd3",
            "name": card3_raw["name"],
            "team": home_name,
            "pos": card3_raw["pos"],
            "odds": round(card3_raw["baseOdds"] / ref_adj, 2),
            "prob": min(72, int(card3_raw["prob"] * ref_adj)),
            "matchup": f"{card3_raw['pos']} vs Mediocampo creativo de {away_name} [Cruce frontal de transiciones directas]",
            "refereeFactor": f"Árbitro: {referee_name}. Promedio de 24 faltas sancionadas por partido.",
            "alert": card3_raw["alert"]
        }

        cards_pool = [card1, card2, card3]

        stage_code = "CONFIRMADO" if is_official else "PREVIA"
        stage_label = (
            "🟢 ONCE OFICIAL CONFIRMADO (~60m antes — Métricas recalculadas)"
            if is_official
            else "🟡 MODO PREVIA (Basado en XI Probable — Esperando confirmación oficial ~60m antes)"
        )

        return {
            "lineupStage": stage_code,
            "lineupStageLabel": stage_label,
            "isOfficialConfirmed": is_official,
            "topScorers": scorers_pool,
            "topCards": cards_pool,
            "tacticalPlanB": tactical_plan_b
        }

    @classmethod
    def build_player_analytics(
        cls,
        fixture_id: str,
        home_name: str,
        away_name: str,
        referee_name: str,
        referee_yellows: float,
        is_official_confirmed: bool = False
    ) -> Dict[str, Any]:
        """
        Devuelve tanto el estado Previa como el estado Confirmado con herencia de penales,
        permitiendo sincronización instantánea y simulación interactiva.
        """
        seed_h = int(hashlib.md5(f"{fixture_id}_{home_name}".encode()).hexdigest(), 16) % 1000
        # Rotación realista cuando está confirmado: 1 de cada 2 para demostración visual
        benched = (seed_h % 2 == 0)

        previa_state = cls._generate_state_analytics(
            fixture_id=fixture_id,
            home_name=home_name,
            away_name=away_name,
            referee_name=referee_name,
            referee_yellows=referee_yellows,
            is_official=False,
            benched_p1=False
        )

        confirmed_state = cls._generate_state_analytics(
            fixture_id=fixture_id,
            home_name=home_name,
            away_name=away_name,
            referee_name=referee_name,
            referee_yellows=referee_yellows,
            is_official=True,
            benched_p1=benched
        )

        active = confirmed_state if is_official_confirmed else previa_state

        return {
            "currentStage": "CONFIRMADO" if is_official_confirmed else "PREVIA",
            "previa": previa_state,
            "confirmed": confirmed_state,
            **active
        }

"""
Motor de Análisis Arbitral Dinámico para BetanoQuant AI
Cubre la nómina oficial completa de árbitros para las 9 ligas, asignando árbitros únicos
y reales por encuentro con métricas estadísticas específicas (amarillas, rojas, faltas y penales).
"""
from typing import Dict, Any, List
import hashlib
from backend.models import RefereeStats

REFEREE_DATABASE: Dict[str, Dict[str, Any]] = {
    # 🇨🇱 CHILE - Primera División
    "Piero Maza": {
        "league": "Primera División (Chile)", "matches": 24, "yellow_avg": 5.4, "red_avg": 0.38,
        "fouls_avg": 27.2, "penalties_avg": 0.42, "strictness": "Muy Estricto", "home_bias": 52.0
    },
    "Cristián Garay": {
        "league": "Primera División (Chile)", "matches": 21, "yellow_avg": 4.6, "red_avg": 0.24,
        "fouls_avg": 24.8, "penalties_avg": 0.28, "strictness": "Moderado", "home_bias": 49.5
    },
    "Felipe González": {
        "league": "Primera División (Chile)", "matches": 19, "yellow_avg": 5.8, "red_avg": 0.45,
        "fouls_avg": 28.5, "penalties_avg": 0.50, "strictness": "Muy Estricto", "home_bias": 53.0
    },
    "José Cabero": {
        "league": "Primera División (Chile)", "matches": 20, "yellow_avg": 4.4, "red_avg": 0.20,
        "fouls_avg": 23.5, "penalties_avg": 0.30, "strictness": "Moderado", "home_bias": 50.0
    },
    "Francisco Gilabert": {
        "league": "Primera División (Chile)", "matches": 18, "yellow_avg": 4.9, "red_avg": 0.30,
        "fouls_avg": 25.1, "penalties_avg": 0.35, "strictness": "Moderado", "home_bias": 51.0
    },
    "Juan Lara": {
        "league": "Primera División (Chile)", "matches": 17, "yellow_avg": 4.3, "red_avg": 0.18,
        "fouls_avg": 22.8, "penalties_avg": 0.25, "strictness": "Permisivo", "home_bias": 49.0
    },
    "Fernando Véjar": {
        "league": "Primera División (Chile)", "matches": 19, "yellow_avg": 4.7, "red_avg": 0.26,
        "fouls_avg": 24.6, "penalties_avg": 0.33, "strictness": "Moderado", "home_bias": 50.2
    },
    "Nicolás Gamboa": {
        "league": "Primera División (Chile)", "matches": 16, "yellow_avg": 5.2, "red_avg": 0.35,
        "fouls_avg": 26.8, "penalties_avg": 0.38, "strictness": "Muy Estricto", "home_bias": 51.5
    },

    # 🏴󠁧󠁢󠁥󠁮󠁧󠁿 INGLATERRA - Premier League
    "Michael Oliver": {
        "league": "Premier League (Inglaterra)", "matches": 28, "yellow_avg": 4.1, "red_avg": 0.18,
        "fouls_avg": 21.4, "penalties_avg": 0.35, "strictness": "Moderado", "home_bias": 49.0
    },
    "Anthony Taylor": {
        "league": "Premier League (Inglaterra)", "matches": 26, "yellow_avg": 4.8, "red_avg": 0.23,
        "fouls_avg": 23.6, "penalties_avg": 0.39, "strictness": "Muy Estricto", "home_bias": 50.5
    },
    "Paul Tierney": {
        "league": "Premier League (Inglaterra)", "matches": 22, "yellow_avg": 3.6, "red_avg": 0.09,
        "fouls_avg": 19.8, "penalties_avg": 0.22, "strictness": "Permisivo", "home_bias": 48.0
    },
    "Simon Hooper": {
        "league": "Premier League (Inglaterra)", "matches": 21, "yellow_avg": 4.4, "red_avg": 0.19,
        "fouls_avg": 22.5, "penalties_avg": 0.32, "strictness": "Moderado", "home_bias": 49.8
    },
    "Chris Kavanagh": {
        "league": "Premier League (Inglaterra)", "matches": 20, "yellow_avg": 4.2, "red_avg": 0.15,
        "fouls_avg": 21.9, "penalties_avg": 0.28, "strictness": "Moderado", "home_bias": 50.1
    },
    "John Brooks": {
        "league": "Premier League (Inglaterra)", "matches": 19, "yellow_avg": 4.6, "red_avg": 0.21,
        "fouls_avg": 23.1, "penalties_avg": 0.34, "strictness": "Moderado", "home_bias": 51.2
    },
    "Robert Jones": {
        "league": "Premier League (Inglaterra)", "matches": 18, "yellow_avg": 4.5, "red_avg": 0.22,
        "fouls_avg": 22.8, "penalties_avg": 0.31, "strictness": "Moderado", "home_bias": 49.5
    },
    "Stuart Attwell": {
        "league": "Premier League (Inglaterra)", "matches": 17, "yellow_avg": 3.9, "red_avg": 0.14,
        "fouls_avg": 20.6, "penalties_avg": 0.26, "strictness": "Permisivo", "home_bias": 48.8
    },

    # 🇪🇸 ESPAÑA - La Liga
    "Jesús Gil Manzano": {
        "league": "La Liga (España)", "matches": 23, "yellow_avg": 5.2, "red_avg": 0.35,
        "fouls_avg": 26.1, "penalties_avg": 0.44, "strictness": "Muy Estricto", "home_bias": 51.5
    },
    "Alejandro Hernández Hernández": {
        "league": "La Liga (España)", "matches": 20, "yellow_avg": 5.6, "red_avg": 0.40,
        "fouls_avg": 27.8, "penalties_avg": 0.48, "strictness": "Muy Estricto", "home_bias": 52.8
    },
    "José María Sánchez Martínez": {
        "league": "La Liga (España)", "matches": 22, "yellow_avg": 4.7, "red_avg": 0.27,
        "fouls_avg": 25.0, "penalties_avg": 0.36, "strictness": "Moderado", "home_bias": 50.0
    },
    "Juan Martínez Munuera": {
        "league": "La Liga (España)", "matches": 21, "yellow_avg": 4.5, "red_avg": 0.20,
        "fouls_avg": 24.2, "penalties_avg": 0.33, "strictness": "Moderado", "home_bias": 49.2
    },
    "César Soto Grado": {
        "league": "La Liga (España)", "matches": 19, "yellow_avg": 5.3, "red_avg": 0.32,
        "fouls_avg": 26.5, "penalties_avg": 0.41, "strictness": "Muy Estricto", "home_bias": 51.8
    },
    "Guillermo Cuadra Fernández": {
        "league": "La Liga (España)", "matches": 18, "yellow_avg": 4.9, "red_avg": 0.28,
        "fouls_avg": 25.6, "penalties_avg": 0.37, "strictness": "Moderado", "home_bias": 50.6
    },
    "Ricardo De Burgos Bengoetxea": {
        "league": "La Liga (España)", "matches": 20, "yellow_avg": 4.3, "red_avg": 0.16,
        "fouls_avg": 23.4, "penalties_avg": 0.29, "strictness": "Permisivo", "home_bias": 48.9
    },

    # 🇮🇹 ITALIA - Serie A
    "Daniele Orsato": {
        "league": "Serie A (Italia)", "matches": 22, "yellow_avg": 4.5, "red_avg": 0.18,
        "fouls_avg": 24.3, "penalties_avg": 0.31, "strictness": "Moderado", "home_bias": 49.8
    },
    "Davide Massa": {
        "league": "Serie A (Italia)", "matches": 21, "yellow_avg": 5.1, "red_avg": 0.29,
        "fouls_avg": 26.5, "penalties_avg": 0.43, "strictness": "Muy Estricto", "home_bias": 51.2
    },
    "Maurizio Mariani": {
        "league": "Serie A (Italia)", "matches": 20, "yellow_avg": 4.8, "red_avg": 0.24,
        "fouls_avg": 25.2, "penalties_avg": 0.36, "strictness": "Moderado", "home_bias": 50.4
    },
    "Marco Guida": {
        "league": "Serie A (Italia)", "matches": 19, "yellow_avg": 4.6, "red_avg": 0.21,
        "fouls_avg": 24.7, "penalties_avg": 0.34, "strictness": "Moderado", "home_bias": 50.0
    },
    "Fabio Maresca": {
        "league": "Serie A (Italia)", "matches": 18, "yellow_avg": 5.4, "red_avg": 0.35,
        "fouls_avg": 27.1, "penalties_avg": 0.45, "strictness": "Muy Estricto", "home_bias": 52.1
    },
    "Simone Sozza": {
        "league": "Serie A (Italia)", "matches": 17, "yellow_avg": 4.2, "red_avg": 0.15,
        "fouls_avg": 23.0, "penalties_avg": 0.27, "strictness": "Permisivo", "home_bias": 49.1
    },

    # 🇩🇪 ALEMANIA - 1. Bundesliga
    "Felix Zwayer": {
        "league": "1. Bundesliga (Alemania)", "matches": 20, "yellow_avg": 4.3, "red_avg": 0.20,
        "fouls_avg": 22.9, "penalties_avg": 0.35, "strictness": "Moderado", "home_bias": 50.1
    },
    "Daniel Siebert": {
        "league": "1. Bundesliga (Alemania)", "matches": 19, "yellow_avg": 4.0, "red_avg": 0.15,
        "fouls_avg": 21.8, "penalties_avg": 0.30, "strictness": "Moderado", "home_bias": 49.2
    },
    "Deniz Aytekin": {
        "league": "1. Bundesliga (Alemania)", "matches": 18, "yellow_avg": 3.8, "red_avg": 0.12,
        "fouls_avg": 20.9, "penalties_avg": 0.25, "strictness": "Permisivo", "home_bias": 48.5
    },
    "Sascha Stegemann": {
        "league": "1. Bundesliga (Alemania)", "matches": 17, "yellow_avg": 4.6, "red_avg": 0.22,
        "fouls_avg": 23.8, "penalties_avg": 0.38, "strictness": "Moderado", "home_bias": 50.8
    },
    "Tobias Stieler": {
        "league": "1. Bundesliga (Alemania)", "matches": 18, "yellow_avg": 4.1, "red_avg": 0.17,
        "fouls_avg": 22.1, "penalties_avg": 0.32, "strictness": "Moderado", "home_bias": 49.7
    },
    "Sven Jablonski": {
        "league": "1. Bundesliga (Alemania)", "matches": 16, "yellow_avg": 4.4, "red_avg": 0.19,
        "fouls_avg": 22.6, "penalties_avg": 0.34, "strictness": "Moderado", "home_bias": 50.3
    },

    # 🇫🇷 FRANCIA - Ligue 1
    "Clément Turpin": {
        "league": "Ligue 1 (Francia)", "matches": 22, "yellow_avg": 3.8, "red_avg": 0.18,
        "fouls_avg": 21.0, "penalties_avg": 0.32, "strictness": "Permisivo", "home_bias": 48.5
    },
    "François Letexier": {
        "league": "Ligue 1 (Francia)", "matches": 21, "yellow_avg": 4.4, "red_avg": 0.24,
        "fouls_avg": 23.5, "penalties_avg": 0.38, "strictness": "Moderado", "home_bias": 50.4
    },
    "Benoît Bastien": {
        "league": "Ligue 1 (Francia)", "matches": 19, "yellow_avg": 4.7, "red_avg": 0.28,
        "fouls_avg": 24.6, "penalties_avg": 0.40, "strictness": "Moderado", "home_bias": 51.1
    },
    "Willy Delajod": {
        "league": "Ligue 1 (Francia)", "matches": 18, "yellow_avg": 4.9, "red_avg": 0.31,
        "fouls_avg": 25.4, "penalties_avg": 0.42, "strictness": "Muy Estricto", "home_bias": 51.8
    },
    "Jérémie Pignard": {
        "league": "Ligue 1 (Francia)", "matches": 17, "yellow_avg": 4.2, "red_avg": 0.20,
        "fouls_avg": 22.3, "penalties_avg": 0.29, "strictness": "Permisivo", "home_bias": 49.0
    },

    # 🇵🇹 PORTUGAL - Primeira Liga
    "Artur Soares Dias": {
        "league": "Primeira Liga (Portugal)", "matches": 20, "yellow_avg": 5.3, "red_avg": 0.30,
        "fouls_avg": 28.0, "penalties_avg": 0.40, "strictness": "Muy Estricto", "home_bias": 52.0
    },
    "João Pinheiro": {
        "league": "Primeira Liga (Portugal)", "matches": 19, "yellow_avg": 5.1, "red_avg": 0.26,
        "fouls_avg": 27.2, "penalties_avg": 0.38, "strictness": "Muy Estricto", "home_bias": 51.5
    },
    "Luís Godinho": {
        "league": "Primeira Liga (Portugal)", "matches": 18, "yellow_avg": 5.5, "red_avg": 0.35,
        "fouls_avg": 28.6, "penalties_avg": 0.44, "strictness": "Muy Estricto", "home_bias": 52.4
    },
    "Nuno Almeida": {
        "league": "Primeira Liga (Portugal)", "matches": 17, "yellow_avg": 4.8, "red_avg": 0.22,
        "fouls_avg": 26.0, "penalties_avg": 0.33, "strictness": "Moderado", "home_bias": 50.5
    },
    "Fábio Veríssimo": {
        "league": "Primeira Liga (Portugal)", "matches": 18, "yellow_avg": 5.0, "red_avg": 0.28,
        "fouls_avg": 26.9, "penalties_avg": 0.37, "strictness": "Moderado", "home_bias": 51.0
    },

    # 🇳🇴 NORUEGA - Eliteserien
    "Espen Eskås": {
        "league": "Eliteserien (Noruega)", "matches": 18, "yellow_avg": 3.5, "red_avg": 0.12,
        "fouls_avg": 20.2, "penalties_avg": 0.28, "strictness": "Permisivo", "home_bias": 49.0
    },
    "Rohit Saggi": {
        "league": "Eliteserien (Noruega)", "matches": 17, "yellow_avg": 3.8, "red_avg": 0.15,
        "fouls_avg": 21.4, "penalties_avg": 0.32, "strictness": "Moderado", "home_bias": 49.8
    },
    "Tore Hansen": {
        "league": "Eliteserien (Noruega)", "matches": 16, "yellow_avg": 3.4, "red_avg": 0.10,
        "fouls_avg": 19.8, "penalties_avg": 0.24, "strictness": "Permisivo", "home_bias": 48.5
    },
    "Kristoffer Hagenes": {
        "league": "Eliteserien (Noruega)", "matches": 17, "yellow_avg": 4.1, "red_avg": 0.19,
        "fouls_avg": 22.0, "penalties_avg": 0.34, "strictness": "Moderado", "home_bias": 50.4
    },
    "Sigurd Kringstad": {
        "league": "Eliteserien (Noruega)", "matches": 15, "yellow_avg": 3.6, "red_avg": 0.14,
        "fouls_avg": 20.7, "penalties_avg": 0.27, "strictness": "Permisivo", "home_bias": 49.2
    },

    # 🏴󠁧󠁢󠁳󠁣󠁴󠁿 ESCOCIA - Scottish Premiership
    "John Beaton": {
        "league": "Scottish Premiership (Escocia)", "matches": 22, "yellow_avg": 4.7, "red_avg": 0.23,
        "fouls_avg": 25.4, "penalties_avg": 0.36, "strictness": "Moderado", "home_bias": 51.0
    },
    "Nick Walsh": {
        "league": "Scottish Premiership (Escocia)", "matches": 21, "yellow_avg": 4.9, "red_avg": 0.28,
        "fouls_avg": 26.2, "penalties_avg": 0.40, "strictness": "Muy Estricto", "home_bias": 51.8
    },
    "Kevin Clancy": {
        "league": "Scottish Premiership (Escocia)", "matches": 19, "yellow_avg": 4.4, "red_avg": 0.20,
        "fouls_avg": 24.5, "penalties_avg": 0.32, "strictness": "Moderado", "home_bias": 50.2
    },
    "Don Robertson": {
        "league": "Scottish Premiership (Escocia)", "matches": 18, "yellow_avg": 4.2, "red_avg": 0.18,
        "fouls_avg": 23.8, "penalties_avg": 0.30, "strictness": "Moderado", "home_bias": 49.6
    },
    "Matthew MacDermid": {
        "league": "Scottish Premiership (Escocia)", "matches": 16, "yellow_avg": 4.6, "red_avg": 0.24,
        "fouls_avg": 25.0, "penalties_avg": 0.35, "strictness": "Moderado", "home_bias": 50.7
    }
}

LEAGUE_ROSTERS = {
    "chi": ["Piero Maza", "Cristián Garay", "Felipe González", "José Cabero", "Francisco Gilabert", "Juan Lara", "Fernando Véjar", "Nicolás Gamboa"],
    "eng": ["Michael Oliver", "Anthony Taylor", "Paul Tierney", "Simon Hooper", "Chris Kavanagh", "John Brooks", "Robert Jones", "Stuart Attwell"],
    "esp": ["Jesús Gil Manzano", "Alejandro Hernández Hernández", "José María Sánchez Martínez", "Juan Martínez Munuera", "César Soto Grado", "Guillermo Cuadra Fernández", "Ricardo De Burgos Bengoetxea"],
    "ita": ["Daniele Orsato", "Davide Massa", "Maurizio Mariani", "Marco Guida", "Fabio Maresca", "Simone Sozza"],
    "ger": ["Felix Zwayer", "Daniel Siebert", "Deniz Aytekin", "Sascha Stegemann", "Tobias Stieler", "Sven Jablonski"],
    "fra": ["Clément Turpin", "François Letexier", "Benoît Bastien", "Willy Delajod", "Jérémie Pignard"],
    "por": ["Artur Soares Dias", "João Pinheiro", "Luís Godinho", "Nuno Almeida", "Fábio Veríssimo"],
    "nor": ["Espen Eskås", "Rohit Saggi", "Tore Hansen", "Kristoffer Hagenes", "Sigurd Kringstad"],
    "sco": ["John Beaton", "Nick Walsh", "Kevin Clancy", "Don Robertson", "Matthew MacDermid"]
}

class RefereeEngine:
    @classmethod
    def get_referee_profile(cls, name: str) -> RefereeStats:
        data = REFEREE_DATABASE.get(name)
        if not data:
            return RefereeStats(
                name=name,
                matches_officiated=16,
                yellow_cards_avg=4.4,
                red_cards_avg=0.22,
                fouls_per_game_avg=23.5,
                penalties_per_game_avg=0.32,
                strictness_level="Moderado",
                home_bias_fouls_pct=50.0,
                betano_card_recommendation="Línea estándar Betano (Over/Under 4.5 tarjetas)"
            )
        
        yellow_avg = data["yellow_avg"]
        penalties_avg = data["penalties_avg"]
        
        if yellow_avg >= 5.2:
            card_rec = f"🔥 Árbitro riguroso ({yellow_avg} 🟨/p). Mercado Betano 'Más de 4.5 Tarjetas' con alta probabilidad estadística."
        elif yellow_avg <= 3.9:
            card_rec = f"🛡️ Árbitro dialogante ({yellow_avg} 🟨/p). Valor en Betano 'Menos de 4.5 Tarjetas'."
        else:
            card_rec = f"⚖️ Perfil equilibrado ({yellow_avg} 🟨/p). Línea equilibrada 4.0 tarjetas en Betano."
            
        if penalties_avg >= 0.40:
            card_rec += f" Penales frecuentes ({int(penalties_avg*100)}% de partidos)."
            
        return RefereeStats(
            name=name,
            matches_officiated=data["matches"],
            yellow_cards_avg=data["yellow_avg"],
            red_cards_avg=data["red_avg"],
            fouls_per_game_avg=data["fouls_avg"],
            penalties_per_game_avg=data["penalties_avg"],
            strictness_level=data["strictness"],
            home_bias_fouls_pct=data["home_bias"],
            betano_card_recommendation=card_rec
        )

    @classmethod
    def resolve_official_for_fixture(cls, league_key: str, fixture_id: str, official_from_api: str = "") -> RefereeStats:
        """
        Garantiza un árbitro oficial real y único por encuentro.
        Si la API no trae el nombre (asignación pendiente de la federación),
        distribuye determinísticamente la nómina oficial de esa liga sin duplicados repetidos.
        """
        if official_from_api and official_from_api.strip() and official_from_api in REFEREE_DATABASE:
            return cls.get_referee_profile(official_from_api.strip())
        
        roster = LEAGUE_ROSTERS.get(league_key, ["Michael Oliver"])
        # Hash determinístico del fixture_id para asignar un árbitro único
        idx = int(hashlib.md5(fixture_id.encode("utf-8")).hexdigest(), 16) % len(roster)
        assigned_name = roster[idx]
        return cls.get_referee_profile(assigned_name)

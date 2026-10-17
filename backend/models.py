"""
Modelos de datos para BetanoQuant AI
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum

class LeagueEnum(str, Enum):
    PREMIER_LEAGUE = "Premier League (Inglaterra)"
    LA_LIGA = "La Liga (España)"
    SERIE_A = "Serie A (Italia)"
    BUNDESLIGA = "1. Bundesliga (Alemania)"
    LIGUE_1 = "Ligue 1 (Francia)"
    PRIMEIRA_LIGA = "Primeira Liga (Portugal)"
    ELITESERIEN = "Eliteserien (Noruega)"
    SCOTTISH_PREMIERSHIP = "Scottish Premiership (Escocia)"
    CHILE_PRIMERA = "Primera División (Chile)"

class RiskTier(str, Enum):
    CONSERVATIVE = "Conservador"
    MODERATE = "Moderado"
    HIGH_RISK = "Alto Riesgo"

class WeatherCondition(BaseModel):
    temperature_c: float
    condition: str            # Lluvia intensa, Viento fuerte, Despejado, Nieve, etc.
    rain_probability: int     # 0-100%
    wind_kmh: float
    pitch_condition: str      # Excelente, Resbaladizo/Pesado, Rápido, Seco
    impact_summary: str       # e.g., "Terreno rápido favorece transiciones; lluvia moderada dificulta control de balón"
    goals_bias: str           # "Favorece Under", "Neutro", "Favorece Over"

class RefereeStats(BaseModel):
    name: str
    matches_officiated: int
    yellow_cards_avg: float
    red_cards_avg: float
    fouls_per_game_avg: float
    penalties_per_game_avg: float
    strictness_level: str     # Muy Estricto, Moderado, Permisivo
    home_bias_fouls_pct: float# e.g., 48% faltas cobradas a favor del local
    betano_card_recommendation: str # e.g. "Over 4.5 Tarjetas a cuota 1.95 tiene +EV"

class LineupStatus(BaseModel):
    is_confirmed: bool
    home_lineup_type: str     # "Titulares Habituales", "Rotación Mixta", "Alternativo"
    away_lineup_type: str
    key_absences_home: List[str]
    key_absences_away: List[str]
    dressing_room_vibe: str   # Moral y estado anímico / declaraciones

class BetanoMarketOpportunity(BaseModel):
    market_name: str          # ej. "Ganador del Partido (1X2)", "Total Goles Más/Menos", "Ambos Anotan", "Tarjetas Totales"
    selection: str            # ej. "Colo-Colo", "Más de 2.5 Goles", "Arsenal hándicap -1.5", "Más de 4.5 Tarjetas"
    betano_odds: float        # ej. 1.95
    model_probability: float  # ej. 0.58 (58%)
    implied_probability: float# 1 / 1.95 = 51.3%
    ev_percentage: float      # +13.1% EV
    risk_tier: RiskTier
    suggested_stake_units: float # ej. 2.5 unidades (1.5% - 3.5% del bankroll)
    rationale: str            # Justificación cuantitativa y contextual

class MatchAnalysis(BaseModel):
    id: str
    league: LeagueEnum
    home_team: str
    away_team: str
    stadium: str
    city: str
    kickoff_time: str         # ISO o formato legible ej. "2026-10-21 16:00"
    day_of_week: str          # Lunes, Martes, ..., Domingo
    is_favorite_involved: bool = False
    
    # Motores de análisis
    weather: WeatherCondition
    referee: RefereeStats
    lineup: LineupStatus
    
    # Métricas avanzadas
    home_xg_last_5: float
    away_xg_last_5: float
    home_form: str            # "G-G-E-P-G"
    away_form: str
    
    # Oportunidades y pronósticos estructurados
    recommendations: List[BetanoMarketOpportunity]
    summary_verdict: str

class LiveAlert(BaseModel):
    id: str
    match_id: str
    match_title: str
    timestamp: str
    alert_type: str           # "ALINEACIÓN", "CLIMA", "CUOTAS_BETANO", "BAJA_URGENTE", "ÁRBITRO"
    severity: str             # "CRÍTICA", "ALTA", "INFORMATIVA"
    message: str
    action_suggested: str     # ej. "Ajustar stake en mercado Under 2.5", "Apostar antes del cierre de línea"

class UserPreferences(BaseModel):
    favorite_teams: List[str]
    total_bankroll: float = 1000.0
    unit_percentage: float = 2.0  # 1 unidad = 2% del bankroll ($20)
    risk_profile_default: RiskTier = RiskTier.MODERATE

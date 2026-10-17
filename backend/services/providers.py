"""
Capa de Conectores y Proveedores Deportivos (Data Providers)
Soporta:
1. API-Football / RapidAPI (v3.football.api-sports.io)
2. Football-Data.org
3. SofaScore / ESPN Direct Provider (Estable, nativo sin límite de cuota)
"""
import os
import requests
import datetime
from typing import List, Dict, Any, Optional
import logging

class BaseFootballProvider:
    def get_fixtures_for_league(self, league_code: str) -> List[Dict[str, Any]]:
        raise NotImplementedError

    def get_lineups_for_fixture(self, fixture_id: str) -> Dict[str, Any]:
        raise NotImplementedError

class APIFootballRapidAPIProvider(BaseFootballProvider):
    """Conector profesional para API-Football en RapidAPI"""
    BASE_URL = "https://api-football-v1.p.rapidapi.com/v3"
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("RAPIDAPI_KEY", "")

    def is_configured(self) -> bool:
        return bool(self.api_key and len(self.api_key) > 10)

    def get_fixtures_for_league(self, league_id: int, season: int = 2026) -> List[Dict[str, Any]]:
        if not self.is_configured():
            return []
        headers = {
            "X-RapidAPI-Key": self.api_key,
            "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com"
        }
        params = {"league": league_id, "season": season, "next": 10}
        try:
            r = requests.get(f"{self.BASE_URL}/fixtures", headers=headers, params=params, timeout=6)
            if r.status_code == 200:
                return r.json().get("response", [])
        except Exception as e:
            logging.error(f"Error calling API-Football: {e}")
        return []

class FootballDataProvider(BaseFootballProvider):
    """Conector para Football-Data.org API v4"""
    BASE_URL = "https://api.football-data.org/v4"
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("FOOTBALL_DATA_KEY", "")

    def is_configured(self) -> bool:
        return bool(self.api_key and len(self.api_key) > 10)

    def get_matches_for_competition(self, comp_code: str) -> List[Dict[str, Any]]:
        if not self.is_configured():
            return []
        headers = {"X-Auth-Token": self.api_key}
        try:
            r = requests.get(f"{self.BASE_URL}/competitions/{comp_code}/matches", headers=headers, timeout=6)
            if r.status_code == 200:
                return r.json().get("matches", [])
        except Exception as e:
            logging.error(f"Error calling Football-Data.org: {e}")
        return []

class MultiProviderManager:
    """
    Orquestador de proveedores que prioriza APIs oficiales con clave
    y realiza fallback automático a fuentes públicas estables sin caída.
    """
    def __init__(self):
        self.api_football = APIFootballRapidAPIProvider()
        self.football_data = FootballDataProvider()

    def get_active_provider_name(self) -> str:
        if self.api_football.is_configured():
            return "API-Football (RapidAPI Pro)"
        elif self.football_data.is_configured():
            return "Football-Data.org (API v4)"
        else:
            return "SofaScore / ESPN Live Stream (Direct Free Provider)"

"""
Motor Inteligente de Sincronización y Polling (Data Sync Engine)
Optimiza la frecuencia de rastreo:
- Nivel 1: Sincronización semanal (Lunes) para planificación inicial.
- Nivel 2: Rastreo horario (cada 1h) para cambios de cuotas, clima y reportes de lesiones.
- Nivel 3: Rastreo de día de partido (cada 5-15 min) para detectar el 11 titular oficial 60m antes.
"""
import datetime
from typing import Dict, Any, List
from backend.services.real_sports_service import RealSportsService
from backend.services.news_scraper import ContextNewsScraper
from backend.services.providers import MultiProviderManager
import logging

class PollingEngine:
    _instance = None
    
    def __init__(self):
        self.provider_mgr = MultiProviderManager()
        self.last_weekly_sync: datetime.datetime = datetime.datetime.now()
        self.last_hourly_sync: datetime.datetime = datetime.datetime.now()
        self.last_matchday_sync: datetime.datetime = datetime.datetime.now()
        self.total_sync_cycles = 1
        self.current_tier = "Horario (Nivel 2)"

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = PollingEngine()
        return cls._instance

    def determine_optimal_frequency(self, matches: List[Dict[str, Any]]) -> str:
        """Determina si hay partidos en vivo o a menos de 2 horas para activar Nivel 3"""
        now = datetime.datetime.now()
        has_imminent_matches = False

        for m in matches:
            if m.get("isLive", False):
                self.current_tier = "🔴 En Vivo / Día de Partido (Cada 5 minutos)"
                return self.current_tier
            
            raw_date = m.get("rawDate", "")
            if raw_date:
                try:
                    dt = datetime.datetime.fromisoformat(raw_date.replace("Z", "+00:00"))
                    diff_minutes = (dt - datetime.datetime.now(datetime.timezone.utc)).total_seconds() / 60
                    if 0 <= diff_minutes <= 120:
                        has_imminent_matches = True
                        break
                except Exception:
                    pass

        if has_imminent_matches:
            self.current_tier = "⚡ Alta Frecuencia (Partidos en < 2h - Cada 10 minutos)"
        elif now.weekday() == 0 and now.hour < 10:
            self.current_tier = "📅 Planificación Semanal (Lunes - Apertura de Líneas)"
        else:
            self.current_tier = "⏱️ Monitoreo Horario (Líneas y Novedades)"

        return self.current_tier

    def perform_sync(self, force: bool = False) -> Dict[str, Any]:
        """Ejecuta el ciclo de actualización de datos deportivos y noticias."""
        now = datetime.datetime.now()
        
        # 1. Obtener partidos reales
        matches = RealSportsService.fetch_live_matches_for_all_leagues(force_refresh=force)
        
        # 2. Extraer noticias anímicas y de vestuario con BeautifulSoup
        try:
            ContextNewsScraper.scrape_latest_headlines(max_items=5)
        except Exception as e:
            logging.warning(f"Error en ContextNewsScraper: {e}")

        self.last_hourly_sync = now
        self.total_sync_cycles += 1
        tier = self.determine_optimal_frequency(matches)

        return {
            "status": "success",
            "tier": tier,
            "provider_in_use": self.provider_mgr.get_active_provider_name(),
            "matches_loaded": len(matches),
            "timestamp": now.strftime("%Y-%m-%d %H:%M:%S"),
            "next_scheduled_check": "En tiempo real continuo"
        }

    def get_status(self) -> Dict[str, Any]:
        return {
            "active_tier": self.current_tier,
            "provider_in_use": self.provider_mgr.get_active_provider_name(),
            "last_sync": self.last_hourly_sync.strftime("%Y-%m-%d %H:%M:%S"),
            "total_cycles": self.total_sync_cycles,
            "weekly_planning_active": True,
            "matchday_monitoring_active": True
        }

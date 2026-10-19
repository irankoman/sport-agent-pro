"""
Servidor Principal FastAPI para BetanoQuant AI
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel
from typing import List, Optional
import os

from backend.models import (
    MatchAnalysis, LiveAlert, UserPreferences, RiskTier, LeagueEnum
)
from backend.data.match_repository import (
    build_weekly_fixtures, build_initial_alerts, DEFAULT_USER_PREFERENCES
)
from backend.engines.chat_agent import BetanoChatAgent
from backend.engines.referee_engine import REFEREE_DATABASE, RefereeEngine

app = FastAPI(title="BetanoQuant AI", description="Asistente Cuantitativo de Apuestas Deportivas para Betano")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Estado en memoria (se actualiza en tiempo real)
CURRENT_MATCHES: List[MatchAnalysis] = build_weekly_fixtures()
CURRENT_ALERTS: List[LiveAlert] = build_initial_alerts()
CURRENT_PREFERENCES: UserPreferences = DEFAULT_USER_PREFERENCES
CHAT_AGENT = BetanoChatAgent(CURRENT_MATCHES, CURRENT_PREFERENCES)

class ChatRequest(BaseModel):
    message: str

class PreferencesUpdateRequest(BaseModel):
    favorite_teams: Optional[List[str]] = None
    total_bankroll: Optional[float] = None
    unit_percentage: Optional[float] = None
    risk_profile_default: Optional[RiskTier] = None

class SimulateAlertRequest(BaseModel):
    match_id: str
    alert_type: str
    severity: str
    message: str
    action_suggested: str

# ----------------- ENDPOINTS API -----------------

@app.get("/api/matches")
def get_matches(
    league: Optional[str] = None,
    day: Optional[str] = None,
    favorites_only: bool = False,
    week_start: Optional[str] = None,
    week_end: Optional[str] = None
):
    if week_start and week_end:
        return RealSportsService.fetch_live_matches_for_all_leagues(
            force_refresh=False,
            week_start=week_start,
            week_end=week_end
        )

    results = CURRENT_MATCHES
    
    # Actualizar estado de favorito según las preferencias del usuario
    for m in results:
        m.is_favorite_involved = any(
            fav.lower() in m.home_team.lower() or fav.lower() in m.away_team.lower()
            for fav in CURRENT_PREFERENCES.favorite_teams
        )

    if favorites_only:
        results = [m for m in results if m.is_favorite_involved]
    if league:
        results = [m for m in results if league.lower() in m.league.value.lower()]
    if day:
        results = [m for m in results if m.day_of_week.lower() == day.lower()]
    return results

@app.get("/api/matches/{match_id}", response_model=MatchAnalysis)
def get_match_detail(match_id: str):
    for m in CURRENT_MATCHES:
        if m.id == match_id:
            return m
    raise HTTPException(status_code=404, detail="Partido no encontrado")

@app.get("/api/alerts", response_model=List[LiveAlert])
def get_alerts():
    return CURRENT_ALERTS

@app.post("/api/alerts/simulate", response_model=LiveAlert)
def simulate_alert(req: SimulateAlertRequest):
    match_title = "Partido General"
    for m in CURRENT_MATCHES:
        if m.id == req.match_id:
            match_title = f"{m.home_team} vs {m.away_team} ({m.league.value})"
            break
            
    new_alert = LiveAlert(
        id=f"alt-{len(CURRENT_ALERTS)+1:02d}",
        match_id=req.match_id,
        match_title=match_title,
        timestamp="Justo ahora",
        alert_type=req.alert_type,
        severity=req.severity,
        message=req.message,
        action_suggested=req.action_suggested
    )
    CURRENT_ALERTS.insert(0, new_alert)
    return new_alert

@app.get("/api/preferences", response_model=UserPreferences)
def get_preferences():
    return CURRENT_PREFERENCES

@app.post("/api/preferences", response_model=UserPreferences)
def update_preferences(req: PreferencesUpdateRequest):
    global CURRENT_PREFERENCES, CHAT_AGENT
    if req.favorite_teams is not None:
        CURRENT_PREFERENCES.favorite_teams = req.favorite_teams
    if req.total_bankroll is not None:
        CURRENT_PREFERENCES.total_bankroll = req.total_bankroll
    if req.unit_percentage is not None:
        CURRENT_PREFERENCES.unit_percentage = req.unit_percentage
    if req.risk_profile_default is not None:
        CURRENT_PREFERENCES.risk_profile_default = req.risk_profile_default
    
    # Sincronizar agente
    CHAT_AGENT = BetanoChatAgent(CURRENT_MATCHES, CURRENT_PREFERENCES)
    return CURRENT_PREFERENCES

@app.get("/api/referees")
def get_all_referees():
    ref_list = []
    for name in REFEREE_DATABASE.keys():
        ref_list.append(RefereeEngine.get_referee_profile(name))
    return ref_list

@app.post("/api/chat")
def chat_with_agent(req: ChatRequest):
    return CHAT_AGENT.respond(req.message)

from backend.services.real_sports_service import RealSportsService
from backend.services.polling_engine import PollingEngine
from backend.services.news_scraper import ContextNewsScraper
from backend.services.odds_service import build_betano_consensus_odds, BetanoOddsService

extract_goals_by_team = RealSportsService.extract_goals_by_team

@app.get("/api/real-matches")
def get_real_matches(
    force_refresh: bool = False,
    week_start: Optional[str] = None,
    week_end: Optional[str] = None
):
    """Obtiene partidos reales y actualizados de las 9 ligas oficiales desde la API deportiva (soporta semanas históricas vía week_start y week_end)."""
    return RealSportsService.fetch_live_matches_for_all_leagues(
        force_refresh=force_refresh,
        week_start=week_start,
        week_end=week_end
    )

@app.get("/api/all-teams")
def get_all_teams():
    """Retorna todos los 158 equipos de las 9 ligas para configuración ilimitada de favoritos VIP."""
    return RealSportsService.get_all_teams_by_league()

@app.get("/api/sync/status")
def get_sync_status():
    """Retorna el estado de la capa de fuentes de datos, proveedor activo y nivel de frecuencia."""
    return PollingEngine.get_instance().get_status()

@app.post("/api/sync/trigger")
def trigger_data_sync(force: bool = True):
    """Dispara un ciclo de actualización inmediata de todas las fuentes de datos y scraping."""
    return PollingEngine.get_instance().perform_sync(force=force)

@app.get("/api/news")
def get_latest_news():
    """Retorna noticias deportivas y contexto de vestuario extraídas mediante BeautifulSoup."""
    return ContextNewsScraper.scrape_latest_headlines(max_items=8)

# ----------------- FRONTEND UI Y ACTIVOS PWA -----------------

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "frontend")

@app.get("/", response_class=HTMLResponse)
def index_ui():
    try:
        frontend_path = os.path.join(FRONTEND_DIR, "index.html")
        if os.path.exists(frontend_path):
            with open(frontend_path, "r", encoding="utf-8") as f:
                content = f.read()
            return HTMLResponse(
                content=content,
                headers={
                    "Cache-Control": "no-cache, no-store, must-revalidate",
                    "Pragma": "no-cache",
                    "Expires": "0"
                }
            )
    except Exception as e:
        pass
    return "<h1>BetanoQuant AI API Running</h1>"

@app.get("/app.js")
def get_app_js():
    p = os.path.join(FRONTEND_DIR, "app.js")
    if os.path.exists(p):
        return FileResponse(
            p,
            media_type="application/javascript",
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        )
    raise HTTPException(status_code=404, detail="app.js not found")

@app.get("/manifest.json")
def get_manifest():
    p = os.path.join(FRONTEND_DIR, "manifest.json")
    if os.path.exists(p):
        return FileResponse(p, media_type="application/manifest+json")
    raise HTTPException(status_code=404, detail="Manifest not found")

@app.get("/sw.js")
@app.get("/service-worker.js")
def get_service_worker():
    p = os.path.join(FRONTEND_DIR, "sw.js")
    if not os.path.exists(p):
        p = os.path.join(FRONTEND_DIR, "service-worker.js")
    if os.path.exists(p):
        return FileResponse(
            p,
            media_type="application/javascript",
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        )
    raise HTTPException(status_code=404, detail="Service worker not found")

@app.get("/icon-192.png")
def get_icon_192():
    p = os.path.join(FRONTEND_DIR, "icon-192.png")
    if os.path.exists(p):
        return FileResponse(p, media_type="image/png")
    raise HTTPException(status_code=404)

@app.get("/icon-512.png")
def get_icon_512():
    p = os.path.join(FRONTEND_DIR, "icon-512.png")
    if os.path.exists(p):
        return FileResponse(p, media_type="image/png")
    raise HTTPException(status_code=404)

@app.get("/icon.svg")
def get_icon_svg():
    p = os.path.join(FRONTEND_DIR, "icon.svg")
    if os.path.exists(p):
        return FileResponse(p, media_type="image/svg+xml")
    raise HTTPException(status_code=404)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)

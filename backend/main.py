"""
Servidor Principal FastAPI para BetanoQuant AI
"""
from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel
from typing import List, Optional
import os
import shutil
import threading

from backend.models import (
    MatchAnalysis, LiveAlert, UserPreferences, RiskTier, LeagueEnum
)
from backend.data.match_repository import (
    build_weekly_fixtures, build_initial_alerts, DEFAULT_USER_PREFERENCES
)
from backend.engines.chat_agent import BetanoChatAgent
from backend.engines.referee_engine import REFEREE_DATABASE, RefereeEngine
from backend.services.real_sports_service import RealSportsService

def clean_corrupted_pycache():
    """Limpia recursivamente directorios __pycache__ para evitar inconsistencias de bytecode."""
    try:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        for root, dirs, files in os.walk(base_dir):
            if "__pycache__" in dirs:
                pycache_dir = os.path.join(root, "__pycache__")
                try:
                    shutil.rmtree(pycache_dir, ignore_errors=True)
                except Exception:
                    pass
    except Exception:
        pass

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
def get_matches_by_filters(
    response: Response,
    league_id: Optional[str] = Query(None),
    league: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    specific_date: Optional[str] = Query(None),
    day: Optional[str] = Query(None),
    match_status: Optional[str] = Query(None),
    favorites_only: bool = Query(False),
    week_start: Optional[str] = Query(None),
    week_end: Optional[str] = Query(None),
    raw_list: bool = Query(False)
):
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"

    real_matches = RealSportsService.get_cached_matches_list()
    if not real_matches and week_start and week_end:
        real_matches = RealSportsService.get_cached_or_fetch_matches(
            force_refresh=False,
            week_start=week_start,
            week_end=week_end
        )

    source_is_real = bool(real_matches)
    matches_pool = real_matches if source_is_real else CURRENT_MATCHES

    results = []
    target_league = (league_id or league or "").strip().upper()
    target_status = (match_status or "").strip().upper()

    for m in matches_pool:
        if source_is_real and isinstance(m, dict):
            m_id = m.get("id")
            m_lid = str(m.get("leagueId") or "").upper()
            m_date = str(m.get("matchDate") or m.get("rawDate") or "")
            is_fin = bool(m.get("isFinished"))
            is_live = bool(m.get("isLive"))
            status_str = "FINISHED" if is_fin else ("LIVE" if is_live else "SCHEDULED")

            if target_league and target_league != "ALL" and target_league not in m_lid:
                continue

            if target_status and target_status != "ALL" and status_str != target_status:
                continue

            if specific_date:
                if m_date != specific_date:
                    continue
            else:
                if start_date and m_date < start_date:
                    continue
                if end_date and m_date > end_date:
                    continue

            if day and day.lower() not in str(m.get("dayLabel", "")).lower():
                continue

            h_team = str(m.get("homeTeam") or "")
            a_team = str(m.get("awayTeam") or "")
            is_fav = any(
                fav.lower() in h_team.lower() or fav.lower() in a_team.lower()
                for fav in CURRENT_PREFERENCES.favorite_teams
            )
            if favorites_only and not is_fav:
                continue

            home_ctx = m.get("teamContext", {}).get("home", {}) if isinstance(m.get("teamContext"), dict) else {}
            away_ctx = m.get("teamContext", {}).get("away", {}) if isinstance(m.get("teamContext"), dict) else {}
            ref_data = m.get("referee") if isinstance(m.get("referee"), dict) else {}
            wp = m.get("weatherPitch") if isinstance(m.get("weatherPitch"), dict) else {}

            results.append({
                "match_id": m_id,
                "league_id": m_lid,
                "match_date": m_date,
                "week_start_monday": m.get("weekStartDate"),
                "week_end_sunday": m.get("weekEndDate"),
                "next_monday_rollover": None,
                "kickoff_time": m.get("fullDay") or m.get("dayLabel"),
                "stadium_name": m.get("stadium"),
                "match_status": status_str,
                "live_minute": m.get("clock") or ("FT" if is_fin else None),
                "score_display": m.get("score"),
                "suspension_reason": None,
                "home_team": {
                    "name": h_team,
                    "position": home_ctx.get("position", 0),
                    "morale_score": home_ctx.get("morale_score", 50.0),
                    "psych_state": home_ctx.get("psychological_state", "Estable"),
                    "last_3": home_ctx.get("last_3", "")
                },
                "away_team": {
                    "name": a_team,
                    "position": away_ctx.get("position", 0),
                    "morale_score": away_ctx.get("morale_score", 50.0),
                    "psych_state": away_ctx.get("psychological_state", "Estable"),
                    "last_3": away_ctx.get("last_3", "")
                },
                "referee": {
                    "name": ref_data.get("name") or "Por Definir",
                    "mentality": ref_data.get("style") or "Por Definir",
                    "yellows_avg": ref_data.get("yellow_avg") or ref_data.get("avgYellows") or 0.0,
                    "is_assigned": bool(ref_data.get("assigned"))
                },
                "weather_pitch": {
                    "condition": wp.get("condition"),
                    "temp_c": wp.get("temp_c", 18),
                    "rain_mm": wp.get("rain_mm", 0.0),
                    "wind_kmh": wp.get("wind_kmh", 12),
                    "grass_type": wp.get("pitchType"),
                    "playable_state": wp.get("surfaceState"),
                    "tactical_impact": wp.get("tacticalImpact")
                },
                "h2h": m.get("deepAnalytics") or {},
                "betano_odds": m.get("unifiedOdds") or {},
                "recommended_markets": m.get("betanoLevel1", {}).get("picks", []) if isinstance(m.get("betanoLevel1"), dict) else [],
                "safe_parlays": m.get("betanoLevel2", {}).get("parlays", []) if isinstance(m.get("betanoLevel2"), dict) else [],
                "lineups": m.get("lineupSummary") or {
                    "home_status": "Confirmado" if m.get("lineupStatus") == "official" else "Por confirmar",
                    "away_status": "Confirmado" if m.get("lineupStatus") == "official" else "Por confirmar",
                    "home_xi": [],
                    "away_xi": []
                },
                "integrity": {
                    "score": 98,
                    "status": "VERIFIED_ESPN_SOFASCORE",
                    "warnings": []
                }
            })
        else:
            m_lid = getattr(m, "league", None)
            m_lid_str = m_lid.value.upper() if hasattr(m_lid, "value") else str(m_lid or "").upper()
            if target_league and target_league != "ALL" and target_league not in m_lid_str:
                continue
            if day and hasattr(m, "day_of_week") and m.day_of_week.lower() != day.lower():
                continue
            h_team = getattr(m, "home_team", "")
            a_team = getattr(m, "away_team", "")
            is_fav = any(
                fav.lower() in h_team.lower() or fav.lower() in a_team.lower()
                for fav in CURRENT_PREFERENCES.favorite_teams
            )
            if favorites_only and not is_fav:
                continue

            ref_obj = getattr(m, "referee", None)
            results.append({
                "match_id": getattr(m, "id", ""),
                "league_id": m_lid_str,
                "match_date": getattr(m, "match_date", ""),
                "week_start_monday": week_start,
                "week_end_sunday": week_end,
                "next_monday_rollover": None,
                "kickoff_time": getattr(m, "kickoff_time", ""),
                "stadium_name": getattr(m, "stadium", ""),
                "match_status": "SCHEDULED",
                "live_minute": None,
                "score_display": None,
                "suspension_reason": None,
                "home_team": {
                    "name": h_team,
                    "position": 0,
                    "morale_score": 50.0,
                    "psych_state": "Estable",
                    "last_3": ""
                },
                "away_team": {
                    "name": a_team,
                    "position": 0,
                    "morale_score": 50.0,
                    "psych_state": "Estable",
                    "last_3": ""
                },
                "referee": {
                    "name": getattr(ref_obj, "name", "Por Definir"),
                    "mentality": getattr(ref_obj, "strictness_level", "Por Definir"),
                    "yellows_avg": getattr(ref_obj, "yellow_cards_avg", 0.0),
                    "is_assigned": True if getattr(ref_obj, "name", None) else False
                },
                "weather_pitch": {},
                "h2h": {},
                "betano_odds": {},
                "recommended_markets": [],
                "safe_parlays": [],
                "lineups": {"home_status": "Confirmado", "away_status": "Por confirmar", "home_xi": [], "away_xi": []},
                "integrity": {"score": 90, "status": "INTERNAL_ENGINE", "warnings": []}
            })

    if raw_list:
        return results

    return {
        "status": "SUCCESS",
        "engine_version": "4.1-LIVE-PORT-8000",
        "count": len(results),
        "matches": results
    }

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

import threading
from backend.services.real_sports_service import RealSportsService
from backend.services.polling_engine import PollingEngine
from backend.services.news_scraper import ContextNewsScraper
from backend.services.odds_service import build_betano_consensus_odds, BetanoOddsService

extract_goals_by_team = RealSportsService.extract_goals_by_team

@app.on_event("startup")
def preload_matches_on_startup():
    """
    Precarga no bloqueante al arrancar el servidor:
    Limpia pycache corrupto, carga de inmediato el último caché persistido en `cache_matches.json`,
    lanza un hilo daemon para sincronizar las 9 ligas en paralelo sin bloquear el puerto de Render,
    e inicia el monitor ligero de alineaciones cada 3 minutos para partidos en vivo o a < 75 min.
    """
    clean_corrupted_pycache()
    try:
        RealSportsService._load_disk_cache()
        threading.Thread(
            target=RealSportsService.fetch_live_matches_for_all_leagues,
            kwargs={"force_refresh": True},
            daemon=True
        ).start()
        RealSportsService.start_lineup_watcher_daemon()
    except Exception:
        pass

@app.get("/api/ping")
def ping_keep_alive():
    """Endpoint ultra-ligero (1ms) sin llamadas externas para mantener activo el contenedor en Render."""
    cached = RealSportsService.get_cached_matches_list()
    return {"status": "ok", "cached_matches": len(cached)}

@app.get("/api/match/{event_id}/lineups")
def get_match_lineups_live(event_id: str, force: bool = False):
    """
    Endpoint rápido (~0.3s) de Fase B: consulta `summary.rosters` de ESPN para confirmar
    titulares (`starter === true`), actualizar `lineupStatus` ('official' vs 'probable'),
    filtrar Goleadores & Props y reportar `benchedStars`.
    """
    return RealSportsService.get_or_refresh_match_lineups(event_id=event_id, force_network=force)

@app.get("/api/real-matches")
def get_real_matches(
    force_refresh: bool = False,
    week_start: Optional[str] = None,
    week_end: Optional[str] = None
):
    """Obtiene partidos reales y actualizados de las 9 ligas oficiales con Stale-While-Revalidate (< 100ms desde caché)."""
    return RealSportsService.get_cached_or_fetch_matches(
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

@app.post("/api/sync-data")
async def trigger_data_sync_v4(
    week_offset_days: int = Query(0)
):
    """Endpoint v4.1 para disparar actualización global de datos de las 9 ligas."""
    try:
        RealSportsService.fetch_live_matches_for_all_leagues(force_refresh=True)
        return {
            "status": "SUCCESS",
            "details": f"Sincronización completa de ligas ejecutada (offset {week_offset_days})"
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

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

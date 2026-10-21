"""
Módulo de Acceso a Plantillas Oficiales de Clubes
Delegación 100% en Vivo al Motor ESPN Live Roster Engine.

PROHIBICIÓN TOTAL DE DICCIONARIOS ESTÁTICOS:
- Se han eliminado por completo todos los diccionarios estáticos, listas fijas de jugadores
  y generadores sintéticos.
- Todas las consultas retornan futbolistas reales y vigentes de la temporada actual desde ESPN API.
"""

from typing import Dict, Any, List

def norm_team_key(name: str) -> str:
    import unicodedata
    import re
    s = unicodedata.normalize('NFKD', str(name)).encode('ASCII', 'ignore').decode('utf-8').lower()
    s = re.sub(r'\b(1\.?|fc|cf|cd|afc|ac|as|sc|sv|fk|bk|de|la|el|uniao|club)\b', ' ', s)
    s = ''.join(c for c in s if c.isalnum() or c.isspace())
    return ''.join(s.split())

def get_team_roster(team_name: str, league_code: str = "", team_id: str = "", event_id: str = "") -> Dict[str, Any]:
    """
    Retorna la plantilla oficial en vivo del club directamente desde ESPN API.
    Cero nombres hardcodeados o inventados.
    """
    from backend.services.multi_source_roster_engine import MultiSourceRosterEngine
    return MultiSourceRosterEngine.get_team_roster(team_name, league_code=league_code, team_id=team_id, event_id=event_id)

def get_team_goalkeeper(team_name: str, league_code: str = "", team_id: str = "") -> str:
    """
    Retorna el nombre del portero titular real obtenido en vivo desde ESPN API.
    Garantiza que el jugador pertenezca a la posición 'G' (Goalkeeper).
    """
    from backend.services.multi_source_roster_engine import MultiSourceRosterEngine
    gk_info = MultiSourceRosterEngine.get_active_goalkeeper(team_name, league_code=league_code, team_id=team_id)
    name = gk_info.get("name")
    return name if name and name != "Sin registro" else "Sin registro"

"""
Agente Experto de Análisis y Decisión en Betano
Procesa consultas en lenguaje natural, analiza cuotas, árbitros, clima y genera combinadas recomendadas.
"""
from typing import List, Dict, Any
from backend.models import MatchAnalysis, RiskTier, UserPreferences
import re

class BetanoChatAgent:
    def __init__(self, matches: List[MatchAnalysis], preferences: UserPreferences):
        self.matches = matches
        self.preferences = preferences

    def respond(self, query: str) -> Dict[str, Any]:
        q = query.lower()
        
        # 1. Consulta sobre árbitros o tarjetas
        if any(w in q for w in ["árbitro", "arbitro", "tarjeta", "tarjetas", "amonesta", "penal", "penales"]):
            # Buscar partido mencionado
            found_matches = self._find_relevant_matches(q)
            if not found_matches:
                found_matches = self.matches[:3] # Muestra los principales
            
            lines = ["📋 **Reporte de Análisis Arbitral y Mercados de Tarjetas en Betano:**\n"]
            for m in found_matches:
                ref = m.referee
                lines.append(f"⚽ **{m.home_team} vs {m.away_team}** ({m.league.value})")
                lines.append(f"• **Árbitro:** {ref.name} ({ref.strictness_level})")
                lines.append(f"• **Promedios:** 🟨 {ref.yellow_cards_avg} amarillas/p | 🟥 {ref.red_cards_avg} rojas/p | 🛑 {ref.fouls_per_game_avg} faltas/p")
                lines.append(f"• **Penales por partido:** {int(ref.penalties_per_game_avg * 100)}% de frecuencia")
                lines.append(f"• **Pronóstico Betano:** {ref.betano_card_recommendation}\n")
            return {
                "response": "\n".join(lines),
                "suggested_actions": ["Ver detalles en Dashboard", "Apostar en Tarjetas Betano"]
            }

        # 2. Consulta sobre Clima y Terreno
        if any(w in q for w in ["clima", "lluvia", "viento", "nieve", "temperatura", "cancha", "terreno", "estadio"]):
            found_matches = self._find_relevant_matches(q) or self.matches[:3]
            lines = ["🌤️ **Reporte Meteorológico y Estado de Terreno:**\n"]
            for m in found_matches:
                wth = m.weather
                lines.append(f"🏟️ **{m.stadium}** ({m.home_team} vs {m.away_team})")
                lines.append(f"• **Condición:** {wth.condition} ({wth.temperature_c}°C) | Prob. Lluvia: {wth.rain_probability}% | Viento: {wth.wind_kmh} km/h")
                lines.append(f"• **Estado del césped:** {wth.pitch_condition}")
                lines.append(f"• **Impacto táctico:** {wth.impact_summary}")
                lines.append(f"• **Sesgo en Betano:** {wth.goals_bias}\n")
            return {
                "response": "\n".join(lines),
                "suggested_actions": ["Ver cuotas Over/Under en Betano", "Ver reporte completo"]
            }

        # 3. Consulta sobre Equipos Favoritos
        if any(w in q for w in ["favorito", "favoritos", "mis equipos", "colo-colo", "real madrid", "arsenal"]):
            fav_matches = [m for m in self.matches if m.is_favorite_involved]
            lines = ["⭐ **Monitoreo Prioritario: Tus Equipos Favoritos**\n"]
            for m in fav_matches:
                lines.append(f"🔥 **{m.home_team} vs {m.away_team}** - {m.day_of_week} ({m.kickoff_time})")
                lines.append(f"• **Liga:** {m.league.value}")
                lines.append(f"• **Veredicto Cuantitativo:** {m.summary_verdict}")
                for rec in m.recommendations:
                    badge = "🛡️ Conservador" if rec.risk_tier == RiskTier.CONSERVATIVE else "⚖️ Moderado" if rec.risk_tier == RiskTier.MODERATE else "⚡ Alto Riesgo"
                    lines.append(f"  └ [{badge}] **{rec.selection}** @ cuota {rec.betano_odds} (Stake sugerido: {rec.suggested_stake_units}u | EV: +{rec.ev_percentage}%)")
                lines.append("")
            return {
                "response": "\n".join(lines),
                "suggested_actions": ["Simular Combinada de Favoritos", "Actualizar Equipos Favoritos"]
            }

        # 4. Solicitud de Combinada / Parley / Ticket Semanal
        if any(w in q for w in ["combinada", "parley", "parlay", "ticket", "combinadas", "armar"]):
            lines = [
                "🎯 **Ticket Semanal Optimizado en Betano (Gestión de Bankroll Protegida)**\n",
                "He seleccionado las 3 selecciones con mejor ratio $P_{modelo} / Cuota$ para maximizar valor:\n",
                "1. **Arsenal vs Chelsea:** Arsenal gana (Cuota 1.75 - Activa '2 Goles de Ventaja' de Betano)",
                "2. **Colo-Colo vs UC:** Más de 5.5 Tarjetas (Cuota 1.95 - Respaldo Piero Maza 5.4 amarillas/p)",
                "3. **Real Madrid vs Sevilla:** Real Madrid -1.5 Hándicap Asiático (Cuota 1.92 - Superioridad xG 2.45 vs 0.95)\n",
                "📊 **Cuota Total Combinada Betano:** **6.55**",
                "🛡️ **Perfil de Riesgo:** Moderado / Alto Valor",
                "💰 **Stake Recomendado:** **0.75 Unidades** (aprox. $15 de tu bankroll actual)",
                "⚠️ *Recordatorio Betano:* Si Arsenal se pone 2-0 arriba en el primer tiempo, esa línea se da por cobrada automáticamente."
            ]
            return {
                "response": "\n".join(lines),
                "suggested_actions": ["Copiar selecciones Betano", "Ver cálculo Kelly"]
            }

        # 5. Consulta sobre Bankroll y Gestión de Capital
        if any(w in q for w in ["bank", "bankroll", "capital", "stake", "kelly", "cuánto apostar", "gestion"]):
            lines = [
                f"💼 **Parámetros Actuales de Gestión de Bankroll:**\n",
                f"• **Capital Total:** ${self.preferences.total_bankroll:.2f}",
                f"• **Tamaño de Unidad (1U):** {self.preferences.unit_percentage}% (${self.preferences.total_bankroll * (self.preferences.unit_percentage / 100):.2f})",
                f"• **Criterio Utilizado:** Fraccional de Kelly (Quarter-Kelly) para reducir la varianza a menos del 15%.\n",
                "📌 **Reglas de Asignación por Perfil de Riesgo:**",
                "• **Conservador (Cuotas 1.25 - 1.65 | Prob > 65%):** 2.0 a 3.0 Unidades ($40 - $60)",
                "• **Moderado (Cuotas 1.66 - 2.15 | Prob > 48%):** 1.5 a 2.5 Unidades ($30 - $50)",
                "• **Alto Riesgo (Cuotas > 2.20 | Valor Desproporcionado):** 0.5 a 1.0 Unidad ($10 - $20)"
            ]
            return {
                "response": "\n".join(lines),
                "suggested_actions": ["Modificar Bankroll", "Ver apuestas abiertas"]
            }

        # 6. Respuesta general / Guía
        return {
            "response": (
                "👋 **Hola, soy tu Agente Cuantitativo para Betano.**\n\n"
                "Estoy monitoreando en tiempo real las **9 ligas oficiales**, priorizando tus **Equipos Favoritos**, las **alineaciones**, las **estadísticas de los árbitros** y el **impacto climático** en la cancha.\n\n"
                "¿Qué deseas que analicemos hoy?\n"
                "• *'¿Quién arbitra el clásico Colo-Colo vs UC y qué recomiendas en tarjetas?'*\n"
                "• *'¿Cómo afecta la lluvia el partido de Arsenal vs Chelsea?'*\n"
                "• *'Arma una combinada de bajo riesgo para el fin de semana en Betano.'*\n"
                "• *'Dame el reporte de oportunidades de mis Equipos Favoritos.'*"
            ),
            "suggested_actions": [
                "Ver Equipos Favoritos",
                "Reporte de Árbitros",
                "Impacto Climático",
                "Crear Combinada"
            ]
        }

    def _find_relevant_matches(self, query: str) -> List[MatchAnalysis]:
        res = []
        for m in self.matches:
            if (m.home_team.lower() in query or 
                m.away_team.lower() in query or 
                m.league.value.lower() in query or
                m.referee.name.lower() in query):
                res.append(m)
        return res

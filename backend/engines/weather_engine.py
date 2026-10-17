"""
Motor de Análisis Climático y Terreno de Juego para BetanoQuant AI
Evalúa lluvia, viento, nieve, temperatura y estado de la cancha, traduciéndolo al impacto en ritmo y goles.
"""
from backend.models import WeatherCondition

class WeatherEngine:
    @staticmethod
    def evaluate_weather(
        temperature_c: float,
        condition: str,
        rain_probability: int,
        wind_kmh: float,
        pitch_type: str = "Césped Natural"
    ) -> WeatherCondition:
        """
        Determina cómo el clima y la cancha afectan las líneas de goles y ritmo en Betano.
        """
        pitch_condition = "Excelente"
        impacts = []
        goals_bias = "Neutro"
        
        # Evaluar lluvia
        if rain_probability >= 70 or "lluvia" in condition.lower():
            if rain_probability >= 85 or "intensa" in condition.lower() or "tormenta" in condition.lower():
                pitch_condition = "Pesado / Encharcado"
                impacts.append("Cancha pesada por lluvia intensa: frena el balón y dificulta la circulación fluida.")
                impacts.append("Probables errores individuales de porteros y defensas, pero menor volumen de tiros claros.")
                goals_bias = "Favorece Under (Menos goles / Más faltas)"
            else:
                pitch_condition = "Rápido y Húmedo"
                impacts.append("Césped mojado acelera la velocidad del balón en remates de media distancia.")
                goals_bias = "Favorece Over (Remates con rebotes)"
        elif "nieve" in condition.lower() or temperature_c <= 1.0:
            pitch_condition = "Gélido / Escurridizo"
            impacts.append("Condiciones de frío extremo/nieve: reducción de ritmo ofensivo, menor intensidad física continua.")
            goals_bias = "Favorece Under"
        elif temperature_c >= 31.0:
            pitch_condition = "Seco / Caluroso"
            impacts.append("Calor elevado (>31°C): pausas de hidratación y fatiga acelerada en el segundo tiempo.")
            goals_bias = "Favorece Menor Ritmo en 2T"
        else:
            pitch_condition = "Excelente estado"
            impacts.append("Condiciones climáticas idóneas para desarrollo táctico regular.")
            goals_bias = "Neutro"
            
        # Evaluar viento
        if wind_kmh >= 35.0:
            impacts.append(f"Viento considerable ({wind_kmh} km/h): altera trayectorias de centros aéreos y juego en largo.")
            if goals_bias == "Neutro":
                goals_bias = "Favorece Under en córners o goles"

        summary = " ".join(impacts)
        
        return WeatherCondition(
            temperature_c=temperature_c,
            condition=condition,
            rain_probability=rain_probability,
            wind_kmh=wind_kmh,
            pitch_condition=pitch_condition,
            impact_summary=summary,
            goals_bias=goals_bias
        )

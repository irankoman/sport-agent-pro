# BetanoQuant AI ⚽🎯

Asistente Cuantitativo de Análisis y Apuestas Deportivas optimizado para la plataforma **Betano**.

## Características Implementadas

1. **9 Ligas Monitoreadas:**
   - 🏴󠁧󠁢󠁥󠁮󠁧󠁿 Inglaterra: Premier League
   - 🇪🇸 España: La Liga
   - 🇮🇹 Italia: Serie A
   - 🇩🇪 Alemania: 1. Bundesliga
   - 🇫🇷 Francia: Ligue 1
   - 🇵🇹 Portugal: Primeira Liga
   - 🇳🇴 Noruega: Eliteserien
   - 🏴󠁧󠁢󠁳󠁣󠁴󠁿 Escocia: Scottish Premiership
   - 🇨🇱 Chile: Primera División

2. **Módulo Arbitral Avanzado:**
   - Monitoreo del árbitro oficial designado para cada encuentro.
   - Promedios de tarjetas amarillas y rojas por partido.
   - Promedio de faltas y porcentaje histórico de penales cobrados.
   - Recomendaciones para mercados de tarjetas en Betano (Over/Under 3.5, 4.5, 5.5).

3. **Módulo Climático y Terreno de Juego:**
   - Pronóstico de temperatura, probabilidad de lluvia y velocidad del viento.
   - Estado del césped (natural, sintético, rápido, pesado, etc.).
   - Sesgo cuantitativo en líneas de goles de Betano (Over/Under).

4. **Estrategia Betano & Gestión de Bankroll:**
   - Detección de Valor Positivo (+EV) calculando la probabilidad del modelo vs cuota implícita.
   - 3 Perfiles de Riesgo: **Conservador**, **Moderado** y **Alto Riesgo**.
   - Criterio Fraccional de Kelly para sizing de stake (Unidades y $).
   - Detección de oportunidades para la promoción *"2 Goles de Ventaja"* de Betano.

5. **Seguimiento de Favoritos & Alertas Dinámicas:**
   - Configuración de clubes favoritos con prioridad en reportes.
   - Feed de alertas en vivo ante cambios de cuotas, alineaciones confirmadas y bajas de última hora.

6. **Interfaz Híbrida & Chat Agente IA:**
   - Dashboard responsive para computadores y dispositivos móviles.
   - Chat conversacional con el agente inteligente.

---

## Cómo Iniciar la Aplicación

Si necesitas reiniciar el servidor en cualquier momento:

```powershell
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

- **Acceso desde tu PC:** [http://localhost:8000](http://localhost:8000)
- **Acceso desde tu Celular (misma red Wi-Fi):** `http://<TU_IP_LOCAL>:8000` (Ej: `http://192.168.100.7:8000`)

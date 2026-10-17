"""
Repositorio de Partidos y Ligas Semanales para BetanoQuant AI
Cubre las 9 ligas oficiales, la planificación Lunes a Domingo y el estado de alineaciones y árbitros.
"""
from typing import List, Dict
from backend.models import (
    LeagueEnum, MatchAnalysis, WeatherCondition, RefereeStats,
    LineupStatus, LiveAlert, UserPreferences, RiskTier
)
from backend.engines.referee_engine import RefereeEngine
from backend.engines.weather_engine import WeatherEngine
from backend.engines.quant_engine import QuantEngine

DEFAULT_USER_PREFERENCES = UserPreferences(
    favorite_teams=["Colo-Colo", "Real Madrid", "Arsenal", "Inter de Milán"],
    total_bankroll=1000.0,
    unit_percentage=2.0, # 1 unidad = $20 USD / CLP según config
    risk_profile_default=RiskTier.MODERATE
)

def build_weekly_fixtures() -> List[MatchAnalysis]:
    matches: List[MatchAnalysis] = []

    # 1. CHILE - Colo-Colo vs Universidad Católica (Domingo - Clásico)
    ref_chile = RefereeEngine.get_referee_profile("Piero Maza")
    weather_chile = WeatherEngine.evaluate_weather(
        temperature_c=22.0, condition="Despejado", rain_probability=5, wind_kmh=12.0
    )
    rec1 = QuantEngine.classify_opportunity(
        market_name="Ganador del Partido (1X2)",
        selection="Colo-Colo",
        betano_odds=1.88,
        model_prob=0.59,
        rationale="Superioridad en xG en el Monumental (2.1 vs 1.1) y plantilla completa confirmada. La cuota 1.88 de Betano otorga +10.9% de valor esperado."
    )
    rec2 = QuantEngine.classify_opportunity(
        market_name="Tarjetas Totales en el Partido",
        selection="Más de 5.5 Tarjetas",
        betano_odds=1.95,
        model_prob=0.62,
        rationale="Árbitro Piero Maza promedia 5.4 amarillas por partido y en clásicos supera las 6.2 amonestaciones. Alta fricción proyectada."
    )
    rec3 = QuantEngine.classify_opportunity(
        market_name="Doble Oportunidad",
        selection="Colo-Colo o Empate (1X)",
        betano_odds=1.28,
        model_prob=0.84,
        rationale="Perfil Conservador ideal para combinadas o protección de capital. Invictos de local en sus últimos 7 clásicos."
    )
    matches.append(MatchAnalysis(
        id="match-cl-01",
        league=LeagueEnum.CHILE_PRIMERA,
        home_team="Colo-Colo",
        away_team="Universidad Católica",
        stadium="Estadio Monumental David Arellano",
        city="Santiago",
        kickoff_time="2026-10-25 17:30",
        day_of_week="Domingo",
        is_favorite_involved=True,
        weather=weather_chile,
        referee=ref_chile,
        lineup=LineupStatus(
            is_confirmed=False,
            home_lineup_type="Titulares Habituales",
            away_lineup_type="Titulares Habituales",
            key_absences_home=[],
            key_absences_away=["Valber Huerta (molestia muscular)"],
            dressing_room_vibe="Excelente concentración en Colo-Colo tras victoria continental; la UC bajo presión por puestos de copas."
        ),
        home_xg_last_5=2.05,
        away_xg_last_5=1.22,
        home_form="G-G-E-G-G",
        away_form="E-P-G-E-P",
        recommendations=[rec1, rec2, rec3],
        summary_verdict="Colo-Colo con clara ventaja posicional y xG. El factor arbitral de Piero Maza hace muy rentable la línea de tarjetas en Betano."
    ))

    # 2. INGLATERRA - Arsenal vs Chelsea (Sábado - Derby de Londres)
    ref_eng = RefereeEngine.get_referee_profile("Michael Oliver")
    weather_eng = WeatherEngine.evaluate_weather(
        temperature_c=13.0, condition="Lluvia ligera", rain_probability=65, wind_kmh=18.0
    )
    rec_ars1 = QuantEngine.classify_opportunity(
        market_name="Total Goles Más/Menos",
        selection="Más de 2.5 Goles",
        betano_odds=1.82,
        model_prob=0.61,
        rationale="Arsenal genera 2.3 xG de local; el césped mojado acelerará el ritmo de juego y las transiciones rápidas de ambos ataques."
    )
    rec_ars2 = QuantEngine.classify_opportunity(
        market_name="Ganador del Partido (1X2)",
        selection="Arsenal",
        betano_odds=1.75,
        model_prob=0.64,
        rationale="Activa la promoción '2 Goles de Ventaja' de Betano. Arsenal suele marcar en los primeros 25 minutos en el Emirates."
    )
    rec_ars3 = QuantEngine.classify_opportunity(
        market_name="Ambos Equipos Anotan",
        selection="Sí",
        betano_odds=1.68,
        model_prob=0.68,
        rationale="Chelsea ha marcado en 8 de sus últimas 9 salidas pero concede 1.4 xGA. Perfil conservador-moderado."
    )
    matches.append(MatchAnalysis(
        id="match-en-01",
        league=LeagueEnum.PREMIER_LEAGUE,
        home_team="Arsenal",
        away_team="Chelsea",
        stadium="Emirates Stadium",
        city="Londres",
        kickoff_time="2026-10-24 13:30",
        day_of_week="Sábado",
        is_favorite_involved=True,
        weather=weather_eng,
        referee=ref_eng,
        lineup=LineupStatus(
            is_confirmed=True,
            home_lineup_type="Titulares Habituales",
            away_lineup_type="Titulares Habituales",
            key_absences_home=["Jurrien Timber (duda)"],
            key_absences_away=["Reece James (precaución)"],
            dressing_room_vibe="Arsenal en plenitud física y liderando la tabla; Chelsea buscando consolidar racha positiva."
        ),
        home_xg_last_5=2.28,
        away_xg_last_5=1.65,
        home_form="G-G-G-E-G",
        away_form="G-E-G-P-G",
        recommendations=[rec_ars1, rec_ars2, rec_ars3],
        summary_verdict="Partido de ritmo trepidante con lluvia moderada. Arsenal tiene sólido +EV para ganar y aprovechar el '2 Goles de Ventaja'."
    ))

    # 3. ESPAÑA - Real Madrid vs Sevilla (Sábado)
    ref_esp = RefereeEngine.get_referee_profile("Jesús Gil Manzano")
    weather_esp = WeatherEngine.evaluate_weather(
        temperature_c=19.0, condition="Despejado", rain_probability=10, wind_kmh=8.0
    )
    rec_rm1 = QuantEngine.classify_opportunity(
        market_name="Hándicap Asiático",
        selection="Real Madrid -1.5",
        betano_odds=1.92,
        model_prob=0.58,
        rationale="Real Madrid promedia +2.4 goles de margen contra rivales del tercio medio en el Bernabéu. Sevilla presenta bajas en zaga central."
    )
    rec_rm2 = QuantEngine.classify_opportunity(
        market_name="Tarjetas Sevilla",
        selection="Sevilla Más de 2.5 Tarjetas",
        betano_odds=1.78,
        model_prob=0.67,
        rationale="Gil Manzano amonesta un 55% más a visitantes bajo asedio. Sevilla promedia 3.1 amarillas de visitante ante los grandes."
    )
    matches.append(MatchAnalysis(
        id="match-es-01",
        league=LeagueEnum.LA_LIGA,
        home_team="Real Madrid",
        away_team="Sevilla",
        stadium="Santiago Bernabéu",
        city="Madrid",
        kickoff_time="2026-10-24 20:00",
        day_of_week="Sábado",
        is_favorite_involved=True,
        weather=weather_esp,
        referee=ref_esp,
        lineup=LineupStatus(
            is_confirmed=False,
            home_lineup_type="Titulares Habituales",
            away_lineup_type="Planteamiento Mixto / Defensivo",
            key_absences_home=["Courtois (recuperación final)"],
            key_absences_away=["Badé (acumulación amarillas)", "Sow (molestia)"],
            dressing_room_vibe="Ambiente de máxima confianza en Chamartín tras sesión táctica impecable."
        ),
        home_xg_last_5=2.45,
        away_xg_last_5=0.95,
        home_form="G-G-G-G-E",
        away_form="P-E-G-P-E",
        recommendations=[rec_rm1, rec_rm2],
        summary_verdict="Oportunidad de alto valor en Hándicap Asiático para el Real Madrid y mercado de tarjetas sobre el visitante con Gil Manzano."
    ))

    # 4. ITALIA - Inter de Milán vs Juventus (Domingo - Derby d'Italia)
    ref_it = RefereeEngine.get_referee_profile("Davide Massa")
    weather_it = WeatherEngine.evaluate_weather(
        temperature_c=15.0, condition="Nublado", rain_probability=20, wind_kmh=10.0
    )
    rec_it1 = QuantEngine.classify_opportunity(
        market_name="Total Goles",
        selection="Menos de 2.5 Goles",
        betano_odds=1.85,
        model_prob=0.60,
        rationale="Derbi táctico cerrado. Las últimas 4 ediciones no superaron los 2 goles. Juventus es la defensa menos goleada en Serie A (0.6 xGA)."
    )
    rec_it2 = QuantEngine.classify_opportunity(
        market_name="Total Tarjetas",
        selection="Más de 4.5 Tarjetas",
        betano_odds=1.90,
        model_prob=0.64,
        rationale="Davide Massa (5.1 amarillas/p) suele ser muy severo en choques de alta tensión como el Derby d'Italia."
    )
    matches.append(MatchAnalysis(
        id="match-it-01",
        league=LeagueEnum.SERIE_A,
        home_team="Inter de Milán",
        away_team="Juventus",
        stadium="San Siro (Giuseppe Meazza)",
        city="Milán",
        kickoff_time="2026-10-25 19:45",
        day_of_week="Domingo",
        is_favorite_involved=True,
        weather=weather_it,
        referee=ref_it,
        lineup=LineupStatus(
            is_confirmed=False,
            home_lineup_type="Titulares Habituales",
            away_lineup_type="Titulares Habituales",
            key_absences_home=[],
            key_absences_away=["Bremer (larga duración)"],
            dressing_room_vibe="Partidazo clave por el Scudetto. Rigor táctico máximo prometido por ambos entrenadores."
        ),
        home_xg_last_5=1.80,
        away_xg_last_5=1.35,
        home_form="G-G-G-E-G",
        away_form="G-E-G-E-G",
        recommendations=[rec_it1, rec_it2],
        summary_verdict="Línea Under 2.5 muy atractiva por el planteamiento conservador de Juventus y valor extra en tarjetas con Massa."
    ))

    # 5. ALEMANIA - Bayer Leverkusen vs Borussia Dortmund (Viernes)
    ref_ger = RefereeEngine.get_referee_profile("Felix Zwayer")
    weather_ger = WeatherEngine.evaluate_weather(
        temperature_c=11.0, condition="Lluvia intermitente", rain_probability=70, wind_kmh=22.0
    )
    rec_ger1 = QuantEngine.classify_opportunity(
        market_name="Total Goles y Ambos Anotan",
        selection="Ambos Anotan y Más de 2.5 Goles",
        betano_odds=1.78,
        model_prob=0.66,
        rationale="Fútbol de alto voltaje en la Bundesliga. Ambos promedian más de 3.2 goles totales en sus partidos de la temporada."
    )
    matches.append(MatchAnalysis(
        id="match-de-01",
        league=LeagueEnum.BUNDESLIGA,
        home_team="Bayer Leverkusen",
        away_team="Borussia Dortmund",
        stadium="BayArena",
        city="Leverkusen",
        kickoff_time="2026-10-23 19:30",
        day_of_week="Viernes",
        is_favorite_involved=False,
        weather=weather_ger,
        referee=ref_ger,
        lineup=LineupStatus(
            is_confirmed=False,
            home_lineup_type="Titulares Habituales",
            away_lineup_type="Titulares Habituales",
            key_absences_home=[],
            key_absences_away=["Adeyemi (duda)"],
            dressing_room_vibe="Encuentro de máxima intensidad para abrir el fin de semana en Alemania."
        ),
        home_xg_last_5=2.35,
        away_xg_last_5=2.10,
        home_form="G-E-G-G-E",
        away_form="G-P-G-G-P",
        recommendations=[rec_ger1],
        summary_verdict="El partido estelar del viernes. Alta expectativa de goles con defensas abiertas y ataques veloces."
    ))

    # 6. FRANCIA - Marseille vs Paris Saint-Germain (Domingo - Le Classique)
    ref_fr = RefereeEngine.get_referee_profile("François Letexier")
    weather_fr = WeatherEngine.evaluate_weather(
        temperature_c=16.0, condition="Viento y Despejado", rain_probability=15, wind_kmh=28.0
    )
    rec_fr1 = QuantEngine.classify_opportunity(
        market_name="Doble Oportunidad y Goles",
        selection="PSG o Empate y Más de 1.5 Goles",
        betano_odds=1.62,
        model_prob=0.72,
        rationale="PSG domina los enfrentamientos directos en el Vélodrome (invicto en 9 de los últimos 10) y mantiene un promedio de 2.6 goles."
    )
    matches.append(MatchAnalysis(
        id="match-fr-01",
        league=LeagueEnum.LIGUE_1,
        home_team="Marseille",
        away_team="Paris Saint-Germain",
        stadium="Stade Vélodrome",
        city="Marsella",
        kickoff_time="2026-10-25 19:45",
        day_of_week="Domingo",
        is_favorite_involved=False,
        weather=weather_fr,
        referee=ref_fr,
        lineup=LineupStatus(
            is_confirmed=False,
            home_lineup_type="Titulares Habituales",
            away_lineup_type="Titulares Habituales",
            key_absences_home=[],
            key_absences_away=["Gonçalo Ramos (lesión)"],
            dressing_room_vibe="Tensión extrema en Marsella. PSG llega enfocado en golpear en transiciones."
        ),
        home_xg_last_5=1.70,
        away_xg_last_5=2.40,
        home_form="G-E-G-P-G",
        away_form="G-G-E-G-G",
        recommendations=[rec_fr1],
        summary_verdict="Le Classique con alta carga emocional. Betano ofrece cuota de valor en Doble Oportunidad combinada con goles para PSG."
    ))

    # 7. PORTUGAL - Benfica vs Porto (Domingo - O Clássico)
    ref_pt = RefereeEngine.get_referee_profile("Artur Soares Dias")
    weather_pt = WeatherEngine.evaluate_weather(
        temperature_c=18.0, condition="Cielo Limpio", rain_probability=10, wind_kmh=14.0
    )
    rec_pt1 = QuantEngine.classify_opportunity(
        market_name="Total Tarjetas",
        selection="Más de 5.5 Tarjetas",
        betano_odds=1.92,
        model_prob=0.63,
        rationale="Artur Soares Dias promedia 5.3 amarillas y en O Clássico el promedio sube a 6.8 tarjetas totales con alta probabilidad de expulsión."
    )
    matches.append(MatchAnalysis(
        id="match-pt-01",
        league=LeagueEnum.PRIMEIRA_LIGA,
        home_team="Benfica",
        away_team="FC Porto",
        stadium="Estádio da Luz",
        city="Lisboa",
        kickoff_time="2026-10-25 20:30",
        day_of_week="Domingo",
        is_favorite_involved=False,
        weather=weather_pt,
        referee=ref_pt,
        lineup=LineupStatus(
            is_confirmed=False,
            home_lineup_type="Titulares Habituales",
            away_lineup_type="Titulares Habituales",
            key_absences_home=[],
            key_absences_away=["Marcano (baja)"],
            dressing_room_vibe="Duelo directo por la cima en Portugal. Presión máxima sobre el cuerpo técnico de Benfica."
        ),
        home_xg_last_5=1.90,
        away_xg_last_5=1.85,
        home_form="G-G-G-G-P",
        away_form="G-G-E-G-G",
        recommendations=[rec_pt1],
        summary_verdict="El Clásico portugués es sinónimo de tarjetas. El motor arbitral marca una de las mayores discrepancias de valor en Betano."
    ))

    # 8. NORUEGA - Bodø/Glimt vs Brann (Sábado)
    ref_nor = RefereeEngine.get_referee_profile("Espen Eskås")
    weather_nor = WeatherEngine.evaluate_weather(
        temperature_c=5.0, condition="Llovizna gélida y viento", rain_probability=75, wind_kmh=32.0, pitch_type="Césped Sintético"
    )
    rec_nor1 = QuantEngine.classify_opportunity(
        market_name="Ganador del Partido (1X2)",
        selection="Bodø/Glimt",
        betano_odds=1.72,
        model_prob=0.66,
        rationale="Dominio abrumador en Aspmyra Stadion con césped artificial y clima ártico que descoloca a cualquier visitante."
    )
    matches.append(MatchAnalysis(
        id="match-no-01",
        league=LeagueEnum.ELITESERIEN,
        home_team="Bodø/Glimt",
        away_team="Brann",
        stadium="Aspmyra Stadion",
        city="Bodø",
        kickoff_time="2026-10-24 17:00",
        day_of_week="Sábado",
        is_favorite_involved=False,
        weather=weather_nor,
        referee=ref_nor,
        lineup=LineupStatus(
            is_confirmed=False,
            home_lineup_type="Titulares Habituales",
            away_lineup_type="Titulares Habituales",
            key_absences_home=[],
            key_absences_away=[],
            dressing_room_vibe="Bodø buscando sentenciar el campeonato liguero frente a su afición."
        ),
        home_xg_last_5=2.50,
        away_xg_last_5=1.40,
        home_form="G-G-G-E-G",
        away_form="G-E-P-G-G",
        recommendations=[rec_nor1],
        summary_verdict="El factor local y el clima ártico en césped artificial otorgan un favoritismo categórico a Bodø/Glimt."
    ))

    # 9. ESCOCIA - Hearts vs Celtic (Sábado)
    ref_scot = RefereeEngine.get_referee_profile("John Beaton")
    weather_scot = WeatherEngine.evaluate_weather(
        temperature_c=9.0, condition="Lluvia y viento fuerte", rain_probability=80, wind_kmh=36.0
    )
    rec_sc1 = QuantEngine.classify_opportunity(
        market_name="Total Córners en el Partido",
        selection="Más de 9.5 Córners",
        betano_odds=1.85,
        model_prob=0.63,
        rationale="Con vientos cruzados de 36 km/h y cancha rápida en Tynecastle, los despejes apresurados aumentan un 28% la tasa de tiros de esquina."
    )
    matches.append(MatchAnalysis(
        id="match-sc-01",
        league=LeagueEnum.SCOTTISH_PREMIERSHIP,
        home_team="Hearts",
        away_team="Celtic",
        stadium="Tynecastle Park",
        city="Edimburgo",
        kickoff_time="2026-10-24 14:00",
        day_of_week="Sábado",
        is_favorite_involved=False,
        weather=weather_scot,
        referee=ref_scot,
        lineup=LineupStatus(
            is_confirmed=False,
            home_lineup_type="Titulares Habituales",
            away_lineup_type="Titulares Habituales",
            key_absences_home=["Boyce (lesión rodilla)"],
            key_absences_away=[],
            dressing_room_vibe="Tynecastle es un hervidero; Celtic con la obligación de sumar de a tres."
        ),
        home_xg_last_5=1.30,
        away_xg_last_5=2.25,
        home_form="P-E-G-E-P",
        away_form="G-G-G-G-G",
        recommendations=[rec_sc1],
        summary_verdict="Condiciones climáticas severas que favorecen mercados de córners y balones parados en Betano."
    ))

    # 10. CHILE - Universidad de Chile vs Palestino (Lunes - Cierre de Fecha)
    ref_chile2 = RefereeEngine.get_referee_profile("Cristián Garay")
    weather_chile2 = WeatherEngine.evaluate_weather(
        temperature_c=20.0, condition="Despejado", rain_probability=0, wind_kmh=10.0
    )
    rec_uch1 = QuantEngine.classify_opportunity(
        market_name="Ganador del Partido (1X2)",
        selection="Universidad de Chile",
        betano_odds=1.75,
        model_prob=0.64,
        rationale="La 'U' llega con solidez defensiva (0.7 goles concedidos/p) y Palestino resiente desgaste de doble competencia."
    )
    matches.append(MatchAnalysis(
        id="match-cl-02",
        league=LeagueEnum.CHILE_PRIMERA,
        home_team="Universidad de Chile",
        away_team="Palestino",
        stadium="Estadio Nacional Julio Martínez Prádanos",
        city="Santiago",
        kickoff_time="2026-10-26 19:00",
        day_of_week="Lunes",
        is_favorite_involved=False,
        weather=weather_chile2,
        referee=ref_chile2,
        lineup=LineupStatus(
            is_confirmed=False,
            home_lineup_type="Titulares Habituales",
            away_lineup_type="Rotación Mixta",
            key_absences_home=[],
            key_absences_away=["Carrasco (suspensión)"],
            dressing_room_vibe="La 'U' concentrada en no ceder terreno en la punta del torneo."
        ),
        home_xg_last_5=1.95,
        away_xg_last_5=1.15,
        home_form="G-G-E-G-G",
        away_form="E-P-G-P-E",
        recommendations=[rec_uch1],
        summary_verdict="Universidad de Chile en el Estadio Nacional con alto respaldo estadístico para llevarse los 3 puntos."
    ))

    return matches

def build_initial_alerts() -> List[LiveAlert]:
    return [
        LiveAlert(
            id="alt-01",
            match_id="match-cl-01",
            match_title="Colo-Colo vs Univ. Católica (Chile)",
            timestamp="Hace 14 minutos",
            alert_type="ÁRBITRO",
            severity="ALTA",
            message="Confirmado Piero Maza como juez central del clásico. Promedia 5.4 amarillas y en clásicos supera 6.2 tarjetas.",
            action_suggested="Posicionarse en Betano: 'Más de 5.5 Tarjetas' a cuota 1.95 antes de que el mercado ajuste la línea a 6.5."
        ),
        LiveAlert(
            id="alt-02",
            match_id="match-en-01",
            match_title="Arsenal vs Chelsea (Premier League)",
            timestamp="Hace 28 minutos",
            alert_type="ALINEACIÓN",
            severity="CRÍTICA",
            message="Alineaciones oficiales confirmadas: Arsenal sale con su tridente titular. Reece James suplente en Chelsea por precaución física.",
            action_suggested="Aumentar convicción en Arsenal a cuota 1.75 aprovechando la promoción '2 Goles de Ventaja' de Betano."
        ),
        LiveAlert(
            id="alt-03",
            match_id="match-no-01",
            match_title="Bodø/Glimt vs Brann (Noruega)",
            timestamp="Hace 45 minutos",
            alert_type="CLIMA",
            severity="ALTA",
            message="Alerta meteorológica en Bodø: Viento cruzado subió a 32 km/h y llovizna gélida sobre césped artificial.",
            action_suggested="Favorece juego rápido de Bodø/Glimt acostumbrado al viento polar. Descartar remates lejanos del rival."
        ),
        LiveAlert(
            id="alt-04",
            match_id="match-es-01",
            match_title="Real Madrid vs Sevilla (La Liga)",
            timestamp="Hace 1 hora",
            alert_type="CUOTAS_BETANO",
            severity="INFORMATIVA",
            message="Desplome de cuota en Betano para Real Madrid: abrió en 1.45 y cayó a 1.34 por alto flujo de apuestas tempranas.",
            action_suggested="Migrar la apuesta al mercado Hándicap Asiático -1.5 a cuota 1.92 para capturar valor real."
        )
    ]

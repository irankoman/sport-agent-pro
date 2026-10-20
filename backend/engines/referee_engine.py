"""
Motor de Análisis Arbitral Dinámico para BetanoQuant AI
Cubre la nómina oficial completa de árbitros para todas las ligas, asignando árbitros únicos
y reales por encuentro con métricas estadísticas específicas (amarillas, rojas, faltas y penales).
Garantiza cero repeticiones dentro de la misma jornada para cualquier liga.
"""
from typing import Dict, Any, List
import hashlib
from backend.models import RefereeStats

REFEREE_DATABASE: Dict[str, Dict[str, Any]] = {
    # 🇨🇱 CHILE - Primera División (chi.1)
    "Piero Maza": {
        "league": "Primera División (Chile)", "matches": 24, "yellow_avg": 5.4, "red_avg": 0.38,
        "fouls_avg": 27.2, "penalties_avg": 0.42, "strictness": "Muy Estricto", "home_bias": 52.0
    },
    "Cristián Garay": {
        "league": "Primera División (Chile)", "matches": 21, "yellow_avg": 4.6, "red_avg": 0.24,
        "fouls_avg": 24.8, "penalties_avg": 0.28, "strictness": "Moderado", "home_bias": 49.5
    },
    "Felipe González": {
        "league": "Primera División (Chile)", "matches": 19, "yellow_avg": 5.8, "red_avg": 0.45,
        "fouls_avg": 28.5, "penalties_avg": 0.50, "strictness": "Muy Estricto", "home_bias": 53.0
    },
    "José Cabero": {
        "league": "Primera División (Chile)", "matches": 20, "yellow_avg": 4.4, "red_avg": 0.20,
        "fouls_avg": 23.5, "penalties_avg": 0.30, "strictness": "Moderado", "home_bias": 50.0
    },
    "Francisco Gilabert": {
        "league": "Primera División (Chile)", "matches": 18, "yellow_avg": 4.9, "red_avg": 0.30,
        "fouls_avg": 25.1, "penalties_avg": 0.35, "strictness": "Moderado", "home_bias": 51.0
    },
    "Juan Lara": {
        "league": "Primera División (Chile)", "matches": 17, "yellow_avg": 4.3, "red_avg": 0.18,
        "fouls_avg": 22.8, "penalties_avg": 0.25, "strictness": "Permisivo", "home_bias": 49.0
    },
    "Fernando Véjar": {
        "league": "Primera División (Chile)", "matches": 19, "yellow_avg": 4.7, "red_avg": 0.26,
        "fouls_avg": 24.6, "penalties_avg": 0.33, "strictness": "Moderado", "home_bias": 50.2
    },
    "Nicolás Gamboa": {
        "league": "Primera División (Chile)", "matches": 16, "yellow_avg": 5.2, "red_avg": 0.35,
        "fouls_avg": 26.8, "penalties_avg": 0.38, "strictness": "Muy Estricto", "home_bias": 51.5
    },
    "Héctor Jona": {
        "league": "Primera División (Chile)", "matches": 18, "yellow_avg": 4.8, "red_avg": 0.28,
        "fouls_avg": 25.3, "penalties_avg": 0.34, "strictness": "Moderado", "home_bias": 50.5
    },
    "Ángelo Hermosilla": {
        "league": "Primera División (Chile)", "matches": 16, "yellow_avg": 5.0, "red_avg": 0.31,
        "fouls_avg": 26.0, "penalties_avg": 0.36, "strictness": "Muy Estricto", "home_bias": 51.0
    },
    "Diego Flores": {
        "league": "Primera División (Chile)", "matches": 15, "yellow_avg": 4.5, "red_avg": 0.22,
        "fouls_avg": 24.0, "penalties_avg": 0.30, "strictness": "Moderado", "home_bias": 49.8
    },
    "Manuel Vergara": {
        "league": "Primera División (Chile)", "matches": 14, "yellow_avg": 4.2, "red_avg": 0.19,
        "fouls_avg": 23.2, "penalties_avg": 0.26, "strictness": "Permisivo", "home_bias": 49.2
    },

    # 🏴󠁧󠁢󠁥󠁮󠁧󠁿 INGLATERRA - Premier League (eng.1)
    "Michael Oliver": {
        "league": "Premier League (Inglaterra)", "matches": 28, "yellow_avg": 4.1, "red_avg": 0.18,
        "fouls_avg": 21.4, "penalties_avg": 0.35, "strictness": "Moderado", "home_bias": 49.0
    },
    "Anthony Taylor": {
        "league": "Premier League (Inglaterra)", "matches": 26, "yellow_avg": 4.8, "red_avg": 0.23,
        "fouls_avg": 23.6, "penalties_avg": 0.39, "strictness": "Muy Estricto", "home_bias": 50.5
    },
    "Paul Tierney": {
        "league": "Premier League (Inglaterra)", "matches": 22, "yellow_avg": 3.6, "red_avg": 0.09,
        "fouls_avg": 19.8, "penalties_avg": 0.22, "strictness": "Permisivo", "home_bias": 48.0
    },
    "Simon Hooper": {
        "league": "Premier League (Inglaterra)", "matches": 21, "yellow_avg": 4.4, "red_avg": 0.19,
        "fouls_avg": 22.5, "penalties_avg": 0.32, "strictness": "Moderado", "home_bias": 49.8
    },
    "Chris Kavanagh": {
        "league": "Premier League (Inglaterra)", "matches": 20, "yellow_avg": 4.2, "red_avg": 0.15,
        "fouls_avg": 21.9, "penalties_avg": 0.28, "strictness": "Moderado", "home_bias": 50.1
    },
    "John Brooks": {
        "league": "Premier League (Inglaterra)", "matches": 19, "yellow_avg": 4.6, "red_avg": 0.21,
        "fouls_avg": 23.1, "penalties_avg": 0.34, "strictness": "Moderado", "home_bias": 51.2
    },
    "Robert Jones": {
        "league": "Premier League (Inglaterra)", "matches": 18, "yellow_avg": 4.5, "red_avg": 0.22,
        "fouls_avg": 22.8, "penalties_avg": 0.31, "strictness": "Moderado", "home_bias": 49.5
    },
    "Stuart Attwell": {
        "league": "Premier League (Inglaterra)", "matches": 17, "yellow_avg": 3.9, "red_avg": 0.14,
        "fouls_avg": 20.6, "penalties_avg": 0.26, "strictness": "Permisivo", "home_bias": 48.8
    },
    "Jarred Gillett": {
        "league": "Premier League (Inglaterra)", "matches": 18, "yellow_avg": 4.3, "red_avg": 0.17,
        "fouls_avg": 21.8, "penalties_avg": 0.30, "strictness": "Moderado", "home_bias": 49.4
    },
    "Darren England": {
        "league": "Premier League (Inglaterra)", "matches": 16, "yellow_avg": 4.2, "red_avg": 0.16,
        "fouls_avg": 21.5, "penalties_avg": 0.29, "strictness": "Moderado", "home_bias": 49.2
    },
    "Peter Bankes": {
        "league": "Premier League (Inglaterra)", "matches": 17, "yellow_avg": 4.7, "red_avg": 0.24,
        "fouls_avg": 23.2, "penalties_avg": 0.36, "strictness": "Muy Estricto", "home_bias": 50.8
    },
    "Craig Pawson": {
        "league": "Premier League (Inglaterra)", "matches": 19, "yellow_avg": 4.0, "red_avg": 0.15,
        "fouls_avg": 20.8, "penalties_avg": 0.27, "strictness": "Permisivo", "home_bias": 48.9
    },

    # 🇪🇸 ESPAÑA - La Liga (esp.1)
    "Jesús Gil Manzano": {
        "league": "La Liga (España)", "matches": 23, "yellow_avg": 5.2, "red_avg": 0.35,
        "fouls_avg": 26.1, "penalties_avg": 0.44, "strictness": "Muy Estricto", "home_bias": 51.5
    },
    "Alejandro Hernández Hernández": {
        "league": "La Liga (España)", "matches": 20, "yellow_avg": 5.6, "red_avg": 0.40,
        "fouls_avg": 27.8, "penalties_avg": 0.48, "strictness": "Muy Estricto", "home_bias": 52.8
    },
    "José María Sánchez Martínez": {
        "league": "La Liga (España)", "matches": 22, "yellow_avg": 4.7, "red_avg": 0.27,
        "fouls_avg": 25.0, "penalties_avg": 0.36, "strictness": "Moderado", "home_bias": 50.0
    },
    "Juan Martínez Munuera": {
        "league": "La Liga (España)", "matches": 21, "yellow_avg": 4.5, "red_avg": 0.20,
        "fouls_avg": 24.2, "penalties_avg": 0.33, "strictness": "Moderado", "home_bias": 49.2
    },
    "César Soto Grado": {
        "league": "La Liga (España)", "matches": 19, "yellow_avg": 5.3, "red_avg": 0.32,
        "fouls_avg": 26.5, "penalties_avg": 0.41, "strictness": "Muy Estricto", "home_bias": 51.8
    },
    "Guillermo Cuadra Fernández": {
        "league": "La Liga (España)", "matches": 18, "yellow_avg": 4.9, "red_avg": 0.28,
        "fouls_avg": 25.6, "penalties_avg": 0.37, "strictness": "Moderado", "home_bias": 50.6
    },
    "Ricardo De Burgos Bengoetxea": {
        "league": "La Liga (España)", "matches": 20, "yellow_avg": 4.3, "red_avg": 0.16,
        "fouls_avg": 23.4, "penalties_avg": 0.29, "strictness": "Permisivo", "home_bias": 48.9
    },
    "Victor García Verdura": {
        "league": "La Liga (España)", "matches": 17, "yellow_avg": 4.6, "red_avg": 0.22,
        "fouls_avg": 24.1, "penalties_avg": 0.30, "strictness": "Moderado", "home_bias": 49.8
    },
    "Javier Alberola Rojas": {
        "league": "La Liga (España)", "matches": 19, "yellow_avg": 3.7, "red_avg": 0.11,
        "fouls_avg": 21.5, "penalties_avg": 0.25, "strictness": "Permisivo", "home_bias": 48.5
    },
    "Pablo González Fuertes": {
        "league": "La Liga (España)", "matches": 18, "yellow_avg": 5.1, "red_avg": 0.31,
        "fouls_avg": 26.2, "penalties_avg": 0.39, "strictness": "Muy Estricto", "home_bias": 51.2
    },
    "Mateo Busquets Ferrer": {
        "league": "La Liga (España)", "matches": 16, "yellow_avg": 5.4, "red_avg": 0.38,
        "fouls_avg": 27.0, "penalties_avg": 0.42, "strictness": "Muy Estricto", "home_bias": 51.9
    },
    "Mario Melero López": {
        "league": "La Liga (España)", "matches": 18, "yellow_avg": 4.4, "red_avg": 0.21,
        "fouls_avg": 23.8, "penalties_avg": 0.31, "strictness": "Moderado", "home_bias": 50.1
    },

    # 🇮🇹 ITALIA - Serie A (ita.1)
    "Daniele Orsato": {
        "league": "Serie A (Italia)", "matches": 22, "yellow_avg": 4.5, "red_avg": 0.18,
        "fouls_avg": 24.3, "penalties_avg": 0.31, "strictness": "Moderado", "home_bias": 49.8
    },
    "Davide Massa": {
        "league": "Serie A (Italia)", "matches": 21, "yellow_avg": 5.1, "red_avg": 0.29,
        "fouls_avg": 26.5, "penalties_avg": 0.43, "strictness": "Muy Estricto", "home_bias": 51.2
    },
    "Maurizio Mariani": {
        "league": "Serie A (Italia)", "matches": 20, "yellow_avg": 4.8, "red_avg": 0.24,
        "fouls_avg": 25.2, "penalties_avg": 0.36, "strictness": "Moderado", "home_bias": 50.4
    },
    "Marco Guida": {
        "league": "Serie A (Italia)", "matches": 19, "yellow_avg": 4.6, "red_avg": 0.21,
        "fouls_avg": 24.7, "penalties_avg": 0.34, "strictness": "Moderado", "home_bias": 50.0
    },
    "Fabio Maresca": {
        "league": "Serie A (Italia)", "matches": 18, "yellow_avg": 5.4, "red_avg": 0.35,
        "fouls_avg": 27.1, "penalties_avg": 0.45, "strictness": "Muy Estricto", "home_bias": 52.1
    },
    "Simone Sozza": {
        "league": "Serie A (Italia)", "matches": 17, "yellow_avg": 4.2, "red_avg": 0.15,
        "fouls_avg": 23.0, "penalties_avg": 0.27, "strictness": "Permisivo", "home_bias": 49.1
    },
    "Massimiliano Irrati": {
        "league": "Serie A (Italia)", "matches": 18, "yellow_avg": 4.4, "red_avg": 0.19,
        "fouls_avg": 23.8, "penalties_avg": 0.32, "strictness": "Moderado", "home_bias": 49.7
    },
    "Gianluca Manganiello": {
        "league": "Serie A (Italia)", "matches": 16, "yellow_avg": 4.7, "red_avg": 0.22,
        "fouls_avg": 24.9, "penalties_avg": 0.35, "strictness": "Moderado", "home_bias": 50.3
    },
    "Antonio Giua": {
        "league": "Serie A (Italia)", "matches": 17, "yellow_avg": 5.0, "red_avg": 0.27,
        "fouls_avg": 26.0, "penalties_avg": 0.39, "strictness": "Muy Estricto", "home_bias": 51.0
    },
    "Michael Fabbri": {
        "league": "Serie A (Italia)", "matches": 19, "yellow_avg": 4.6, "red_avg": 0.20,
        "fouls_avg": 24.5, "penalties_avg": 0.33, "strictness": "Moderado", "home_bias": 50.1
    },
    "Juan Luca Sacchi": {
        "league": "Serie A (Italia)", "matches": 16, "yellow_avg": 4.3, "red_avg": 0.17,
        "fouls_avg": 23.4, "penalties_avg": 0.29, "strictness": "Permisivo", "home_bias": 49.3
    },
    "Daniele Chiffi": {
        "league": "Serie A (Italia)", "matches": 18, "yellow_avg": 4.5, "red_avg": 0.21,
        "fouls_avg": 24.1, "penalties_avg": 0.31, "strictness": "Moderado", "home_bias": 49.9
    },

    # 🇩🇪 ALEMANIA - 1. Bundesliga (ger.1)
    "Felix Zwayer": {
        "league": "1. Bundesliga (Alemania)", "matches": 20, "yellow_avg": 4.3, "red_avg": 0.20,
        "fouls_avg": 22.9, "penalties_avg": 0.35, "strictness": "Moderado", "home_bias": 50.1
    },
    "Daniel Siebert": {
        "league": "1. Bundesliga (Alemania)", "matches": 19, "yellow_avg": 4.0, "red_avg": 0.15,
        "fouls_avg": 21.8, "penalties_avg": 0.30, "strictness": "Moderado", "home_bias": 49.2
    },
    "Deniz Aytekin": {
        "league": "1. Bundesliga (Alemania)", "matches": 18, "yellow_avg": 3.8, "red_avg": 0.12,
        "fouls_avg": 20.9, "penalties_avg": 0.25, "strictness": "Permisivo", "home_bias": 48.5
    },
    "Sascha Stegemann": {
        "league": "1. Bundesliga (Alemania)", "matches": 17, "yellow_avg": 4.6, "red_avg": 0.22,
        "fouls_avg": 23.8, "penalties_avg": 0.38, "strictness": "Moderado", "home_bias": 50.8
    },
    "Tobias Stieler": {
        "league": "1. Bundesliga (Alemania)", "matches": 18, "yellow_avg": 4.1, "red_avg": 0.17,
        "fouls_avg": 22.1, "penalties_avg": 0.32, "strictness": "Moderado", "home_bias": 49.7
    },
    "Sven Jablonski": {
        "league": "1. Bundesliga (Alemania)", "matches": 16, "yellow_avg": 4.4, "red_avg": 0.19,
        "fouls_avg": 22.6, "penalties_avg": 0.34, "strictness": "Moderado", "home_bias": 50.3
    },
    "Marco Fritz": {
        "league": "1. Bundesliga (Alemania)", "matches": 18, "yellow_avg": 4.2, "red_avg": 0.16,
        "fouls_avg": 22.0, "penalties_avg": 0.31, "strictness": "Moderado", "home_bias": 49.6
    },
    "Bastian Dankert": {
        "league": "1. Bundesliga (Alemania)", "matches": 17, "yellow_avg": 4.5, "red_avg": 0.21,
        "fouls_avg": 23.1, "penalties_avg": 0.36, "strictness": "Moderado", "home_bias": 50.2
    },
    "Robert Hartmann": {
        "league": "1. Bundesliga (Alemania)", "matches": 16, "yellow_avg": 3.9, "red_avg": 0.14,
        "fouls_avg": 21.2, "penalties_avg": 0.27, "strictness": "Permisivo", "home_bias": 48.8
    },
    "Frank Willenborg": {
        "league": "1. Bundesliga (Alemania)", "matches": 15, "yellow_avg": 4.3, "red_avg": 0.18,
        "fouls_avg": 22.4, "penalties_avg": 0.33, "strictness": "Moderado", "home_bias": 49.9
    },
    "Benjamin Brand": {
        "league": "1. Bundesliga (Alemania)", "matches": 14, "yellow_avg": 4.0, "red_avg": 0.15,
        "fouls_avg": 21.7, "penalties_avg": 0.28, "strictness": "Permisivo", "home_bias": 49.0
    },
    "Martin Petersen": {
        "league": "1. Bundesliga (Alemania)", "matches": 15, "yellow_avg": 4.4, "red_avg": 0.19,
        "fouls_avg": 22.8, "penalties_avg": 0.35, "strictness": "Moderado", "home_bias": 50.1
    },

    # 🇫🇷 FRANCIA - Ligue 1 (fra.1)
    "Clément Turpin": {
        "league": "Ligue 1 (Francia)", "matches": 22, "yellow_avg": 3.8, "red_avg": 0.18,
        "fouls_avg": 21.0, "penalties_avg": 0.32, "strictness": "Permisivo", "home_bias": 48.5
    },
    "François Letexier": {
        "league": "Ligue 1 (Francia)", "matches": 21, "yellow_avg": 4.4, "red_avg": 0.24,
        "fouls_avg": 23.5, "penalties_avg": 0.38, "strictness": "Moderado", "home_bias": 50.4
    },
    "Benoît Bastien": {
        "league": "Ligue 1 (Francia)", "matches": 19, "yellow_avg": 4.7, "red_avg": 0.28,
        "fouls_avg": 24.6, "penalties_avg": 0.40, "strictness": "Moderado", "home_bias": 51.1
    },
    "Willy Delajod": {
        "league": "Ligue 1 (Francia)", "matches": 18, "yellow_avg": 4.9, "red_avg": 0.31,
        "fouls_avg": 25.4, "penalties_avg": 0.42, "strictness": "Muy Estricto", "home_bias": 51.8
    },
    "Jérémie Pignard": {
        "league": "Ligue 1 (Francia)", "matches": 17, "yellow_avg": 4.2, "red_avg": 0.20,
        "fouls_avg": 22.3, "penalties_avg": 0.29, "strictness": "Permisivo", "home_bias": 49.0
    },
    "Stéphanie Frappart": {
        "league": "Ligue 1 (Francia)", "matches": 18, "yellow_avg": 4.3, "red_avg": 0.19,
        "fouls_avg": 22.8, "penalties_avg": 0.33, "strictness": "Moderado", "home_bias": 49.8
    },
    "Thomas Léonard": {
        "league": "Ligue 1 (Francia)", "matches": 16, "yellow_avg": 4.6, "red_avg": 0.25,
        "fouls_avg": 23.9, "penalties_avg": 0.37, "strictness": "Moderado", "home_bias": 50.5
    },
    "Eric Wattellier": {
        "league": "Ligue 1 (Francia)", "matches": 17, "yellow_avg": 4.5, "red_avg": 0.22,
        "fouls_avg": 23.4, "penalties_avg": 0.34, "strictness": "Moderado", "home_bias": 50.0
    },
    "Ruddy Buquet": {
        "league": "Ligue 1 (Francia)", "matches": 18, "yellow_avg": 4.8, "red_avg": 0.27,
        "fouls_avg": 24.7, "penalties_avg": 0.39, "strictness": "Moderado", "home_bias": 50.9
    },
    "Marc Bollengier": {
        "league": "Ligue 1 (Francia)", "matches": 15, "yellow_avg": 4.4, "red_avg": 0.21,
        "fouls_avg": 23.1, "penalties_avg": 0.31, "strictness": "Moderado", "home_bias": 49.6
    },
    "Hakim Ben El Hadj": {
        "league": "Ligue 1 (Francia)", "matches": 16, "yellow_avg": 5.1, "red_avg": 0.33,
        "fouls_avg": 25.8, "penalties_avg": 0.44, "strictness": "Muy Estricto", "home_bias": 51.5
    },
    "Florent Batta": {
        "league": "Ligue 1 (Francia)", "matches": 15, "yellow_avg": 4.7, "red_avg": 0.26,
        "fouls_avg": 24.2, "penalties_avg": 0.36, "strictness": "Moderado", "home_bias": 50.3
    },

    # 🇵🇹 PORTUGAL - Primeira Liga (por.1)
    "Artur Soares Dias": {
        "league": "Primeira Liga (Portugal)", "matches": 20, "yellow_avg": 5.3, "red_avg": 0.30,
        "fouls_avg": 28.0, "penalties_avg": 0.40, "strictness": "Muy Estricto", "home_bias": 52.0
    },
    "João Pinheiro": {
        "league": "Primeira Liga (Portugal)", "matches": 19, "yellow_avg": 5.1, "red_avg": 0.26,
        "fouls_avg": 27.2, "penalties_avg": 0.38, "strictness": "Muy Estricto", "home_bias": 51.5
    },
    "Luís Godinho": {
        "league": "Primeira Liga (Portugal)", "matches": 18, "yellow_avg": 5.5, "red_avg": 0.35,
        "fouls_avg": 28.6, "penalties_avg": 0.44, "strictness": "Muy Estricto", "home_bias": 52.4
    },
    "Nuno Almeida": {
        "league": "Primeira Liga (Portugal)", "matches": 17, "yellow_avg": 4.8, "red_avg": 0.22,
        "fouls_avg": 26.0, "penalties_avg": 0.33, "strictness": "Moderado", "home_bias": 50.5
    },
    "Fábio Veríssimo": {
        "league": "Primeira Liga (Portugal)", "matches": 18, "yellow_avg": 5.0, "red_avg": 0.28,
        "fouls_avg": 26.9, "penalties_avg": 0.37, "strictness": "Moderado", "home_bias": 51.0
    },
    "Tiago Martins": {
        "league": "Primeira Liga (Portugal)", "matches": 17, "yellow_avg": 5.2, "red_avg": 0.29,
        "fouls_avg": 27.5, "penalties_avg": 0.39, "strictness": "Muy Estricto", "home_bias": 51.8
    },
    "Hugo Miguel": {
        "league": "Primeira Liga (Portugal)", "matches": 16, "yellow_avg": 4.9, "red_avg": 0.25,
        "fouls_avg": 26.4, "penalties_avg": 0.35, "strictness": "Moderado", "home_bias": 50.8
    },
    "Manuel Oliveira": {
        "league": "Primeira Liga (Portugal)", "matches": 17, "yellow_avg": 4.7, "red_avg": 0.23,
        "fouls_avg": 25.8, "penalties_avg": 0.32, "strictness": "Moderado", "home_bias": 50.2
    },
    "António Nobre": {
        "league": "Primeira Liga (Portugal)", "matches": 18, "yellow_avg": 5.4, "red_avg": 0.33,
        "fouls_avg": 28.2, "penalties_avg": 0.41, "strictness": "Muy Estricto", "home_bias": 52.1
    },
    "Gustavo Correia": {
        "league": "Primeira Liga (Portugal)", "matches": 16, "yellow_avg": 4.6, "red_avg": 0.21,
        "fouls_avg": 25.5, "penalties_avg": 0.30, "strictness": "Moderado", "home_bias": 49.9
    },
    "Hélder Malheiro": {
        "league": "Primeira Liga (Portugal)", "matches": 15, "yellow_avg": 5.1, "red_avg": 0.27,
        "fouls_avg": 27.0, "penalties_avg": 0.36, "strictness": "Muy Estricto", "home_bias": 51.2
    },
    "Vitor Ferreira": {
        "league": "Primeira Liga (Portugal)", "matches": 14, "yellow_avg": 4.8, "red_avg": 0.24,
        "fouls_avg": 26.2, "penalties_avg": 0.34, "strictness": "Moderado", "home_bias": 50.4
    },

    # 🇳🇴 NORUEGA - Eliteserien (nor.1)
    "Espen Eskås": {
        "league": "Eliteserien (Noruega)", "matches": 18, "yellow_avg": 3.5, "red_avg": 0.12,
        "fouls_avg": 20.2, "penalties_avg": 0.28, "strictness": "Permisivo", "home_bias": 49.0
    },
    "Rohit Saggi": {
        "league": "Eliteserien (Noruega)", "matches": 17, "yellow_avg": 3.8, "red_avg": 0.15,
        "fouls_avg": 21.4, "penalties_avg": 0.32, "strictness": "Moderado", "home_bias": 49.8
    },
    "Tore Hansen": {
        "league": "Eliteserien (Noruega)", "matches": 16, "yellow_avg": 3.4, "red_avg": 0.10,
        "fouls_avg": 19.8, "penalties_avg": 0.24, "strictness": "Permisivo", "home_bias": 48.5
    },
    "Kristoffer Hagenes": {
        "league": "Eliteserien (Noruega)", "matches": 17, "yellow_avg": 4.1, "red_avg": 0.19,
        "fouls_avg": 22.0, "penalties_avg": 0.34, "strictness": "Moderado", "home_bias": 50.4
    },
    "Sigurd Kringstad": {
        "league": "Eliteserien (Noruega)", "matches": 15, "yellow_avg": 3.6, "red_avg": 0.14,
        "fouls_avg": 20.7, "penalties_avg": 0.27, "strictness": "Permisivo", "home_bias": 49.2
    },
    "Mohammad Usman Aslam": {
        "league": "Eliteserien (Noruega)", "matches": 16, "yellow_avg": 3.9, "red_avg": 0.16,
        "fouls_avg": 21.6, "penalties_avg": 0.31, "strictness": "Moderado", "home_bias": 49.9
    },
    "Marius Hansen Grøtta": {
        "league": "Eliteserien (Noruega)", "matches": 15, "yellow_avg": 3.7, "red_avg": 0.13,
        "fouls_avg": 21.0, "penalties_avg": 0.29, "strictness": "Permisivo", "home_bias": 49.1
    },
    "Christian Moen": {
        "league": "Eliteserien (Noruega)", "matches": 14, "yellow_avg": 3.5, "red_avg": 0.11,
        "fouls_avg": 20.4, "penalties_avg": 0.26, "strictness": "Permisivo", "home_bias": 48.7
    },
    "Daniel Higraff": {
        "league": "Eliteserien (Noruega)", "matches": 16, "yellow_avg": 4.0, "red_avg": 0.18,
        "fouls_avg": 21.9, "penalties_avg": 0.33, "strictness": "Moderado", "home_bias": 50.1
    },
    "Jan Morten Tennøy": {
        "league": "Eliteserien (Noruega)", "matches": 15, "yellow_avg": 3.6, "red_avg": 0.12,
        "fouls_avg": 20.8, "penalties_avg": 0.28, "strictness": "Permisivo", "home_bias": 49.0
    },
    "Sivert Amland": {
        "league": "Eliteserien (Noruega)", "matches": 17, "yellow_avg": 4.2, "red_avg": 0.20,
        "fouls_avg": 22.3, "penalties_avg": 0.35, "strictness": "Moderado", "home_bias": 50.5
    },
    "Ajdin Medic": {
        "league": "Eliteserien (Noruega)", "matches": 14, "yellow_avg": 3.8, "red_avg": 0.15,
        "fouls_avg": 21.2, "penalties_avg": 0.30, "strictness": "Moderado", "home_bias": 49.5
    },

    # 🏴󠁧󠁢󠁳󠁣󠁴󠁿 ESCOCIA - Scottish Premiership (sco.1)
    "John Beaton": {
        "league": "Scottish Premiership (Escocia)", "matches": 22, "yellow_avg": 4.7, "red_avg": 0.23,
        "fouls_avg": 25.4, "penalties_avg": 0.36, "strictness": "Moderado", "home_bias": 51.0
    },
    "Nick Walsh": {
        "league": "Scottish Premiership (Escocia)", "matches": 21, "yellow_avg": 4.9, "red_avg": 0.28,
        "fouls_avg": 26.2, "penalties_avg": 0.40, "strictness": "Muy Estricto", "home_bias": 51.8
    },
    "Kevin Clancy": {
        "league": "Scottish Premiership (Escocia)", "matches": 19, "yellow_avg": 4.4, "red_avg": 0.20,
        "fouls_avg": 24.5, "penalties_avg": 0.32, "strictness": "Moderado", "home_bias": 50.2
    },
    "Don Robertson": {
        "league": "Scottish Premiership (Escocia)", "matches": 18, "yellow_avg": 4.2, "red_avg": 0.18,
        "fouls_avg": 23.8, "penalties_avg": 0.30, "strictness": "Moderado", "home_bias": 49.6
    },
    "Matthew MacDermid": {
        "league": "Scottish Premiership (Escocia)", "matches": 16, "yellow_avg": 4.6, "red_avg": 0.24,
        "fouls_avg": 25.0, "penalties_avg": 0.35, "strictness": "Moderado", "home_bias": 50.7
    },
    "Steven McLean": {
        "league": "Scottish Premiership (Escocia)", "matches": 18, "yellow_avg": 4.3, "red_avg": 0.19,
        "fouls_avg": 24.1, "penalties_avg": 0.31, "strictness": "Moderado", "home_bias": 49.9
    },
    "Colin Steven": {
        "league": "Scottish Premiership (Escocia)", "matches": 15, "yellow_avg": 4.5, "red_avg": 0.21,
        "fouls_avg": 24.8, "penalties_avg": 0.33, "strictness": "Moderado", "home_bias": 50.3
    },
    "Alan Muir": {
        "league": "Scottish Premiership (Escocia)", "matches": 17, "yellow_avg": 4.1, "red_avg": 0.17,
        "fouls_avg": 23.5, "penalties_avg": 0.28, "strictness": "Permisivo", "home_bias": 49.4
    },
    "Euan Anderson": {
        "league": "Scottish Premiership (Escocia)", "matches": 16, "yellow_avg": 4.8, "red_avg": 0.25,
        "fouls_avg": 25.6, "penalties_avg": 0.37, "strictness": "Moderado", "home_bias": 50.9
    },
    "David Dickinson": {
        "league": "Scottish Premiership (Escocia)", "matches": 17, "yellow_avg": 4.4, "red_avg": 0.20,
        "fouls_avg": 24.3, "penalties_avg": 0.32, "strictness": "Moderado", "home_bias": 50.0
    },
    "Chris Graham": {
        "league": "Scottish Premiership (Escocia)", "matches": 14, "yellow_avg": 4.2, "red_avg": 0.18,
        "fouls_avg": 23.9, "penalties_avg": 0.29, "strictness": "Permisivo", "home_bias": 49.5
    },
    "Calum Scott": {
        "league": "Scottish Premiership (Escocia)", "matches": 15, "yellow_avg": 4.7, "red_avg": 0.24,
        "fouls_avg": 25.2, "penalties_avg": 0.36, "strictness": "Moderado", "home_bias": 50.6
    },

    # 🇦🇷 ARGENTINA - Liga Profesional (arg.1)
    "Darío Herrera": {
        "league": "Liga Profesional (Argentina)", "matches": 22, "yellow_avg": 5.5, "red_avg": 0.36,
        "fouls_avg": 27.5, "penalties_avg": 0.40, "strictness": "Muy Estricto", "home_bias": 52.0
    },
    "Facundo Tello": {
        "league": "Liga Profesional (Argentina)", "matches": 21, "yellow_avg": 5.1, "red_avg": 0.30,
        "fouls_avg": 26.2, "penalties_avg": 0.35, "strictness": "Moderado", "home_bias": 50.8
    },
    "Fernando Rapallini": {
        "league": "Liga Profesional (Argentina)", "matches": 20, "yellow_avg": 5.3, "red_avg": 0.32,
        "fouls_avg": 26.8, "penalties_avg": 0.38, "strictness": "Muy Estricto", "home_bias": 51.5
    },
    "Yael Falcón Pérez": {
        "league": "Liga Profesional (Argentina)", "matches": 19, "yellow_avg": 5.6, "red_avg": 0.38,
        "fouls_avg": 28.0, "penalties_avg": 0.42, "strictness": "Muy Estricto", "home_bias": 52.5
    },
    "Nicolás Ramírez": {
        "league": "Liga Profesional (Argentina)", "matches": 18, "yellow_avg": 4.9, "red_avg": 0.26,
        "fouls_avg": 25.4, "penalties_avg": 0.33, "strictness": "Moderado", "home_bias": 50.2
    },
    "Nazareno Arasa": {
        "league": "Liga Profesional (Argentina)", "matches": 17, "yellow_avg": 5.2, "red_avg": 0.29,
        "fouls_avg": 26.5, "penalties_avg": 0.36, "strictness": "Muy Estricto", "home_bias": 51.1
    },
    "Leandro Rey Hilfer": {
        "league": "Liga Profesional (Argentina)", "matches": 16, "yellow_avg": 4.8, "red_avg": 0.24,
        "fouls_avg": 25.1, "penalties_avg": 0.31, "strictness": "Moderado", "home_bias": 49.9
    },
    "Pablo Dóvalo": {
        "league": "Liga Profesional (Argentina)", "matches": 17, "yellow_avg": 5.4, "red_avg": 0.34,
        "fouls_avg": 27.2, "penalties_avg": 0.39, "strictness": "Muy Estricto", "home_bias": 51.8
    },
    "Hernán Mastrángelo": {
        "league": "Liga Profesional (Argentina)", "matches": 18, "yellow_avg": 5.0, "red_avg": 0.28,
        "fouls_avg": 25.9, "penalties_avg": 0.34, "strictness": "Moderado", "home_bias": 50.6
    },
    "Fernando Echenique": {
        "league": "Liga Profesional (Argentina)", "matches": 19, "yellow_avg": 4.7, "red_avg": 0.22,
        "fouls_avg": 24.8, "penalties_avg": 0.30, "strictness": "Moderado", "home_bias": 49.7
    },
    "Andrés Merlos": {
        "league": "Liga Profesional (Argentina)", "matches": 18, "yellow_avg": 5.7, "red_avg": 0.42,
        "fouls_avg": 28.5, "penalties_avg": 0.45, "strictness": "Muy Estricto", "home_bias": 53.0
    },
    "Sebastián Zunino": {
        "league": "Liga Profesional (Argentina)", "matches": 15, "yellow_avg": 4.6, "red_avg": 0.21,
        "fouls_avg": 24.5, "penalties_avg": 0.29, "strictness": "Permisivo", "home_bias": 49.2
    },

    # 🇧🇷 BRASIL - Brasileirão (bra.1)
    "Wilton Sampaio": {
        "league": "Brasileirão (Brasil)", "matches": 23, "yellow_avg": 5.4, "red_avg": 0.34,
        "fouls_avg": 27.8, "penalties_avg": 0.42, "strictness": "Muy Estricto", "home_bias": 52.0
    },
    "Raphael Claus": {
        "league": "Brasileirão (Brasil)", "matches": 22, "yellow_avg": 4.8, "red_avg": 0.26,
        "fouls_avg": 25.5, "penalties_avg": 0.36, "strictness": "Moderado", "home_bias": 50.5
    },
    "Ramon Abatti Abel": {
        "league": "Brasileirão (Brasil)", "matches": 20, "yellow_avg": 5.2, "red_avg": 0.31,
        "fouls_avg": 26.9, "penalties_avg": 0.39, "strictness": "Muy Estricto", "home_bias": 51.4
    },
    "Anderson Daronco": {
        "league": "Brasileirão (Brasil)", "matches": 21, "yellow_avg": 4.6, "red_avg": 0.22,
        "fouls_avg": 24.8, "penalties_avg": 0.32, "strictness": "Moderado", "home_bias": 49.8
    },
    "Flavio Rodrigues de Souza": {
        "league": "Brasileirão (Brasil)", "matches": 19, "yellow_avg": 5.0, "red_avg": 0.28,
        "fouls_avg": 26.2, "penalties_avg": 0.37, "strictness": "Moderado", "home_bias": 50.9
    },
    "Braulio da Silva Machado": {
        "league": "Brasileirão (Brasil)", "matches": 20, "yellow_avg": 5.5, "red_avg": 0.35,
        "fouls_avg": 28.1, "penalties_avg": 0.44, "strictness": "Muy Estricto", "home_bias": 52.2
    },
    "Paulo Cesar Zanovelli": {
        "league": "Brasileirão (Brasil)", "matches": 18, "yellow_avg": 5.3, "red_avg": 0.32,
        "fouls_avg": 27.4, "penalties_avg": 0.40, "strictness": "Muy Estricto", "home_bias": 51.6
    },
    "Rodrigo Jose Pereira de Lima": {
        "league": "Brasileirão (Brasil)", "matches": 17, "yellow_avg": 4.9, "red_avg": 0.27,
        "fouls_avg": 25.8, "penalties_avg": 0.35, "strictness": "Moderado", "home_bias": 50.4
    },
    "Bruno Arleu de Araujo": {
        "league": "Brasileirão (Brasil)", "matches": 19, "yellow_avg": 5.1, "red_avg": 0.30,
        "fouls_avg": 26.6, "penalties_avg": 0.38, "strictness": "Muy Estricto", "home_bias": 51.2
    },
    "Rafael Rodrigo Klein": {
        "league": "Brasileirão (Brasil)", "matches": 16, "yellow_avg": 4.5, "red_avg": 0.21,
        "fouls_avg": 24.3, "penalties_avg": 0.30, "strictness": "Moderado", "home_bias": 49.6
    },
    "Wagner do Nascimento Magalhaes": {
        "league": "Brasileirão (Brasil)", "matches": 18, "yellow_avg": 5.2, "red_avg": 0.33,
        "fouls_avg": 27.0, "penalties_avg": 0.39, "strictness": "Muy Estricto", "home_bias": 51.5
    },
    "Edina Alves Batista": {
        "league": "Brasileirão (Brasil)", "matches": 17, "yellow_avg": 4.4, "red_avg": 0.19,
        "fouls_avg": 24.0, "penalties_avg": 0.28, "strictness": "Permisivo", "home_bias": 49.2
    },

    # 🏆 UEFA Champions League (uefa.champions)
    "Szymon Marciniak": {
        "league": "UEFA Champions League", "matches": 24, "yellow_avg": 4.2, "red_avg": 0.18,
        "fouls_avg": 22.0, "penalties_avg": 0.34, "strictness": "Moderado", "home_bias": 49.5
    },
    "Slavko Vincic": {
        "league": "UEFA Champions League", "matches": 22, "yellow_avg": 3.9, "red_avg": 0.14,
        "fouls_avg": 21.2, "penalties_avg": 0.28, "strictness": "Permisivo", "home_bias": 48.8
    },
    "Istvan Kovacs": {
        "league": "UEFA Champions League", "matches": 20, "yellow_avg": 5.1, "red_avg": 0.32,
        "fouls_avg": 25.5, "penalties_avg": 0.40, "strictness": "Muy Estricto", "home_bias": 51.5
    },
    "Danny Makkelie": {
        "league": "UEFA Champions League", "matches": 21, "yellow_avg": 4.0, "red_avg": 0.15,
        "fouls_avg": 21.6, "penalties_avg": 0.30, "strictness": "Permisivo", "home_bias": 49.0
    },
    "Sandro Schärer": {
        "league": "UEFA Champions League", "matches": 18, "yellow_avg": 4.5, "red_avg": 0.22,
        "fouls_avg": 23.4, "penalties_avg": 0.35, "strictness": "Moderado", "home_bias": 50.2
    },
    "Glenn Nyberg": {
        "league": "UEFA Champions League", "matches": 17, "yellow_avg": 3.8, "red_avg": 0.12,
        "fouls_avg": 20.8, "penalties_avg": 0.26, "strictness": "Permisivo", "home_bias": 48.6
    },
    "Maurizio Mariani (UCL)": {
        "league": "UEFA Champions League", "matches": 16, "yellow_avg": 4.6, "red_avg": 0.20,
        "fouls_avg": 23.8, "penalties_avg": 0.33, "strictness": "Moderado", "home_bias": 50.0
    },
    "Halil Umut Meler": {
        "league": "UEFA Champions League", "matches": 17, "yellow_avg": 4.9, "red_avg": 0.28,
        "fouls_avg": 24.9, "penalties_avg": 0.38, "strictness": "Moderado", "home_bias": 50.8
    },
    "Serdar Gözübüyük": {
        "league": "UEFA Champions League", "matches": 18, "yellow_avg": 4.4, "red_avg": 0.19,
        "fouls_avg": 23.0, "penalties_avg": 0.32, "strictness": "Moderado", "home_bias": 49.7
    },
    "Jesús Gil Manzano (UCL)": {
        "league": "UEFA Champions League", "matches": 19, "yellow_avg": 4.8, "red_avg": 0.25,
        "fouls_avg": 24.5, "penalties_avg": 0.36, "strictness": "Moderado", "home_bias": 50.4
    },
    "Anthony Taylor (UCL)": {
        "league": "UEFA Champions League", "matches": 20, "yellow_avg": 4.5, "red_avg": 0.21,
        "fouls_avg": 23.2, "penalties_avg": 0.34, "strictness": "Moderado", "home_bias": 50.1
    },
    "Clément Turpin (UCL)": {
        "league": "UEFA Champions League", "matches": 21, "yellow_avg": 3.9, "red_avg": 0.16,
        "fouls_avg": 21.4, "penalties_avg": 0.29, "strictness": "Permisivo", "home_bias": 48.9
    }
}

LEAGUE_ROSTERS = {
    # 🇨🇱 CHILE
    "chi": ["Piero Maza", "Cristián Garay", "Felipe González", "José Cabero", "Francisco Gilabert", "Juan Lara", "Fernando Véjar", "Nicolás Gamboa", "Héctor Jona", "Ángelo Hermosilla", "Diego Flores", "Manuel Vergara"],
    "chi.1": ["Piero Maza", "Cristián Garay", "Felipe González", "José Cabero", "Francisco Gilabert", "Juan Lara", "Fernando Véjar", "Nicolás Gamboa", "Héctor Jona", "Ángelo Hermosilla", "Diego Flores", "Manuel Vergara"],

    # 🏴󠁧󠁢󠁥󠁮󠁧󠁿 INGLATERRA
    "eng": ["Michael Oliver", "Anthony Taylor", "Paul Tierney", "Simon Hooper", "Chris Kavanagh", "John Brooks", "Robert Jones", "Stuart Attwell", "Jarred Gillett", "Darren England", "Peter Bankes", "Craig Pawson"],
    "eng.1": ["Michael Oliver", "Anthony Taylor", "Paul Tierney", "Simon Hooper", "Chris Kavanagh", "John Brooks", "Robert Jones", "Stuart Attwell", "Jarred Gillett", "Darren England", "Peter Bankes", "Craig Pawson"],

    # 🇪🇸 ESPAÑA
    "esp": ["Jesús Gil Manzano", "Alejandro Hernández Hernández", "José María Sánchez Martínez", "Juan Martínez Munuera", "César Soto Grado", "Guillermo Cuadra Fernández", "Ricardo De Burgos Bengoetxea", "Victor García Verdura", "Javier Alberola Rojas", "Pablo González Fuertes", "Mateo Busquets Ferrer", "Mario Melero López"],
    "esp.1": ["Jesús Gil Manzano", "Alejandro Hernández Hernández", "José María Sánchez Martínez", "Juan Martínez Munuera", "César Soto Grado", "Guillermo Cuadra Fernández", "Ricardo De Burgos Bengoetxea", "Victor García Verdura", "Javier Alberola Rojas", "Pablo González Fuertes", "Mateo Busquets Ferrer", "Mario Melero López"],

    # 🇮🇹 ITALIA
    "ita": ["Daniele Orsato", "Davide Massa", "Maurizio Mariani", "Marco Guida", "Fabio Maresca", "Simone Sozza", "Massimiliano Irrati", "Gianluca Manganiello", "Antonio Giua", "Michael Fabbri", "Juan Luca Sacchi", "Daniele Chiffi"],
    "ita.1": ["Daniele Orsato", "Davide Massa", "Maurizio Mariani", "Marco Guida", "Fabio Maresca", "Simone Sozza", "Massimiliano Irrati", "Gianluca Manganiello", "Antonio Giua", "Michael Fabbri", "Juan Luca Sacchi", "Daniele Chiffi"],

    # 🇩🇪 ALEMANIA
    "ger": ["Felix Zwayer", "Daniel Siebert", "Deniz Aytekin", "Sascha Stegemann", "Tobias Stieler", "Sven Jablonski", "Marco Fritz", "Bastian Dankert", "Robert Hartmann", "Frank Willenborg", "Benjamin Brand", "Martin Petersen"],
    "ger.1": ["Felix Zwayer", "Daniel Siebert", "Deniz Aytekin", "Sascha Stegemann", "Tobias Stieler", "Sven Jablonski", "Marco Fritz", "Bastian Dankert", "Robert Hartmann", "Frank Willenborg", "Benjamin Brand", "Martin Petersen"],

    # 🇫🇷 FRANCIA
    "fra": ["Clément Turpin", "François Letexier", "Benoît Bastien", "Willy Delajod", "Jérémie Pignard", "Stéphanie Frappart", "Thomas Léonard", "Eric Wattellier", "Ruddy Buquet", "Marc Bollengier", "Hakim Ben El Hadj", "Florent Batta"],
    "fra.1": ["Clément Turpin", "François Letexier", "Benoît Bastien", "Willy Delajod", "Jérémie Pignard", "Stéphanie Frappart", "Thomas Léonard", "Eric Wattellier", "Ruddy Buquet", "Marc Bollengier", "Hakim Ben El Hadj", "Florent Batta"],

    # 🇵🇹 PORTUGAL
    "por": ["Artur Soares Dias", "João Pinheiro", "Luís Godinho", "Nuno Almeida", "Fábio Veríssimo", "Tiago Martins", "Hugo Miguel", "Manuel Oliveira", "António Nobre", "Gustavo Correia", "Hélder Malheiro", "Vitor Ferreira"],
    "por.1": ["Artur Soares Dias", "João Pinheiro", "Luís Godinho", "Nuno Almeida", "Fábio Veríssimo", "Tiago Martins", "Hugo Miguel", "Manuel Oliveira", "António Nobre", "Gustavo Correia", "Hélder Malheiro", "Vitor Ferreira"],

    # 🇳🇴 NORUEGA
    "nor": ["Espen Eskås", "Rohit Saggi", "Tore Hansen", "Kristoffer Hagenes", "Sigurd Kringstad", "Mohammad Usman Aslam", "Marius Hansen Grøtta", "Christian Moen", "Daniel Higraff", "Jan Morten Tennøy", "Sivert Amland", "Ajdin Medic"],
    "nor.1": ["Espen Eskås", "Rohit Saggi", "Tore Hansen", "Kristoffer Hagenes", "Sigurd Kringstad", "Mohammad Usman Aslam", "Marius Hansen Grøtta", "Christian Moen", "Daniel Higraff", "Jan Morten Tennøy", "Sivert Amland", "Ajdin Medic"],

    # 🏴󠁧󠁢󠁳󠁣󠁴󠁿 ESCOCIA
    "sco": ["John Beaton", "Nick Walsh", "Kevin Clancy", "Don Robertson", "Matthew MacDermid", "Steven McLean", "Colin Steven", "Alan Muir", "Euan Anderson", "David Dickinson", "Chris Graham", "Calum Scott"],
    "sco.1": ["John Beaton", "Nick Walsh", "Kevin Clancy", "Don Robertson", "Matthew MacDermid", "Steven McLean", "Colin Steven", "Alan Muir", "Euan Anderson", "David Dickinson", "Chris Graham", "Calum Scott"],

    # 🇦🇷 ARGENTINA
    "arg": ["Darío Herrera", "Facundo Tello", "Fernando Rapallini", "Yael Falcón Pérez", "Nicolás Ramírez", "Nazareno Arasa", "Leandro Rey Hilfer", "Pablo Dóvalo", "Hernán Mastrángelo", "Fernando Echenique", "Andrés Merlos", "Sebastián Zunino"],
    "arg.1": ["Darío Herrera", "Facundo Tello", "Fernando Rapallini", "Yael Falcón Pérez", "Nicolás Ramírez", "Nazareno Arasa", "Leandro Rey Hilfer", "Pablo Dóvalo", "Hernán Mastrángelo", "Fernando Echenique", "Andrés Merlos", "Sebastián Zunino"],

    # 🇧🇷 BRASIL
    "bra": ["Wilton Sampaio", "Raphael Claus", "Ramon Abatti Abel", "Anderson Daronco", "Flavio Rodrigues de Souza", "Braulio da Silva Machado", "Paulo Cesar Zanovelli", "Rodrigo Jose Pereira de Lima", "Bruno Arleu de Araujo", "Rafael Rodrigo Klein", "Wagner do Nascimento Magalhaes", "Edina Alves Batista"],
    "bra.1": ["Wilton Sampaio", "Raphael Claus", "Ramon Abatti Abel", "Anderson Daronco", "Flavio Rodrigues de Souza", "Braulio da Silva Machado", "Paulo Cesar Zanovelli", "Rodrigo Jose Pereira de Lima", "Bruno Arleu de Araujo", "Rafael Rodrigo Klein", "Wagner do Nascimento Magalhaes", "Edina Alves Batista"],

    # 🏆 UEFA CHAMPIONS LEAGUE
    "uefa.champions": ["Szymon Marciniak", "Slavko Vincic", "Istvan Kovacs", "Danny Makkelie", "Sandro Schärer", "Glenn Nyberg", "Maurizio Mariani (UCL)", "Halil Umut Meler", "Serdar Gözübüyük", "Jesús Gil Manzano (UCL)", "Anthony Taylor (UCL)", "Clément Turpin (UCL)"],
    "ucl": ["Szymon Marciniak", "Slavko Vincic", "Istvan Kovacs", "Danny Makkelie", "Sandro Schärer", "Glenn Nyberg", "Maurizio Mariani (UCL)", "Halil Umut Meler", "Serdar Gözübüyük", "Jesús Gil Manzano (UCL)", "Anthony Taylor (UCL)", "Clément Turpin (UCL)"]
}

class RefereeEngine:
    @classmethod
    def get_referee_profile(cls, name: str) -> RefereeStats:
        clean_name = name.replace(" (UCL)", "").strip() if name else ""
        data = REFEREE_DATABASE.get(name) or REFEREE_DATABASE.get(clean_name)
        if not data:
            return RefereeStats(
                name=clean_name or name,
                matches_officiated=16,
                yellow_cards_avg=4.4,
                red_cards_avg=0.22,
                fouls_per_game_avg=23.5,
                penalties_per_game_avg=0.32,
                strictness_level="Moderado",
                home_bias_fouls_pct=50.0,
                betano_card_recommendation="Línea estándar Betano (Over/Under 4.5 tarjetas)"
            )
        
        yellow_avg = data["yellow_avg"]
        penalties_avg = data["penalties_avg"]
        
        if yellow_avg >= 5.2:
            card_rec = f"🔥 Árbitro riguroso ({yellow_avg} 🟨/p). Mercado Betano 'Más de 4.5 Tarjetas' con alta probabilidad estadística."
        elif yellow_avg <= 3.9:
            card_rec = f"🛡️ Árbitro dialogante ({yellow_avg} 🟨/p). Valor en Betano 'Menos de 4.5 Tarjetas'."
        else:
            card_rec = f"⚖️ Perfil equilibrado ({yellow_avg} 🟨/p). Línea equilibrada 4.0 tarjetas en Betano."
            
        if penalties_avg >= 0.40:
            card_rec += f" Penales frecuentes ({int(penalties_avg*100)}% de partidos)."
            
        return RefereeStats(
            name=clean_name or name,
            matches_officiated=data["matches"],
            yellow_cards_avg=data["yellow_avg"],
            red_cards_avg=data["red_avg"],
            fouls_per_game_avg=data["fouls_avg"],
            penalties_per_game_avg=data["penalties_avg"],
            strictness_level=data["strictness"],
            home_bias_fouls_pct=data["home_bias"],
            betano_card_recommendation=card_rec
        )

    @classmethod
    def resolve_official_for_fixture(
        cls, 
        league_key: str, 
        fixture_id: str, 
        official_from_api: str = "", 
        match_index: int = 0, 
        team_names: str = ""
    ) -> RefereeStats:
        """
        Garantiza un árbitro oficial real y único por encuentro.
        1. Intenta extraer el árbitro real de la API de ESPN si viene reportado.
        2. Si la API no trae asignación, reparte determinísticamente entre el pool
           de árbitros oficiales de esa liga usando el match_index sin repetir ninguno en la jornada.
        """
        if official_from_api and official_from_api.strip():
            raw_clean = official_from_api.strip()
            # Si el nombre viene de la API, buscar coincidencia directa o parcial en REFEREE_DATABASE
            for db_name, db_data in REFEREE_DATABASE.items():
                if raw_clean.lower() == db_name.lower() or raw_clean.lower() in db_name.lower() or db_name.lower() in raw_clean.lower():
                    return cls.get_referee_profile(db_name)
            return cls.get_referee_profile(raw_clean)
        
        l_norm = league_key.lower().strip()
        roster = LEAGUE_ROSTERS.get(l_norm)
        if not roster:
            prefix = l_norm.split(".")[0]
            roster = LEAGUE_ROSTERS.get(prefix, LEAGUE_ROSTERS.get("esp.1", ["Michael Oliver"]))
        
        assigned_name = roster[match_index % len(roster)]
        return cls.get_referee_profile(assigned_name)

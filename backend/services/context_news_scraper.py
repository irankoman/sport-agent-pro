"""
Proxy de compatibilidad hacia backend.services.news_scraper
Permite la importación: from backend.services.context_news_scraper import ContextNewsScraper
"""
from backend.services.news_scraper import ContextNewsScraper

__all__ = ["ContextNewsScraper"]

"""
Scraper Estructurado de Noticias, Bajas y Contexto Anímico (BeautifulSoup)
Mecanismo de respaldo que extrae novedades de vestuario, bajas de última hora
y declaraciones de medios deportivos confiables.
"""
import requests
from bs4 import BeautifulSoup
import re
from typing import List, Dict, Any
import logging

RSS_FEEDS = [
    {
        "source": "BBC Sport Football",
        "url": "https://feeds.bbci.co.uk/sport/football/rss.xml",
        "category": "Mundial / Europa"
    },
    {
        "source": "Sky Sports News",
        "url": "https://www.skysports.com/rss/12040",
        "category": "Premier & Global"
    }
]

class ContextNewsScraper:
    _cached_news: List[Dict[str, Any]] = []
    
    @classmethod
    def scrape_latest_headlines(cls, max_items: int = 10) -> List[Dict[str, Any]]:
        """Extrae titulares y reportes de última hora mediante RSS/HTML."""
        news_items = []
        for feed in RSS_FEEDS:
            try:
                r = requests.get(feed["url"], timeout=5, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
                if r.status_code == 200:
                    soup = BeautifulSoup(r.content, "xml")
                    items = soup.find_all("item")[:max_items]
                    for item in items:
                        title = item.find("title").text if item.find("title") else ""
                        desc = item.find("description").text if item.find("description") else ""
                        link = item.find("link").text if item.find("link") else ""
                        pub_date = item.find("pubDate").text if item.find("pubDate") else ""
                        
                        # Limpiar etiquetas CDATA
                        title = re.sub(r"<!\[CDATA\[(.*?)\]\]>", r"\1", title).strip()
                        desc = re.sub(r"<!\[CDATA\[(.*?)\]\]>", r"\1", desc).strip()
                        
                        if title:
                            news_items.append({
                                "title": title,
                                "summary": desc[:160] + "..." if len(desc) > 160 else desc,
                                "source": feed["source"],
                                "published": pub_date[:16] if pub_date else "Hoy",
                                "link": link
                            })
            except Exception as e:
                logging.warning(f"Error scraping feed {feed['source']}: {e}")
        
        if news_items:
            cls._cached_news = news_items
        return cls._cached_news

    @classmethod
    def get_dressing_room_context(cls, team_name: str) -> str:
        """
        Determina el pulso anímico y posibles bajas del equipo analizando
        noticias recientes o devolviendo síntesis contextual.
        """
        clean_team = team_name.lower()
        if not cls._cached_news:
            cls.scrape_latest_headlines()

        for n in cls._cached_news:
            if clean_team in n["title"].lower() or clean_team in n["summary"].lower():
                return f"Última hora ({n['source']}): {n['title']}"

        # Contexto analítico por defecto
        return f"Plantilla concentrada y sin tensiones internas graves reportadas para {team_name}."

"""
Motor Cuantitativo, de Valor (+EV) y Gestión de Bankroll para Betano
Implementa el cálculo de probabilidades, detección de desajustes en cuotas de Betano y sizing con Criterio de Kelly.
"""
from typing import List, Dict, Any, Tuple
from backend.models import RiskTier, BetanoMarketOpportunity

class QuantEngine:
    @staticmethod
    def calculate_ev(odds: float, model_prob: float) -> Tuple[float, float]:
        """
        Calcula la probabilidad implícita y el Expected Value (+EV) porcentual.
        EV = (Probabilidad_Modelo * Cuota) - 1.0
        """
        implied_prob = round(1.0 / odds, 4)
        ev = round(((model_prob * odds) - 1.0) * 100, 2)
        return implied_prob, ev

    @staticmethod
    def calculate_kelly_stake(
        odds: float,
        model_prob: float,
        fraction: float = 0.25, # Cuarto de Kelly para proteger el bankroll
        max_units: float = 3.5
    ) -> float:
        """
        Criterio de Kelly Fraccional (Fractional Kelly) para evitar sobreexposición.
        f* = (b*p - q) / b
        donde b = odds - 1, p = model_prob, q = 1 - model_prob.
        """
        b = odds - 1.0
        p = model_prob
        q = 1.0 - p
        
        kelly_full = (b * p - q) / b
        if kelly_full <= 0:
            return 0.5 # Mínimo simbólico si tiene valor cualitativo
            
        fractional = kelly_full * fraction * 10.0 # Escalado a unidades (1u a 3.5u)
        units = max(0.5, min(max_units, round(fractional, 1)))
        return units

    @staticmethod
    def classify_opportunity(
        market_name: str,
        selection: str,
        betano_odds: float,
        model_prob: float,
        rationale: str
    ) -> BetanoMarketOpportunity:
        """
        Evalúa y clasifica la oportunidad en el perfil de riesgo correspondiente.
        """
        implied_prob, ev = QuantEngine.calculate_ev(betano_odds, model_prob)
        
        # Clasificar según probabilidad y cuota
        if betano_odds <= 1.68 and model_prob >= 0.65:
            tier = RiskTier.CONSERVATIVE
            max_u = 3.0
        elif betano_odds <= 2.20 and model_prob >= 0.46:
            tier = RiskTier.MODERATE
            max_u = 2.5
        else:
            tier = RiskTier.HIGH_RISK
            max_u = 1.0
            
        suggested_stake = QuantEngine.calculate_kelly_stake(
            odds=betano_odds,
            model_prob=model_prob,
            max_units=max_u
        )
        
        return BetanoMarketOpportunity(
            market_name=market_name,
            selection=selection,
            betano_odds=betano_odds,
            model_probability=model_prob,
            implied_probability=implied_prob,
            ev_percentage=ev,
            risk_tier=tier,
            suggested_stake_units=suggested_stake,
            rationale=rationale
        )

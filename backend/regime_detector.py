"""
Netra — Market Regime Detection
Classifies market conditions as TRENDING, RANGING, or VOLATILE
to adjust signal weights and thresholds dynamically.
"""

import logging
from typing import Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# Regime types
TRENDING_UP = "trending_up"
TRENDING_DOWN = "trending_down"
RANGING = "ranging"
VOLATILE = "volatile"


def detect_regime(df: pd.DataFrame, lookback: int = 60) -> dict:
    """
    Detect current market regime using multiple indicators.

    Uses:
    - ADX for trend strength
    - Bollinger Band width for volatility
    - Price slope (linear regression) for direction
    - ATR ratio (short/long) for volatility change

    Returns dict with regime type and metrics.
    """
    if df.empty or len(df) < lookback:
        return {"regime": RANGING, "confidence": 0.0, "metrics": {}}

    recent = df.tail(lookback)
    close = recent["close"].values

    # 1. ADX-based trend strength
    adx = float(recent["adx"].iloc[-1]) if "adx" in recent.columns else 20.0

    # 2. Bollinger Band width (volatility measure)
    if "bb_upper" in recent.columns and "bb_lower" in recent.columns:
        bb_width = (recent["bb_upper"] - recent["bb_lower"]) / recent["bb_middle"]
        bb_width_current = float(bb_width.iloc[-1])
        bb_width_avg = float(bb_width.mean())
    else:
        bb_width_current = 0.04
        bb_width_avg = 0.04

    # 3. Price direction via linear regression slope
    x = np.arange(len(close))
    slope = np.polyfit(x, close, 1)[0]
    slope_pct = slope / close.mean() * 100  # normalized slope

    # 4. ATR ratio: recent vs longer-term
    if "atr" in recent.columns:
        atr_short = float(recent["atr"].tail(10).mean())
        atr_long = float(recent["atr"].mean())
        atr_ratio = atr_short / atr_long if atr_long > 0 else 1.0
    else:
        atr_ratio = 1.0

    # 5. Directional consistency: % of days moving in same direction
    returns = pd.Series(close).pct_change().dropna()
    up_days = (returns > 0).sum()
    down_days = (returns < 0).sum()
    total_days = len(returns)
    direction_consistency = max(up_days, down_days) / total_days if total_days > 0 else 0.5

    # Classification logic
    is_volatile = bb_width_current > bb_width_avg * 1.3 or atr_ratio > 1.4
    is_trending = adx > 25 and direction_consistency > 0.55
    is_strong_trend = adx > 35 and direction_consistency > 0.60

    if is_volatile and not is_strong_trend:
        regime = VOLATILE
        confidence = min((bb_width_current / bb_width_avg - 1) * 2 + atr_ratio - 1, 1.0)
    elif is_trending or is_strong_trend:
        if slope_pct > 0:
            regime = TRENDING_UP
        else:
            regime = TRENDING_DOWN
        confidence = min((adx - 20) / 30, 1.0)  # ADX 20-50 → 0-1
    else:
        regime = RANGING
        confidence = 1.0 - min(adx / 25, 1.0)  # Lower ADX = more confident ranging

    confidence = max(0.0, min(confidence, 1.0))

    return {
        "regime": regime,
        "confidence": round(confidence, 3),
        "metrics": {
            "adx": round(adx, 2),
            "bb_width": round(bb_width_current, 4),
            "bb_width_avg": round(bb_width_avg, 4),
            "slope_pct": round(slope_pct, 4),
            "atr_ratio": round(atr_ratio, 3),
            "direction_consistency": round(direction_consistency, 3),
        },
    }


def get_regime_weight_adjustments(regime: str) -> dict:
    """
    Return weight adjustment multipliers based on detected regime.

    - Trending: increase XGBoost and Supertrend weight, decrease RSI
    - Ranging: increase RSI and MACD (mean reversion), decrease Supertrend
    - Volatile: increase Volume and ATR-based signals, decrease all others slightly
    """
    if regime == TRENDING_UP or regime == TRENDING_DOWN:
        return {
            "xgboost": 1.15,
            "lstm": 1.20,       # LSTM excels at capturing trends
            "supertrend": 1.25,
            "rsi": 0.70,       # RSI less useful in trends
            "macd": 1.10,
            "volume": 1.10,
            "sentiment": 1.0,
            "fundamental": 0.90,
            "macro": 1.0,
        }
    elif regime == VOLATILE:
        return {
            "xgboost": 0.85,    # Models less reliable in volatile markets
            "lstm": 0.80,       # LSTM also less reliable
            "supertrend": 0.80,
            "rsi": 0.90,
            "macd": 0.85,
            "volume": 1.30,     # Volume confirms moves in volatility
            "sentiment": 1.15,  # News-driven in volatile markets
            "fundamental": 1.10,
            "macro": 1.20,
        }
    else:  # RANGING
        return {
            "xgboost": 1.0,
            "lstm": 0.90,
            "supertrend": 0.75,  # Supertrend gives false signals in ranges
            "rsi": 1.30,        # RSI excellent for mean reversion
            "macd": 1.20,
            "volume": 0.90,
            "sentiment": 1.0,
            "fundamental": 1.10,
            "macro": 1.0,
        }


def detect_nifty_regime() -> dict:
    """Detect regime for NIFTY 50 index as a market-wide signal."""
    from data_fetcher import get_stock_df
    from indicators import calculate_all_indicators

    try:
        nifty_df = get_stock_df("^NSEI")
        if nifty_df.empty:
            return {"regime": RANGING, "confidence": 0.0, "metrics": {}}
        indicators_df = calculate_all_indicators(nifty_df)
        if indicators_df.empty:
            return {"regime": RANGING, "confidence": 0.0, "metrics": {}}
        return detect_regime(indicators_df)
    except Exception as e:
        logger.error("Failed to detect NIFTY regime: %s", e)
        return {"regime": RANGING, "confidence": 0.0, "metrics": {}}

"""
Netra — Macro Signals Engine
Fetches global macro indicators that influence Indian market direction:
- Global indices (S&P 500, Dow Jones, Hang Seng)
- Crude oil, Gold prices
- USD/INR exchange rate
- FII/DII flow signals from news
"""

import logging
import time
from typing import Optional

import yfinance as yf
import pandas as pd

import db

logger = logging.getLogger(__name__)

# Cache macro data for 10 minutes
_macro_cache: Optional[dict] = None
_macro_cache_time: float = 0
_MACRO_CACHE_TTL = 600  # 10 minutes

# Global macro tickers
MACRO_TICKERS = {
    "sp500": {"symbol": "^GSPC", "name": "S&P 500"},
    "dow": {"symbol": "^DJI", "name": "Dow Jones"},
    "nasdaq": {"symbol": "^IXIC", "name": "NASDAQ"},
    "hangseng": {"symbol": "^HSI", "name": "Hang Seng"},
    "crude_oil": {"symbol": "CL=F", "name": "Crude Oil (WTI)"},
    "gold": {"symbol": "GC=F", "name": "Gold"},
    "usd_inr": {"symbol": "USDINR=X", "name": "USD/INR"},
    "us10y": {"symbol": "^TNX", "name": "US 10Y Treasury"},
}


def _fetch_ticker_data(symbol: str, period: str = "5d") -> Optional[dict]:
    """Fetch recent price data for a macro ticker."""
    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period=period)

        if hist.empty or len(hist) < 2:
            return None

        current = float(hist["Close"].iloc[-1])
        prev = float(hist["Close"].iloc[-2])
        change = round(current - prev, 2)
        change_pct = round(((current - prev) / prev) * 100, 2)

        # 5-day trend
        first = float(hist["Close"].iloc[0])
        weekly_change_pct = round(((current - first) / first) * 100, 2)

        return {
            "price": round(current, 2),
            "change": change,
            "change_pct": change_pct,
            "weekly_change_pct": weekly_change_pct,
            "high": round(float(hist["High"].max()), 2),
            "low": round(float(hist["Low"].min()), 2),
        }

    except Exception as e:
        logger.warning("Failed to fetch macro ticker %s: %s", symbol, e)
        return None


def fetch_macro_data() -> dict:
    """Fetch all macro indicators. Cached for 10 minutes."""
    global _macro_cache, _macro_cache_time

    now = time.time()
    if _macro_cache and (now - _macro_cache_time) < _MACRO_CACHE_TTL:
        return _macro_cache

    result = {}
    for key, cfg in MACRO_TICKERS.items():
        data = _fetch_ticker_data(cfg["symbol"])
        if data:
            data["name"] = cfg["name"]
            data["symbol"] = cfg["symbol"]
            result[key] = data

    # Save to DB
    db.save_macro_data(result)

    _macro_cache = result
    _macro_cache_time = now
    logger.info("Fetched macro data for %d indicators", len(result))
    return result


def score_macro_environment() -> float:
    """
    Score the overall macro environment on 0-1 scale.
    0.5 = neutral, >0.5 = favorable for Indian equities, <0.5 = unfavorable.

    Factors:
    - Global indices up → bullish for India (positive correlation)
    - Crude oil down → bullish for India (net importer)
    - Gold up → mixed (safe haven demand, but signals risk-off)
    - USD/INR strengthening (INR weakening) → bearish for India
    - US bond yields rising → bearish for emerging markets
    """
    macro = fetch_macro_data()
    if not macro:
        return 0.5  # Neutral fallback

    scores = []

    # S&P 500: positive change → bullish for India
    sp500 = macro.get("sp500")
    if sp500:
        pct = sp500["change_pct"]
        if pct > 1.0:
            scores.append(0.85)
        elif pct > 0:
            scores.append(0.65)
        elif pct > -1.0:
            scores.append(0.4)
        else:
            scores.append(0.2)

    # Dow Jones
    dow = macro.get("dow")
    if dow:
        pct = dow["change_pct"]
        if pct > 1.0:
            scores.append(0.8)
        elif pct > 0:
            scores.append(0.6)
        elif pct > -1.0:
            scores.append(0.4)
        else:
            scores.append(0.25)

    # Crude Oil: DOWN is bullish for India (net importer)
    crude = macro.get("crude_oil")
    if crude:
        pct = crude["change_pct"]
        if pct < -2.0:
            scores.append(0.85)  # Big drop = very bullish
        elif pct < 0:
            scores.append(0.65)
        elif pct < 2.0:
            scores.append(0.4)
        else:
            scores.append(0.2)  # Big rise = bearish

    # USD/INR: INR strengthening (USD/INR falling) = bullish
    usdinr = macro.get("usd_inr")
    if usdinr:
        pct = usdinr["change_pct"]
        if pct < -0.3:
            scores.append(0.8)  # INR strengthening significantly
        elif pct < 0:
            scores.append(0.65)
        elif pct < 0.3:
            scores.append(0.4)
        else:
            scores.append(0.2)  # INR weakening = bearish

    # US 10Y yield: rising yields → bearish for emerging markets
    us10y = macro.get("us10y")
    if us10y:
        pct = us10y["change_pct"]
        if pct < -2.0:
            scores.append(0.8)  # Falling yields = bullish for EM
        elif pct < 0:
            scores.append(0.6)
        elif pct < 2.0:
            scores.append(0.4)
        else:
            scores.append(0.2)  # Rising yields = bearish for EM

    if not scores:
        return 0.5

    return round(sum(scores) / len(scores), 4)


def get_macro_overview() -> dict:
    """Get macro data for API response."""
    macro = fetch_macro_data()
    score = score_macro_environment()

    label = "Favorable"
    if score > 0.65:
        label = "Favorable"
    elif score > 0.5:
        label = "Slightly Favorable"
    elif score > 0.4:
        label = "Slightly Unfavorable"
    else:
        label = "Unfavorable"

    return {
        "indicators": macro,
        "score": score,
        "label": label,
        "count": len(macro),
    }

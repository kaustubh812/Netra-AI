"""
Netra — Fundamental Analysis Engine
Fetches company fundamentals from yfinance and scores them for signal integration.
"""

import logging
import time
from typing import Optional

import yfinance as yf

import db
from config import NIFTY_50_STOCKS

logger = logging.getLogger(__name__)

# Cache fundamentals for 6 hours (slow-moving data)
_fundamentals_cache: dict[str, dict] = {}
_fundamentals_cache_time: float = 0
_FUNDAMENTALS_CACHE_TTL = 6 * 3600  # 6 hours

# Keys to extract from yfinance info
_FUNDAMENTAL_KEYS = [
    "trailingPE", "forwardPE", "priceToBook", "returnOnEquity", "returnOnAssets",
    "marketCap", "enterpriseValue", "debtToEquity", "currentRatio",
    "revenueGrowth", "earningsGrowth", "profitMargins", "operatingMargins",
    "dividendYield", "bookValue", "earningsQuarterlyGrowth", "pegRatio",
    "trailingEps", "forwardEps", "sector", "industry", "beta",
    "fiftyTwoWeekHigh", "fiftyTwoWeekLow",
]


def fetch_fundamentals(symbol: str) -> Optional[dict]:
    """Fetch fundamental data for a single stock from yfinance."""
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info

        if not info or info.get("regularMarketPrice") is None and info.get("trailingPE") is None:
            return None

        data = {"symbol": symbol}
        for key in _FUNDAMENTAL_KEYS:
            val = info.get(key)
            data[key] = val

        return data

    except Exception as e:
        logger.warning("Failed to fetch fundamentals for %s: %s", symbol, e)
        return None


def fetch_all_fundamentals() -> dict[str, dict]:
    """Fetch fundamentals for all NIFTY 50 stocks. Cached for 6 hours."""
    global _fundamentals_cache, _fundamentals_cache_time

    now = time.time()
    if _fundamentals_cache and (now - _fundamentals_cache_time) < _FUNDAMENTALS_CACHE_TTL:
        return _fundamentals_cache

    results = {}
    for symbol in NIFTY_50_STOCKS:
        data = fetch_fundamentals(symbol)
        if data:
            results[symbol] = data
            # Save to DB
            db.save_fundamentals(symbol, data)

    _fundamentals_cache = results
    _fundamentals_cache_time = now
    logger.info("Fetched fundamentals for %d stocks", len(results))
    return results


def score_fundamentals(symbol: str) -> float:
    """
    Score a stock's fundamentals on 0-1 scale for composite signal.
    0.5 = neutral, >0.5 = fundamentally strong, <0.5 = weak.

    Scoring criteria:
    - P/E ratio: Lower is better (vs sector median ~25 for NIFTY)
    - P/B ratio: Lower is better
    - Earnings growth: Higher is better
    - Revenue growth: Higher is better
    - Profit margins: Higher is better
    - Debt/Equity: Lower is better
    - Dividend yield: Higher is better
    """
    data = db.get_fundamentals(symbol)
    if not data:
        return 0.5  # Neutral fallback

    scores = []

    # P/E Score: 0-15 excellent, 15-25 good, 25-40 fair, >40 expensive
    pe = data.get("trailingPE")
    if pe and isinstance(pe, (int, float)) and pe > 0:
        if pe < 15:
            scores.append(0.9)
        elif pe < 25:
            scores.append(0.7)
        elif pe < 40:
            scores.append(0.4)
        else:
            scores.append(0.2)

    # P/B Score: <1 undervalued, 1-3 fair, 3-5 expensive, >5 very expensive
    pb = data.get("priceToBook")
    if pb and isinstance(pb, (int, float)) and pb > 0:
        if pb < 1:
            scores.append(0.9)
        elif pb < 3:
            scores.append(0.7)
        elif pb < 5:
            scores.append(0.4)
        else:
            scores.append(0.2)

    # Earnings Growth: >20% great, 10-20% good, 0-10% ok, <0 bad
    eg = data.get("earningsGrowth")
    if eg is not None and isinstance(eg, (int, float)):
        if eg > 0.20:
            scores.append(0.9)
        elif eg > 0.10:
            scores.append(0.7)
        elif eg > 0:
            scores.append(0.5)
        else:
            scores.append(0.2)

    # Revenue Growth: >15% great, 5-15% good, 0-5% ok, <0 bad
    rg = data.get("revenueGrowth")
    if rg is not None and isinstance(rg, (int, float)):
        if rg > 0.15:
            scores.append(0.85)
        elif rg > 0.05:
            scores.append(0.65)
        elif rg > 0:
            scores.append(0.45)
        else:
            scores.append(0.2)

    # Profit Margins: >20% excellent, 10-20% good, 5-10% ok, <5% weak
    pm = data.get("profitMargins")
    if pm is not None and isinstance(pm, (int, float)):
        if pm > 0.20:
            scores.append(0.85)
        elif pm > 0.10:
            scores.append(0.65)
        elif pm > 0.05:
            scores.append(0.45)
        else:
            scores.append(0.25)

    # Debt/Equity: <30 healthy, 30-80 moderate, 80-150 high, >150 risky
    de = data.get("debtToEquity")
    if de is not None and isinstance(de, (int, float)):
        if de < 30:
            scores.append(0.85)
        elif de < 80:
            scores.append(0.65)
        elif de < 150:
            scores.append(0.4)
        else:
            scores.append(0.2)

    # Dividend Yield: >3% great, 1-3% good, 0.5-1% ok, <0.5% low
    dy = data.get("dividendYield")
    if dy is not None and isinstance(dy, (int, float)):
        if dy > 0.03:
            scores.append(0.8)
        elif dy > 0.01:
            scores.append(0.65)
        elif dy > 0.005:
            scores.append(0.5)
        else:
            scores.append(0.35)

    if not scores:
        return 0.5

    return round(sum(scores) / len(scores), 4)


def get_stock_fundamentals(symbol: str) -> dict:
    """Get fundamentals for API response."""
    data = db.get_fundamentals(symbol)
    score = score_fundamentals(symbol)

    label = "Strong"
    if score > 0.7:
        label = "Strong"
    elif score > 0.55:
        label = "Good"
    elif score > 0.45:
        label = "Average"
    elif score > 0.3:
        label = "Weak"
    else:
        label = "Poor"

    return {
        "symbol": symbol,
        "name": symbol.replace(".NS", ""),
        "fundamentals": data,
        "score": score,
        "label": label,
    }

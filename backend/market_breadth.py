"""
Netra — Market Breadth Engine
Computes breadth indicators from Nifty 50 stock data:
- Advance/Decline counts and ratio
- % of stocks above 20/50/200 DMA
- McClellan Oscillator (19/39 EMA of net advances)
- 52-week high/low counts
- Historical breadth data (20 days) for charting
"""

import logging
import time
from datetime import datetime, timezone
from typing import Optional

import numpy as np
import pandas as pd

import db
from config import NIFTY_50_STOCKS

logger = logging.getLogger(__name__)

# Cache for 10 minutes
_breadth_cache: Optional[dict] = None
_breadth_cache_time: float = 0
_BREADTH_CACHE_TTL = 600


def _ema(values: list, span: int) -> list:
    """Simple EMA calculation."""
    if not values:
        return []
    s = pd.Series(values)
    return s.ewm(span=span, adjust=False).mean().tolist()


def compute_breadth() -> dict:
    """Compute all breadth indicators from stock data."""
    global _breadth_cache, _breadth_cache_time

    now = time.time()
    if _breadth_cache and (now - _breadth_cache_time) < _BREADTH_CACHE_TTL:
        return _breadth_cache

    symbols = NIFTY_50_STOCKS
    total = len(symbols)

    # Collect per-stock data
    advances = 0
    declines = 0
    unchanged = 0
    above_20dma = 0
    above_50dma = 0
    above_200dma = 0
    high_52w = 0
    low_52w = 0

    # Historical data for charts (last 20 trading days)
    daily_advances = []
    daily_declines = []
    daily_above_50 = []
    daily_above_200 = []
    dates = []

    # Get historical price data for all stocks
    all_stock_data = {}
    for sym in symbols:
        try:
            df = db.get_stock_data(sym)
            if df is not None and len(df) >= 5:
                df = df.sort_values("date").reset_index(drop=True)
                all_stock_data[sym] = df.tail(260).reset_index(drop=True)
        except Exception:
            continue

    if not all_stock_data:
        return {"error": "No stock data available", "available": False}

    # Find common recent dates (last 20 trading days)
    # Use the stock with most data as date reference
    ref_sym = max(all_stock_data, key=lambda s: len(all_stock_data[s]))
    ref_dates = all_stock_data[ref_sym]["date"].tolist()[-20:]

    # Compute daily breadth for each date
    for date_val in ref_dates:
        day_adv = 0
        day_dec = 0
        day_a50 = 0
        day_a200 = 0

        for sym, df in all_stock_data.items():
            date_mask = df["date"] <= date_val
            subset = df[date_mask]
            if len(subset) < 2:
                continue

            close = float(subset["close"].iloc[-1])
            prev_close = float(subset["close"].iloc[-2])

            # Advance/Decline
            if close > prev_close:
                day_adv += 1
            elif close < prev_close:
                day_dec += 1

            # Above 50 DMA
            if len(subset) >= 50:
                ma50 = float(subset["close"].tail(50).mean())
                if close > ma50:
                    day_a50 += 1

            # Above 200 DMA
            if len(subset) >= 200:
                ma200 = float(subset["close"].tail(200).mean())
                if close > ma200:
                    day_a200 += 1

        daily_advances.append(day_adv)
        daily_declines.append(day_dec)
        daily_above_50.append(day_a50)
        daily_above_200.append(day_a200)
        dates.append(str(date_val))

    # Current day stats (latest date)
    for sym, df in all_stock_data.items():
        if len(df) < 2:
            continue

        close = float(df["close"].iloc[-1])
        prev_close = float(df["close"].iloc[-2])

        if close > prev_close:
            advances += 1
        elif close < prev_close:
            declines += 1
        else:
            unchanged += 1

        # Moving averages
        if len(df) >= 20:
            ma20 = float(df["close"].tail(20).mean())
            if close > ma20:
                above_20dma += 1

        if len(df) >= 50:
            ma50 = float(df["close"].tail(50).mean())
            if close > ma50:
                above_50dma += 1

        if len(df) >= 200:
            ma200 = float(df["close"].tail(200).mean())
            if close > ma200:
                above_200dma += 1

        # 52-week high/low
        if len(df) >= 252:
            year_data = df["close"].tail(252)
            yr_high = float(year_data.max())
            yr_low = float(year_data.min())
            if close >= yr_high * 0.98:  # within 2% of 52w high
                high_52w += 1
            if close <= yr_low * 1.02:  # within 2% of 52w low
                low_52w += 1

    # McClellan Oscillator: EMA(19) - EMA(39) of net advances
    net_advances = [a - d for a, d in zip(daily_advances, daily_declines)]
    ema19 = _ema(net_advances, 19)
    ema39 = _ema(net_advances, 39)
    mcclellan = [round(e19 - e39, 2) for e19, e39 in zip(ema19, ema39)]

    # A/D ratio
    ad_ratio = round(advances / declines, 2) if declines > 0 else advances

    result = {
        "available": True,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "total_stocks": total,
        "current": {
            "advances": advances,
            "declines": declines,
            "unchanged": unchanged,
            "ad_ratio": ad_ratio,
            "above_20dma": above_20dma,
            "above_50dma": above_50dma,
            "above_200dma": above_200dma,
            "above_20dma_pct": round(above_20dma / total * 100, 1) if total else 0,
            "above_50dma_pct": round(above_50dma / total * 100, 1) if total else 0,
            "above_200dma_pct": round(above_200dma / total * 100, 1) if total else 0,
            "high_52w": high_52w,
            "low_52w": low_52w,
        },
        "history": {
            "dates": dates,
            "advances": daily_advances,
            "declines": daily_declines,
            "net_advances": net_advances,
            "above_50dma": daily_above_50,
            "above_200dma": daily_above_200,
            "mcclellan": mcclellan,
        },
        "mcclellan_current": mcclellan[-1] if mcclellan else 0,
        "breadth_signal": _interpret_breadth(
            ad_ratio, above_50dma / total if total else 0, mcclellan[-1] if mcclellan else 0
        ),
    }

    _breadth_cache = result
    _breadth_cache_time = time.time()
    return result


def _interpret_breadth(ad_ratio: float, pct_above_50: float, mcclellan: float) -> str:
    """Interpret breadth as bullish/bearish/neutral."""
    score = 0
    if ad_ratio > 1.5:
        score += 2
    elif ad_ratio > 1:
        score += 1
    elif ad_ratio < 0.67:
        score -= 2
    elif ad_ratio < 1:
        score -= 1

    if pct_above_50 > 0.7:
        score += 2
    elif pct_above_50 > 0.5:
        score += 1
    elif pct_above_50 < 0.3:
        score -= 2
    elif pct_above_50 < 0.5:
        score -= 1

    if mcclellan > 50:
        score += 1
    elif mcclellan < -50:
        score -= 1

    if score >= 3:
        return "strongly_bullish"
    elif score >= 1:
        return "bullish"
    elif score <= -3:
        return "strongly_bearish"
    elif score <= -1:
        return "bearish"
    return "neutral"

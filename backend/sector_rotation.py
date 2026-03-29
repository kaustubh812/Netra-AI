"""
Netra — Sector Rotation Model
Tracks sector momentum to identify which sectors are leading/lagging.
Adjusts stock signals based on their sector's relative strength.
"""

import logging
from typing import Dict, Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# NIFTY 50 sector classification
SECTOR_MAP: Dict[str, str] = {
    "RELIANCE.NS": "Energy",
    "TCS.NS": "IT",
    "HDFCBANK.NS": "Banking",
    "INFY.NS": "IT",
    "ICICIBANK.NS": "Banking",
    "SBIN.NS": "Banking",
    "BHARTIARTL.NS": "Telecom",
    "ITC.NS": "FMCG",
    "KOTAKBANK.NS": "Banking",
    "LT.NS": "Infrastructure",
    "HINDUNILVR.NS": "FMCG",
    "AXISBANK.NS": "Banking",
    "BAJFINANCE.NS": "Finance",
    "MARUTI.NS": "Auto",
    "TRENT.NS": "Retail",
    "SUNPHARMA.NS": "Pharma",
    "TITAN.NS": "Consumer",
    "ONGC.NS": "Energy",
    "NTPC.NS": "Power",
    "ADANIENT.NS": "Infrastructure",
    "ADANIPORTS.NS": "Infrastructure",
    "POWERGRID.NS": "Power",
    "M&M.NS": "Auto",
    "ASIANPAINT.NS": "Consumer",
    "NESTLEIND.NS": "FMCG",
    "ULTRACEMCO.NS": "Cement",
    "JSWSTEEL.NS": "Metals",
    "TATASTEEL.NS": "Metals",
    "BAJAJFINSV.NS": "Finance",
    "HCLTECH.NS": "IT",
    "WIPRO.NS": "IT",
    "INDUSINDBK.NS": "Banking",
    "TECHM.NS": "IT",
    "HINDALCO.NS": "Metals",
    "GRASIM.NS": "Cement",
    "DRREDDY.NS": "Pharma",
    "CIPLA.NS": "Pharma",
    "EICHERMOT.NS": "Auto",
    "DIVISLAB.NS": "Pharma",
    "BPCL.NS": "Energy",
    "COALINDIA.NS": "Mining",
    "BRITANNIA.NS": "FMCG",
    "APOLLOHOSP.NS": "Healthcare",
    "TATACONSUM.NS": "FMCG",
    "SBILIFE.NS": "Insurance",
    "HDFCLIFE.NS": "Insurance",
    "BAJAJ-AUTO.NS": "Auto",
    "HEROMOTOCO.NS": "Auto",
    "SHRIRAMFIN.NS": "Finance",
    "LTIM.NS": "IT",
}


def get_sector(symbol: str) -> str:
    """Get sector for a stock symbol."""
    return SECTOR_MAP.get(symbol, "Unknown")


def compute_sector_momentum(lookback_days: int = 20) -> Dict[str, dict]:
    """
    Compute momentum scores for each sector based on average stock performance.

    Returns dict mapping sector → {momentum, rank, stocks_up, stocks_down, avg_return}
    """
    from data_fetcher import get_stock_df

    sector_returns: Dict[str, list] = {}

    for symbol, sector in SECTOR_MAP.items():
        try:
            df = get_stock_df(symbol)
            if df.empty or len(df) < lookback_days + 5:
                continue

            close = df["close"].tail(lookback_days + 1)
            ret = (close.iloc[-1] / close.iloc[0] - 1) * 100  # % return

            if sector not in sector_returns:
                sector_returns[sector] = []
            sector_returns[sector].append({"symbol": symbol, "return": float(ret)})
        except Exception as e:
            logger.debug("Skipping %s for sector momentum: %s", symbol, e)

    # Calculate sector-level metrics
    sector_scores = {}
    for sector, stocks in sector_returns.items():
        returns = [s["return"] for s in stocks]
        avg_return = np.mean(returns)
        stocks_up = sum(1 for r in returns if r > 0)
        stocks_down = sum(1 for r in returns if r <= 0)

        sector_scores[sector] = {
            "avg_return": round(avg_return, 2),
            "stocks_up": stocks_up,
            "stocks_down": stocks_down,
            "total_stocks": len(stocks),
            "breadth": round(stocks_up / len(stocks), 2) if stocks else 0,
        }

    # Rank sectors by average return
    sorted_sectors = sorted(sector_scores.keys(), key=lambda s: sector_scores[s]["avg_return"], reverse=True)
    for rank, sector in enumerate(sorted_sectors, 1):
        sector_scores[sector]["rank"] = rank
        # Momentum score: normalize to 0-1
        total = len(sorted_sectors)
        sector_scores[sector]["momentum_score"] = round(1.0 - (rank - 1) / max(total - 1, 1), 3)

    return sector_scores


def get_sector_adjustment(symbol: str, sector_scores: Optional[Dict] = None) -> float:
    """
    Get a signal adjustment factor for a stock based on its sector momentum.

    Returns a multiplier:
    - Top sectors: 1.05-1.15 (boost)
    - Middle sectors: 1.0 (neutral)
    - Bottom sectors: 0.85-0.95 (penalize)
    """
    if sector_scores is None:
        sector_scores = compute_sector_momentum()

    sector = get_sector(symbol)
    if sector not in sector_scores:
        return 1.0

    score = sector_scores[sector]
    momentum = score.get("momentum_score", 0.5)

    # Map momentum (0-1) to adjustment (0.85-1.15)
    adjustment = 0.85 + momentum * 0.30

    return round(adjustment, 3)


# Cache for sector scores (recomputed periodically)
_sector_cache: Dict = {}
_sector_cache_ts: float = 0


def get_sector_detail(sector_name: str) -> dict:
    """
    Get detailed info for a single sector: stocks with live prices, signals, fundamentals.
    """
    import db
    from live_prices import fetch_live_prices

    # Find stocks in this sector
    sector_stocks = [sym for sym, sec in SECTOR_MAP.items() if sec.lower() == sector_name.lower()]
    if not sector_stocks:
        return {"sector": sector_name, "stocks": [], "count": 0}

    live = fetch_live_prices()
    signals_df = db.get_latest_signals()

    # Sector-level info
    sector_scores = get_cached_sector_scores()
    sector_meta = sector_scores.get(sector_name, {})

    stocks = []
    for sym in sector_stocks:
        stock: dict = {"symbol": sym, "name": sym.replace(".NS", "")}

        # Live price
        lp = live.get(sym)
        if lp:
            stock["ltp"] = lp["price"]
            stock["change_pct"] = lp.get("change_pct")
        else:
            price_df = db.get_stock_data(sym)
            if not price_df.empty:
                stock["ltp"] = float(price_df.iloc[-1]["close"])

        # Signal
        sig_row = signals_df[signals_df["symbol"] == sym] if not signals_df.empty else None
        if sig_row is not None and not sig_row.empty:
            s = sig_row.iloc[0]
            stock["signal"] = s["signal"]
            stock["confidence"] = float(s["confidence"])

        # Fundamentals
        fund = db.get_fundamentals(sym)
        if fund:
            stock["pe"] = fund.get("trailingPE")
            stock["roe"] = fund.get("returnOnEquity")
            stock["market_cap"] = fund.get("marketCap")

        stocks.append(stock)

    return {
        "sector": sector_name,
        "momentum_score": sector_meta.get("momentum_score"),
        "rank": sector_meta.get("rank"),
        "avg_return": sector_meta.get("avg_return"),
        "breadth": sector_meta.get("breadth"),
        "stocks": stocks,
        "count": len(stocks),
    }


def get_cached_sector_scores(ttl: int = 3600) -> Dict:
    """Get sector scores with 1-hour cache."""
    import time
    global _sector_cache, _sector_cache_ts

    now = time.time()
    if now - _sector_cache_ts > ttl or not _sector_cache:
        _sector_cache = compute_sector_momentum()
        _sector_cache_ts = now
        logger.info("Recomputed sector momentum for %d sectors", len(_sector_cache))

    return _sector_cache

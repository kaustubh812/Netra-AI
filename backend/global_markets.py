"""
Netra — Global Markets Engine
Fetches global index data for 10 countries (~13 indices) via yfinance.
Used for the Global Markets page with world map and country cards.
"""

import logging
import time
from datetime import datetime, timezone
from typing import Optional

import yfinance as yf
import pandas as pd

logger = logging.getLogger(__name__)

# Cache for 10 minutes
_gm_cache: Optional[dict] = None
_gm_cache_time: float = 0
_GM_CACHE_TTL = 600

# Country definitions with their indices
COUNTRIES = {
    "IN": {
        "country": "India",
        "indices": [
            {"key": "nifty50", "symbol": "^NSEI", "name": "Nifty 50"},
            {"key": "sensex", "symbol": "^BSESN", "name": "Sensex"},
        ],
    },
    "US": {
        "country": "United States",
        "indices": [
            {"key": "sp500", "symbol": "^GSPC", "name": "S&P 500"},
            {"key": "dowjones", "symbol": "^DJI", "name": "Dow Jones"},
            {"key": "nasdaq", "symbol": "^IXIC", "name": "NASDAQ"},
        ],
    },
    "CN": {
        "country": "China",
        "indices": [
            {"key": "shanghai", "symbol": "000001.SS", "name": "Shanghai Composite"},
        ],
    },
    "JP": {
        "country": "Japan",
        "indices": [
            {"key": "nikkei225", "symbol": "^N225", "name": "Nikkei 225"},
        ],
    },
    "GB": {
        "country": "United Kingdom",
        "indices": [
            {"key": "ftse100", "symbol": "^FTSE", "name": "FTSE 100"},
        ],
    },
    "DE": {
        "country": "Germany",
        "indices": [
            {"key": "dax", "symbol": "^GDAXI", "name": "DAX"},
        ],
    },
    "FR": {
        "country": "France",
        "indices": [
            {"key": "cac40", "symbol": "^FCHI", "name": "CAC 40"},
        ],
    },
    "HK": {
        "country": "Hong Kong",
        "indices": [
            {"key": "hangseng", "symbol": "^HSI", "name": "Hang Seng"},
        ],
    },
    "KR": {
        "country": "South Korea",
        "indices": [
            {"key": "kospi", "symbol": "^KS11", "name": "KOSPI"},
        ],
    },
    "AU": {
        "country": "Australia",
        "indices": [
            {"key": "asx200", "symbol": "^AXJO", "name": "ASX 200"},
        ],
    },
}


def get_global_markets() -> dict:
    """Fetch global market data. Cached for 10 minutes."""
    global _gm_cache, _gm_cache_time

    now = time.time()
    if _gm_cache and (now - _gm_cache_time) < _GM_CACHE_TTL:
        return _gm_cache

    # Collect all symbols for batch download
    all_symbols = []
    symbol_map = {}  # symbol -> (country_code, index_info)
    for code, info in COUNTRIES.items():
        for idx in info["indices"]:
            all_symbols.append(idx["symbol"])
            symbol_map[idx["symbol"]] = (code, idx)

    # Batch download 1 month of daily data
    try:
        data = yf.download(
            all_symbols,
            period="1mo",
            interval="1d",
            progress=False,
            threads=True,
        )
    except Exception as e:
        logger.error("Failed to batch download global markets: %s", e)
        if _gm_cache:
            return _gm_cache
        return {"countries": {}, "count": 0, "timestamp": datetime.now(timezone.utc).isoformat()}

    countries_result = {}

    for code, info in COUNTRIES.items():
        indices_data = []

        for idx in info["indices"]:
            sym = idx["symbol"]
            try:
                # Handle both single and multi-symbol DataFrame formats
                if len(all_symbols) == 1:
                    close_series = data["Close"]
                else:
                    if sym not in data["Close"].columns:
                        continue
                    close_series = data["Close"][sym]

                close_series = close_series.dropna()
                if len(close_series) < 2:
                    continue

                current = float(close_series.iloc[-1])
                prev = float(close_series.iloc[-2])
                change_pct = round(((current - prev) / prev) * 100, 2)

                # Sparkline: last 20 data points
                sparkline_data = close_series.tail(20).tolist()
                sparkline = [round(float(v), 2) for v in sparkline_data]

                indices_data.append({
                    "key": idx["key"],
                    "name": idx["name"],
                    "price": round(current, 2),
                    "change_pct": change_pct,
                    "sparkline": sparkline,
                })

            except Exception as e:
                logger.warning("Failed to process %s (%s): %s", idx["name"], sym, e)
                continue

        if indices_data:
            # Overall change is average of all indices for this country
            overall = round(
                sum(i["change_pct"] for i in indices_data) / len(indices_data), 2
            )
            countries_result[code] = {
                "country": info["country"],
                "flag": code,
                "indices": indices_data,
                "overall_change_pct": overall,
            }

    result = {
        "countries": countries_result,
        "count": len(countries_result),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    _gm_cache = result
    _gm_cache_time = time.time()
    return result

"""
Netra — Live Price Feed
Fetches real-time prices from Yahoo Finance with caching.
Prices refresh every 30 seconds during market hours.
"""

import logging
import time
from datetime import datetime
from typing import Dict, Optional

import pytz
import yfinance as yf

from config import NIFTY_50_STOCKS, INDEX_SYMBOLS, TIMEZONE

logger = logging.getLogger(__name__)
IST = pytz.timezone(TIMEZONE)

# In-memory cache: symbol -> {price, change, change_pct, high, low, volume, timestamp}
_price_cache: Dict[str, dict] = {}
_last_fetch_time: float = 0
_CACHE_TTL = 30  # seconds


def is_market_open() -> bool:
    """Check if the Indian market is currently open."""
    now = datetime.now(IST)
    # Weekday check (Mon=0 to Fri=4)
    if now.weekday() > 4:
        return False
    # Market hours: 9:15 AM to 3:30 PM IST
    market_open = now.replace(hour=9, minute=15, second=0, microsecond=0)
    market_close = now.replace(hour=15, minute=30, second=0, microsecond=0)
    return market_open <= now <= market_close


def fetch_live_prices(symbols: Optional[list] = None) -> Dict[str, dict]:
    """
    Fetch current prices for all symbols using yfinance batch download.
    Uses a 30-second cache to avoid rate limiting.
    """
    global _price_cache, _last_fetch_time

    now = time.time()
    if now - _last_fetch_time < _CACHE_TTL and _price_cache:
        return _price_cache

    if symbols is None:
        symbols = NIFTY_50_STOCKS + INDEX_SYMBOLS

    try:
        # Batch download current day's data for all tickers
        tickers_str = " ".join(symbols)
        data = yf.download(tickers_str, period="2d", interval="1d", group_by="ticker", progress=False, threads=True)

        if data.empty:
            logger.warning("No live data returned from yfinance")
            return _price_cache

        for symbol in symbols:
            try:
                if len(symbols) == 1:
                    ticker_data = data
                else:
                    ticker_data = data[symbol] if symbol in data.columns.get_level_values(0) else None

                if ticker_data is None or ticker_data.empty:
                    continue

                ticker_data = ticker_data.dropna()
                if len(ticker_data) == 0:
                    continue

                latest = ticker_data.iloc[-1]
                prev_close = float(ticker_data.iloc[-2]["Close"]) if len(ticker_data) > 1 else float(latest["Open"])
                current_price = float(latest["Close"])
                change = current_price - prev_close
                change_pct = (change / prev_close) * 100 if prev_close > 0 else 0

                _price_cache[symbol] = {
                    "price": round(current_price, 2),
                    "open": round(float(latest["Open"]), 2),
                    "high": round(float(latest["High"]), 2),
                    "low": round(float(latest["Low"]), 2),
                    "prev_close": round(prev_close, 2),
                    "change": round(change, 2),
                    "change_pct": round(change_pct, 2),
                    "volume": int(latest["Volume"]) if "Volume" in latest.index else 0,
                    "timestamp": datetime.now(IST).isoformat(),
                }
            except Exception as e:
                logger.debug("Error parsing live data for %s: %s", symbol, e)

        _last_fetch_time = now
        logger.info("Live prices updated for %d symbols", len(_price_cache))

    except Exception as e:
        logger.error("Live price fetch failed: %s", e)

    return _price_cache


def get_live_price(symbol: str) -> Optional[dict]:
    """Get live price for a single symbol."""
    prices = fetch_live_prices()
    return prices.get(symbol)

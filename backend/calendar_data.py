"""
Netra — Economic & Earnings Calendar
Provides Indian market economic events and NIFTY 50 earnings dates.
"""

import logging
from datetime import datetime, timedelta
from typing import Optional

import pytz
import yfinance as yf

import db
from config import NIFTY_50_STOCKS, STOCK_NAME_MAP, TIMEZONE

logger = logging.getLogger(__name__)
IST = pytz.timezone(TIMEZONE)

# ─── In-memory cache ─────────────────────────────────────────────────────────
_eco_cache: list[dict] = []
_eco_cache_time: float = 0
_earnings_cache: list[dict] = []
_earnings_cache_time: float = 0
_CACHE_TTL = 3600  # 1 hour


# ─── Static Indian Economic Calendar ─────────────────────────────────────────
# Key recurring Indian economic events (approximate dates)
# These are updated periodically; in production you'd scrape from a source

def _get_recurring_events(year: int, month: int) -> list[dict]:
    """Generate typical Indian economic events for a given month."""
    events = []
    base = datetime(year, month, 1, tzinfo=IST)

    # RBI Policy (bi-monthly: Feb, Apr, Jun, Aug, Oct, Dec)
    if month in (2, 4, 6, 8, 10, 12):
        events.append({
            "date": f"{year}-{month:02d}-07",
            "event": "RBI Monetary Policy Decision",
            "category": "central_bank",
            "importance": "high",
            "country": "IN",
            "previous": None,
            "forecast": None,
            "actual": None,
        })

    # CPI Inflation (released ~12th of each month for prev month)
    events.append({
        "date": f"{year}-{month:02d}-12",
        "event": "India CPI Inflation (YoY)",
        "category": "inflation",
        "importance": "high",
        "country": "IN",
        "previous": None,
        "forecast": None,
        "actual": None,
    })

    # WPI Inflation (~14th)
    events.append({
        "date": f"{year}-{month:02d}-14",
        "event": "India WPI Inflation (YoY)",
        "category": "inflation",
        "importance": "medium",
        "country": "IN",
        "previous": None,
        "forecast": None,
        "actual": None,
    })

    # PMI Manufacturing (~1st of month)
    events.append({
        "date": f"{year}-{month:02d}-01",
        "event": "India Manufacturing PMI",
        "category": "pmi",
        "importance": "high",
        "country": "IN",
        "previous": None,
        "forecast": None,
        "actual": None,
    })

    # PMI Services (~3rd)
    events.append({
        "date": f"{year}-{month:02d}-03",
        "event": "India Services PMI",
        "category": "pmi",
        "importance": "medium",
        "country": "IN",
        "previous": None,
        "forecast": None,
        "actual": None,
    })

    # IIP (Index of Industrial Production, ~12th, 2 months lag)
    events.append({
        "date": f"{year}-{month:02d}-12",
        "event": "India Industrial Production (YoY)",
        "category": "production",
        "importance": "medium",
        "country": "IN",
        "previous": None,
        "forecast": None,
        "actual": None,
    })

    # GDP (quarterly: Feb, May, Aug, Nov)
    if month in (2, 5, 8, 11):
        events.append({
            "date": f"{year}-{month:02d}-28",
            "event": "India GDP Growth Rate (QoQ)",
            "category": "gdp",
            "importance": "high",
            "country": "IN",
            "previous": None,
            "forecast": None,
            "actual": None,
        })

    # Trade Balance (~15th)
    events.append({
        "date": f"{year}-{month:02d}-15",
        "event": "India Trade Balance",
        "category": "trade",
        "importance": "medium",
        "country": "IN",
        "previous": None,
        "forecast": None,
        "actual": None,
    })

    # US Fed Rate Decision (FOMC, ~8 times a year)
    if month in (1, 3, 5, 6, 7, 9, 11, 12):
        events.append({
            "date": f"{year}-{month:02d}-18",
            "event": "US Fed Interest Rate Decision",
            "category": "central_bank",
            "importance": "high",
            "country": "US",
            "previous": None,
            "forecast": None,
            "actual": None,
        })

    # US CPI (~13th)
    events.append({
        "date": f"{year}-{month:02d}-13",
        "event": "US CPI Inflation (YoY)",
        "category": "inflation",
        "importance": "high",
        "country": "US",
        "previous": None,
        "forecast": None,
        "actual": None,
    })

    # US Jobs (~first Friday)
    events.append({
        "date": f"{year}-{month:02d}-05",
        "event": "US Non-Farm Payrolls",
        "category": "employment",
        "importance": "high",
        "country": "US",
        "previous": None,
        "forecast": None,
        "actual": None,
    })

    return events


def get_economic_calendar(months_ahead: int = 2) -> list[dict]:
    """Get economic events for current + next N months."""
    import time
    global _eco_cache, _eco_cache_time

    now = time.time()
    if now - _eco_cache_time < _CACHE_TTL and _eco_cache:
        return _eco_cache

    today = datetime.now(IST)
    events = []

    for offset in range(-1, months_ahead + 1):
        m = today.month + offset
        y = today.year
        while m > 12:
            m -= 12
            y += 1
        while m < 1:
            m += 12
            y -= 1
        events.extend(_get_recurring_events(y, m))

    # Sort by date
    events.sort(key=lambda e: e["date"])

    _eco_cache = events
    _eco_cache_time = now
    return events


def get_earnings_calendar() -> list[dict]:
    """Get upcoming earnings dates for NIFTY 50 stocks using yfinance."""
    import time
    global _earnings_cache, _earnings_cache_time

    now = time.time()
    if now - _earnings_cache_time < _CACHE_TTL and _earnings_cache:
        return _earnings_cache

    earnings = []
    today = datetime.now(IST).date()

    for symbol in NIFTY_50_STOCKS[:50]:  # Only NIFTY 50 core
        try:
            ticker = yf.Ticker(symbol)
            cal = ticker.calendar
            if cal is not None and not (hasattr(cal, 'empty') and cal.empty):
                # cal can be a dict or DataFrame depending on yfinance version
                if isinstance(cal, dict):
                    earnings_date = cal.get("Earnings Date")
                    if earnings_date:
                        if isinstance(earnings_date, list) and len(earnings_date) > 0:
                            ed = str(earnings_date[0])[:10]
                        else:
                            ed = str(earnings_date)[:10]
                        earnings.append({
                            "symbol": symbol,
                            "name": symbol.replace(".NS", ""),
                            "earnings_date": ed,
                            "eps_estimate": cal.get("EPS Estimate"),
                            "eps_actual": cal.get("EPS Actual"),
                            "revenue_estimate": cal.get("Revenue Estimate"),
                            "revenue_actual": cal.get("Revenue Actual"),
                        })
                else:
                    # DataFrame format
                    if "Earnings Date" in cal.columns:
                        for _, row in cal.iterrows():
                            ed = str(row.get("Earnings Date", ""))[:10]
                            if ed:
                                earnings.append({
                                    "symbol": symbol,
                                    "name": symbol.replace(".NS", ""),
                                    "earnings_date": ed,
                                    "eps_estimate": row.get("EPS Estimate"),
                                    "eps_actual": row.get("EPS Actual"),
                                    "revenue_estimate": row.get("Revenue Estimate"),
                                    "revenue_actual": row.get("Revenue Actual"),
                                })
        except Exception as e:
            logger.debug("Could not get earnings calendar for %s: %s", symbol, e)

    earnings.sort(key=lambda e: e.get("earnings_date", "9999"))

    _earnings_cache = earnings
    _earnings_cache_time = now
    return earnings

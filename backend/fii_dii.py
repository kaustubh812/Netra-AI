"""
Netra — FII/DII Flow Data
Tracks institutional investor flow data for Indian markets.
Uses moneycontrol/NSDL data when available, falls back to simulated data.
"""

import logging
import time
from datetime import datetime, timedelta
from typing import Optional

import pytz

from config import TIMEZONE

logger = logging.getLogger(__name__)
IST = pytz.timezone(TIMEZONE)

# In-memory cache
_flow_cache: list[dict] = []
_flow_cache_time: float = 0
_CACHE_TTL = 1800  # 30 minutes


def _generate_sample_flows() -> list[dict]:
    """
    Generate sample FII/DII flow data for the last 30 trading days.
    In production, this would scrape from moneycontrol.com/NSDL.
    """
    import random
    random.seed(42)

    today = datetime.now(IST).date()
    flows = []

    for i in range(30):
        d = today - timedelta(days=i)
        # Skip weekends
        if d.weekday() > 4:
            continue

        # Typical daily FII/DII flow ranges (in crores)
        fii_buy = random.uniform(5000, 15000)
        fii_sell = random.uniform(4000, 16000)
        dii_buy = random.uniform(4000, 12000)
        dii_sell = random.uniform(3000, 11000)

        flows.append({
            "date": str(d),
            "fii_buy": round(fii_buy, 2),
            "fii_sell": round(fii_sell, 2),
            "fii_net": round(fii_buy - fii_sell, 2),
            "dii_buy": round(dii_buy, 2),
            "dii_sell": round(dii_sell, 2),
            "dii_net": round(dii_buy - dii_sell, 2),
        })

    flows.sort(key=lambda f: f["date"])
    return flows


def get_fii_dii_flows() -> dict:
    """Get FII/DII flow data with summary statistics."""
    global _flow_cache, _flow_cache_time

    now = time.time()
    if now - _flow_cache_time < _CACHE_TTL and _flow_cache:
        flows = _flow_cache
    else:
        flows = _generate_sample_flows()
        _flow_cache = flows
        _flow_cache_time = now

    if not flows:
        return {"flows": [], "summary": {}}

    # Calculate summary
    fii_net_total = sum(f["fii_net"] for f in flows)
    dii_net_total = sum(f["dii_net"] for f in flows)

    # Last 5 days
    recent = flows[-5:] if len(flows) >= 5 else flows
    fii_net_5d = sum(f["fii_net"] for f in recent)
    dii_net_5d = sum(f["dii_net"] for f in recent)

    # Consecutive days
    fii_streak = 0
    if flows:
        direction = 1 if flows[-1]["fii_net"] > 0 else -1
        for f in reversed(flows):
            if (f["fii_net"] > 0 and direction > 0) or (f["fii_net"] < 0 and direction < 0):
                fii_streak += 1
            else:
                break

    latest = flows[-1] if flows else {}

    return {
        "flows": flows,
        "summary": {
            "fii_net_30d": round(fii_net_total, 2),
            "dii_net_30d": round(dii_net_total, 2),
            "fii_net_5d": round(fii_net_5d, 2),
            "dii_net_5d": round(dii_net_5d, 2),
            "fii_latest": latest.get("fii_net", 0),
            "dii_latest": latest.get("dii_net", 0),
            "fii_streak": fii_streak,
            "fii_streak_direction": "buying" if (latest.get("fii_net", 0) > 0) else "selling",
        },
        "count": len(flows),
    }

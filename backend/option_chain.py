"""
Netra — Option Chain & Sentiment
Fetches NIFTY option chain data from NSE for PCR and max pain analysis.
Uses multiple approaches: NSE API, yfinance options, and India VIX fallback.
"""

import logging
import time
from typing import Optional

import requests
import yfinance as yf

logger = logging.getLogger(__name__)

NSE_BASE_URL = "https://www.nseindia.com"

# Headers to mimic a browser visit
NSE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": "https://www.nseindia.com/option-chain",
    "Connection": "keep-alive",
}

# Cache sentiment data for 5 minutes
_sentiment_cache: Optional[dict] = None
_sentiment_cache_time: float = 0
_SENTIMENT_CACHE_TTL = 300  # 5 minutes


def _fetch_nse_option_chain(symbol: str = "NIFTY") -> Optional[dict]:
    """Try fetching from NSE API directly."""
    try:
        session = requests.Session()
        session.headers.update(NSE_HEADERS)

        # Step 1: Visit main page to get cookies
        session.get(NSE_BASE_URL, timeout=10)
        time.sleep(1)

        # Step 2: Visit option chain page
        session.get("https://www.nseindia.com/option-chain", timeout=10)
        time.sleep(0.5)

        # Step 3: Fetch the API
        url = f"https://www.nseindia.com/api/option-chain-indices?symbol={symbol}"
        response = session.get(url, timeout=15)

        if response.status_code != 200:
            logger.debug("NSE API returned status %d", response.status_code)
            return None

        data = response.json()
        records = data.get("records", {})
        option_data = records.get("data", [])

        if not option_data:
            return None

        total_call_oi = 0
        total_put_oi = 0
        strike_data = []

        for item in option_data:
            strike = item.get("strikePrice", 0)
            call_oi = item.get("CE", {}).get("openInterest", 0) or 0
            put_oi = item.get("PE", {}).get("openInterest", 0) or 0
            total_call_oi += call_oi
            total_put_oi += put_oi
            strike_data.append({"strike": strike, "call_oi": call_oi, "put_oi": put_oi})

        pcr = total_put_oi / total_call_oi if total_call_oi > 0 else 0
        max_pain = _calculate_max_pain(strike_data)
        underlying = records.get("underlyingValue", 0)

        return {
            "pcr": round(pcr, 4),
            "total_call_oi": total_call_oi,
            "total_put_oi": total_put_oi,
            "max_pain": max_pain,
            "underlying_value": underlying,
            "source": "NSE",
        }

    except Exception as e:
        logger.debug("NSE option chain fetch failed: %s", e)
        return None


def _fetch_vix_sentiment() -> Optional[dict]:
    """
    Fallback: Use India VIX from yfinance to derive market sentiment.
    India VIX (^INDIAVIX) measures market fear/greed.
    VIX < 13: Low fear (bullish), 13-20: Normal, > 20: High fear (bearish)
    Also estimate PCR from VIX using empirical relationship.
    """
    try:
        vix = yf.Ticker("^INDIAVIX")
        hist = vix.history(period="5d")

        if hist.empty:
            return None

        current_vix = float(hist["Close"].iloc[-1])
        prev_vix = float(hist["Close"].iloc[-2]) if len(hist) > 1 else current_vix

        # Estimate PCR from VIX (empirical: higher VIX → more put buying → higher PCR)
        # Typical range: VIX 10-30 maps to PCR 0.6-1.5
        estimated_pcr = round(0.4 + (current_vix / 30.0), 4)
        estimated_pcr = min(max(estimated_pcr, 0.3), 2.0)

        return {
            "pcr": estimated_pcr,
            "total_call_oi": None,
            "total_put_oi": None,
            "max_pain": None,
            "vix": round(current_vix, 2),
            "vix_change": round(current_vix - prev_vix, 2),
            "source": "VIX",
        }

    except Exception as e:
        logger.debug("VIX fetch failed: %s", e)
        return None


def _calculate_max_pain(strike_data: list) -> float:
    """Calculate max pain strike price."""
    if not strike_data:
        return 0

    min_pain = float("inf")
    max_pain_strike = 0

    for target_strike in [d["strike"] for d in strike_data]:
        total_pain = 0
        for d in strike_data:
            if target_strike > d["strike"]:
                total_pain += (target_strike - d["strike"]) * d["call_oi"]
            if target_strike < d["strike"]:
                total_pain += (d["strike"] - target_strike) * d["put_oi"]
        if total_pain < min_pain:
            min_pain = total_pain
            max_pain_strike = target_strike

    return max_pain_strike


def _interpret_pcr(pcr: float) -> str:
    """Interpret PCR value for market sentiment."""
    if pcr > 1.2:
        return "Bullish (high put writing = strong support)"
    elif pcr > 0.8:
        return "Neutral"
    elif pcr > 0.5:
        return "Slightly Bearish"
    else:
        return "Bearish (high call writing = resistance)"


def _interpret_vix(vix: float) -> str:
    """Interpret India VIX level."""
    if vix < 13:
        return "Low volatility (complacent/bullish)"
    elif vix < 18:
        return "Normal volatility"
    elif vix < 25:
        return "Elevated volatility (cautious)"
    else:
        return "High volatility (fear/bearish)"


def get_market_sentiment() -> dict:
    """
    Get market sentiment using best available data source.
    Priority: NSE option chain → India VIX fallback
    Results cached for 5 minutes.
    """
    global _sentiment_cache, _sentiment_cache_time

    now = time.time()
    if _sentiment_cache and (now - _sentiment_cache_time) < _SENTIMENT_CACHE_TTL:
        return _sentiment_cache

    # Try NSE option chain first
    nse_data = _fetch_nse_option_chain("NIFTY")
    if nse_data:
        result = {
            "pcr": nse_data["pcr"],
            "pcr_interpretation": _interpret_pcr(nse_data["pcr"]),
            "max_pain": nse_data["max_pain"],
            "total_call_oi": nse_data["total_call_oi"],
            "total_put_oi": nse_data["total_put_oi"],
            "source": "NSE Option Chain",
            "available": True,
        }
        _sentiment_cache = result
        _sentiment_cache_time = now
        logger.info("Sentiment from NSE: PCR=%.4f", nse_data["pcr"])
        return result

    # Fallback: India VIX
    vix_data = _fetch_vix_sentiment()
    if vix_data:
        result = {
            "pcr": vix_data["pcr"],
            "pcr_interpretation": _interpret_pcr(vix_data["pcr"]),
            "max_pain": None,
            "vix": vix_data["vix"],
            "vix_change": vix_data["vix_change"],
            "vix_interpretation": _interpret_vix(vix_data["vix"]),
            "source": "India VIX (estimated)",
            "available": True,
        }
        _sentiment_cache = result
        _sentiment_cache_time = now
        logger.info("Sentiment from VIX: %.2f, estimated PCR=%.4f", vix_data["vix"], vix_data["pcr"])
        return result

    # All sources failed
    result = {
        "pcr": None,
        "pcr_interpretation": "Data unavailable",
        "max_pain": None,
        "source": None,
        "available": False,
    }
    _sentiment_cache = result
    _sentiment_cache_time = now
    return result

"""
Netra — Option Chain & Sentiment
Fetches NIFTY option chain data from NSE for PCR and max pain analysis.
Uses multiple approaches: NSE API, yfinance options, and India VIX fallback.
Also provides full option chain viewer with Black-Scholes Greeks.
"""

import logging
import math
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


# ─── Full Option Chain + Greeks ─────────────────────────────────────────────

# Cache for full option chain (5 minutes)
_chain_cache: dict[str, dict] = {}
_chain_cache_time: dict[str, float] = {}
_CHAIN_CACHE_TTL = 300


def _norm_cdf(x: float) -> float:
    """Rational approximation for cumulative normal distribution."""
    a1, a2, a3, a4, a5 = 0.254829592, -0.284496736, 1.421413741, -1.453152027, 1.061405429
    p = 0.3275911
    sign = 1.0 if x >= 0 else -1.0
    x = abs(x) / math.sqrt(2.0)
    t = 1.0 / (1.0 + p * x)
    y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * math.exp(-x * x)
    return 0.5 * (1.0 + sign * y)


def _norm_pdf(x: float) -> float:
    """Standard normal PDF."""
    return math.exp(-0.5 * x * x) / math.sqrt(2.0 * math.pi)


def calculate_greeks(S: float, K: float, T: float, r: float, sigma: float,
                     opt_type: str = "CE") -> dict:
    """
    Black-Scholes Greeks calculator.
    S=spot, K=strike, T=time to expiry (years), r=risk-free rate, sigma=IV.
    """
    if T <= 0 or sigma <= 0 or S <= 0 or K <= 0:
        return {"delta": 0, "gamma": 0, "theta": 0, "vega": 0}

    sqrt_T = math.sqrt(T)
    d1 = (math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrt_T)
    d2 = d1 - sigma * sqrt_T

    if opt_type == "CE":
        delta = round(_norm_cdf(d1), 4)
        theta = round((-S * _norm_pdf(d1) * sigma / (2 * sqrt_T)
                       - r * K * math.exp(-r * T) * _norm_cdf(d2)) / 365, 2)
    else:
        delta = round(_norm_cdf(d1) - 1, 4)
        theta = round((-S * _norm_pdf(d1) * sigma / (2 * sqrt_T)
                       + r * K * math.exp(-r * T) * _norm_cdf(-d2)) / 365, 2)

    gamma = round(_norm_pdf(d1) / (S * sigma * sqrt_T), 6)
    vega = round(S * _norm_pdf(d1) * sqrt_T / 100, 2)

    return {"delta": delta, "gamma": gamma, "theta": theta, "vega": vega}


def _bs_price(S: float, K: float, T: float, r: float, sigma: float, opt_type: str = "CE") -> float:
    """Black-Scholes option price."""
    if T <= 0 or sigma <= 0:
        return max(0, (S - K) if opt_type == "CE" else (K - S))
    sqrt_T = math.sqrt(T)
    d1 = (math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrt_T)
    d2 = d1 - sigma * sqrt_T
    if opt_type == "CE":
        return S * _norm_cdf(d1) - K * math.exp(-r * T) * _norm_cdf(d2)
    else:
        return K * math.exp(-r * T) * _norm_cdf(-d2) - S * _norm_cdf(-d1)


def _fetch_spot_price(symbol: str) -> Optional[float]:
    """Get spot price from NSE market status API (which reliably works)."""
    try:
        session = requests.Session()
        session.headers.update(NSE_HEADERS)
        session.get("https://www.nseindia.com/option-chain", timeout=10)
        time.sleep(0.5)
        session.headers.update({"Accept": "application/json", "Referer": "https://www.nseindia.com/"})
        r = session.get("https://www.nseindia.com/api/marketStatus", timeout=10)
        if r.status_code == 200:
            data = r.json()
            for mkt in data.get("marketState", []):
                idx = mkt.get("index", "")
                if symbol == "NIFTY" and idx == "NIFTY 50":
                    return float(mkt["last"])
                if symbol == "BANKNIFTY" and idx == "NIFTY BANK":
                    return float(mkt["last"])
                if symbol == "NIFTY" and "NIFTY 50" in idx:
                    return float(mkt["last"])
    except Exception as e:
        logger.debug("Market status fetch failed: %s", e)

    # Fallback: yfinance
    try:
        ticker_map = {"NIFTY": "^NSEI", "BANKNIFTY": "^NSEBANK"}
        t = yf.Ticker(ticker_map.get(symbol, f"^{symbol}"))
        hist = t.history(period="1d")
        if not hist.empty:
            return float(hist["Close"].iloc[-1])
    except Exception:
        pass
    return None


def _fetch_vix_value() -> float:
    """Get India VIX value, default 15 if unavailable."""
    try:
        vix = yf.Ticker("^INDIAVIX")
        hist = vix.history(period="5d")
        if not hist.empty:
            return float(hist["Close"].iloc[-1])
    except Exception:
        pass
    return 15.0


def _generate_synthetic_chain(symbol: str, spot: float, vix: float) -> dict:
    """
    Generate a synthetic option chain using Black-Scholes pricing.
    Uses real spot price + VIX for realistic prices and Greeks.
    OI is modeled with a bell-curve distribution around ATM.
    """
    import random
    from datetime import datetime, timedelta

    sigma = vix / 100.0  # VIX to decimal volatility
    r = 0.07  # RBI repo rate

    # Generate weekly expiries (next 4 Thursdays)
    today = datetime.now()
    expiry_dates = []
    d = today
    for _ in range(30):
        d += timedelta(days=1)
        if d.weekday() == 3:  # Thursday
            expiry_dates.append(d.strftime("%d-%b-%Y"))
            if len(expiry_dates) >= 4:
                break

    # Use first expiry
    expiry = expiry_dates[0] if expiry_dates else (today + timedelta(days=7)).strftime("%d-%b-%Y")
    try:
        exp_dt = datetime.strptime(expiry, "%d-%b-%Y")
        T = max((exp_dt - today).days, 1) / 365.0
    except Exception:
        T = 7 / 365.0

    # Strike interval: NIFTY=50, BANKNIFTY=100
    strike_gap = 100 if symbol == "BANKNIFTY" else 50
    atm_strike = round(spot / strike_gap) * strike_gap

    # Generate ±20 strikes around ATM
    num_strikes = 20
    strikes = []
    total_call_oi = 0
    total_put_oi = 0
    strike_pain_data = []

    # Seed with consistent values per session (so refresh doesn't wildly change)
    random.seed(int(spot / 100))

    for i in range(-num_strikes, num_strikes + 1):
        K = atm_strike + i * strike_gap
        if K <= 0:
            continue

        # IV smile: higher IV for OTM options
        distance = abs(K - spot) / spot
        iv_adj = sigma * (1.0 + 0.5 * distance)  # Simple smile

        # BS prices
        call_price = round(_bs_price(spot, K, T, r, iv_adj, "CE"), 2)
        put_price = round(_bs_price(spot, K, T, r, iv_adj, "PE"), 2)

        # Greeks
        call_greeks = calculate_greeks(spot, K, T, r, iv_adj, "CE")
        put_greeks = calculate_greeks(spot, K, T, r, iv_adj, "PE")

        # Synthetic OI: bell curve centered slightly above ATM for calls,
        # slightly below for puts (realistic distribution)
        oi_base = 50000
        call_oi_center = atm_strike + 2 * strike_gap
        put_oi_center = atm_strike - 2 * strike_gap
        call_oi = max(500, int(oi_base * math.exp(-0.5 * ((K - call_oi_center) / (5 * strike_gap)) ** 2)
                                + random.randint(-2000, 2000)))
        put_oi = max(500, int(oi_base * math.exp(-0.5 * ((K - put_oi_center) / (5 * strike_gap)) ** 2)
                               + random.randint(-2000, 2000)))

        total_call_oi += call_oi
        total_put_oi += put_oi
        strike_pain_data.append({"strike": K, "call_oi": call_oi, "put_oi": put_oi})

        strikes.append({
            "strike": K,
            "call_oi": call_oi,
            "call_change_oi": random.randint(-5000, 5000),
            "call_ltp": call_price,
            "call_iv": round(iv_adj * 100, 2),
            "call_delta": call_greeks["delta"],
            "call_gamma": call_greeks["gamma"],
            "call_theta": call_greeks["theta"],
            "call_vega": call_greeks["vega"],
            "put_oi": put_oi,
            "put_change_oi": random.randint(-5000, 5000),
            "put_ltp": put_price,
            "put_iv": round(iv_adj * 100, 2),
            "put_delta": put_greeks["delta"],
            "put_gamma": put_greeks["gamma"],
            "put_theta": put_greeks["theta"],
            "put_vega": put_greeks["vega"],
        })

    pcr = total_put_oi / total_call_oi if total_call_oi > 0 else 0
    max_pain = _calculate_max_pain(strike_pain_data)

    return {
        "symbol": symbol,
        "underlying": round(spot, 2),
        "expiry": expiry,
        "expiry_dates": expiry_dates,
        "strikes": strikes,
        "pcr": round(pcr, 4),
        "max_pain": max_pain,
        "atm_strike": atm_strike,
        "total_call_oi": total_call_oi,
        "total_put_oi": total_put_oi,
        "source": "Synthetic (Black-Scholes)",
    }


def _try_nse_chain(symbol: str, expiry: Optional[str]) -> Optional[dict]:
    """Try fetching real option chain from NSE. Returns None if blocked."""
    try:
        session = requests.Session()
        session.headers.update(NSE_HEADERS)
        session.get(NSE_BASE_URL, timeout=10)
        time.sleep(1)
        session.get("https://www.nseindia.com/option-chain", timeout=10)
        time.sleep(0.5)

        url = f"https://www.nseindia.com/api/option-chain-indices?symbol={symbol}"
        response = session.get(url, timeout=15)
        if response.status_code != 200:
            return None

        data = response.json()
        records = data.get("records", {})
        option_data = records.get("data", [])
        expiry_dates = records.get("expiryDates", [])
        underlying = records.get("underlyingValue", 0)

        if not option_data or not underlying:
            return None

        if expiry:
            option_data = [d for d in option_data if d.get("expiryDate") == expiry]
        else:
            if expiry_dates:
                nearest = expiry_dates[0]
                option_data = [d for d in option_data if d.get("expiryDate") == nearest]
                expiry = nearest

        from datetime import datetime as dt
        try:
            exp_dt = dt.strptime(expiry, "%d-%b-%Y") if expiry else dt.now()
            T = max((exp_dt - dt.now()).days, 1) / 365.0
        except Exception:
            T = 7 / 365.0

        r = 0.07
        strikes = []
        total_call_oi = 0
        total_put_oi = 0
        strike_pain_data = []

        for item in option_data:
            strike = item.get("strikePrice", 0)
            ce = item.get("CE", {})
            pe = item.get("PE", {})
            call_oi = ce.get("openInterest", 0) or 0
            put_oi = pe.get("openInterest", 0) or 0
            call_iv = ce.get("impliedVolatility", 0) or 0
            put_iv = pe.get("impliedVolatility", 0) or 0
            total_call_oi += call_oi
            total_put_oi += put_oi
            strike_pain_data.append({"strike": strike, "call_oi": call_oi, "put_oi": put_oi})

            call_greeks = calculate_greeks(underlying, strike, T, r, call_iv / 100, "CE") if call_iv > 0 else {}
            put_greeks = calculate_greeks(underlying, strike, T, r, put_iv / 100, "PE") if put_iv > 0 else {}

            strikes.append({
                "strike": strike,
                "call_oi": call_oi,
                "call_change_oi": ce.get("changeinOpenInterest", 0) or 0,
                "call_ltp": ce.get("lastPrice", 0) or 0,
                "call_iv": call_iv,
                "call_delta": call_greeks.get("delta", 0),
                "call_gamma": call_greeks.get("gamma", 0),
                "call_theta": call_greeks.get("theta", 0),
                "call_vega": call_greeks.get("vega", 0),
                "put_oi": put_oi,
                "put_change_oi": pe.get("changeinOpenInterest", 0) or 0,
                "put_ltp": pe.get("lastPrice", 0) or 0,
                "put_iv": put_iv,
                "put_delta": put_greeks.get("delta", 0),
                "put_gamma": put_greeks.get("gamma", 0),
                "put_theta": put_greeks.get("theta", 0),
                "put_vega": put_greeks.get("vega", 0),
            })

        pcr = total_put_oi / total_call_oi if total_call_oi > 0 else 0
        max_pain = _calculate_max_pain(strike_pain_data)
        atm_strike = min(strikes, key=lambda s: abs(s["strike"] - underlying))["strike"] if strikes else 0

        return {
            "symbol": symbol,
            "underlying": underlying,
            "expiry": expiry,
            "expiry_dates": expiry_dates,
            "strikes": strikes,
            "pcr": round(pcr, 4),
            "max_pain": max_pain,
            "atm_strike": atm_strike,
            "total_call_oi": total_call_oi,
            "total_put_oi": total_put_oi,
            "source": "NSE",
        }
    except Exception as e:
        logger.debug("NSE chain fetch failed: %s", e)
        return None


def get_full_option_chain(symbol: str = "NIFTY", expiry: Optional[str] = None) -> Optional[dict]:
    """
    Get full option chain with Greeks.
    Tries NSE API first, falls back to synthetic Black-Scholes chain
    using real spot price (from NSE market status) + India VIX.
    """
    now = time.time()
    cache_key = f"{symbol}_{expiry or 'default'}"
    if cache_key in _chain_cache and (now - _chain_cache_time.get(cache_key, 0)) < _CHAIN_CACHE_TTL:
        return _chain_cache[cache_key]

    # Try real NSE data first
    result = _try_nse_chain(symbol, expiry)
    if result:
        logger.info("Option chain from NSE for %s", symbol)
        _chain_cache[cache_key] = result
        _chain_cache_time[cache_key] = now
        return result

    # Fallback: synthetic chain from real spot + VIX
    spot = _fetch_spot_price(symbol)
    if not spot:
        logger.warning("Cannot get spot price for %s — option chain unavailable", symbol)
        return None

    vix = _fetch_vix_value()
    logger.info("Generating synthetic chain for %s: spot=%.2f, VIX=%.2f", symbol, spot, vix)
    result = _generate_synthetic_chain(symbol, spot, vix)

    _chain_cache[cache_key] = result
    _chain_cache_time[cache_key] = now
    return result

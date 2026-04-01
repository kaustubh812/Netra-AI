"""
Netra — Anomaly Detection Engine
Scans Nifty 50 stocks for unusual activity:
- Volume spikes (>2.5 std devs above 20-day mean)
- Price moves (>2.5 std devs from recent range)
- RSI extremes (sudden jump to overbought/oversold)
- 52-week breakouts (new highs/lows)
Returns anomalies sorted by severity.
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
_anomaly_cache: Optional[dict] = None
_anomaly_cache_time: float = 0
_ANOMALY_CACHE_TTL = 600

ANOMALY_TYPES = {
    "volume_spike": {"label": "Volume Spike", "icon": "volume"},
    "price_surge": {"label": "Price Surge", "icon": "up"},
    "price_drop": {"label": "Price Drop", "icon": "down"},
    "rsi_extreme_high": {"label": "RSI Overbought", "icon": "up"},
    "rsi_extreme_low": {"label": "RSI Oversold", "icon": "down"},
    "breakout_high": {"label": "52W High Breakout", "icon": "up"},
    "breakdown_low": {"label": "52W Low Breakdown", "icon": "down"},
}


def _z_score(value: float, mean: float, std: float) -> float:
    """Compute z-score."""
    if std == 0:
        return 0
    return (value - mean) / std


def _severity(z: float) -> int:
    """Map z-score to severity 1-5."""
    az = abs(z)
    if az >= 4:
        return 5
    if az >= 3.5:
        return 4
    if az >= 3:
        return 3
    if az >= 2.5:
        return 2
    return 1


def scan_anomalies() -> dict:
    """Scan all stocks for anomalies. Cached for 10 minutes."""
    global _anomaly_cache, _anomaly_cache_time

    now = time.time()
    if _anomaly_cache and (now - _anomaly_cache_time) < _ANOMALY_CACHE_TTL:
        return _anomaly_cache

    symbols = NIFTY_50_STOCKS
    anomalies = []

    for sym in symbols:
        try:
            df = db.get_stock_data(sym)
            if df is None or len(df) < 25:
                continue

            df = df.sort_values("date").reset_index(drop=True).tail(260).reset_index(drop=True)
            if "close" not in df.columns or "volume" not in df.columns:
                continue

            name = sym.replace(".NS", "")
            latest = df.iloc[-1]
            close = float(latest["close"])
            volume = float(latest["volume"]) if latest["volume"] else 0
            prev_close = float(df.iloc[-2]["close"])
            change_pct = ((close - prev_close) / prev_close) * 100 if prev_close else 0

            # ── Volume Spike ──
            vol_20 = df["volume"].tail(21).iloc[:-1]  # last 20 days excluding today
            if len(vol_20) >= 15 and volume > 0:
                vol_mean = float(vol_20.mean())
                vol_std = float(vol_20.std())
                if vol_std > 0:
                    vol_z = _z_score(volume, vol_mean, vol_std)
                    if vol_z >= 2.5:
                        vol_ratio = volume / vol_mean if vol_mean > 0 else 0
                        anomalies.append({
                            "symbol": sym,
                            "name": name,
                            "type": "volume_spike",
                            "severity": _severity(vol_z),
                            "z_score": round(vol_z, 2),
                            "detail": f"{vol_ratio:.1f}x average volume",
                            "value": volume,
                            "change_pct": round(change_pct, 2),
                            "price": close,
                        })

            # ── Price Move ──
            returns_20 = df["close"].pct_change().tail(21).iloc[:-1]
            if len(returns_20) >= 15:
                ret_mean = float(returns_20.mean())
                ret_std = float(returns_20.std())
                today_ret = change_pct / 100
                if ret_std > 0:
                    price_z = _z_score(today_ret, ret_mean, ret_std)
                    if abs(price_z) >= 2.5:
                        atype = "price_surge" if price_z > 0 else "price_drop"
                        anomalies.append({
                            "symbol": sym,
                            "name": name,
                            "type": atype,
                            "severity": _severity(price_z),
                            "z_score": round(abs(price_z), 2),
                            "detail": f"{change_pct:+.2f}% move",
                            "value": close,
                            "change_pct": round(change_pct, 2),
                            "price": close,
                        })

            # ── RSI Extreme ──
            if "rsi" in df.columns or len(df) >= 20:
                # Compute RSI from close prices
                delta = df["close"].diff()
                gain = delta.clip(lower=0)
                loss = (-delta).clip(lower=0)
                avg_gain = gain.rolling(14).mean()
                avg_loss = loss.rolling(14).mean()
                rs = avg_gain / avg_loss.replace(0, np.nan)
                rsi = 100 - (100 / (1 + rs))
                current_rsi = float(rsi.iloc[-1]) if not pd.isna(rsi.iloc[-1]) else None
                prev_rsi = float(rsi.iloc[-2]) if len(rsi) >= 2 and not pd.isna(rsi.iloc[-2]) else None

                if current_rsi is not None and prev_rsi is not None:
                    rsi_change = current_rsi - prev_rsi
                    if current_rsi >= 80 and rsi_change > 5:
                        anomalies.append({
                            "symbol": sym,
                            "name": name,
                            "type": "rsi_extreme_high",
                            "severity": 3 if current_rsi >= 85 else 2,
                            "z_score": round(current_rsi / 10, 2),
                            "detail": f"RSI {current_rsi:.0f} ({rsi_change:+.0f} from prev)",
                            "value": current_rsi,
                            "change_pct": round(change_pct, 2),
                            "price": close,
                        })
                    elif current_rsi <= 20 and rsi_change < -5:
                        anomalies.append({
                            "symbol": sym,
                            "name": name,
                            "type": "rsi_extreme_low",
                            "severity": 3 if current_rsi <= 15 else 2,
                            "z_score": round((100 - current_rsi) / 10, 2),
                            "detail": f"RSI {current_rsi:.0f} ({rsi_change:+.0f} from prev)",
                            "value": current_rsi,
                            "change_pct": round(change_pct, 2),
                            "price": close,
                        })

            # ── 52-Week Breakout ──
            if len(df) >= 252:
                year_high = float(df["high"].tail(252).max()) if "high" in df.columns else float(df["close"].tail(252).max())
                year_low = float(df["low"].tail(252).min()) if "low" in df.columns else float(df["close"].tail(252).min())

                if close >= year_high:
                    anomalies.append({
                        "symbol": sym,
                        "name": name,
                        "type": "breakout_high",
                        "severity": 4,
                        "z_score": 0,
                        "detail": f"New 52-week high: \u20B9{close:,.0f}",
                        "value": close,
                        "change_pct": round(change_pct, 2),
                        "price": close,
                    })
                elif close <= year_low:
                    anomalies.append({
                        "symbol": sym,
                        "name": name,
                        "type": "breakdown_low",
                        "severity": 4,
                        "z_score": 0,
                        "detail": f"New 52-week low: \u20B9{close:,.0f}",
                        "value": close,
                        "change_pct": round(change_pct, 2),
                        "price": close,
                    })

        except Exception as e:
            logger.debug("Anomaly scan failed for %s: %s", sym, e)
            continue

    # Sort by severity descending, then z_score
    anomalies.sort(key=lambda a: (a["severity"], a["z_score"]), reverse=True)

    result = {
        "anomalies": anomalies,
        "count": len(anomalies),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "stocks_scanned": len(symbols),
    }

    _anomaly_cache = result
    _anomaly_cache_time = time.time()
    return result

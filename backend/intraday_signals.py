"""
Netra — Intraday Signal Engine
Generates BUY/SELL/HOLD signals from 5-minute candles using an 8-component
weighted composite: VWAP, ORB, EMA Cross, RSI, MACD, Supertrend, Volume Surge, Daily Bias.
"""

import json
import logging
from datetime import datetime
from typing import Optional

import numpy as np
import pandas as pd
import pytz

from config import (
    NIFTY_50_STOCKS, TIMEZONE,
    INTRADAY_WEIGHT_VWAP, INTRADAY_WEIGHT_ORB, INTRADAY_WEIGHT_EMA_CROSS,
    INTRADAY_WEIGHT_RSI, INTRADAY_WEIGHT_MACD, INTRADAY_WEIGHT_SUPERTREND,
    INTRADAY_WEIGHT_VOLUME_SURGE, INTRADAY_WEIGHT_DAILY_BIAS,
    INTRADAY_BUY_THRESHOLD, INTRADAY_SELL_THRESHOLD,
    INTRADAY_SL_PCT, INTRADAY_TARGET_PCT,
    INTRADAY_BOOST_WINDOWS, INTRADAY_SUPPRESS_WINDOWS,
)
from indicators import calculate_supertrend
import db

logger = logging.getLogger(__name__)
IST = pytz.timezone(TIMEZONE)


# ─── Indicator Calculations on 5m Candles ────────────────────────────────────

def calculate_intraday_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """
    Calculate intraday indicators on a 5m OHLCV DataFrame.
    Expects columns: datetime, open, high, low, close, volume.
    """
    df = df.copy()

    # EMA 9 and 21
    df["ema9"] = df["close"].ewm(span=9, adjust=False).mean()
    df["ema21"] = df["close"].ewm(span=21, adjust=False).mean()

    # RSI 14-period on 5m
    delta = df["close"].diff()
    gain = delta.clip(lower=0)
    loss = (-delta.clip(upper=0))
    avg_gain = gain.ewm(span=14, adjust=False).mean()
    avg_loss = loss.ewm(span=14, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    df["rsi"] = 100 - (100 / (1 + rs))

    # MACD on 5m
    ema12 = df["close"].ewm(span=12, adjust=False).mean()
    ema26 = df["close"].ewm(span=26, adjust=False).mean()
    df["macd"] = ema12 - ema26
    df["macd_signal"] = df["macd"].ewm(span=9, adjust=False).mean()
    df["macd_hist"] = df["macd"] - df["macd_signal"]

    # ATR 14-period
    high_low = df["high"] - df["low"]
    high_close = (df["high"] - df["close"].shift(1)).abs()
    low_close = (df["low"] - df["close"].shift(1)).abs()
    tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
    df["atr"] = tr.ewm(span=14, adjust=False).mean()

    # VWAP — reset daily
    df["date_only"] = pd.to_datetime(df["datetime"]).dt.date
    df["cum_vol"] = df.groupby("date_only")["volume"].cumsum()
    df["cum_vp"] = (df["close"] * df["volume"]).groupby(df["date_only"]).cumsum()
    df["vwap"] = df["cum_vp"] / df["cum_vol"].replace(0, np.nan)

    # Supertrend (period=7, multiplier=2.0 — tighter for intraday)
    st_df = calculate_supertrend(df, period=7, multiplier=2.0)
    df["supertrend"] = st_df["supertrend"]
    df["supertrend_direction"] = st_df["supertrend_direction"]

    # Volume 20-candle SMA
    df["vol_sma20"] = df["volume"].rolling(20).mean()

    # Clean up temp columns
    df.drop(columns=["date_only", "cum_vol", "cum_vp"], inplace=True)

    return df


def compute_orb(df: pd.DataFrame) -> dict:
    """
    Compute Opening Range Breakout levels.
    Uses the first 3 candles (15 minutes: 9:15-9:30) to define ORB high/low.
    """
    today = pd.to_datetime(df["datetime"]).dt.date.iloc[-1]
    today_df = df[pd.to_datetime(df["datetime"]).dt.date == today]

    if len(today_df) < 3:
        return {"orb_high": None, "orb_low": None}

    first_3 = today_df.iloc[:3]
    return {
        "orb_high": float(first_3["high"].max()),
        "orb_low": float(first_3["low"].min()),
    }


def compute_gap(df: pd.DataFrame) -> float:
    """Today's open vs yesterday's close as a percentage."""
    dates = pd.to_datetime(df["datetime"]).dt.date.unique()
    if len(dates) < 2:
        return 0.0
    today = dates[-1]
    yesterday = dates[-2]

    today_df = df[pd.to_datetime(df["datetime"]).dt.date == today]
    yesterday_df = df[pd.to_datetime(df["datetime"]).dt.date == yesterday]

    if today_df.empty or yesterday_df.empty:
        return 0.0

    today_open = float(today_df.iloc[0]["open"])
    yesterday_close = float(yesterday_df.iloc[-1]["close"])

    if yesterday_close == 0:
        return 0.0
    return round(((today_open - yesterday_close) / yesterday_close) * 100, 2)


def get_time_of_day_multiplier() -> float:
    """
    Time-of-day multiplier for signal confidence:
    - Boost (1.1x) during high-activity windows: 9:15-10:30, 14:00-15:15
    - Suppress (0.85x) during lunchtime: 12:30-13:30
    - Normal (1.0x) otherwise
    """
    now = datetime.now(IST)
    current_mins = now.hour * 60 + now.minute

    for sh, sm, eh, em in INTRADAY_BOOST_WINDOWS:
        start = sh * 60 + sm
        end = eh * 60 + em
        if start <= current_mins <= end:
            return 1.1

    for sh, sm, eh, em in INTRADAY_SUPPRESS_WINDOWS:
        start = sh * 60 + sm
        end = eh * 60 + em
        if start <= current_mins <= end:
            return 0.85

    return 1.0


def detect_intraday_regime(df: pd.DataFrame) -> str:
    """
    Simple regime detection on intraday data using 40-candle lookback.
    Returns: 'trending', 'ranging', or 'volatile'
    """
    if len(df) < 40:
        return "ranging"

    recent = df.tail(40)
    close = recent["close"].values
    atr_vals = recent["atr"].dropna().values

    if len(atr_vals) == 0:
        return "ranging"

    # Directional move as % of ATR range
    price_range = close[-1] - close[0]
    avg_atr = np.mean(atr_vals)

    if avg_atr == 0:
        return "ranging"

    directional_strength = abs(price_range) / (avg_atr * len(recent))

    # Volatility: std of returns
    returns = np.diff(close) / close[:-1]
    vol = np.std(returns) * 100

    if vol > 0.5:
        return "volatile"
    elif directional_strength > 0.05:
        return "trending"
    else:
        return "ranging"


# ─── Component Scoring ───────────────────────────────────────────────────────

def _score_vwap(row: pd.Series) -> float:
    """VWAP position: above VWAP = bullish (>0.5), below = bearish (<0.5)."""
    close = row["close"]
    vwap = row.get("vwap")
    if vwap is None or pd.isna(vwap) or vwap == 0:
        return 0.5
    dist_pct = (close - vwap) / vwap
    # Scale: ±1% maps to 0-1 range
    score = 0.5 + (dist_pct / 0.01) * 0.25
    return float(np.clip(score, 0, 1))


def _score_orb(row: pd.Series, orb: dict) -> float:
    """ORB: above high=1.0, below low=0.0, inside=0.5."""
    close = row["close"]
    orb_high = orb.get("orb_high")
    orb_low = orb.get("orb_low")
    if orb_high is None or orb_low is None:
        return 0.5
    if close > orb_high:
        return 1.0
    elif close < orb_low:
        return 0.0
    else:
        return 0.5


def _score_ema_cross(row: pd.Series) -> float:
    """EMA 9/21 cross: EMA9 > EMA21 = bullish."""
    ema9 = row.get("ema9")
    ema21 = row.get("ema21")
    if ema9 is None or ema21 is None or pd.isna(ema9) or pd.isna(ema21) or ema21 == 0:
        return 0.5
    gap_pct = (ema9 - ema21) / ema21
    score = 0.5 + (gap_pct / 0.005) * 0.25
    return float(np.clip(score, 0, 1))


def _score_rsi(row: pd.Series) -> float:
    """RSI on 5m: 30/70 thresholds."""
    rsi = row.get("rsi")
    if rsi is None or pd.isna(rsi):
        return 0.5
    if rsi >= 70:
        return 0.0  # overbought → bearish
    elif rsi <= 30:
        return 1.0  # oversold → bullish
    else:
        # Linear scale: 30→1.0, 50→0.5, 70→0.0
        return float(np.clip(1.0 - (rsi - 30) / 40, 0, 1))


def _score_macd(row: pd.Series) -> float:
    """MACD histogram: positive = bullish."""
    hist = row.get("macd_hist")
    if hist is None or pd.isna(hist):
        return 0.5
    # Normalize: strong signal at ±0.5
    score = 0.5 + (hist / 0.5) * 0.25
    return float(np.clip(score, 0, 1))


def _score_supertrend(row: pd.Series) -> float:
    """Supertrend direction: 1 = bullish, -1 = bearish."""
    direction = row.get("supertrend_direction")
    if direction is None or pd.isna(direction):
        return 0.5
    return 1.0 if direction == 1 else 0.0


def _score_volume_surge(row: pd.Series) -> float:
    """Volume vs 20-candle average: high volume confirms move."""
    vol = row.get("volume", 0)
    avg = row.get("vol_sma20")
    if avg is None or pd.isna(avg) or avg == 0:
        return 0.5
    ratio = vol / avg
    # 2x average = strong, 0.5x = weak
    score = 0.5 + (ratio - 1.0) * 0.25
    return float(np.clip(score, 0, 1))


def _get_daily_bias(symbol: str) -> float:
    """Get existing daily signal composite as alignment score."""
    try:
        signals_df = db.get_latest_signals()
        sig_row = signals_df[signals_df["symbol"] == symbol]
        if not sig_row.empty:
            return float(sig_row.iloc[0]["composite_score"])
    except Exception:
        pass
    return 0.5  # neutral if no daily signal


def _compute_signal_strength(composite: float, signal: str, components: dict,
                              regime: str) -> float:
    """
    Multi-factor signal strength (same approach as daily engine).
    BUY/SELL: 55% base + overshoot bonus + component agreement + regime alignment.
    HOLD: 20-65% based on distance from nearest threshold.
    """
    if signal == "HOLD":
        dist_buy = INTRADAY_BUY_THRESHOLD - composite
        dist_sell = composite - INTRADAY_SELL_THRESHOLD
        nearest = min(dist_buy, dist_sell)
        return max(20, min(65, 20 + nearest * 200))

    # BUY or SELL
    strength = 55.0

    # Overshoot bonus (up to 20%)
    if signal == "BUY":
        overshoot = composite - INTRADAY_BUY_THRESHOLD
    else:
        overshoot = INTRADAY_SELL_THRESHOLD - composite
    strength += min(20, overshoot * 100)

    # Component agreement (up to 15%)
    vals = list(components.values())
    if signal == "BUY":
        agree = sum(1 for v in vals if v > 0.55)
    else:
        agree = sum(1 for v in vals if v < 0.45)
    agreement_pct = agree / max(len(vals), 1)
    strength += agreement_pct * 15

    # Regime alignment (±5%)
    if regime == "trending":
        strength += 5
    elif regime == "volatile":
        strength -= 5

    return max(30, min(95, strength))


# ─── Main Signal Generation ─────────────────────────────────────────────────

def generate_intraday_signal(symbol: str) -> Optional[dict]:
    """
    Generate an intraday trading signal for a stock using 5m candles.
    Returns a signal dict or None if insufficient data.
    """
    # Load 5m candles from DB (last ~500 candles)
    df = db.get_intraday_data(symbol, limit=500)
    if df.empty or len(df) < 30:
        logger.warning("Insufficient intraday data for %s (%d rows)", symbol, len(df))
        return None

    # Calculate indicators
    df = calculate_intraday_indicators(df)

    latest = df.iloc[-1]
    close = float(latest["close"])
    atr = float(latest["atr"]) if not pd.isna(latest.get("atr", np.nan)) else close * 0.003

    # ORB & Gap
    orb = compute_orb(df)
    gap_pct = compute_gap(df)

    # Regime
    regime = detect_intraday_regime(df)

    # ── Score all 8 components ──
    components = {
        "vwap": _score_vwap(latest),
        "orb": _score_orb(latest, orb),
        "ema_cross": _score_ema_cross(latest),
        "rsi": _score_rsi(latest),
        "macd": _score_macd(latest),
        "supertrend": _score_supertrend(latest),
        "volume_surge": _score_volume_surge(latest),
        "daily_bias": _get_daily_bias(symbol),
    }

    # Weighted composite
    weights = {
        "vwap": INTRADAY_WEIGHT_VWAP,
        "orb": INTRADAY_WEIGHT_ORB,
        "ema_cross": INTRADAY_WEIGHT_EMA_CROSS,
        "rsi": INTRADAY_WEIGHT_RSI,
        "macd": INTRADAY_WEIGHT_MACD,
        "supertrend": INTRADAY_WEIGHT_SUPERTREND,
        "volume_surge": INTRADAY_WEIGHT_VOLUME_SURGE,
        "daily_bias": INTRADAY_WEIGHT_DAILY_BIAS,
    }

    composite = sum(components[k] * weights[k] for k in components)
    composite = float(np.clip(composite, 0, 1))

    # Determine signal
    if composite > INTRADAY_BUY_THRESHOLD:
        signal = "BUY"
    elif composite < INTRADAY_SELL_THRESHOLD:
        signal = "SELL"
    else:
        signal = "HOLD"

    # Signal strength with time-of-day multiplier
    tod_mult = get_time_of_day_multiplier()
    strength = _compute_signal_strength(composite, signal, components, regime)
    strength = min(95, strength * tod_mult)

    # SL/Target: max(1.2 × ATR, close × 0.4%) with 1:2 risk-reward
    sl_atr = 1.2 * atr
    sl_pct = close * INTRADAY_SL_PCT
    sl_distance = max(sl_atr, sl_pct)
    target_distance = max(sl_distance * 2, close * INTRADAY_TARGET_PCT)

    if signal == "BUY":
        sl = round(close - sl_distance, 2)
        target = round(close + target_distance, 2)
    elif signal == "SELL":
        sl = round(close + sl_distance, 2)
        target = round(close - target_distance, 2)
    else:
        sl = round(close - sl_distance, 2)
        target = round(close + target_distance, 2)

    dt_str = str(latest["datetime"])

    result = {
        "symbol": symbol,
        "name": symbol.replace(".NS", ""),
        "datetime": dt_str,
        "signal": signal,
        "confidence": round(strength, 1),
        "composite_score": round(composite, 4),
        "entry_price": close,
        "stop_loss": sl,
        "target_price": target,
        "components": {k: round(v, 4) for k, v in components.items()},
        "regime": regime,
        "orb_high": orb.get("orb_high"),
        "orb_low": orb.get("orb_low"),
        "gap_pct": gap_pct,
        "vwap": float(latest["vwap"]) if not pd.isna(latest.get("vwap", np.nan)) else None,
    }

    # Save to DB
    db.save_intraday_signal(
        symbol=symbol,
        dt=dt_str,
        signal=signal,
        confidence=round(strength, 1),
        composite=round(composite, 4),
        entry=close,
        sl=sl,
        target=target,
        components=json.dumps(result["components"]),
        regime=regime,
    )

    return result


def generate_all_intraday_signals() -> list[dict]:
    """Generate intraday signals for all NIFTY 50 stocks."""
    logger.info("Generating intraday signals for %d stocks...", len(NIFTY_50_STOCKS))
    signals = []
    for symbol in NIFTY_50_STOCKS:
        try:
            sig = generate_intraday_signal(symbol)
            if sig:
                signals.append(sig)
        except Exception as e:
            logger.error("Intraday signal generation failed for %s: %s", symbol, e)

    # Sort by confidence descending
    signals.sort(key=lambda s: s["confidence"], reverse=True)
    logger.info("Generated %d intraday signals", len(signals))
    return signals

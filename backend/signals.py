"""
Netra — Signal Generation
Generates BUY/SELL/HOLD signals using XGBoost predictions combined with
technical indicator confirmations for a composite signal.
"""

import logging
from typing import Optional

import numpy as np
import pandas as pd

from config import (
    BUY_THRESHOLD, SELL_THRESHOLD,
    WEIGHT_XGBOOST, WEIGHT_SUPERTREND, WEIGHT_RSI, WEIGHT_MACD, WEIGHT_VOLUME,
    RSI_OVERBOUGHT, RSI_OVERSOLD,
    STOP_LOSS_ATR_MULTIPLIER, TARGET_ATR_MULTIPLIER,
    NIFTY_50_STOCKS,
)
from model import predict, load_model, FEATURE_COLS
from data_fetcher import get_stock_df
from indicators import calculate_all_indicators
import db

logger = logging.getLogger(__name__)


def generate_signal(symbol: str) -> Optional[dict]:
    """
    Generate a trading signal for a stock by combining:
    - XGBoost model prediction (40%)
    - Supertrend direction (20%)
    - RSI zone (15%)
    - MACD crossover state (15%)
    - Volume confirmation (10%)
    """
    # Get latest data and indicators
    stock_df = get_stock_df(symbol)
    if stock_df.empty:
        logger.error("No stock data for %s", symbol)
        return None

    indicators_df = calculate_all_indicators(stock_df)
    if indicators_df.empty:
        logger.error("No indicators for %s", symbol)
        return None

    latest = indicators_df.iloc[-1]
    close = float(latest["close"])
    atr = float(latest["atr"]) if not pd.isna(latest.get("atr", np.nan)) else close * 0.02

    # ── XGBoost Component ────────────────────────────────────────────────
    prediction = predict(symbol, indicators_df)
    if prediction:
        xgb_prob = prediction["probability_up"]
    else:
        # Fallback: use 0.5 (neutral) if no model is available
        xgb_prob = 0.5
        logger.warning("No model prediction for %s, using neutral", symbol)

    # Normalize to 0-1 score: >0.5 is bullish, <0.5 is bearish
    xgb_score = xgb_prob

    # ── Supertrend Component ─────────────────────────────────────────────
    st_direction = int(latest.get("supertrend_direction", 0))
    supertrend_score = 1.0 if st_direction == 1 else 0.0

    # ── RSI Component ────────────────────────────────────────────────────
    rsi = float(latest.get("rsi", 50))
    if rsi <= RSI_OVERSOLD:
        rsi_score = 1.0  # Oversold → bullish signal
    elif rsi >= RSI_OVERBOUGHT:
        rsi_score = 0.0  # Overbought → bearish signal
    else:
        # Linear interpolation between oversold and overbought
        rsi_score = 1.0 - (rsi - RSI_OVERSOLD) / (RSI_OVERBOUGHT - RSI_OVERSOLD)

    # ── MACD Component ───────────────────────────────────────────────────
    macd_val = float(latest.get("macd", 0))
    macd_signal = float(latest.get("macd_signal", 0))
    macd_hist = float(latest.get("macd_hist", 0))

    if macd_val > macd_signal and macd_hist > 0:
        macd_score = 1.0  # Bullish crossover with positive histogram
    elif macd_val < macd_signal and macd_hist < 0:
        macd_score = 0.0  # Bearish crossover with negative histogram
    else:
        macd_score = 0.5  # Mixed signal

    # ── Volume Component ─────────────────────────────────────────────────
    volume_ratio = float(latest.get("volume_ratio", 1.0))
    # Volume above 20-day average confirms the signal
    volume_score = min(volume_ratio / 1.5, 1.0) if volume_ratio > 1.0 else 0.3

    # ── Composite Score ──────────────────────────────────────────────────
    composite = (
        WEIGHT_XGBOOST * xgb_score +
        WEIGHT_SUPERTREND * supertrend_score +
        WEIGHT_RSI * rsi_score +
        WEIGHT_MACD * macd_score +
        WEIGHT_VOLUME * volume_score
    )

    # ── Generate Signal ──────────────────────────────────────────────────
    if composite > BUY_THRESHOLD:
        signal = "BUY"
    elif composite < SELL_THRESHOLD:
        signal = "SELL"
    else:
        signal = "HOLD"

    # Confidence: distance from 0.5, mapped to percentage
    confidence = abs(composite - 0.5) * 200  # 0-100%
    confidence = min(confidence, 100.0)

    # ── Entry, Stop Loss, Target ─────────────────────────────────────────
    entry_price = close
    if signal == "BUY":
        stop_loss = close - (STOP_LOSS_ATR_MULTIPLIER * atr)
        target_price = close + (TARGET_ATR_MULTIPLIER * atr)
    elif signal == "SELL":
        stop_loss = close + (STOP_LOSS_ATR_MULTIPLIER * atr)
        target_price = close - (TARGET_ATR_MULTIPLIER * atr)
    else:
        stop_loss = close - (STOP_LOSS_ATR_MULTIPLIER * atr)
        target_price = close + (TARGET_ATR_MULTIPLIER * atr)

    # ── Circuit Limit Caution ────────────────────────────────────────────
    pct_from_high = float(latest.get("pct_from_52w_high", 0))
    pct_from_low = float(latest.get("pct_from_52w_low", 0))
    caution = abs(pct_from_high) < 2 or abs(pct_from_low) < 2  # Near 52w extremes

    signal_date = str(indicators_df.index[-1].date()) if hasattr(indicators_df.index[-1], "date") else str(indicators_df.index[-1])

    result = {
        "symbol": symbol,
        "date": signal_date,
        "signal": signal + (" (CAUTION)" if caution else ""),
        "confidence": round(confidence, 2),
        "model_probability": round(xgb_prob, 4),
        "entry_price": round(entry_price, 2),
        "stop_loss": round(stop_loss, 2),
        "target_price": round(target_price, 2),
        "composite_score": round(composite, 4),
        "components": {
            "xgboost": round(xgb_score, 4),
            "supertrend": round(supertrend_score, 4),
            "rsi": round(rsi_score, 4),
            "macd": round(macd_score, 4),
            "volume": round(volume_score, 4),
        },
        "indicators": {
            "rsi": round(rsi, 2),
            "macd": round(macd_val, 4),
            "macd_signal": round(macd_signal, 4),
            "macd_hist": round(macd_hist, 4),
            "adx": round(float(latest.get("adx", 0)), 2),
            "atr": round(atr, 2),
            "supertrend_direction": st_direction,
            "volume_ratio": round(volume_ratio, 2),
            "close": round(close, 2),
            "sma_20": round(float(latest.get("sma_20", 0)), 2),
            "sma_50": round(float(latest.get("sma_50", 0)), 2),
            "sma_200": round(float(latest.get("sma_200", 0)), 2),
            "bb_upper": round(float(latest.get("bb_upper", 0)), 2),
            "bb_lower": round(float(latest.get("bb_lower", 0)), 2),
            "stoch_k": round(float(latest.get("stoch_k", 0)), 2),
            "stoch_d": round(float(latest.get("stoch_d", 0)), 2),
        },
        "caution": caution,
    }

    # Save to DB
    clean_signal = signal  # without CAUTION suffix for DB
    db.save_signal(
        symbol, signal_date, clean_signal, confidence,
        xgb_prob, entry_price, stop_loss, target_price, composite,
    )

    logger.info("%s → %s (confidence=%.1f%%, composite=%.4f)", symbol, signal, confidence, composite)
    return result


def generate_all_signals() -> list:
    """Generate signals for all tracked stocks."""
    signals = []
    for symbol in NIFTY_50_STOCKS:
        try:
            sig = generate_signal(symbol)
            if sig:
                signals.append(sig)
        except Exception as e:
            logger.error("Signal generation failed for %s: %s", symbol, e)
    # Sort by confidence descending
    signals.sort(key=lambda s: s["confidence"], reverse=True)
    return signals

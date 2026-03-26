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
    WEIGHT_XGBOOST, WEIGHT_LSTM, WEIGHT_SUPERTREND, WEIGHT_RSI, WEIGHT_MACD, WEIGHT_VOLUME,
    WEIGHT_SENTIMENT, WEIGHT_FUNDAMENTAL, WEIGHT_MACRO,
    RSI_OVERBOUGHT, RSI_OVERSOLD,
    STOP_LOSS_ATR_MULTIPLIER, TARGET_ATR_MULTIPLIER,
    NIFTY_50_STOCKS,
)
from model import predict, load_model, FEATURE_COLS
from data_fetcher import get_stock_df
from indicators import calculate_all_indicators
from news_sentiment import get_stock_sentiment_score
from fundamentals import score_fundamentals
from macro_signals import score_macro_environment
from regime_detector import detect_regime, get_regime_weight_adjustments
from sector_rotation import get_sector_adjustment, get_cached_sector_scores
from lstm_model import predict_lstm
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

    # ── News Sentiment Component ───────────────────────────────────────
    sentiment_score = get_stock_sentiment_score(symbol)  # 0-1 scale, 0.5 = neutral

    # ── Fundamental Component ──────────────────────────────────────────
    fundamental_score = score_fundamentals(symbol)  # 0-1 scale, 0.5 = neutral

    # ── Macro Environment Component ────────────────────────────────────
    macro_score = score_macro_environment()  # 0-1 scale, 0.5 = neutral

    # ── LSTM Deep Learning Component ─────────────────────────────────────
    lstm_prob = predict_lstm(symbol, indicators_df)
    lstm_score = lstm_prob if lstm_prob is not None else xgb_score  # fallback to XGBoost prob

    # ── Regime Detection ─────────────────────────────────────────────────
    regime_info = detect_regime(indicators_df)
    regime = regime_info["regime"]
    adjustments = get_regime_weight_adjustments(regime)

    # ── Sector Rotation ──────────────────────────────────────────────────
    sector_scores = get_cached_sector_scores()
    sector_adj = get_sector_adjustment(symbol, sector_scores)

    # ── Regime-Adjusted Composite Score ──────────────────────────────────
    raw_weights = {
        "xgboost": WEIGHT_XGBOOST,
        "lstm": WEIGHT_LSTM,
        "supertrend": WEIGHT_SUPERTREND,
        "rsi": WEIGHT_RSI,
        "macd": WEIGHT_MACD,
        "volume": WEIGHT_VOLUME,
        "sentiment": WEIGHT_SENTIMENT,
        "fundamental": WEIGHT_FUNDAMENTAL,
        "macro": WEIGHT_MACRO,
    }
    scores = {
        "xgboost": xgb_score,
        "lstm": lstm_score,
        "supertrend": supertrend_score,
        "rsi": rsi_score,
        "macd": macd_score,
        "volume": volume_score,
        "sentiment": sentiment_score,
        "fundamental": fundamental_score,
        "macro": macro_score,
    }

    # Apply regime adjustments and renormalize weights
    adjusted_weights = {k: raw_weights[k] * adjustments.get(k, 1.0) for k in raw_weights}
    total_w = sum(adjusted_weights.values())
    adjusted_weights = {k: v / total_w for k, v in adjusted_weights.items()}

    composite = sum(adjusted_weights[k] * scores[k] for k in scores)

    # Apply sector rotation adjustment (subtle: ±5-15%)
    composite = composite * sector_adj
    composite = max(0.0, min(1.0, composite))

    # ── Dynamic Confidence Thresholds ────────────────────────────────────
    # Adjust thresholds based on regime
    if regime == "volatile":
        buy_thresh = BUY_THRESHOLD + 0.03   # More conservative in volatile markets
        sell_thresh = SELL_THRESHOLD - 0.03
    elif regime in ("trending_up", "trending_down"):
        buy_thresh = BUY_THRESHOLD - 0.02   # Slightly easier to trigger in trends
        sell_thresh = SELL_THRESHOLD + 0.02
    else:
        buy_thresh = BUY_THRESHOLD
        sell_thresh = SELL_THRESHOLD

    # ── Generate Signal ──────────────────────────────────────────────────
    if composite > buy_thresh:
        signal = "BUY"
    elif composite < sell_thresh:
        signal = "SELL"
    else:
        signal = "HOLD"

    # ── Signal Strength Calculation ─────────────────────────────────────
    # Measures how strong/reliable the signal is (0-100%)
    # BUY/SELL: starts at 55% (crossed threshold) + bonuses from multiple factors
    # HOLD: reflects certainty of neutrality (higher when deep in HOLD zone)
    bullish_count = sum(1 for v in scores.values() if v > 0.55)
    bearish_count = sum(1 for v in scores.values() if v < 0.45)

    if signal in ("BUY", "SELL"):
        # How far past the threshold (normalized 0-1)
        if signal == "BUY":
            overshoot = (composite - buy_thresh) / max(1.0 - buy_thresh, 0.01)
            agree_count = bullish_count
            model_agrees = xgb_prob > 0.6
        else:
            overshoot = (sell_thresh - composite) / max(sell_thresh, 0.01)
            agree_count = bearish_count
            model_agrees = xgb_prob < 0.4
        overshoot = max(0.0, min(overshoot, 1.0))

        base = 55.0                                    # Crossed threshold → at least 55%
        strength_bonus = overshoot * 20.0              # Up to +20% for strong overshoot
        agreement_bonus = max(0, agree_count - 4) * 3  # +3% per agreeing component beyond 4
        model_bonus = 5.0 if model_agrees else 0.0     # +5% if ML model strongly agrees
        # Regime alignment
        regime_aligned = (regime == "trending_up" and signal == "BUY") or \
                         (regime == "trending_down" and signal == "SELL")
        regime_bonus = 5.0 if regime_aligned else (-3.0 if regime == "volatile" else 0.0)

        confidence = base + strength_bonus + agreement_bonus + model_bonus + regime_bonus
        confidence = min(max(confidence, 45.0), 95.0)
    else:
        # HOLD: confidence = how deep in HOLD territory (far from both thresholds)
        mid = (buy_thresh + sell_thresh) / 2.0
        half_range = (buy_thresh - sell_thresh) / 2.0
        dist_from_mid = abs(composite - mid)
        nearness = dist_from_mid / max(half_range, 0.01)  # 0 = center, 1 = at threshold
        confidence = (1.0 - min(nearness, 1.0)) * 45.0 + 20.0  # 20-65% range
        confidence = min(max(confidence, 15.0), 65.0)

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
            "lstm": round(lstm_score, 4),
            "supertrend": round(supertrend_score, 4),
            "rsi": round(rsi_score, 4),
            "macd": round(macd_score, 4),
            "volume": round(volume_score, 4),
            "sentiment": round(sentiment_score, 4),
            "fundamental": round(fundamental_score, 4),
            "macro": round(macro_score, 4),
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
        "regime": regime,
        "regime_confidence": regime_info.get("confidence", 0),
        "sector_adjustment": sector_adj,
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

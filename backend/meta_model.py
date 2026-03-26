"""
Netra — Meta-Model (Layer 2 Ensemble)
Learns optimal signal component weights from historical performance data.
Instead of static weights, the meta-model dynamically combines component scores
to produce a final signal with higher accuracy.

Architecture:
  Layer 1 (Component Scores) → Meta-Model → Final Signal
  - XGBoost score, Supertrend, RSI, MACD, Volume, Sentiment, Fundamental, Macro
  → XGBoost Meta-Classifier → Optimal BUY/SELL/HOLD
"""

import logging
import json
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import accuracy_score, classification_report
import xgboost as xgb
import joblib

import db
from config import MODEL_DIR

logger = logging.getLogger(__name__)

META_MODEL_PATH = MODEL_DIR / "meta_model.joblib"
META_METRICS_PATH = MODEL_DIR / "meta_model_metrics.json"

# Component columns the meta-model uses as features
META_FEATURES = [
    "xgboost", "supertrend", "rsi", "macd", "volume",
    "sentiment", "fundamental", "macro",
]


def _build_meta_dataset() -> Optional[pd.DataFrame]:
    """
    Build training data for the meta-model from historical signals and price outcomes.
    For each signal, we look at what the stock actually did in the next N days
    and create a label: 1 = price went up (signal should have been BUY), 0 = down (SELL).
    """
    signals_query = """
        SELECT s.symbol, s.date, s.signal, s.confidence, s.composite_score,
               s.model_probability
        FROM signals s
        ORDER BY s.date ASC
    """
    with db.get_db() as conn:
        signals_df = pd.read_sql_query(signals_query, conn, parse_dates=["date"])

    if signals_df.empty or len(signals_df) < 50:
        logger.warning("Not enough signal history for meta-model training (%d rows)", len(signals_df))
        return None

    rows = []
    for _, sig in signals_df.iterrows():
        symbol = sig["symbol"]
        sig_date = sig["date"]

        # Get price data to compute actual outcome
        price_df = db.get_stock_data(symbol)
        if price_df.empty:
            continue

        price_df["date"] = pd.to_datetime(price_df["date"])

        # Find signal date in price data
        future = price_df[price_df["date"] > pd.Timestamp(sig_date)]
        current = price_df[price_df["date"] <= pd.Timestamp(sig_date)]

        if future.empty or current.empty:
            continue

        # Actual outcome: did price go up in next 5 trading days?
        current_close = float(current.iloc[-1]["close"])
        future_close = float(future.iloc[min(4, len(future) - 1)]["close"])
        actual_up = 1 if future_close > current_close else 0

        # We store the component scores from the composite
        # Since we don't have historical component scores in DB, we reconstruct
        # using model_probability and composite_score as proxy features
        row = {
            "symbol": symbol,
            "date": sig_date,
            "model_probability": sig["model_probability"],
            "composite_score": sig["composite_score"],
            "confidence": sig["confidence"],
            "signal_buy": 1 if sig["signal"] == "BUY" else 0,
            "signal_sell": 1 if sig["signal"] == "SELL" else 0,
            "actual_up": actual_up,
        }
        rows.append(row)

    if not rows:
        return None

    return pd.DataFrame(rows)


def train_meta_model() -> Optional[dict]:
    """
    Train the meta-model on historical signal-outcome pairs.
    Returns metrics dict or None if insufficient data.
    """
    df = _build_meta_dataset()
    if df is None or len(df) < 30:
        logger.warning("Insufficient data for meta-model training")
        return None

    # Features: everything we know at signal time
    feature_cols = ["model_probability", "composite_score", "confidence",
                    "signal_buy", "signal_sell"]

    X = df[feature_cols].values
    y = df["actual_up"].values

    # Time-series split
    split_idx = int(len(X) * 0.8)
    X_train, X_test = X[:split_idx], X[split_idx:]
    y_train, y_test = y[:split_idx], y[split_idx:]

    if len(X_test) < 10:
        logger.warning("Test set too small for meta-model")
        return None

    # Train meta-XGBoost
    model = xgb.XGBClassifier(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        objective="binary:logistic",
        eval_metric="logloss",
        random_state=42,
    )

    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=False,
    )

    # Evaluate
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]
    accuracy = accuracy_score(y_test, y_pred)

    # Feature importance (learned weights essentially)
    importance = dict(zip(feature_cols, model.feature_importances_.tolist()))

    # Compare vs static signal accuracy
    static_pred = df.iloc[split_idx:]["signal_buy"].values
    static_accuracy = accuracy_score(y_test, static_pred)

    metrics = {
        "accuracy": round(accuracy, 4),
        "static_accuracy": round(static_accuracy, 4),
        "improvement": round(accuracy - static_accuracy, 4),
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "feature_importance": importance,
    }

    # Save model and metrics
    joblib.dump(model, META_MODEL_PATH)
    with open(META_METRICS_PATH, "w") as f:
        json.dump(metrics, f, indent=2)

    logger.info(
        "Meta-model trained: accuracy=%.4f (static=%.4f, improvement=%+.4f)",
        accuracy, static_accuracy, accuracy - static_accuracy,
    )
    return metrics


def predict_meta(composite_score: float, model_probability: float,
                 confidence: float, signal: str) -> Optional[dict]:
    """
    Use the meta-model to refine a signal prediction.
    Returns {"probability_up": float, "meta_signal": str} or None if no model.
    """
    if not META_MODEL_PATH.exists():
        return None

    try:
        model = joblib.load(META_MODEL_PATH)
        features = np.array([[
            model_probability,
            composite_score,
            confidence,
            1 if signal == "BUY" else 0,
            1 if signal == "SELL" else 0,
        ]])

        prob = float(model.predict_proba(features)[0][1])

        if prob > 0.6:
            meta_signal = "BUY"
        elif prob < 0.4:
            meta_signal = "SELL"
        else:
            meta_signal = "HOLD"

        return {
            "probability_up": round(prob, 4),
            "meta_signal": meta_signal,
            "meta_confidence": round(abs(prob - 0.5) * 200, 2),
        }

    except Exception as e:
        logger.warning("Meta-model prediction failed: %s", e)
        return None


def get_meta_metrics() -> Optional[dict]:
    """Load meta-model metrics from disk."""
    if not META_METRICS_PATH.exists():
        return None
    try:
        with open(META_METRICS_PATH) as f:
            return json.load(f)
    except Exception:
        return None

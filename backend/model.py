"""
Netra — ML Model
XGBoost classifier for next-day price direction prediction.
Uses Optuna for hyperparameter tuning and TimeSeriesSplit for validation.
"""

import logging
import json
from pathlib import Path
from typing import Optional, Tuple

import numpy as np
import pandas as pd
import joblib
import optuna
from xgboost import XGBClassifier
from sklearn.ensemble import RandomForestClassifier, VotingClassifier
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, confusion_matrix, classification_report
)

try:
    from lightgbm import LGBMClassifier
    HAS_LIGHTGBM = True
except ImportError:
    HAS_LIGHTGBM = False

from config import (
    MODEL_DIR, XGBOOST_DEFAULT_PARAMS, OPTUNA_N_TRIALS, TRAIN_TEST_SPLIT_YEAR,
)
from data_fetcher import get_stock_df
from indicators import calculate_all_indicators

logger = logging.getLogger(__name__)

# Feature columns used by the model (excluding target and price data)
FEATURE_COLS = [
    # Original indicators
    "rsi", "macd", "macd_signal", "macd_hist",
    "sma_20", "sma_50", "sma_200", "ema_12", "ema_26",
    "bb_upper", "bb_middle", "bb_lower", "bb_position",
    "supertrend", "supertrend_direction",
    "vwap", "adx", "atr", "obv",
    "stoch_k", "stoch_d",
    "volume_sma_20", "volume_ratio",
    "high_52w", "low_52w", "pct_from_52w_high", "pct_from_52w_low",
    "day_of_week",
    # Ichimoku
    "ichimoku_tenkan", "ichimoku_kijun", "ichimoku_signal", "ichimoku_tk_cross",
    # Fibonacci
    "fib_proximity",
    # Multi-timeframe
    "rsi_weekly", "macd_weekly", "macd_weekly_signal", "rsi_5", "rsi_divergence",
    # Momentum
    "returns_1d", "returns_5d", "returns_10d", "returns_20d",
    "roc_10", "roc_20",
    "price_sma20_ratio", "price_sma50_ratio", "price_sma200_ratio",
    "sma_20_50_cross", "sma_50_200_cross",
    # Candlestick
    "candle_body_pct", "candle_upper_shadow_pct", "candle_lower_shadow_pct",
    "is_doji", "is_hammer",
    # Volatility
    "volatility_20d", "volatility_5d", "volatility_ratio", "atr_pct",
]


def prepare_features(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series]:
    """
    Prepare feature matrix X and target y from indicator DataFrame.
    Target: 1 if next day's close > today's close, else 0.
    """
    df = df.copy()
    df["target"] = (df["close"].shift(-1) > df["close"]).astype(int)
    df = df.dropna()

    # Select only columns that exist in the DataFrame
    available_features = [c for c in FEATURE_COLS if c in df.columns]
    X = df[available_features]
    y = df["target"]

    return X, y


def train_model(
    symbol: str,
    optimize: bool = True,
    n_trials: int = OPTUNA_N_TRIALS,
) -> dict:
    """
    Train an XGBoost model for a stock.
    Returns a dict with metrics and model path.
    """
    logger.info("Training model for %s", symbol)

    # Get data and calculate indicators
    stock_df = get_stock_df(symbol)
    if stock_df.empty:
        logger.error("No data available for %s", symbol)
        return {"error": f"No data for {symbol}"}

    indicators_df = calculate_all_indicators(stock_df)
    if indicators_df.empty:
        logger.error("Could not calculate indicators for %s", symbol)
        return {"error": f"Insufficient data for indicators: {symbol}"}

    X, y = prepare_features(indicators_df)
    if len(X) < 100:
        logger.error("Too few samples for %s: %d", symbol, len(X))
        return {"error": f"Too few samples: {len(X)}"}

    # Time-series split: train on data before TRAIN_TEST_SPLIT_YEAR
    dates = indicators_df.index[:len(X)]  # align with X after dropna
    if hasattr(dates, "year"):
        train_mask = dates.year < TRAIN_TEST_SPLIT_YEAR
    else:
        train_mask = pd.to_datetime(dates).year < TRAIN_TEST_SPLIT_YEAR

    X_train, X_test = X[train_mask], X[~train_mask]
    y_train, y_test = y[train_mask], y[~train_mask]

    if len(X_train) < 50 or len(X_test) < 20:
        logger.warning("Insufficient train/test split for %s (train=%d, test=%d). Using 80/20 split.",
                       symbol, len(X_train), len(X_test))
        split_idx = int(len(X) * 0.8)
        X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
        y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]

    logger.info("Train size: %d, Test size: %d", len(X_train), len(X_test))

    # Hyperparameter optimization with Optuna
    if optimize and n_trials > 0:
        best_params = _optimize_hyperparams(X_train, y_train, n_trials)
    else:
        best_params = XGBOOST_DEFAULT_PARAMS.copy()

    # Train ensemble model (XGBoost + LightGBM + RandomForest)
    model = _build_ensemble(best_params, X_train, y_train, X_test, y_test)

    # Evaluate
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]

    metrics = {
        "symbol": symbol,
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "precision": float(precision_score(y_test, y_pred, zero_division=0)),
        "recall": float(recall_score(y_test, y_pred, zero_division=0)),
        "f1_score": float(f1_score(y_test, y_pred, zero_division=0)),
        "confusion_matrix": confusion_matrix(y_test, y_pred).tolist(),
        "train_samples": len(X_train),
        "test_samples": len(X_test),
    }

    logger.info(
        "%s — Accuracy: %.4f, Precision: %.4f, Recall: %.4f, F1: %.4f",
        symbol, metrics["accuracy"], metrics["precision"], metrics["recall"], metrics["f1_score"]
    )

    # Save model and metrics
    model_path = MODEL_DIR / f"{symbol.replace('.', '_').replace('^', 'IDX_')}.joblib"
    joblib.dump(model, model_path)

    metrics_path = MODEL_DIR / f"{symbol.replace('.', '_').replace('^', 'IDX_')}_metrics.json"
    with open(metrics_path, "w") as f:
        json.dump(metrics, f, indent=2)

    metrics["model_path"] = str(model_path)
    return metrics


def _build_ensemble(
    xgb_params: dict,
    X_train: pd.DataFrame, y_train: pd.Series,
    X_test: pd.DataFrame, y_test: pd.Series,
) -> VotingClassifier:
    """
    Build a soft-voting ensemble of XGBoost + LightGBM + RandomForest.
    Falls back to XGBoost-only if LightGBM is not installed.
    """
    xgb = XGBClassifier(**xgb_params)

    rf = RandomForestClassifier(
        n_estimators=300,
        max_depth=8,
        min_samples_split=10,
        min_samples_leaf=5,
        max_features="sqrt",
        random_state=42,
        n_jobs=-1,
    )

    estimators = [("xgb", xgb), ("rf", rf)]
    weights = [0.50, 0.25]

    if HAS_LIGHTGBM:
        lgbm = LGBMClassifier(
            n_estimators=xgb_params.get("n_estimators", 500),
            max_depth=xgb_params.get("max_depth", 6),
            learning_rate=xgb_params.get("learning_rate", 0.05),
            subsample=xgb_params.get("subsample", 0.8),
            colsample_bytree=xgb_params.get("colsample_bytree", 0.8),
            min_child_weight=xgb_params.get("min_child_weight", 3),
            reg_alpha=xgb_params.get("reg_alpha", 0.1),
            reg_lambda=xgb_params.get("reg_lambda", 1.0),
            random_state=42,
            verbose=-1,
        )
        estimators.append(("lgbm", lgbm))
        weights = [0.40, 0.20, 0.40]
        logger.info("Using 3-model ensemble: XGBoost + LightGBM + RandomForest")
    else:
        logger.info("LightGBM not available; using 2-model ensemble: XGBoost + RandomForest")

    ensemble = VotingClassifier(
        estimators=estimators,
        voting="soft",
        weights=weights,
    )
    ensemble.fit(X_train, y_train)
    return ensemble


def _optimize_hyperparams(X_train: pd.DataFrame, y_train: pd.Series, n_trials: int) -> dict:
    """Use Optuna to find optimal XGBoost hyperparameters."""
    optuna.logging.set_verbosity(optuna.logging.WARNING)

    def objective(trial):
        params = {
            "n_estimators": trial.suggest_int("n_estimators", 100, 1000),
            "max_depth": trial.suggest_int("max_depth", 3, 10),
            "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.3, log=True),
            "subsample": trial.suggest_float("subsample", 0.6, 1.0),
            "colsample_bytree": trial.suggest_float("colsample_bytree", 0.6, 1.0),
            "min_child_weight": trial.suggest_int("min_child_weight", 1, 10),
            "gamma": trial.suggest_float("gamma", 0.0, 1.0),
            "reg_alpha": trial.suggest_float("reg_alpha", 0.0, 1.0),
            "reg_lambda": trial.suggest_float("reg_lambda", 0.5, 3.0),
            "objective": "binary:logistic",
            "eval_metric": "logloss",
            "use_label_encoder": False,
            "random_state": 42,
        }

        tscv = TimeSeriesSplit(n_splits=5)
        scores = []
        for train_idx, val_idx in tscv.split(X_train):
            X_t, X_v = X_train.iloc[train_idx], X_train.iloc[val_idx]
            y_t, y_v = y_train.iloc[train_idx], y_train.iloc[val_idx]

            model = XGBClassifier(**params)
            model.fit(X_t, y_t, eval_set=[(X_v, y_v)], verbose=False)
            y_pred = model.predict(X_v)
            scores.append(f1_score(y_v, y_pred, zero_division=0))

        return np.mean(scores)

    study = optuna.create_study(direction="maximize")
    study.optimize(objective, n_trials=n_trials, show_progress_bar=False)

    best = study.best_params
    best["objective"] = "binary:logistic"
    best["eval_metric"] = "logloss"
    best["use_label_encoder"] = False
    best["random_state"] = 42

    logger.info("Best Optuna params: %s (F1=%.4f)", best, study.best_value)
    return best


def load_model(symbol: str):
    """Load a trained model from disk. Returns XGBClassifier or VotingClassifier."""
    model_path = MODEL_DIR / f"{symbol.replace('.', '_').replace('^', 'IDX_')}.joblib"
    if model_path.exists():
        return joblib.load(model_path)
    logger.warning("No trained model found for %s at %s", symbol, model_path)
    return None


def predict(symbol: str, df: Optional[pd.DataFrame] = None) -> Optional[dict]:
    """
    Generate prediction for the latest data point.
    Returns dict with probability and features used.
    """
    model = load_model(symbol)
    if model is None:
        return None

    if df is None:
        stock_df = get_stock_df(symbol)
        df = calculate_all_indicators(stock_df)

    if df.empty:
        return None

    # Use the most recent row
    available_features = [c for c in FEATURE_COLS if c in df.columns]
    latest = df[available_features].iloc[[-1]]

    prob = model.predict_proba(latest)[0]
    prediction = int(model.predict(latest)[0])

    return {
        "symbol": symbol,
        "prediction": prediction,
        "probability_up": float(prob[1]),
        "probability_down": float(prob[0]),
        "date": str(df.index[-1].date()) if hasattr(df.index[-1], "date") else str(df.index[-1]),
        "close": float(df["close"].iloc[-1]),
        "features": {col: float(latest[col].iloc[0]) for col in available_features[:10]},  # top 10 for display
    }


def train_all_models(optimize: bool = False):
    """Train models for all NIFTY 50 stocks."""
    from config import NIFTY_50_STOCKS
    results = {}
    for symbol in NIFTY_50_STOCKS:
        try:
            metrics = train_model(symbol, optimize=optimize)
            results[symbol] = metrics
        except Exception as e:
            logger.error("Failed to train model for %s: %s", symbol, e)
            results[symbol] = {"error": str(e)}
    return results


def train_general_model(optimize: bool = False) -> dict:
    """Train a pooled model on all stocks combined."""
    from config import NIFTY_50_STOCKS
    logger.info("Training general (pooled) model on all stocks")

    all_X, all_y = [], []
    for symbol in NIFTY_50_STOCKS:
        try:
            stock_df = get_stock_df(symbol)
            indicators_df = calculate_all_indicators(stock_df)
            if indicators_df.empty:
                continue
            X, y = prepare_features(indicators_df)
            all_X.append(X)
            all_y.append(y)
        except Exception as e:
            logger.error("Skipping %s for general model: %s", symbol, e)

    if not all_X:
        return {"error": "No data available for general model"}

    X = pd.concat(all_X, ignore_index=True)
    y = pd.concat(all_y, ignore_index=True)

    # Simple 80/20 split for pooled data
    split_idx = int(len(X) * 0.8)
    X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
    y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]

    if optimize:
        best_params = _optimize_hyperparams(X_train, y_train, OPTUNA_N_TRIALS)
    else:
        best_params = XGBOOST_DEFAULT_PARAMS.copy()

    model = _build_ensemble(best_params, X_train, y_train, X_test, y_test)

    y_pred = model.predict(X_test)
    metrics = {
        "symbol": "GENERAL",
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "precision": float(precision_score(y_test, y_pred, zero_division=0)),
        "recall": float(recall_score(y_test, y_pred, zero_division=0)),
        "f1_score": float(f1_score(y_test, y_pred, zero_division=0)),
        "train_samples": len(X_train),
        "test_samples": len(X_test),
    }

    model_path = MODEL_DIR / "GENERAL_MODEL.joblib"
    joblib.dump(model, model_path)
    logger.info("General model — Accuracy: %.4f, F1: %.4f", metrics["accuracy"], metrics["f1_score"])

    return metrics

"""
Netra — Configuration
Central configuration for the trading signal system.
"""

import os
from pathlib import Path

# ─── Paths ───────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
MODEL_DIR = Path(__file__).resolve().parent / "trained_models"
DB_PATH = DATA_DIR / "netra.db"
LOG_PATH = DATA_DIR / "netra.log"

# Ensure directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
MODEL_DIR.mkdir(parents=True, exist_ok=True)

# ─── Stock Universe ──────────────────────────────────────────────────────────
NIFTY_50_STOCKS = [
    "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS",
    "SBIN.NS", "BHARTIARTL.NS", "ITC.NS", "KOTAKBANK.NS", "LT.NS",
    "HINDUNILVR.NS", "AXISBANK.NS", "BAJFINANCE.NS", "MARUTI.NS",
    "TRENT.NS", "SUNPHARMA.NS", "TITAN.NS", "ONGC.NS",
    "NTPC.NS", "ADANIENT.NS", "ADANIPORTS.NS", "POWERGRID.NS",
    "M&M.NS", "ASIANPAINT.NS", "NESTLEIND.NS", "ULTRACEMCO.NS",
    "JSWSTEEL.NS", "TATASTEEL.NS", "BAJAJFINSV.NS", "HCLTECH.NS",
    "WIPRO.NS", "INDUSINDBK.NS", "TECHM.NS", "HINDALCO.NS",
    "GRASIM.NS", "DRREDDY.NS", "CIPLA.NS", "EICHERMOT.NS",
    "DIVISLAB.NS", "BPCL.NS", "COALINDIA.NS", "BRITANNIA.NS",
    "APOLLOHOSP.NS", "TATACONSUM.NS", "SBILIFE.NS", "HDFCLIFE.NS",
    "BAJAJ-AUTO.NS", "HEROMOTOCO.NS", "SHRIRAMFIN.NS", "LTIM.NS",
]

INDEX_SYMBOLS = ["^NSEI", "^NSEBANK"]

ALL_SYMBOLS = NIFTY_50_STOCKS + INDEX_SYMBOLS

# ─── Market Hours (IST) ─────────────────────────────────────────────────────
MARKET_OPEN_HOUR = 9
MARKET_OPEN_MINUTE = 15
MARKET_CLOSE_HOUR = 15
MARKET_CLOSE_MINUTE = 30
TIMEZONE = "Asia/Kolkata"

# ─── Model Hyperparameters ───────────────────────────────────────────────────
XGBOOST_DEFAULT_PARAMS = {
    "n_estimators": 500,
    "max_depth": 6,
    "learning_rate": 0.05,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "min_child_weight": 3,
    "gamma": 0.1,
    "reg_alpha": 0.1,
    "reg_lambda": 1.0,
    "objective": "binary:logistic",
    "eval_metric": "logloss",
    "use_label_encoder": False,
    "random_state": 42,
}

OPTUNA_N_TRIALS = 50
TRAIN_TEST_SPLIT_YEAR = 2024  # Train on data before this year

# ─── Signal Thresholds ───────────────────────────────────────────────────────
BUY_THRESHOLD = 0.65
SELL_THRESHOLD = 0.35

# Composite signal weights
WEIGHT_XGBOOST = 0.40
WEIGHT_SUPERTREND = 0.20
WEIGHT_RSI = 0.15
WEIGHT_MACD = 0.15
WEIGHT_VOLUME = 0.10

# RSI levels tuned for Indian market
RSI_OVERBOUGHT = 60
RSI_OVERSOLD = 40

# ─── Trading Cost Parameters (Indian Market) ────────────────────────────────
BROKERAGE_PER_ORDER = 20  # ₹20 per order (Zerodha-style)
STT_DELIVERY_SELL = 0.00025  # 0.025% on sell side
STT_INTRADAY = 0.00025  # 0.025% both sides
GST_RATE = 0.18  # 18% on brokerage
SEBI_CHARGES_PER_CRORE = 10  # ₹10 per crore
STAMP_DUTY_BUY = 0.00015  # 0.015% on buy side

# ─── Data Fetching ───────────────────────────────────────────────────────────
HISTORY_PERIOD = "10y"  # Max history for training
INTRADAY_PERIOD = "60d"
INTRADAY_INTERVAL = "1m"

# ─── ATR Multipliers for Stop Loss / Target ─────────────────────────────────
STOP_LOSS_ATR_MULTIPLIER = 1.5
TARGET_ATR_MULTIPLIER = 2.0

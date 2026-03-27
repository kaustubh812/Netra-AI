"""
Netra — Configuration
Central configuration for the trading signal system.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

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
    # Bank NIFTY additions (not already in NIFTY 50)
    "BANKBARODA.NS", "PNB.NS", "CANBK.NS", "AUBANK.NS",
    "FEDERALBNK.NS", "IDFCFIRSTB.NS",
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

# Composite signal weights (must sum to 1.0) — 9 components
WEIGHT_XGBOOST = 0.20
WEIGHT_LSTM = 0.12
WEIGHT_SUPERTREND = 0.10
WEIGHT_RSI = 0.08
WEIGHT_MACD = 0.08
WEIGHT_VOLUME = 0.05
WEIGHT_SENTIMENT = 0.12
WEIGHT_FUNDAMENTAL = 0.13
WEIGHT_MACRO = 0.12

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

# ─── News Sentiment (OpenAI) ─────────────────────────────────────────────────
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_MODEL = "gpt-5.4-mini"

# RSS feed sources for Indian market news
NEWS_RSS_FEEDS = [
    {"name": "MoneyControl", "url": "https://www.moneycontrol.com/rss/MCtopnews.xml"},
    {"name": "MoneyControl Markets", "url": "https://www.moneycontrol.com/rss/marketreports.xml"},
    {"name": "Economic Times", "url": "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms"},
    {"name": "LiveMint", "url": "https://www.livemint.com/rss/markets"},
]

NEWS_CACHE_TTL = 1800  # 30 minutes
NEWS_MAX_HEADLINES_PER_STOCK = 10  # Max headlines to score per stock per cycle

# Stock name mapping for headline matching (symbol → searchable names)
STOCK_NAME_MAP = {
    "RELIANCE.NS": ["reliance", "ril", "jio", "mukesh ambani"],
    "TCS.NS": ["tcs", "tata consultancy"],
    "HDFCBANK.NS": ["hdfc bank"],
    "INFY.NS": ["infosys", "infy"],
    "ICICIBANK.NS": ["icici bank", "icici"],
    "SBIN.NS": ["sbi", "state bank"],
    "BHARTIARTL.NS": ["bharti airtel", "airtel"],
    "ITC.NS": ["itc"],
    "KOTAKBANK.NS": ["kotak mahindra", "kotak bank"],
    "LT.NS": ["larsen", "l&t", "larsen & toubro"],
    "HINDUNILVR.NS": ["hindustan unilever", "hul"],
    "AXISBANK.NS": ["axis bank"],
    "BAJFINANCE.NS": ["bajaj finance"],
    "MARUTI.NS": ["maruti suzuki", "maruti"],
    "TRENT.NS": ["trent", "westside", "zudio"],
    "SUNPHARMA.NS": ["sun pharma", "sun pharmaceutical"],
    "TITAN.NS": ["titan company", "titan", "tanishq"],
    "ONGC.NS": ["ongc", "oil and natural gas"],
    "NTPC.NS": ["ntpc"],
    "ADANIENT.NS": ["adani enterprises", "adani"],
    "ADANIPORTS.NS": ["adani ports"],
    "POWERGRID.NS": ["power grid"],
    "M&M.NS": ["mahindra", "m&m"],
    "ASIANPAINT.NS": ["asian paints"],
    "NESTLEIND.NS": ["nestle india", "nestle"],
    "ULTRACEMCO.NS": ["ultratech cement", "ultratech"],
    "JSWSTEEL.NS": ["jsw steel", "jsw"],
    "TATASTEEL.NS": ["tata steel"],
    "BAJAJFINSV.NS": ["bajaj finserv"],
    "HCLTECH.NS": ["hcl tech", "hcl technologies"],
    "WIPRO.NS": ["wipro"],
    "INDUSINDBK.NS": ["indusind bank", "indusind"],
    "TECHM.NS": ["tech mahindra"],
    "HINDALCO.NS": ["hindalco"],
    "GRASIM.NS": ["grasim"],
    "DRREDDY.NS": ["dr reddy", "dr. reddy"],
    "CIPLA.NS": ["cipla"],
    "EICHERMOT.NS": ["eicher motors", "royal enfield"],
    "DIVISLAB.NS": ["divi's lab", "divis lab"],
    "BPCL.NS": ["bpcl", "bharat petroleum"],
    "COALINDIA.NS": ["coal india"],
    "BRITANNIA.NS": ["britannia"],
    "APOLLOHOSP.NS": ["apollo hospitals", "apollo"],
    "TATACONSUM.NS": ["tata consumer"],
    "SBILIFE.NS": ["sbi life"],
    "HDFCLIFE.NS": ["hdfc life"],
    "BAJAJ-AUTO.NS": ["bajaj auto"],
    "HEROMOTOCO.NS": ["hero motocorp", "hero moto"],
    "SHRIRAMFIN.NS": ["shriram finance", "shriram"],
    "LTIM.NS": ["lt mindtree", "ltimindtree", "mindtree"],
    "BANKBARODA.NS": ["bank of baroda", "bob"],
    "PNB.NS": ["pnb", "punjab national bank"],
    "CANBK.NS": ["canara bank"],
    "AUBANK.NS": ["au bank", "au small finance"],
    "FEDERALBNK.NS": ["federal bank"],
    "IDFCFIRSTB.NS": ["idfc first bank", "idfc first"],
}

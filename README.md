# Netra (नेत्र) — The Eye That Sees The Market

A full-stack trading signal system for **Indian stock markets (NSE)** with ML-powered BUY/SELL/HOLD signals for NIFTY 50 stocks.

![Python](https://img.shields.io/badge/Python-3.10+-blue) ![Next.js](https://img.shields.io/badge/Next.js-15-black) ![XGBoost](https://img.shields.io/badge/ML-XGBoost-orange)

## Features

- **ML-Powered Signals** — XGBoost classifier predicts next-day price direction for each NIFTY 50 stock
- **Composite Signal** — Combines ML prediction with Supertrend, RSI, MACD, and volume confirmation
- **15+ Technical Indicators** — RSI, MACD, Bollinger Bands, Supertrend, ADX, Stochastic, OBV, ATR, VWAP, and more
- **Interactive Charts** — TradingView Lightweight Charts with BUY/SELL markers overlay
- **Backtesting** — Test strategy performance with realistic Indian market trading costs (brokerage, STT, GST, stamp duty)
- **Auto-Scheduling** — Fetches data and generates signals after market close automatically
- **Option Chain Analysis** — PCR (Put-Call Ratio) and max pain from NSE data
- **Dark Trading Terminal UI** — Professional, information-dense interface

## Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- **pip** and **npm**

## Quick Start

### 1. Install Dependencies

```bash
# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

Or use the Makefile:
```bash
make setup
```

### 2. First Run — Fetch Data & Train Models

```bash
python scripts/first_run.py
```

This will:
1. Initialize the SQLite database
2. Fetch 5+ years of daily OHLCV data for all NIFTY 50 stocks
3. Train XGBoost models for each stock (takes 10-30 minutes)
4. Generate trading signals
5. Run backtests

### 3. Start the System

**Terminal 1 — Backend API:**
```bash
cd backend
python main.py
```
Backend runs at `http://localhost:8000`

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```
Frontend runs at `http://localhost:3000`

## Daily Usage

### Update data and signals (after market close):
```bash
make update
```

The scheduler also does this automatically at 3:45 PM IST on weekdays.

### Retrain models (periodically):
```bash
make train
```

Automated weekly on Sundays at 6 AM IST.

### Run backtests:
```bash
make backtest
```

## Project Structure

```
netra/
├── backend/
│   ├── main.py              # FastAPI server
│   ├── data_fetcher.py      # Yahoo Finance data puller
│   ├── indicators.py        # Technical indicator calculations
│   ├── model.py             # XGBoost training & prediction
│   ├── backtest.py          # Backtesting engine
│   ├── signals.py           # Signal generation (BUY/SELL/HOLD)
│   ├── option_chain.py      # NSE option chain & PCR
│   ├── config.py            # Configuration & constants
│   ├── scheduler.py         # APScheduler for auto-updates
│   ├── db.py                # SQLite database layer
│   ├── requirements.txt
│   └── trained_models/      # Serialized XGBoost models
├── frontend/
│   └── src/
│       ├── app/             # Next.js pages (dashboard, stock detail, settings)
│       ├── components/      # React components
│       └── lib/             # API client & types
├── data/                    # SQLite DB & logs
├── scripts/
│   ├── first_run.py         # Initial setup script
│   └── setup.sh             # Dependency installer
├── Makefile
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stocks` | All stocks with latest signals |
| GET | `/api/stock/{symbol}` | Stock detail with indicators |
| GET | `/api/stock/{symbol}/chart` | OHLCV + signal markers for charting |
| GET | `/api/signals/latest` | Latest signals sorted by confidence |
| GET | `/api/backtest/{symbol}` | Backtest results |
| GET | `/api/market-overview` | NIFTY 50, Bank NIFTY, PCR, breadth |
| POST | `/api/retrain` | Trigger model retraining |
| POST | `/api/refresh-data` | Trigger data refresh + signal generation |

## Signal Logic

| Component | Weight | Logic |
|-----------|--------|-------|
| XGBoost | 40% | Model prediction probability |
| Supertrend | 20% | Direction (bullish=1, bearish=0) |
| RSI | 15% | Oversold(<40)=bullish, Overbought(>60)=bearish |
| MACD | 15% | Bullish/bearish crossover state |
| Volume | 10% | Above 20-day average confirms signal |

**BUY** when composite > 0.65 | **SELL** when composite < 0.35 | **HOLD** otherwise

## Trading Costs (Backtest)

Realistic Indian market costs:
- Brokerage: ₹20 per order (Zerodha-style)
- STT: 0.025% on sell (delivery)
- GST: 18% on brokerage
- SEBI: ₹10 per crore
- Stamp duty: 0.015% on buy

## Tech Stack

**Backend:** Python, FastAPI, XGBoost, yfinance, pandas, ta, scikit-learn, Optuna, SQLite

**Frontend:** Next.js 15, TypeScript, TailwindCSS, TradingView Lightweight Charts, TanStack Query

## Notes

- This is for **Indian NSE market only** — all symbols use `.NS` suffix
- All times are in **IST** (Asia/Kolkata)
- Optimized for **swing trading** (daily timeframe, 2-7 day holds)
- System works fully offline after initial data fetch
- Not financial advice — use at your own risk

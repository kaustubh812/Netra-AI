"""
Netra — FastAPI Server
Main API server for the trading signal system.
"""

import logging
import sys
from datetime import datetime
from contextlib import asynccontextmanager
from typing import Optional

import pytz
import pandas as pd
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware

from config import NIFTY_50_STOCKS, INDEX_SYMBOLS, TIMEZONE, LOG_PATH, DATA_DIR
from scheduler import create_scheduler

# ─── Logging Setup ───────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler(str(LOG_PATH), encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger(__name__)
IST = pytz.timezone(TIMEZONE)


# ─── App Lifecycle ───────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start scheduler on startup, shut down on exit."""
    import db  # ensure DB is initialized
    scheduler = create_scheduler()
    scheduler.start()
    logger.info("Netra backend started — scheduler active")
    yield
    scheduler.shutdown()
    logger.info("Netra backend shut down")


app = FastAPI(
    title="Netra — नेत्र",
    description="Indian Market Trading Signal System",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── API Endpoints ───────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"name": "Netra (नेत्र)", "tagline": "The eye that sees the market", "status": "running"}


@app.get("/api/stocks")
def get_stocks():
    """List all tracked stocks with their latest signals and live prices."""
    import db
    from live_prices import fetch_live_prices, is_market_open

    signals_df = db.get_latest_signals()

    # Fetch live prices (cached, 30s TTL)
    live = fetch_live_prices()
    market_open = is_market_open()

    stocks = []
    for symbol in NIFTY_50_STOCKS:
        stock_info = {"symbol": symbol, "name": symbol.replace(".NS", "")}

        # Use live price if available, otherwise fall back to DB
        lp = live.get(symbol)
        if lp:
            stock_info["ltp"] = lp["price"]
            stock_info["change"] = lp["change"]
            stock_info["change_pct"] = lp["change_pct"]
            stock_info["day_high"] = lp["high"]
            stock_info["day_low"] = lp["low"]
            stock_info["volume"] = lp["volume"]
            stock_info["prev_close"] = lp["prev_close"]
            stock_info["live"] = True
        else:
            price_df = db.get_stock_data(symbol)
            if not price_df.empty:
                latest = price_df.iloc[-1]
                stock_info["ltp"] = float(latest["close"])
                if len(price_df) > 1:
                    prev_close = float(price_df.iloc[-2]["close"])
                    stock_info["change"] = round(float(latest["close"]) - prev_close, 2)
                    stock_info["change_pct"] = round(((float(latest["close"]) - prev_close) / prev_close) * 100, 2)
                stock_info["live"] = False

        # Get signal
        sig_row = signals_df[signals_df["symbol"] == symbol]
        if not sig_row.empty:
            sig = sig_row.iloc[0]
            stock_info["signal"] = sig["signal"]
            stock_info["confidence"] = float(sig["confidence"])
            stock_info["entry_price"] = float(sig["entry_price"])
            stock_info["stop_loss"] = float(sig["stop_loss"])
            stock_info["target_price"] = float(sig["target_price"])
            stock_info["composite_score"] = float(sig["composite_score"])

        stocks.append(stock_info)

    return {"stocks": stocks, "count": len(stocks), "market_open": market_open}


@app.get("/api/live-prices")
def get_live_prices():
    """Get real-time prices for all tracked stocks + indices."""
    from live_prices import fetch_live_prices, is_market_open

    prices = fetch_live_prices()
    return {
        "prices": prices,
        "market_open": is_market_open(),
        "count": len(prices),
        "timestamp": datetime.now(IST).isoformat(),
    }


@app.get("/api/stock/{symbol}")
def get_stock_detail(symbol: str):
    """Detailed data for one stock: OHLCV, indicators, signal history."""
    import db
    from indicators import calculate_all_indicators
    from data_fetcher import get_stock_df

    # Ensure .NS suffix
    if not symbol.endswith(".NS") and not symbol.startswith("^"):
        symbol = symbol + ".NS"

    # Get price data
    price_df = db.get_stock_data(symbol)
    if price_df.empty:
        raise HTTPException(status_code=404, detail=f"No data found for {symbol}")

    # Get indicators
    indicators = db.get_indicators(symbol)

    # Get signal history
    signal_history = db.get_signal_history(symbol, limit=30)

    # Latest signal
    latest_signals = db.get_latest_signals()
    latest_sig = latest_signals[latest_signals["symbol"] == symbol]

    result = {
        "symbol": symbol,
        "name": symbol.replace(".NS", "").replace("^", ""),
        "price_data": price_df.tail(252).to_dict(orient="records"),  # Last 1 year
        "signal_history": signal_history.to_dict(orient="records") if not signal_history.empty else [],
    }

    if not latest_sig.empty:
        sig = latest_sig.iloc[0]
        result["current_signal"] = {
            "signal": sig["signal"],
            "confidence": float(sig["confidence"]),
            "model_probability": float(sig["model_probability"]),
            "entry_price": float(sig["entry_price"]),
            "stop_loss": float(sig["stop_loss"]),
            "target_price": float(sig["target_price"]),
            "composite_score": float(sig["composite_score"]),
            "date": str(sig["date"]),
        }

    if not indicators.empty:
        latest_ind = indicators.iloc[-1]
        result["indicators"] = {
            col: float(latest_ind[col]) if pd.notna(latest_ind[col]) else None
            for col in indicators.columns if col not in ("id", "symbol", "date")
        }

    return result


@app.get("/api/stock/{symbol}/chart")
def get_stock_chart(symbol: str, period: str = "1Y"):
    """OHLCV candlestick data with signal markers for charting."""
    import db

    if not symbol.endswith(".NS") and not symbol.startswith("^"):
        symbol = symbol + ".NS"

    price_df = db.get_stock_data(symbol)
    if price_df.empty:
        raise HTTPException(status_code=404, detail=f"No data for {symbol}")

    # Filter by period
    period_map = {"1M": 22, "3M": 66, "6M": 132, "1Y": 252, "5Y": 1260}
    days = period_map.get(period, 252)
    price_df = price_df.tail(days)

    # Get signals for overlay
    signals_df = db.get_signal_history(symbol, limit=days)

    candles = []
    for _, row in price_df.iterrows():
        candles.append({
            "time": str(row["date"])[:10],
            "open": round(float(row["open"]), 2),
            "high": round(float(row["high"]), 2),
            "low": round(float(row["low"]), 2),
            "close": round(float(row["close"]), 2),
            "volume": int(row["volume"]) if pd.notna(row["volume"]) else 0,
        })

    markers = []
    if not signals_df.empty:
        for _, sig in signals_df.iterrows():
            if sig["signal"] == "BUY":
                markers.append({
                    "time": str(sig["date"])[:10],
                    "position": "belowBar",
                    "color": "#00c853",
                    "shape": "arrowUp",
                    "text": f"BUY ({sig['confidence']:.0f}%)",
                })
            elif sig["signal"] == "SELL":
                markers.append({
                    "time": str(sig["date"])[:10],
                    "position": "aboveBar",
                    "color": "#ff1744",
                    "shape": "arrowDown",
                    "text": f"SELL ({sig['confidence']:.0f}%)",
                })

    return {"symbol": symbol, "candles": candles, "markers": markers}


@app.get("/api/signals/latest")
def get_latest_signals():
    """Latest signals for all stocks, sorted by confidence."""
    import db
    signals_df = db.get_latest_signals()
    if signals_df.empty:
        return {"signals": [], "count": 0}

    signals = []
    for _, row in signals_df.iterrows():
        signals.append({
            "symbol": row["symbol"],
            "name": row["symbol"].replace(".NS", ""),
            "date": str(row["date"]),
            "signal": row["signal"],
            "confidence": float(row["confidence"]),
            "model_probability": float(row["model_probability"]),
            "entry_price": float(row["entry_price"]),
            "stop_loss": float(row["stop_loss"]),
            "target_price": float(row["target_price"]),
            "composite_score": float(row["composite_score"]),
        })

    return {"signals": signals, "count": len(signals)}


@app.get("/api/backtest/{symbol}")
def get_backtest_results(symbol: str):
    """Get backtest results for a stock."""
    import db

    if not symbol.endswith(".NS") and not symbol.startswith("^"):
        symbol = symbol + ".NS"

    result = db.get_backtest_result(symbol)
    if result is None:
        raise HTTPException(status_code=404, detail=f"No backtest results for {symbol}")

    return result


@app.get("/api/market-overview")
def get_market_overview():
    """NIFTY 50 index data, PCR, market breadth — with live prices."""
    import db
    from option_chain import get_market_sentiment
    from live_prices import fetch_live_prices, is_market_open

    overview = {"timestamp": datetime.now(IST).isoformat(), "market_open": is_market_open()}

    live = fetch_live_prices()

    # Index data — prefer live prices
    for idx_symbol in INDEX_SYMBOLS:
        name = "nifty50" if idx_symbol == "^NSEI" else "banknifty"
        lp = live.get(idx_symbol)
        if lp:
            overview[name] = {
                "value": lp["price"],
                "change": lp["change"],
                "change_pct": lp["change_pct"],
                "high": lp["high"],
                "low": lp["low"],
                "prev_close": lp["prev_close"],
                "live": True,
            }
        else:
            price_df = db.get_stock_data(idx_symbol)
            if not price_df.empty:
                latest = price_df.iloc[-1]
                overview[name] = {
                    "value": float(latest["close"]),
                    "date": str(latest["date"]),
                    "live": False,
                }
                if len(price_df) > 1:
                    prev = float(price_df.iloc[-2]["close"])
                    overview[name]["change"] = round(float(latest["close"]) - prev, 2)
                    overview[name]["change_pct"] = round(((float(latest["close"]) - prev) / prev) * 100, 2)

    # Market sentiment (PCR)
    sentiment = get_market_sentiment()
    overview["sentiment"] = sentiment

    # Market breadth from signals
    signals_df = db.get_latest_signals()
    if not signals_df.empty:
        bullish = len(signals_df[signals_df["signal"] == "BUY"])
        bearish = len(signals_df[signals_df["signal"] == "SELL"])
        neutral = len(signals_df[signals_df["signal"] == "HOLD"])
        overview["breadth"] = {
            "bullish": bullish,
            "bearish": bearish,
            "neutral": neutral,
            "total": len(signals_df),
        }

    return overview


@app.post("/api/retrain")
async def retrain_models(background_tasks: BackgroundTasks):
    """Trigger model retraining in the background."""
    from model import train_all_models

    def _retrain():
        logger.info("Manual retrain triggered")
        train_all_models(optimize=False)
        logger.info("Manual retrain complete")

    background_tasks.add_task(_retrain)
    return {"status": "Retraining started in background"}


@app.post("/api/refresh-data")
async def refresh_data(background_tasks: BackgroundTasks):
    """Trigger data refresh in the background."""
    from data_fetcher import fetch_all_stocks
    from signals import generate_all_signals

    def _refresh():
        logger.info("Manual data refresh triggered")
        fetch_all_stocks(incremental=True)
        generate_all_signals()
        logger.info("Manual refresh complete")

    background_tasks.add_task(_refresh)
    return {"status": "Data refresh started in background"}


@app.get("/api/training-metrics")
def get_training_metrics():
    """Get the latest training metrics for all models."""
    import json
    from config import MODEL_DIR

    metrics = {}
    for path in MODEL_DIR.glob("*_metrics.json"):
        try:
            with open(path) as f:
                data = json.load(f)
            symbol = data.get("symbol", path.stem.replace("_metrics", ""))
            metrics[symbol] = data
        except Exception as e:
            logger.error("Error reading metrics from %s: %s", path, e)

    return {"metrics": metrics, "count": len(metrics)}


# ─── Entry Point ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

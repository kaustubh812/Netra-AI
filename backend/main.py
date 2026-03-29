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
from fastapi.responses import StreamingResponse

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


# ─── Watchlist Endpoints ──────────────────────────────────────────────────

@app.get("/api/watchlists")
def get_watchlists_endpoint():
    """Get all watchlists."""
    from watchlists import get_all_watchlists
    watchlists = get_all_watchlists()
    return {"watchlists": watchlists, "count": len(watchlists)}


@app.get("/api/watchlists/{watchlist_id}")
def get_watchlist_endpoint(watchlist_id: int):
    """Get a watchlist with stocks and signal summary."""
    from watchlists import get_watchlist
    wl = get_watchlist(watchlist_id)
    if not wl:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    return wl


@app.post("/api/watchlists")
def create_watchlist_endpoint(name: str, description: str = ""):
    """Create a new watchlist."""
    from watchlists import create_watchlist
    wl_id = create_watchlist(name, description)
    return {"status": "created", "id": wl_id}


@app.delete("/api/watchlists/{watchlist_id}")
def delete_watchlist_endpoint(watchlist_id: int):
    """Delete a watchlist."""
    from watchlists import delete_watchlist
    ok = delete_watchlist(watchlist_id)
    if not ok:
        raise HTTPException(status_code=400, detail="Cannot delete default watchlist")
    return {"status": "deleted"}


@app.post("/api/watchlists/{watchlist_id}/add")
def add_to_watchlist_endpoint(watchlist_id: int, symbol: str):
    """Add a stock to a watchlist."""
    from watchlists import add_to_watchlist
    add_to_watchlist(watchlist_id, symbol)
    return {"status": "added"}


@app.delete("/api/watchlists/{watchlist_id}/remove")
def remove_from_watchlist_endpoint(watchlist_id: int, symbol: str):
    """Remove a stock from a watchlist."""
    from watchlists import remove_from_watchlist
    remove_from_watchlist(watchlist_id, symbol)
    return {"status": "removed"}


# ─── Signal Performance Endpoint ─────────────────────────────────────────

@app.get("/api/signal-performance/{symbol}")
def get_signal_performance_endpoint(symbol: str):
    """Get historical signal performance metrics for a stock."""
    from signal_performance import get_signal_performance

    if not symbol.endswith(".NS") and not symbol.startswith("^"):
        symbol = symbol + ".NS"

    return get_signal_performance(symbol)


# ─── Correlation Matrix Endpoint ─────────────────────────────────────────

@app.get("/api/correlation")
def get_correlation_endpoint(lookback: int = 60):
    """Get pairwise correlation matrix for all stocks."""
    from analytics import get_correlation_matrix
    return get_correlation_matrix(lookback)


# ─── Data Export Endpoints ───────────────────────────────────────────────

@app.get("/api/export/signals")
def export_signals_csv():
    """Export latest signals as CSV."""
    from analytics import export_signals_csv
    from fastapi.responses import Response
    csv_data = export_signals_csv()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=netra_signals.csv"},
    )


@app.get("/api/export/screener")
def export_screener_csv(signal: Optional[str] = None, sector: Optional[str] = None):
    """Export screener results as CSV."""
    from analytics import export_screener_csv
    from fastapi.responses import Response
    csv_data = export_screener_csv(signal_filter=signal, sector=sector)
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=netra_screener.csv"},
    )


@app.get("/api/alerts")
def get_alerts_endpoint(limit: int = 50):
    """Get recent triggered alerts."""
    from alerts import get_recent_alerts, get_unread_count
    alerts = get_recent_alerts(limit)
    unread = get_unread_count()
    return {"alerts": alerts, "count": len(alerts), "unread": unread}


@app.post("/api/alerts/read")
def mark_alerts_read_endpoint():
    """Mark all alerts as read."""
    from alerts import mark_alerts_read
    mark_alerts_read()
    return {"status": "ok"}


@app.get("/api/alerts/rules")
def get_alert_rules_endpoint():
    """Get all alert rules."""
    from alerts import get_alert_rules
    rules = get_alert_rules()
    return {"rules": rules, "count": len(rules)}


@app.post("/api/alerts/rules")
def create_alert_rule_endpoint(
    symbol: Optional[str] = None,
    alert_type: str = "price_cross",
    price: Optional[float] = None,
    direction: str = "above",
):
    """Create a new alert rule."""
    from alerts import create_alert_rule
    conditions = {}
    if alert_type == "price_cross":
        conditions = {"price": price, "direction": direction}
    rule_id = create_alert_rule(symbol, alert_type, conditions)
    return {"status": "created", "rule_id": rule_id}


@app.delete("/api/alerts/rules/{rule_id}")
def delete_alert_rule_endpoint(rule_id: int):
    """Delete an alert rule."""
    from alerts import delete_alert_rule
    delete_alert_rule(rule_id)
    return {"status": "deleted"}


@app.post("/api/alerts/scan")
async def scan_alerts_endpoint(background_tasks: BackgroundTasks):
    """Manually trigger alert scan."""
    from alerts import scan_for_alerts

    def _scan():
        logger.info("Manual alert scan triggered")
        scan_for_alerts()
        logger.info("Manual alert scan complete")

    background_tasks.add_task(_scan)
    return {"status": "Alert scan started"}


@app.get("/api/stream")
async def live_stream():
    """Server-Sent Events stream for live prices, signals, and news."""
    import asyncio
    import json

    async def event_generator():
        while True:
            try:
                from live_prices import fetch_live_prices, is_market_open

                # Send live prices
                prices = fetch_live_prices()
                market_open = is_market_open()
                yield f"event: prices\ndata: {json.dumps({'prices': prices, 'market_open': market_open, 'timestamp': datetime.now(IST).isoformat()})}\n\n"

                # Send latest signals summary (less frequent)
                import db as _db
                signals_df = _db.get_latest_signals()
                if not signals_df.empty:
                    buy_count = len(signals_df[signals_df["signal"] == "BUY"])
                    sell_count = len(signals_df[signals_df["signal"] == "SELL"])
                    hold_count = len(signals_df[signals_df["signal"] == "HOLD"])
                    yield f"event: breadth\ndata: {json.dumps({'buy': buy_count, 'sell': sell_count, 'hold': hold_count})}\n\n"

                # Send latest news headlines
                news = _db.get_market_news_sentiment(hours=6)
                headlines = [
                    {
                        "headline": n["headline"],
                        "source": n["source"],
                        "symbol": n["symbol"],
                        "sentiment": n["sentiment_score"],
                        "time": n["fetched_at"],
                    }
                    for n in news[:15]
                ]
                yield f"event: news\ndata: {json.dumps({'headlines': headlines})}\n\n"

            except Exception as e:
                logger.error("SSE stream error: %s", e)
                yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

            # Wait before next update (30s during market hours, 5min otherwise)
            from live_prices import is_market_open as _is_open
            interval = 30 if _is_open() else 300
            await asyncio.sleep(interval)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/fii-dii")
def get_fii_dii_endpoint():
    """Get FII/DII institutional flow data."""
    from fii_dii import get_fii_dii_flows
    return get_fii_dii_flows()


@app.get("/api/peer-comparison/{symbol}")
def get_peer_comparison(symbol: str):
    """Get peer comparison / relative valuation for a stock's sector."""
    import db
    from config import NIFTY_50_STOCKS

    if not symbol.endswith(".NS") and not symbol.startswith("^"):
        symbol = symbol + ".NS"

    # Get the target stock's sector
    fund = db.get_fundamentals(symbol)
    if not fund or not fund.get("sector"):
        return {"peers": [], "sector": None, "count": 0}

    target_sector = fund["sector"]

    # Find all stocks in the same sector
    peers = []
    for sym in NIFTY_50_STOCKS:
        f = db.get_fundamentals(sym)
        if f and f.get("sector") == target_sector:
            peers.append({
                "symbol": sym,
                "name": sym.replace(".NS", ""),
                "pe": f.get("trailingPE"),
                "pb": f.get("priceToBook"),
                "roe": f.get("returnOnEquity"),
                "de": f.get("debtToEquity"),
                "market_cap": f.get("marketCap"),
                "profit_margin": f.get("profitMargins"),
                "revenue_growth": f.get("revenueGrowth"),
                "earnings_growth": f.get("earningsGrowth"),
                "dividend_yield": f.get("dividendYield"),
                "beta": f.get("beta"),
                "is_target": sym == symbol,
            })

    # Calculate sector medians
    def median(values):
        v = sorted([x for x in values if x is not None])
        if not v:
            return None
        mid = len(v) // 2
        return v[mid] if len(v) % 2 else (v[mid - 1] + v[mid]) / 2

    metrics = ["pe", "pb", "roe", "de", "profit_margin", "revenue_growth"]
    medians = {}
    for m in metrics:
        vals = [p[m] for p in peers if p[m] is not None]
        medians[m] = median(vals)

    return {
        "peers": peers,
        "sector": target_sector,
        "medians": medians,
        "count": len(peers),
    }


@app.get("/api/calendar/economic")
def get_economic_calendar_endpoint():
    """Get Indian economic calendar events."""
    from calendar_data import get_economic_calendar
    events = get_economic_calendar()
    return {"events": events, "count": len(events)}


@app.get("/api/calendar/earnings")
def get_earnings_calendar_endpoint():
    """Get NIFTY 50 earnings calendar."""
    from calendar_data import get_earnings_calendar
    earnings = get_earnings_calendar()
    return {"earnings": earnings, "count": len(earnings)}


@app.get("/api/screener")
def get_screener(
    signal: Optional[str] = None,
    min_confidence: Optional[float] = None,
    max_confidence: Optional[float] = None,
    min_composite: Optional[float] = None,
    max_composite: Optional[float] = None,
    min_rsi: Optional[float] = None,
    max_rsi: Optional[float] = None,
    supertrend: Optional[int] = None,
    min_pe: Optional[float] = None,
    max_pe: Optional[float] = None,
    min_roe: Optional[float] = None,
    max_de: Optional[float] = None,
    min_market_cap: Optional[float] = None,
    sector: Optional[str] = None,
    sort_by: str = "confidence",
    sort_asc: bool = False,
):
    """Multi-criteria stock screener."""
    from screener import run_screener, get_available_sectors

    results = run_screener(
        signal_filter=signal,
        min_confidence=min_confidence,
        max_confidence=max_confidence,
        min_composite=min_composite,
        max_composite=max_composite,
        min_rsi=min_rsi,
        max_rsi=max_rsi,
        supertrend_direction=supertrend,
        min_pe=min_pe,
        max_pe=max_pe,
        min_roe=min_roe,
        max_de=max_de,
        min_market_cap=min_market_cap,
        sector=sector,
        sort_by=sort_by,
        sort_asc=sort_asc,
    )

    sectors = get_available_sectors()
    return {"results": results, "count": len(results), "total": 56, "sectors": sectors}


# ─── Paper Trading Endpoints ──────────────────────────────────────────────

@app.get("/api/paper-trading/positions")
def get_paper_positions():
    """Get open paper trading positions with live P&L."""
    from paper_trading import get_open_positions
    positions = get_open_positions()
    return {"positions": positions, "count": len(positions)}


@app.post("/api/paper-trading/trade")
def place_paper_trade(
    symbol: str,
    trade_type: str,
    quantity: float,
    price: float,
    stop_loss: Optional[float] = None,
    target_price: Optional[float] = None,
    signal_confidence: Optional[float] = None,
    notes: Optional[str] = None,
):
    """Place a new paper trade."""
    import db as _db

    if trade_type not in ("BUY", "SELL"):
        raise HTTPException(status_code=400, detail="trade_type must be BUY or SELL")
    if quantity <= 0:
        raise HTTPException(status_code=400, detail="quantity must be positive")
    if price <= 0:
        raise HTTPException(status_code=400, detail="price must be positive")

    if not symbol.endswith(".NS") and not symbol.startswith("^"):
        symbol = symbol + ".NS"

    trade_date = datetime.now(IST).strftime("%Y-%m-%d")
    trade_id = _db.save_paper_trade(
        symbol=symbol, trade_type=trade_type, quantity=quantity,
        entry_price=price, trade_date=trade_date,
        signal_confidence=signal_confidence, stop_loss=stop_loss,
        target_price=target_price, notes=notes,
    )
    return {"status": "placed", "id": trade_id, "trade_date": trade_date}


@app.post("/api/paper-trading/close/{trade_id}")
def close_paper_trade_endpoint(trade_id: int, exit_price: float):
    """Close an open paper trade."""
    from paper_trading import close_position
    result = close_position(trade_id, exit_price)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@app.get("/api/paper-trading/history")
def get_paper_trade_history(limit: int = 50):
    """Get closed paper trades."""
    import db as _db
    trades = _db.get_closed_paper_trades(limit)
    results = []
    for t in trades:
        invested = t["entry_price"] * t["quantity"]
        pnl_pct = round(t["pnl"] / invested * 100, 2) if t["pnl"] is not None and invested > 0 else None
        results.append({
            "id": t["id"],
            "symbol": t["symbol"],
            "name": t["symbol"].replace(".NS", ""),
            "trade_type": t["trade_type"],
            "quantity": t["quantity"],
            "entry_price": t["entry_price"],
            "exit_price": t["exit_price"],
            "pnl": t["pnl"],
            "pnl_pct": pnl_pct,
            "trade_date": t["trade_date"],
            "closed_date": t["closed_date"],
            "signal_confidence": t["signal_confidence"],
            "status": t["status"],
        })
    return {"trades": results, "count": len(results)}


@app.get("/api/paper-trading/stats")
def get_paper_trading_stats():
    """Get paper trading performance statistics."""
    from paper_trading import get_performance_stats
    return get_performance_stats()


@app.get("/api/paper-trading/suggestions")
def get_paper_trade_suggestions():
    """Get signal-based trade suggestions for paper trading."""
    from paper_trading import get_trade_suggestions
    suggestions = get_trade_suggestions()
    return {"suggestions": suggestions, "count": len(suggestions)}


# ─── Portfolio Endpoints ──────────────────────────────────────────────────

@app.get("/api/portfolio")
def get_portfolio_endpoint():
    """Get all portfolio holdings with P&L."""
    from portfolio import get_portfolio_with_pnl
    holdings = get_portfolio_with_pnl()
    return {"holdings": holdings, "count": len(holdings)}


@app.post("/api/portfolio/add")
def add_portfolio_holding_endpoint(
    symbol: str, quantity: float, purchase_price: float,
    purchase_date: Optional[str] = None, notes: Optional[str] = None,
):
    """Add a holding to portfolio."""
    import db as _db
    if not symbol.endswith(".NS") and not symbol.startswith("^"):
        symbol = symbol + ".NS"
    row_id = _db.save_portfolio_holding(symbol, quantity, purchase_price, purchase_date, notes)
    return {"status": "added", "id": row_id}


@app.delete("/api/portfolio/{holding_id}")
def delete_portfolio_holding_endpoint(holding_id: int):
    """Delete a portfolio holding."""
    import db as _db
    ok = _db.delete_portfolio_holding(holding_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Holding not found")
    return {"status": "deleted"}


@app.get("/api/portfolio/summary")
def get_portfolio_summary_endpoint():
    """Get aggregated portfolio summary."""
    from portfolio import get_portfolio_summary, get_sector_exposure
    return {
        "summary": get_portfolio_summary(),
        "sector_exposure": get_sector_exposure(),
    }


# ─── Options Chain Endpoint ──────────────────────────────────────────────

@app.get("/api/options/{symbol}")
def get_options_chain_endpoint(symbol: str, expiry: Optional[str] = None):
    """Get full option chain with Greeks for an index."""
    from option_chain import get_full_option_chain
    chain = get_full_option_chain(symbol, expiry)
    if not chain:
        raise HTTPException(status_code=404, detail=f"No option chain data for {symbol}")
    return chain


# ─── Analyst Estimates Endpoint ──────────────────────────────────────────

@app.get("/api/analyst/{symbol}")
def get_analyst_estimates_endpoint(symbol: str):
    """Get analyst price targets and recommendations."""
    from fundamentals import get_analyst_estimates
    if not symbol.endswith(".NS") and not symbol.startswith("^"):
        symbol = symbol + ".NS"
    return get_analyst_estimates(symbol)


# ─── Sector Detail Endpoint ─────────────────────────────────────────────

@app.get("/api/sectors/detail/{sector_name}")
def get_sector_detail_endpoint(sector_name: str):
    """Get detailed sector info with constituent stocks."""
    from sector_rotation import get_sector_detail
    return get_sector_detail(sector_name)


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

    # News sentiment
    from news_sentiment import get_stock_news
    result["news"] = get_stock_news(symbol)

    # Fundamentals
    from fundamentals import get_stock_fundamentals
    result["fundamentals"] = get_stock_fundamentals(symbol)

    return result


@app.get("/api/stock/{symbol}/chart")
def get_stock_chart(symbol: str, period: str = "1Y", interval: Optional[str] = None):
    """OHLCV candlestick data with signal markers for charting."""
    import db
    from data_fetcher import fetch_stock_history

    if not symbol.endswith(".NS") and not symbol.startswith("^"):
        symbol = symbol + ".NS"

    # Custom interval mapping (new intraday intervals)
    custom_interval_map = {
        "5m": ("5d", "5m"),
        "15m": ("5d", "15m"),
        "1h": ("1mo", "1h"),
    }

    # Intraday periods fetched live from yfinance (not stored in DB)
    intraday_map = {
        "1D": ("1d", "1m"),
        "1W": ("5d", "5m"),
    }
    # Daily periods from DB
    daily_map = {"1M": 22, "3M": 66, "6M": 132, "1Y": 252, "5Y": 1260}

    is_custom_interval = interval in custom_interval_map
    is_intraday = period in intraday_map and not is_custom_interval

    if is_custom_interval:
        yf_period, yf_interval = custom_interval_map[interval]
        price_df = fetch_stock_history(symbol, period=yf_period, interval=yf_interval)
        if price_df.empty:
            raise HTTPException(status_code=404, detail=f"No intraday data for {symbol}")
    elif is_intraday:
        yf_period, yf_interval = intraday_map[period]
        price_df = fetch_stock_history(symbol, period=yf_period, interval=yf_interval)
        if price_df.empty:
            raise HTTPException(status_code=404, detail=f"No intraday data for {symbol}")
    else:
        price_df = db.get_stock_data(symbol)
        if price_df.empty:
            raise HTTPException(status_code=404, detail=f"No data for {symbol}")
        days = daily_map.get(period, 252)
        price_df = price_df.tail(days)

    # Get signals for overlay (daily signals only)
    days = daily_map.get(period, 22)
    signals_df = db.get_signal_history(symbol, limit=days)

    candles = []
    for _, row in price_df.iterrows():
        if is_intraday:
            # Unix timestamp for intraday (lightweight-charts needs seconds)
            ts = pd.Timestamp(row["date"])
            time_val = int(ts.timestamp())
        else:
            time_val = str(row["date"])[:10]
        candles.append({
            "time": time_val,
            "open": round(float(row["open"]), 2),
            "high": round(float(row["high"]), 2),
            "low": round(float(row["low"]), 2),
            "close": round(float(row["close"]), 2),
            "volume": int(row["volume"]) if pd.notna(row["volume"]) else 0,
        })

    # Only show the LATEST signal as a marker on the chart
    markers = []
    if not signals_df.empty:
        # signals_df is already sorted by date DESC, so first row is the latest
        sig = signals_df.iloc[0]
        date_str = str(sig["date"])[:10]
        if sig["signal"] == "BUY":
            markers.append({
                "time": date_str,
                "position": "belowBar",
                "color": "#00c853",
                "shape": "arrowUp",
                "text": f"BUY ({sig['confidence']:.0f}%)",
            })
        elif sig["signal"] == "SELL":
            markers.append({
                "time": date_str,
                "position": "aboveBar",
                "color": "#ff1744",
                "shape": "arrowDown",
                "text": f"SELL ({sig['confidence']:.0f}%)",
            })

    # Calculate VWAP for intraday intervals
    vwap_data = []
    if is_custom_interval or is_intraday:
        cum_vol = 0
        cum_tp_vol = 0
        for _, row in price_df.iterrows():
            vol = int(row["volume"]) if pd.notna(row["volume"]) else 0
            tp = (float(row["high"]) + float(row["low"]) + float(row["close"])) / 3
            cum_vol += vol
            cum_tp_vol += tp * vol
            vwap_val = round(cum_tp_vol / cum_vol, 2) if cum_vol > 0 else 0
            ts = pd.Timestamp(row["date"])
            vwap_data.append({"time": int(ts.timestamp()), "value": vwap_val})

    return {"symbol": symbol, "candles": candles, "markers": markers, "vwap": vwap_data}


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


@app.get("/api/fundamentals/{symbol}")
def get_fundamentals_endpoint(symbol: str):
    """Get fundamental analysis for a stock."""
    from fundamentals import get_stock_fundamentals

    if not symbol.endswith(".NS") and not symbol.startswith("^"):
        symbol = symbol + ".NS"

    return get_stock_fundamentals(symbol)


@app.get("/api/regime")
def get_regime_endpoint():
    """Get current market regime detection."""
    from regime_detector import detect_nifty_regime
    return detect_nifty_regime()


@app.get("/api/sectors")
def get_sectors_endpoint():
    """Get sector rotation momentum scores."""
    from sector_rotation import get_cached_sector_scores
    scores = get_cached_sector_scores()
    return {"sectors": scores, "count": len(scores)}


@app.get("/api/macro")
def get_macro_endpoint():
    """Get macro environment indicators and score."""
    from macro_signals import get_macro_overview
    return get_macro_overview()


@app.post("/api/fundamentals/refresh")
async def refresh_fundamentals(background_tasks: BackgroundTasks):
    """Trigger fundamentals refresh in background."""
    from fundamentals import fetch_all_fundamentals

    def _fetch():
        logger.info("Manual fundamentals refresh triggered")
        fetch_all_fundamentals()
        logger.info("Manual fundamentals refresh complete")

    background_tasks.add_task(_fetch)
    return {"status": "Fundamentals refresh started"}


@app.get("/api/news/market/overview")
def get_market_news_endpoint():
    """Get overall market news sentiment."""
    from news_sentiment import get_market_news
    return get_market_news()


@app.get("/api/news/{symbol}")
def get_stock_news_endpoint(symbol: str):
    """Get recent news + sentiment for a specific stock."""
    from news_sentiment import get_stock_news

    if not symbol.endswith(".NS") and not symbol.startswith("^"):
        symbol = symbol + ".NS"

    return get_stock_news(symbol)


@app.post("/api/news/refresh")
async def refresh_news(background_tasks: BackgroundTasks):
    """Trigger news sentiment fetch in the background."""
    from news_sentiment import fetch_and_score_news

    def _fetch():
        logger.info("Manual news refresh triggered")
        fetch_and_score_news()
        logger.info("Manual news refresh complete")

    background_tasks.add_task(_fetch)
    return {"status": "News sentiment refresh started"}


@app.post("/api/retrain")
async def retrain_models(background_tasks: BackgroundTasks):
    """Trigger model retraining in the background (XGBoost ensemble + LSTM)."""
    from model import train_all_models
    from lstm_model import train_all_lstm, HAS_TORCH

    def _retrain():
        logger.info("Manual retrain triggered")
        train_all_models(optimize=False)
        if HAS_TORCH:
            logger.info("Training LSTM models...")
            train_all_lstm()
        logger.info("Manual retrain complete")

    background_tasks.add_task(_retrain)
    return {"status": "Retraining started in background (ensemble + LSTM)"}


@app.post("/api/meta-model/train")
async def train_meta_model_endpoint(background_tasks: BackgroundTasks):
    """Train the meta-model on historical signal data."""
    from meta_model import train_meta_model

    def _train():
        logger.info("Meta-model training triggered")
        result = train_meta_model()
        if result:
            logger.info("Meta-model training complete: accuracy=%.4f", result["accuracy"])
        else:
            logger.warning("Meta-model training failed (insufficient data)")

    background_tasks.add_task(_train)
    return {"status": "Meta-model training started"}


@app.get("/api/meta-model/metrics")
def get_meta_model_metrics():
    """Get meta-model performance metrics."""
    from meta_model import get_meta_metrics
    metrics = get_meta_metrics()
    return {"metrics": metrics, "available": metrics is not None}


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


# ─── Intraday Endpoints ─────────────────────────────────────────────────────

@app.get("/api/intraday/signals/latest")
def get_latest_intraday_signals_endpoint():
    """Latest intraday signals for all stocks, sorted by confidence."""
    import db
    import json as _json

    signals_df = db.get_latest_intraday_signals()
    if signals_df.empty:
        return {"signals": [], "count": 0}

    signals = []
    for _, row in signals_df.iterrows():
        components = {}
        if row.get("components"):
            try:
                components = _json.loads(row["components"])
            except Exception:
                pass
        signals.append({
            "symbol": row["symbol"],
            "name": row["symbol"].replace(".NS", ""),
            "datetime": str(row["datetime"]),
            "signal": row["signal"],
            "confidence": float(row["confidence"]),
            "composite_score": float(row["composite_score"]),
            "entry_price": float(row["entry_price"]),
            "stop_loss": float(row["stop_loss"]),
            "target_price": float(row["target_price"]),
            "components": components,
            "regime": row.get("regime", ""),
        })

    return {"signals": signals, "count": len(signals)}


@app.get("/api/intraday/signal/{symbol}")
def get_intraday_signal_endpoint(symbol: str):
    """Get the latest intraday signal for a single stock."""
    import db
    import json as _json

    if not symbol.endswith(".NS") and not symbol.startswith("^"):
        symbol = symbol + ".NS"

    sig = db.get_intraday_signal(symbol)
    if sig is None:
        raise HTTPException(status_code=404, detail=f"No intraday signal for {symbol}")

    components = {}
    if sig.get("components"):
        try:
            components = _json.loads(sig["components"])
        except Exception:
            pass

    return {
        "symbol": sig["symbol"],
        "name": sig["symbol"].replace(".NS", ""),
        "datetime": str(sig["datetime"]),
        "signal": sig["signal"],
        "confidence": float(sig["confidence"]),
        "composite_score": float(sig["composite_score"]),
        "entry_price": float(sig["entry_price"]),
        "stop_loss": float(sig["stop_loss"]),
        "target_price": float(sig["target_price"]),
        "components": components,
        "regime": sig.get("regime", ""),
    }


@app.post("/api/intraday/seed")
async def seed_intraday_endpoint(background_tasks: BackgroundTasks):
    """Trigger 60-day intraday data seeding in background."""
    from data_fetcher import seed_intraday_data

    def _seed():
        logger.info("Intraday seed triggered")
        results = seed_intraday_data()
        total = sum(v for v in results.values() if v > 0)
        logger.info("Intraday seed complete — %d total rows", total)

    background_tasks.add_task(_seed)
    return {"status": "Intraday data seeding started in background"}


@app.post("/api/intraday/generate")
async def generate_intraday_endpoint(background_tasks: BackgroundTasks):
    """Trigger intraday signal generation."""
    from intraday_signals import generate_all_intraday_signals

    def _generate():
        logger.info("Manual intraday signal generation triggered")
        signals = generate_all_intraday_signals()
        logger.info("Manual intraday signal generation complete — %d signals", len(signals))

    background_tasks.add_task(_generate)
    return {"status": "Intraday signal generation started in background"}


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

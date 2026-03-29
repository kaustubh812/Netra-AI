"""
Netra — Database Layer
SQLite database setup, connection management, and query helpers.
"""

import sqlite3
import logging
from contextlib import contextmanager
from datetime import date, datetime
from typing import Optional

import pandas as pd

from config import DB_PATH

logger = logging.getLogger(__name__)


def get_connection() -> sqlite3.Connection:
    """Get a SQLite connection with row factory enabled."""
    conn = sqlite3.connect(str(DB_PATH), detect_types=sqlite3.PARSE_DECLTYPES)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def get_db():
    """Context manager for database connections."""
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Create all tables if they don't exist."""
    with get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS stock_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol TEXT NOT NULL,
                date DATE NOT NULL,
                open REAL,
                high REAL,
                low REAL,
                close REAL,
                volume INTEGER,
                UNIQUE(symbol, date)
            );

            CREATE TABLE IF NOT EXISTS indicators (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol TEXT NOT NULL,
                date DATE NOT NULL,
                rsi REAL, macd REAL, macd_signal REAL, macd_hist REAL,
                sma_20 REAL, sma_50 REAL, sma_200 REAL,
                ema_12 REAL, ema_26 REAL,
                bb_upper REAL, bb_middle REAL, bb_lower REAL,
                supertrend REAL, supertrend_direction INTEGER,
                vwap REAL, adx REAL, atr REAL, obv REAL,
                stoch_k REAL, stoch_d REAL,
                volume_sma_20 REAL,
                high_52w REAL, low_52w REAL,
                UNIQUE(symbol, date)
            );

            CREATE TABLE IF NOT EXISTS signals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol TEXT NOT NULL,
                date DATE NOT NULL,
                signal TEXT NOT NULL,
                confidence REAL,
                model_probability REAL,
                entry_price REAL,
                stop_loss REAL,
                target_price REAL,
                composite_score REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(symbol, date)
            );

            CREATE TABLE IF NOT EXISTS backtest_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol TEXT NOT NULL,
                total_return REAL,
                buy_hold_return REAL,
                sharpe_ratio REAL,
                max_drawdown REAL,
                win_rate REAL,
                total_trades INTEGER,
                avg_profit REAL,
                avg_loss REAL,
                equity_curve TEXT,
                last_run TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(symbol)
            );

            CREATE TABLE IF NOT EXISTS fundamentals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol TEXT NOT NULL,
                trailingPE REAL, forwardPE REAL, priceToBook REAL,
                returnOnEquity REAL, returnOnAssets REAL,
                marketCap REAL, enterpriseValue REAL,
                debtToEquity REAL, currentRatio REAL,
                revenueGrowth REAL, earningsGrowth REAL,
                profitMargins REAL, operatingMargins REAL,
                dividendYield REAL, bookValue REAL,
                earningsQuarterlyGrowth REAL, pegRatio REAL,
                trailingEps REAL, forwardEps REAL,
                sector TEXT, industry TEXT, beta REAL,
                fiftyTwoWeekHigh REAL, fiftyTwoWeekLow REAL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(symbol)
            );

            CREATE TABLE IF NOT EXISTS macro_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                indicator TEXT NOT NULL,
                name TEXT,
                symbol TEXT,
                price REAL, change REAL, change_pct REAL,
                weekly_change_pct REAL,
                high REAL, low REAL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(indicator)
            );

            CREATE TABLE IF NOT EXISTS news_sentiment (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol TEXT NOT NULL,
                headline TEXT NOT NULL,
                source TEXT,
                url TEXT,
                sentiment_score REAL,
                reasoning TEXT,
                fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(symbol, headline)
            );

            CREATE TABLE IF NOT EXISTS intraday_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol TEXT NOT NULL,
                datetime TEXT NOT NULL,
                open REAL,
                high REAL,
                low REAL,
                close REAL,
                volume INTEGER,
                UNIQUE(symbol, datetime)
            );

            CREATE TABLE IF NOT EXISTS intraday_signals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol TEXT NOT NULL,
                datetime TEXT NOT NULL,
                signal TEXT NOT NULL,
                confidence REAL,
                composite_score REAL,
                entry_price REAL,
                stop_loss REAL,
                target_price REAL,
                components TEXT,
                regime TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(symbol, datetime)
            );

            CREATE INDEX IF NOT EXISTS idx_stock_data_symbol_date ON stock_data(symbol, date);
            CREATE INDEX IF NOT EXISTS idx_indicators_symbol_date ON indicators(symbol, date);
            CREATE INDEX IF NOT EXISTS idx_signals_symbol_date ON signals(symbol, date);
            CREATE INDEX IF NOT EXISTS idx_news_sentiment_symbol ON news_sentiment(symbol, fetched_at);
            CREATE INDEX IF NOT EXISTS idx_intraday_data_symbol_dt ON intraday_data(symbol, datetime);
            CREATE INDEX IF NOT EXISTS idx_intraday_signals_symbol_dt ON intraday_signals(symbol, datetime);

            CREATE TABLE IF NOT EXISTS portfolio_holdings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol TEXT NOT NULL,
                quantity REAL NOT NULL,
                purchase_price REAL NOT NULL,
                purchase_date TEXT,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS paper_trades (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol TEXT NOT NULL,
                trade_type TEXT NOT NULL,
                quantity REAL NOT NULL,
                entry_price REAL NOT NULL,
                exit_price REAL,
                trade_date TEXT NOT NULL,
                closed_date TEXT,
                status TEXT DEFAULT 'OPEN',
                pnl REAL,
                signal_confidence REAL,
                stop_loss REAL,
                target_price REAL,
                notes TEXT,
                order_type TEXT DEFAULT 'MARKET',
                product_type TEXT DEFAULT 'DELIVERY',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_paper_trades_status ON paper_trades(status);
            CREATE INDEX IF NOT EXISTS idx_paper_trades_symbol ON paper_trades(symbol);
        """)

        # Migration: add order_type and product_type columns if missing
        try:
            conn.execute("ALTER TABLE paper_trades ADD COLUMN order_type TEXT DEFAULT 'MARKET'")
        except Exception:
            pass  # column already exists
        try:
            conn.execute("ALTER TABLE paper_trades ADD COLUMN product_type TEXT DEFAULT 'DELIVERY'")
        except Exception:
            pass  # column already exists

    logger.info("Database initialized at %s", DB_PATH)


# ─── Stock Data Helpers ──────────────────────────────────────────────────────

def save_stock_data(df: pd.DataFrame, symbol: str):
    """Save OHLCV DataFrame to stock_data table (upsert)."""
    if df.empty:
        return
    with get_db() as conn:
        for _, row in df.iterrows():
            conn.execute(
                """INSERT OR REPLACE INTO stock_data (symbol, date, open, high, low, close, volume)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (symbol, row["date"], row["open"], row["high"], row["low"], row["close"], row["volume"])
            )
    logger.info("Saved %d rows of stock data for %s", len(df), symbol)


def get_stock_data(symbol: str, start_date: Optional[str] = None, end_date: Optional[str] = None) -> pd.DataFrame:
    """Load OHLCV data for a symbol from DB."""
    query = "SELECT date, open, high, low, close, volume FROM stock_data WHERE symbol = ?"
    params = [symbol]
    if start_date:
        query += " AND date >= ?"
        params.append(start_date)
    if end_date:
        query += " AND date <= ?"
        params.append(end_date)
    query += " ORDER BY date ASC"

    with get_db() as conn:
        df = pd.read_sql_query(query, conn, params=params, parse_dates=["date"])
    return df


def get_latest_date(symbol: str) -> Optional[str]:
    """Get the most recent date we have data for a symbol."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT MAX(date) as max_date FROM stock_data WHERE symbol = ?", (symbol,)
        ).fetchone()
    if row and row["max_date"]:
        return row["max_date"]
    return None


# ─── Indicator Helpers ───────────────────────────────────────────────────────

def save_indicators(df: pd.DataFrame, symbol: str):
    """Save computed indicators to the indicators table."""
    if df.empty:
        return
    cols = [
        "date", "rsi", "macd", "macd_signal", "macd_hist",
        "sma_20", "sma_50", "sma_200", "ema_12", "ema_26",
        "bb_upper", "bb_middle", "bb_lower",
        "supertrend", "supertrend_direction",
        "vwap", "adx", "atr", "obv",
        "stoch_k", "stoch_d", "volume_sma_20",
        "high_52w", "low_52w",
    ]
    with get_db() as conn:
        for _, row in df.iterrows():
            values = [symbol] + [row.get(c) for c in cols]
            placeholders = ", ".join(["?"] * (len(cols) + 1))
            col_names = "symbol, " + ", ".join(cols)
            conn.execute(
                f"INSERT OR REPLACE INTO indicators ({col_names}) VALUES ({placeholders})",
                values,
            )
    logger.info("Saved %d indicator rows for %s", len(df), symbol)


def get_indicators(symbol: str, start_date: Optional[str] = None) -> pd.DataFrame:
    """Load indicators for a symbol from DB."""
    query = "SELECT * FROM indicators WHERE symbol = ?"
    params = [symbol]
    if start_date:
        query += " AND date >= ?"
        params.append(start_date)
    query += " ORDER BY date ASC"

    with get_db() as conn:
        df = pd.read_sql_query(query, conn, params=params, parse_dates=["date"])
    return df


# ─── Signal Helpers ──────────────────────────────────────────────────────────

def save_signal(symbol: str, signal_date: str, signal: str, confidence: float,
                model_prob: float, entry: float, sl: float, target: float, composite: float):
    """Save a generated signal."""
    with get_db() as conn:
        conn.execute(
            """INSERT OR REPLACE INTO signals
               (symbol, date, signal, confidence, model_probability, entry_price, stop_loss, target_price, composite_score)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (symbol, signal_date, signal, confidence, model_prob, entry, sl, target, composite),
        )


def get_latest_signals() -> pd.DataFrame:
    """Get the most recent signal for each stock."""
    query = """
        SELECT s.* FROM signals s
        INNER JOIN (
            SELECT symbol, MAX(date) as max_date FROM signals GROUP BY symbol
        ) latest ON s.symbol = latest.symbol AND s.date = latest.max_date
        ORDER BY s.confidence DESC
    """
    with get_db() as conn:
        return pd.read_sql_query(query, conn)


def get_signal_history(symbol: str, limit: int = 30) -> pd.DataFrame:
    """Get signal history for a stock."""
    query = "SELECT * FROM signals WHERE symbol = ? ORDER BY date DESC LIMIT ?"
    with get_db() as conn:
        return pd.read_sql_query(query, conn, params=[symbol, limit])


# ─── Backtest Helpers ────────────────────────────────────────────────────────

def save_backtest_result(symbol: str, results: dict):
    """Save backtest results for a stock."""
    with get_db() as conn:
        conn.execute(
            """INSERT OR REPLACE INTO backtest_results
               (symbol, total_return, buy_hold_return, sharpe_ratio, max_drawdown,
                win_rate, total_trades, avg_profit, avg_loss, equity_curve)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                symbol, results.get("total_return"), results.get("buy_hold_return"),
                results.get("sharpe_ratio"), results.get("max_drawdown"),
                results.get("win_rate"), results.get("total_trades"),
                results.get("avg_profit"), results.get("avg_loss"),
                results.get("equity_curve", ""),
            ),
        )


def get_backtest_result(symbol: str) -> Optional[dict]:
    """Get backtest results for a stock."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM backtest_results WHERE symbol = ?", (symbol,)
        ).fetchone()
    if row:
        return dict(row)
    return None


# ─── Fundamentals Helpers ────────────────────────────────────────────────────

def save_fundamentals(symbol: str, data: dict):
    """Save fundamental data for a stock (upsert)."""
    cols = [
        "trailingPE", "forwardPE", "priceToBook", "returnOnEquity", "returnOnAssets",
        "marketCap", "enterpriseValue", "debtToEquity", "currentRatio",
        "revenueGrowth", "earningsGrowth", "profitMargins", "operatingMargins",
        "dividendYield", "bookValue", "earningsQuarterlyGrowth", "pegRatio",
        "trailingEps", "forwardEps", "sector", "industry", "beta",
        "fiftyTwoWeekHigh", "fiftyTwoWeekLow",
    ]
    values = [symbol] + [data.get(c) for c in cols]
    placeholders = ", ".join(["?"] * (len(cols) + 1))
    col_names = "symbol, " + ", ".join(cols)
    with get_db() as conn:
        conn.execute(
            f"INSERT OR REPLACE INTO fundamentals ({col_names}) VALUES ({placeholders})",
            values,
        )


def get_fundamentals(symbol: str) -> Optional[dict]:
    """Get fundamentals for a stock."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM fundamentals WHERE symbol = ?", (symbol,)
        ).fetchone()
    if row:
        return dict(row)
    return None


# ─── Macro Data Helpers ──────────────────────────────────────────────────────

def save_macro_data(data: dict):
    """Save macro indicator data (upsert)."""
    with get_db() as conn:
        for key, vals in data.items():
            conn.execute(
                """INSERT OR REPLACE INTO macro_data
                   (indicator, name, symbol, price, change, change_pct, weekly_change_pct, high, low)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (key, vals.get("name"), vals.get("symbol"), vals.get("price"),
                 vals.get("change"), vals.get("change_pct"), vals.get("weekly_change_pct"),
                 vals.get("high"), vals.get("low")),
            )


def get_macro_data() -> list[dict]:
    """Get all macro indicators."""
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM macro_data ORDER BY indicator").fetchall()
    return [dict(r) for r in rows]


# ─── News Sentiment Helpers ──────────────────────────────────────────────────

def save_news_sentiment(symbol: str, headline: str, source: str, url: str,
                        score: float, reasoning: str):
    """Save a scored news headline."""
    with get_db() as conn:
        conn.execute(
            """INSERT OR REPLACE INTO news_sentiment
               (symbol, headline, source, url, sentiment_score, reasoning)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (symbol, headline, source, url, score, reasoning),
        )


def get_latest_sentiment(symbol: str, hours: int = 24) -> list[dict]:
    """Get recent news sentiment for a stock within the last N hours."""
    query = """
        SELECT headline, source, url, sentiment_score, reasoning, fetched_at
        FROM news_sentiment
        WHERE symbol = ? AND fetched_at >= datetime('now', ?)
        ORDER BY fetched_at DESC
    """
    with get_db() as conn:
        rows = conn.execute(query, (symbol, f"-{hours} hours")).fetchall()
    return [dict(r) for r in rows]


def get_aggregate_sentiment(symbol: str, hours: int = 24) -> Optional[float]:
    """Get average sentiment score for a stock over last N hours. Returns None if no data."""
    query = """
        SELECT AVG(sentiment_score) as avg_score, COUNT(*) as cnt
        FROM news_sentiment
        WHERE symbol = ? AND fetched_at >= datetime('now', ?)
    """
    with get_db() as conn:
        row = conn.execute(query, (symbol, f"-{hours} hours")).fetchone()
    if row and row["cnt"] > 0:
        return round(row["avg_score"], 4)
    return None


def get_market_news_sentiment(hours: int = 24) -> list[dict]:
    """Get all recent news with sentiment, across all stocks."""
    query = """
        SELECT symbol, headline, source, url, sentiment_score, reasoning, fetched_at
        FROM news_sentiment
        WHERE fetched_at >= datetime('now', ?)
        ORDER BY fetched_at DESC
        LIMIT 50
    """
    with get_db() as conn:
        rows = conn.execute(query, (f"-{hours} hours",)).fetchall()
    return [dict(r) for r in rows]


# ─── Intraday Data Helpers ──────────────────────────────────────────────────

def save_intraday_data(df: pd.DataFrame, symbol: str):
    """Save 5-minute OHLCV data to intraday_data table (upsert)."""
    if df.empty:
        return
    with get_db() as conn:
        for _, row in df.iterrows():
            conn.execute(
                """INSERT OR REPLACE INTO intraday_data (symbol, datetime, open, high, low, close, volume)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (symbol, str(row["datetime"]), row["open"], row["high"], row["low"], row["close"], row["volume"])
            )
    logger.info("Saved %d intraday rows for %s", len(df), symbol)


def get_intraday_data(symbol: str, limit: int = 500) -> pd.DataFrame:
    """Load intraday 5m candles for a symbol from DB, most recent first."""
    query = "SELECT datetime, open, high, low, close, volume FROM intraday_data WHERE symbol = ? ORDER BY datetime DESC LIMIT ?"
    with get_db() as conn:
        df = pd.read_sql_query(query, conn, params=[symbol, limit])
    if not df.empty:
        df = df.iloc[::-1].reset_index(drop=True)  # chronological order
        df["datetime"] = pd.to_datetime(df["datetime"])
    return df


def get_latest_intraday_datetime(symbol: str) -> Optional[str]:
    """Get the most recent datetime we have intraday data for a symbol."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT MAX(datetime) as max_dt FROM intraday_data WHERE symbol = ?", (symbol,)
        ).fetchone()
    if row and row["max_dt"]:
        return row["max_dt"]
    return None


def save_intraday_signal(symbol: str, dt: str, signal: str, confidence: float,
                         composite: float, entry: float, sl: float, target: float,
                         components: str, regime: str):
    """Save a generated intraday signal."""
    with get_db() as conn:
        conn.execute(
            """INSERT OR REPLACE INTO intraday_signals
               (symbol, datetime, signal, confidence, composite_score, entry_price,
                stop_loss, target_price, components, regime)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (symbol, dt, signal, confidence, composite, entry, sl, target, components, regime),
        )


def get_latest_intraday_signals() -> pd.DataFrame:
    """Get the most recent intraday signal for each stock."""
    query = """
        SELECT s.* FROM intraday_signals s
        INNER JOIN (
            SELECT symbol, MAX(datetime) as max_dt FROM intraday_signals GROUP BY symbol
        ) latest ON s.symbol = latest.symbol AND s.datetime = latest.max_dt
        ORDER BY s.confidence DESC
    """
    with get_db() as conn:
        return pd.read_sql_query(query, conn)


def get_intraday_signal(symbol: str) -> Optional[dict]:
    """Get the latest intraday signal for a single stock."""
    query = """
        SELECT * FROM intraday_signals WHERE symbol = ?
        ORDER BY datetime DESC LIMIT 1
    """
    with get_db() as conn:
        row = conn.execute(query, (symbol,)).fetchone()
    if row:
        return dict(row)
    return None


def cleanup_old_intraday_data(days: int = 30):
    """Remove intraday data older than N days."""
    with get_db() as conn:
        conn.execute(
            "DELETE FROM intraday_data WHERE datetime < datetime('now', ?)",
            (f"-{days} days",),
        )
        conn.execute(
            "DELETE FROM intraday_signals WHERE datetime < datetime('now', ?)",
            (f"-{days} days",),
        )
    logger.info("Cleaned up intraday data older than %d days", days)


# ─── Portfolio Helpers ──────────────────────────────────────────────────────

def save_portfolio_holding(symbol: str, quantity: float, purchase_price: float,
                           purchase_date: Optional[str] = None, notes: Optional[str] = None) -> int:
    """Add a new portfolio holding. Returns the new row id."""
    with get_db() as conn:
        cur = conn.execute(
            """INSERT INTO portfolio_holdings (symbol, quantity, purchase_price, purchase_date, notes)
               VALUES (?, ?, ?, ?, ?)""",
            (symbol, quantity, purchase_price, purchase_date, notes),
        )
        return cur.lastrowid


def get_all_portfolio_holdings() -> list[dict]:
    """Get all portfolio holdings."""
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM portfolio_holdings ORDER BY created_at DESC").fetchall()
    return [dict(r) for r in rows]


def delete_portfolio_holding(holding_id: int) -> bool:
    """Delete a portfolio holding by id. Returns True if deleted."""
    with get_db() as conn:
        cur = conn.execute("DELETE FROM portfolio_holdings WHERE id = ?", (holding_id,))
    return cur.rowcount > 0


# ─── Paper Trading Helpers ──────────────────────────────────────────────────

def save_paper_trade(symbol: str, trade_type: str, quantity: float, entry_price: float,
                     trade_date: str, signal_confidence: Optional[float] = None,
                     stop_loss: Optional[float] = None, target_price: Optional[float] = None,
                     notes: Optional[str] = None, order_type: str = "MARKET",
                     product_type: str = "DELIVERY") -> int:
    """Create a new paper trade. Returns the new row id."""
    with get_db() as conn:
        cur = conn.execute(
            """INSERT INTO paper_trades
               (symbol, trade_type, quantity, entry_price, trade_date, signal_confidence, stop_loss, target_price, notes, order_type, product_type)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (symbol, trade_type, quantity, entry_price, trade_date, signal_confidence, stop_loss, target_price, notes, order_type, product_type),
        )
        return cur.lastrowid


def get_open_paper_trades() -> list[dict]:
    """Get all open paper trades."""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM paper_trades WHERE status = 'OPEN' ORDER BY created_at DESC"
        ).fetchall()
    return [dict(r) for r in rows]


def get_closed_paper_trades(limit: int = 50) -> list[dict]:
    """Get closed paper trades, most recent first."""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM paper_trades WHERE status = 'CLOSED' ORDER BY closed_date DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return [dict(r) for r in rows]


def close_paper_trade(trade_id: int, exit_price: float, closed_date: str, pnl: float) -> bool:
    """Close a paper trade. Returns True if updated."""
    with get_db() as conn:
        cur = conn.execute(
            """UPDATE paper_trades SET exit_price = ?, closed_date = ?, pnl = ?, status = 'CLOSED'
               WHERE id = ? AND status = 'OPEN'""",
            (exit_price, closed_date, pnl, trade_id),
        )
    return cur.rowcount > 0


def get_all_paper_trades() -> list[dict]:
    """Get all paper trades (open and closed)."""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM paper_trades ORDER BY created_at DESC"
        ).fetchall()
    return [dict(r) for r in rows]


# Initialize DB on import
init_db()

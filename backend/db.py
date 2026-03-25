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

            CREATE INDEX IF NOT EXISTS idx_stock_data_symbol_date ON stock_data(symbol, date);
            CREATE INDEX IF NOT EXISTS idx_indicators_symbol_date ON indicators(symbol, date);
            CREATE INDEX IF NOT EXISTS idx_signals_symbol_date ON signals(symbol, date);
        """)
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


# Initialize DB on import
init_db()

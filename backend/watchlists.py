"""
Netra — Watchlist System
Custom stock groups with signal summaries.
"""

import logging
import json
from typing import Optional

import db as netra_db
from config import NIFTY_50_STOCKS

logger = logging.getLogger(__name__)


# ─── DB Setup ─────────────────────────────────────────────────────────────────

def init_watchlist_db():
    """Create watchlist tables."""
    with netra_db.get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS watchlists (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                description TEXT,
                is_default INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS watchlist_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                watchlist_id INTEGER NOT NULL,
                symbol TEXT NOT NULL,
                added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (watchlist_id) REFERENCES watchlists(id) ON DELETE CASCADE,
                UNIQUE(watchlist_id, symbol)
            );
        """)

        # Create default NIFTY 50 watchlist if it doesn't exist
        existing = conn.execute("SELECT id FROM watchlists WHERE is_default = 1").fetchone()
        if not existing:
            conn.execute(
                "INSERT INTO watchlists (name, description, is_default) VALUES (?, ?, 1)",
                ("NIFTY 50", "Default NIFTY 50 watchlist"),
            )
            wl_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
            for symbol in NIFTY_50_STOCKS[:50]:
                conn.execute(
                    "INSERT OR IGNORE INTO watchlist_items (watchlist_id, symbol) VALUES (?, ?)",
                    (wl_id, symbol),
                )


init_watchlist_db()


# ─── CRUD ─────────────────────────────────────────────────────────────────────

def get_all_watchlists() -> list[dict]:
    """Get all watchlists with item counts."""
    with netra_db.get_db() as conn:
        rows = conn.execute("""
            SELECT w.*, COUNT(wi.id) as stock_count
            FROM watchlists w
            LEFT JOIN watchlist_items wi ON w.id = wi.watchlist_id
            GROUP BY w.id
            ORDER BY w.is_default DESC, w.name ASC
        """).fetchall()
    return [dict(r) for r in rows]


def get_watchlist(watchlist_id: int) -> Optional[dict]:
    """Get a single watchlist with its stocks and signal summaries."""
    with netra_db.get_db() as conn:
        wl = conn.execute("SELECT * FROM watchlists WHERE id = ?", (watchlist_id,)).fetchone()
        if not wl:
            return None

        items = conn.execute(
            "SELECT symbol FROM watchlist_items WHERE watchlist_id = ? ORDER BY added_at",
            (watchlist_id,),
        ).fetchall()

    symbols = [r["symbol"] for r in items]

    # Get signals for these stocks
    from live_prices import fetch_live_prices
    signals_df = netra_db.get_latest_signals()
    live = fetch_live_prices()

    stocks = []
    buy_count = 0
    sell_count = 0
    hold_count = 0

    for symbol in symbols:
        name = symbol.replace(".NS", "")
        stock = {"symbol": symbol, "name": name}

        # Live price
        lp = live.get(symbol, {})
        stock["ltp"] = lp.get("price")
        stock["change_pct"] = lp.get("change_pct")

        # Signal
        sig_row = signals_df[signals_df["symbol"] == symbol]
        if not sig_row.empty:
            sig = sig_row.iloc[0]
            stock["signal"] = sig["signal"]
            stock["confidence"] = float(sig["confidence"])
            stock["composite_score"] = float(sig["composite_score"])
            if sig["signal"] == "BUY":
                buy_count += 1
            elif sig["signal"] == "SELL":
                sell_count += 1
            else:
                hold_count += 1

        stocks.append(stock)

    return {
        **dict(wl),
        "stocks": stocks,
        "stock_count": len(stocks),
        "summary": {
            "buy": buy_count,
            "sell": sell_count,
            "hold": hold_count,
        },
    }


def create_watchlist(name: str, description: str = "") -> int:
    """Create a new watchlist. Returns watchlist ID."""
    with netra_db.get_db() as conn:
        cursor = conn.execute(
            "INSERT INTO watchlists (name, description) VALUES (?, ?)",
            (name, description),
        )
        return cursor.lastrowid


def delete_watchlist(watchlist_id: int) -> bool:
    """Delete a watchlist (cannot delete default)."""
    with netra_db.get_db() as conn:
        wl = conn.execute("SELECT is_default FROM watchlists WHERE id = ?", (watchlist_id,)).fetchone()
        if not wl or wl["is_default"]:
            return False
        conn.execute("DELETE FROM watchlist_items WHERE watchlist_id = ?", (watchlist_id,))
        conn.execute("DELETE FROM watchlists WHERE id = ?", (watchlist_id,))
        return True


def add_to_watchlist(watchlist_id: int, symbol: str):
    """Add a stock to a watchlist."""
    if not symbol.endswith(".NS"):
        symbol = symbol + ".NS"
    with netra_db.get_db() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO watchlist_items (watchlist_id, symbol) VALUES (?, ?)",
            (watchlist_id, symbol),
        )


def remove_from_watchlist(watchlist_id: int, symbol: str):
    """Remove a stock from a watchlist."""
    if not symbol.endswith(".NS"):
        symbol = symbol + ".NS"
    with netra_db.get_db() as conn:
        conn.execute(
            "DELETE FROM watchlist_items WHERE watchlist_id = ? AND symbol = ?",
            (watchlist_id, symbol),
        )

"""
Netra — Smart Alert Builder
Multi-condition alert system with AND/OR groups.
Evaluates conditions against live stock data and signals.
"""

import json
import logging
import time
from datetime import datetime
from typing import Optional

import pytz

import db as netra_db
from config import NIFTY_50_STOCKS, TIMEZONE

logger = logging.getLogger(__name__)
IST = pytz.timezone(TIMEZONE)

# ─── DB Setup ─────────────────────────────────────────────────────────────────

def init_smart_alerts_db():
    """Create smart_alerts tables."""
    with netra_db.get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS smart_alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                symbol TEXT,
                conditions_json TEXT NOT NULL,
                logic TEXT DEFAULT 'AND',
                enabled INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_triggered_at TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS smart_alerts_triggered (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                alert_id INTEGER NOT NULL,
                symbol TEXT NOT NULL,
                message TEXT NOT NULL,
                matched_conditions TEXT,
                triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                read INTEGER DEFAULT 0,
                FOREIGN KEY (alert_id) REFERENCES smart_alerts(id)
            );

            CREATE INDEX IF NOT EXISTS idx_smart_triggered_time
                ON smart_alerts_triggered(triggered_at DESC);
        """)

init_smart_alerts_db()


# ─── Condition Types ──────────────────────────────────────────────────────────

CONDITION_TYPES = {
    "signal": {"label": "Signal", "values": ["BUY", "SELL", "HOLD"]},
    "confidence_above": {"label": "Confidence Above", "unit": "%"},
    "confidence_below": {"label": "Confidence Below", "unit": "%"},
    "composite_above": {"label": "Composite Above", "unit": ""},
    "composite_below": {"label": "Composite Below", "unit": ""},
    "rsi_above": {"label": "RSI Above", "unit": ""},
    "rsi_below": {"label": "RSI Below", "unit": ""},
    "price_above": {"label": "Price Above", "unit": "₹"},
    "price_below": {"label": "Price Below", "unit": "₹"},
    "change_pct_above": {"label": "Change % Above", "unit": "%"},
    "change_pct_below": {"label": "Change % Below", "unit": "%"},
    "volume_spike": {"label": "Volume Spike (x avg)", "unit": "x"},
    "pe_below": {"label": "P/E Below", "unit": ""},
    "pe_above": {"label": "P/E Above", "unit": ""},
}


def _get_stock_snapshot(symbol: str) -> Optional[dict]:
    """Get current snapshot of a stock for condition evaluation."""
    from live_prices import _price_cache

    snap = {"symbol": symbol}

    # Live price
    lp = _price_cache.get(symbol)
    if lp:
        snap["price"] = lp["price"]
        snap["change_pct"] = lp.get("change_pct", 0)
        snap["volume"] = lp.get("volume", 0)
    else:
        price_df = netra_db.get_stock_data(symbol)
        if price_df.empty:
            return None
        latest = price_df.iloc[-1]
        snap["price"] = float(latest["close"])
        if len(price_df) > 1:
            prev = float(price_df.iloc[-2]["close"])
            snap["change_pct"] = round(((snap["price"] - prev) / prev) * 100, 2) if prev else 0
        else:
            snap["change_pct"] = 0
        snap["volume"] = int(latest["volume"]) if latest.get("volume") else 0

    # Signal
    signals_df = netra_db.get_latest_signals()
    sig_row = signals_df[signals_df["symbol"] == symbol] if not signals_df.empty else None
    if sig_row is not None and not sig_row.empty:
        sig = sig_row.iloc[0]
        snap["signal"] = sig["signal"]
        snap["confidence"] = float(sig["confidence"])
        snap["composite_score"] = float(sig["composite_score"])
    else:
        snap["signal"] = "HOLD"
        snap["confidence"] = 0
        snap["composite_score"] = 0.5

    # RSI
    try:
        ind_df = netra_db.get_indicators(symbol)
        if ind_df is not None and len(ind_df) > 0:
            latest_ind = ind_df.iloc[-1]
            import pandas as pd
            snap["rsi"] = float(latest_ind["rsi"]) if pd.notna(latest_ind.get("rsi")) else None
        else:
            snap["rsi"] = None
    except Exception:
        snap["rsi"] = None

    # Volume average
    try:
        price_df = netra_db.get_stock_data(symbol)
        if price_df is not None and len(price_df) >= 20:
            vol_20 = price_df["volume"].tail(21).iloc[:-1].mean()
            snap["volume_ratio"] = round(snap["volume"] / vol_20, 2) if vol_20 > 0 else 0
        else:
            snap["volume_ratio"] = 0
    except Exception:
        snap["volume_ratio"] = 0

    # Fundamentals
    try:
        fund = netra_db.get_fundamentals(symbol)
        snap["pe"] = fund.get("pe_ratio") or fund.get("trailingPE") if fund else None
    except Exception:
        snap["pe"] = None

    return snap


def _evaluate_condition(condition: dict, snap: dict) -> bool:
    """Evaluate a single condition against a stock snapshot."""
    ctype = condition.get("type")
    value = condition.get("value")

    if ctype == "signal":
        return snap.get("signal") == value
    elif ctype == "confidence_above":
        return (snap.get("confidence") or 0) >= float(value)
    elif ctype == "confidence_below":
        return (snap.get("confidence") or 0) <= float(value)
    elif ctype == "composite_above":
        return (snap.get("composite_score") or 0) >= float(value)
    elif ctype == "composite_below":
        return (snap.get("composite_score") or 0) <= float(value)
    elif ctype == "rsi_above":
        return snap.get("rsi") is not None and snap["rsi"] >= float(value)
    elif ctype == "rsi_below":
        return snap.get("rsi") is not None and snap["rsi"] <= float(value)
    elif ctype == "price_above":
        return (snap.get("price") or 0) >= float(value)
    elif ctype == "price_below":
        return (snap.get("price") or 0) <= float(value)
    elif ctype == "change_pct_above":
        return (snap.get("change_pct") or 0) >= float(value)
    elif ctype == "change_pct_below":
        return (snap.get("change_pct") or 0) <= float(value)
    elif ctype == "volume_spike":
        return (snap.get("volume_ratio") or 0) >= float(value)
    elif ctype == "pe_below":
        return snap.get("pe") is not None and snap["pe"] <= float(value)
    elif ctype == "pe_above":
        return snap.get("pe") is not None and snap["pe"] >= float(value)

    return False


def evaluate_alert(alert: dict) -> list[dict]:
    """Evaluate alert conditions. Returns list of triggered matches."""
    conditions = json.loads(alert["conditions_json"])
    logic = alert.get("logic", "AND")
    symbol = alert.get("symbol")
    triggered = []

    symbols_to_check = [symbol] if symbol else NIFTY_50_STOCKS

    for sym in symbols_to_check:
        snap = _get_stock_snapshot(sym)
        if not snap:
            continue

        results = []
        for cond in conditions:
            matched = _evaluate_condition(cond, snap)
            results.append((cond, matched))

        if logic == "AND":
            all_match = all(m for _, m in results)
            if all_match:
                matched_conds = [c for c, m in results if m]
                triggered.append({
                    "symbol": sym,
                    "name": sym.replace(".NS", ""),
                    "matched": matched_conds,
                    "snapshot": snap,
                })
        else:  # OR
            any_match = any(m for _, m in results)
            if any_match:
                matched_conds = [c for c, m in results if m]
                triggered.append({
                    "symbol": sym,
                    "name": sym.replace(".NS", ""),
                    "matched": matched_conds,
                    "snapshot": snap,
                })

    return triggered


# ─── CRUD ─────────────────────────────────────────────────────────────────────

def create_smart_alert(name: str, symbol: Optional[str], conditions: list[dict],
                       logic: str = "AND") -> int:
    """Create a new smart alert. Returns alert id."""
    with netra_db.get_db() as conn:
        cur = conn.execute(
            """INSERT INTO smart_alerts (name, symbol, conditions_json, logic)
               VALUES (?, ?, ?, ?)""",
            (name, symbol, json.dumps(conditions), logic),
        )
        return cur.lastrowid


def get_smart_alerts() -> list[dict]:
    """Get all smart alerts."""
    with netra_db.get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM smart_alerts ORDER BY created_at DESC"
        ).fetchall()
    results = []
    for r in rows:
        d = dict(r)
        d["conditions"] = json.loads(d["conditions_json"])
        results.append(d)
    return results


def delete_smart_alert(alert_id: int) -> bool:
    """Delete a smart alert."""
    with netra_db.get_db() as conn:
        cur = conn.execute("DELETE FROM smart_alerts WHERE id = ?", (alert_id,))
        conn.execute("DELETE FROM smart_alerts_triggered WHERE alert_id = ?", (alert_id,))
    return cur.rowcount > 0


def toggle_smart_alert(alert_id: int, enabled: bool) -> bool:
    """Enable/disable a smart alert."""
    with netra_db.get_db() as conn:
        cur = conn.execute(
            "UPDATE smart_alerts SET enabled = ? WHERE id = ?",
            (1 if enabled else 0, alert_id),
        )
    return cur.rowcount > 0


def get_triggered_alerts(limit: int = 50) -> list[dict]:
    """Get recently triggered smart alerts."""
    with netra_db.get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM smart_alerts_triggered ORDER BY triggered_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
    results = []
    for r in rows:
        d = dict(r)
        if d.get("matched_conditions"):
            d["matched_conditions"] = json.loads(d["matched_conditions"])
        results.append(d)
    return results


def scan_smart_alerts() -> int:
    """Scan all enabled alerts and trigger matches. Returns count of new triggers."""
    alerts = get_smart_alerts()
    new_triggers = 0

    for alert in alerts:
        if not alert.get("enabled"):
            continue

        try:
            matches = evaluate_alert(alert)
            for match in matches:
                # Build message
                cond_strs = []
                for c in match["matched"]:
                    label = CONDITION_TYPES.get(c["type"], {}).get("label", c["type"])
                    cond_strs.append(f"{label}: {c['value']}")
                msg = f"{match['name']} matched: {', '.join(cond_strs)}"

                # Save triggered alert
                with netra_db.get_db() as conn:
                    conn.execute(
                        """INSERT INTO smart_alerts_triggered
                           (alert_id, symbol, message, matched_conditions)
                           VALUES (?, ?, ?, ?)""",
                        (alert["id"], match["symbol"], msg,
                         json.dumps(match["matched"])),
                    )
                    conn.execute(
                        "UPDATE smart_alerts SET last_triggered_at = ? WHERE id = ?",
                        (datetime.now(IST).isoformat(), alert["id"]),
                    )
                new_triggers += 1
        except Exception as e:
            logger.error("Failed to evaluate alert %s: %s", alert["id"], e)

    return new_triggers


def get_condition_types() -> dict:
    """Return available condition types for the UI."""
    return CONDITION_TYPES

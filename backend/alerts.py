"""
Netra — Alert Engine
Monitors for signal changes, price crosses, volume surges, and other conditions.
Stores alert configurations and triggered alerts in SQLite.
"""

import logging
import json
import time
from datetime import datetime
from typing import Optional

import pytz

import db as netra_db
from config import NIFTY_50_STOCKS, TIMEZONE

logger = logging.getLogger(__name__)
IST = pytz.timezone(TIMEZONE)


# ─── DB Setup ─────────────────────────────────────────────────────────────────

def init_alerts_db():
    """Create alert-related tables."""
    with netra_db.get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS alert_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol TEXT,
                alert_type TEXT NOT NULL,
                condition_json TEXT,
                enabled INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS alert_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                rule_id INTEGER,
                symbol TEXT NOT NULL,
                alert_type TEXT NOT NULL,
                message TEXT NOT NULL,
                details_json TEXT,
                read INTEGER DEFAULT 0,
                triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (rule_id) REFERENCES alert_rules(id)
            );

            CREATE INDEX IF NOT EXISTS idx_alert_history_time ON alert_history(triggered_at DESC);
        """)


# Init on import
init_alerts_db()


# ─── Alert Rule CRUD ─────────────────────────────────────────────────────────

def create_alert_rule(symbol: Optional[str], alert_type: str, conditions: dict) -> int:
    """Create a new alert rule. Returns rule ID."""
    with netra_db.get_db() as conn:
        cursor = conn.execute(
            "INSERT INTO alert_rules (symbol, alert_type, condition_json) VALUES (?, ?, ?)",
            (symbol, alert_type, json.dumps(conditions)),
        )
        return cursor.lastrowid


def get_alert_rules() -> list[dict]:
    """Get all alert rules."""
    with netra_db.get_db() as conn:
        rows = conn.execute("SELECT * FROM alert_rules ORDER BY created_at DESC").fetchall()
    return [dict(r) for r in rows]


def delete_alert_rule(rule_id: int):
    """Delete an alert rule."""
    with netra_db.get_db() as conn:
        conn.execute("DELETE FROM alert_rules WHERE id = ?", (rule_id,))


def toggle_alert_rule(rule_id: int, enabled: bool):
    """Enable/disable an alert rule."""
    with netra_db.get_db() as conn:
        conn.execute("UPDATE alert_rules SET enabled = ? WHERE id = ?", (1 if enabled else 0, rule_id))


# ─── Alert History ───────────────────────────────────────────────────────────

def add_alert(rule_id: Optional[int], symbol: str, alert_type: str, message: str, details: dict = None):
    """Record a triggered alert."""
    with netra_db.get_db() as conn:
        conn.execute(
            "INSERT INTO alert_history (rule_id, symbol, alert_type, message, details_json) VALUES (?, ?, ?, ?, ?)",
            (rule_id, symbol, alert_type, message, json.dumps(details or {})),
        )
    logger.info("Alert triggered: [%s] %s — %s", alert_type, symbol, message)


def get_recent_alerts(limit: int = 50) -> list[dict]:
    """Get recent triggered alerts."""
    with netra_db.get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM alert_history ORDER BY triggered_at DESC LIMIT ?",
            (limit,)
        ).fetchall()
    return [dict(r) for r in rows]


def get_unread_count() -> int:
    """Get count of unread alerts."""
    with netra_db.get_db() as conn:
        row = conn.execute("SELECT COUNT(*) as cnt FROM alert_history WHERE read = 0").fetchone()
    return row["cnt"] if row else 0


def mark_alerts_read():
    """Mark all alerts as read."""
    with netra_db.get_db() as conn:
        conn.execute("UPDATE alert_history SET read = 1 WHERE read = 0")


# ─── Alert Scanning ─────────────────────────────────────────────────────────

# Cache for previous signal states (to detect changes)
_prev_signals: dict[str, str] = {}


def scan_for_alerts():
    """
    Scan all stocks for alert conditions. Called periodically by scheduler.
    Built-in alert types (always active, no rule needed):
      - signal_change: signal flipped from previous scan
      - strength_spike: signal strength > 75%
      - volume_surge: volume > 3x 20-day average
      - regime_change: market regime shifted
    """
    global _prev_signals

    from live_prices import fetch_live_prices

    signals_df = netra_db.get_latest_signals()
    if signals_df.empty:
        return

    live = fetch_live_prices()
    now = datetime.now(IST)

    for _, sig in signals_df.iterrows():
        symbol = sig["symbol"]
        name = symbol.replace(".NS", "")
        signal = sig["signal"]
        confidence = float(sig["confidence"])
        composite = float(sig["composite_score"])

        # 1. Signal Change Detection
        prev = _prev_signals.get(symbol)
        if prev and prev != signal:
            add_alert(
                None, symbol, "signal_change",
                f"{name} signal changed: {prev} \u2192 {signal} (strength: {confidence:.0f}%)",
                {"from": prev, "to": signal, "confidence": confidence},
            )

        _prev_signals[symbol] = signal

        # 2. Strength Spike (>75%)
        if confidence >= 75:
            # Only alert once per day - check if we already have one today
            existing = _check_today_alert(symbol, "strength_spike")
            if not existing:
                add_alert(
                    None, symbol, "strength_spike",
                    f"{name} signal strength spiked to {confidence:.0f}% ({signal})",
                    {"confidence": confidence, "signal": signal},
                )

        # 3. Volume Surge
        lp = live.get(symbol, {})
        volume = lp.get("volume", 0)
        if volume > 0:
            indicators = netra_db.get_indicators(symbol)
            if not indicators.empty:
                vol_sma = indicators.iloc[-1].get("volume_sma_20")
                if vol_sma and vol_sma > 0 and volume > 3 * vol_sma:
                    existing = _check_today_alert(symbol, "volume_surge")
                    if not existing:
                        ratio = volume / vol_sma
                        add_alert(
                            None, symbol, "volume_surge",
                            f"{name} volume surge: {ratio:.1f}x average ({volume:,.0f})",
                            {"volume": volume, "avg_volume": vol_sma, "ratio": ratio},
                        )

    # 4. Check user-defined alert rules
    _check_user_rules(signals_df, live)


def _check_today_alert(symbol: str, alert_type: str) -> bool:
    """Check if we already triggered this alert type for this symbol today."""
    today = datetime.now(IST).strftime("%Y-%m-%d")
    with netra_db.get_db() as conn:
        row = conn.execute(
            "SELECT COUNT(*) as cnt FROM alert_history WHERE symbol = ? AND alert_type = ? AND triggered_at >= ?",
            (symbol, alert_type, today),
        ).fetchone()
    return row["cnt"] > 0 if row else False


def _check_user_rules(signals_df, live_prices: dict):
    """Check user-defined alert rules."""
    rules = get_alert_rules()
    for rule in rules:
        if not rule["enabled"]:
            continue

        try:
            conditions = json.loads(rule["condition_json"]) if rule["condition_json"] else {}
        except Exception:
            continue

        alert_type = rule["alert_type"]
        symbol = rule.get("symbol")

        if alert_type == "price_cross" and symbol:
            lp = live_prices.get(symbol, {})
            price = lp.get("price")
            target = conditions.get("price")
            direction = conditions.get("direction", "above")

            if price and target:
                if direction == "above" and price > target:
                    name = symbol.replace(".NS", "")
                    add_alert(rule["id"], symbol, "price_cross",
                              f"{name} crossed above \u20b9{target:,.2f} (now \u20b9{price:,.2f})",
                              {"price": price, "target": target, "direction": direction})
                    # Disable after triggering
                    toggle_alert_rule(rule["id"], False)
                elif direction == "below" and price < target:
                    name = symbol.replace(".NS", "")
                    add_alert(rule["id"], symbol, "price_cross",
                              f"{name} crossed below \u20b9{target:,.2f} (now \u20b9{price:,.2f})",
                              {"price": price, "target": target, "direction": direction})
                    toggle_alert_rule(rule["id"], False)

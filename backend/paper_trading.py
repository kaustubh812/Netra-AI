"""
Netra — Paper Trading Simulator
Virtual trading with live P&L tracking, performance stats, and signal-based suggestions.
"""

import logging
from datetime import datetime

import pytz

import db
from live_prices import fetch_live_prices
from config import TIMEZONE

logger = logging.getLogger(__name__)
IST = pytz.timezone(TIMEZONE)


def get_open_positions() -> list[dict]:
    """Get open paper trades enriched with live prices and unrealized P&L."""
    trades = db.get_open_paper_trades()
    if not trades:
        return []

    live = fetch_live_prices()
    signals_df = db.get_latest_signals()

    results = []
    for t in trades:
        symbol = t["symbol"]
        ltp = None

        lp = live.get(symbol)
        if lp:
            ltp = lp["price"]
        else:
            price_df = db.get_stock_data(symbol)
            if not price_df.empty:
                ltp = float(price_df.iloc[-1]["close"])

        # Unrealized P&L
        unrealized_pnl = None
        unrealized_pnl_pct = None
        if ltp is not None:
            if t["trade_type"] == "BUY":
                unrealized_pnl = (ltp - t["entry_price"]) * t["quantity"]
            else:  # SELL (short)
                unrealized_pnl = (t["entry_price"] - ltp) * t["quantity"]
            invested = t["entry_price"] * t["quantity"]
            unrealized_pnl_pct = round(unrealized_pnl / invested * 100, 2) if invested > 0 else 0

        # Signal alignment check
        current_signal = None
        signal_alignment = True
        if not signals_df.empty:
            sig_row = signals_df[signals_df["symbol"] == symbol]
            if not sig_row.empty:
                current_signal = sig_row.iloc[0]["signal"]
                if t["trade_type"] == "BUY" and current_signal == "SELL":
                    signal_alignment = False
                elif t["trade_type"] == "SELL" and current_signal == "BUY":
                    signal_alignment = False

        results.append({
            "id": t["id"],
            "symbol": symbol,
            "name": symbol.replace(".NS", ""),
            "trade_type": t["trade_type"],
            "quantity": t["quantity"],
            "entry_price": t["entry_price"],
            "ltp": ltp,
            "unrealized_pnl": round(unrealized_pnl, 2) if unrealized_pnl is not None else None,
            "unrealized_pnl_pct": unrealized_pnl_pct,
            "signal": current_signal,
            "signal_alignment": signal_alignment,
            "stop_loss": t["stop_loss"],
            "target_price": t["target_price"],
            "trade_date": t["trade_date"],
            "signal_confidence": t["signal_confidence"],
            "notes": t["notes"],
        })

    return results


def close_position(trade_id: int, exit_price: float) -> dict:
    """Close a paper trade and compute realized P&L."""
    # Find the trade
    trades = db.get_open_paper_trades()
    trade = None
    for t in trades:
        if t["id"] == trade_id:
            trade = t
            break

    if not trade:
        return {"error": "Trade not found or already closed"}

    if trade["trade_type"] == "BUY":
        pnl = (exit_price - trade["entry_price"]) * trade["quantity"]
    else:  # SELL (short)
        pnl = (trade["entry_price"] - exit_price) * trade["quantity"]

    closed_date = datetime.now(IST).strftime("%Y-%m-%d")
    ok = db.close_paper_trade(trade_id, exit_price, closed_date, round(pnl, 2))

    if ok:
        return {
            "status": "closed",
            "trade_id": trade_id,
            "exit_price": exit_price,
            "pnl": round(pnl, 2),
            "closed_date": closed_date,
        }
    return {"error": "Failed to close trade"}


def get_performance_stats() -> dict:
    """Compute paper trading performance statistics."""
    all_trades = db.get_all_paper_trades()
    if not all_trades:
        return {
            "total_trades": 0, "open_count": 0, "closed_count": 0,
            "win_rate": 0, "avg_return_pct": 0, "total_realized_pnl": 0,
            "total_unrealized_pnl": 0, "best_trade": None, "worst_trade": None,
            "profit_factor": 0,
        }

    closed = [t for t in all_trades if t["status"] == "CLOSED"]
    open_trades = [t for t in all_trades if t["status"] == "OPEN"]

    # Realized stats
    total_realized_pnl = sum(t["pnl"] for t in closed if t["pnl"] is not None)
    wins = [t for t in closed if t["pnl"] is not None and t["pnl"] > 0]
    losses = [t for t in closed if t["pnl"] is not None and t["pnl"] <= 0]
    win_rate = round(len(wins) / len(closed) * 100, 1) if closed else 0

    # Average return %
    returns = []
    for t in closed:
        if t["pnl"] is not None and t["entry_price"] and t["quantity"]:
            invested = t["entry_price"] * t["quantity"]
            if invested > 0:
                returns.append(t["pnl"] / invested * 100)
    avg_return_pct = round(sum(returns) / len(returns), 2) if returns else 0

    # Best/worst trade
    best_trade = None
    worst_trade = None
    if closed:
        best = max(closed, key=lambda t: t["pnl"] or 0)
        worst = min(closed, key=lambda t: t["pnl"] or 0)
        best_trade = {"symbol": best["symbol"].replace(".NS", ""), "pnl": best["pnl"]}
        worst_trade = {"symbol": worst["symbol"].replace(".NS", ""), "pnl": worst["pnl"]}

    # Profit factor
    total_wins = sum(t["pnl"] for t in wins if t["pnl"])
    total_losses = abs(sum(t["pnl"] for t in losses if t["pnl"]))
    profit_factor = round(total_wins / total_losses, 2) if total_losses > 0 else (999 if total_wins > 0 else 0)

    # Unrealized P&L from open positions
    open_positions = get_open_positions()
    total_unrealized_pnl = sum(p["unrealized_pnl"] for p in open_positions if p["unrealized_pnl"] is not None)

    return {
        "total_trades": len(all_trades),
        "open_count": len(open_trades),
        "closed_count": len(closed),
        "win_rate": win_rate,
        "avg_return_pct": avg_return_pct,
        "total_realized_pnl": round(total_realized_pnl, 2),
        "total_unrealized_pnl": round(total_unrealized_pnl, 2),
        "best_trade": best_trade,
        "worst_trade": worst_trade,
        "profit_factor": profit_factor,
    }


def get_trade_suggestions() -> list[dict]:
    """Get high-confidence signal-based trade suggestions, excluding open positions."""
    signals_df = db.get_latest_signals()
    if signals_df.empty:
        return []

    # Get symbols with open positions to exclude
    open_trades = db.get_open_paper_trades()
    open_symbols = {t["symbol"] for t in open_trades}

    live = fetch_live_prices()

    suggestions = []
    for _, row in signals_df.iterrows():
        symbol = row["symbol"]
        signal = row["signal"]
        confidence = float(row["confidence"])

        # Only BUY/SELL with confidence > 65, exclude open positions
        if signal == "HOLD" or confidence <= 65 or symbol in open_symbols:
            continue

        ltp = None
        lp = live.get(symbol)
        if lp:
            ltp = lp["price"]

        suggestions.append({
            "symbol": symbol,
            "name": symbol.replace(".NS", ""),
            "signal": signal,
            "confidence": confidence,
            "entry_price": float(row["entry_price"]),
            "stop_loss": float(row["stop_loss"]),
            "target_price": float(row["target_price"]),
            "composite_score": float(row["composite_score"]),
            "ltp": ltp,
        })

    suggestions.sort(key=lambda x: x["confidence"], reverse=True)
    return suggestions

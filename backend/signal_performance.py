"""
Netra — Historical Signal Performance
Analyzes past signal accuracy: win rate, average returns, rolling performance.
"""

import logging
from typing import Optional

import pandas as pd

import db

logger = logging.getLogger(__name__)


def get_signal_performance(symbol: str) -> dict:
    """
    Calculate historical signal performance for a stock.
    Compares signal direction vs actual price movement N days later.
    """
    # Get all signals
    with db.get_db() as conn:
        signals_df = pd.read_sql_query(
            "SELECT date, signal, confidence, entry_price, stop_loss, target_price, composite_score "
            "FROM signals WHERE symbol = ? ORDER BY date ASC",
            conn, params=[symbol],
        )

    if signals_df.empty or len(signals_df) < 5:
        return {
            "symbol": symbol,
            "name": symbol.replace(".NS", ""),
            "available": False,
            "message": "Insufficient signal history",
        }

    # Get price data
    price_df = db.get_stock_data(symbol)
    if price_df.empty:
        return {"symbol": symbol, "name": symbol.replace(".NS", ""), "available": False}

    price_df["date"] = pd.to_datetime(price_df["date"]).dt.strftime("%Y-%m-%d")
    price_map = dict(zip(price_df["date"], price_df["close"]))

    # Analyze each signal
    results = []
    for _, sig in signals_df.iterrows():
        sig_date = str(sig["date"])[:10]
        entry = sig["entry_price"]
        signal = sig["signal"]

        if entry is None or entry <= 0:
            continue

        # Check price 5 days later
        dates = sorted(price_map.keys())
        try:
            idx = dates.index(sig_date)
        except ValueError:
            continue

        # 5-day forward return
        if idx + 5 < len(dates):
            future_price = price_map[dates[idx + 5]]
            ret_5d = (future_price - entry) / entry * 100
        else:
            continue

        # 10-day forward return
        ret_10d = None
        if idx + 10 < len(dates):
            future_10 = price_map[dates[idx + 10]]
            ret_10d = (future_10 - entry) / entry * 100

        # Was signal correct?
        if signal == "BUY":
            correct = ret_5d > 0
        elif signal == "SELL":
            correct = ret_5d < 0
        else:
            correct = abs(ret_5d) < 1.5  # HOLD is "correct" if price didn't move much

        # Did it hit target or stop loss?
        hit_target = False
        hit_sl = False
        target = sig["target_price"]
        sl = sig["stop_loss"]
        if target and sl:
            for j in range(1, min(11, len(dates) - idx)):
                p = price_map[dates[idx + j]]
                if signal == "BUY":
                    if p >= target:
                        hit_target = True
                        break
                    if p <= sl:
                        hit_sl = True
                        break
                elif signal == "SELL":
                    if p <= target:
                        hit_target = True
                        break
                    if p >= sl:
                        hit_sl = True
                        break

        results.append({
            "date": sig_date,
            "signal": signal,
            "confidence": float(sig["confidence"]),
            "entry": float(entry),
            "return_5d": round(ret_5d, 2),
            "return_10d": round(ret_10d, 2) if ret_10d is not None else None,
            "correct": correct,
            "hit_target": hit_target,
            "hit_sl": hit_sl,
        })

    if not results:
        return {"symbol": symbol, "name": symbol.replace(".NS", ""), "available": False}

    # Compute summary stats
    total = len(results)
    correct_count = sum(1 for r in results if r["correct"])
    win_rate = correct_count / total * 100

    buy_results = [r for r in results if r["signal"] == "BUY"]
    sell_results = [r for r in results if r["signal"] == "SELL"]

    buy_win_rate = (sum(1 for r in buy_results if r["correct"]) / len(buy_results) * 100) if buy_results else None
    sell_win_rate = (sum(1 for r in sell_results if r["correct"]) / len(sell_results) * 100) if sell_results else None

    avg_return_buy = (sum(r["return_5d"] for r in buy_results) / len(buy_results)) if buy_results else None
    avg_return_sell = (sum(r["return_5d"] for r in sell_results) / len(sell_results)) if sell_results else None

    target_hit_rate = sum(1 for r in results if r["hit_target"]) / total * 100
    sl_hit_rate = sum(1 for r in results if r["hit_sl"]) / total * 100

    # Rolling accuracy (last 20 signals)
    recent = results[-20:]
    recent_win_rate = sum(1 for r in recent if r["correct"]) / len(recent) * 100

    # Monthly performance
    monthly = {}
    for r in results:
        month = r["date"][:7]
        if month not in monthly:
            monthly[month] = {"total": 0, "correct": 0}
        monthly[month]["total"] += 1
        if r["correct"]:
            monthly[month]["correct"] += 1

    rolling = [
        {"month": m, "accuracy": round(v["correct"] / v["total"] * 100, 1), "signals": v["total"]}
        for m, v in sorted(monthly.items())
    ]

    return {
        "symbol": symbol,
        "name": symbol.replace(".NS", ""),
        "available": True,
        "total_signals": total,
        "overall_win_rate": round(win_rate, 1),
        "recent_win_rate": round(recent_win_rate, 1),
        "buy_win_rate": round(buy_win_rate, 1) if buy_win_rate is not None else None,
        "sell_win_rate": round(sell_win_rate, 1) if sell_win_rate is not None else None,
        "avg_return_buy_5d": round(avg_return_buy, 2) if avg_return_buy is not None else None,
        "avg_return_sell_5d": round(avg_return_sell, 2) if avg_return_sell is not None else None,
        "target_hit_rate": round(target_hit_rate, 1),
        "sl_hit_rate": round(sl_hit_rate, 1),
        "buy_count": len(buy_results),
        "sell_count": len(sell_results),
        "rolling": rolling,
        "recent": results[-10:],
    }

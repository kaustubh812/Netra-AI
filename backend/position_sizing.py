"""
Netra — Position Sizing Calculator
Calculates optimal position size based on account equity, risk tolerance, and stop loss.
Includes Kelly Criterion from paper trading history.
"""

import logging
import math
from typing import Optional

logger = logging.getLogger(__name__)


def calculate_position_size(
    account_size: float,
    risk_pct: float,
    entry_price: float,
    stop_loss: float,
    target_price: Optional[float] = None,
) -> dict:
    """
    Calculate position sizing parameters.

    Args:
        account_size: Total account equity (INR)
        risk_pct: Max risk per trade as % of account (e.g. 2.0 = 2%)
        entry_price: Planned entry price
        stop_loss: Stop loss price
        target_price: Optional target price for R:R calculation
    """
    if entry_price <= 0 or stop_loss <= 0 or account_size <= 0:
        return {"error": "All values must be positive"}

    risk_per_share = abs(entry_price - stop_loss)
    if risk_per_share == 0:
        return {"error": "Entry and stop loss cannot be the same"}

    risk_amount = account_size * (risk_pct / 100)
    shares = math.floor(risk_amount / risk_per_share)
    position_value = shares * entry_price
    position_pct = (position_value / account_size) * 100 if account_size > 0 else 0

    # Direction
    is_long = entry_price > stop_loss

    # Risk-reward ratio
    rr_ratio = None
    reward_per_share = None
    if target_price and target_price > 0:
        if is_long:
            reward_per_share = target_price - entry_price
        else:
            reward_per_share = entry_price - target_price
        if risk_per_share > 0 and reward_per_share > 0:
            rr_ratio = round(reward_per_share / risk_per_share, 2)

    # Max loss and potential gain
    max_loss = shares * risk_per_share
    potential_gain = shares * reward_per_share if reward_per_share and reward_per_share > 0 else None

    return {
        "shares": shares,
        "position_value": round(position_value, 2),
        "position_pct": round(position_pct, 2),
        "risk_amount": round(risk_amount, 2),
        "risk_per_share": round(risk_per_share, 2),
        "max_loss": round(max_loss, 2),
        "potential_gain": round(potential_gain, 2) if potential_gain else None,
        "rr_ratio": rr_ratio,
        "direction": "LONG" if is_long else "SHORT",
        "entry_price": entry_price,
        "stop_loss": stop_loss,
        "target_price": target_price,
    }


def calculate_kelly_criterion(win_rate: float, avg_win: float, avg_loss: float) -> dict:
    """
    Kelly Criterion: f* = (bp - q) / b
    where b = avg_win/avg_loss, p = win_rate, q = 1-p

    Returns half-Kelly (conservative) and quarter-Kelly recommendations.
    """
    if avg_loss == 0 or win_rate <= 0 or win_rate >= 1:
        return {"kelly_pct": 0, "half_kelly_pct": 0, "quarter_kelly_pct": 0}

    b = abs(avg_win / avg_loss)
    p = win_rate
    q = 1 - p

    kelly = ((b * p) - q) / b
    kelly_pct = max(0, round(kelly * 100, 2))

    return {
        "kelly_pct": kelly_pct,
        "half_kelly_pct": round(kelly_pct / 2, 2),
        "quarter_kelly_pct": round(kelly_pct / 4, 2),
        "win_rate": round(win_rate * 100, 2),
        "avg_win": round(avg_win, 2),
        "avg_loss": round(avg_loss, 2),
        "payoff_ratio": round(b, 2),
    }


def get_kelly_from_paper_trading() -> dict:
    """Calculate Kelly Criterion from paper trading history."""
    try:
        from paper_trading import get_performance_stats
        stats = get_performance_stats()

        win_rate = stats.get("win_rate", 0) / 100  # convert from percentage
        closed = stats.get("closed_count", 0)

        if closed < 5:
            return {
                "available": False,
                "reason": f"Need at least 5 closed trades (have {closed})",
            }

        avg_profit = stats.get("avg_return_pct", 0)
        # Estimate avg win and avg loss from available stats
        # If we have best/worst trade, use them as proxies
        best = stats.get("best_trade")
        worst = stats.get("worst_trade")

        if best and worst and worst.get("pnl", 0) != 0:
            avg_win = abs(best["pnl"])
            avg_loss = abs(worst["pnl"])
            kelly = calculate_kelly_criterion(win_rate, avg_win, avg_loss)
            kelly["available"] = True
            kelly["closed_trades"] = closed
            return kelly

        return {"available": False, "reason": "Insufficient trade data for Kelly calculation"}

    except Exception as e:
        logger.warning("Failed to compute Kelly from paper trading: %s", e)
        return {"available": False, "reason": str(e)}

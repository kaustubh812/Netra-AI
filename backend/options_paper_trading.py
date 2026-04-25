"""
Netra — Options Paper Trading
Place, mark-to-market, and close multi-leg option strategy positions.
Pricing on close uses the live option chain (NSE or synthetic Black-Scholes fallback).
"""

import json
import logging
from datetime import datetime
from typing import Optional

import pytz

import db
from config import TIMEZONE
from option_chain import get_full_option_chain

logger = logging.getLogger(__name__)
IST = pytz.timezone(TIMEZONE)


def _current_leg_price(chain: dict, strike: float, opt_type: str) -> Optional[float]:
    """Look up current LTP for a strike+opt_type from chain."""
    for s in chain.get("strikes", []):
        if s["strike"] == strike:
            return float(s["call_ltp" if opt_type == "CE" else "put_ltp"] or 0)
    return None


def _strategy_current_value(symbol: str, legs: list[dict]) -> Optional[float]:
    """
    Return current net debit/credit of strategy (per share).
    +ve = it would cost this much to close (BUY back).
    -ve = closing the position would credit this amount.
    """
    chain = get_full_option_chain(symbol)
    if not chain:
        return None

    net = 0.0
    for leg in legs:
        price = _current_leg_price(chain, leg["strike"], leg["opt_type"])
        if price is None or price <= 0:
            return None
        # To close: opposite action — BUY leg → SELL it (credit), SELL leg → BUY back (debit)
        sign = -1 if leg["action"] == "BUY" else 1
        net += sign * price * leg.get("qty_lots", 1)
    return net


def place_option_strategy(symbol: str, strategy: dict, lots: int = 1,
                          notes: Optional[str] = None) -> int:
    """
    Persist a new option strategy paper trade.
    `strategy` is the dict from generate_options_signal()['recommended'].
    """
    if lots < 1:
        raise ValueError("lots must be >= 1")

    legs = strategy["legs"]
    # Scale leg lots if user wants > 1 lot
    legs_scaled = [{**l, "qty_lots": l.get("qty_lots", 1) * lots} for l in legs]

    lot_size = strategy.get("lot_size") or {"NIFTY": 75, "BANKNIFTY": 35}.get(symbol.upper(), 75)
    trade_date = datetime.now(IST).strftime("%Y-%m-%d %H:%M")

    return db.save_option_paper_trade(
        symbol=symbol.upper(),
        strategy_code=strategy["code"],
        strategy_name=strategy["name"],
        bias=strategy["bias"],
        expiry=strategy.get("expiry") or "",
        lot_size=lot_size,
        lots=lots,
        legs_json=json.dumps(legs_scaled),
        entry_net_debit=strategy["net_debit"] * lots,
        max_profit=strategy["max_profit"] * lots,
        max_loss=strategy["max_loss"] * lots,
        breakevens_json=json.dumps(strategy.get("breakevens", [])),
        pop=strategy.get("pop"),
        signal_confidence=strategy.get("confidence"),
        trade_date=trade_date,
        notes=notes,
    )


def get_open_positions() -> list[dict]:
    """Open positions enriched with mark-to-market PnL."""
    rows = db.get_open_option_trades()
    out = []
    for r in rows:
        legs = json.loads(r["legs_json"])
        breakevens = json.loads(r["breakevens_json"]) if r["breakevens_json"] else []
        lot_size = r["lot_size"]

        # Current value (per share net) → multiply by lot_size for absolute
        current_per_share = _strategy_current_value(r["symbol"], legs)
        current_value = (current_per_share or 0) * lot_size
        # Closing the trade: receive current_value (if credit) or pay it (if debit)
        # PnL = -(entry_net_debit + close_net_debit_to_unwind)
        # entry_net_debit is what we paid (or received as -ve) to open
        # current_value here represents what closing would cost (+) or credit (-)
        unrealized = -(r["entry_net_debit"] + current_value) if current_per_share is not None else None

        # Spot reference
        chain = get_full_option_chain(r["symbol"])
        spot = chain.get("underlying") if chain else None

        out.append({
            "id": r["id"],
            "symbol": r["symbol"],
            "strategy_code": r["strategy_code"],
            "strategy_name": r["strategy_name"],
            "bias": r["bias"],
            "expiry": r["expiry"],
            "lot_size": lot_size,
            "lots": r["lots"],
            "legs": legs,
            "entry_net_debit": r["entry_net_debit"],
            "current_net_value": round(current_value, 2) if current_per_share is not None else None,
            "max_profit": r["max_profit"],
            "max_loss": r["max_loss"],
            "breakevens": breakevens,
            "pop": r["pop"],
            "signal_confidence": r["signal_confidence"],
            "trade_date": r["trade_date"],
            "spot": spot,
            "unrealized_pnl": round(unrealized, 2) if unrealized is not None else None,
            "unrealized_pnl_pct": (
                round(unrealized / abs(r["max_loss"]) * 100, 2)
                if unrealized is not None and r["max_loss"] else None
            ),
            "notes": r["notes"],
        })
    return out


def get_closed_positions(limit: int = 50) -> list[dict]:
    rows = db.get_closed_option_trades(limit)
    out = []
    for r in rows:
        legs = json.loads(r["legs_json"])
        breakevens = json.loads(r["breakevens_json"]) if r["breakevens_json"] else []
        out.append({
            "id": r["id"],
            "symbol": r["symbol"],
            "strategy_code": r["strategy_code"],
            "strategy_name": r["strategy_name"],
            "bias": r["bias"],
            "expiry": r["expiry"],
            "lots": r["lots"],
            "legs": legs,
            "entry_net_debit": r["entry_net_debit"],
            "exit_net_debit": r["exit_net_debit"],
            "pnl": r["pnl"],
            "max_profit": r["max_profit"],
            "max_loss": r["max_loss"],
            "breakevens": breakevens,
            "pop": r["pop"],
            "trade_date": r["trade_date"],
            "closed_date": r["closed_date"],
            "notes": r["notes"],
        })
    return out


def close_position(trade_id: int) -> dict:
    """Close an open option position at current market value."""
    trade = db.get_option_trade(trade_id)
    if not trade:
        return {"error": "trade not found"}
    if trade["status"] != "OPEN":
        return {"error": "trade already closed"}

    legs = json.loads(trade["legs_json"])
    current_per_share = _strategy_current_value(trade["symbol"], legs)
    if current_per_share is None:
        return {"error": "could not fetch live option prices"}

    lot_size = trade["lot_size"]
    exit_net_debit = current_per_share * lot_size
    pnl = -(trade["entry_net_debit"] + exit_net_debit)
    closed_date = datetime.now(IST).strftime("%Y-%m-%d %H:%M")

    db.close_option_paper_trade(trade_id, round(exit_net_debit, 2),
                                closed_date, round(pnl, 2))
    return {
        "status": "closed",
        "id": trade_id,
        "exit_net_debit": round(exit_net_debit, 2),
        "pnl": round(pnl, 2),
        "closed_date": closed_date,
    }


def get_stats() -> dict:
    """Aggregate stats across all option trades."""
    closed = db.get_closed_option_trades(limit=10_000)
    open_ = db.get_open_option_trades()
    if not closed:
        return {
            "total_trades": len(open_),
            "closed_trades": 0,
            "open_trades": len(open_),
            "win_rate": None,
            "total_pnl": 0.0,
            "avg_pnl": 0.0,
            "best_trade": None,
            "worst_trade": None,
        }
    pnls = [t["pnl"] for t in closed if t["pnl"] is not None]
    wins = [p for p in pnls if p > 0]
    return {
        "total_trades": len(closed) + len(open_),
        "closed_trades": len(closed),
        "open_trades": len(open_),
        "win_rate": round(len(wins) / len(pnls) * 100, 2) if pnls else None,
        "total_pnl": round(sum(pnls), 2),
        "avg_pnl": round(sum(pnls) / len(pnls), 2) if pnls else 0.0,
        "best_trade": round(max(pnls), 2) if pnls else None,
        "worst_trade": round(min(pnls), 2) if pnls else None,
    }

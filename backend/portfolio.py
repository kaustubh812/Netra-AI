"""
Netra — Portfolio Tracker
Joins holdings with live prices, calculates P&L, sector exposure.
"""

import logging
from typing import Optional

import db
from live_prices import fetch_live_prices
from sector_rotation import SECTOR_MAP

logger = logging.getLogger(__name__)


def get_portfolio_with_pnl() -> list[dict]:
    """Get all holdings enriched with live prices and P&L."""
    holdings = db.get_all_portfolio_holdings()
    if not holdings:
        return []

    live = fetch_live_prices()
    signals_df = db.get_latest_signals()

    results = []
    for h in holdings:
        symbol = h["symbol"]
        ltp = None
        change_pct = None

        lp = live.get(symbol)
        if lp:
            ltp = lp["price"]
            change_pct = lp.get("change_pct")
        else:
            price_df = db.get_stock_data(symbol)
            if not price_df.empty:
                ltp = float(price_df.iloc[-1]["close"])
                if len(price_df) > 1:
                    prev = float(price_df.iloc[-2]["close"])
                    change_pct = round(((ltp - prev) / prev) * 100, 2)

        invested = h["quantity"] * h["purchase_price"]
        current_value = h["quantity"] * ltp if ltp else None
        pnl = current_value - invested if current_value is not None else None
        pnl_pct = (pnl / invested * 100) if pnl is not None and invested > 0 else None

        # Signal alignment
        sig_row = signals_df[signals_df["symbol"] == symbol] if not signals_df.empty else None
        signal = None
        if sig_row is not None and not sig_row.empty:
            signal = sig_row.iloc[0]["signal"]

        results.append({
            "id": h["id"],
            "symbol": symbol,
            "name": symbol.replace(".NS", ""),
            "quantity": h["quantity"],
            "purchase_price": h["purchase_price"],
            "purchase_date": h["purchase_date"],
            "notes": h["notes"],
            "ltp": ltp,
            "change_pct": change_pct,
            "invested": round(invested, 2),
            "current_value": round(current_value, 2) if current_value else None,
            "pnl": round(pnl, 2) if pnl is not None else None,
            "pnl_pct": round(pnl_pct, 2) if pnl_pct is not None else None,
            "signal": signal,
            "sector": SECTOR_MAP.get(symbol, "Unknown"),
        })

    return results


def get_portfolio_summary() -> dict:
    """Aggregate portfolio metrics."""
    holdings = get_portfolio_with_pnl()
    if not holdings:
        return {"total_invested": 0, "current_value": 0, "unrealized_pnl": 0,
                "unrealized_pnl_pct": 0, "day_pnl": 0, "holdings_count": 0}

    total_invested = sum(h["invested"] for h in holdings)
    current_value = sum(h["current_value"] for h in holdings if h["current_value"] is not None)
    unrealized_pnl = current_value - total_invested if current_value else 0

    # Day P&L: sum of (qty * ltp * change_pct/100) for each holding
    day_pnl = 0
    for h in holdings:
        if h["ltp"] and h["change_pct"]:
            day_pnl += h["quantity"] * h["ltp"] * (h["change_pct"] / 100)

    return {
        "total_invested": round(total_invested, 2),
        "current_value": round(current_value, 2),
        "unrealized_pnl": round(unrealized_pnl, 2),
        "unrealized_pnl_pct": round(unrealized_pnl / total_invested * 100, 2) if total_invested > 0 else 0,
        "day_pnl": round(day_pnl, 2),
        "holdings_count": len(holdings),
    }


def get_sector_exposure() -> list[dict]:
    """Group holdings by sector and compute allocation."""
    holdings = get_portfolio_with_pnl()
    if not holdings:
        return []

    sector_totals: dict[str, float] = {}
    total_value = 0
    for h in holdings:
        val = h["current_value"] or h["invested"]
        sector = h["sector"]
        sector_totals[sector] = sector_totals.get(sector, 0) + val
        total_value += val

    return [
        {"sector": sector, "value": round(val, 2),
         "pct": round(val / total_value * 100, 1) if total_value > 0 else 0}
        for sector, val in sorted(sector_totals.items(), key=lambda x: -x[1])
    ]

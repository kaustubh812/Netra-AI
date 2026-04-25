"""
Netra — Tax Harvesting Optimizer (India-Specific)
Analyzes portfolio holdings for tax-loss harvesting opportunities.
Indian tax rules: STCG 20%, LTCG 12.5% (above ₹1.25L exemption).
Short-term: < 12 months, Long-term: >= 12 months.
STCL offsets STCG + LTCG. LTCL offsets only LTCG.
"""

import logging
from datetime import datetime, date
from typing import Optional

import db
from live_prices import fetch_live_prices

logger = logging.getLogger(__name__)

# Indian capital gains tax rates (FY 2024-25 onwards)
STCG_RATE = 0.20      # 20% Short-Term Capital Gains
LTCG_RATE = 0.125     # 12.5% Long-Term Capital Gains
LTCG_EXEMPTION = 125000  # ₹1.25 lakh annual exemption


def _days_held(purchase_date_str: Optional[str]) -> int:
    """Calculate days held from purchase date to today."""
    if not purchase_date_str:
        return 0
    try:
        purchase = datetime.strptime(str(purchase_date_str)[:10], "%Y-%m-%d").date()
        return (date.today() - purchase).days
    except Exception:
        return 0


def _classify_holding(days: int) -> str:
    """Classify as short-term or long-term based on holding period."""
    return "LTCG" if days >= 365 else "STCG"


def analyze_tax_harvest() -> dict:
    """Analyze all portfolio holdings for tax harvesting opportunities."""
    holdings = db.get_all_portfolio_holdings()
    if not holdings:
        return {
            "holdings": [],
            "summary": _empty_summary(),
            "harvestable": [],
            "available": False,
            "reason": "No portfolio holdings found",
        }

    live = fetch_live_prices()
    results = []
    harvestable = []

    total_stcg = 0
    total_ltcg = 0
    total_stcl = 0
    total_ltcl = 0

    for h in holdings:
        symbol = h["symbol"]
        qty = h["quantity"]
        buy_price = h["purchase_price"]
        invested = qty * buy_price

        # Current price
        ltp = None
        lp = live.get(symbol)
        if lp:
            ltp = lp["price"]
        else:
            price_df = db.get_stock_data(symbol)
            if not price_df.empty:
                ltp = float(price_df.iloc[-1]["close"])

        if ltp is None:
            continue

        current_value = qty * ltp
        pnl = current_value - invested
        pnl_pct = (pnl / invested * 100) if invested > 0 else 0

        days = _days_held(h.get("purchase_date"))
        classification = _classify_holding(days)
        is_loss = pnl < 0

        holding_info = {
            "id": h["id"],
            "symbol": symbol,
            "name": symbol.replace(".NS", ""),
            "quantity": qty,
            "purchase_price": buy_price,
            "purchase_date": h.get("purchase_date"),
            "days_held": days,
            "classification": classification,
            "ltp": round(ltp, 2),
            "invested": round(invested, 2),
            "current_value": round(current_value, 2),
            "unrealized_pnl": round(pnl, 2),
            "unrealized_pnl_pct": round(pnl_pct, 2),
            "is_loss": is_loss,
        }

        # Accumulate gains/losses
        if classification == "STCG":
            if pnl >= 0:
                total_stcg += pnl
            else:
                total_stcl += abs(pnl)
        else:
            if pnl >= 0:
                total_ltcg += pnl
            else:
                total_ltcl += abs(pnl)

        # Flag harvestable losses
        if is_loss and abs(pnl) >= 500:  # Minimum ₹500 loss to be worth harvesting
            tax_saved = 0
            if classification == "STCG":
                tax_saved = abs(pnl) * STCG_RATE  # STCL can offset at STCG rate
            else:
                tax_saved = abs(pnl) * LTCG_RATE  # LTCL at LTCG rate

            holding_info["potential_tax_savings"] = round(tax_saved, 2)
            holding_info["harvest_priority"] = "HIGH" if abs(pnl) >= 10000 else "MEDIUM" if abs(pnl) >= 2000 else "LOW"
            harvestable.append(holding_info)

        results.append(holding_info)

    # Calculate net tax impact
    # STCL offsets STCG first, then LTCG
    net_stcg = max(0, total_stcg - total_stcl)
    remaining_stcl = max(0, total_stcl - total_stcg)

    # LTCL offsets LTCG only
    net_ltcg_before_exemption = max(0, total_ltcg - total_ltcl - remaining_stcl)
    net_ltcg = max(0, net_ltcg_before_exemption - LTCG_EXEMPTION)

    stcg_tax = net_stcg * STCG_RATE
    ltcg_tax = net_ltcg * LTCG_RATE
    total_tax = stcg_tax + ltcg_tax

    # Tax if all harvestable losses were booked
    total_harvestable_loss = sum(abs(h["unrealized_pnl"]) for h in harvestable)
    potential_savings = sum(h.get("potential_tax_savings", 0) for h in harvestable)

    summary = {
        "total_holdings": len(results),
        "total_invested": round(sum(r["invested"] for r in results), 2),
        "total_current_value": round(sum(r["current_value"] for r in results), 2),
        "total_unrealized_pnl": round(sum(r["unrealized_pnl"] for r in results), 2),
        "short_term_gains": round(total_stcg, 2),
        "short_term_losses": round(total_stcl, 2),
        "long_term_gains": round(total_ltcg, 2),
        "long_term_losses": round(total_ltcl, 2),
        "net_stcg_taxable": round(net_stcg, 2),
        "net_ltcg_taxable": round(net_ltcg, 2),
        "ltcg_exemption_used": round(min(net_ltcg_before_exemption, LTCG_EXEMPTION), 2),
        "ltcg_exemption_remaining": round(max(0, LTCG_EXEMPTION - net_ltcg_before_exemption), 2),
        "estimated_stcg_tax": round(stcg_tax, 2),
        "estimated_ltcg_tax": round(ltcg_tax, 2),
        "estimated_total_tax": round(total_tax, 2),
        "harvestable_losses": round(total_harvestable_loss, 2),
        "potential_tax_savings": round(potential_savings, 2),
        "stcg_rate": STCG_RATE * 100,
        "ltcg_rate": LTCG_RATE * 100,
    }

    # Sort harvestable by absolute loss (biggest opportunity first)
    harvestable.sort(key=lambda h: abs(h["unrealized_pnl"]), reverse=True)

    return {
        "holdings": results,
        "summary": summary,
        "harvestable": harvestable,
        "available": True,
    }


def _empty_summary() -> dict:
    return {
        "total_holdings": 0,
        "total_invested": 0,
        "total_current_value": 0,
        "total_unrealized_pnl": 0,
        "short_term_gains": 0,
        "short_term_losses": 0,
        "long_term_gains": 0,
        "long_term_losses": 0,
        "net_stcg_taxable": 0,
        "net_ltcg_taxable": 0,
        "ltcg_exemption_used": 0,
        "ltcg_exemption_remaining": LTCG_EXEMPTION,
        "estimated_stcg_tax": 0,
        "estimated_ltcg_tax": 0,
        "estimated_total_tax": 0,
        "harvestable_losses": 0,
        "potential_tax_savings": 0,
        "stcg_rate": STCG_RATE * 100,
        "ltcg_rate": LTCG_RATE * 100,
    }

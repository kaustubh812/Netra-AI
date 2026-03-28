"""
Netra — Stock Screener Engine
Multi-criteria filtering across signals, technicals, and fundamentals.
"""

import logging
from typing import Optional

import db
from config import NIFTY_50_STOCKS, STOCK_NAME_MAP

logger = logging.getLogger(__name__)


def run_screener(
    signal_filter: Optional[str] = None,
    min_confidence: Optional[float] = None,
    max_confidence: Optional[float] = None,
    min_composite: Optional[float] = None,
    max_composite: Optional[float] = None,
    min_rsi: Optional[float] = None,
    max_rsi: Optional[float] = None,
    supertrend_direction: Optional[int] = None,
    min_pe: Optional[float] = None,
    max_pe: Optional[float] = None,
    min_roe: Optional[float] = None,
    max_de: Optional[float] = None,
    min_market_cap: Optional[float] = None,
    sector: Optional[str] = None,
    sort_by: str = "confidence",
    sort_asc: bool = False,
) -> list[dict]:
    """
    Run multi-criteria screener across all NIFTY 50 stocks.
    Returns filtered + sorted list of stock results.
    """
    from live_prices import fetch_live_prices

    # Get all signals
    signals_df = db.get_latest_signals()
    live_prices = fetch_live_prices()

    results = []

    for symbol in NIFTY_50_STOCKS:
        name = symbol.replace(".NS", "")

        # Get signal data
        sig_row = signals_df[signals_df["symbol"] == symbol]
        sig_data = {}
        if not sig_row.empty:
            sig = sig_row.iloc[0]
            sig_data = {
                "signal": sig["signal"],
                "confidence": float(sig["confidence"]),
                "composite_score": float(sig["composite_score"]),
                "entry_price": float(sig["entry_price"]),
                "stop_loss": float(sig["stop_loss"]),
                "target_price": float(sig["target_price"]),
            }
        else:
            continue  # Skip stocks without signals

        # Signal filter
        if signal_filter and sig_data.get("signal") != signal_filter:
            continue

        # Confidence range
        conf = sig_data.get("confidence", 0)
        if min_confidence is not None and conf < min_confidence:
            continue
        if max_confidence is not None and conf > max_confidence:
            continue

        # Composite score range
        comp = sig_data.get("composite_score", 0.5)
        if min_composite is not None and comp < min_composite:
            continue
        if max_composite is not None and comp > max_composite:
            continue

        # Get indicators
        indicators = db.get_indicators(symbol)
        ind_data = {}
        if not indicators.empty:
            latest_ind = indicators.iloc[-1]
            ind_data = {
                "rsi": float(latest_ind["rsi"]) if latest_ind.get("rsi") is not None else None,
                "macd": float(latest_ind["macd"]) if latest_ind.get("macd") is not None else None,
                "supertrend_direction": int(latest_ind["supertrend_direction"]) if latest_ind.get("supertrend_direction") is not None else None,
                "adx": float(latest_ind["adx"]) if latest_ind.get("adx") is not None else None,
                "atr": float(latest_ind["atr"]) if latest_ind.get("atr") is not None else None,
                "sma_20": float(latest_ind["sma_20"]) if latest_ind.get("sma_20") is not None else None,
                "sma_50": float(latest_ind["sma_50"]) if latest_ind.get("sma_50") is not None else None,
                "sma_200": float(latest_ind["sma_200"]) if latest_ind.get("sma_200") is not None else None,
            }

        # RSI filter
        rsi = ind_data.get("rsi")
        if min_rsi is not None and (rsi is None or rsi < min_rsi):
            continue
        if max_rsi is not None and (rsi is None or rsi > max_rsi):
            continue

        # Supertrend filter
        if supertrend_direction is not None:
            st_dir = ind_data.get("supertrend_direction")
            if st_dir is None or st_dir != supertrend_direction:
                continue

        # Get fundamentals
        fund = db.get_fundamentals(symbol)
        fund_data = {}
        if fund:
            fund_data = {
                "pe": fund.get("trailingPE"),
                "pb": fund.get("priceToBook"),
                "roe": fund.get("returnOnEquity"),
                "de": fund.get("debtToEquity"),
                "market_cap": fund.get("marketCap"),
                "sector": fund.get("sector"),
                "profit_margin": fund.get("profitMargins"),
                "revenue_growth": fund.get("revenueGrowth"),
            }

        # P/E filter
        pe = fund_data.get("pe")
        if min_pe is not None and (pe is None or pe < min_pe):
            continue
        if max_pe is not None and (pe is None or pe > max_pe):
            continue

        # ROE filter
        roe = fund_data.get("roe")
        if min_roe is not None and (roe is None or roe < min_roe):
            continue

        # D/E filter
        de = fund_data.get("de")
        if max_de is not None and (de is None or de > max_de):
            continue

        # Market cap filter
        mcap = fund_data.get("market_cap")
        if min_market_cap is not None and (mcap is None or mcap < min_market_cap):
            continue

        # Sector filter
        if sector and fund_data.get("sector", "").lower() != sector.lower():
            continue

        # Get live price
        lp = live_prices.get(symbol, {})

        results.append({
            "symbol": symbol,
            "name": name,
            "ltp": lp.get("price"),
            "change_pct": lp.get("change_pct"),
            "volume": lp.get("volume"),
            **sig_data,
            **ind_data,
            **fund_data,
        })

    # Sort
    def sort_key(r):
        val = r.get(sort_by)
        if val is None:
            return float("-inf") if not sort_asc else float("inf")
        return val

    results.sort(key=sort_key, reverse=not sort_asc)

    return results


def get_available_sectors() -> list[str]:
    """Get all unique sectors from fundamentals data."""
    sectors = set()
    for symbol in NIFTY_50_STOCKS:
        fund = db.get_fundamentals(symbol)
        if fund and fund.get("sector"):
            sectors.add(fund["sector"])
    return sorted(sectors)

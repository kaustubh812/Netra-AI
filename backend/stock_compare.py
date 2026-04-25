"""
Netra — Stock Comparison Tool
Side-by-side comparison of 2-4 stocks: price performance,
fundamentals, technicals, signals, and news sentiment.
"""

import logging
from typing import Optional

import pandas as pd
import numpy as np

import db
from config import NIFTY_50_STOCKS

logger = logging.getLogger(__name__)


def compare_stocks(symbols: list[str]) -> dict:
    """Compare 2-4 stocks head-to-head."""
    if len(symbols) < 2:
        return {"error": "Need at least 2 stocks to compare", "stocks": []}
    if len(symbols) > 4:
        symbols = symbols[:4]

    # Normalize symbols
    normalized = []
    for s in symbols:
        s = s.strip().upper()
        if not s.endswith(".NS") and not s.startswith("^"):
            s = s + ".NS"
        normalized.append(s)
    symbols = normalized

    stocks = []
    for sym in symbols:
        stock = _get_stock_data(sym)
        if stock:
            stocks.append(stock)

    if len(stocks) < 2:
        return {"error": "Could not find data for enough stocks", "stocks": stocks}

    # Normalized price performance (rebased to 100)
    performance = _calc_normalized_performance(symbols)

    return {
        "stocks": stocks,
        "count": len(stocks),
        "performance": performance,
    }


def _get_stock_data(symbol: str) -> Optional[dict]:
    """Get comprehensive data for a single stock."""
    from live_prices import _price_cache

    result = {
        "symbol": symbol,
        "name": symbol.replace(".NS", ""),
    }

    # Price data
    lp = _price_cache.get(symbol)
    if lp:
        result["price"] = lp["price"]
        result["change_pct"] = lp.get("change_pct", 0)
        result["volume"] = lp.get("volume", 0)
    else:
        price_df = db.get_stock_data(symbol)
        if price_df.empty:
            return None
        latest = price_df.iloc[-1]
        result["price"] = float(latest["close"])
        if len(price_df) > 1:
            prev = float(price_df.iloc[-2]["close"])
            result["change_pct"] = round(((result["price"] - prev) / prev) * 100, 2) if prev else 0
        else:
            result["change_pct"] = 0
        result["volume"] = int(latest["volume"]) if pd.notna(latest.get("volume")) else 0

    # Signal
    signals_df = db.get_latest_signals()
    sig_row = signals_df[signals_df["symbol"] == symbol] if not signals_df.empty else pd.DataFrame()
    if not sig_row.empty:
        sig = sig_row.iloc[0]
        result["signal"] = sig["signal"]
        result["confidence"] = float(sig["confidence"])
        result["composite_score"] = float(sig["composite_score"])
        result["entry_price"] = float(sig["entry_price"])
        result["stop_loss"] = float(sig["stop_loss"])
        result["target_price"] = float(sig["target_price"])
    else:
        result["signal"] = "HOLD"
        result["confidence"] = 0
        result["composite_score"] = 0.5

    # Indicators
    try:
        ind_df = db.get_indicators(symbol)
        if ind_df is not None and len(ind_df) > 0:
            latest_ind = ind_df.iloc[-1]
            result["rsi"] = float(latest_ind["rsi"]) if pd.notna(latest_ind.get("rsi")) else None
            result["macd"] = float(latest_ind["macd"]) if pd.notna(latest_ind.get("macd")) else None
            result["adx"] = float(latest_ind["adx"]) if pd.notna(latest_ind.get("adx")) else None
            result["atr"] = float(latest_ind["atr"]) if pd.notna(latest_ind.get("atr")) else None
            result["sma_50"] = float(latest_ind["sma_50"]) if pd.notna(latest_ind.get("sma_50")) else None
            result["sma_200"] = float(latest_ind["sma_200"]) if pd.notna(latest_ind.get("sma_200")) else None
            result["supertrend_direction"] = int(latest_ind["supertrend_direction"]) if pd.notna(latest_ind.get("supertrend_direction")) else None
    except Exception:
        pass

    # Fundamentals
    try:
        fund = db.get_fundamentals(symbol)
        if fund:
            result["pe"] = fund.get("pe_ratio") or fund.get("trailingPE")
            result["pb"] = fund.get("pb_ratio") or fund.get("priceToBook")
            result["roe"] = fund.get("returnOnEquity") or fund.get("roe")
            result["de"] = fund.get("debtToEquity") or fund.get("de")
            result["market_cap"] = fund.get("marketCap") or fund.get("market_cap")
            result["profit_margin"] = fund.get("profitMargins") or fund.get("profit_margin")
            result["revenue_growth"] = fund.get("revenueGrowth") or fund.get("revenue_growth")
            result["dividend_yield"] = fund.get("dividendYield") or fund.get("dividend_yield")
            result["sector"] = fund.get("sector", "")
        else:
            result["sector"] = ""
    except Exception:
        result["sector"] = ""

    # Returns (1W, 1M, 3M, 6M, 1Y)
    try:
        price_df = db.get_stock_data(symbol)
        if price_df is not None and len(price_df) > 5:
            closes = price_df["close"].values
            current = float(closes[-1])

            def _ret(n):
                if len(closes) > n:
                    past = float(closes[-n-1])
                    return round(((current - past) / past) * 100, 2) if past else None
                return None

            result["return_1w"] = _ret(5)
            result["return_1m"] = _ret(22)
            result["return_3m"] = _ret(66)
            result["return_6m"] = _ret(132)
            result["return_1y"] = _ret(252)
    except Exception:
        pass

    # Radar chart scores (normalized 0-100)
    result["radar"] = _calc_radar_scores(result)

    return result


def _calc_radar_scores(stock: dict) -> dict:
    """Calculate normalized radar chart scores for comparison."""
    scores = {}

    # Momentum (composite score * 100)
    scores["momentum"] = round((stock.get("composite_score", 0.5)) * 100)

    # Value (inverse PE, capped)
    pe = stock.get("pe")
    if pe and pe > 0:
        scores["value"] = min(100, max(0, round(100 - (pe - 5) * 2.5)))
    else:
        scores["value"] = 50

    # Technical (RSI centered at 50, ADX for trend strength)
    rsi = stock.get("rsi")
    scores["technical"] = round(rsi) if rsi else 50

    # Growth
    rev_growth = stock.get("revenue_growth")
    if rev_growth is not None:
        scores["growth"] = min(100, max(0, round(50 + rev_growth * 200)))
    else:
        scores["growth"] = 50

    # Quality (ROE scaled)
    roe = stock.get("roe")
    if roe is not None:
        scores["quality"] = min(100, max(0, round(roe * 400)))
    else:
        scores["quality"] = 50

    # Confidence
    scores["confidence"] = round(stock.get("confidence", 0))

    return scores


def _calc_normalized_performance(symbols: list[str], days: int = 252) -> dict:
    """Calculate normalized price performance for comparison (rebased to 100)."""
    result = {}

    for sym in symbols:
        try:
            price_df = db.get_stock_data(sym)
            if price_df is None or len(price_df) < 20:
                continue
            df = price_df.tail(days)
            closes = df["close"].values.astype(float)
            dates = [str(d)[:10] for d in df["date"].values]
            base = closes[0] if closes[0] != 0 else 1
            normalized = [round(c / base * 100, 2) for c in closes]
            result[sym.replace(".NS", "")] = {
                "dates": dates,
                "values": normalized,
            }
        except Exception as e:
            logger.debug("Failed to get performance for %s: %s", sym, e)

    return result

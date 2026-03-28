"""
Netra — Advanced Analytics
Correlation matrix, data export, and other analytical tools.
"""

import io
import csv
import logging
from typing import Optional

import pandas as pd
import numpy as np

import db
from config import NIFTY_50_STOCKS

logger = logging.getLogger(__name__)

# ─── Cache ────────────────────────────────────────────────────────────────────
_corr_cache: dict = {}
_corr_cache_time: float = 0
_CORR_CACHE_TTL = 3600  # 1 hour


def get_correlation_matrix(lookback: int = 60) -> dict:
    """
    Compute pairwise return correlations for all NIFTY 50 stocks.
    lookback: number of trading days (30, 60, or 90).
    """
    import time
    global _corr_cache, _corr_cache_time

    cache_key = f"corr_{lookback}"
    now = time.time()
    if now - _corr_cache_time < _CORR_CACHE_TTL and cache_key in _corr_cache:
        return _corr_cache[cache_key]

    # Collect close prices for all stocks
    all_closes = {}
    for symbol in NIFTY_50_STOCKS[:50]:  # Core NIFTY 50
        price_df = db.get_stock_data(symbol)
        if price_df.empty or len(price_df) < lookback + 5:
            continue
        # Use last `lookback` days of daily returns
        closes = price_df["close"].tail(lookback + 1).astype(float)
        returns = closes.pct_change().dropna()
        if len(returns) >= lookback - 5:
            name = symbol.replace(".NS", "")
            all_closes[name] = returns.values[:lookback]

    if len(all_closes) < 5:
        return {"matrix": [], "symbols": [], "lookback": lookback, "count": 0}

    # Build DataFrame and compute correlation
    symbols = sorted(all_closes.keys())
    # Ensure all arrays same length
    min_len = min(len(v) for v in all_closes.values())
    df = pd.DataFrame({s: all_closes[s][:min_len] for s in symbols})
    corr = df.corr()

    # Convert to serializable format
    matrix = []
    for i, s1 in enumerate(symbols):
        row = []
        for j, s2 in enumerate(symbols):
            val = corr.iloc[i, j]
            row.append(round(float(val), 3) if pd.notna(val) else 0)
        matrix.append(row)

    # Find top correlated and least correlated pairs
    pairs = []
    for i in range(len(symbols)):
        for j in range(i + 1, len(symbols)):
            pairs.append({
                "stock1": symbols[i],
                "stock2": symbols[j],
                "correlation": matrix[i][j],
            })

    pairs.sort(key=lambda p: abs(p["correlation"]), reverse=True)
    top_correlated = pairs[:10]
    least_correlated = sorted(pairs, key=lambda p: abs(p["correlation"]))[:10]

    result = {
        "matrix": matrix,
        "symbols": symbols,
        "lookback": lookback,
        "count": len(symbols),
        "top_correlated": top_correlated,
        "least_correlated": least_correlated,
    }

    _corr_cache[cache_key] = result
    _corr_cache_time = now
    return result


# ─── Data Export ──────────────────────────────────────────────────────────────

def export_signals_csv() -> str:
    """Export latest signals as CSV string."""
    signals_df = db.get_latest_signals()
    if signals_df.empty:
        return "No signals available\n"

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Symbol", "Name", "Date", "Signal", "Strength", "Composite Score",
                      "Entry Price", "Stop Loss", "Target Price"])

    for _, row in signals_df.iterrows():
        writer.writerow([
            row["symbol"],
            row["symbol"].replace(".NS", ""),
            str(row["date"])[:10],
            row["signal"],
            f'{row["confidence"]:.1f}%',
            f'{row["composite_score"]:.4f}',
            f'{row["entry_price"]:.2f}',
            f'{row["stop_loss"]:.2f}',
            f'{row["target_price"]:.2f}',
        ])

    return output.getvalue()


def export_screener_csv(signal_filter: Optional[str] = None, sector: Optional[str] = None) -> str:
    """Export screener results as CSV string."""
    from screener import run_screener

    results = run_screener(signal_filter=signal_filter, sector=sector)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Symbol", "Name", "LTP", "Change %", "Signal", "Strength",
                      "Composite", "RSI", "ADX", "P/E", "ROE", "Sector"])

    for r in results:
        writer.writerow([
            r.get("symbol", ""),
            r.get("name", ""),
            f'{r.get("ltp", 0):.2f}' if r.get("ltp") else "",
            f'{r.get("change_pct", 0):.2f}' if r.get("change_pct") is not None else "",
            r.get("signal", ""),
            f'{r.get("confidence", 0):.1f}%',
            f'{r.get("composite_score", 0):.4f}',
            f'{r.get("rsi", 0):.1f}' if r.get("rsi") else "",
            f'{r.get("adx", 0):.1f}' if r.get("adx") else "",
            f'{r.get("pe", 0):.1f}' if r.get("pe") else "",
            f'{r.get("roe", 0):.4f}' if r.get("roe") else "",
            r.get("sector", ""),
        ])

    return output.getvalue()

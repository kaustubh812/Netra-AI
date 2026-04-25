"""
Netra — AI Stock Screener
Accepts natural language queries and converts them to structured filters
using GPT-5.4-mini, then runs against existing stock data.
"""

import json
import logging
import time
from typing import Optional

import pandas as pd
from openai import OpenAI

import db
from config import OPENAI_API_KEY, OPENAI_MODEL, NIFTY_50_STOCKS

logger = logging.getLogger(__name__)

client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

# Cache screener base data for 5 minutes
_screener_cache: Optional[pd.DataFrame] = None
_screener_cache_time: float = 0
_SCREENER_CACHE_TTL = 300

FILTER_SCHEMA = """{
  "signal": "BUY|SELL|HOLD|null",
  "confidence_min": "number|null (0-100)",
  "confidence_max": "number|null (0-100)",
  "composite_min": "number|null (0-1)",
  "composite_max": "number|null (0-1)",
  "rsi_min": "number|null (0-100)",
  "rsi_max": "number|null (0-100)",
  "pe_min": "number|null",
  "pe_max": "number|null",
  "change_pct_min": "number|null",
  "change_pct_max": "number|null",
  "sector": "string|null (IT, Banking, Auto, Pharma, Energy, FMCG, Metals, Infra, Telecom, etc.)",
  "sort_by": "confidence|composite_score|change_pct|rsi|pe|null",
  "sort_order": "asc|desc",
  "limit": "number (default 10)"
}"""

SYSTEM_PROMPT = f"""You are a stock screener filter parser for an Indian market (NSE Nifty 50) trading system.

Convert the user's natural language query into a JSON filter object. Available filters:

{FILTER_SCHEMA}

Key facts:
- Signals: BUY (composite > 0.65), SELL (composite < 0.35), HOLD (in between)
- Confidence: 0-100% signal strength
- Composite score: 0-1 (0.5 = neutral, >0.65 = bullish, <0.35 = bearish)
- RSI: 0-100 (>60 overbought in Indian market, <40 oversold)
- "Oversold" means RSI < 40, "overbought" means RSI > 60
- "Large caps" = top Nifty 50 stocks (all stocks are large cap)
- "Good fundamentals" = PE between 5-25 (reasonable valuation)
- Sectors: IT, Banking, Auto, Pharma, Energy, FMCG, Metals, Infra, Telecom, Cement, Realty, Media, Insurance, Financial Services

Return ONLY valid JSON, no explanation. Set unused filters to null."""


def _build_screener_data() -> pd.DataFrame:
    """Build consolidated screener data from signals, indicators, and fundamentals."""
    global _screener_cache, _screener_cache_time

    now = time.time()
    if _screener_cache is not None and (now - _screener_cache_time) < _SCREENER_CACHE_TTL:
        return _screener_cache

    # Get latest signals
    signals_df = db.get_latest_signals()
    if signals_df.empty:
        return pd.DataFrame()

    rows = []
    for _, sig in signals_df.iterrows():
        sym = sig["symbol"]
        row = {
            "symbol": sym,
            "name": sym.replace(".NS", ""),
            "signal": sig.get("signal", "HOLD"),
            "confidence": sig.get("confidence", 0),
            "composite_score": sig.get("composite_score", 0.5),
            "entry_price": sig.get("entry_price", 0),
            "stop_loss": sig.get("stop_loss", 0),
            "target_price": sig.get("target_price", 0),
        }

        # Get latest indicators (RSI, MACD, etc.)
        try:
            ind_df = db.get_indicators(sym)
            if ind_df is not None and len(ind_df) > 0:
                latest_ind = ind_df.iloc[-1]
                row["rsi"] = float(latest_ind.get("rsi", 50)) if pd.notna(latest_ind.get("rsi")) else None
                row["macd"] = float(latest_ind.get("macd", 0)) if pd.notna(latest_ind.get("macd")) else None
        except Exception:
            row["rsi"] = None
            row["macd"] = None

        # Get fundamentals
        try:
            fund = db.get_fundamentals(sym)
            if fund:
                row["pe"] = fund.get("pe_ratio") or fund.get("pe")
                row["pb"] = fund.get("pb_ratio") or fund.get("pb")
                row["roe"] = fund.get("roe")
                row["market_cap"] = fund.get("market_cap")
                row["sector"] = fund.get("sector", "")
            else:
                row["pe"] = None
                row["pb"] = None
                row["roe"] = None
                row["market_cap"] = None
                row["sector"] = ""
        except Exception:
            row["pe"] = None
            row["sector"] = ""

        # Get latest price change
        try:
            price_df = db.get_stock_data(sym)
            if price_df is not None and len(price_df) >= 2:
                curr = float(price_df["close"].iloc[-1])
                prev = float(price_df["close"].iloc[-2])
                row["price"] = curr
                row["change_pct"] = round(((curr - prev) / prev) * 100, 2) if prev else 0
            else:
                row["price"] = row["entry_price"]
                row["change_pct"] = 0
        except Exception:
            row["price"] = row["entry_price"]
            row["change_pct"] = 0

        rows.append(row)

    df = pd.DataFrame(rows)
    _screener_cache = df
    _screener_cache_time = time.time()
    return df


def _parse_query_to_filters(query: str) -> dict:
    """Use GPT to parse natural language query to filter JSON."""
    if not client:
        return {"error": "OpenAI API key not configured"}

    try:
        response = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": query},
            ],
            temperature=0.1,
            max_completion_tokens=300,
        )
        text = response.choices[0].message.content.strip()
        # Clean markdown code blocks if present
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        return json.loads(text)
    except json.JSONDecodeError as e:
        logger.warning("Failed to parse GPT screener response: %s", e)
        return {"error": f"Failed to parse filter: {e}"}
    except Exception as e:
        logger.error("GPT screener call failed: %s", e)
        return {"error": str(e)}


def _apply_filters(df: pd.DataFrame, filters: dict) -> pd.DataFrame:
    """Apply parsed filters to the screener DataFrame."""
    result = df.copy()

    # Ensure expected columns exist (may be missing if data fetch failed)
    for col, default in [("rsi", None), ("pe", None), ("pb", None), ("sector", ""), ("change_pct", 0), ("macd", None), ("roe", None), ("market_cap", None)]:
        if col not in result.columns:
            result[col] = default

    if filters.get("signal"):
        result = result[result["signal"] == filters["signal"].upper()]

    if filters.get("confidence_min") is not None:
        result = result[result["confidence"] >= filters["confidence_min"]]
    if filters.get("confidence_max") is not None:
        result = result[result["confidence"] <= filters["confidence_max"]]

    if filters.get("composite_min") is not None:
        result = result[result["composite_score"] >= filters["composite_min"]]
    if filters.get("composite_max") is not None:
        result = result[result["composite_score"] <= filters["composite_max"]]

    if filters.get("rsi_min") is not None:
        result = result[result["rsi"].notna() & (result["rsi"] >= filters["rsi_min"])]
    if filters.get("rsi_max") is not None:
        result = result[result["rsi"].notna() & (result["rsi"] <= filters["rsi_max"])]

    if filters.get("pe_min") is not None:
        result = result[result["pe"].notna() & (result["pe"] >= filters["pe_min"])]
    if filters.get("pe_max") is not None:
        result = result[result["pe"].notna() & (result["pe"] <= filters["pe_max"])]

    if filters.get("change_pct_min") is not None:
        result = result[result["change_pct"] >= filters["change_pct_min"]]
    if filters.get("change_pct_max") is not None:
        result = result[result["change_pct"] <= filters["change_pct_max"]]

    if filters.get("sector"):
        sector = filters["sector"].lower()
        result = result[result["sector"].str.lower().str.contains(sector, na=False)]

    # Sort
    sort_by = filters.get("sort_by") or "confidence"
    sort_order = filters.get("sort_order", "desc") == "asc"
    if sort_by in result.columns:
        result = result.sort_values(sort_by, ascending=sort_order, na_position="last")

    # Limit
    limit = filters.get("limit") or 10
    result = result.head(int(limit))

    return result


def ai_screen(query: str) -> dict:
    """Main entry: parse NL query → filter → return results."""
    # Parse query
    filters = _parse_query_to_filters(query)
    if "error" in filters:
        return {"error": filters["error"], "results": [], "count": 0}

    # Build base data
    df = _build_screener_data()
    if df.empty:
        return {"error": "No stock data available", "results": [], "count": 0}

    # Apply filters
    filtered = _apply_filters(df, filters)

    # Convert to list of dicts
    results = filtered.to_dict(orient="records")

    # Clean NaN values
    for r in results:
        for k, v in r.items():
            if pd.isna(v):
                r[k] = None

    return {
        "query": query,
        "filters": filters,
        "results": results,
        "count": len(results),
        "total_stocks": len(df),
    }

"""
Netra — Data Fetcher
Pulls OHLCV data from Yahoo Finance for NSE stocks and caches in SQLite.
"""

import logging
from datetime import datetime, timedelta
from typing import Optional

import pandas as pd
import yfinance as yf
import pytz

from config import (
    ALL_SYMBOLS, NIFTY_50_STOCKS, INDEX_SYMBOLS,
    HISTORY_PERIOD, INTRADAY_PERIOD, INTRADAY_INTERVAL, TIMEZONE,
)
import db

logger = logging.getLogger(__name__)
IST = pytz.timezone(TIMEZONE)

# Track symbols that failed to fetch so we don't retry them repeatedly
_failed_symbols: set = set()


def fetch_stock_history(symbol: str, period: str = HISTORY_PERIOD, interval: str = "1d") -> pd.DataFrame:
    """
    Fetch OHLCV data for a single stock from Yahoo Finance.
    Returns a clean DataFrame with columns: date, open, high, low, close, volume.
    """
    try:
        logger.info("Fetching %s data for %s (interval=%s)", period, symbol, interval)
        ticker = yf.Ticker(symbol)
        df = ticker.history(period=period, interval=interval, auto_adjust=True)

        if df.empty:
            logger.warning("No data returned for %s", symbol)
            return pd.DataFrame()

        df = df.reset_index()

        # Normalize column names
        df.columns = [c.lower().replace(" ", "_") for c in df.columns]

        # Rename 'datetime' to 'date' if present (intraday data)
        if "datetime" in df.columns:
            df = df.rename(columns={"datetime": "date"})

        # Keep only OHLCV columns
        keep_cols = ["date", "open", "high", "low", "close", "volume"]
        df = df[[c for c in keep_cols if c in df.columns]]

        # Convert date to string for daily data
        if interval == "1d":
            df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")

        # Drop rows with missing data
        df = df.dropna(subset=["open", "high", "low", "close"])

        logger.info("Fetched %d rows for %s", len(df), symbol)
        return df

    except Exception as e:
        logger.error("Error fetching data for %s: %s", symbol, e)
        return pd.DataFrame()


def fetch_and_store(symbol: str, period: str = HISTORY_PERIOD):
    """Fetch data for a stock and store it in SQLite."""
    df = fetch_stock_history(symbol, period=period)
    if not df.empty:
        db.save_stock_data(df, symbol)
    return df


def incremental_fetch(symbol: str) -> pd.DataFrame:
    """
    Fetch only the data we're missing since the last stored date.
    Falls back to full fetch if no data exists.
    """
    latest = db.get_latest_date(symbol)
    if latest is None:
        logger.info("No existing data for %s, doing full fetch", symbol)
        return fetch_and_store(symbol)

    # Fetch from the day after the latest stored date
    start_date = (pd.to_datetime(latest) + timedelta(days=1)).strftime("%Y-%m-%d")
    today = datetime.now(IST).strftime("%Y-%m-%d")

    if start_date > today:
        logger.info("Data for %s is up to date", symbol)
        return pd.DataFrame()

    try:
        logger.info("Incremental fetch for %s from %s", symbol, start_date)
        ticker = yf.Ticker(symbol)
        df = ticker.history(start=start_date, end=today, interval="1d", auto_adjust=True)

        if df.empty:
            logger.info("No new data for %s", symbol)
            return pd.DataFrame()

        df = df.reset_index()
        df.columns = [c.lower().replace(" ", "_") for c in df.columns]
        if "datetime" in df.columns:
            df = df.rename(columns={"datetime": "date"})

        keep_cols = ["date", "open", "high", "low", "close", "volume"]
        df = df[[c for c in keep_cols if c in df.columns]]
        df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")
        df = df.dropna(subset=["open", "high", "low", "close"])

        if not df.empty:
            db.save_stock_data(df, symbol)
            logger.info("Saved %d new rows for %s", len(df), symbol)

        return df

    except Exception as e:
        logger.error("Incremental fetch failed for %s: %s", symbol, e)
        return pd.DataFrame()


def fetch_all_stocks(incremental: bool = True):
    """Fetch data for all tracked stocks."""
    results = {}
    for symbol in ALL_SYMBOLS:
        try:
            if incremental:
                df = incremental_fetch(symbol)
            else:
                df = fetch_and_store(symbol)
            results[symbol] = len(df) if not df.empty else 0
        except Exception as e:
            logger.error("Failed to fetch %s: %s", symbol, e)
            results[symbol] = -1
    return results


def fetch_intraday(symbol: str) -> pd.DataFrame:
    """Fetch 1-minute intraday candles (last 60 days from yfinance)."""
    return fetch_stock_history(symbol, period=INTRADAY_PERIOD, interval=INTRADAY_INTERVAL)


def get_stock_df(symbol: str) -> pd.DataFrame:
    """
    Get stock data from the database. If no data exists, fetch it first.
    Returns a DataFrame with date as datetime index.
    """
    df = db.get_stock_data(symbol)
    if df.empty and symbol not in _failed_symbols:
        fetch_and_store(symbol)
        df = db.get_stock_data(symbol)
        if df.empty:
            _failed_symbols.add(symbol)
    if not df.empty:
        df["date"] = pd.to_datetime(df["date"])
        df = df.set_index("date")
    return df

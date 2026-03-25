"""
Netra — Technical Indicators
Calculates all technical indicators for stock analysis.
Uses the `ta` library plus custom Supertrend implementation.
"""

import logging

import numpy as np
import pandas as pd
import ta
from ta.trend import SMAIndicator, EMAIndicator, MACD, ADXIndicator
from ta.momentum import RSIIndicator, StochasticOscillator
from ta.volatility import BollingerBands, AverageTrueRange
from ta.volume import OnBalanceVolumeIndicator

import db

logger = logging.getLogger(__name__)


def calculate_supertrend(df: pd.DataFrame, period: int = 7, multiplier: float = 3.0) -> pd.DataFrame:
    """
    Calculate Supertrend indicator (popular in Indian markets).
    Returns DataFrame with 'supertrend' and 'supertrend_direction' columns.
    Direction: 1 = uptrend (bullish), -1 = downtrend (bearish).
    """
    hl2 = (df["high"] + df["low"]) / 2
    atr = AverageTrueRange(df["high"], df["low"], df["close"], window=period).average_true_range()

    upper_band = hl2 + (multiplier * atr)
    lower_band = hl2 - (multiplier * atr)

    supertrend = pd.Series(np.nan, index=df.index)
    direction = pd.Series(1, index=df.index, dtype=int)

    for i in range(1, len(df)):
        # Lower band logic
        if lower_band.iloc[i] > lower_band.iloc[i - 1] or df["close"].iloc[i - 1] < lower_band.iloc[i - 1]:
            pass  # keep current lower band
        else:
            lower_band.iloc[i] = lower_band.iloc[i - 1]

        # Upper band logic
        if upper_band.iloc[i] < upper_band.iloc[i - 1] or df["close"].iloc[i - 1] > upper_band.iloc[i - 1]:
            pass  # keep current upper band
        else:
            upper_band.iloc[i] = upper_band.iloc[i - 1]

        # Determine direction
        if supertrend.iloc[i - 1] == upper_band.iloc[i - 1]:
            if df["close"].iloc[i] > upper_band.iloc[i]:
                supertrend.iloc[i] = lower_band.iloc[i]
                direction.iloc[i] = 1
            else:
                supertrend.iloc[i] = upper_band.iloc[i]
                direction.iloc[i] = -1
        else:
            if df["close"].iloc[i] < lower_band.iloc[i]:
                supertrend.iloc[i] = upper_band.iloc[i]
                direction.iloc[i] = -1
            else:
                supertrend.iloc[i] = lower_band.iloc[i]
                direction.iloc[i] = 1

    # Initialize first value
    supertrend.iloc[0] = upper_band.iloc[0]

    return pd.DataFrame({
        "supertrend": supertrend,
        "supertrend_direction": direction,
    }, index=df.index)


def calculate_vwap(df: pd.DataFrame) -> pd.Series:
    """Calculate Volume Weighted Average Price (daily reset)."""
    typical_price = (df["high"] + df["low"] + df["close"]) / 3
    vwap = (typical_price * df["volume"]).cumsum() / df["volume"].cumsum()
    return vwap


def calculate_all_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """
    Calculate all technical indicators for a stock DataFrame.
    Input: DataFrame with columns [open, high, low, close, volume] and date index.
    Returns: DataFrame with all indicator columns added, NaN rows dropped.
    """
    if df.empty or len(df) < 200:
        logger.warning("Insufficient data for indicator calculation (%d rows)", len(df))
        return pd.DataFrame()

    result = df.copy()

    # ─── Moving Averages ─────────────────────────────────────────────────
    result["sma_20"] = SMAIndicator(result["close"], window=20).sma_indicator()
    result["sma_50"] = SMAIndicator(result["close"], window=50).sma_indicator()
    result["sma_200"] = SMAIndicator(result["close"], window=200).sma_indicator()
    result["ema_12"] = EMAIndicator(result["close"], window=12).ema_indicator()
    result["ema_26"] = EMAIndicator(result["close"], window=26).ema_indicator()

    # ─── RSI ─────────────────────────────────────────────────────────────
    result["rsi"] = RSIIndicator(result["close"], window=14).rsi()

    # ─── MACD ────────────────────────────────────────────────────────────
    macd = MACD(result["close"], window_slow=26, window_fast=12, window_sign=9)
    result["macd"] = macd.macd()
    result["macd_signal"] = macd.macd_signal()
    result["macd_hist"] = macd.macd_diff()

    # ─── Bollinger Bands ─────────────────────────────────────────────────
    bb = BollingerBands(result["close"], window=20, window_dev=2)
    result["bb_upper"] = bb.bollinger_hband()
    result["bb_middle"] = bb.bollinger_mavg()
    result["bb_lower"] = bb.bollinger_lband()

    # ─── Supertrend ──────────────────────────────────────────────────────
    st = calculate_supertrend(result, period=7, multiplier=3.0)
    result["supertrend"] = st["supertrend"]
    result["supertrend_direction"] = st["supertrend_direction"]

    # ─── VWAP ────────────────────────────────────────────────────────────
    result["vwap"] = calculate_vwap(result)

    # ─── ADX ─────────────────────────────────────────────────────────────
    result["adx"] = ADXIndicator(result["high"], result["low"], result["close"], window=14).adx()

    # ─── Stochastic Oscillator ───────────────────────────────────────────
    stoch = StochasticOscillator(result["high"], result["low"], result["close"], window=14, smooth_window=3)
    result["stoch_k"] = stoch.stoch()
    result["stoch_d"] = stoch.stoch_signal()

    # ─── OBV ─────────────────────────────────────────────────────────────
    result["obv"] = OnBalanceVolumeIndicator(result["close"], result["volume"]).on_balance_volume()

    # ─── ATR ─────────────────────────────────────────────────────────────
    result["atr"] = AverageTrueRange(result["high"], result["low"], result["close"], window=14).average_true_range()

    # ─── Volume SMA ──────────────────────────────────────────────────────
    result["volume_sma_20"] = SMAIndicator(result["volume"].astype(float), window=20).sma_indicator()

    # ─── 52-Week High/Low Proximity ──────────────────────────────────────
    result["high_52w"] = result["high"].rolling(window=252, min_periods=1).max()
    result["low_52w"] = result["low"].rolling(window=252, min_periods=1).min()

    # ─── Derived Features ────────────────────────────────────────────────
    result["pct_from_52w_high"] = (result["close"] - result["high_52w"]) / result["high_52w"] * 100
    result["pct_from_52w_low"] = (result["close"] - result["low_52w"]) / result["low_52w"] * 100
    result["bb_position"] = (result["close"] - result["bb_lower"]) / (result["bb_upper"] - result["bb_lower"])
    result["volume_ratio"] = result["volume"] / result["volume_sma_20"]
    result["day_of_week"] = pd.to_datetime(result.index if isinstance(result.index, pd.DatetimeIndex) else result.get("date", result.index)).dayofweek

    # Drop rows where indicators aren't ready (first ~200 rows due to SMA200)
    result = result.dropna()

    logger.info("Calculated indicators: %d rows with %d features", len(result), len(result.columns))
    return result


def compute_and_store_indicators(symbol: str, df: pd.DataFrame) -> pd.DataFrame:
    """Calculate indicators for a stock and store in DB."""
    indicators_df = calculate_all_indicators(df)
    if not indicators_df.empty:
        # Prepare for DB storage
        store_df = indicators_df.reset_index()
        if "date" not in store_df.columns:
            store_df = store_df.rename(columns={store_df.columns[0]: "date"})
        store_df["date"] = pd.to_datetime(store_df["date"]).dt.strftime("%Y-%m-%d")
        db.save_indicators(store_df, symbol)
    return indicators_df

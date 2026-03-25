"""
Netra — Backtesting Engine
Backtests trading signals with realistic Indian market trading costs.
Uses vectorbt for performance calculation where available, with a
fallback pure-pandas implementation.
"""

import logging
import json
from typing import Optional

import numpy as np
import pandas as pd

from config import (
    BROKERAGE_PER_ORDER, STT_DELIVERY_SELL, GST_RATE,
    SEBI_CHARGES_PER_CRORE, STAMP_DUTY_BUY,
    TRAIN_TEST_SPLIT_YEAR, NIFTY_50_STOCKS,
    BUY_THRESHOLD, SELL_THRESHOLD,
    STOP_LOSS_ATR_MULTIPLIER, TARGET_ATR_MULTIPLIER,
)
from data_fetcher import get_stock_df
from indicators import calculate_all_indicators
from model import load_model, predict, FEATURE_COLS
import db

logger = logging.getLogger(__name__)


def calculate_trading_costs(buy_value: float, sell_value: float) -> float:
    """Calculate total trading costs for a round-trip trade (Indian market)."""
    # Brokerage: ₹20 per order (buy + sell)
    brokerage = BROKERAGE_PER_ORDER * 2

    # STT: 0.025% on sell side for delivery
    stt = sell_value * STT_DELIVERY_SELL

    # GST: 18% on brokerage
    gst = brokerage * GST_RATE

    # SEBI charges: ₹10 per crore on both sides
    sebi = (buy_value + sell_value) * SEBI_CHARGES_PER_CRORE / 1e7

    # Stamp duty: 0.015% on buy side
    stamp = buy_value * STAMP_DUTY_BUY

    return brokerage + stt + gst + sebi + stamp


def backtest_stock(symbol: str, initial_capital: float = 100000.0) -> Optional[dict]:
    """
    Backtest a stock's signals on test period data (2024+).
    Uses the trained model to generate signals on historical test data.
    """
    logger.info("Backtesting %s", symbol)

    # Get data
    stock_df = get_stock_df(symbol)
    if stock_df.empty:
        logger.error("No data for backtesting %s", symbol)
        return None

    indicators_df = calculate_all_indicators(stock_df)
    if indicators_df.empty:
        return None

    # Filter to test period only
    test_mask = indicators_df.index.year >= TRAIN_TEST_SPLIT_YEAR
    test_df = indicators_df[test_mask].copy()

    if len(test_df) < 20:
        logger.warning("Insufficient test data for %s (%d rows)", symbol, len(test_df))
        return None

    # Load model
    model = load_model(symbol)
    if model is None:
        logger.warning("No model for %s, skipping backtest", symbol)
        return None

    # Generate predictions for each day in test period
    available_features = [c for c in FEATURE_COLS if c in test_df.columns]
    X_test = test_df[available_features]
    probabilities = model.predict_proba(X_test)[:, 1]

    # Simulate trading
    capital = initial_capital
    position = 0  # Number of shares held
    entry_price = 0.0
    trades = []
    equity_curve = [initial_capital]

    for i in range(len(test_df) - 1):
        prob = probabilities[i]
        close = float(test_df["close"].iloc[i])
        next_close = float(test_df["close"].iloc[i + 1])
        atr = float(test_df["atr"].iloc[i]) if "atr" in test_df.columns else close * 0.02

        if position == 0 and prob > BUY_THRESHOLD:
            # BUY signal — enter position
            shares = int(capital * 0.95 / close)  # Use 95% of capital
            if shares > 0:
                buy_value = shares * close
                position = shares
                entry_price = close
                stop_loss = close - (STOP_LOSS_ATR_MULTIPLIER * atr)
                target = close + (TARGET_ATR_MULTIPLIER * atr)
                capital -= buy_value

        elif position > 0:
            # Check exit conditions
            exit_signal = False
            exit_reason = ""

            if prob < SELL_THRESHOLD:
                exit_signal = True
                exit_reason = "SELL signal"
            elif close <= entry_price - (STOP_LOSS_ATR_MULTIPLIER * atr):
                exit_signal = True
                exit_reason = "Stop loss hit"
            elif close >= entry_price + (TARGET_ATR_MULTIPLIER * atr):
                exit_signal = True
                exit_reason = "Target hit"

            if exit_signal:
                sell_value = position * close
                costs = calculate_trading_costs(entry_price * position, sell_value)
                pnl = sell_value - (entry_price * position) - costs

                trades.append({
                    "entry_price": entry_price,
                    "exit_price": close,
                    "shares": position,
                    "pnl": pnl,
                    "pnl_pct": (pnl / (entry_price * position)) * 100,
                    "reason": exit_reason,
                })

                capital += sell_value - costs
                position = 0
                entry_price = 0.0

        # Track equity curve
        current_equity = capital + (position * float(test_df["close"].iloc[i]))
        equity_curve.append(current_equity)

    # Close any remaining position at the last price
    if position > 0:
        last_close = float(test_df["close"].iloc[-1])
        sell_value = position * last_close
        costs = calculate_trading_costs(entry_price * position, sell_value)
        pnl = sell_value - (entry_price * position) - costs
        trades.append({
            "entry_price": entry_price,
            "exit_price": last_close,
            "shares": position,
            "pnl": pnl,
            "pnl_pct": (pnl / (entry_price * position)) * 100,
            "reason": "End of period",
        })
        capital += sell_value - costs

    # Calculate metrics
    final_equity = capital
    total_return = ((final_equity - initial_capital) / initial_capital) * 100

    # Buy-and-hold comparison
    bh_start = float(test_df["close"].iloc[0])
    bh_end = float(test_df["close"].iloc[-1])
    bh_return = ((bh_end - bh_start) / bh_start) * 100

    # Trade statistics
    winning_trades = [t for t in trades if t["pnl"] > 0]
    losing_trades = [t for t in trades if t["pnl"] <= 0]
    total_trades = len(trades)
    win_rate = (len(winning_trades) / total_trades * 100) if total_trades > 0 else 0
    avg_profit = np.mean([t["pnl"] for t in winning_trades]) if winning_trades else 0
    avg_loss = np.mean([t["pnl"] for t in losing_trades]) if losing_trades else 0

    # Sharpe ratio (annualized, assuming ~252 trading days)
    equity_series = pd.Series(equity_curve)
    daily_returns = equity_series.pct_change().dropna()
    if len(daily_returns) > 0 and daily_returns.std() > 0:
        sharpe = (daily_returns.mean() / daily_returns.std()) * np.sqrt(252)
    else:
        sharpe = 0

    # Max drawdown
    peak = equity_series.expanding(min_periods=1).max()
    drawdown = (equity_series - peak) / peak
    max_drawdown = float(drawdown.min()) * 100  # as percentage

    # Normalize equity curve for storage (sample every 5 points to keep it compact)
    sampled_curve = equity_curve[::max(1, len(equity_curve) // 100)]
    equity_curve_json = json.dumps([round(v, 2) for v in sampled_curve])

    results = {
        "symbol": symbol,
        "total_return": round(total_return, 2),
        "buy_hold_return": round(bh_return, 2),
        "sharpe_ratio": round(float(sharpe), 4),
        "max_drawdown": round(max_drawdown, 2),
        "win_rate": round(win_rate, 2),
        "total_trades": total_trades,
        "avg_profit": round(float(avg_profit), 2),
        "avg_loss": round(float(avg_loss), 2),
        "equity_curve": equity_curve_json,
        "initial_capital": initial_capital,
        "final_equity": round(final_equity, 2),
    }

    # Save to DB
    db.save_backtest_result(symbol, results)

    logger.info(
        "%s backtest — Return: %.2f%% (B&H: %.2f%%), Sharpe: %.4f, MaxDD: %.2f%%, Trades: %d, WR: %.1f%%",
        symbol, total_return, bh_return, sharpe, max_drawdown, total_trades, win_rate,
    )

    return results


def backtest_all_stocks() -> list:
    """Run backtests for all tracked stocks."""
    results = []
    for symbol in NIFTY_50_STOCKS:
        try:
            result = backtest_stock(symbol)
            if result:
                results.append(result)
        except Exception as e:
            logger.error("Backtest failed for %s: %s", symbol, e)
    return results

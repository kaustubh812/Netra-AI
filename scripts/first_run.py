"""
Netra - First Run Script
Fetches data, trains models, generates signals, and runs backtests.
Run this once after initial setup.
"""

import sys
import os

# Fix Windows console encoding for Unicode output
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

import warnings
warnings.filterwarnings('ignore')

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

def main():
    print("=" * 50)
    print("  Netra - First Run Setup")
    print("  The eye that sees the market")
    print("=" * 50)
    print(flush=True)

    # Step 1: Initialize DB
    print("[1/5] Initializing database...")
    import db
    print(f"  Database at: {db.DB_PATH}", flush=True)
    print()

    # Step 2: Fetch data
    print("[2/5] Fetching market data (this may take a few minutes)...")
    from config import ALL_SYMBOLS
    from data_fetcher import fetch_and_store
    fetched = 0
    failed = 0
    for i, symbol in enumerate(ALL_SYMBOLS):
        try:
            df = fetch_and_store(symbol, period='5y')
            rows = len(df) if not df.empty else 0
            if rows > 0:
                fetched += 1
                print(f"  [{i+1}/{len(ALL_SYMBOLS)}] {symbol}: {rows} rows", flush=True)
            else:
                failed += 1
                print(f"  [{i+1}/{len(ALL_SYMBOLS)}] {symbol}: SKIPPED (no data)", flush=True)
        except Exception as e:
            failed += 1
            print(f"  [{i+1}/{len(ALL_SYMBOLS)}] {symbol}: FAILED ({e})", flush=True)
    print(f"  Done: {fetched} fetched, {failed} failed")
    print(flush=True)

    # Step 3: Train models
    print("[3/5] Training ML models...")
    from config import NIFTY_50_STOCKS
    from model import train_model
    trained = 0
    for i, symbol in enumerate(NIFTY_50_STOCKS):
        try:
            metrics = train_model(symbol, optimize=False, n_trials=0)
            if "error" not in metrics:
                trained += 1
                acc = metrics.get("accuracy", 0)
                f1 = metrics.get("f1_score", 0)
                print(f"  [{i+1}/{len(NIFTY_50_STOCKS)}] {symbol}: acc={acc:.3f} f1={f1:.3f}", flush=True)
            else:
                print(f"  [{i+1}/{len(NIFTY_50_STOCKS)}] {symbol}: SKIPPED ({metrics['error']})", flush=True)
        except Exception as e:
            print(f"  [{i+1}/{len(NIFTY_50_STOCKS)}] {symbol}: FAILED ({e})", flush=True)
    print(f"  Trained {trained}/{len(NIFTY_50_STOCKS)} models")
    print(flush=True)

    # Step 4: Generate signals
    print("[4/5] Generating trading signals...")
    from signals import generate_all_signals
    signals = generate_all_signals()
    print(f"  Generated {len(signals)} signals")
    for s in signals[:5]:
        print(f"    {s['symbol']}: {s['signal']} ({s['confidence']:.1f}%)")
    if len(signals) > 5:
        print(f"    ... and {len(signals) - 5} more")
    print(flush=True)

    # Step 5: Run backtests
    print("[5/5] Running backtests...")
    from backtest import backtest_all_stocks
    bt_results = backtest_all_stocks()
    print(f"  Backtested {len(bt_results)} stocks")
    for r in bt_results[:5]:
        print(f"    {r['symbol']}: {r['total_return']:.2f}% (B&H: {r['buy_hold_return']:.2f}%)")
    print()

    print("=" * 50)
    print("  Setup complete!")
    print("  Start the backend:  cd backend && python main.py")
    print("  Start the frontend: cd frontend && npm run dev")
    print("  Open: http://localhost:3000")
    print("=" * 50)


if __name__ == "__main__":
    main()

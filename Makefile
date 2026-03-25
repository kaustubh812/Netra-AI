.PHONY: setup fetch-data train backtest run update backend frontend

# ─── Setup ───────────────────────────────────────────────────────────────────
setup:
	cd backend && pip install -r requirements.txt
	cd frontend && npm install

# ─── Data ────────────────────────────────────────────────────────────────────
fetch-data:
	cd backend && python -c "from data_fetcher import fetch_all_stocks; print(fetch_all_stocks(incremental=False))"

# ─── Training ────────────────────────────────────────────────────────────────
train:
	cd backend && python -c "from model import train_all_models; train_all_models(optimize=False)"

train-optimized:
	cd backend && python -c "from model import train_all_models; train_all_models(optimize=True)"

train-general:
	cd backend && python -c "from model import train_general_model; train_general_model(optimize=False)"

# ─── Backtesting ─────────────────────────────────────────────────────────────
backtest:
	cd backend && python -c "from backtest import backtest_all_stocks; results = backtest_all_stocks(); [print(f\"{r['symbol']}: {r['total_return']:.2f}% (B&H: {r['buy_hold_return']:.2f}%)\") for r in results]"

# ─── Signals ─────────────────────────────────────────────────────────────────
signals:
	cd backend && python -c "from signals import generate_all_signals; sigs = generate_all_signals(); [print(f\"{s['symbol']}: {s['signal']} ({s['confidence']:.1f}%)\") for s in sigs]"

# ─── Servers ─────────────────────────────────────────────────────────────────
backend:
	cd backend && python main.py

frontend:
	cd frontend && npm run dev

run:
	@echo "Starting Netra backend and frontend..."
	@echo "Backend: http://localhost:8000"
	@echo "Frontend: http://localhost:3000"
	@echo "Run 'make backend' and 'make frontend' in separate terminals"

# ─── Daily Update ────────────────────────────────────────────────────────────
update:
	cd backend && python -c "\
from data_fetcher import fetch_all_stocks; \
from signals import generate_all_signals; \
print('Fetching data...'); fetch_all_stocks(incremental=True); \
print('Generating signals...'); sigs = generate_all_signals(); \
print(f'Done. Generated {len(sigs)} signals.')"

# Netra (नेत्र) — Project Guide

## Project Overview
Indian Market (NSE) Trading Signal System — NIFTY 50 stocks.
- **Backend**: Python/FastAPI + Multi-Model ML (XGBoost+LightGBM+RF+LSTM) + SQLite (`backend/`)
- **Frontend**: Next.js 16 + Tailwind v4 + TradingView Charts (`frontend/`)
- **AI**: GPT-5.4-mini for news sentiment scoring via OpenAI API, LSTM for sequence prediction
- **Repo**: Private GitHub — https://github.com/kaustubh812/netra

## Architecture — Backend (`backend/`)
| File | Purpose |
|------|---------|
| `config.py` | Central config (stocks, 9-component weights, thresholds, paths, OpenAI key, RSS feeds, stock name map) |
| `db.py` | SQLite layer — 7 tables: stock_data, indicators, signals, backtest_results, news_sentiment, fundamentals, macro_data |
| `data_fetcher.py` | Yahoo Finance data puller (5y history, incremental updates) |
| `indicators.py` | 50+ technical indicators (RSI, MACD, Bollinger, Supertrend, Ichimoku, Fibonacci, multi-timeframe, candlestick patterns, volatility) |
| `model.py` | Multi-model ensemble (XGBoost+LightGBM+RandomForest) — per-stock training, Optuna tuning, TimeSeriesSplit CV |
| `lstm_model.py` | LSTM deep learning model — sequence-based price prediction using PyTorch |
| `signals.py` | Composite signal engine — 9-component weighted ensemble with regime-adjusted weights |
| `regime_detector.py` | Market regime detection (trending_up/trending_down/ranging/volatile) — ADX, BB width, slope analysis |
| `sector_rotation.py` | Sector momentum tracking — ranks 17 sectors, adjusts stock signals by sector strength |
| `news_sentiment.py` | RSS feed ingestion + GPT-5.4-mini sentiment scoring + stock matching |
| `fundamentals.py` | yfinance fundamentals (P/E, P/B, margins, growth, D/E) — scored 0-1 |
| `macro_signals.py` | Global macro indicators (S&P 500, Dow, NASDAQ, Crude, Gold, USD/INR, US10Y) — scored 0-1 |
| `meta_model.py` | Layer 2 XGBoost ensemble — learns optimal weights from signal-outcome history |
| `backtest.py` | Backtesting engine with Indian trading costs (brokerage, STT, GST, stamp duty) |
| `option_chain.py` | NSE option chain / India VIX fallback for PCR |
| `live_prices.py` | Real-time yfinance price feed (30s cache), `is_market_open()` |
| `scheduler.py` | APScheduler — 6 jobs (data fetch, signals, news/30min, pre-market news, weekly fundamentals, weekly retrain) |
| `main.py` | FastAPI server — 21 endpoints |
| `.env` | OpenAI API key (git-ignored) |

## Architecture — Frontend (`frontend/src/`)
| File | Purpose |
|------|---------|
| `lib/api.ts` | API client + TypeScript types (StockInfo, Signal, MarketOverview, NewsItem, MacroOverview, StockFundamentals, etc.) |
| `components/market-overview-card.tsx` | 5-card grid: NIFTY 50, Bank NIFTY, PCR, Breadth, News Sentiment |
| `components/signal-table.tsx` | Sortable stock table with live prices (30s refetch) |
| `components/top-picks.tsx` | Top 3 BUY + top 3 SELL picks |
| `components/news-sentiment-card.tsx` | Market news card + per-stock news panel with color-coded headlines |
| `components/macro-card.tsx` | Global macro dashboard (8 indicators with change%) |
| `components/fundamentals-panel.tsx` | Stock fundamentals panel (valuation, growth, health, info sections) |
| `components/chart.tsx` | TradingView Lightweight Charts v5 candlestick with signal markers |
| `components/indicator-panel.tsx` | Indicator breakdown for stock detail page |
| `components/backtest-section.tsx` | Backtest results display |
| `components/signal-badge.tsx` | BUY/SELL/HOLD pill badges |
| `components/regime-card.tsx` | Market regime detection display (Trending/Ranging/Volatile) |
| `components/sector-card.tsx` | Sector rotation momentum rankings |
| `components/navbar.tsx` | Navigation bar |
| `components/providers.tsx` | TanStack Query provider |
| `app/page.tsx` | Dashboard page (market overview + macro + top picks + signal table) |
| `app/stock/[symbol]/page.tsx` | Stock detail page (chart, indicators, fundamentals, news, backtest) |
| `app/settings/page.tsx` | Settings — refresh data, retrain, refresh news, refresh fundamentals, train meta-model |
| `app/globals.css` | Dark theme with custom CSS vars, `@theme inline` tokens |

## Signal Weights (current — 9 components, sum = 1.0)
| Component | Weight | Source |
|-----------|--------|--------|
| XGBoost Ensemble | 20% | XGBoost + LightGBM + RandomForest soft-voting ensemble |
| LSTM Deep Learning | 12% | PyTorch LSTM sequence model (20-day lookback) |
| Supertrend | 10% | Custom technical indicator |
| RSI | 8% | Overbought/oversold zones |
| MACD | 8% | Crossover signals |
| Volume | 5% | Volume vs 20-day average |
| News Sentiment | 12% | GPT-5.4-mini scored headlines |
| Fundamentals | 13% | P/E, P/B, margins, growth, D/E from yfinance |
| Macro | 12% | Global indices, crude, gold, USD/INR, US10Y |

- BUY threshold: > 0.65 | SELL threshold: < 0.35 (dynamically adjusted by regime)
- Weights are regime-adjusted: trending boosts XGBoost/LSTM/Supertrend, ranging boosts RSI/MACD, volatile boosts Volume/Macro
- Sector rotation: stocks in top-momentum sectors get ±5-15% composite adjustment
- Meta-model (Layer 2): Learns optimal weights from historical signal-outcome pairs

## API Endpoints (21 total)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/stocks` | All stocks + signals + live prices |
| GET | `/api/live-prices` | Real-time prices for all symbols |
| GET | `/api/stock/{symbol}` | Stock detail + indicators + signals + news + fundamentals |
| GET | `/api/stock/{symbol}/chart` | OHLCV candles + signal markers |
| GET | `/api/signals/latest` | Latest signals sorted by confidence |
| GET | `/api/backtest/{symbol}` | Backtest results |
| GET | `/api/market-overview` | Index data, PCR, breadth |
| GET | `/api/fundamentals/{symbol}` | Stock fundamental analysis + score |
| POST | `/api/fundamentals/refresh` | Trigger fundamentals refresh |
| GET | `/api/macro` | Global macro indicators + score |
| GET | `/api/news/market/overview` | Market-wide news sentiment |
| GET | `/api/news/{symbol}` | Per-stock news + sentiment |
| POST | `/api/news/refresh` | Trigger news fetch + AI scoring |
| POST | `/api/retrain` | Trigger model retraining |
| POST | `/api/refresh-data` | Fetch data + regenerate signals |
| GET | `/api/training-metrics` | Model training metrics |
| GET | `/api/regime` | Market regime detection (trending/ranging/volatile) |
| GET | `/api/sectors` | Sector rotation momentum rankings |
| POST | `/api/meta-model/train` | Train Layer 2 meta-model |
| GET | `/api/meta-model/metrics` | Meta-model performance metrics |

## Key Conventions & Gotchas
- **Tailwind v4**: Use `@theme inline` for custom tokens. Static class strings only — template literals like `` bg-${color}/15 `` won't work. Use pre-defined style objects instead (see `SENTIMENT_STYLES` pattern).
- **lightweight-charts v5**: `chart.addSeries(CandlestickSeries, ...)` and `createSeriesMarkers()` — NOT `addCandlestickSeries()` or `setMarkers()`.
- **OpenAI newer models**: Use `max_completion_tokens` NOT `max_tokens` for gpt-5.4-mini and similar models.
- **CSS @import order**: `@import url(fonts)` must come BEFORE `@import "tailwindcss"` in Tailwind v4.
- **FastAPI route order**: Static routes (`/api/news/market/overview`) must be registered BEFORE dynamic routes (`/api/news/{symbol}`).
- **Stock symbols**: All use `.NS` suffix (e.g., `RELIANCE.NS`). Index symbols use `^` prefix (`^NSEI`, `^NSEBANK`).
- **Timezone**: IST (`Asia/Kolkata`) throughout. Market hours: 9:15 AM - 3:30 PM Mon-Fri.
- **Windows encoding**: Use `sys.stdout.reconfigure(encoding='utf-8', errors='replace')` for Hindi chars.
- **Failed symbols cache**: `data_fetcher.py` has `_failed_symbols` set to avoid infinite retry loops for delisted stocks.
- **python-dotenv**: `config.py` loads `.env` via `load_dotenv()` for API keys.

## Completed Features
1. Full NIFTY 50 stock tracking with 5y historical data
2. Multi-model ML ensemble (XGBoost + LightGBM + RandomForest) with Optuna hyperparameter tuning
3. LSTM deep learning model (PyTorch) for sequence-based price direction prediction
4. 9-component composite signal engine with regime-adjusted weights
5. Market regime detection (trending_up/trending_down/ranging/volatile)
6. Sector rotation momentum analysis (17 sectors, signal adjustment)
7. Dynamic confidence thresholds (adjusted by regime, component agreement)
8. 50+ advanced technical indicators (Ichimoku, Fibonacci, multi-timeframe RSI/MACD, candlestick patterns, volatility features)
9. Real-time prices via yfinance (30s polling)
10. PCR/VIX sentiment via India VIX fallback
11. News sentiment scoring via GPT-5.4-mini (RSS feeds from MoneyControl, ET, LiveMint)
12. Fundamental analysis (P/E, P/B, margins, growth, D/E scoring)
13. Global macro signals (S&P 500, Dow, NASDAQ, Hang Seng, Crude, Gold, USD/INR, US 10Y)
14. Meta-model Layer 2 ensemble (learns optimal weights from historical signal outcomes)
15. Backtesting with realistic Indian trading costs
16. Dark-themed premium UI with TradingView charts
17. APScheduler for automated data refresh, signal generation, news scoring, and weekly fundamentals
18. Private GitHub repo at kaustubh812/netra

## Future Roadmap (not yet built)
- Social sentiment (Twitter/X API, Reddit r/IndianStreetBets) — needs user API credentials
- Earnings call transcript analysis (upgrade to GPT-4o for complex reasoning)
- Options flow analysis (unusual put/call activity detection)
- Portfolio tracking and P&L monitoring
- Alert system (email/Telegram notifications for signals)

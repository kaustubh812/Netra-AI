# Netra (नेत्र) — Project Guide

## Overview
Indian Market (NSE) Trading Signal System — NIFTY 50 stocks.
- **Backend**: Python/FastAPI + ML Ensemble (XGBoost+LightGBM+RF+LSTM) + SQLite (`backend/`)
- **Frontend**: Next.js 16 + Tailwind v4 + TradingView Charts (`frontend/`)
- **AI**: GPT-5.4-mini (news sentiment, AI screener, daily brief)
- **Repo**: Private — https://github.com/kaustubh812/netra

## Backend Files (`backend/`)
### Core Engine
| File | Purpose |
|------|---------|
| `config.py` | Central config: `NIFTY_50_STOCKS` (list), weights, thresholds, paths, OpenAI key |
| `db.py` | SQLite: stock_data, indicators, signals, backtest_results, news_sentiment, fundamentals, macro_data, portfolio_holdings, paper_trades |
| `data_fetcher.py` | yfinance data puller (5y history, incremental updates, intraday seeding) |
| `indicators.py` | 50+ technical indicators (RSI, MACD, Bollinger, Supertrend, Ichimoku, Fibonacci, candlestick patterns) |
| `model.py` | Multi-model ensemble (XGBoost+LightGBM+RF) — per-stock training, Optuna tuning |
| `lstm_model.py` | LSTM (PyTorch) — sequence prediction, graceful fallback if no PyTorch |
| `signals.py` | 9-component weighted ensemble with regime-adjusted weights |
| `regime_detector.py` | Market regime (trending_up/down, ranging, volatile) — ADX, BB width, slope |
| `sector_rotation.py` | 17 sectors, momentum ranking, ±5-15% signal adjustment |
| `meta_model.py` | Layer 2 XGBoost — learns optimal weights from signal-outcome history |
| `news_sentiment.py` | RSS + GPT-5.4-mini sentiment scoring |
| `fundamentals.py` | yfinance fundamentals scored 0-1 |
| `macro_signals.py` | Global macro (S&P, Dow, NASDAQ, Crude, Gold, USD/INR, US10Y) |
| `live_prices.py` | Real-time yfinance (30s cache), `is_market_open()` |
| `option_chain.py` | NSE option chain / India VIX for PCR |
| `backtest.py` | Backtesting with Indian trading costs |
| `scheduler.py` | APScheduler — data fetch, signals, news, fundamentals, retrain |

### Roadmap Features (Phase 1-2 complete)
| File | Purpose |
|------|---------|
| `global_markets.py` | 10 countries, 13 indices via yfinance batch (10-min cache) |
| `position_sizing.py` | Risk calculator + Kelly Criterion from paper trading |
| `daily_brief.py` | GPT-5.4-mini market summary from all engines (30-min cache) |
| `market_breadth.py` | A/D ratio, McClellan Oscillator, DMA %, 52W highs/lows |
| `anomaly_detector.py` | Z-score scan: volume spikes, price moves, RSI extremes, 52W breakouts |
| `ai_screener.py` | NL query → GPT filter parser → structured screen |
| `smart_alerts.py` | Multi-condition AND/OR alert builder, 14 condition types |
| `tax_optimizer.py` | Indian tax harvest: STCG 20%, LTCG 12.5%, ₹1.25L exemption |
| `stock_compare.py` | 2-4 stock head-to-head: radar scores, returns, fundamentals |
| `portfolio.py` | Portfolio tracker with live P&L |
| `paper_trading.py` | Paper trading engine |
| `alerts.py` | Basic price-cross alert engine |
| `analytics.py` | Correlation matrix, CSV exports |
| `fii_dii.py` | FII/DII institutional flow data |
| `calendar_data.py` | Economic + earnings calendar |
| `screener.py` | Traditional multi-criteria screener |
| `watchlists.py` | Watchlist CRUD |
| `intraday_signals.py` | Intraday signal generation |

### `main.py` — FastAPI Server (40+ endpoints)
Key endpoint groups: `/api/dashboard`, `/api/stocks`, `/api/stock/{symbol}`, `/api/signals`, `/api/market-overview`, `/api/macro`, `/api/regime`, `/api/sectors`, `/api/news`, `/api/fundamentals`, `/api/backtest`, `/api/portfolio`, `/api/paper-trading`, `/api/options`, `/api/fii-dii`, `/api/calendar`, `/api/screener`, `/api/alerts`, `/api/intraday`, `/api/global-markets`, `/api/breadth`, `/api/anomalies`, `/api/daily-brief`, `/api/position-size`, `/api/screener/ai`, `/api/smart-alerts`, `/api/compare`, `/api/portfolio/tax-harvest`, `/api/export`, `/api/stream` (SSE)

## Frontend Files (`frontend/src/`)
### Pages (`app/`)
| Route | File | Purpose |
|-------|------|---------|
| `/` | `page.tsx` | Dashboard: market overview, daily brief, anomaly feed, top picks, signal table |
| `/stock/[symbol]` | `stock/[symbol]/page.tsx` | Stock detail: chart, indicators, fundamentals, news, backtest |
| `/markets` | `markets/page.tsx` | GeoJSON world map + country cards + sparklines |
| `/portfolio` | `portfolio/page.tsx` | Portfolio holdings with P&L |
| `/paper-trading` | `paper-trading/page.tsx` | Paper trading interface |
| `/screener` | `screener/page.tsx` | AI NL screener with example queries |
| `/compare` | `compare/page.tsx` | 2-4 stock comparison with radar, returns, fundamentals |
| `/alerts` | `alerts/page.tsx` | Smart alert builder with AND/OR conditions |
| `/breadth` | `breadth/page.tsx` | Market breadth dashboard |
| `/tools/position-sizing` | `tools/position-sizing/page.tsx` | Risk calculator + Kelly Criterion |
| `/tools/tax-harvest` | `tools/tax-harvest/page.tsx` | Tax-loss harvesting analyzer |
| `/analytics` | `analytics/page.tsx` | Analytics dashboard |
| `/settings` | `settings/page.tsx` | System controls |

### Key Components
| File | Purpose |
|------|---------|
| `lib/api.ts` | API client + all TypeScript interfaces |
| `components/sidebar.tsx` | 10-item icon sidebar (Dashboard, Markets, Portfolio, Trading, Screener, Compare, Alerts, Tools, Analytics, Settings) |
| `components/sparkline.tsx` | Reusable SVG mini-chart |
| `components/world-map.tsx` | GeoJSON world map with equirectangular projection |
| `components/country-card.tsx` | Global markets country card |
| `components/daily-brief-card.tsx` | GPT daily brief (collapsible) |
| `components/anomaly-feed.tsx` | Dashboard unusual activity feed |
| `components/chart.tsx` | TradingView Lightweight Charts v5 |
| `components/signal-table.tsx` | Sortable stock table |
| `components/providers.tsx` | TanStack Query provider |
| `public/world-map.json` | Natural Earth 110m GeoJSON (81KB) |

## Signal Engine
- **9 components**: XGBoost(20%), LSTM(12%), Supertrend(10%), RSI(8%), MACD(8%), Volume(5%), News(12%), Fundamentals(13%), Macro(12%)
- **Thresholds**: BUY > 0.65, SELL < 0.35 (regime-adjusted)
- **Confidence**: Multi-factor formula (55% base + overshoot + agreement + alignment)
- RSI: Overbought 60, Oversold 40 (Indian market tuned)
- ATR: Stop Loss 1.5x, Target 2.0x

## Key Conventions & Gotchas
- **Config**: `NIFTY_50_STOCKS` is a **list** of `"SYMBOL.NS"` strings, NOT a dict. No `STOCKS` or `STOCK_NAMES` in config.
- **DB access**: `db.get_stock_data(symbol)` returns a `pd.DataFrame` — no `limit` parameter. Use `.tail(N)` to limit.
- **Stock names**: Use `symbol.replace(".NS", "")` — there is no `STOCK_NAMES` dict.
- **Tailwind v4**: Static class strings only — NO dynamic template literals. Use style objects.
- **lightweight-charts v5**: `chart.addSeries(CandlestickSeries, ...)` not `addCandlestickSeries()`.
- **OpenAI**: Use `max_completion_tokens` NOT `max_tokens` for gpt-5.4-mini.
- **FastAPI route order**: Static routes BEFORE dynamic (e.g., `/news/market/overview` before `/news/{symbol}`).
- **Symbols**: `.NS` suffix for stocks, `^` prefix for indices (`^NSEI`, `^NSEBANK`).
- **Timezone**: IST (`Asia/Kolkata`). Market: 9:15 AM – 3:30 PM Mon-Fri.
- **JSX unicode**: Use `&larr;` not `\u2190` in JSX text.
- **Backend caching**: All modules use `_cache` / `_cache_time` / `_CACHE_TTL` pattern.
- **CSS classes**: `glass-card`, `glass-card-glow`, `section-header`, `shimmer`, `animate-fade-in`, `premium-table`.
- **python-dotenv**: `.env` in `backend/` loaded by `config.py`.
- **numpy**: Must use `numpy<2` for lightgbm compatibility.

## Roadmap Progress (see ROADMAP.md)
- **Phase 1 (DONE)**: Position Sizing, Daily Brief, Market Breadth, Anomaly Detection
- **Phase 2 (DONE)**: AI Screener, Smart Alerts, Tax Harvesting, Stock Comparison
- **Phase 3 (TODO)**: Stress Testing, Trading Journal, IPO Tracker
- **Phase 4 (TODO)**: MF Overlap Analyzer, Strategy Replay, Sector Money Flow, Social Pulse

# Netra — Feature Roadmap

> Generated 2026-03-31. Use this file to resume implementation across sessions.
> Tell Claude: "Continue from ROADMAP.md" to pick up where we left off.

---

## Phase 1 — Quick Wins (1-2 days each)

### 1.1 Position Sizing Calculator
- **Status:** DONE
- **Priority:** High | **Complexity:** Simple
- **What:** Given account size, risk % per trade, entry price, stop loss → calculate optimal shares. Also: Kelly Criterion from paper trading win rate, risk-reward ratio viz, max portfolio allocation per stock/sector, account risk summary across open positions.
- **Why:** #1 reason retail traders blow up. No Indian platform offers this. Pure math, zero API cost.
- **Data:** User input + existing ATR stop loss/target + paper trading history for win rate
- **Backend:** `backend/position_sizing.py` — pure math computations. Endpoint: `GET /api/position-size?account=500000&risk_pct=2&entry=1500&stop_loss=1450`
- **Frontend:** `app/tools/position-sizing/page.tsx` — interactive calculator with sliders, real-time updates. Portfolio risk summary widget. Add to sidebar under "Tools".
- **Files to create:** `backend/position_sizing.py`, `frontend/src/app/tools/position-sizing/page.tsx`
- **Files to modify:** `backend/main.py` (add endpoint), `frontend/src/components/sidebar.tsx` (add Tools nav)

### 1.2 AI Market Daily Brief
- **Status:** DONE
- **Priority:** Very High | **Complexity:** Simple-Medium
- **What:** Auto-generated pre-market (8:30 AM IST) and post-market (4:00 PM IST) natural language summary. Example: "Markets opened gap-up on positive global cues. IT sector led with 2.3% gains. RELIANCE hit BUY signal. FII bought Rs 2400 Cr. 3 stocks approaching breakout levels."
- **Why:** Public.com's AI summaries drove 40% engagement increase. Indian traders spend 30+ min reading multiple sources every morning. This aggregates Netra's unique signal context into one brief.
- **Data:** All existing Netra data: signals, regime, sectors, FII/DII, news sentiment, macro. GPT-5.4-mini for generation.
- **Backend:** `backend/daily_brief.py` — collects current state from all engines, builds prompt, calls GPT-5.4-mini, caches result. Scheduled task at 8:30 AM and 4:00 PM IST. Endpoint: `GET /api/daily-brief`
- **Frontend:** Prominent card on dashboard showing latest brief. Archive page at `app/briefs/page.tsx`. Collapsible on dashboard.
- **Files to create:** `backend/daily_brief.py`, `frontend/src/components/daily-brief-card.tsx`, `frontend/src/app/briefs/page.tsx`
- **Files to modify:** `backend/main.py` (endpoint), `backend/scheduler.py` (add scheduled jobs), `frontend/src/app/page.tsx` (add brief card to dashboard)

### 1.3 Market Breadth Dashboard
- **Status:** DONE
- **Priority:** High | **Complexity:** Simple-Medium
- **What:** Dedicated page with: Advance/Decline line (cumulative), McClellan Oscillator, % of Nifty 50 above 20/50/200 DMA, new 52-week highs vs lows, sector breadth breakdown, breadth divergence detection (price new high but breadth weakening).
- **Why:** How professionals spot tops/bottoms. StockCharts charges for this. Most Indian platforms ignore it entirely. Current Netra heatmap shows individual stocks but not aggregate breadth trends over time.
- **Data:** All computable from existing Nifty 50 price data in SQLite. Moving averages already in indicators.
- **Backend:** `backend/market_breadth.py` — compute A/D ratio, McClellan (19/39 EMA of net advances), % above MAs, 52-week high/low counts. Endpoint: `GET /api/breadth`
- **Frontend:** `app/breadth/page.tsx` — multi-panel dashboard with line charts (recharts or lightweight-charts). Divergence highlighting with alerts.
- **Files to create:** `backend/market_breadth.py`, `frontend/src/app/breadth/page.tsx`, `frontend/src/components/breadth-charts.tsx`
- **Files to modify:** `backend/main.py` (endpoint), sidebar (add Breadth link or nest under Analytics)

### 1.4 Anomaly Detection Alerts
- **Status:** DONE
- **Priority:** High | **Complexity:** Simple-Medium
- **What:** Daily scan detecting: volume spikes (3x+ 20-day average), unusual price moves without news, correlation breaks between normally correlated stocks, sudden RSI extremes. Surfaces as "Unusual Activity" feed.
- **Why:** Unusual Whales built an entire business around this for US markets. Indian markets have zero equivalent retail tool. Detects institutional accumulation/distribution before it's obvious.
- **Data:** Existing volume, price, RSI, correlation data. Statistical z-score / IQR calculations.
- **Backend:** `backend/anomaly_detector.py` — compute z-scores for volume, price change, RSI deviation. Flag anything beyond 2.5 std devs. Store anomalies in SQLite. Endpoint: `GET /api/anomalies`
- **Frontend:** "Unusual Activity" card on dashboard + dedicated feed page. Each anomaly shows: stock, type (volume_spike/price_move/correlation_break), severity (1-5), timestamp, explanation.
- **Files to create:** `backend/anomaly_detector.py`, `frontend/src/components/anomaly-feed.tsx`
- **Files to modify:** `backend/main.py`, `backend/db.py` (anomalies table), `frontend/src/app/page.tsx` (dashboard card), `backend/scheduler.py` (daily scan job)

---

## Phase 2 — Short-term (3-5 days each)

### 2.1 Natural Language AI Stock Screener
- **Status:** DONE
- **Priority:** Very High | **Complexity:** Medium
- **What:** Search bar where users type: "oversold large caps with good fundamentals and BUY signal" or "IT stocks with RSI below 35 and positive news sentiment". GPT-5.4-mini parses intent → structured filters → existing screener logic → results.
- **Why:** Intellectia AI reports this as most-used feature. 70% of retail traders find traditional screener dropdowns too complex.
- **Data:** GPT-5.4-mini for NLP parsing. All filter data already in Netra (RSI, PE, signal, sector, composite score, news sentiment, etc.)
- **Backend:** `backend/ai_screener.py` — accepts text query, sends to GPT with system prompt describing available filters, receives structured JSON params, runs filter logic against stock data, returns results. Endpoint: `POST /api/screener/ai`
- **Frontend:** `app/screener/page.tsx` — prominent search bar at top, filter chips showing parsed conditions, results table with existing signal-table component. Recent queries sidebar.
- **Files to create:** `backend/ai_screener.py`, `frontend/src/app/screener/page.tsx`, `frontend/src/components/screener-bar.tsx`
- **Files to modify:** `backend/main.py`, sidebar (add Screener link)

### 2.2 Multi-Condition Smart Alert Builder
- **Status:** DONE
- **Priority:** High | **Complexity:** Medium
- **What:** Visual builder to combine: "RELIANCE RSI < 30 AND volume > 2x avg AND news sentiment > 0.6 AND regime = trending_up". Supports AND/OR groups, up to 5 conditions. Alerts via dashboard notification + optional Telegram.
- **Why:** TradingView's multi-condition alerts are their most-engaged premium feature. Indian traders on r/IndianStreetBets constantly request "smart alerts that actually matter."
- **Data:** All existing: signals, indicators, news sentiment, regime, volume.
- **Backend:** `backend/smart_alerts.py` — JSON condition tree evaluator. SQLite table for saved alerts. Scheduler checks conditions every signal refresh cycle. Endpoint: `POST /api/alerts/create`, `GET /api/alerts`, `GET /api/alerts/triggered`
- **Frontend:** `app/alerts/page.tsx` — drag-and-drop or form-based condition builder. Preview showing current values. Alert history feed.
- **Files to create:** `backend/smart_alerts.py`, `frontend/src/app/alerts/page.tsx`, `frontend/src/components/alert-builder.tsx`
- **Files to modify:** `backend/main.py`, `backend/db.py` (alerts tables), `backend/scheduler.py`, sidebar

### 2.3 Tax Harvesting Optimizer (India-Specific)
- **Status:** DONE
- **Priority:** Very High (seasonal — peaks March) | **Complexity:** Medium
- **What:** Analyze portfolio holdings: (a) unrealized losses to book for tax offset (STCL offsets STCG+LTCG; LTCL offsets only LTCG), (b) positions approaching Rs 1.25 lakh LTCG exemption, (c) holding period tracking (ST < 12 months vs LT). Shows net tax savings estimate.
- **Why:** 20% STCG + 12.5% LTCG from FY 2024-25. "Tax loss harvesting India" spikes every March. No Indian platform offers integrated suggestions.
- **Data:** User portfolio data already in Netra. Current prices from yfinance. Tax rules are static logic.
- **Backend:** `backend/tax_optimizer.py` — for each holding: compute buy date, holding period, unrealized P&L, classify STCG/LTCG, calculate optimal harvesting. Endpoint: `GET /api/portfolio/tax-harvest`
- **Frontend:** Tax dashboard tab in portfolio page or standalone `app/tools/tax-harvest/page.tsx`. Harvestable losses table, estimated savings calculator, "book this loss" suggestions.
- **Files to create:** `backend/tax_optimizer.py`, `frontend/src/app/tools/tax-harvest/page.tsx`
- **Files to modify:** `backend/main.py`

### 2.4 Stock Comparison Tool (Side-by-Side)
- **Status:** DONE
- **Priority:** High | **Complexity:** Simple-Medium
- **What:** Compare 2-4 stocks head-to-head: normalized price performance, fundamentals (PE, ROE, margins), technicals (RSI, MACD), signal scores, sector position, news sentiment. Radar chart for visual comparison.
- **Why:** "HDFC Bank vs ICICI Bank" is the most common retail investor question. Screener.in's comparison page is one of their highest-traffic features.
- **Data:** All existing: prices, fundamentals, signals, indicators, news sentiment.
- **Backend:** `backend/stock_compare.py` — comparison endpoint returning normalized data for N stocks. Endpoint: `GET /api/compare?symbols=HDFCBANK.NS,ICICIBANK.NS`
- **Frontend:** `app/compare/page.tsx` — stock selector, radar chart (recharts), normalized price overlay, fundamentals comparison table, signal comparison row.
- **Files to create:** `backend/stock_compare.py`, `frontend/src/app/compare/page.tsx`, `frontend/src/components/radar-chart.tsx`
- **Files to modify:** `backend/main.py`, sidebar

---

## Phase 3 — Medium-term (1-2 weeks each)

### 3.1 Portfolio Stress Testing / What-If Simulator
- **Status:** Not Started
- **Priority:** Very High | **Complexity:** Medium
- **What:** Simulate scenarios on portfolio: "Nifty drops 15%", "Crude spikes 30%", "IT sector crashes like March 2020". Shows projected P&L per holding, total portfolio impact, most vulnerable positions. Preset scenarios + custom sliders.
- **Data:** Historical data (5y OHLCV), beta values (yfinance), correlation matrix. Historical crash templates (COVID March 2020, 2022 rate hike, 2018 NBFC crisis).
- **Backend:** `backend/stress_test.py` — stock betas vs Nifty, correlation-based scenario modeling. Endpoint: `POST /api/portfolio/stress-test`
- **Frontend:** `app/tools/stress-test/page.tsx` — scenario presets, custom sliders, waterfall chart showing per-stock impact, total P&L impact.

### 3.2 Interactive Trading Journal with Analytics
- **Status:** Not Started
- **Priority:** Very High | **Complexity:** Medium-Complex
- **What:** Auto-log all paper trades. Analytics: win rate by day/time/sector/signal-type, average R-multiple, streak analysis, emotional tagging, drawdown curves, best/worst setups. Manual annotation support.
- **Why:** TradeZella charges $30-50/month with 100K+ paying users. Zerodha has no built-in journaling.
- **Data:** Existing paper trading data + new journal tables.
- **Backend:** `backend/trade_journal.py` — extends paper trading with analytics: win rate by category, P&L distribution, time analysis, signal accuracy tracking. Endpoint: `GET /api/journal/analytics`
- **Frontend:** `app/journal/page.tsx` — journal dashboard with filters, trade cards with notes, equity curve, drawdown chart, win rate breakdowns.

### 3.3 IPO Tracker with Grey Market Premium
- **Status:** Not Started
- **Priority:** Very High (India) | **Complexity:** Medium
- **What:** Track upcoming/open/recently listed IPOs. Issue price, GMP, subscription status (retail/HNI/QIB), listing prediction, IPO calendar, historical listing performance patterns.
- **Data:** NSE/BSE websites (public), GMP from ipowatch.in/chittorgarh.com (public), subscription data from BSE during IPO period.
- **Backend:** `backend/ipo_tracker.py` — scraper for IPO data, GMP aggregator. SQLite storage. Endpoint: `GET /api/ipos`
- **Frontend:** `app/ipos/page.tsx` — calendar view, IPO cards, GMP trend chart, subscription meter.

---

## Phase 4 — Longer-term (2+ weeks each)

### 4.1 Mutual Fund Overlap Analyzer
- **Status:** Not Started
- **Complexity:** Medium-Complex
- **What:** Enter MF holdings → show overlapping stocks, effective exposure, concentration risk, diversification score. Uses AMFI public monthly portfolio disclosures.

### 4.2 Strategy Visual Replay / Backtester
- **Status:** Not Started
- **Complexity:** Complex
- **What:** Step through historical candles one-by-one, see signals appear in real-time, running P&L counter. Like TradingView Bar Replay but with Netra's signal engine.

### 4.3 Sector Money Flow Visualization
- **Status:** Not Started
- **Complexity:** Medium-Complex
- **What:** Animated flow diagram: sectors as nodes sized by market cap, arrows showing inflow/outflow direction and magnitude. D3.js or React Flow.

### 4.4 Watchlist Social Pulse
- **Status:** Not Started
- **Complexity:** Medium
- **What:** Aggregate sentiment from Google Trends (`pytrends`), Reddit public API, existing news sentiment. Composite "Social Pulse" score per stock.

---

## Implementation Notes

### Sidebar Navigation Plan
Current sidebar items: Dashboard, Markets, Portfolio, Trading, Analytics, Settings
Proposed additions:
- **Screener** (Phase 2.1) — new top-level nav item
- **Tools** dropdown/section containing: Position Sizing, Tax Harvest, Stress Test, Compare
- **Alerts** (Phase 2.2) — new top-level or under Analytics
- **Journal** (Phase 3.2) — new top-level or under Trading
- **IPOs** (Phase 3.3) — new top-level or under Markets
- **Breadth** (Phase 1.3) — under Analytics or Markets

### Shared Patterns
- All backend modules follow `macro_signals.py` pattern: 10-min cache, yfinance batch download where applicable
- All frontend pages use `glass-card` + `section-header` + `animate-fade-in` design system
- All API calls go through `frontend/src/lib/api.ts` with proper TypeScript interfaces
- React Query with appropriate refetch intervals (5 min for market data, 30 min for analytics)
- GPT-5.4-mini calls use `max_completion_tokens` (NOT `max_tokens`)

### Database Tables Needed
- `anomalies` — for anomaly detection (Phase 1.4)
- `smart_alerts` — for alert builder (Phase 2.2)
- `smart_alerts_triggered` — alert trigger history
- `daily_briefs` — archived AI briefs (Phase 1.2)
- `journal_annotations` — trade journal notes (Phase 3.2)
- `ipo_data` — IPO tracker (Phase 3.3)

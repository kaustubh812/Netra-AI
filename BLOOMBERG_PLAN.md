# Netra Bloomberg Terminal Transformation Plan

## Vision
Transform Netra from a signal dashboard into a **Bloomberg Terminal-grade** Indian market intelligence platform. The goal is maximum information density, keyboard-driven navigation, real-time data streaming, and professional-grade analytics — all focused on NSE/NIFTY 50.

---

## Phase 1: "Terminal Feel" (UI/UX Foundation)
**Goal:** Make Netra *feel* like a terminal — command-driven, dense, keyboard-first.

### 1.1 Command Palette (Bloomberg's `<GO>` Bar)
*The single most impactful Bloomberg feature.*

- **Trigger:** `Ctrl+K` or `/` anywhere in the app
- **Capabilities:**
  - Type stock name/symbol → instant navigation to stock detail
  - Type function name → navigate to module (e.g., "screener", "alerts", "macro", "heatmap")
  - Fuzzy search across all 56 stocks + all pages
  - Recent searches + frequently accessed stocks
  - Keyboard-only navigation (arrow keys + Enter)
- **Files:** New `components/command-palette.tsx`, modify `app/layout.tsx` for global listener
- **No new packages** — build with native React (dialog element + input + filtered list)

### 1.2 Keyboard Shortcuts System
*Bloomberg users never touch the mouse.*

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` / `/` | Open command palette |
| `1-9` | Switch workspace tabs (when added) |
| `D` | Switch to Daily signals |
| `I` | Switch to Intraday signals |
| `Esc` | Close any overlay/modal |
| `S` | Focus stock search |
| `?` | Show shortcut cheatsheet |
| `H` | Go to dashboard (home) |
| `T` | Go to settings |

- **Files:** New `hooks/use-keyboard-shortcuts.ts`, New `components/shortcut-help.tsx`

### 1.3 Information Density Mode
*Bloomberg packs 10x more data per screen than typical web apps.*

- Add **"Terminal Mode"** toggle (stored in localStorage)
- Terminal Mode reduces:
  - Card padding from `p-5` to `p-3`
  - Font sizes by 1 step
  - Section divider heights
  - Removes `backdrop-blur` for performance
  - Tighter table row heights (`py-1.5` vs `py-3`)
- Adds:
  - More columns visible per table
  - Compact number formatting (1.2K, 4.5M, 2.1Cr)
  - Monospace font for ALL data (not just prices)
- **Files:** New `contexts/display-mode.tsx`, modify `globals.css` (add `.terminal-mode` overrides)

### 1.4 Multi-Panel Workspace (Bloomberg Launchpad)
*Bloomberg's 4-panel layout is iconic.*

- **Tab system** at top of page with saveable workspace configurations:
  - "Overview" — current dashboard layout
  - "Trading" — intraday signals + live chart + market overview
  - "Analysis" — screener + fundamentals + relative valuation
  - "Custom" — user-configured panels
- **Split-panel layout** using CSS Grid with resizable gutters
- **Panel types:** Chart, Signal Table, Watchlist, News Feed, Indicators, Heatmap
- **Security linking:** Clicking a stock in any panel updates all linked panels
- **Files:** New `components/workspace.tsx`, `components/panel-container.tsx`, `hooks/use-workspace.ts`

---

## Phase 2: "Intelligence Layer" (New Data Modules)
**Goal:** Add Bloomberg-grade analytics that don't exist in Netra yet.

### 2.1 Advanced Stock Screener (Bloomberg EQS)
*Multi-criteria filtering across all Netra data.*

**Filter categories:**
- **Signal:** BUY/SELL/HOLD, composite score range, signal strength range
- **Technical:** RSI range, MACD state, Supertrend direction, above/below SMA
- **Fundamentals:** P/E range, P/B range, ROE minimum, D/E maximum, market cap range
- **Sector:** Filter by sector, sector momentum rank
- **Intraday:** Intraday signal, regime, ORB breakout status

**Features:**
- Real-time results as filters change
- Save/load filter presets
- Export results to CSV
- Sort by any column
- Show match count ("14 of 56 stocks match")

**Backend:** New `GET /api/screener` endpoint with query params
**Frontend:** New `app/screener/page.tsx`, `components/screener-filters.tsx`, `components/screener-results.tsx`

### 2.2 Interactive Heat Map (Bloomberg IMAP)
*Treemap of NIFTY 50 stocks — instant visual market read.*

- **Treemap visualization** (rectangles sized by market cap)
- **Color modes** (toggle between):
  - Daily change % (green/red gradient)
  - Netra signal (green=BUY, red=SELL, gray=HOLD)
  - Composite score (gradient from red→yellow→green)
  - Signal strength (intensity gradient)
  - Sector grouping with sector labels
- **Interaction:**
  - Hover: tooltip with stock name, price, change%, signal
  - Click: navigate to stock detail page
  - Zoom into sector
- **Package:** Use `d3-hierarchy` + `d3-treemap` (lightweight, no full D3 needed) OR build pure CSS grid-based treemap
- **Files:** New `app/heatmap/page.tsx`, `components/heatmap.tsx`

### 2.3 Economic Calendar (Bloomberg ECO)
*Indian-specific economic event calendar.*

**Data sources (scrape/API):**
- RBI monetary policy dates & rate decisions
- CPI/WPI inflation releases
- IIP (Index of Industrial Production)
- PMI Manufacturing & Services (Nikkei/S&P Global)
- GDP quarterly releases
- FII/DII daily flow data (NSDL/CDSL) — *extremely important for Indian markets*
- Trade balance, forex reserves

**Display:**
- Calendar view (weekly/monthly)
- List view with filters (by importance: high/medium/low)
- Previous value | Forecast | Actual columns
- Surprise indicator (actual vs forecast deviation)
- Color-coded importance badges
- Countdown timer for upcoming releases

**Backend:** New `economic_calendar.py`, scrape from investing.com/tradingeconomics API
**Frontend:** New `app/calendar/page.tsx`, `components/economic-calendar.tsx`

### 2.4 Earnings Calendar (Bloomberg ERN/EVTS)
*NIFTY 50 earnings dates with estimates.*

- Upcoming earnings dates for all tracked stocks
- EPS estimate vs previous quarter
- Revenue estimates
- Historical EPS surprise percentage
- Post-earnings signal performance analysis
- "Earnings This Week" widget for dashboard

**Backend:** Scrape from moneycontrol.com or use yfinance `.calendar` property
**Frontend:** New `app/earnings/page.tsx`, `components/earnings-calendar.tsx`

### 2.5 Relative Valuation (Bloomberg RV)
*Peer comparison tables — side-by-side fundamental analysis.*

- Group stocks by sector/industry
- Customizable metric columns (P/E, P/B, EV/EBITDA, ROE, margins, growth)
- Sector median/average comparison
- Percentile ranking within sector
- Scatter plot: plot any 2 metrics against each other
- Highlight over/undervalued stocks vs sector median

**Backend:** New `GET /api/peer-comparison/{symbol}` endpoint
**Frontend:** New `components/relative-valuation.tsx`

### 2.6 FII/DII Flow Dashboard
*Uniquely important for Indian markets — Bloomberg itself tracks this.*

- Daily FII/DII buy/sell data (cash + F&O)
- Net flow trend (30-day rolling chart)
- Cumulative monthly flow
- Correlation with NIFTY movement
- Alert when FII flow direction reverses

**Backend:** New `fii_dii.py` — scrape from NSDL/moneycontrol
**Frontend:** New `components/fii-dii-card.tsx`

---

## Phase 3: "Real-Time & Alerts" (Live Data)
**Goal:** Move from polling to streaming. Add proactive alerts.

### 3.1 WebSocket/SSE Live Data Stream
*Bloomberg streams everything in real-time. No manual refresh.*

- **Server-Sent Events (SSE)** — simpler than WebSocket for one-way data
- Stream: live prices, signal changes, news headlines
- Replace `refetchInterval` polling with SSE subscriptions
- Graceful fallback to polling if SSE connection drops

**Backend:** New SSE endpoint `GET /api/stream` using FastAPI `StreamingResponse`
**Frontend:** New `hooks/use-live-stream.ts` with EventSource API

### 3.2 Alert Engine (Bloomberg Custom Alerts)
*Proactive notifications — don't make users check manually.*

**Alert types:**
| Alert | Trigger |
|-------|---------|
| Signal Change | Stock flips from HOLD→BUY or HOLD→SELL |
| Price Cross | Price crosses user-defined level |
| Strength Spike | Signal strength crosses 75% |
| Volume Surge | Volume > 3x 20-day average |
| RSI Extreme | RSI enters overbought (>70) or oversold (<30) |
| Regime Change | Market regime shifts (e.g., ranging→volatile) |
| Intraday ORB Breakout | Price breaks above/below opening range |
| Earnings Approaching | Stock has earnings in next 3 days |

**Delivery channels:**
1. **Browser push notifications** (via Notification API)
2. **In-app notification center** (bell icon in navbar with badge count)
3. **Telegram bot** (optional — send alerts to user's Telegram)
4. **Sound alerts** (subtle audio ping for critical alerts)

**Backend:** New `alerts.py`, new DB table `alerts` + `user_alerts`
**Frontend:** New `components/notification-center.tsx`, `components/alert-config.tsx`, `app/alerts/page.tsx`

### 3.3 Live News Ticker
*Bloomberg's scrolling news bar is iconic.*

- Horizontal scrolling news ticker at bottom of screen (or top, below navbar)
- Shows latest GPT-scored headlines with sentiment color coding
- Click headline → expand to full article + sentiment reasoning
- Filter by: all stocks, watchlist only, high-impact only

**Frontend:** New `components/news-ticker.tsx`

---

## Phase 4: "Portfolio & Risk" (Professional Tools)
**Goal:** Let users track positions and analyze risk.

### 4.1 Portfolio Tracker (Bloomberg PORT)
*Track holdings, P&L, and performance.*

- **Manual position entry:** Stock, quantity, average buy price, date
- **Real-time P&L** with live prices
- **Dashboard metrics:**
  - Total portfolio value
  - Day P&L (absolute + %)
  - Total P&L (absolute + %)
  - Best/worst performer today
- **Sector exposure:** Pie chart of portfolio by sector
- **Signal alignment:** "72% of your holdings align with current BUY signals"
- **Suggested actions:** "Consider exiting TATASTEEL (current signal: SELL, strength: 71%)"
- **Performance tracking:** Daily/weekly/monthly returns chart

**Backend:** New DB tables `portfolio_holdings`, `portfolio_transactions`
**Backend:** New `portfolio.py`, endpoints for CRUD + analytics
**Frontend:** New `app/portfolio/page.tsx`, `components/portfolio-dashboard.tsx`, `components/add-position-modal.tsx`

### 4.2 Historical Signal Performance (Bloomberg Backtesting)
*"How good is Netra's signal for this stock?"*

- Per-stock signal accuracy metrics:
  - Win rate (% of BUY signals that were profitable after N days)
  - Average return when signal was BUY vs SELL
  - Average holding period
  - Signal-to-noise ratio
- Rolling accuracy over time (is the model improving?)
- Comparison: Netra signal vs Buy & Hold

**Backend:** New `GET /api/signal-performance/{symbol}` endpoint
**Frontend:** New `components/signal-performance.tsx`

### 4.3 Watchlist System
*Bloomberg's custom security lists.*

- Create multiple named watchlists (e.g., "Bank Stocks", "Momentum Plays")
- Add/remove stocks to watchlists
- Watchlist as a panel in workspace
- Signal summary for each watchlist
- Default watchlist: NIFTY 50 (non-deletable)

**Backend:** New DB table `watchlists`, `watchlist_items`
**Frontend:** New `components/watchlist.tsx`, `components/watchlist-manager.tsx`

---

## Phase 5: "Advanced Analytics" (Power User Features)
**Goal:** Deep analysis tools for serious traders.

### 5.1 Multi-Chart Comparison
*Overlay multiple stocks on one chart.*

- Select 2-5 stocks to compare
- Normalize to percentage change from common start date
- Toggle individual stocks on/off
- Compare stock vs sector index
- Compare stock vs NIFTY 50

### 5.2 Options Flow Dashboard
*Extend existing PCR/VIX with deeper options analytics.*

- Real-time option chain for NIFTY 50 stocks (from NSE)
- Open Interest buildup analysis (OI change heatmap by strike)
- Max Pain calculation
- Put-Call ratio trends (5-day rolling)
- Unusual options activity detector
- Options strategy payoff diagrams

### 5.3 Correlation Matrix
*Which stocks move together?*

- 56×56 correlation heatmap (30/60/90 day lookback)
- Identify diversification opportunities
- Sector correlation analysis
- Correlation breakdown: "RELIANCE and ONGC: 0.72 correlation"

### 5.4 Volatility Dashboard
- Historical volatility vs implied volatility
- VIX trend chart with regime overlay
- Volatility percentile ranking (current VIX vs last 1 year)
- Volatility-adjusted position sizing calculator

### 5.5 Data Export & API
- Export any table/screen to CSV
- Export chart data to CSV
- Simple REST API documentation page for power users
- Webhook support for external integrations

---

## Phase 6: "Navigation & Structure" (App Architecture)
**Goal:** Support all new modules with proper navigation.

### 6.1 Updated Navigation Structure

```
Navbar: [NETRA Logo] [Command Bar: Ctrl+K] [Notifications Bell] [Settings Gear]

Sidebar (collapsible):
├── Dashboard (Home)
├── Heatmap
├── Screener
├── Calendar
│   ├── Economic
│   └── Earnings
├── Portfolio
├── Alerts
├── Watchlists
└── Settings

Stock Detail Page (expanded):
├── Intraday Signal Card
├── Daily Signal Card
├── Chart (with comparison mode)
├── Indicator Panel
├── Relative Valuation (Peers)
├── Signal Performance History
├── Fundamentals
├── News & Sentiment
└── Backtest Results
```

### 6.2 New Pages

| Route | Page | Phase |
|-------|------|-------|
| `/` | Dashboard (existing, enhanced) | 1 |
| `/heatmap` | Interactive Treemap | 2 |
| `/screener` | Stock Screener | 2 |
| `/calendar` | Economic + Earnings Calendar | 2 |
| `/portfolio` | Portfolio Tracker | 4 |
| `/alerts` | Alert Configuration + History | 3 |
| `/stock/[symbol]` | Stock Detail (existing, enhanced) | 1 |
| `/settings` | Settings (existing, enhanced) | 1 |

---

## Implementation Priority (Recommended Order)

### Sprint 1: Terminal Foundation (Phase 1)
1. Command Palette (`Ctrl+K`)
2. Keyboard shortcuts system
3. Navigation restructure (sidebar + more routes)
4. Information density mode toggle

### Sprint 2: Intelligence Modules (Phase 2)
5. Interactive Heatmap
6. Stock Screener
7. FII/DII Flow Dashboard
8. Relative Valuation

### Sprint 3: Real-Time & Alerts (Phase 3)
9. Alert Engine + Notification Center
10. SSE live data stream
11. Live News Ticker

### Sprint 4: Portfolio & Calendar (Phase 2 + 4)
12. Economic Calendar
13. Earnings Calendar
14. Portfolio Tracker
15. Watchlist System

### Sprint 5: Advanced Analytics (Phase 5)
16. Multi-Chart Comparison
17. Historical Signal Performance
18. Correlation Matrix
19. Options Flow Dashboard
20. Data Export

---

## Technical Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Treemap rendering | CSS Grid + D3-hierarchy calculation | No heavy D3 bundle, lightweight-charts already handles charting |
| Real-time transport | SSE (not WebSocket) | Simpler, one-way data flow is sufficient, auto-reconnect |
| State management | React Context + TanStack Query | Already in use, no need for Redux/Zustand |
| Component library | Stay custom (no shadcn) | Maintains unique terminal aesthetic, full control |
| Layout system | CSS Grid with `resize` observer | Native, no library needed |
| Data persistence | SQLite (existing) | Sufficient for single-user app, WAL mode handles concurrency |
| Alerts delivery | Browser Notification API + optional Telegram | Free, no infrastructure needed |
| Calendar data | Scrape investing.com / tradingeconomics | Free tier available |
| FII/DII data | Scrape moneycontrol.com / NSDL | Publicly available data |

---

## File Count Estimate

| Phase | New Backend Files | New Frontend Files | Modified Files |
|-------|------------------|--------------------|----------------|
| Phase 1 | 0 | 6 | 4 |
| Phase 2 | 4 | 10 | 3 |
| Phase 3 | 2 | 5 | 3 |
| Phase 4 | 2 | 6 | 2 |
| Phase 5 | 1 | 5 | 2 |
| Phase 6 | 0 | 2 | 3 |
| **Total** | **9** | **34** | **17** |

---

## What Netra Will NOT Replicate from Bloomberg

| Bloomberg Feature | Why Not |
|-------------------|---------|
| 350K user messaging network (IB) | Network effect requires massive user base |
| 35M instruments across 330 exchanges | Focus on NIFTY 50 depth, not breadth |
| Level 2 order book data | Requires exchange subscription (costly) |
| Direct order execution (EMSX) | Requires broker API integration (Zerodha Kite API possible future) |
| Proprietary journalist network | Use RSS + GPT sentiment (already have) |
| Fixed income / derivatives pricing | Not relevant for equity-focused retail trader |
| $25K/year pricing | Free/self-hosted |

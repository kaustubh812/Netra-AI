const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

async function postApi<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  const opts: RequestInit = { method: "POST", cache: "no-store" };
  if (body) {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${API_BASE}${path}`, opts);
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

async function deleteApi<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { method: "DELETE", cache: "no-store" });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

// Types
export interface StockInfo {
  symbol: string;
  name: string;
  ltp?: number;
  change?: number;
  change_pct?: number;
  last_date?: string;
  day_high?: number;
  day_low?: number;
  volume?: number;
  prev_close?: number;
  live?: boolean;
  signal?: string;
  confidence?: number;
  entry_price?: number;
  stop_loss?: number;
  target_price?: number;
  composite_score?: number;
}

export interface Signal {
  symbol: string;
  name: string;
  date: string;
  signal: string;
  confidence: number;
  model_probability: number;
  entry_price: number;
  stop_loss: number;
  target_price: number;
  composite_score: number;
}

export interface Candle {
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartMarker {
  time: string | number;
  position: string;
  color: string;
  shape: string;
  text: string;
}

export interface ChartData {
  symbol: string;
  candles: Candle[];
  markers: ChartMarker[];
  vwap?: { time: number; value: number }[];
}

export interface BacktestResult {
  symbol: string;
  total_return: number;
  buy_hold_return: number;
  sharpe_ratio: number;
  max_drawdown: number;
  win_rate: number;
  total_trades: number;
  avg_profit: number;
  avg_loss: number;
  equity_curve?: string;
}

export interface MarketOverview {
  timestamp: string;
  market_open?: boolean;
  nifty50?: { value: number; change?: number; change_pct?: number; date?: string; live?: boolean };
  banknifty?: { value: number; change?: number; change_pct?: number; date?: string; live?: boolean };
  sentiment?: { pcr?: number | null; pcr_interpretation?: string; max_pain?: number | null; available: boolean; source?: string; vix?: number; vix_change?: number; vix_interpretation?: string };
  breadth?: { bullish: number; bearish: number; neutral: number; total: number };
}

export interface LivePrices {
  prices: Record<string, { price: number; change: number; change_pct: number; high: number; low: number; volume: number; timestamp: string }>;
  market_open: boolean;
  count: number;
  timestamp: string;
}

export interface StockDetail {
  symbol: string;
  name: string;
  price_data: Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }>;
  current_signal?: {
    signal: string;
    confidence: number;
    model_probability: number;
    entry_price: number;
    stop_loss: number;
    target_price: number;
    composite_score: number;
    date: string;
  };
  indicators?: Record<string, number | null>;
  signal_history: Array<{
    date: string;
    signal: string;
    confidence: number;
    entry_price: number;
    stop_loss: number;
    target_price: number;
  }>;
}

export interface NewsItem {
  headline: string;
  source: string;
  url: string;
  sentiment_score: number;
  reasoning: string;
  fetched_at: string;
}

export interface StockNews {
  symbol: string;
  name: string;
  news: NewsItem[];
  count: number;
  aggregate_sentiment: number | null;
  sentiment_label: string;
}

export interface StockFundamentals {
  symbol: string;
  name: string;
  fundamentals: Record<string, number | string | null> | null;
  score: number;
  label: string;
}

export interface MacroIndicator {
  name: string;
  symbol: string;
  price: number;
  change: number;
  change_pct: number;
  weekly_change_pct: number;
  high: number;
  low: number;
}

export interface MacroOverview {
  indicators: Record<string, MacroIndicator>;
  score: number;
  label: string;
  count: number;
}

export interface RegimeInfo {
  regime: string;
  confidence: number;
  metrics: Record<string, number>;
}

export interface SectorScore {
  avg_return: number;
  stocks_up: number;
  stocks_down: number;
  total_stocks: number;
  breadth: number;
  rank: number;
  momentum_score: number;
}

export interface SectorsOverview {
  sectors: Record<string, SectorScore>;
  count: number;
}

export interface MarketNews {
  news: (NewsItem & { symbol: string })[];
  count: number;
  aggregate_sentiment: number | null;
  sentiment_label: string;
}

export interface IntradaySignal {
  symbol: string;
  name: string;
  datetime: string;
  signal: string;
  confidence: number;
  composite_score: number;
  entry_price: number;
  stop_loss: number;
  target_price: number;
  components: Record<string, number>;
  regime: string;
  orb_high?: number;
  orb_low?: number;
  gap_pct?: number;
  vwap?: number;
}

// API functions
export const api = {
  getStocks: () => fetchApi<{ stocks: StockInfo[]; count: number; market_open?: boolean }>("/api/stocks"),
  getLivePrices: () => fetchApi<LivePrices>("/api/live-prices"),
  getStock: (symbol: string) => fetchApi<StockDetail>(`/api/stock/${symbol}`),
  getChart: (symbol: string, period = "1Y", interval?: string) => {
    let url = `/api/stock/${symbol}/chart?period=${period}`;
    if (interval) url += `&interval=${interval}`;
    return fetchApi<ChartData>(url);
  },
  getLatestSignals: () => fetchApi<{ signals: Signal[]; count: number }>("/api/signals/latest"),
  getBacktest: (symbol: string) => fetchApi<BacktestResult>(`/api/backtest/${symbol}`),
  getMarketOverview: () => fetchApi<MarketOverview>("/api/market-overview"),
  getTrainingMetrics: () => fetchApi<{ metrics: Record<string, unknown>; count: number }>("/api/training-metrics"),
  getStockFundamentals: (symbol: string) => fetchApi<StockFundamentals>(`/api/fundamentals/${symbol}`),
  getMacro: () => fetchApi<MacroOverview>("/api/macro"),
  refreshFundamentals: () => postApi<{ status: string }>("/api/fundamentals/refresh"),
  getStockNews: (symbol: string) => fetchApi<StockNews>(`/api/news/${symbol}`),
  getMarketNews: () => fetchApi<MarketNews>("/api/news/market/overview"),
  refreshNews: () => postApi<{ status: string }>("/api/news/refresh"),
  retrain: () => postApi<{ status: string }>("/api/retrain"),
  trainMetaModel: () => postApi<{ status: string }>("/api/meta-model/train"),
  getMetaModelMetrics: () => fetchApi<{ metrics: Record<string, unknown> | null; available: boolean }>("/api/meta-model/metrics"),
  refreshData: () => postApi<{ status: string }>("/api/refresh-data"),
  getRegime: () => fetchApi<RegimeInfo>("/api/regime"),
  getSectors: () => fetchApi<SectorsOverview>("/api/sectors"),
  // Intraday
  getIntradaySignals: () => fetchApi<{ signals: IntradaySignal[]; count: number }>("/api/intraday/signals/latest"),
  getIntradaySignal: (symbol: string) => fetchApi<IntradaySignal>(`/api/intraday/signal/${symbol}`),
  seedIntraday: () => postApi<{ status: string }>("/api/intraday/seed"),
  generateIntraday: () => postApi<{ status: string }>("/api/intraday/generate"),
  // Phase 2: Intelligence Layer
  getFiiDii: () => fetchApi<{ flows: FiiDiiFlow[]; summary: FiiDiiSummary; count: number }>("/api/fii-dii"),
  getPeerComparison: (symbol: string) => fetchApi<PeerComparison>(`/api/peer-comparison/${symbol}`),
  getEconomicCalendar: () => fetchApi<{ events: EconomicEvent[]; count: number }>("/api/calendar/economic"),
  getEarningsCalendar: () => fetchApi<{ earnings: EarningsEvent[]; count: number }>("/api/calendar/earnings"),
  // Portfolio
  getPortfolio: () => fetchApi<{ holdings: PortfolioHolding[]; count: number }>("/api/portfolio"),
  getPortfolioSummary: () => fetchApi<{ summary: PortfolioSummary; sector_exposure: SectorExposure[] }>("/api/portfolio/summary"),
  addPortfolioHolding: (symbol: string, quantity: number, purchase_price: number, purchase_date?: string, notes?: string) =>
    postApi<{ status: string; id: number }>(`/api/portfolio/add?symbol=${encodeURIComponent(symbol)}&quantity=${quantity}&purchase_price=${purchase_price}${purchase_date ? `&purchase_date=${purchase_date}` : ""}${notes ? `&notes=${encodeURIComponent(notes)}` : ""}`),
  deletePortfolioHolding: (id: number) => deleteApi<{ status: string }>(`/api/portfolio/${id}`),
  // Options
  getOptionsChain: (symbol: string, expiry?: string) =>
    fetchApi<OptionChainData>(`/api/options/${symbol}${expiry ? `?expiry=${encodeURIComponent(expiry)}` : ""}`),
  // Analyst
  getAnalystEstimates: (symbol: string) => fetchApi<AnalystEstimates>(`/api/analyst/${symbol}`),
  // Sector Detail
  getSectorDetail: (sector: string) => fetchApi<SectorDetail>(`/api/sectors/detail/${encodeURIComponent(sector)}`),
  // Paper Trading
  getPaperPositions: () => fetchApi<{ positions: PaperPosition[]; count: number }>("/api/paper-trading/positions"),
  placePaperTrade: (symbol: string, trade_type: string, quantity: number, price: number, stop_loss?: number, target_price?: number, signal_confidence?: number, notes?: string) => {
    let url = `/api/paper-trading/trade?symbol=${encodeURIComponent(symbol)}&trade_type=${trade_type}&quantity=${quantity}&price=${price}`;
    if (stop_loss !== undefined) url += `&stop_loss=${stop_loss}`;
    if (target_price !== undefined) url += `&target_price=${target_price}`;
    if (signal_confidence !== undefined) url += `&signal_confidence=${signal_confidence}`;
    if (notes) url += `&notes=${encodeURIComponent(notes)}`;
    return postApi<{ status: string; id: number }>(url);
  },
  closePaperTrade: (id: number, exit_price: number) =>
    postApi<{ status: string; trade_id: number; pnl: number }>(`/api/paper-trading/close/${id}?exit_price=${exit_price}`),
  getPaperTradeHistory: (limit = 50) =>
    fetchApi<{ trades: PaperTrade[]; count: number }>(`/api/paper-trading/history?limit=${limit}`),
  getPaperTradingStats: () => fetchApi<PaperTradingStats>("/api/paper-trading/stats"),
  getTradeSuggestions: () => fetchApi<{ suggestions: TradeSuggestion[]; count: number }>("/api/paper-trading/suggestions"),
};

// Phase 2+ Types
export interface FiiDiiFlow {
  date: string;
  fii_buy: number;
  fii_sell: number;
  fii_net: number;
  dii_buy: number;
  dii_sell: number;
  dii_net: number;
}

export interface FiiDiiSummary {
  fii_net_30d: number;
  dii_net_30d: number;
  fii_net_5d: number;
  dii_net_5d: number;
  fii_latest: number;
  dii_latest: number;
  fii_streak: number;
  fii_streak_direction: string;
}

export interface PeerComparison {
  peers: PeerStock[];
  sector: string;
  medians: Record<string, number | null>;
  count: number;
}

export interface PeerStock {
  symbol: string;
  name: string;
  pe: number | null;
  pb: number | null;
  roe: number | null;
  de: number | null;
  market_cap: number | null;
  profit_margin: number | null;
  revenue_growth: number | null;
  earnings_growth: number | null;
  dividend_yield: number | null;
  beta: number | null;
  is_target: boolean;
}

export interface EconomicEvent {
  date: string;
  event: string;
  category: string;
  importance: string;
  country: string;
  previous: string | null;
  forecast: string | null;
  actual: string | null;
}

export interface EarningsEvent {
  symbol: string;
  name: string;
  earnings_date: string;
  eps_estimate: number | null;
  eps_actual: number | null;
  revenue_estimate: number | null;
  revenue_actual: number | null;
}

// Portfolio types
export interface PortfolioHolding {
  id: number;
  symbol: string;
  name: string;
  quantity: number;
  purchase_price: number;
  purchase_date: string | null;
  notes: string | null;
  ltp: number | null;
  change_pct: number | null;
  invested: number;
  current_value: number | null;
  pnl: number | null;
  pnl_pct: number | null;
  signal: string | null;
  sector: string;
}

export interface PortfolioSummary {
  total_invested: number;
  current_value: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  day_pnl: number;
  holdings_count: number;
}

export interface SectorExposure {
  sector: string;
  value: number;
  pct: number;
}

// Options types
export interface OptionStrike {
  strike: number;
  call_oi: number;
  call_change_oi: number;
  call_ltp: number;
  call_iv: number;
  call_delta: number;
  call_gamma: number;
  call_theta: number;
  call_vega: number;
  put_oi: number;
  put_change_oi: number;
  put_ltp: number;
  put_iv: number;
  put_delta: number;
  put_gamma: number;
  put_theta: number;
  put_vega: number;
}

export interface OptionChainData {
  symbol: string;
  underlying: number;
  expiry: string;
  expiry_dates: string[];
  strikes: OptionStrike[];
  pcr: number;
  max_pain: number;
  atm_strike: number;
  total_call_oi: number;
  total_put_oi: number;
  source?: string;
}

// Analyst types
export interface AnalystEstimates {
  symbol: string;
  name: string;
  current_price: number | null;
  target_mean: number | null;
  target_high: number | null;
  target_low: number | null;
  num_analysts: number | null;
  recommendation: string | null;
  recommendation_mean: number | null;
  upside_pct: number | null;
  available: boolean;
}

// Paper trading types
export interface PaperPosition {
  id: number;
  symbol: string;
  name: string;
  trade_type: string;
  quantity: number;
  entry_price: number;
  ltp: number | null;
  unrealized_pnl: number | null;
  unrealized_pnl_pct: number | null;
  signal: string | null;
  signal_alignment: boolean;
  stop_loss: number | null;
  target_price: number | null;
  trade_date: string;
  signal_confidence: number | null;
  notes: string | null;
}

export interface PaperTrade {
  id: number;
  symbol: string;
  name: string;
  trade_type: string;
  quantity: number;
  entry_price: number;
  exit_price: number | null;
  pnl: number | null;
  pnl_pct: number | null;
  trade_date: string;
  closed_date: string | null;
  signal_confidence: number | null;
  status: string;
}

export interface PaperTradingStats {
  total_trades: number;
  open_count: number;
  closed_count: number;
  win_rate: number;
  avg_return_pct: number;
  total_realized_pnl: number;
  total_unrealized_pnl: number;
  best_trade: { symbol: string; pnl: number } | null;
  worst_trade: { symbol: string; pnl: number } | null;
  profit_factor: number;
}

export interface TradeSuggestion {
  symbol: string;
  name: string;
  signal: string;
  confidence: number;
  entry_price: number;
  stop_loss: number;
  target_price: number;
  composite_score: number;
  ltp: number | null;
}

// Sector detail types
export interface SectorDetailStock {
  symbol: string;
  name: string;
  ltp?: number;
  change_pct?: number;
  signal?: string;
  confidence?: number;
  pe?: number | null;
  roe?: number | null;
  market_cap?: number | null;
}

export interface SectorDetail {
  sector: string;
  momentum_score: number | null;
  rank: number | null;
  avg_return: number | null;
  breadth: number | null;
  stocks: SectorDetailStock[];
  count: number;
}

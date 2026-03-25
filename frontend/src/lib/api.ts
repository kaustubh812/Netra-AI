const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

async function postApi<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { method: "POST", cache: "no-store" });
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
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartMarker {
  time: string;
  position: string;
  color: string;
  shape: string;
  text: string;
}

export interface ChartData {
  symbol: string;
  candles: Candle[];
  markers: ChartMarker[];
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

// API functions
export const api = {
  getStocks: () => fetchApi<{ stocks: StockInfo[]; count: number; market_open?: boolean }>("/api/stocks"),
  getLivePrices: () => fetchApi<LivePrices>("/api/live-prices"),
  getStock: (symbol: string) => fetchApi<StockDetail>(`/api/stock/${symbol}`),
  getChart: (symbol: string, period = "1Y") => fetchApi<ChartData>(`/api/stock/${symbol}/chart?period=${period}`),
  getLatestSignals: () => fetchApi<{ signals: Signal[]; count: number }>("/api/signals/latest"),
  getBacktest: (symbol: string) => fetchApi<BacktestResult>(`/api/backtest/${symbol}`),
  getMarketOverview: () => fetchApi<MarketOverview>("/api/market-overview"),
  getTrainingMetrics: () => fetchApi<{ metrics: Record<string, unknown>; count: number }>("/api/training-metrics"),
  retrain: () => postApi<{ status: string }>("/api/retrain"),
  refreshData: () => postApi<{ status: string }>("/api/refresh-data"),
};

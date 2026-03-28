"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useWorkspace, type PanelType } from "@/hooks/use-workspace";
import { StockChart } from "./chart";
import { SignalBadge } from "./signal-badge";

// ─── Security Selector (shared across panels) ─── //
export function SecuritySelector({ compact }: { compact?: boolean }) {
  const { linkedSymbol, setLinkedSymbol } = useWorkspace();
  const { data: stocksData } = useQuery({
    queryKey: ["stocks"],
    queryFn: api.getStocks,
    staleTime: 60 * 1000,
  });

  const stocks = stocksData?.stocks ?? [];
  const current = stocks.find((s) => s.symbol === linkedSymbol);

  return (
    <div className="flex items-center gap-2">
      <select
        value={linkedSymbol}
        onChange={(e) => setLinkedSymbol(e.target.value)}
        className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1 text-xs font-mono text-foreground outline-none focus:border-cyan/30"
        style={{ maxWidth: compact ? 120 : 180 }}
      >
        {stocks.map((s) => (
          <option key={s.symbol} value={s.symbol} style={{ background: "#0f0f18" }}>
            {s.name}
          </option>
        ))}
      </select>
      {!compact && current && (
        <span className="text-[10px] text-foreground/30 font-mono">
          {current.ltp?.toLocaleString("en-IN")} {current.change_pct !== undefined ? `(${current.change_pct >= 0 ? "+" : ""}${current.change_pct.toFixed(2)}%)` : ""}
        </span>
      )}
    </div>
  );
}

// ─── Chart Panel ─── //
function ChartPanel() {
  const { linkedSymbol } = useWorkspace();
  const { data: stock } = useQuery({
    queryKey: ["stock", linkedSymbol],
    queryFn: () => api.getStock(linkedSymbol),
    staleTime: 30 * 1000,
  });

  const sig = stock?.current_signal;

  return (
    <div className="h-full min-h-[280px]">
      <StockChart
        symbol={linkedSymbol}
        entryPrice={sig?.entry_price}
        stopLoss={sig?.stop_loss}
        targetPrice={sig?.target_price}
        signal={sig?.signal}
      />
    </div>
  );
}

// ─── Indicators Panel ─── //
function IndicatorsPanel() {
  const { linkedSymbol } = useWorkspace();
  const { data: stock } = useQuery({
    queryKey: ["stock", linkedSymbol],
    queryFn: () => api.getStock(linkedSymbol),
    staleTime: 30 * 1000,
  });

  const indicators = stock?.indicators ?? {};
  const sig = stock?.current_signal;

  const importantKeys = ["rsi_14", "macd", "macd_signal", "supertrend", "atr_14", "bb_upper", "bb_lower", "adx", "cci_20", "mfi_14"];

  return (
    <div className="space-y-2 overflow-y-auto max-h-[400px]">
      {sig && (
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/[0.06]">
          <SignalBadge signal={sig.signal} confidence={sig.confidence} />
          <span className="text-xs text-foreground/30 font-mono">Score: {(sig.composite_score * 100).toFixed(1)}%</span>
        </div>
      )}
      {importantKeys.map((key) => {
        const val = indicators[key];
        if (val === undefined || val === null) return null;
        return (
          <div key={key} className="flex items-center justify-between py-1 border-b border-white/[0.03]">
            <span className="text-xs text-foreground/40">{key.replace(/_/g, " ").toUpperCase()}</span>
            <span className="text-xs font-mono text-foreground/60">{typeof val === "number" ? val.toFixed(2) : String(val)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── News Panel ─── //
function NewsPanel() {
  const { linkedSymbol } = useWorkspace();
  const { data } = useQuery({
    queryKey: ["stock-news", linkedSymbol],
    queryFn: () => api.getStockNews(linkedSymbol),
    staleTime: 5 * 60 * 1000,
  });

  const news = data?.news ?? [];

  return (
    <div className="space-y-2 overflow-y-auto max-h-[400px]">
      <div className="text-[10px] text-foreground/25 uppercase tracking-wider mb-1">
        {data?.sentiment_label ?? ""} &middot; {news.length} articles
      </div>
      {news.length === 0 && <div className="text-xs text-foreground/20 py-4 text-center">No news available</div>}
      {news.slice(0, 10).map((item, i) => {
        const sentColor = item.sentiment_score > 0.6 ? "text-ngreen" : item.sentiment_score < 0.4 ? "text-nred" : "text-foreground/40";
        return (
          <a
            key={i}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block py-1.5 border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] rounded px-1 -mx-1 transition-colors"
          >
            <div className="text-xs text-foreground/60 leading-relaxed">{item.headline}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-[10px] font-mono ${sentColor}`}>{(item.sentiment_score * 100).toFixed(0)}%</span>
              <span className="text-[10px] text-foreground/20">{item.source}</span>
            </div>
          </a>
        );
      })}
    </div>
  );
}

// ─── Fundamentals Panel ─── //
function FundamentalsPanel() {
  const { linkedSymbol } = useWorkspace();
  const { data } = useQuery({
    queryKey: ["fundamentals", linkedSymbol],
    queryFn: () => api.getStockFundamentals(linkedSymbol),
    staleTime: 30 * 60 * 1000,
  });

  const f = data?.fundamentals;
  if (!f) return <div className="text-xs text-foreground/20 py-4 text-center">No fundamentals data</div>;

  const metrics = [
    { key: "pe_trailing", label: "P/E" },
    { key: "pb_ratio", label: "P/B" },
    { key: "profit_margin", label: "Margin" },
    { key: "roe", label: "ROE" },
    { key: "de_ratio", label: "D/E" },
    { key: "revenue_growth", label: "Rev Growth" },
    { key: "earnings_growth", label: "EPS Growth" },
    { key: "dividend_yield", label: "Div Yield" },
  ];

  return (
    <div className="space-y-2 overflow-y-auto max-h-[400px]">
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/[0.06]">
        <span className="text-xs text-foreground/40">Score:</span>
        <span className="text-sm font-mono font-bold text-cyan">{(data.score * 100).toFixed(0)}%</span>
        <span className="text-[10px] text-foreground/25">{data.label}</span>
      </div>
      {metrics.map(({ key, label }) => {
        const val = f[key];
        if (val === undefined || val === null) return null;
        return (
          <div key={key} className="flex items-center justify-between py-1 border-b border-white/[0.03]">
            <span className="text-xs text-foreground/40">{label}</span>
            <span className="text-xs font-mono text-foreground/60">
              {typeof val === "number" ? (Math.abs(val) < 1 ? (val * 100).toFixed(1) + "%" : val.toFixed(2)) : String(val)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Signal Table Panel ─── //
function SignalsPanel() {
  const { setLinkedSymbol } = useWorkspace();
  const { data } = useQuery({
    queryKey: ["stocks"],
    queryFn: api.getStocks,
    staleTime: 30 * 1000,
  });

  const stocks = (data?.stocks ?? [])
    .filter((s) => s.signal && s.signal !== "HOLD")
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
    .slice(0, 20);

  return (
    <div className="overflow-y-auto max-h-[400px]">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-foreground/25 text-[10px] uppercase tracking-wider">
            <th className="text-left py-1 font-medium">Stock</th>
            <th className="text-center py-1 font-medium">Signal</th>
            <th className="text-right py-1 font-medium">LTP</th>
            <th className="text-right py-1 font-medium">Chg%</th>
          </tr>
        </thead>
        <tbody>
          {stocks.map((s) => (
            <tr
              key={s.symbol}
              onClick={() => setLinkedSymbol(s.symbol)}
              className="border-b border-white/[0.03] cursor-pointer hover:bg-white/[0.02] transition-colors"
            >
              <td className="py-1.5 text-foreground/60 font-medium">{s.name}</td>
              <td className="py-1.5 text-center">
                <SignalBadge signal={s.signal!} confidence={s.confidence ?? 0} />
              </td>
              <td className="py-1.5 text-right font-mono text-foreground/50">
                {s.ltp?.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
              </td>
              <td className={`py-1.5 text-right font-mono ${(s.change_pct ?? 0) >= 0 ? "text-ngreen" : "text-nred"}`}>
                {s.change_pct !== undefined ? `${s.change_pct >= 0 ? "+" : ""}${s.change_pct.toFixed(2)}%` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Backtest Panel ─── //
function BacktestPanel() {
  const { linkedSymbol } = useWorkspace();
  const { data, isLoading } = useQuery({
    queryKey: ["backtest", linkedSymbol],
    queryFn: () => api.getBacktest(linkedSymbol),
    staleTime: 30 * 60 * 1000,
  });

  if (isLoading) return <div className="shimmer h-32 rounded-lg" />;
  if (!data) return <div className="text-xs text-foreground/20 py-4 text-center">No backtest data</div>;

  const metrics = [
    { label: "Total Return", value: `${data.total_return.toFixed(2)}%`, color: data.total_return >= 0 ? "text-ngreen" : "text-nred" },
    { label: "Buy & Hold", value: `${data.buy_hold_return.toFixed(2)}%`, color: data.buy_hold_return >= 0 ? "text-ngreen" : "text-nred" },
    { label: "Win Rate", value: `${data.win_rate.toFixed(1)}%`, color: data.win_rate >= 50 ? "text-ngreen" : "text-nred" },
    { label: "Sharpe", value: data.sharpe_ratio.toFixed(2), color: data.sharpe_ratio >= 1 ? "text-ngreen" : "text-foreground/50" },
    { label: "Max Drawdown", value: `${data.max_drawdown.toFixed(2)}%`, color: "text-nred" },
    { label: "Trades", value: String(data.total_trades), color: "text-foreground/50" },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {metrics.map(({ label, value, color }) => (
        <div key={label} className="bg-white/[0.02] rounded-lg px-3 py-2">
          <div className="text-[10px] text-foreground/25 uppercase tracking-wider">{label}</div>
          <div className={`text-sm font-mono font-bold ${color}`}>{value}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Mini Heatmap Panel ─── //
function MiniHeatmapPanel() {
  const { setLinkedSymbol } = useWorkspace();
  const { data } = useQuery({
    queryKey: ["stocks"],
    queryFn: api.getStocks,
    staleTime: 30 * 1000,
  });

  const stocks = (data?.stocks ?? []).sort((a, b) => (b.change_pct ?? 0) - (a.change_pct ?? 0));

  return (
    <div className="grid grid-cols-5 gap-1 overflow-y-auto max-h-[400px]">
      {stocks.map((s) => {
        const pct = s.change_pct ?? 0;
        const bg = pct > 1.5
          ? "rgba(0,200,83,0.35)"
          : pct > 0
            ? "rgba(0,200,83,0.15)"
            : pct < -1.5
              ? "rgba(255,23,68,0.35)"
              : pct < 0
                ? "rgba(255,23,68,0.15)"
                : "rgba(255,255,255,0.03)";
        return (
          <button
            key={s.symbol}
            onClick={() => setLinkedSymbol(s.symbol)}
            className="rounded px-1 py-1.5 text-center cursor-pointer transition-opacity hover:opacity-80"
            style={{ backgroundColor: bg }}
            title={`${s.name}: ${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`}
          >
            <div className="text-[8px] text-foreground/50 truncate">{s.name}</div>
            <div className={`text-[10px] font-mono font-bold ${pct >= 0 ? "text-ngreen" : "text-nred"}`}>
              {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Watchlist Panel ─── //
function WatchlistPanel() {
  const { setLinkedSymbol } = useWorkspace();
  const { data } = useQuery({
    queryKey: ["stocks"],
    queryFn: api.getStocks,
    staleTime: 30 * 1000,
  });

  // Show top 15 by absolute change
  const stocks = (data?.stocks ?? [])
    .sort((a, b) => Math.abs(b.change_pct ?? 0) - Math.abs(a.change_pct ?? 0))
    .slice(0, 15);

  return (
    <div className="space-y-0.5 overflow-y-auto max-h-[400px]">
      {stocks.map((s) => (
        <button
          key={s.symbol}
          onClick={() => setLinkedSymbol(s.symbol)}
          className="w-full flex items-center justify-between py-1.5 px-1 rounded hover:bg-white/[0.02] transition-colors text-left"
        >
          <div>
            <div className="text-xs text-foreground/60 font-medium">{s.name}</div>
            <div className="text-[10px] text-foreground/25 font-mono">{s.symbol}</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-mono text-foreground/50">{s.ltp?.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div>
            <div className={`text-[10px] font-mono ${(s.change_pct ?? 0) >= 0 ? "text-ngreen" : "text-nred"}`}>
              {s.change_pct !== undefined ? `${s.change_pct >= 0 ? "+" : ""}${s.change_pct.toFixed(2)}%` : ""}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Macro Panel ─── //
function MacroPanel() {
  const { data } = useQuery({
    queryKey: ["macro"],
    queryFn: api.getMacro,
    staleTime: 5 * 60 * 1000,
  });

  const indicators = data?.indicators ?? {};

  return (
    <div className="space-y-2 overflow-y-auto max-h-[400px]">
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/[0.06]">
        <span className="text-xs text-foreground/40">Macro Score:</span>
        <span className="text-sm font-mono font-bold text-cyan">{((data?.score ?? 0) * 100).toFixed(0)}%</span>
        <span className="text-[10px] text-foreground/25">{data?.label}</span>
      </div>
      {Object.entries(indicators).map(([key, ind]) => (
        <div key={key} className="flex items-center justify-between py-1 border-b border-white/[0.03]">
          <span className="text-xs text-foreground/40">{ind.name}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-foreground/50">{ind.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
            <span className={`text-[10px] font-mono ${ind.change_pct >= 0 ? "text-ngreen" : "text-nred"}`}>
              {ind.change_pct >= 0 ? "+" : ""}{ind.change_pct.toFixed(2)}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Regime Panel ─── //
function RegimePanel() {
  const { data } = useQuery({
    queryKey: ["regime"],
    queryFn: api.getRegime,
    staleTime: 5 * 60 * 1000,
  });

  const regime = data?.regime ?? "unknown";
  const confidence = data?.confidence ?? 0;
  const metrics = data?.metrics ?? {};
  const regimeColor = regime.includes("volatile") ? "text-nred" : regime.includes("trending") ? "text-ngreen" : "text-amber";

  return (
    <div className="space-y-3">
      <div className="text-center py-3">
        <div className={`text-lg font-mono font-bold ${regimeColor}`}>
          {regime.replace("_", " ").toUpperCase()}
        </div>
        <div className="text-[10px] text-foreground/30 mt-1">{(confidence * 100).toFixed(0)}% confidence</div>
      </div>
      <div className="space-y-1.5">
        {Object.entries(metrics).map(([key, val]) => (
          <div key={key} className="flex items-center justify-between py-1 border-b border-white/[0.03]">
            <span className="text-[10px] text-foreground/30">{key.replace(/_/g, " ")}</span>
            <span className="text-[10px] font-mono text-foreground/50">{typeof val === "number" ? val.toFixed(3) : String(val)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Panel Renderer ─── //
export function PanelContent({ type }: { type: PanelType }) {
  switch (type) {
    case "chart":
      return <ChartPanel />;
    case "indicators":
      return <IndicatorsPanel />;
    case "news":
      return <NewsPanel />;
    case "fundamentals":
      return <FundamentalsPanel />;
    case "signals":
      return <SignalsPanel />;
    case "backtest":
      return <BacktestPanel />;
    case "heatmap-mini":
      return <MiniHeatmapPanel />;
    case "watchlist":
      return <WatchlistPanel />;
    case "macro":
      return <MacroPanel />;
    case "regime":
      return <RegimePanel />;
    default:
      return <div className="text-xs text-foreground/20 text-center py-4">Unknown panel type</div>;
  }
}

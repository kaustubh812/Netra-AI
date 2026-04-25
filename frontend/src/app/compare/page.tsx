"use client";

import { useState } from "react";
import { api, CompareStock, StockCompareData } from "@/lib/api";
import { Sparkline } from "@/components/sparkline";
import Link from "next/link";
import { toUrlSymbol } from "@/lib/symbol";

const SIGNAL_STYLE: Record<string, { bg: string; color: string }> = {
  BUY: { bg: "rgba(16,185,129,0.15)", color: "var(--green-bright)" },
  SELL: { bg: "rgba(244,63,94,0.15)", color: "var(--red-bright)" },
  HOLD: { bg: "rgba(245,158,11,0.1)", color: "var(--amber)" },
};

const RADAR_KEYS = ["momentum", "value", "technical", "growth", "quality", "confidence"];
const STOCK_COLORS = ["rgba(34,211,238,0.9)", "rgba(167,139,250,0.9)", "rgba(16,185,129,0.9)", "rgba(244,63,94,0.9)"];

const POPULAR_PAIRS = [
  ["HDFCBANK", "ICICIBANK"],
  ["TCS", "INFY"],
  ["RELIANCE", "ITC"],
  ["BHARTIARTL", "JIOFINANCE"],
  ["WIPRO", "HCLTECH"],
];

export default function ComparePage() {
  const [symbols, setSymbols] = useState<string[]>(["", ""]);
  const [data, setData] = useState<StockCompareData | null>(null);
  const [loading, setLoading] = useState(false);

  function updateSymbol(idx: number, val: string) {
    const updated = [...symbols];
    updated[idx] = val.toUpperCase();
    setSymbols(updated);
  }

  function addSlot() {
    if (symbols.length >= 4) return;
    setSymbols([...symbols, ""]);
  }

  function removeSlot(idx: number) {
    if (symbols.length <= 2) return;
    setSymbols(symbols.filter((_, i) => i !== idx));
  }

  async function handleCompare(overrideSymbols?: string[]) {
    const syms = (overrideSymbols || symbols).filter((s) => s.trim());
    if (syms.length < 2) return;
    setLoading(true);
    try {
      const res = await api.compareStocks(syms);
      setData(res);
      if (!overrideSymbols) return;
      // Update input fields with the pair
      const padded = [...syms];
      while (padded.length < 2) padded.push("");
      setSymbols(padded);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  function handlePair(pair: string[]) {
    setSymbols([...pair]);
    handleCompare(pair);
  }

  return (
    <div className="min-h-screen p-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="section-header text-xl font-bold text-foreground/90">Stock Comparison</h1>
        <p className="text-foreground/30 text-sm mt-1 ml-5">Compare 2-4 stocks head-to-head</p>
      </div>

      {/* Input Bar */}
      <div className="glass-card-glow rounded-2xl p-5 mb-5">
        <div className="flex gap-2 items-end mb-3">
          {symbols.map((sym, idx) => (
            <div key={idx} className="flex-1 relative">
              <label className="text-[10px] text-foreground/30 uppercase tracking-wider mb-1 block">Stock {idx + 1}</label>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={sym}
                  onChange={(e) => updateSymbol(idx, e.target.value)}
                  placeholder="e.g. RELIANCE"
                  className="w-full rounded-lg py-2 px-3 text-sm text-foreground/80 outline-none"
                  style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${STOCK_COLORS[idx]}30` }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCompare(); }}
                />
                {symbols.length > 2 && (
                  <button onClick={() => removeSlot(idx)} className="text-foreground/15 hover:text-red-400 transition-colors px-1">&times;</button>
                )}
              </div>
            </div>
          ))}
          {symbols.length < 4 && (
            <button onClick={addSlot} className="text-xs px-3 py-2 rounded-lg shrink-0 mb-0.5"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)" }}>
              + Add
            </button>
          )}
          <button
            onClick={() => handleCompare()}
            disabled={loading || symbols.filter((s) => s.trim()).length < 2}
            className="px-5 py-2 rounded-lg text-sm font-semibold shrink-0 mb-0.5 transition-all"
            style={{
              background: "linear-gradient(135deg, rgba(34,211,238,0.2), rgba(167,139,250,0.15))",
              border: "1px solid rgba(34,211,238,0.3)", color: "var(--cyan)",
              opacity: loading || symbols.filter((s) => s.trim()).length < 2 ? 0.4 : 1,
            }}>
            {loading ? "Comparing..." : "Compare"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {POPULAR_PAIRS.map((pair) => (
            <button key={pair.join("-")} onClick={() => handlePair(pair)}
              className="text-[11px] px-2.5 py-1 rounded-lg transition-all hover:border-cyan/30"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.35)" }}>
              {pair.join(" vs ")}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="glass-card rounded-xl h-20 shimmer" />)}</div>}

      {data?.error && <div className="glass-card rounded-xl p-5 mb-4"><p className="text-red-400 text-sm">{data.error}</p></div>}

      {data && !loading && data.stocks.length >= 2 && (
        <>
          {/* Overview Cards */}
          <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: `repeat(${data.stocks.length}, 1fr)` }}>
            {data.stocks.map((stock, idx) => (
              <div key={stock.symbol} className="glass-card rounded-xl p-4" style={{ borderTop: `2px solid ${STOCK_COLORS[idx]}` }}>
                <Link href={`/stock/${toUrlSymbol(stock.symbol)}`} className="hover:text-cyan transition-colors">
                  <h3 className="text-base font-bold text-foreground/85">{stock.name}</h3>
                </Link>
                <p className="text-xs text-foreground/30 mb-2">{stock.sector || "N/A"}</p>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-lg text-foreground/80">&#x20B9;{stock.price?.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
                  <span className="font-mono text-sm font-medium" style={{ color: stock.change_pct >= 0 ? "var(--green)" : "var(--red)" }}>
                    {stock.change_pct >= 0 ? "+" : ""}{stock.change_pct?.toFixed(2)}%
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded" style={{
                    background: (SIGNAL_STYLE[stock.signal] || SIGNAL_STYLE.HOLD).bg,
                    color: (SIGNAL_STYLE[stock.signal] || SIGNAL_STYLE.HOLD).color,
                  }}>{stock.signal}</span>
                  <span className="text-xs text-foreground/40 ml-2">{stock.confidence?.toFixed(0)}% confidence</span>
                </div>
              </div>
            ))}
          </div>

          {/* Score Comparison Bars */}
          <div className="glass-card rounded-2xl p-5 mb-5">
            <h3 className="text-sm font-semibold text-foreground/60 mb-4">Score Comparison</h3>
            <div className="space-y-3">
              {RADAR_KEYS.map((key) => (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-foreground/40 capitalize w-24">{key}</span>
                    <div className="flex gap-3">
                      {data.stocks.map((stock, idx) => (
                        <span key={stock.symbol} className="text-[11px] font-mono w-12 text-right" style={{ color: STOCK_COLORS[idx] }}>
                          {stock.radar[key] ?? "--"}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1 h-2">
                    {data.stocks.map((stock, idx) => (
                      <div key={stock.symbol} className="flex-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.03)" }}>
                        <div className="h-full rounded-full transition-all" style={{
                          width: `${stock.radar[key] || 0}%`,
                          background: STOCK_COLORS[idx],
                          opacity: 0.7,
                        }} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Performance Sparklines */}
          {Object.keys(data.performance).length >= 2 && (
            <div className="glass-card rounded-2xl p-5 mb-5">
              <h3 className="text-sm font-semibold text-foreground/60 mb-3">Normalized Performance (1Y, base=100)</h3>
              <div className="flex gap-4 mb-3">
                {Object.entries(data.performance).map(([name], idx) => (
                  <span key={name} className="text-xs font-mono flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm inline-block" style={{ background: STOCK_COLORS[idx] }} />
                    {name}
                  </span>
                ))}
              </div>
              <div className="flex gap-3">
                {Object.entries(data.performance).map(([name, perf], idx) => (
                  <div key={name} className="flex-1">
                    <Sparkline data={perf.values} width={400} height={100} positive={perf.values[perf.values.length - 1] >= 100} />
                    <p className="text-center text-[10px] text-foreground/30 mt-1">
                      {name}: {perf.values[perf.values.length - 1]?.toFixed(1)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Returns */}
          <div className="glass-card rounded-2xl p-5 mb-5">
            <h3 className="text-sm font-semibold text-foreground/60 mb-3">Returns</h3>
            <table className="w-full premium-table">
              <thead>
                <tr>
                  <th className="text-left">Period</th>
                  {data.stocks.map((stock, idx) => (
                    <th key={stock.symbol} className="text-right" style={{ color: STOCK_COLORS[idx] }}>{stock.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "1 Week", key: "return_1w" },
                  { label: "1 Month", key: "return_1m" },
                  { label: "3 Months", key: "return_3m" },
                  { label: "6 Months", key: "return_6m" },
                  { label: "1 Year", key: "return_1y" },
                ].map((period) => (
                  <tr key={period.key}>
                    <td className="py-2.5 px-4 text-sm text-foreground/50">{period.label}</td>
                    {data.stocks.map((stock) => {
                      const val = stock[period.key as keyof CompareStock] as number | null;
                      return (
                        <td key={stock.symbol} className="py-2.5 px-4 text-right font-mono text-sm"
                          style={{ color: val != null ? (val >= 0 ? "var(--green)" : "var(--red)") : "rgba(255,255,255,0.15)" }}>
                          {val != null ? `${val >= 0 ? "+" : ""}${val.toFixed(1)}%` : "--"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Fundamentals */}
          <div className="glass-card rounded-2xl p-5 mb-5">
            <h3 className="text-sm font-semibold text-foreground/60 mb-3">Fundamentals</h3>
            <table className="w-full premium-table">
              <thead>
                <tr>
                  <th className="text-left">Metric</th>
                  {data.stocks.map((stock, idx) => (
                    <th key={stock.symbol} className="text-right" style={{ color: STOCK_COLORS[idx] }}>{stock.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "P/E Ratio", key: "pe", fmt: (v: number) => v?.toFixed(1) },
                  { label: "P/B Ratio", key: "pb", fmt: (v: number) => v?.toFixed(2) },
                  { label: "ROE", key: "roe", fmt: (v: number) => v != null ? `${(v * 100).toFixed(1)}%` : null },
                  { label: "D/E Ratio", key: "de", fmt: (v: number) => v?.toFixed(2) },
                  { label: "Profit Margin", key: "profit_margin", fmt: (v: number) => v != null ? `${(v * 100).toFixed(1)}%` : null },
                  { label: "Revenue Growth", key: "revenue_growth", fmt: (v: number) => v != null ? `${(v * 100).toFixed(1)}%` : null },
                  { label: "Dividend Yield", key: "dividend_yield", fmt: (v: number) => v != null ? `${(v * 100).toFixed(2)}%` : null },
                  { label: "Market Cap", key: "market_cap", fmt: fmtCrore },
                ].map((metric) => (
                  <tr key={metric.key}>
                    <td className="py-2.5 px-4 text-sm text-foreground/50">{metric.label}</td>
                    {data.stocks.map((stock) => {
                      const val = stock[metric.key as keyof CompareStock] as number | null;
                      const formatted = val != null ? metric.fmt(val) : "--";
                      return (
                        <td key={stock.symbol} className="py-2.5 px-4 text-right font-mono text-sm text-foreground/60">
                          {formatted || "--"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Technicals */}
          <div className="glass-card rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-foreground/60 mb-3">Technical Indicators</h3>
            <table className="w-full premium-table">
              <thead>
                <tr>
                  <th className="text-left">Indicator</th>
                  {data.stocks.map((stock, idx) => (
                    <th key={stock.symbol} className="text-right" style={{ color: STOCK_COLORS[idx] }}>{stock.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "RSI", key: "rsi" },
                  { label: "MACD", key: "macd" },
                  { label: "ADX", key: "adx" },
                  { label: "ATR", key: "atr" },
                  { label: "SMA 50", key: "sma_50" },
                  { label: "SMA 200", key: "sma_200" },
                  { label: "Composite", key: "composite_score" },
                  { label: "Confidence", key: "confidence" },
                ].map((ind) => (
                  <tr key={ind.key}>
                    <td className="py-2.5 px-4 text-sm text-foreground/50">{ind.label}</td>
                    {data.stocks.map((stock) => {
                      const val = stock[ind.key as keyof CompareStock] as number | null;
                      return (
                        <td key={stock.symbol} className="py-2.5 px-4 text-right font-mono text-sm text-foreground/60">
                          {val != null ? (ind.key === "confidence" ? `${val.toFixed(0)}%` : val.toFixed(2)) : "--"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!data && !loading && (
        <div className="glass-card rounded-2xl p-10 text-center">
          <p className="text-foreground/20 text-sm">Enter 2-4 stock symbols to compare</p>
        </div>
      )}
    </div>
  );
}

function fmtCrore(val: number): string {
  if (val >= 1e12) return `\u20B9${(val / 1e12).toFixed(2)}T`;
  if (val >= 1e7) return `\u20B9${(val / 1e7).toFixed(0)}Cr`;
  if (val >= 1e5) return `\u20B9${(val / 1e5).toFixed(1)}L`;
  return `\u20B9${val.toLocaleString("en-IN")}`;
}

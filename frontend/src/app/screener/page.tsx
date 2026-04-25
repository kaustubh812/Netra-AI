"use client";

import { useState } from "react";
import { api, ScreenerResponse } from "@/lib/api";
import Link from "next/link";
import { toUrlSymbol } from "@/lib/symbol";

const EXAMPLE_QUERIES = [
  "BUY signals with high confidence",
  "Oversold stocks with good fundamentals",
  "IT sector stocks with RSI below 40",
  "Top gainers today",
  "SELL signals sorted by composite score",
  "Banking stocks with PE below 20",
  "Stocks with confidence above 70%",
  "Most bearish stocks right now",
];

const SIGNAL_STYLE: Record<string, { bg: string; color: string }> = {
  BUY: { bg: "rgba(16,185,129,0.15)", color: "var(--green-bright)" },
  SELL: { bg: "rgba(244,63,94,0.15)", color: "var(--red-bright)" },
  HOLD: { bg: "rgba(245,158,11,0.1)", color: "var(--amber)" },
};

export default function ScreenerPage() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<ScreenerResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  async function runSearch(q: string) {
    if (!q.trim()) return;
    setLoading(true);
    setQuery(q);
    try {
      const res = await api.aiScreen(q);
      setResult(res);
      setHistory((prev) => [q, ...prev.filter((h) => h !== q)].slice(0, 8));
    } catch {
      setResult({ query: q, filters: {}, results: [], count: 0, total_stocks: 0, error: "Request failed" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen p-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="section-header text-xl font-bold text-foreground/90">AI Stock Screener</h1>
        <p className="text-foreground/30 text-sm mt-1 ml-5">Search stocks using natural language</p>
      </div>

      {/* Search Bar */}
      <div className="glass-card-glow rounded-2xl p-5 mb-5">
        <form onSubmit={(e) => { e.preventDefault(); runSearch(query); }} className="flex gap-3">
          <div className="relative flex-1">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/20" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Try: "oversold large caps with BUY signal" or "IT stocks with low PE"'
              className="w-full rounded-xl py-3 pl-11 pr-4 text-sm text-foreground/80 outline-none transition-all"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(34,211,238,0.15)" }}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-6 py-3 rounded-xl text-sm font-semibold transition-all shrink-0"
            style={{
              background: loading ? "rgba(34,211,238,0.1)" : "linear-gradient(135deg, rgba(34,211,238,0.2), rgba(167,139,250,0.15))",
              border: "1px solid rgba(34,211,238,0.3)", color: "var(--cyan)",
              opacity: loading || !query.trim() ? 0.5 : 1,
            }}
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </form>

        <div className="flex flex-wrap gap-2 mt-3">
          {EXAMPLE_QUERIES.map((eq) => (
            <button key={eq} onClick={() => { setQuery(eq); runSearch(eq); }}
              className="text-[11px] px-2.5 py-1 rounded-lg transition-all hover:border-cyan/30"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.35)" }}
            >{eq}</button>
          ))}
        </div>
      </div>

      {/* Parsed filters chips */}
      {result && !result.error && Object.keys(result.filters).length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4 animate-fade-in">
          {Object.entries(result.filters).map(([key, val]) => {
            if (val === null || val === undefined || key === "limit" || key === "sort_order") return null;
            return (
              <span key={key} className="text-[10px] px-2 py-1 rounded-md font-mono"
                style={{ background: "rgba(34,211,238,0.1)", border: "1px solid rgba(34,211,238,0.2)", color: "var(--cyan)" }}>
                {key}: {String(val)}
              </span>
            );
          })}
          <span className="text-[10px] text-foreground/20 self-center ml-1">{result.count} of {result.total_stocks} stocks</span>
        </div>
      )}

      {result?.error && <div className="glass-card rounded-xl p-5 mb-4"><p className="text-red-400 text-sm">{result.error}</p></div>}

      {loading && (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="glass-card rounded-xl h-14 shimmer" />)}</div>
      )}

      {/* Results Table */}
      {result && !loading && result.results.length > 0 && (
        <div className="glass-card rounded-2xl overflow-hidden animate-fade-in">
          <table className="w-full premium-table">
            <thead>
              <tr>
                <th className="text-left">Stock</th>
                <th className="text-left">Signal</th>
                <th className="text-right">Price</th>
                <th className="text-right">Change</th>
                <th className="text-right">Confidence</th>
                <th className="text-right">RSI</th>
                <th className="text-right">P/E</th>
                <th className="text-left">Sector</th>
              </tr>
            </thead>
            <tbody>
              {result.results.map((stock) => {
                const s = SIGNAL_STYLE[stock.signal] || SIGNAL_STYLE.HOLD;
                return (
                  <tr key={stock.symbol}>
                    <td className="py-3 px-4">
                      <Link href={`/stock/${toUrlSymbol(stock.symbol)}`} className="hover:text-cyan transition-colors">
                        <span className="font-semibold text-sm text-foreground/80">{stock.name}</span>
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded" style={{ background: s.bg, color: s.color }}>{stock.signal}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm text-foreground/70">
                      {"\u20B9"}{stock.price?.toLocaleString("en-IN", { maximumFractionDigits: 0 }) ?? "--"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-mono text-sm font-medium" style={{ color: (stock.change_pct ?? 0) >= 0 ? "var(--green)" : "var(--red)" }}>
                        {(stock.change_pct ?? 0) >= 0 ? "+" : ""}{(stock.change_pct ?? 0).toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm text-foreground/60">{stock.confidence?.toFixed(0) ?? "--"}%</td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-mono text-sm" style={{ color: stock.rsi != null ? stock.rsi > 60 ? "var(--red)" : stock.rsi < 40 ? "var(--green)" : "var(--foreground)" : "var(--foreground)", opacity: stock.rsi != null ? 0.7 : 0.25 }}>
                        {stock.rsi?.toFixed(0) ?? "--"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm text-foreground/50">{stock.pe?.toFixed(1) ?? "--"}</td>
                    <td className="py-3 px-4 text-xs text-foreground/35 truncate max-w-[120px]">{stock.sector || "--"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {result && !loading && result.results.length === 0 && !result.error && (
        <div className="glass-card rounded-2xl p-10 text-center"><p className="text-foreground/25 text-sm">No stocks match your criteria</p></div>
      )}

      {history.length > 0 && (
        <div className="mt-6">
          <p className="text-[10px] text-foreground/20 uppercase tracking-wider mb-2">Recent Searches</p>
          <div className="flex flex-wrap gap-2">
            {history.map((h) => (
              <button key={h} onClick={() => { setQuery(h); runSearch(h); }} className="text-[11px] px-2.5 py-1 rounded-lg"
                style={{ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.12)", color: "rgba(167,139,250,0.6)" }}>{h}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { SignalBadge } from "@/components/signal-badge";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ScreenerFilters {
  signal: string;
  min_confidence: string;
  min_rsi: string;
  max_rsi: string;
  supertrend: string;
  min_pe: string;
  max_pe: string;
  min_roe: string;
  max_de: string;
  sector: string;
}

const DEFAULT_FILTERS: ScreenerFilters = {
  signal: "",
  min_confidence: "",
  min_rsi: "",
  max_rsi: "",
  supertrend: "",
  min_pe: "",
  max_pe: "",
  min_roe: "",
  max_de: "",
  sector: "",
};

function buildQuery(filters: ScreenerFilters): string {
  const params = new URLSearchParams();
  if (filters.signal) params.set("signal", filters.signal);
  if (filters.min_confidence) params.set("min_confidence", filters.min_confidence);
  if (filters.min_rsi) params.set("min_rsi", filters.min_rsi);
  if (filters.max_rsi) params.set("max_rsi", filters.max_rsi);
  if (filters.supertrend) params.set("supertrend", filters.supertrend);
  if (filters.min_pe) params.set("min_pe", filters.min_pe);
  if (filters.max_pe) params.set("max_pe", filters.max_pe);
  if (filters.min_roe) params.set("min_roe", filters.min_roe);
  if (filters.max_de) params.set("max_de", filters.max_de);
  if (filters.sector) params.set("sector", filters.sector);
  return params.toString();
}

const FILTER_INPUT = "bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs font-mono text-foreground placeholder-foreground/20 outline-none focus:border-cyan/30 focus:ring-1 focus:ring-cyan/10 transition-colors w-full";
const FILTER_SELECT = "bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs font-mono text-foreground outline-none focus:border-cyan/30 transition-colors w-full appearance-none cursor-pointer";

export default function ScreenerPage() {
  const [filters, setFilters] = useState<ScreenerFilters>(DEFAULT_FILTERS);

  const queryString = buildQuery(filters);
  const { data, isLoading } = useQuery({
    queryKey: ["screener", queryString],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/screener?${queryString}`);
      if (!res.ok) throw new Error("Screener fetch failed");
      return res.json();
    },
    refetchInterval: 60 * 1000,
  });

  const updateFilter = (key: keyof ScreenerFilters, val: string) => {
    setFilters((prev) => ({ ...prev, [key]: val }));
  };

  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  const results = data?.results ?? [];
  const sectors: string[] = data?.sectors ?? [];

  return (
    <div className="px-6 py-6 relative z-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="section-header text-xs font-medium text-foreground/40 uppercase tracking-widest mb-1">
            Stock Screener
          </h1>
          <p className="text-foreground/20 text-xs">
            {data ? `${data.count} of ${data.total} stocks match` : "Loading..."}
          </p>
        </div>
        <button
          onClick={resetFilters}
          className="text-xs text-foreground/30 hover:text-cyan px-3 py-1.5 rounded-lg border border-white/[0.06] hover:border-cyan/20 transition-colors"
        >
          Reset Filters
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card rounded-xl p-4 mb-6 animate-fade-in">
        <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-3">
          {/* Signal */}
          <div>
            <label className="block text-[10px] text-foreground/30 mb-1 uppercase tracking-wider">Signal</label>
            <select value={filters.signal} onChange={(e) => updateFilter("signal", e.target.value)} className={FILTER_SELECT}>
              <option value="">All</option>
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
              <option value="HOLD">HOLD</option>
            </select>
          </div>

          {/* Min Confidence */}
          <div>
            <label className="block text-[10px] text-foreground/30 mb-1 uppercase tracking-wider">Min Str %</label>
            <input type="number" placeholder="0" value={filters.min_confidence} onChange={(e) => updateFilter("min_confidence", e.target.value)} className={FILTER_INPUT} />
          </div>

          {/* RSI Range */}
          <div>
            <label className="block text-[10px] text-foreground/30 mb-1 uppercase tracking-wider">Min RSI</label>
            <input type="number" placeholder="0" value={filters.min_rsi} onChange={(e) => updateFilter("min_rsi", e.target.value)} className={FILTER_INPUT} />
          </div>
          <div>
            <label className="block text-[10px] text-foreground/30 mb-1 uppercase tracking-wider">Max RSI</label>
            <input type="number" placeholder="100" value={filters.max_rsi} onChange={(e) => updateFilter("max_rsi", e.target.value)} className={FILTER_INPUT} />
          </div>

          {/* Supertrend */}
          <div>
            <label className="block text-[10px] text-foreground/30 mb-1 uppercase tracking-wider">Supertrend</label>
            <select value={filters.supertrend} onChange={(e) => updateFilter("supertrend", e.target.value)} className={FILTER_SELECT}>
              <option value="">All</option>
              <option value="1">Bullish</option>
              <option value="-1">Bearish</option>
            </select>
          </div>

          {/* P/E Range */}
          <div>
            <label className="block text-[10px] text-foreground/30 mb-1 uppercase tracking-wider">Min P/E</label>
            <input type="number" placeholder="0" value={filters.min_pe} onChange={(e) => updateFilter("min_pe", e.target.value)} className={FILTER_INPUT} />
          </div>
          <div>
            <label className="block text-[10px] text-foreground/30 mb-1 uppercase tracking-wider">Max P/E</label>
            <input type="number" placeholder="100" value={filters.max_pe} onChange={(e) => updateFilter("max_pe", e.target.value)} className={FILTER_INPUT} />
          </div>

          {/* ROE */}
          <div>
            <label className="block text-[10px] text-foreground/30 mb-1 uppercase tracking-wider">Min ROE</label>
            <input type="number" step="0.01" placeholder="0" value={filters.min_roe} onChange={(e) => updateFilter("min_roe", e.target.value)} className={FILTER_INPUT} />
          </div>

          {/* D/E */}
          <div>
            <label className="block text-[10px] text-foreground/30 mb-1 uppercase tracking-wider">Max D/E</label>
            <input type="number" step="0.1" placeholder="Any" value={filters.max_de} onChange={(e) => updateFilter("max_de", e.target.value)} className={FILTER_INPUT} />
          </div>

          {/* Sector */}
          <div>
            <label className="block text-[10px] text-foreground/30 mb-1 uppercase tracking-wider">Sector</label>
            <select value={filters.sector} onChange={(e) => updateFilter("sector", e.target.value)} className={FILTER_SELECT}>
              <option value="">All</option>
              {sectors.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="glass-card rounded-xl overflow-hidden animate-fade-in animate-fade-in-d2">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="shimmer h-4 w-40 rounded mx-auto" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-white/[0.06] bg-white/[0.02] sticky top-0 z-10 backdrop-blur-sm">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-foreground/40">Stock</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-foreground/40">LTP</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-foreground/40">Chg %</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-foreground/40">Signal</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-foreground/40">Strength</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-foreground/40">RSI</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-foreground/40">ADX</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-foreground/40">P/E</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-foreground/40">ROE</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-foreground/40">Sector</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {results.map((r: Record<string, unknown>) => (
                  <tr key={r.symbol as string} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-2.5">
                      <Link href={`/stock/${encodeURIComponent(r.symbol as string)}`} className="text-cyan hover:underline font-medium text-sm">
                        {r.name as string}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-sm">
                      {(r.ltp as number)?.toLocaleString("en-IN", { maximumFractionDigits: 2 }) ?? "\u2014"}
                    </td>
                    <td className="px-4 py-2.5">
                      {r.change_pct !== undefined && r.change_pct !== null ? (
                        <span className={`font-mono text-xs px-1.5 py-0.5 rounded ${(r.change_pct as number) >= 0 ? "bg-ngreen/10 text-ngreen" : "bg-nred/10 text-nred"}`}>
                          {(r.change_pct as number) >= 0 ? "+" : ""}{(r.change_pct as number).toFixed(2)}%
                        </span>
                      ) : "\u2014"}
                    </td>
                    <td className="px-4 py-2.5">
                      {r.signal ? <SignalBadge signal={r.signal as string} size="sm" /> : "\u2014"}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="confidence-bar w-16">
                          <div
                            className="confidence-bar-fill"
                            style={{
                              width: `${r.confidence as number}%`,
                              backgroundColor: (r.confidence as number) > 65 ? "rgba(16,185,129,0.7)" : (r.confidence as number) > 45 ? "rgba(255,171,0,0.7)" : "rgba(244,63,94,0.7)",
                            }}
                          />
                        </div>
                        <span className="font-mono text-xs text-foreground/50">{(r.confidence as number)?.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-foreground/50">
                      {(r.rsi as number)?.toFixed(1) ?? "\u2014"}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-foreground/50">
                      {(r.adx as number)?.toFixed(1) ?? "\u2014"}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-foreground/50">
                      {(r.pe as number)?.toFixed(1) ?? "\u2014"}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-foreground/50">
                      {r.roe != null ? `${((r.roe as number) * 100).toFixed(1)}%` : "\u2014"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-foreground/40 max-w-[120px] truncate">
                      {(r.sector as string) ?? "\u2014"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {results.length === 0 && (
              <div className="py-12 text-center text-sm text-foreground/25">
                No stocks match your filters. Try adjusting the criteria.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

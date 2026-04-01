"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { api, PortfolioHolding } from "@/lib/api";
import { SignalBadge } from "@/components/signal-badge";

const SECTOR_COLORS: Record<string, string> = {
  Banking: "#22d3ee",
  IT: "#a78bfa",
  Energy: "#f59e0b",
  FMCG: "#10b981",
  Auto: "#ef4444",
  Pharma: "#06b6d4",
  Infrastructure: "#8b5cf6",
  Finance: "#3b82f6",
  Metals: "#6b7280",
  Power: "#eab308",
  Telecom: "#ec4899",
  Consumer: "#f97316",
  Cement: "#78716c",
  Mining: "#a3a3a3",
  Healthcare: "#14b8a6",
  Insurance: "#6366f1",
  Retail: "#e879f9",
  Unknown: "#525252",
};

export default function PortfolioPage() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ symbol: "", quantity: "", price: "", date: "", notes: "" });

  const { data: portfolioData, isLoading } = useQuery({
    queryKey: ["portfolio"],
    queryFn: api.getPortfolio,
  });

  const { data: summaryData } = useQuery({
    queryKey: ["portfolio-summary"],
    queryFn: api.getPortfolioSummary,
  });

  const { data: stocksData } = useQuery({
    queryKey: ["stocks"],
    queryFn: api.getStocks,
    staleTime: 60_000,
  });

  const addMutation = useMutation({
    mutationFn: () => api.addPortfolioHolding(form.symbol, parseFloat(form.quantity), parseFloat(form.price), form.date || undefined, form.notes || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-summary"] });
      setShowAdd(false);
      setForm({ symbol: "", quantity: "", price: "", date: "", notes: "" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deletePortfolioHolding(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-summary"] });
    },
  });

  const holdings = portfolioData?.holdings ?? [];
  const summary = summaryData?.summary;
  const sectorExposure = summaryData?.sector_exposure ?? [];
  const allStocks = stocksData?.stocks ?? [];

  const conicGradient = sectorExposure.length > 0
    ? sectorExposure.reduce((acc, s, i) => {
        const prevPct = sectorExposure.slice(0, i).reduce((sum, x) => sum + x.pct, 0);
        const color = SECTOR_COLORS[s.sector] || "#525252";
        return `${acc}${i > 0 ? ", " : ""}${color} ${prevPct}% ${prevPct + s.pct}%`;
      }, "conic-gradient(")
    + ")"
    : "conic-gradient(#333 0% 100%)";

  return (
    <div className="px-6 py-6 relative z-10">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-foreground">Portfolio Tracker</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-cyan/15 text-cyan border border-cyan/30 hover:bg-cyan/25 transition-colors"
        >
          + Add Holding
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 animate-fade-in">
          <div className="glass-card rounded-xl p-4">
            <div className="text-foreground/30 text-[10px] uppercase tracking-wider mb-1">Total Invested</div>
            <div className="font-mono text-lg font-bold">{summary.total_invested.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}</div>
          </div>
          <div className="glass-card rounded-xl p-4">
            <div className="text-foreground/30 text-[10px] uppercase tracking-wider mb-1">Current Value</div>
            <div className="font-mono text-lg font-bold">{summary.current_value.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}</div>
          </div>
          <div className="glass-card rounded-xl p-4">
            <div className="text-foreground/30 text-[10px] uppercase tracking-wider mb-1">Unrealized P&amp;L</div>
            <div className={`font-mono text-lg font-bold ${summary.unrealized_pnl >= 0 ? "text-ngreen" : "text-nred"}`}>
              {summary.unrealized_pnl >= 0 ? "+" : ""}{summary.unrealized_pnl.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}
              <span className="text-xs ml-1">({summary.unrealized_pnl_pct >= 0 ? "+" : ""}{summary.unrealized_pnl_pct}%)</span>
            </div>
          </div>
          <div className="glass-card rounded-xl p-4">
            <div className="text-foreground/30 text-[10px] uppercase tracking-wider mb-1">Day P&amp;L</div>
            <div className={`font-mono text-lg font-bold ${summary.day_pnl >= 0 ? "text-ngreen" : "text-nred"}`}>
              {summary.day_pnl >= 0 ? "+" : ""}{summary.day_pnl.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Holdings Table */}
        <div className="lg:col-span-3">
          <div className="glass-card rounded-xl p-5 animate-fade-in animate-fade-in-d1">
            <h3 className="section-header text-xs text-foreground/40 uppercase tracking-widest mb-3">Holdings</h3>
            {isLoading ? (
              <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="shimmer h-10 rounded" />)}</div>
            ) : holdings.length === 0 ? (
              <div className="text-center py-12 text-foreground/25 text-sm">No holdings yet. Add your first stock above.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-foreground/30 uppercase tracking-wider border-b border-white/[0.06]">
                      <th className="text-left py-2 px-2">Stock</th>
                      <th className="text-right py-2 px-2">Qty</th>
                      <th className="text-right py-2 px-2">Avg Price</th>
                      <th className="text-right py-2 px-2">LTP</th>
                      <th className="text-right py-2 px-2">Invested</th>
                      <th className="text-right py-2 px-2">Current</th>
                      <th className="text-right py-2 px-2">P&amp;L</th>
                      <th className="text-center py-2 px-2">Signal</th>
                      <th className="text-center py-2 px-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {holdings.map((h: PortfolioHolding) => {
                      const warning = (h.signal === "SELL" && h.pnl !== null) || (h.signal === "BUY" && h.pnl !== null && h.pnl < 0);
                      return (
                        <tr key={h.id} className={`border-b border-white/[0.03] hover:bg-white/[0.02] ${warning ? "bg-nred/[0.03]" : ""}`}>
                          <td className="py-2.5 px-2">
                            <Link href={`/stock/${encodeURIComponent(h.symbol)}`} className="text-cyan hover:text-cyan/80 font-medium">
                              {h.name}
                            </Link>
                          </td>
                          <td className="text-right py-2.5 px-2 font-mono">{h.quantity}</td>
                          <td className="text-right py-2.5 px-2 font-mono">{h.purchase_price.toLocaleString("en-IN")}</td>
                          <td className="text-right py-2.5 px-2 font-mono">{h.ltp?.toLocaleString("en-IN") ?? "—"}</td>
                          <td className="text-right py-2.5 px-2 font-mono">{h.invested.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                          <td className="text-right py-2.5 px-2 font-mono">{h.current_value?.toLocaleString("en-IN", { maximumFractionDigits: 0 }) ?? "—"}</td>
                          <td className={`text-right py-2.5 px-2 font-mono font-semibold ${h.pnl !== null && h.pnl >= 0 ? "text-ngreen" : "text-nred"}`}>
                            {h.pnl !== null ? `${h.pnl >= 0 ? "+" : ""}${h.pnl.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—"}
                            {h.pnl_pct !== null && <span className="text-[10px] ml-1">({h.pnl_pct >= 0 ? "+" : ""}{h.pnl_pct}%)</span>}
                          </td>
                          <td className="text-center py-2.5 px-2">
                            {h.signal ? <SignalBadge signal={h.signal} size="sm" /> : "—"}
                          </td>
                          <td className="text-center py-2.5 px-2">
                            <button
                              onClick={() => deleteMutation.mutate(h.id)}
                              className="text-foreground/20 hover:text-nred transition-colors"
                              title="Remove"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" /></svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Sector Exposure */}
        <div className="lg:col-span-1">
          <div className="glass-card rounded-xl p-5 animate-fade-in animate-fade-in-d2">
            <h3 className="section-header text-xs text-foreground/40 uppercase tracking-widest mb-4">Sector Exposure</h3>
            {sectorExposure.length === 0 ? (
              <div className="text-foreground/25 text-xs text-center py-8">No data</div>
            ) : (
              <>
                <div className="w-28 h-28 rounded-full mx-auto mb-4" style={{ background: conicGradient }} />
                <div className="space-y-1.5">
                  {sectorExposure.map(s => (
                    <div key={s.sector} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: SECTOR_COLORS[s.sector] || "#525252" }} />
                        <span>{s.sector}</span>
                      </div>
                      <span className="font-mono text-foreground/50">{s.pct}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Add Holding Modal */}
      {showAdd && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setShowAdd(false)} />
          <div className="fixed top-[20%] left-1/2 -translate-x-1/2 z-50 w-full max-w-md">
            <div className="glass-card rounded-xl p-6" style={{ background: "rgba(12,12,22,0.95)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <h3 className="text-lg font-bold mb-4">Add Holding</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-foreground/40 uppercase tracking-wider block mb-1">Stock</label>
                  <select
                    value={form.symbol}
                    onChange={e => setForm({ ...form, symbol: e.target.value })}
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-cyan/40"
                  >
                    <option value="">Select stock...</option>
                    {allStocks.map(s => (
                      <option key={s.symbol} value={s.symbol}>{s.name} ({s.symbol})</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-foreground/40 uppercase tracking-wider block mb-1">Quantity</label>
                    <input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })}
                      className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-cyan/40" placeholder="10" />
                  </div>
                  <div>
                    <label className="text-xs text-foreground/40 uppercase tracking-wider block mb-1">Purchase Price</label>
                    <input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}
                      className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-cyan/40" placeholder="1500" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-foreground/40 uppercase tracking-wider block mb-1">Purchase Date</label>
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-cyan/40" />
                </div>
                <div>
                  <label className="text-xs text-foreground/40 uppercase tracking-wider block mb-1">Notes</label>
                  <input type="text" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-cyan/40" placeholder="Optional" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowAdd(false)} className="flex-1 py-2 rounded-lg text-sm border border-white/[0.08] text-foreground/40 hover:text-foreground hover:bg-white/[0.04] transition-colors">Cancel</button>
                  <button
                    onClick={() => addMutation.mutate()}
                    disabled={!form.symbol || !form.quantity || !form.price}
                    className="flex-1 py-2 rounded-lg text-sm font-medium bg-cyan/15 text-cyan border border-cyan/30 hover:bg-cyan/25 transition-colors disabled:opacity-30"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

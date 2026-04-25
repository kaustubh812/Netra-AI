"use client";

import { useState, useEffect } from "react";
import { api, TaxHarvestData } from "@/lib/api";
import Link from "next/link";
import { toUrlSymbol } from "@/lib/symbol";

const PRIORITY_STYLE: Record<string, { bg: string; color: string }> = {
  HIGH: { bg: "rgba(244,63,94,0.15)", color: "var(--red-bright)" },
  MEDIUM: { bg: "rgba(245,158,11,0.12)", color: "var(--amber)" },
  LOW: { bg: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" },
};

export default function TaxHarvestPage() {
  const [data, setData] = useState<TaxHarvestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"harvest" | "all">("harvest");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await api.getTaxHarvest();
      setData(res);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen p-6 animate-fade-in">
        <div className="mb-6">
          <h1 className="section-header text-xl font-bold text-foreground/90">Tax Harvesting Optimizer</h1>
          <p className="text-foreground/30 text-sm mt-1 ml-5">Indian capital gains tax analysis</p>
        </div>
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="glass-card rounded-xl h-20 shimmer" />)}</div>
      </div>
    );
  }

  if (!data || !data.available) {
    return (
      <div className="min-h-screen p-6 animate-fade-in">
        <div className="mb-6">
          <h1 className="section-header text-xl font-bold text-foreground/90">Tax Harvesting Optimizer</h1>
        </div>
        <div className="glass-card rounded-2xl p-10 text-center">
          <p className="text-foreground/25 text-sm">{data?.reason || "No portfolio holdings found"}</p>
          <Link href="/portfolio" className="text-cyan/60 text-xs mt-2 block hover:text-cyan transition-colors">
            Add holdings in Portfolio &rarr;
          </Link>
        </div>
      </div>
    );
  }

  const s = data.summary;

  return (
    <div className="min-h-screen p-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="section-header text-xl font-bold text-foreground/90">Tax Harvesting Optimizer</h1>
        <p className="text-foreground/30 text-sm mt-1 ml-5">FY 2024-25 &middot; STCG {s.stcg_rate}% &middot; LTCG {s.ltcg_rate}% (above &#x20B9;1.25L)</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        <SummaryCard label="Total Invested" value={formatINR(s.total_invested)} />
        <SummaryCard label="Current Value" value={formatINR(s.total_current_value)} />
        <SummaryCard label="Unrealized P&L" value={formatINR(s.total_unrealized_pnl)} positive={s.total_unrealized_pnl >= 0} />
        <SummaryCard label="Estimated Tax" value={formatINR(s.estimated_total_tax)} sub={`STCG: ${formatINR(s.estimated_stcg_tax)} + LTCG: ${formatINR(s.estimated_ltcg_tax)}`} />
        <SummaryCard label="Potential Savings" value={formatINR(s.potential_tax_savings)} highlight sub={`${data.harvestable.length} harvestable positions`} />
      </div>

      {/* Exemption Bar */}
      <div className="glass-card rounded-xl p-4 mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-foreground/30 uppercase tracking-wider">LTCG Exemption (&#x20B9;1.25L)</span>
          <span className="text-xs font-mono text-foreground/50">
            &#x20B9;{(s.ltcg_exemption_used / 1000).toFixed(1)}K / &#x20B9;125K used
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(100, (s.ltcg_exemption_used / 125000) * 100)}%`,
              background: s.ltcg_exemption_remaining > 0
                ? "linear-gradient(90deg, rgba(34,211,238,0.5), rgba(34,211,238,0.3))"
                : "linear-gradient(90deg, rgba(244,63,94,0.5), rgba(244,63,94,0.3))",
            }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-foreground/20">ST Gains: {formatINR(s.short_term_gains)} | ST Losses: {formatINR(s.short_term_losses)}</span>
          <span className="text-[10px] text-foreground/20">LT Gains: {formatINR(s.long_term_gains)} | LT Losses: {formatINR(s.long_term_losses)}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(["harvest", "all"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className="text-xs px-4 py-1.5 rounded-lg font-semibold transition-all"
            style={{
              background: tab === t ? "rgba(34,211,238,0.12)" : "rgba(255,255,255,0.02)",
              border: `1px solid ${tab === t ? "rgba(34,211,238,0.3)" : "rgba(255,255,255,0.06)"}`,
              color: tab === t ? "var(--cyan)" : "rgba(255,255,255,0.3)",
            }}>
            {t === "harvest" ? `Harvestable (${data.harvestable.length})` : `All Holdings (${data.holdings.length})`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="w-full premium-table">
          <thead>
            <tr>
              <th className="text-left">Stock</th>
              <th className="text-right">Buy Price</th>
              <th className="text-right">LTP</th>
              <th className="text-right">P&amp;L</th>
              <th className="text-center">Type</th>
              <th className="text-right">Days Held</th>
              {tab === "harvest" && <th className="text-right">Tax Savings</th>}
              {tab === "harvest" && <th className="text-center">Priority</th>}
            </tr>
          </thead>
          <tbody>
            {(tab === "harvest" ? data.harvestable : data.holdings).map((h) => {
              const ps = PRIORITY_STYLE[h.harvest_priority || "LOW"] || PRIORITY_STYLE.LOW;
              return (
                <tr key={h.id}>
                  <td className="py-3 px-4">
                    <Link href={`/stock/${toUrlSymbol(h.symbol)}`} className="hover:text-cyan transition-colors">
                      <span className="font-semibold text-sm text-foreground/80">{h.name}</span>
                    </Link>
                    <span className="text-[10px] text-foreground/20 ml-1.5">&times;{h.quantity}</span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-sm text-foreground/50">&#x20B9;{h.purchase_price.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                  <td className="py-3 px-4 text-right font-mono text-sm text-foreground/70">&#x20B9;{h.ltp.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                  <td className="py-3 px-4 text-right">
                    <span className="font-mono text-sm font-medium" style={{ color: h.unrealized_pnl >= 0 ? "var(--green)" : "var(--red)" }}>
                      {h.unrealized_pnl >= 0 ? "+" : ""}{formatINR(h.unrealized_pnl)}
                    </span>
                    <span className="text-[10px] block" style={{ color: h.unrealized_pnl >= 0 ? "var(--green)" : "var(--red)", opacity: 0.6 }}>
                      {h.unrealized_pnl_pct >= 0 ? "+" : ""}{h.unrealized_pnl_pct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{
                      background: h.classification === "LTCG" ? "rgba(34,211,238,0.1)" : "rgba(167,139,250,0.1)",
                      color: h.classification === "LTCG" ? "var(--cyan)" : "rgba(167,139,250,0.7)",
                    }}>{h.classification}</span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-sm text-foreground/40">{h.days_held}d</td>
                  {tab === "harvest" && (
                    <td className="py-3 px-4 text-right font-mono text-sm" style={{ color: "var(--green)" }}>
                      &#x20B9;{(h.potential_tax_savings || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </td>
                  )}
                  {tab === "harvest" && (
                    <td className="py-3 px-4 text-center">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: ps.bg, color: ps.color }}>
                        {h.harvest_priority}
                      </span>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {(tab === "harvest" ? data.harvestable : data.holdings).length === 0 && (
          <div className="p-8 text-center"><p className="text-foreground/20 text-sm">{tab === "harvest" ? "No harvestable losses found" : "No holdings"}</p></div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, sub, positive, highlight }: {
  label: string; value: string; sub?: string; positive?: boolean; highlight?: boolean;
}) {
  return (
    <div className="glass-card rounded-xl p-3.5" style={highlight ? { border: "1px solid rgba(16,185,129,0.2)" } : undefined}>
      <p className="text-[10px] text-foreground/30 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-lg font-bold font-mono" style={{
        color: positive === true ? "var(--green)" : positive === false ? "var(--red)" : highlight ? "var(--green-bright)" : "var(--foreground)",
        opacity: highlight ? 1 : 0.8,
      }}>{value}</p>
      {sub && <p className="text-[10px] text-foreground/20 mt-0.5">{sub}</p>}
    </div>
  );
}

function formatINR(val: number): string {
  if (Math.abs(val) >= 10000000) return `\u20B9${(val / 10000000).toFixed(2)}Cr`;
  if (Math.abs(val) >= 100000) return `\u20B9${(val / 100000).toFixed(2)}L`;
  if (Math.abs(val) >= 1000) return `\u20B9${(val / 1000).toFixed(1)}K`;
  return `\u20B9${val.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const PILL_ACTIVE = "bg-cyan/20 text-cyan border-cyan/40";
const PILL_INACTIVE = "bg-white/[0.03] text-foreground/40 border-white/[0.08] hover:bg-white/[0.06]";

const IMPORTANCE_STYLES = {
  high: "bg-nred/15 text-nred border-nred/20",
  medium: "bg-amber/15 text-amber border-amber/20",
  low: "bg-white/[0.06] text-foreground/40 border-white/[0.08]",
} as const;

const CATEGORY_COLORS: Record<string, string> = {
  central_bank: "text-purple",
  inflation: "text-nred",
  pmi: "text-cyan",
  gdp: "text-ngreen",
  employment: "text-amber",
  production: "text-foreground/50",
  trade: "text-foreground/50",
};

type Tab = "economic" | "earnings";

function isUpcoming(dateStr: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return dateStr >= today;
}

function isThisWeek(dateStr: string): boolean {
  const today = new Date();
  const date = new Date(dateStr);
  const diff = (date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  return diff >= -1 && diff <= 7;
}

export default function CalendarPage() {
  const [tab, setTab] = useState<Tab>("economic");
  const [showPast, setShowPast] = useState(false);
  const [importanceFilter, setImportanceFilter] = useState<string>("");

  const { data: ecoData, isLoading: ecoLoading } = useQuery({
    queryKey: ["calendar-economic"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/calendar/economic`);
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  const { data: earningsData, isLoading: earningsLoading } = useQuery({
    queryKey: ["calendar-earnings"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/calendar/earnings`);
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  const ecoEvents = (ecoData?.events ?? [])
    .filter((e: { date: string; importance: string }) => {
      if (!showPast && !isUpcoming(e.date)) return false;
      if (importanceFilter && e.importance !== importanceFilter) return false;
      return true;
    });

  const earningsEvents = (earningsData?.earnings ?? [])
    .filter((e: { earnings_date: string }) => showPast || isUpcoming(e.earnings_date));

  return (
    <div className="px-6 py-6 relative z-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="section-header text-xs font-medium text-foreground/40 uppercase tracking-widest mb-1">
            Calendar
          </h1>
          <p className="text-foreground/20 text-xs">
            {tab === "economic" ? "Economic events & data releases" : "NIFTY 50 earnings dates"}
          </p>
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => setTab("economic")} className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all ${tab === "economic" ? PILL_ACTIVE : PILL_INACTIVE}`}>
            Economic
          </button>
          <button onClick={() => setTab("earnings")} className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all ${tab === "earnings" ? PILL_ACTIVE : PILL_INACTIVE}`}>
            Earnings
          </button>
        </div>
      </div>

      {tab === "economic" ? (
        <>
          {/* Filters */}
          <div className="flex items-center gap-3 mb-4">
            <label className="flex items-center gap-1.5 text-xs text-foreground/30 cursor-pointer">
              <input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} className="accent-cyan" />
              Show past events
            </label>
            <select
              value={importanceFilter}
              onChange={(e) => setImportanceFilter(e.target.value)}
              className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1 text-xs text-foreground outline-none"
            >
              <option value="">All importance</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
            </select>
          </div>

          {/* Economic Events Table */}
          <div className="glass-card rounded-xl overflow-hidden animate-fade-in">
            {ecoLoading ? (
              <div className="p-8 text-center"><div className="shimmer h-4 w-40 rounded mx-auto" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-white/[0.06] bg-white/[0.02]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-foreground/40">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-foreground/40">Event</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-foreground/40">Country</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-foreground/40">Importance</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-foreground/40">Previous</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-foreground/40">Forecast</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-foreground/40">Actual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    {ecoEvents.map((ev: Record<string, unknown>, i: number) => (
                      <tr key={i} className={`transition-colors ${isThisWeek(ev.date as string) ? "bg-cyan/[0.03]" : "hover:bg-white/[0.02]"}`}>
                        <td className="px-4 py-2.5 font-mono text-xs text-foreground/50 whitespace-nowrap">
                          {ev.date as string}
                          {isThisWeek(ev.date as string) && (
                            <span className="ml-1.5 text-[9px] bg-cyan/15 text-cyan px-1 py-0.5 rounded">THIS WEEK</span>
                          )}
                        </td>
                        <td className={`px-4 py-2.5 text-sm font-medium ${CATEGORY_COLORS[(ev.category as string) ?? ""] ?? "text-foreground/60"}`}>
                          {ev.event as string}
                        </td>
                        <td className="px-4 py-2.5 text-xs">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${ev.country === "IN" ? "bg-amber/10 text-amber" : "bg-white/[0.05] text-foreground/30"}`}>
                            {ev.country as string}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${IMPORTANCE_STYLES[(ev.importance as string) as keyof typeof IMPORTANCE_STYLES] ?? IMPORTANCE_STYLES.low}`}>
                            {(ev.importance as string)?.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-foreground/40">{(ev.previous as string) ?? "\u2014"}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-foreground/40">{(ev.forecast as string) ?? "\u2014"}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-foreground/40">{(ev.actual as string) ?? "\u2014"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {ecoEvents.length === 0 && (
                  <div className="py-12 text-center text-sm text-foreground/25">No events match your filters.</div>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        /* Earnings Tab */
        <div className="glass-card rounded-xl overflow-hidden animate-fade-in">
          {earningsLoading ? (
            <div className="p-8 text-center"><div className="shimmer h-4 w-40 rounded mx-auto" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-white/[0.06] bg-white/[0.02]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-foreground/40">Stock</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-foreground/40">Earnings Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-foreground/40">EPS Estimate</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-foreground/40">EPS Actual</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-foreground/40">Revenue Est.</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-foreground/40">Revenue Actual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {earningsEvents.map((ev: Record<string, unknown>, i: number) => (
                    <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-2.5">
                        <Link href={`/stock/${encodeURIComponent(ev.symbol as string)}`} className="text-cyan hover:underline font-medium text-sm">
                          {ev.name as string}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-foreground/50">
                        {ev.earnings_date as string}
                        {isThisWeek(ev.earnings_date as string) && (
                          <span className="ml-1.5 text-[9px] bg-amber/15 text-amber px-1 py-0.5 rounded">SOON</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-foreground/50">
                        {ev.eps_estimate != null ? (ev.eps_estimate as number).toFixed(2) : "\u2014"}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-foreground/50">
                        {ev.eps_actual != null ? (ev.eps_actual as number).toFixed(2) : "\u2014"}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-foreground/50">
                        {ev.revenue_estimate != null ? `${((ev.revenue_estimate as number) / 1e7).toFixed(0)}Cr` : "\u2014"}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-foreground/50">
                        {ev.revenue_actual != null ? `${((ev.revenue_actual as number) / 1e7).toFixed(0)}Cr` : "\u2014"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {earningsEvents.length === 0 && (
                <div className="py-12 text-center text-sm text-foreground/25">
                  No upcoming earnings data available. Data loads from yfinance.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

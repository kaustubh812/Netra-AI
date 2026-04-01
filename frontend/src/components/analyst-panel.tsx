"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

const REC_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  strong_buy:  { bg: "bg-ngreen/20 border-ngreen/40", text: "text-ngreen", label: "Strong Buy" },
  buy:         { bg: "bg-ngreen/15 border-ngreen/30", text: "text-ngreen", label: "Buy" },
  hold:        { bg: "bg-amber/15 border-amber/30", text: "text-amber", label: "Hold" },
  sell:        { bg: "bg-nred/15 border-nred/30", text: "text-nred", label: "Sell" },
  strong_sell: { bg: "bg-nred/20 border-nred/40", text: "text-nred", label: "Strong Sell" },
  underperform:{ bg: "bg-nred/15 border-nred/30", text: "text-nred", label: "Underperform" },
  outperform:  { bg: "bg-ngreen/15 border-ngreen/30", text: "text-ngreen", label: "Outperform" },
};

export function AnalystPanel({ symbol }: { symbol: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["analyst", symbol],
    queryFn: () => api.getAnalystEstimates(symbol),
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <div className="glass-card rounded-xl p-5">
        <div className="shimmer h-4 w-32 rounded mb-3" />
        <div className="shimmer h-20 rounded" />
      </div>
    );
  }

  if (!data || !data.available) {
    return null;
  }

  const rec = data.recommendation?.toLowerCase().replace(/[\s-]+/g, "_") || "hold";
  const style = REC_STYLES[rec] || REC_STYLES.hold;

  const currentPrice = data.current_price || 0;
  const low = data.target_low || currentPrice;
  const high = data.target_high || currentPrice;
  const mean = data.target_mean || currentPrice;
  const range = high - low || 1;

  const currentPct = Math.max(0, Math.min(100, ((currentPrice - low) / range) * 100));
  const meanPct = Math.max(0, Math.min(100, ((mean - low) / range) * 100));

  return (
    <div className="glass-card rounded-xl p-5 animate-fade-in">
      <h3 className="section-header text-xs text-foreground/40 uppercase tracking-widest mb-3">Analyst Estimates</h3>

      <div className="flex items-center gap-3 mb-4">
        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${style.bg} ${style.text}`}>
          {style.label}
        </span>
        {data.num_analysts && (
          <span className="text-foreground/30 text-xs">{data.num_analysts} analyst{data.num_analysts > 1 ? "s" : ""}</span>
        )}
        {data.upside_pct !== null && (
          <span className={`ml-auto font-mono text-sm font-bold ${data.upside_pct >= 0 ? "text-ngreen" : "text-nred"}`}>
            {data.upside_pct >= 0 ? "+" : ""}{data.upside_pct}% upside
          </span>
        )}
      </div>

      {/* Price Target Bar */}
      <div className="mb-3">
        <div className="flex justify-between text-[10px] text-foreground/30 mb-1">
          <span>Low: {low.toLocaleString("en-IN")}</span>
          <span>Mean: {mean.toLocaleString("en-IN")}</span>
          <span>High: {high.toLocaleString("en-IN")}</span>
        </div>
        <div className="relative h-3 bg-white/[0.04] rounded-full overflow-hidden">
          {/* Gradient fill from low to high */}
          <div className="absolute inset-0 rounded-full" style={{ background: "linear-gradient(to right, #f43f5e, #facc15, #10b981)" }} />
          {/* Mean marker */}
          <div className="absolute top-0 h-full w-0.5 bg-foreground" style={{ left: `${meanPct}%` }} />
          {/* Current price marker */}
          <div
            className="absolute -top-0.5 w-3 h-4 rounded-sm bg-cyan border border-cyan/50"
            style={{ left: `calc(${currentPct}% - 6px)` }}
            title={`Current: ${currentPrice.toLocaleString("en-IN")}`}
          />
        </div>
        <div className="flex justify-between text-[10px] mt-1">
          <span className="text-nred/60">Target Low</span>
          <span className="text-cyan text-[10px] font-mono">Current: {currentPrice.toLocaleString("en-IN")}</span>
          <span className="text-ngreen/60">Target High</span>
        </div>
      </div>

      {data.recommendation_mean !== null && data.recommendation_mean !== undefined && (
        <div className="text-foreground/25 text-[10px] mt-2">
          Recommendation score: {data.recommendation_mean.toFixed(1)} (1=Strong Buy, 5=Strong Sell)
        </div>
      )}
    </div>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { api, AnomalyData } from "@/lib/api";
import Link from "next/link";
import { toUrlSymbol } from "@/lib/symbol";

const TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  volume_spike: { icon: "\u{1F4CA}", color: "var(--cyan)" },
  price_surge: { icon: "\u{1F4C8}", color: "var(--green-bright)" },
  price_drop: { icon: "\u{1F4C9}", color: "var(--red-bright)" },
  rsi_extreme_high: { icon: "\u26A0\uFE0F", color: "var(--amber)" },
  rsi_extreme_low: { icon: "\u26A0\uFE0F", color: "var(--amber)" },
  breakout_high: { icon: "\u{1F680}", color: "var(--green-bright)" },
  breakdown_low: { icon: "\u{1F534}", color: "var(--red-bright)" },
};

const TYPE_LABELS: Record<string, string> = {
  volume_spike: "Volume Spike",
  price_surge: "Price Surge",
  price_drop: "Price Drop",
  rsi_extreme_high: "RSI Overbought",
  rsi_extreme_low: "RSI Oversold",
  breakout_high: "52W High",
  breakdown_low: "52W Low",
};

export function AnomalyFeed() {
  const { data, isLoading } = useQuery<AnomalyData>({
    queryKey: ["anomalies"],
    queryFn: api.getAnomalies,
    refetchInterval: 10 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="glass-card rounded-2xl p-5">
        <div className="h-4 w-32 shimmer rounded mb-3" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 shimmer rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.count === 0) return null;

  const top = data.anomalies.slice(0, 6);

  return (
    <div className="glass-card rounded-2xl overflow-hidden animate-fade-in">
      <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{ background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.2)" }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-foreground/70">Unusual Activity</span>
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded"
            style={{ background: "rgba(244,63,94,0.15)", color: "var(--red)" }}
          >
            {data.count}
          </span>
        </div>
      </div>

      <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.03)" }}>
        {top.map((a, i) => {
          const cfg = TYPE_CONFIG[a.type] || { icon: "\u26A1", color: "var(--cyan)" };
          return (
            <Link
              key={`${a.symbol}-${a.type}-${i}`}
              href={`/stock/${toUrlSymbol(a.symbol)}`}
              className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors"
            >
              {/* Severity dots */}
              <div className="flex gap-0.5 shrink-0">
                {Array.from({ length: 5 }).map((_, j) => (
                  <div
                    key={j}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      background: j < a.severity ? cfg.color : "rgba(255,255,255,0.06)",
                      boxShadow: j < a.severity ? `0 0 4px ${cfg.color}` : "none",
                    }}
                  />
                ))}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground/80">{a.name}</span>
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: `color-mix(in srgb, ${cfg.color} 15%, transparent)`, color: cfg.color }}
                  >
                    {TYPE_LABELS[a.type] || a.type}
                  </span>
                </div>
                <p className="text-[11px] text-foreground/35 mt-0.5 truncate">{a.detail}</p>
              </div>

              {/* Price + Change */}
              <div className="text-right shrink-0">
                <p className="text-xs font-mono text-foreground/60">{"\u20B9"}{a.price.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p>
                <p
                  className="text-[10px] font-mono font-semibold"
                  style={{ color: a.change_pct >= 0 ? "var(--green)" : "var(--red)" }}
                >
                  {a.change_pct >= 0 ? "+" : ""}{a.change_pct.toFixed(2)}%
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

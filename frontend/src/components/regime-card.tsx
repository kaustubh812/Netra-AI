"use client";

import { useQuery } from "@tanstack/react-query";
import { api, RegimeInfo } from "@/lib/api";

const REGIME_STYLES: Record<string, { bg: string; text: string; label: string; icon: string }> = {
  trending_up: { bg: "bg-ngreen/15", text: "text-ngreen", label: "Trending Up", icon: "\uD83D\uDCC8" },
  trending_down: { bg: "bg-nred/15", text: "text-nred", label: "Trending Down", icon: "\uD83D\uDCC9" },
  ranging: { bg: "bg-amber/15", text: "text-amber", label: "Ranging", icon: "\u2194\uFE0F" },
  volatile: { bg: "bg-cyan/15", text: "text-cyan", label: "Volatile", icon: "\u26A1" },
};

export function RegimeCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["regime"],
    queryFn: api.getRegime,
    refetchInterval: 5 * 60 * 1000,
  });

  if (isLoading || !data) {
    return (
      <div className="glass-card rounded-xl p-5">
        <div className="shimmer h-4 rounded w-24 mb-3" />
        <div className="shimmer h-8 rounded w-32" />
      </div>
    );
  }

  const style = REGIME_STYLES[data.regime] || REGIME_STYLES.ranging;

  return (
    <div className="glass-card rounded-xl p-5 animate-fade-in">
      <h3 className="section-header text-xs text-foreground/40 uppercase tracking-widest mb-3">Market Regime</h3>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{style.icon}</span>
        <div>
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${style.bg} ${style.text}`}>
            {style.label}
          </span>
          <div className="text-xs text-foreground/35 mt-1 ml-0.5">
            {(data.confidence * 100).toFixed(0)}% confidence
          </div>
        </div>
      </div>
      {data.metrics && (
        <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-white/[0.04]">
          <div>
            <div className="text-foreground/30 text-[10px] mb-0.5">ADX</div>
            <span className="font-mono text-sm">{data.metrics.adx?.toFixed(1)}</span>
          </div>
          <div>
            <div className="text-foreground/30 text-[10px] mb-0.5">Slope</div>
            <span className={`font-mono text-sm ${(data.metrics.slope_pct ?? 0) > 0 ? "text-ngreen" : "text-nred"}`}>
              {(data.metrics.slope_pct ?? 0) > 0 ? "+" : ""}{data.metrics.slope_pct?.toFixed(2)}%
            </span>
          </div>
          <div>
            <div className="text-foreground/30 text-[10px] mb-0.5">ATR</div>
            <span className="font-mono text-sm">{data.metrics.atr_ratio?.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

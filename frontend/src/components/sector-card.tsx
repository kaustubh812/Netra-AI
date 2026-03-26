"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, SectorsOverview } from "@/lib/api";

export function SectorRotationCard() {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["sectors"],
    queryFn: api.getSectors,
    refetchInterval: 5 * 60 * 1000,
  });

  if (isLoading || !data) {
    return (
      <div className="glass-card rounded-xl p-5">
        <div className="shimmer h-4 rounded w-32 mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="shimmer h-5 rounded" />
          ))}
        </div>
      </div>
    );
  }

  const sorted = Object.entries(data.sectors).sort(
    ([, a], [, b]) => a.rank - b.rank
  );

  const totalSectors = sorted.length;
  const visible = expanded ? sorted : sorted.slice(0, 8);
  const maxReturn = Math.max(...sorted.map(([, s]) => Math.abs(s.avg_return)));

  return (
    <div className="glass-card rounded-xl p-5 animate-fade-in animate-fade-in-d2">
      <h3 className="section-header text-xs text-foreground/40 uppercase tracking-widest mb-3">Sector Momentum (20D)</h3>
      <div className="space-y-1.5">
        {visible.map(([sector, score]) => {
          const isPositive = score.avg_return > 0;
          const isTop3 = score.rank <= 3;
          const isBottom3 = score.rank > totalSectors - 3;
          const barWidth = maxReturn > 0 ? (Math.abs(score.avg_return) / maxReturn) * 100 : 0;

          return (
            <div key={sector} className="flex items-center justify-between text-xs py-0.5">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span className={`font-mono w-5 text-right flex-shrink-0 ${isTop3 ? "text-ngreen" : isBottom3 ? "text-nred" : "text-foreground/25"}`}>
                  #{score.rank}
                </span>
                <span className={`truncate ${isTop3 ? "text-ngreen/90 font-medium" : isBottom3 ? "text-nred/90 font-medium" : ""}`}>
                  {sector}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <div className="w-10 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${isPositive ? "bg-ngreen/60" : "bg-nred/60"}`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <span className={`font-mono w-12 text-right ${isPositive ? "text-ngreen" : "text-nred"}`}>
                  {isPositive ? "+" : ""}{score.avg_return.toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {sorted.length > 8 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] text-foreground/30 hover:text-cyan mt-2 font-mono transition-colors"
        >
          {expanded ? "Show less" : `+${sorted.length - 8} more sectors`}
        </button>
      )}
    </div>
  );
}

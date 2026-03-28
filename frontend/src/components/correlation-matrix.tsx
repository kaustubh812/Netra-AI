"use client";

import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const PILL_ACTIVE = "bg-cyan/20 text-cyan border-cyan/40";
const PILL_INACTIVE = "bg-white/[0.03] text-foreground/40 border-white/[0.08] hover:bg-white/[0.06]";

function corrColor(val: number): string {
  if (val >= 0.7) return "rgba(0,200,83,0.5)";
  if (val >= 0.4) return "rgba(0,200,83,0.25)";
  if (val >= 0.1) return "rgba(0,200,83,0.1)";
  if (val >= -0.1) return "rgba(255,255,255,0.03)";
  if (val >= -0.4) return "rgba(255,23,68,0.1)";
  if (val >= -0.7) return "rgba(255,23,68,0.25)";
  return "rgba(255,23,68,0.5)";
}

export function CorrelationMatrix() {
  const [lookback, setLookback] = useState(60);
  const [hoveredCell, setHoveredCell] = useState<{ i: number; j: number } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["correlation", lookback],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/correlation?lookback=${lookback}`);
      return res.json();
    },
    staleTime: 30 * 60 * 1000,
  });

  const symbols: string[] = data?.symbols ?? [];
  const matrix: number[][] = data?.matrix ?? [];
  const topCorr = data?.top_correlated ?? [];
  const leastCorr = data?.least_correlated ?? [];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Lookback selector */}
      <div className="flex gap-1.5">
        {[30, 60, 90].map((d) => (
          <button
            key={d}
            onClick={() => setLookback(d)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${lookback === d ? PILL_ACTIVE : PILL_INACTIVE}`}
          >
            {d}D
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="glass-card rounded-xl p-8"><div className="shimmer h-64 rounded-lg" /></div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* Heatmap */}
          <div className="xl:col-span-2 glass-card rounded-xl p-3 overflow-auto">
            <div className="text-xs text-foreground/30 mb-2">{symbols.length} stocks &middot; {lookback}-day returns</div>
            {hoveredCell && (
              <div className="text-xs text-foreground/50 mb-2 font-mono">
                {symbols[hoveredCell.i]} &harr; {symbols[hoveredCell.j]}: {matrix[hoveredCell.i]?.[hoveredCell.j]?.toFixed(3)}
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: `40px repeat(${symbols.length}, 1fr)`, gap: 1, fontSize: 8 }}>
              {/* Header row */}
              <div />
              {symbols.map((s, i) => (
                <div key={`h-${i}`} className="text-foreground/20 text-center truncate px-0.5" style={{ writingMode: "vertical-lr", height: 50 }}>
                  {s}
                </div>
              ))}

              {/* Data rows */}
              {symbols.map((s1, i) => (
                <Fragment key={`row-${i}`}>
                  <div className="text-foreground/30 text-right pr-1 flex items-center justify-end truncate">
                    {s1}
                  </div>
                  {symbols.map((s2, j) => {
                    const val = matrix[i]?.[j] ?? 0;
                    return (
                      <div
                        key={`${i}-${j}`}
                        onMouseEnter={() => setHoveredCell({ i, j })}
                        onMouseLeave={() => setHoveredCell(null)}
                        className="aspect-square rounded-sm cursor-crosshair transition-opacity"
                        style={{
                          backgroundColor: i === j ? "rgba(0,229,255,0.15)" : corrColor(val),
                          opacity: hoveredCell && (hoveredCell.i === i || hoveredCell.j === j) ? 1 : hoveredCell ? 0.5 : 1,
                        }}
                        title={`${s1} vs ${s2}: ${val.toFixed(3)}`}
                      />
                    );
                  })}
                </Fragment>
              ))}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-2 mt-3 text-[10px] text-foreground/25">
              <span>-1.0</span>
              <div className="flex-1 h-2 rounded" style={{ background: "linear-gradient(90deg, rgba(255,23,68,0.5), rgba(255,255,255,0.03), rgba(0,200,83,0.5))" }} />
              <span>+1.0</span>
            </div>
          </div>

          {/* Top/Least correlated pairs */}
          <div className="space-y-4">
            <div className="glass-card rounded-xl p-4">
              <h3 className="text-xs font-medium text-foreground/40 uppercase tracking-wider mb-3">Most Correlated</h3>
              <div className="space-y-2">
                {topCorr.slice(0, 8).map((p: { stock1: string; stock2: string; correlation: number }, i: number) => (
                  <div key={i} className="flex items-center justify-between py-1 text-xs">
                    <span className="text-foreground/50 font-mono">{p.stock1} &harr; {p.stock2}</span>
                    <span className="font-mono text-ngreen">{p.correlation.toFixed(3)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="glass-card rounded-xl p-4">
              <h3 className="text-xs font-medium text-foreground/40 uppercase tracking-wider mb-3">Least Correlated</h3>
              <div className="space-y-2">
                {leastCorr.slice(0, 8).map((p: { stock1: string; stock2: string; correlation: number }, i: number) => (
                  <div key={i} className="flex items-center justify-between py-1 text-xs">
                    <span className="text-foreground/50 font-mono">{p.stock1} &harr; {p.stock2}</span>
                    <span className="font-mono text-amber">{p.correlation.toFixed(3)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

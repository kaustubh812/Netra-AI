"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api, StockInfo } from "@/lib/api";
import { toUrlSymbol } from "@/lib/symbol";

type ColorMode = "change" | "signal" | "composite" | "strength";

const COLOR_MODE_LABELS: Record<ColorMode, string> = {
  change: "Daily Change %",
  signal: "Signal (BUY/SELL/HOLD)",
  composite: "Composite Score",
  strength: "Signal Strength",
};

const PILL_ACTIVE = "bg-cyan/20 text-cyan border-cyan/40";
const PILL_INACTIVE = "bg-white/[0.03] text-foreground/40 border-white/[0.08] hover:bg-white/[0.06]";

function getColorForMode(stock: StockInfo, mode: ColorMode): string {
  switch (mode) {
    case "change": {
      const pct = stock.change_pct ?? 0;
      if (pct > 3) return "rgba(16,185,129,0.6)";
      if (pct > 1.5) return "rgba(16,185,129,0.4)";
      if (pct > 0) return "rgba(16,185,129,0.2)";
      if (pct > -1.5) return "rgba(244,63,94,0.2)";
      if (pct > -3) return "rgba(244,63,94,0.4)";
      return "rgba(244,63,94,0.6)";
    }
    case "signal": {
      if (stock.signal === "BUY") return "rgba(16,185,129,0.35)";
      if (stock.signal === "SELL") return "rgba(244,63,94,0.35)";
      return "rgba(255,255,255,0.05)";
    }
    case "composite": {
      const score = stock.composite_score ?? 0.5;
      if (score > 0.7) return "rgba(16,185,129,0.5)";
      if (score > 0.6) return "rgba(16,185,129,0.25)";
      if (score > 0.4) return "rgba(255,171,0,0.2)";
      if (score > 0.3) return "rgba(244,63,94,0.25)";
      return "rgba(244,63,94,0.5)";
    }
    case "strength": {
      const conf = stock.confidence ?? 0;
      const alpha = Math.min(0.7, 0.1 + (conf / 100) * 0.6);
      if (stock.signal === "BUY") return `rgba(16,185,129,${alpha})`;
      if (stock.signal === "SELL") return `rgba(244,63,94,${alpha})`;
      return `rgba(255,171,0,${alpha * 0.5})`;
    }
  }
}

function getTextColor(stock: StockInfo, mode: ColorMode): string {
  switch (mode) {
    case "change":
      return (stock.change_pct ?? 0) >= 0 ? "rgba(16,185,129,0.9)" : "rgba(244,63,94,0.9)";
    case "signal":
      if (stock.signal === "BUY") return "rgba(16,185,129,0.9)";
      if (stock.signal === "SELL") return "rgba(244,63,94,0.9)";
      return "rgba(255,255,255,0.4)";
    default:
      return "rgba(255,255,255,0.7)";
  }
}

export default function HeatmapPage() {
  const router = useRouter();
  const [colorMode, setColorMode] = useState<ColorMode>("change");
  const [hoveredStock, setHoveredStock] = useState<StockInfo | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["stocks"],
    queryFn: api.getStocks,
    refetchInterval: 30 * 1000,
  });

  const stocks = data?.stocks ?? [];

  // Sort by signal strength for layout (larger = more important)
  const sorted = [...stocks].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));

  return (
    <div className="px-6 py-6 relative z-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="section-header text-xs font-medium text-foreground/40 uppercase tracking-widest mb-1">
            Market Heatmap
          </h1>
          <p className="text-foreground/20 text-xs">NIFTY 50 stocks &middot; {COLOR_MODE_LABELS[colorMode]}</p>
        </div>
        <div className="flex gap-1.5">
          {(Object.keys(COLOR_MODE_LABELS) as ColorMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setColorMode(mode)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${colorMode === mode ? PILL_ACTIVE : PILL_INACTIVE}`}
            >
              {mode === "change" ? "Change %" : mode === "signal" ? "Signal" : mode === "composite" ? "Score" : "Strength"}
            </button>
          ))}
        </div>
      </div>

      {/* Tooltip */}
      {hoveredStock && (
        <div className="fixed z-50 pointer-events-none" style={{ top: 80, right: 24 }}>
          <div className="glass-card rounded-lg p-3 text-xs space-y-1" style={{ minWidth: 180 }}>
            <div className="font-semibold text-foreground/80">{hoveredStock.name}</div>
            <div className="text-foreground/50 font-mono">
              LTP: {hoveredStock.ltp?.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </div>
            <div className={`font-mono ${(hoveredStock.change_pct ?? 0) >= 0 ? "text-ngreen" : "text-nred"}`}>
              {(hoveredStock.change_pct ?? 0) >= 0 ? "+" : ""}{hoveredStock.change_pct?.toFixed(2)}%
            </div>
            <div className="text-foreground/40">
              Signal: <span className={hoveredStock.signal === "BUY" ? "text-ngreen" : hoveredStock.signal === "SELL" ? "text-nred" : "text-amber"}>
                {hoveredStock.signal ?? "—"}
              </span>
              {hoveredStock.confidence !== undefined && ` (${hoveredStock.confidence.toFixed(0)}%)`}
            </div>
          </div>
        </div>
      )}

      {/* Heatmap Grid */}
      {isLoading ? (
        <div className="glass-card rounded-xl p-8">
          <div className="shimmer h-96 rounded-lg" />
        </div>
      ) : (
        <div className="glass-card rounded-xl p-4 animate-fade-in">
          <div className="grid grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-1">
            {sorted.map((stock) => (
              <button
                key={stock.symbol}
                onClick={() => router.push(`/stock/${toUrlSymbol(stock.symbol)}`)}
                onMouseEnter={() => setHoveredStock(stock)}
                onMouseLeave={() => setHoveredStock(null)}
                className="relative rounded-lg p-2 transition-all hover:scale-105 hover:z-10 cursor-pointer"
                style={{
                  backgroundColor: getColorForMode(stock, colorMode),
                  border: "1px solid rgba(255,255,255,0.04)",
                  minHeight: 70,
                }}
              >
                <div className="text-[11px] font-bold truncate" style={{ color: getTextColor(stock, colorMode) }}>
                  {stock.name}
                </div>
                <div className="text-[10px] font-mono mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {stock.ltp?.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </div>
                <div
                  className="text-[10px] font-mono mt-0.5"
                  style={{
                    color: (stock.change_pct ?? 0) >= 0 ? "rgba(16,185,129,0.8)" : "rgba(244,63,94,0.8)",
                  }}
                >
                  {(stock.change_pct ?? 0) >= 0 ? "+" : ""}{stock.change_pct?.toFixed(1)}%
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

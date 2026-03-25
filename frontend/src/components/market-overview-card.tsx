"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

function IndexCard({ label, data, live }: { label: string; data?: { value: number; change?: number; change_pct?: number; live?: boolean }; live?: boolean }) {
  if (!data) return null;
  const isPositive = (data.change_pct ?? 0) >= 0;

  return (
    <div className="bg-surface-2 rounded-lg p-4 border border-border">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-foreground/50 text-xs font-medium">{label}</span>
        {data.live && (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-ngreen animate-pulse" />
            <span className="text-ngreen text-[10px] font-mono">LIVE</span>
          </span>
        )}
      </div>
      <div className="font-mono text-xl font-bold">{data.value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div>
      {data.change_pct !== undefined && (
        <div className={`font-mono text-sm mt-1 ${isPositive ? "text-ngreen" : "text-nred"}`}>
          {isPositive ? "+" : ""}{data.change?.toFixed(2)} ({isPositive ? "+" : ""}{data.change_pct.toFixed(2)}%)
        </div>
      )}
    </div>
  );
}

const SENTIMENT_STYLES = {
  bullish: {
    border: "border-ngreen/30",
    badge: "bg-ngreen/15 text-ngreen border-ngreen/25",
    dot: "bg-ngreen",
  },
  bearish: {
    border: "border-nred/30",
    badge: "bg-nred/15 text-nred border-nred/25",
    dot: "bg-nred",
  },
  neutral: {
    border: "border-amber/30",
    badge: "bg-amber/15 text-amber border-amber/25",
    dot: "bg-amber",
  },
} as const;

function PcrCard({ sentiment }: { sentiment?: { pcr?: number | null; pcr_interpretation?: string; available: boolean; vix?: number; vix_change?: number } }) {
  const pcr = sentiment?.pcr ?? 0;
  const mood = pcr > 1.0 ? "bullish" : pcr < 0.7 ? "bearish" : "neutral";
  const label = mood === "bullish" ? "Bullish" : mood === "bearish" ? "Bearish" : "Neutral";
  const styles = SENTIMENT_STYLES[mood];

  // Strip the leading label from interpretation to avoid duplication
  const detail = sentiment?.pcr_interpretation
    ?.replace(/^(Bullish|Bearish|Neutral|Slightly Bearish)\s*/i, "")
    .replace(/^\(/, "")
    .replace(/\)$/, "") ?? "";

  return (
    <div className={`bg-surface-2 rounded-lg p-4 flex flex-col border ${sentiment?.available ? styles.border : "border-border"}`}>
      <div className="text-foreground/50 text-xs font-medium mb-1">PUT-CALL RATIO</div>
      {sentiment?.available ? (
        <>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-xl font-bold">{sentiment.pcr?.toFixed(4) ?? "N/A"}</span>
            {sentiment.vix != null && (
              <span className={`font-mono text-xs ${sentiment.vix > 20 ? "text-nred" : sentiment.vix < 13 ? "text-ngreen" : "text-amber"}`}>
                VIX {sentiment.vix}
              </span>
            )}
          </div>
          <div className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold w-fit border ${styles.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
            {label}
          </div>
        </>
      ) : (
        <div className="text-foreground/40 text-sm mt-1">Data unavailable</div>
      )}
    </div>
  );
}

export function MarketOverviewCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["market-overview"],
    queryFn: api.getMarketOverview,
    refetchInterval: 30 * 1000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-surface-2 rounded-lg p-4 border border-border animate-pulse h-24" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="mb-6">
      {/* Live status bar */}
      <div className="flex items-center gap-2 mb-3">
        {data.market_open ? (
          <span className="flex items-center gap-1.5 text-xs">
            <span className="w-2 h-2 rounded-full bg-ngreen animate-pulse" />
            <span className="text-ngreen font-medium font-mono">MARKET OPEN</span>
            <span className="text-foreground/30">— Prices update every 30s</span>
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs">
            <span className="w-2 h-2 rounded-full bg-nred" />
            <span className="text-nred font-medium font-mono">MARKET CLOSED</span>
            <span className="text-foreground/30">— Showing last close prices</span>
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
        <IndexCard label="NIFTY 50" data={data.nifty50} />
        <IndexCard label="BANK NIFTY" data={data.banknifty} />

        {/* PCR / VIX */}
        <PcrCard sentiment={data.sentiment} />

        {/* Breadth */}
        <div className="bg-surface-2 rounded-lg p-4 border border-border flex flex-col">
          <div className="text-foreground/50 text-xs font-medium mb-1">MARKET BREADTH</div>
          {data.breadth ? (
            <>
              <div className="flex gap-3 font-mono text-sm mt-1">
                <span className="text-ngreen">{data.breadth.bullish} BUY</span>
                <span className="text-amber">{data.breadth.neutral} HOLD</span>
                <span className="text-nred">{data.breadth.bearish} SELL</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-surface flex overflow-hidden">
                <div className="bg-ngreen h-full" style={{ width: `${(data.breadth.bullish / data.breadth.total) * 100}%` }} />
                <div className="bg-amber h-full" style={{ width: `${(data.breadth.neutral / data.breadth.total) * 100}%` }} />
                <div className="bg-nred h-full" style={{ width: `${(data.breadth.bearish / data.breadth.total) * 100}%` }} />
              </div>
            </>
          ) : (
            <div className="text-foreground/40 text-sm">No signals yet</div>
          )}
        </div>
      </div>
    </div>
  );
}

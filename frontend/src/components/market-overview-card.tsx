"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { MarketNewsSentimentCard } from "./news-sentiment-card";

const DELAY_CLASSES = [
  "animate-fade-in",
  "animate-fade-in animate-fade-in-d1",
  "animate-fade-in animate-fade-in-d2",
  "animate-fade-in animate-fade-in-d3",
  "animate-fade-in animate-fade-in-d4",
] as const;

function IndexCard({ label, data, hero, marketOpen }: { label: string; data?: { value: number; change?: number; change_pct?: number; live?: boolean }; hero?: boolean; marketOpen?: boolean }) {
  if (!data) return null;
  const isPositive = (data.change_pct ?? 0) >= 0;
  const glowClass = hero ? (isPositive ? "card-glow-green" : "card-glow-red") : "";

  return (
    <div className={`glass-card rounded-xl p-4 h-full ${glowClass}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-foreground/40 text-xs font-medium tracking-wide">{label}</span>
        {data.live && marketOpen && (
          <span className="flex items-center gap-1.5">
            <span className="relative w-1.5 h-1.5">
              <span className="absolute inset-0 rounded-full bg-ngreen pulse-ring-green" />
              <span className="absolute inset-0 rounded-full bg-ngreen" />
            </span>
            <span className="text-ngreen text-[10px] font-mono font-semibold">LIVE</span>
          </span>
        )}
      </div>
      <div className={`font-mono font-bold tracking-tight ${hero ? "text-2xl" : "text-xl"}`}>
        {data.value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
      </div>
      {data.change_pct !== undefined && (
        <div className="mt-1.5">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-semibold ${isPositive ? "bg-ngreen/15 text-ngreen" : "bg-nred/15 text-nred"}`}>
            {isPositive ? "\u25B2" : "\u25BC"} {isPositive ? "+" : ""}{data.change_pct.toFixed(2)}%
          </span>
          <span className="text-foreground/25 text-[10px] font-mono ml-1.5">
            {isPositive ? "+" : ""}{data.change?.toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
}

const SENTIMENT_STYLES = {
  bullish: {
    border: "border-ngreen/20",
    badge: "bg-ngreen/15 text-ngreen border-ngreen/25",
    dot: "bg-ngreen",
  },
  bearish: {
    border: "border-nred/20",
    badge: "bg-nred/15 text-nred border-nred/25",
    dot: "bg-nred",
  },
  neutral: {
    border: "border-amber/20",
    badge: "bg-amber/15 text-amber border-amber/25",
    dot: "bg-amber",
  },
} as const;

function PcrCard({ sentiment }: { sentiment?: { pcr?: number | null; pcr_interpretation?: string; available: boolean; vix?: number; vix_change?: number } }) {
  const pcr = sentiment?.pcr ?? 0;
  const mood = pcr > 1.0 ? "bullish" : pcr < 0.7 ? "bearish" : "neutral";
  const label = mood === "bullish" ? "Bullish" : mood === "bearish" ? "Bearish" : "Neutral";
  const styles = SENTIMENT_STYLES[mood];

  return (
    <div className={`glass-card rounded-xl p-4 flex flex-col h-full ${sentiment?.available ? styles.border : ""}`}>
      <div className="text-foreground/40 text-xs font-medium tracking-wide mb-1.5">PUT-CALL RATIO</div>
      {sentiment?.available ? (
        <>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-xl font-bold">{sentiment.pcr?.toFixed(4) ?? "N/A"}</span>
            {sentiment.vix != null && (
              <span className={`font-mono text-[10px] ${sentiment.vix > 20 ? "text-nred" : sentiment.vix < 13 ? "text-ngreen" : "text-amber"}`}>
                VIX {sentiment.vix}
              </span>
            )}
          </div>
          <div className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold w-fit border ${styles.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
            {label}
          </div>
        </>
      ) : (
        <div className="text-foreground/30 text-sm mt-1">Data unavailable</div>
      )}
    </div>
  );
}

export function MarketOverviewCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["market-overview"],
    queryFn: api.getMarketOverview,
    refetchInterval: 30 * 1000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="glass-card rounded-xl h-28 shimmer" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="mb-8">
      {/* Live status bar */}
      <div className="flex items-center gap-2 mb-4">
        {data.market_open ? (
          <span className="flex items-center gap-2 text-xs">
            <span className="relative w-2 h-2">
              <span className="absolute inset-0 rounded-full bg-ngreen pulse-ring-green" />
              <span className="absolute inset-0 rounded-full bg-ngreen" />
            </span>
            <span className="text-ngreen font-medium font-mono">MARKET OPEN</span>
            <span className="text-foreground/25">Prices update every 30s</span>
          </span>
        ) : (
          <span className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-nred" />
            <span className="text-nred font-medium font-mono">MARKET CLOSED</span>
            <span className="text-foreground/25">Showing last close prices</span>
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 items-stretch">
        <div className={DELAY_CLASSES[0]}>
          <IndexCard label="NIFTY 50" data={data.nifty50} hero marketOpen={data.market_open} />
        </div>
        <div className={DELAY_CLASSES[1]}>
          <IndexCard label="BANK NIFTY" data={data.banknifty} hero marketOpen={data.market_open} />
        </div>
        <div className={DELAY_CLASSES[2]}>
          <PcrCard sentiment={data.sentiment} />
        </div>

        {/* Breadth */}
        <div className={`glass-card rounded-xl p-4 flex flex-col ${DELAY_CLASSES[3]}`}>
          <div className="text-foreground/40 text-xs font-medium tracking-wide mb-1.5">MARKET BREADTH</div>
          {data.breadth ? (
            <>
              <div className="flex gap-2 font-mono text-xs mt-1">
                <span className="text-ngreen">{data.breadth.bullish} BUY</span>
                <span className="text-amber">{data.breadth.neutral} HOLD</span>
                <span className="text-nred">{data.breadth.bearish} SELL</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-white/[0.04] flex overflow-hidden">
                <div className="bg-ngreen h-full rounded-l-full" style={{ width: `${(data.breadth.bullish / data.breadth.total) * 100}%` }} />
                <div className="bg-amber h-full" style={{ width: `${(data.breadth.neutral / data.breadth.total) * 100}%` }} />
                <div className="bg-nred h-full rounded-r-full" style={{ width: `${(data.breadth.bearish / data.breadth.total) * 100}%` }} />
              </div>
            </>
          ) : (
            <div className="text-foreground/30 text-sm">No signals yet</div>
          )}
        </div>

        {/* News Sentiment */}
        <div className={DELAY_CLASSES[4]}>
          <MarketNewsSentimentCard />
        </div>
      </div>
    </div>
  );
}

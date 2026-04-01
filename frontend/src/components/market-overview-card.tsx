"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { MarketNewsSentimentCard } from "./news-sentiment-card";

function IndexCard({ label, data, hero, marketOpen }: { label: string; data?: { value: number; change?: number; change_pct?: number; live?: boolean }; hero?: boolean; marketOpen?: boolean }) {
  if (!data) return null;
  const isPositive = (data.change_pct ?? 0) >= 0;

  return (
    <div className={`glass-card glass-card-hover rounded-2xl p-5 h-full relative overflow-hidden ${hero ? (isPositive ? "card-glow-green" : "card-glow-red") : ""}`}>
      {/* Subtle top accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${isPositive ? "rgba(16,185,129,0.5)" : "rgba(244,63,94,0.5)"}, transparent)` }} />

      <div className="flex items-center gap-2 mb-2">
        <span className="text-foreground/40 text-[11px] font-semibold tracking-wide uppercase">{label}</span>
        {data.live && marketOpen && (
          <span className="flex items-center gap-1.5">
            <span className="relative w-2 h-2">
              <span className="absolute inset-0 rounded-full bg-ngreen pulse-ring-green" />
              <span className="absolute inset-0 rounded-full bg-ngreen" />
            </span>
            <span className="text-ngreen text-[9px] font-mono font-bold">LIVE</span>
          </span>
        )}
      </div>
      <div className={`font-mono font-bold tracking-tight ${hero ? "text-2xl" : "text-xl"}`}>
        {data.value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
      </div>
      {data.change_pct !== undefined && (
        <div className="mt-2 flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold ${isPositive ? "bg-ngreen/15 text-ngreen border border-ngreen/20" : "bg-nred/15 text-nred border border-nred/20"}`}>
            {isPositive ? "▲" : "▼"} {isPositive ? "+" : ""}{data.change_pct.toFixed(2)}%
          </span>
          <span className="text-foreground/20 text-[10px] font-mono">
            {isPositive ? "+" : ""}{data.change?.toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
}

const SENTIMENT_STYLES = {
  bullish: { border: "border-ngreen/20", badge: "bg-ngreen/15 text-ngreen border-ngreen/25", dot: "bg-ngreen" },
  bearish: { border: "border-nred/20", badge: "bg-nred/15 text-nred border-nred/25", dot: "bg-nred" },
  neutral: { border: "border-amber/20", badge: "bg-amber/15 text-amber border-amber/25", dot: "bg-amber" },
} as const;

function PcrCard({ sentiment }: { sentiment?: { pcr?: number | null; pcr_interpretation?: string; available: boolean; vix?: number; vix_change?: number } }) {
  const pcr = sentiment?.pcr ?? 0;
  const mood = pcr > 1.0 ? "bullish" : pcr < 0.7 ? "bearish" : "neutral";
  const label = mood === "bullish" ? "Bullish" : mood === "bearish" ? "Bearish" : "Neutral";
  const styles = SENTIMENT_STYLES[mood];

  return (
    <div className={`glass-card glass-card-hover rounded-2xl p-5 flex flex-col h-full ${sentiment?.available ? styles.border : ""}`}>
      <div className="text-foreground/40 text-[11px] font-semibold tracking-wide uppercase mb-2">PUT-CALL RATIO</div>
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
          <div className={`mt-2 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-bold w-fit border ${styles.badge}`}>
            <span className={`w-2 h-2 rounded-full ${styles.dot}`} />
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="glass-card rounded-2xl h-32 shimmer" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div>
      {/* Live status bar */}
      <div className="flex items-center gap-2 mb-4">
        {data.market_open ? (
          <span className="flex items-center gap-2 text-xs">
            <span className="relative w-2.5 h-2.5">
              <span className="absolute inset-0 rounded-full bg-ngreen pulse-ring-green" />
              <span className="absolute inset-0 rounded-full bg-ngreen" />
            </span>
            <span className="text-ngreen font-semibold font-mono tracking-wide">MARKET OPEN</span>
            <span className="text-foreground/20 ml-1">Prices update every 30s</span>
          </span>
        ) : (
          <span className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-nred shadow-[0_0_8px_rgba(244,63,94,0.4)]" />
            <span className="text-nred font-semibold font-mono tracking-wide">MARKET CLOSED</span>
            <span className="text-foreground/20 ml-1">Showing last close prices</span>
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 items-stretch">
        <div className="animate-fade-in">
          <IndexCard label="NIFTY 50" data={data.nifty50} hero marketOpen={data.market_open} />
        </div>
        <div className="animate-fade-in animate-fade-in-d1">
          <IndexCard label="BANK NIFTY" data={data.banknifty} hero marketOpen={data.market_open} />
        </div>
        <div className="animate-fade-in animate-fade-in-d2">
          <PcrCard sentiment={data.sentiment} />
        </div>

        {/* Breadth */}
        <div className="glass-card glass-card-hover rounded-2xl p-5 flex flex-col animate-fade-in animate-fade-in-d3">
          <div className="text-foreground/40 text-[11px] font-semibold tracking-wide uppercase mb-2">MARKET BREADTH</div>
          {data.breadth ? (
            <>
              <div className="flex gap-3 font-mono text-xs mt-1">
                <span className="text-ngreen font-bold">{data.breadth.bullish} BUY</span>
                <span className="text-amber font-bold">{data.breadth.neutral} HOLD</span>
                <span className="text-nred font-bold">{data.breadth.bearish} SELL</span>
              </div>
              <div className="mt-3 h-2.5 rounded-full bg-white/[0.04] flex overflow-hidden">
                <div className="bg-ngreen h-full rounded-l-full transition-all duration-700 shadow-[0_0_8px_rgba(16,185,129,0.3)]" style={{ width: `${(data.breadth.bullish / data.breadth.total) * 100}%` }} />
                <div className="bg-amber h-full transition-all duration-700" style={{ width: `${(data.breadth.neutral / data.breadth.total) * 100}%` }} />
                <div className="bg-nred h-full rounded-r-full transition-all duration-700 shadow-[0_0_8px_rgba(244,63,94,0.3)]" style={{ width: `${(data.breadth.bearish / data.breadth.total) * 100}%` }} />
              </div>
            </>
          ) : (
            <div className="text-foreground/30 text-sm">No signals yet</div>
          )}
        </div>

        {/* News Sentiment */}
        <div className="animate-fade-in animate-fade-in-d4">
          <MarketNewsSentimentCard />
        </div>
      </div>
    </div>
  );
}

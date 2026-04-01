"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

function getSentimentColor(score: number): string {
  if (score >= 0.6) return "text-ngreen";
  if (score >= 0.4) return "text-foreground/50";
  return "text-nred";
}

function getSentimentDot(score: number): string {
  if (score >= 0.6) return "bg-ngreen";
  if (score >= 0.4) return "bg-amber";
  return "bg-nred";
}

export function NewsTicker() {
  const { data } = useQuery({
    queryKey: ["market-news"],
    queryFn: api.getMarketNews,
    refetchInterval: 5 * 60 * 1000,
  });

  const headlines = data?.news ?? [];

  if (headlines.length === 0) return null;

  // Duplicate for seamless loop
  const items = [...headlines, ...headlines];

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/[0.05]"
      style={{
        background: "rgba(6, 6, 12, 0.92)",
        backdropFilter: "blur(16px) saturate(140%)",
      }}
    >
      <div className="flex items-center h-8 overflow-hidden">
        {/* Label */}
        <div className="shrink-0 px-3 flex items-center gap-1.5 border-r border-white/[0.05] h-full bg-white/[0.02]">
          <span className="w-1.5 h-1.5 rounded-full bg-ngreen pulse-ring-green" />
          <span className="text-[10px] font-mono text-foreground/30 uppercase tracking-wider">LIVE</span>
        </div>

        {/* Scrolling ticker */}
        <div className="flex-1 overflow-hidden relative">
          <div className="news-ticker-scroll flex items-center gap-8 whitespace-nowrap">
            {items.map((item, i) => (
              <span key={i} className="inline-flex items-center gap-2 text-xs">
                <span className={`w-1 h-1 rounded-full shrink-0 ${getSentimentDot(item.sentiment_score)}`} />
                <span className="text-foreground/25 font-mono text-[10px]">{item.symbol?.replace(".NS", "")}</span>
                <span className={`${getSentimentColor(item.sentiment_score)}`}>{item.headline}</span>
                <span className="text-foreground/15 text-[10px]">{item.source}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

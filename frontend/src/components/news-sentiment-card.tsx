"use client";

import { useQuery } from "@tanstack/react-query";
import { api, NewsItem } from "@/lib/api";

const SENTIMENT_STYLES = {
  Bullish: {
    border: "border-ngreen/20",
    badge: "bg-ngreen/15 text-ngreen border-ngreen/25",
    dot: "bg-ngreen",
  },
  "Slightly Bullish": {
    border: "border-ngreen/15",
    badge: "bg-ngreen/10 text-ngreen border-ngreen/20",
    dot: "bg-ngreen",
  },
  Bearish: {
    border: "border-nred/20",
    badge: "bg-nred/15 text-nred border-nred/25",
    dot: "bg-nred",
  },
  "Slightly Bearish": {
    border: "border-nred/15",
    badge: "bg-nred/10 text-nred border-nred/20",
    dot: "bg-nred",
  },
  Neutral: {
    border: "border-amber/20",
    badge: "bg-amber/15 text-amber border-amber/25",
    dot: "bg-amber",
  },
} as const;

function SentimentDot({ score }: { score: number }) {
  const color = score > 0.2 ? "bg-ngreen" : score < -0.2 ? "bg-nred" : "bg-amber";
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${color}`} />;
}

function HeadlineRow({ item }: { item: NewsItem }) {
  return (
    <div className="flex items-start gap-2 py-2 border-b border-white/[0.03] last:border-0">
      <SentimentDot score={item.sentiment_score} />
      <div className="flex-1 min-w-0">
        {item.url ? (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-foreground/75 hover:text-cyan leading-tight line-clamp-2 transition-colors"
          >
            {item.headline}
          </a>
        ) : (
          <span className="text-xs text-foreground/75 leading-tight line-clamp-2">{item.headline}</span>
        )}
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-foreground/25 font-mono">{item.source}</span>
          <span className={`text-[10px] font-mono ${item.sentiment_score > 0 ? "text-ngreen" : item.sentiment_score < 0 ? "text-nred" : "text-amber"}`}>
            {item.sentiment_score > 0 ? "+" : ""}{item.sentiment_score.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function MarketNewsSentimentCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["market-news"],
    queryFn: api.getMarketNews,
    refetchInterval: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="glass-card rounded-xl p-5 shimmer h-full" />
    );
  }

  const label = data?.sentiment_label ?? "Neutral";
  const styles = SENTIMENT_STYLES[label as keyof typeof SENTIMENT_STYLES] ?? SENTIMENT_STYLES.Neutral;

  return (
    <div className={`glass-card rounded-xl p-4 flex flex-col h-full ${data?.count ? styles.border : ""}`}>
      <div className="text-foreground/40 text-xs font-medium tracking-wide mb-1.5">NEWS SENTIMENT</div>
      {data && data.count > 0 ? (
        <>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-xl font-bold">
              {data.aggregate_sentiment != null
                ? (data.aggregate_sentiment > 0 ? "+" : "") + data.aggregate_sentiment.toFixed(2)
                : "N/A"}
            </span>
            <span className="text-foreground/30 text-xs font-mono">{data.count} articles</span>
          </div>
          <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold w-fit border ${styles.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
            {label}
          </div>
        </>
      ) : (
        <div className="text-foreground/30 text-sm mt-1">No news data yet</div>
      )}
    </div>
  );
}

export function StockNewsPanel({ symbol }: { symbol: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["stock-news", symbol],
    queryFn: () => api.getStockNews(symbol),
    refetchInterval: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="glass-card rounded-xl p-6">
        <div className="space-y-3">
          <div className="shimmer h-4 rounded w-1/3" />
          <div className="shimmer h-3 rounded w-full" />
          <div className="shimmer h-3 rounded w-2/3" />
        </div>
      </div>
    );
  }

  if (!data || data.count === 0) {
    return (
      <div className="glass-card rounded-xl p-6">
        <h3 className="section-header text-xs text-foreground/40 uppercase tracking-widest mb-2">News Sentiment</h3>
        <p className="text-foreground/30 text-sm">No recent news for {data?.name ?? symbol}. Run a news refresh or wait for the next scheduled fetch.</p>
      </div>
    );
  }

  const label = data.sentiment_label;
  const styles = SENTIMENT_STYLES[label as keyof typeof SENTIMENT_STYLES] ?? SENTIMENT_STYLES.Neutral;

  return (
    <div className="glass-card rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-header text-xs text-foreground/40 uppercase tracking-widest">News Sentiment</h3>
        <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${styles.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
          {label}
          {data.aggregate_sentiment != null && (
            <span className="font-mono ml-1">
              ({data.aggregate_sentiment > 0 ? "+" : ""}{data.aggregate_sentiment.toFixed(2)})
            </span>
          )}
        </div>
      </div>
      <div className="space-y-0">
        {data.news.slice(0, 8).map((item, i) => (
          <HeadlineRow key={i} item={item} />
        ))}
      </div>
      {data.count > 8 && (
        <div className="text-foreground/25 text-xs mt-3 text-center font-mono">
          +{data.count - 8} more headlines
        </div>
      )}
    </div>
  );
}

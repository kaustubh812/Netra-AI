"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { StockChart } from "@/components/chart";
import { IndicatorPanel } from "@/components/indicator-panel";
import { BacktestSection } from "@/components/backtest-section";
import { StockNewsPanel } from "@/components/news-sentiment-card";
import { FundamentalsPanel } from "@/components/fundamentals-panel";
import { SignalBadge } from "@/components/signal-badge";

export default function StockDetailPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = use(params);
  const decoded = decodeURIComponent(symbol);

  const { data: stock, isLoading, error } = useQuery({
    queryKey: ["stock", decoded],
    queryFn: () => api.getStock(decoded),
  });

  if (isLoading) {
    return (
      <div className="max-w-screen-2xl mx-auto px-6 py-6 relative z-10">
        <div className="shimmer h-5 w-36 rounded mb-3" />
        <div className="glass-card rounded-xl shimmer h-48" />
      </div>
    );
  }

  if (error || !stock) {
    return (
      <div className="max-w-screen-2xl mx-auto px-6 py-6 relative z-10">
        <Link href="/" className="text-cyan text-sm hover:text-cyan/80 transition-colors mb-4 inline-flex items-center gap-1.5">
          &larr; Back to Dashboard
        </Link>
        <div className="text-nred mt-4">Failed to load data for {decoded}. Make sure the backend is running and data has been fetched.</div>
      </div>
    );
  }

  const sig = stock.current_signal;
  const rr = sig && Math.abs(sig.entry_price - sig.stop_loss) > 0
    ? ((sig.target_price - sig.entry_price) / Math.abs(sig.entry_price - sig.stop_loss)).toFixed(2)
    : null;

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-6 relative z-10">
      <Link href="/" className="text-cyan text-sm hover:text-cyan/80 transition-colors mb-4 inline-flex items-center gap-1.5">
        &larr; Back to Dashboard
      </Link>

      {/* Hero Header Card — compact */}
      <div className="glass-card rounded-xl p-5 mb-5 animate-fade-in gradient-border-cyan">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground leading-tight">{stock.name}</h1>
              <span className="text-foreground/25 text-xs font-mono">{stock.symbol}</span>
            </div>
            {sig && (
              <div className="flex items-center gap-2.5">
                <SignalBadge signal={sig.signal} confidence={sig.confidence} size="lg" />
                <span className="text-foreground/35 text-xs font-mono">
                  Score: <span className="text-cyan font-semibold">{(sig.composite_score * 100).toFixed(1)}%</span>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Key metrics — inline row, not stretched grid */}
        {sig && (
          <div className="flex flex-wrap gap-x-8 gap-y-3 mt-4 pt-4 border-t border-white/[0.06]">
            <div>
              <div className="text-foreground/30 text-[10px] uppercase tracking-wide mb-0.5">Entry</div>
              <div className="font-mono text-base font-semibold">{sig.entry_price.toLocaleString("en-IN")}</div>
            </div>
            <div>
              <div className="text-nred/50 text-[10px] uppercase tracking-wide mb-0.5">Stop Loss</div>
              <div className="font-mono text-base font-semibold text-nred">{sig.stop_loss.toLocaleString("en-IN")}</div>
            </div>
            <div>
              <div className="text-ngreen/50 text-[10px] uppercase tracking-wide mb-0.5">Target</div>
              <div className="font-mono text-base font-semibold text-ngreen">{sig.target_price.toLocaleString("en-IN")}</div>
            </div>
            <div>
              <div className="text-foreground/30 text-[10px] uppercase tracking-wide mb-0.5">Risk:Reward</div>
              <div className="font-mono text-base font-semibold text-cyan">{rr ? `1:${rr}` : "\u2014"}</div>
            </div>
            <div>
              <div className="text-foreground/30 text-[10px] uppercase tracking-wide mb-0.5">Model Prob</div>
              <div className="font-mono text-base font-semibold">{(sig.model_probability * 100).toFixed(1)}%</div>
            </div>
          </div>
        )}
      </div>

      {/* Chart + Indicators — 7:5 split for better balance */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 animate-fade-in animate-fade-in-d1">
        <div className="lg:col-span-7">
          <StockChart
            symbol={decoded}
            entryPrice={sig?.entry_price}
            stopLoss={sig?.stop_loss}
            targetPrice={sig?.target_price}
            signal={sig?.signal}
          />
        </div>
        <div className="lg:col-span-5">
          <IndicatorPanel stock={stock} />
        </div>
      </div>

      <div className="section-divider" />

      {/* Fundamentals + News */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 animate-fade-in animate-fade-in-d2">
        <FundamentalsPanel symbol={decoded} />
        <StockNewsPanel symbol={decoded} />
      </div>

      <div className="section-divider" />

      {/* Backtest */}
      <div className="animate-fade-in animate-fade-in-d3">
        <BacktestSection symbol={decoded} />
      </div>
    </div>
  );
}

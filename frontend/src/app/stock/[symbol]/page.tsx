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
import { AnalystPanel } from "@/components/analyst-panel";
import { SignalBadge } from "@/components/signal-badge";

const INTRADAY_BADGE = "bg-cyan/15 text-cyan border border-cyan/30 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider";
const DAILY_BADGE = "bg-amber/15 text-amber border border-amber/30 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider";

const COMPONENT_LABELS: Record<string, string> = {
  vwap: "VWAP",
  orb: "ORB",
  ema_cross: "EMA 9/21",
  rsi: "RSI",
  macd: "MACD",
  supertrend: "Supertrend",
  volume_surge: "Volume",
  daily_bias: "Daily Bias",
};

export default function StockDetailPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = use(params);
  const decoded = decodeURIComponent(symbol);

  const { data: stock, isLoading, error } = useQuery({
    queryKey: ["stock", decoded],
    queryFn: () => api.getStock(decoded),
  });

  const { data: intradaySig } = useQuery({
    queryKey: ["intraday-signal", decoded],
    queryFn: () => api.getIntradaySignal(decoded).catch(() => null),
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="px-6 py-6 relative z-10">
        <div className="shimmer h-5 w-36 rounded mb-3" />
        <div className="glass-card rounded-xl shimmer h-48" />
      </div>
    );
  }

  if (error || !stock) {
    return (
      <div className="px-6 py-6 relative z-10">
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
    <div className="px-6 py-6 relative z-10">
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

      {/* Intraday Signal Card */}
      {intradaySig && (
        <div className="glass-card rounded-xl p-5 mb-5 animate-fade-in gradient-border-cyan">
          <div className="flex items-center gap-3 mb-3">
            <span className={INTRADAY_BADGE}>Intraday</span>
            <SignalBadge signal={intradaySig.signal} confidence={intradaySig.confidence} size="lg" />
            <span className="text-foreground/25 text-xs font-mono ml-auto">
              {new Date(intradaySig.datetime).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })} IST
            </span>
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-3 pt-3 border-t border-white/[0.06]">
            <div>
              <div className="text-foreground/30 text-[10px] uppercase tracking-wide mb-0.5">Entry</div>
              <div className="font-mono text-base font-semibold">{intradaySig.entry_price.toLocaleString("en-IN")}</div>
            </div>
            <div>
              <div className="text-nred/50 text-[10px] uppercase tracking-wide mb-0.5">Stop Loss</div>
              <div className="font-mono text-base font-semibold text-nred">{intradaySig.stop_loss.toLocaleString("en-IN")}</div>
            </div>
            <div>
              <div className="text-ngreen/50 text-[10px] uppercase tracking-wide mb-0.5">Target</div>
              <div className="font-mono text-base font-semibold text-ngreen">{intradaySig.target_price.toLocaleString("en-IN")}</div>
            </div>
            <div>
              <div className="text-foreground/30 text-[10px] uppercase tracking-wide mb-0.5">Regime</div>
              <div className="font-mono text-base font-semibold text-cyan">{intradaySig.regime}</div>
            </div>
            {intradaySig.vwap && (
              <div>
                <div className="text-foreground/30 text-[10px] uppercase tracking-wide mb-0.5">VWAP</div>
                <div className="font-mono text-base font-semibold">{intradaySig.vwap.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div>
              </div>
            )}
            {intradaySig.orb_high && intradaySig.orb_low && (
              <div>
                <div className="text-foreground/30 text-[10px] uppercase tracking-wide mb-0.5">ORB Range</div>
                <div className="font-mono text-sm font-semibold">
                  {intradaySig.orb_low.toLocaleString("en-IN", { maximumFractionDigits: 2 })} &mdash; {intradaySig.orb_high.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                </div>
              </div>
            )}
            {intradaySig.gap_pct !== undefined && intradaySig.gap_pct !== 0 && (
              <div>
                <div className="text-foreground/30 text-[10px] uppercase tracking-wide mb-0.5">Gap</div>
                <div className={`font-mono text-base font-semibold ${intradaySig.gap_pct >= 0 ? "text-ngreen" : "text-nred"}`}>
                  {intradaySig.gap_pct >= 0 ? "+" : ""}{intradaySig.gap_pct}%
                </div>
              </div>
            )}
          </div>

          {/* 8-component breakdown */}
          <div className="mt-4 pt-3 border-t border-white/[0.06]">
            <div className="text-foreground/25 text-[10px] uppercase tracking-wider mb-2">Component Scores</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(intradaySig.components).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between bg-white/[0.02] rounded-lg px-3 py-1.5">
                  <span className="text-xs text-foreground/40">{COMPONENT_LABELS[key] || key}</span>
                  <span className={`font-mono text-xs font-semibold ${val > 0.6 ? "text-ngreen" : val < 0.4 ? "text-nred" : "text-foreground/50"}`}>
                    {(val * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Daily signal label */}
      {sig && (
        <div className="flex items-center gap-2 mb-2">
          <span className={DAILY_BADGE}>Daily</span>
        </div>
      )}

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

      {/* Analyst Estimates */}
      <div className="animate-fade-in animate-fade-in-d2">
        <AnalystPanel symbol={decoded} />
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

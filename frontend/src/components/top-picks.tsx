"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, Signal } from "@/lib/api";
import { SignalBadge } from "./signal-badge";

const BUY_DELAYS = [
  "animate-fade-in",
  "animate-fade-in animate-fade-in-d1",
  "animate-fade-in animate-fade-in-d2",
] as const;

const SELL_DELAYS = [
  "animate-fade-in animate-fade-in-d3",
  "animate-fade-in animate-fade-in-d4",
  "animate-fade-in animate-fade-in-d5",
] as const;

function PickCard({ signal, delay }: { signal: Signal; delay: string }) {
  const isBuy = signal.signal === "BUY";
  const rr = Math.abs(signal.entry_price - signal.stop_loss) > 0
    ? ((signal.target_price - signal.entry_price) / Math.abs(signal.entry_price - signal.stop_loss)).toFixed(2)
    : "—";

  return (
    <Link
      href={`/stock/${encodeURIComponent(signal.symbol)}`}
      className={`block glass-card glass-card-hover rounded-xl overflow-hidden ${delay} ${isBuy ? "gradient-border-green" : "gradient-border-red"}`}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="font-medium text-foreground text-sm">{signal.name}</span>
          <SignalBadge signal={signal.signal} confidence={signal.confidence} size="sm" />
        </div>

        {/* Vertical price layout */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-foreground/35 text-xs">Entry</span>
            <span className="text-foreground/80 text-sm font-mono">{signal.entry_price.toLocaleString("en-IN")}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-nred/50 text-xs">Stop Loss</span>
            <span className="text-nred/80 text-sm font-mono">{signal.stop_loss.toLocaleString("en-IN")}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-ngreen/50 text-xs">Target</span>
            <span className="text-ngreen/80 text-sm font-mono">{signal.target_price.toLocaleString("en-IN")}</span>
          </div>
        </div>

        {/* Confidence bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] text-foreground/30 font-mono mb-1">
            <span>Signal Strength</span>
            <span>{signal.confidence.toFixed(0)}%</span>
          </div>
          <div className="confidence-bar">
            <div
              className="confidence-bar-fill"
              style={{
                width: `${signal.confidence}%`,
                backgroundColor: isBuy ? "rgba(0,200,83,0.7)" : "rgba(255,23,68,0.7)",
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.04]">
          <span className="text-foreground/30 text-[10px] font-mono">R:R</span>
          <span className="text-cyan text-xs font-mono font-semibold">1:{rr}</span>
        </div>
      </div>
    </Link>
  );
}

export function TopPicks() {
  const { data } = useQuery({
    queryKey: ["latest-signals"],
    queryFn: api.getLatestSignals,
  });

  if (!data?.signals.length) return null;

  const buys = data.signals.filter((s) => s.signal === "BUY").slice(0, 3);
  const sells = data.signals.filter((s) => s.signal === "SELL").slice(0, 3);

  if (!buys.length && !sells.length) return null;

  return (
    <div className="space-y-6">
      {buys.length > 0 && (
        <div>
          <h3 className="section-header text-xs font-medium text-foreground/40 uppercase tracking-widest mb-3">
            Top Buy Signals
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {buys.map((s, i) => (
              <PickCard key={s.symbol} signal={s} delay={BUY_DELAYS[i] || BUY_DELAYS[0]} />
            ))}
          </div>
        </div>
      )}

      {sells.length > 0 && (
        <div>
          <h3 className="section-header text-xs font-medium text-foreground/40 uppercase tracking-widest mb-3">
            Top Sell Signals
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sells.map((s, i) => (
              <PickCard key={s.symbol} signal={s} delay={SELL_DELAYS[i] || SELL_DELAYS[0]} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, IntradaySignal } from "@/lib/api";
import { SignalBadge } from "./signal-badge";

type SortKey = "name" | "confidence" | "signal" | "entry_price" | "regime";

const ROW_STYLES = {
  BUY: "bg-ngreen/[0.02] hover:bg-ngreen/[0.06]",
  SELL: "bg-nred/[0.02] hover:bg-nred/[0.06]",
  DEFAULT: "hover:bg-white/[0.02]",
} as const;

const REGIME_STYLES = {
  trending: "bg-cyan/10 text-cyan",
  ranging: "bg-amber/10 text-amber",
  volatile: "bg-nred/10 text-nred",
} as const;

export function IntradaySignalTable() {
  const { data, isLoading } = useQuery({
    queryKey: ["intraday-signals"],
    queryFn: api.getIntradaySignals,
    refetchInterval: 60_000,
  });

  const [sortKey, setSortKey] = useState<SortKey>("confidence");
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const sorted = [...(data?.signals ?? [])].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "name": cmp = a.name.localeCompare(b.name); break;
      case "confidence": cmp = a.confidence - b.confidence; break;
      case "signal": cmp = a.signal.localeCompare(b.signal); break;
      case "entry_price": cmp = a.entry_price - b.entry_price; break;
      case "regime": cmp = a.regime.localeCompare(b.regime); break;
    }
    return sortAsc ? cmp : -cmp;
  });

  const getRowStyle = (signal: string) => {
    if (signal === "BUY") return ROW_STYLES.BUY;
    if (signal === "SELL") return ROW_STYLES.SELL;
    return ROW_STYLES.DEFAULT;
  };

  const getRegimeStyle = (regime: string) => {
    return REGIME_STYLES[regime as keyof typeof REGIME_STYLES] || "bg-white/5 text-foreground/50";
  };

  const SortHeader = ({ label, col }: { label: string; col: SortKey }) => (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-foreground/40 cursor-pointer select-none hover:text-cyan transition-colors"
      onClick={() => handleSort(col)}
    >
      {label} {sortKey === col ? (sortAsc ? "\u2191" : "\u2193") : ""}
    </th>
  );

  if (isLoading) {
    return (
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="p-8 text-center">
          <div className="shimmer h-4 w-40 rounded mx-auto" />
        </div>
      </div>
    );
  }

  const signalTime = data?.signals?.[0]?.datetime;

  return (
    <div className="glass-card rounded-xl overflow-hidden animate-fade-in animate-fade-in-d4">
      {signalTime && (
        <div className="px-4 py-2 border-b border-white/[0.06] flex items-center gap-2 text-xs text-foreground/30">
          <span className="pulse-ring-green w-2 h-2 rounded-full bg-ngreen inline-block" />
          Last updated: {new Date(signalTime).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })} IST
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-white/[0.06] bg-white/[0.02] sticky top-0 z-10 backdrop-blur-sm">
            <tr>
              <SortHeader label="Stock" col="name" />
              <SortHeader label="Signal" col="signal" />
              <SortHeader label="Strength" col="confidence" />
              <SortHeader label="Entry" col="entry_price" />
              <th className="px-4 py-3 text-left text-xs font-medium text-foreground/40">SL</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-foreground/40">Target</th>
              <SortHeader label="Regime" col="regime" />
              <th className="px-4 py-3 text-left text-xs font-medium text-foreground/40">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {sorted.map((sig) => (
              <tr key={sig.symbol} className={`transition-colors ${getRowStyle(sig.signal)}`}>
                <td className="px-4 py-3">
                  <Link
                    href={`/stock/${encodeURIComponent(sig.symbol)}`}
                    className="text-cyan hover:underline font-medium"
                  >
                    {sig.name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <SignalBadge signal={sig.signal} size="sm" />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="confidence-bar w-20">
                      <div
                        className="confidence-bar-fill"
                        style={{
                          width: `${sig.confidence}%`,
                          backgroundColor: sig.confidence > 65 ? "rgba(16,185,129,0.7)" : sig.confidence > 45 ? "rgba(255,171,0,0.7)" : "rgba(244,63,94,0.7)",
                        }}
                      />
                    </div>
                    <span className="font-mono text-xs text-foreground/60">{sig.confidence.toFixed(0)}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-foreground/60">
                  {sig.entry_price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 font-mono text-nred/60">
                  {sig.stop_loss.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 font-mono text-ngreen/60">
                  {sig.target_price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${getRegimeStyle(sig.regime)}`}>
                    {sig.regime}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-foreground/30 font-mono">
                  {new Date(sig.datetime).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sorted.length === 0 && (
        <div className="p-8 text-center text-foreground/30 text-sm">
          No intraday signals yet. Seed data and generate signals from the Settings page.
        </div>
      )}
    </div>
  );
}

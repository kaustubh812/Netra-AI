"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, StockInfo } from "@/lib/api";
import { SignalBadge } from "./signal-badge";
import { toUrlSymbol } from "@/lib/symbol";

type SortKey = "name" | "ltp" | "change_pct" | "signal" | "confidence";

const ROW_STYLES = {
  BUY: "bg-ngreen/[0.02] hover:bg-ngreen/[0.06]",
  SELL: "bg-nred/[0.02] hover:bg-nred/[0.06]",
  DEFAULT: "hover:bg-white/[0.02]",
} as const;

const SIGNAL_DOT = {
  BUY: "bg-ngreen",
  SELL: "bg-nred",
  HOLD: "bg-amber",
} as const;

export function SignalTable() {
  const { data, isLoading } = useQuery({
    queryKey: ["stocks"],
    queryFn: api.getStocks,
    refetchInterval: 30 * 1000,
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

  const sorted = [...(data?.stocks ?? [])].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "name": cmp = a.name.localeCompare(b.name); break;
      case "ltp": cmp = (a.ltp ?? 0) - (b.ltp ?? 0); break;
      case "change_pct": cmp = (a.change_pct ?? 0) - (b.change_pct ?? 0); break;
      case "signal": cmp = (a.signal ?? "").localeCompare(b.signal ?? ""); break;
      case "confidence": cmp = (a.confidence ?? 0) - (b.confidence ?? 0); break;
    }
    return sortAsc ? cmp : -cmp;
  });

  const getRowStyle = (signal?: string) => {
    if (signal === "BUY") return ROW_STYLES.BUY;
    if (signal === "SELL") return ROW_STYLES.SELL;
    return ROW_STYLES.DEFAULT;
  };

  const getSignalDot = (signal?: string) => {
    if (signal === "BUY") return SIGNAL_DOT.BUY;
    if (signal === "SELL") return SIGNAL_DOT.SELL;
    return SIGNAL_DOT.HOLD;
  };

  const SortHeader = ({ label, col }: { label: string; col: SortKey }) => (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-foreground/40 cursor-pointer select-none hover:text-cyan transition-colors duration-200"
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

  return (
    <div className="glass-card rounded-xl overflow-hidden animate-fade-in animate-fade-in-d4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-white/[0.05] bg-white/[0.02] sticky top-0 z-10 backdrop-blur-md">
            <tr>
              <SortHeader label="Stock" col="name" />
              <SortHeader label="LTP" col="ltp" />
              <SortHeader label="Change %" col="change_pct" />
              <SortHeader label="Signal" col="signal" />
              <SortHeader label="Strength" col="confidence" />
              <th className="px-4 py-3 text-left text-xs font-medium text-foreground/40">Entry</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-foreground/40">Stop Loss</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-foreground/40">Target</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {sorted.map((stock) => (
              <tr key={stock.symbol} className={`transition-colors duration-150 ${getRowStyle(stock.signal)}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {stock.signal && (
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${getSignalDot(stock.signal)}`} />
                    )}
                    <Link
                      href={`/stock/${toUrlSymbol(stock.symbol)}`}
                      className="text-cyan hover:text-cyan-bright font-medium transition-colors duration-150"
                    >
                      {stock.name}
                    </Link>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono">
                  {stock.ltp?.toLocaleString("en-IN", { maximumFractionDigits: 2 }) ?? "\u2014"}
                </td>
                <td className="px-4 py-3">
                  {stock.change_pct !== undefined ? (
                    <span className={`inline-flex items-center gap-1 font-mono text-xs px-2 py-0.5 rounded-full ${stock.change_pct >= 0 ? "bg-ngreen/10 text-ngreen" : "bg-nred/10 text-nred"}`}>
                      {stock.change_pct >= 0 ? "\u25B2" : "\u25BC"} {stock.change_pct >= 0 ? "+" : ""}{stock.change_pct.toFixed(2)}%
                    </span>
                  ) : "\u2014"}
                </td>
                <td className="px-4 py-3">
                  {stock.signal ? <SignalBadge signal={stock.signal} size="sm" /> : "\u2014"}
                </td>
                <td className="px-4 py-3">
                  {stock.confidence !== undefined ? (
                    <div className="flex items-center gap-2.5">
                      <div className="confidence-bar w-20">
                        <div
                          className="confidence-bar-fill"
                          style={{
                            width: `${stock.confidence}%`,
                            backgroundColor: stock.confidence > 65 ? "rgba(16,185,129,0.7)" : stock.confidence > 45 ? "rgba(245,158,11,0.7)" : "rgba(244,63,94,0.7)",
                          }}
                        />
                      </div>
                      <span className="font-mono text-xs text-foreground/60">{stock.confidence.toFixed(0)}%</span>
                    </div>
                  ) : "\u2014"}
                </td>
                <td className="px-4 py-3 font-mono text-foreground/60">
                  {stock.entry_price?.toLocaleString("en-IN", { maximumFractionDigits: 2 }) ?? "\u2014"}
                </td>
                <td className="px-4 py-3 font-mono text-nred/60">
                  {stock.stop_loss?.toLocaleString("en-IN", { maximumFractionDigits: 2 }) ?? "\u2014"}
                </td>
                <td className="px-4 py-3 font-mono text-ngreen/60">
                  {stock.target_price?.toLocaleString("en-IN", { maximumFractionDigits: 2 }) ?? "\u2014"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

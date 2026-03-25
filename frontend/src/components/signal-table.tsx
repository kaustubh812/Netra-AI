"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, StockInfo } from "@/lib/api";
import { SignalBadge } from "./signal-badge";

type SortKey = "name" | "ltp" | "change_pct" | "signal" | "confidence";

export function SignalTable() {
  const { data, isLoading } = useQuery({
    queryKey: ["stocks"],
    queryFn: api.getStocks,
    refetchInterval: 30 * 1000, // Refresh every 30 seconds for live prices
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

  const rowBg = (signal?: string) => {
    if (signal === "BUY") return "bg-ngreen/[0.03] hover:bg-ngreen/[0.07]";
    if (signal === "SELL") return "bg-nred/[0.03] hover:bg-nred/[0.07]";
    return "hover:bg-surface-2";
  };

  const SortHeader = ({ label, col }: { label: string; col: SortKey }) => (
    <th
      className="px-3 py-2 text-left text-xs font-medium text-foreground/50 cursor-pointer select-none hover:text-cyan"
      onClick={() => handleSort(col)}
    >
      {label} {sortKey === col ? (sortAsc ? "↑" : "↓") : ""}
    </th>
  );

  if (isLoading) {
    return (
      <div className="bg-surface rounded-lg border border-border p-8 text-center text-foreground/40">
        Loading stocks...
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-lg border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-2">
            <tr>
              <SortHeader label="Stock" col="name" />
              <SortHeader label="LTP" col="ltp" />
              <SortHeader label="Change %" col="change_pct" />
              <SortHeader label="Signal" col="signal" />
              <SortHeader label="Confidence" col="confidence" />
              <th className="px-3 py-2 text-left text-xs font-medium text-foreground/50">Entry</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-foreground/50">Stop Loss</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-foreground/50">Target</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {sorted.map((stock) => (
              <tr key={stock.symbol} className={`transition-colors ${rowBg(stock.signal)}`}>
                <td className="px-3 py-2.5">
                  <Link
                    href={`/stock/${encodeURIComponent(stock.symbol)}`}
                    className="text-cyan hover:underline font-medium"
                  >
                    {stock.name}
                  </Link>
                </td>
                <td className="px-3 py-2.5 font-mono">
                  {stock.ltp?.toLocaleString("en-IN", { maximumFractionDigits: 2 }) ?? "—"}
                </td>
                <td className={`px-3 py-2.5 font-mono ${(stock.change_pct ?? 0) >= 0 ? "text-ngreen" : "text-nred"}`}>
                  {stock.change_pct !== undefined ? `${stock.change_pct >= 0 ? "+" : ""}${stock.change_pct.toFixed(2)}%` : "—"}
                </td>
                <td className="px-3 py-2.5">
                  {stock.signal ? <SignalBadge signal={stock.signal} size="sm" /> : "—"}
                </td>
                <td className="px-3 py-2.5 font-mono">
                  {stock.confidence !== undefined ? `${stock.confidence.toFixed(0)}%` : "—"}
                </td>
                <td className="px-3 py-2.5 font-mono text-foreground/70">
                  {stock.entry_price?.toLocaleString("en-IN", { maximumFractionDigits: 2 }) ?? "—"}
                </td>
                <td className="px-3 py-2.5 font-mono text-nred/70">
                  {stock.stop_loss?.toLocaleString("en-IN", { maximumFractionDigits: 2 }) ?? "—"}
                </td>
                <td className="px-3 py-2.5 font-mono text-ngreen/70">
                  {stock.target_price?.toLocaleString("en-IN", { maximumFractionDigits: 2 }) ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

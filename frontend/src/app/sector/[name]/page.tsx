"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { SignalBadge } from "@/components/signal-badge";
import { toUrlSymbol } from "@/lib/symbol";

export default function SectorDetailPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = use(params);
  const decoded = decodeURIComponent(name);

  const { data, isLoading, error } = useQuery({
    queryKey: ["sector-detail", decoded],
    queryFn: () => api.getSectorDetail(decoded),
  });

  if (isLoading) {
    return (
      <div className="px-6 py-6 relative z-10">
        <div className="shimmer h-5 w-36 rounded mb-3" />
        <div className="glass-card rounded-xl shimmer h-48" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="px-6 py-6 relative z-10">
        <Link href="/" className="text-cyan text-sm hover:text-cyan/80 transition-colors mb-4 inline-flex items-center gap-1.5">
          &larr; Back to Dashboard
        </Link>
        <div className="text-nred mt-4">Failed to load sector data for {decoded}.</div>
      </div>
    );
  }

  return (
    <div className="px-6 py-6 relative z-10">
      <Link href="/" className="text-cyan text-sm hover:text-cyan/80 transition-colors mb-4 inline-flex items-center gap-1.5">
        &larr; Back to Dashboard
      </Link>

      {/* Sector Header */}
      <div className="glass-card rounded-xl p-5 mb-5 animate-fade-in gradient-border-cyan">
        <h1 className="text-2xl font-bold text-foreground mb-3">{data.sector}</h1>
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          {data.momentum_score !== null && (
            <div>
              <div className="text-foreground/30 text-[10px] uppercase tracking-wide mb-0.5">Momentum Score</div>
              <div className="font-mono text-lg font-semibold text-cyan">{(data.momentum_score * 100).toFixed(0)}%</div>
            </div>
          )}
          {data.rank !== null && (
            <div>
              <div className="text-foreground/30 text-[10px] uppercase tracking-wide mb-0.5">Rank</div>
              <div className="font-mono text-lg font-semibold">#{data.rank}</div>
            </div>
          )}
          {data.avg_return !== null && (
            <div>
              <div className="text-foreground/30 text-[10px] uppercase tracking-wide mb-0.5">Avg Return (20D)</div>
              <div className={`font-mono text-lg font-semibold ${data.avg_return >= 0 ? "text-ngreen" : "text-nred"}`}>
                {data.avg_return >= 0 ? "+" : ""}{data.avg_return}%
              </div>
            </div>
          )}
          {data.breadth !== null && (
            <div>
              <div className="text-foreground/30 text-[10px] uppercase tracking-wide mb-0.5">Breadth</div>
              <div className="font-mono text-lg font-semibold">{(data.breadth * 100).toFixed(0)}%</div>
            </div>
          )}
          <div>
            <div className="text-foreground/30 text-[10px] uppercase tracking-wide mb-0.5">Stocks</div>
            <div className="font-mono text-lg font-semibold">{data.count}</div>
          </div>
        </div>
      </div>

      {/* Stocks Table */}
      <div className="glass-card rounded-xl p-5 animate-fade-in animate-fade-in-d1">
        <h3 className="section-header text-xs text-foreground/40 uppercase tracking-widest mb-3">Constituent Stocks</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-foreground/30 uppercase tracking-wider border-b border-white/[0.06]">
                <th className="text-left py-2 px-2">Stock</th>
                <th className="text-center py-2 px-2">Signal</th>
                <th className="text-right py-2 px-2">LTP</th>
                <th className="text-right py-2 px-2">Change %</th>
                <th className="text-right py-2 px-2">P/E</th>
                <th className="text-right py-2 px-2">ROE</th>
                <th className="text-right py-2 px-2">Market Cap</th>
              </tr>
            </thead>
            <tbody>
              {data.stocks.map(stock => (
                <tr key={stock.symbol} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <td className="py-2.5 px-2">
                    <Link href={`/stock/${toUrlSymbol(stock.symbol)}`} className="text-cyan hover:text-cyan/80 font-medium">
                      {stock.name}
                    </Link>
                  </td>
                  <td className="text-center py-2.5 px-2">
                    {stock.signal ? <SignalBadge signal={stock.signal} confidence={stock.confidence} size="sm" /> : "—"}
                  </td>
                  <td className="text-right py-2.5 px-2 font-mono">{stock.ltp?.toLocaleString("en-IN") ?? "—"}</td>
                  <td className={`text-right py-2.5 px-2 font-mono ${stock.change_pct !== undefined && stock.change_pct >= 0 ? "text-ngreen" : "text-nred"}`}>
                    {stock.change_pct !== undefined ? `${stock.change_pct >= 0 ? "+" : ""}${stock.change_pct.toFixed(2)}%` : "—"}
                  </td>
                  <td className="text-right py-2.5 px-2 font-mono text-foreground/50">{stock.pe != null ? stock.pe.toFixed(1) : "—"}</td>
                  <td className="text-right py-2.5 px-2 font-mono text-foreground/50">{stock.roe != null ? (stock.roe * 100).toFixed(1) + "%" : "—"}</td>
                  <td className="text-right py-2.5 px-2 font-mono text-foreground/50">
                    {stock.market_cap != null
                      ? stock.market_cap >= 1e12
                        ? (stock.market_cap / 1e12).toFixed(2) + "T"
                        : stock.market_cap >= 1e9
                          ? (stock.market_cap / 1e9).toFixed(0) + "B"
                          : (stock.market_cap / 1e6).toFixed(0) + "M"
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

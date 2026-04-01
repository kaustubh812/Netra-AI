"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function StockTicker() {
  // Reuse the dashboard query cache — no extra network request!
  const { data: dashData } = useQuery({
    queryKey: ["dashboard"],
    queryFn: api.getDashboard,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const stocks = dashData?.stocks?.stocks ?? [];
  if (stocks.length === 0) return null;

  // Double the list for seamless loop
  const tickerItems = [...stocks, ...stocks];

  return (
    <div className="w-full overflow-hidden relative h-7 flex items-center"
      style={{
        background: "rgba(5,5,16,0.85)",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      <div className="ticker-scroll flex items-center gap-6 whitespace-nowrap px-4">
        {tickerItems.map((stock: any, i: number) => {
          const pct = stock.change_pct ?? 0;
          const isUp = pct >= 0;
          return (
            <span key={`${stock.symbol}-${i}`} className="inline-flex items-center gap-1.5 shrink-0">
              <span className="text-foreground/50 text-[11px] font-semibold">{stock.name}</span>
              <span className="text-foreground/70 text-[11px] font-mono font-bold">
                {stock.ltp?.toLocaleString("en-IN", { maximumFractionDigits: 1 })}
              </span>
              <span className={`text-[10px] font-mono font-bold ${isUp ? "text-ngreen" : "text-nred"}`}>
                {isUp ? "▲" : "▼"}{Math.abs(pct).toFixed(2)}%
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

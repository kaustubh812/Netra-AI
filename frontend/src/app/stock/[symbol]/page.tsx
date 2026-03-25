"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { StockChart } from "@/components/chart";
import { IndicatorPanel } from "@/components/indicator-panel";
import { BacktestSection } from "@/components/backtest-section";

export default function StockDetailPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = use(params);
  const decoded = decodeURIComponent(symbol);

  const { data: stock, isLoading, error } = useQuery({
    queryKey: ["stock", decoded],
    queryFn: () => api.getStock(decoded),
  });

  if (isLoading) {
    return (
      <div className="max-w-screen-2xl mx-auto px-4 py-6">
        <div className="text-foreground/40">Loading {decoded}...</div>
      </div>
    );
  }

  if (error || !stock) {
    return (
      <div className="max-w-screen-2xl mx-auto px-4 py-6">
        <Link href="/" className="text-cyan text-sm hover:underline mb-4 inline-block">
          &larr; Back to Dashboard
        </Link>
        <div className="text-nred">Failed to load data for {decoded}. Make sure the backend is running and data has been fetched.</div>
      </div>
    );
  }

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-6">
      <Link href="/" className="text-cyan text-sm hover:underline mb-4 inline-block">
        &larr; Back to Dashboard
      </Link>

      <h1 className="text-2xl font-bold mb-4">
        <span className="text-cyan">{stock.name}</span>
        <span className="text-foreground/30 text-sm ml-2 font-mono">{stock.symbol}</span>
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Chart — 60% */}
        <div className="lg:col-span-3">
          <StockChart symbol={decoded} />
        </div>

        {/* Signal Panel — 40% */}
        <div className="lg:col-span-2">
          <IndicatorPanel stock={stock} />
        </div>
      </div>

      {/* Backtest */}
      <div className="mt-6">
        <BacktestSection symbol={decoded} />
      </div>
    </div>
  );
}

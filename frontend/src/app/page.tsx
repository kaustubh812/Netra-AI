"use client";

import { MarketOverviewCard } from "@/components/market-overview-card";
import { TopPicks } from "@/components/top-picks";
import { SignalTable } from "@/components/signal-table";

export default function Dashboard() {
  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-6">
      <MarketOverviewCard />
      <TopPicks />
      <div className="mb-4">
        <h2 className="text-sm font-medium text-foreground/50 mb-3">ALL SIGNALS</h2>
        <SignalTable />
      </div>
    </div>
  );
}

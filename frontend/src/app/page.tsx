"use client";

import { MarketOverviewCard } from "@/components/market-overview-card";
import { TopPicks } from "@/components/top-picks";
import { SignalTable } from "@/components/signal-table";
import { MacroDashboard } from "@/components/macro-card";
import { RegimeCard } from "@/components/regime-card";
import { SectorRotationCard } from "@/components/sector-card";

export default function Dashboard() {
  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-8 relative z-10">
      <MarketOverviewCard />

      <div className="section-divider" />

      {/* Regime + Macro + Sectors — horizontal row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <RegimeCard />
        <MacroDashboard />
        <SectorRotationCard />
      </div>

      <div className="section-divider" />

      {/* Top Picks */}
      <div className="mb-8">
        <TopPicks />
      </div>

      <div className="section-divider" />

      <div className="mb-6">
        <h2 className="section-header text-xs font-medium text-foreground/40 uppercase tracking-widest mb-4">
          All Signals
        </h2>
        <SignalTable />
      </div>
    </div>
  );
}

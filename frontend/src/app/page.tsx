"use client";

import { useState, useEffect } from "react";
import { MarketOverviewCard } from "@/components/market-overview-card";
import { TopPicks } from "@/components/top-picks";
import { SignalTable } from "@/components/signal-table";
import { IntradaySignalTable } from "@/components/intraday-signal-table";
import { MacroDashboard } from "@/components/macro-card";
import { RegimeCard } from "@/components/regime-card";
import { SectorRotationCard } from "@/components/sector-card";

const PILL_ACTIVE = "bg-cyan/20 text-cyan border-cyan/40 shadow-[0_0_12px_rgba(0,229,255,0.1)]";
const PILL_INACTIVE = "bg-white/[0.03] text-foreground/40 border-white/[0.08] hover:bg-white/[0.06] hover:text-foreground/60";

function isMarketHours(): boolean {
  const now = new Date();
  const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const day = ist.getDay();
  if (day === 0 || day === 6) return false;
  const mins = ist.getHours() * 60 + ist.getMinutes();
  return mins >= 9 * 60 + 15 && mins <= 15 * 60 + 30;
}

export default function Dashboard() {
  const [mode, setMode] = useState<"daily" | "intraday">("daily");

  useEffect(() => {
    if (isMarketHours()) {
      setMode("intraday");
    }
  }, []);

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
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-header text-xs font-medium text-foreground/40 uppercase tracking-widest">
            {mode === "daily" ? "All Signals" : "Intraday Signals"}
          </h2>
          <div className="flex gap-1.5">
            <button
              onClick={() => setMode("daily")}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all ${mode === "daily" ? PILL_ACTIVE : PILL_INACTIVE}`}
            >
              Daily
            </button>
            <button
              onClick={() => setMode("intraday")}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all ${mode === "intraday" ? PILL_ACTIVE : PILL_INACTIVE}`}
            >
              Intraday
            </button>
          </div>
        </div>
        {mode === "daily" ? <SignalTable /> : <IntradaySignalTable />}
      </div>
    </div>
  );
}

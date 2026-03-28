"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { CorrelationMatrix } from "@/components/correlation-matrix";
import { MultiChart } from "@/components/multi-chart";
import { VolatilityDashboard } from "@/components/volatility-dashboard";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const PILL_ACTIVE = "bg-cyan/20 text-cyan border-cyan/40";
const PILL_INACTIVE = "bg-white/[0.03] text-foreground/40 border-white/[0.08] hover:bg-white/[0.06]";

type Tab = "correlation" | "compare" | "volatility";

export default function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>("correlation");

  return (
    <div className="px-6 py-6 relative z-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="section-header text-xs font-medium text-foreground/40 uppercase tracking-widest mb-1">
            Advanced Analytics
          </h1>
          <p className="text-foreground/20 text-xs">
            {tab === "correlation" ? "Pairwise stock correlations" : tab === "compare" ? "Normalized price comparison" : "Volatility analysis & options flow"}
          </p>
        </div>
        <div className="flex gap-1.5">
          {(["correlation", "compare", "volatility"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all ${tab === t ? PILL_ACTIVE : PILL_INACTIVE}`}
            >
              {t === "correlation" ? "Correlation" : t === "compare" ? "Compare" : "Volatility"}
            </button>
          ))}
        </div>
      </div>

      {/* Export buttons */}
      <div className="flex gap-2 mb-4">
        <a
          href={`${API_BASE}/api/export/signals`}
          download
          className="text-xs text-foreground/30 hover:text-cyan px-3 py-1.5 rounded-lg border border-white/[0.06] hover:border-cyan/20 transition-colors"
        >
          Export Signals CSV
        </a>
        <a
          href={`${API_BASE}/api/export/screener`}
          download
          className="text-xs text-foreground/30 hover:text-cyan px-3 py-1.5 rounded-lg border border-white/[0.06] hover:border-cyan/20 transition-colors"
        >
          Export Screener CSV
        </a>
      </div>

      {/* Tab content */}
      {tab === "correlation" && <CorrelationMatrix />}
      {tab === "compare" && <MultiChart />}
      {tab === "volatility" && <VolatilityDashboard />}
    </div>
  );
}

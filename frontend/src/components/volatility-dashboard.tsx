"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

function StatCard({ label, value, subtext, color }: { label: string; value: string; subtext?: string; color?: string }) {
  return (
    <div className="glass-card rounded-xl p-4">
      <div className="text-[10px] text-foreground/30 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-xl font-mono font-bold ${color ?? "text-foreground/80"}`}>{value}</div>
      {subtext && <div className="text-[10px] text-foreground/25 mt-0.5">{subtext}</div>}
    </div>
  );
}

export function VolatilityDashboard() {
  const { data: marketData } = useQuery({
    queryKey: ["market-overview"],
    queryFn: api.getMarketOverview,
    refetchInterval: 60 * 1000,
  });

  const { data: regimeData } = useQuery({
    queryKey: ["regime"],
    queryFn: api.getRegime,
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: macroData } = useQuery({
    queryKey: ["macro"],
    queryFn: api.getMacro,
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: stocksData } = useQuery({
    queryKey: ["stocks"],
    queryFn: api.getStocks,
    refetchInterval: 30 * 1000,
  });

  const vix = marketData?.sentiment?.vix;
  const vixChange = marketData?.sentiment?.vix_change;
  const vixInterp = marketData?.sentiment?.vix_interpretation;
  const pcr = marketData?.sentiment?.pcr;
  const regime = regimeData?.regime ?? "unknown";
  const regimeConf = regimeData?.confidence ?? 0;
  const metrics = regimeData?.metrics ?? {};

  // Calculate market-wide volatility stats from stocks
  const stocks = stocksData?.stocks ?? [];
  const changes = stocks.map((s: { change_pct?: number }) => s.change_pct ?? 0).filter((c: number) => c !== 0);
  const avgAbsChange = changes.length > 0 ? changes.reduce((a: number, b: number) => a + Math.abs(b), 0) / changes.length : 0;
  const maxGainer = [...stocks].sort((a: { change_pct?: number }, b: { change_pct?: number }) => (b.change_pct ?? 0) - (a.change_pct ?? 0))[0];
  const maxLoser = [...stocks].sort((a: { change_pct?: number }, b: { change_pct?: number }) => (a.change_pct ?? 0) - (b.change_pct ?? 0))[0];

  const advancers = changes.filter((c: number) => c > 0).length;
  const decliners = changes.filter((c: number) => c < 0).length;

  // VIX gauge color
  const vixColor = vix ? (vix > 25 ? "text-nred" : vix > 18 ? "text-amber" : "text-ngreen") : "text-foreground/50";
  const regimeColor = regime.includes("volatile") ? "text-nred" : regime.includes("trending") ? "text-ngreen" : "text-amber";

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatCard
          label="India VIX"
          value={vix?.toFixed(2) ?? "\u2014"}
          subtext={vixChange ? `${vixChange >= 0 ? "+" : ""}${vixChange.toFixed(2)} \u2022 ${vixInterp ?? ""}` : undefined}
          color={vixColor}
        />
        <StatCard
          label="PCR (Put/Call)"
          value={pcr?.toFixed(2) ?? "\u2014"}
          subtext={pcr ? (pcr > 1.2 ? "Bullish (high puts)" : pcr < 0.8 ? "Bearish (high calls)" : "Neutral") : undefined}
          color={pcr ? (pcr > 1.2 ? "text-ngreen" : pcr < 0.8 ? "text-nred" : "text-amber") : undefined}
        />
        <StatCard
          label="Market Regime"
          value={regime.replace("_", " ").toUpperCase()}
          subtext={`${(regimeConf * 100).toFixed(0)}% confidence`}
          color={regimeColor}
        />
        <StatCard
          label="Avg |Move|"
          value={`${avgAbsChange.toFixed(2)}%`}
          subtext={`${advancers} up / ${decliners} down`}
        />
        <StatCard
          label="Top Gainer"
          value={maxGainer?.name ?? "\u2014"}
          subtext={maxGainer?.change_pct !== undefined ? `+${maxGainer.change_pct.toFixed(2)}%` : undefined}
          color="text-ngreen"
        />
        <StatCard
          label="Top Loser"
          value={maxLoser?.name ?? "\u2014"}
          subtext={maxLoser?.change_pct !== undefined ? `${maxLoser.change_pct.toFixed(2)}%` : undefined}
          color="text-nred"
        />
      </div>

      {/* Regime metrics detail */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="glass-card rounded-xl p-4">
          <h3 className="text-xs font-medium text-foreground/40 uppercase tracking-wider mb-3">Regime Metrics</h3>
          <div className="space-y-2">
            {Object.entries(metrics).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between py-1.5 border-b border-white/[0.03] last:border-0">
                <span className="text-xs text-foreground/40">{key.replace(/_/g, " ")}</span>
                <span className="text-xs font-mono text-foreground/60">
                  {typeof val === "number" ? (val as number).toFixed(3) : String(val)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card rounded-xl p-4">
          <h3 className="text-xs font-medium text-foreground/40 uppercase tracking-wider mb-3">Volatility Guide</h3>
          <div className="space-y-3 text-xs text-foreground/40">
            <div className="flex items-start gap-2">
              <span className="w-2 h-2 rounded-full bg-ngreen shrink-0 mt-1" />
              <div>
                <span className="text-ngreen font-medium">VIX &lt; 15:</span> Low volatility. Markets calm, mean-reversion strategies work well.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-2 h-2 rounded-full bg-amber shrink-0 mt-1" />
              <div>
                <span className="text-amber font-medium">VIX 15-25:</span> Normal range. Trend-following setups are favorable.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-2 h-2 rounded-full bg-nred shrink-0 mt-1" />
              <div>
                <span className="text-nred font-medium">VIX &gt; 25:</span> High volatility. Widen stop losses, reduce position sizes. Macro/news driven.
              </div>
            </div>
            <div className="section-divider" />
            <div>
              <span className="font-medium text-foreground/50">Position Sizing Rule:</span>
              <div className="mt-1 font-mono text-foreground/30">
                Risk per trade = 2% of capital &divide; (VIX / 15)
              </div>
              <div className="mt-0.5 font-mono text-foreground/30">
                {vix ? `Current: ${(2 / (vix / 15)).toFixed(2)}% of capital` : "VIX data needed"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Options flow summary */}
      <div className="glass-card rounded-xl p-4">
        <h3 className="text-xs font-medium text-foreground/40 uppercase tracking-wider mb-3">Options Flow Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-[10px] text-foreground/25 uppercase">PCR</div>
            <div className="text-lg font-mono font-bold text-foreground/70">{pcr?.toFixed(2) ?? "\u2014"}</div>
          </div>
          <div>
            <div className="text-[10px] text-foreground/25 uppercase">Max Pain</div>
            <div className="text-lg font-mono font-bold text-foreground/70">
              {marketData?.sentiment?.max_pain?.toLocaleString("en-IN") ?? "\u2014"}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-foreground/25 uppercase">India VIX</div>
            <div className={`text-lg font-mono font-bold ${vixColor}`}>{vix?.toFixed(2) ?? "\u2014"}</div>
          </div>
          <div>
            <div className="text-[10px] text-foreground/25 uppercase">Interpretation</div>
            <div className="text-sm text-foreground/50">{vixInterp ?? marketData?.sentiment?.pcr_interpretation ?? "\u2014"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

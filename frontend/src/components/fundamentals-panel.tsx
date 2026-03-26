"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

const LABEL_STYLES = {
  Strong: { badge: "bg-ngreen/15 text-ngreen border-ngreen/25", dot: "bg-ngreen" },
  Good: { badge: "bg-ngreen/10 text-ngreen border-ngreen/20", dot: "bg-ngreen" },
  Average: { badge: "bg-amber/15 text-amber border-amber/25", dot: "bg-amber" },
  Weak: { badge: "bg-nred/10 text-nred border-nred/20", dot: "bg-nred" },
  Poor: { badge: "bg-nred/15 text-nred border-nred/25", dot: "bg-nred" },
} as const;

function MetricRow({ label, value, suffix }: { label: string; value: number | string | null | undefined; suffix?: string }) {
  if (value == null) return null;
  const display = typeof value === "number"
    ? value.toLocaleString("en-IN", { maximumFractionDigits: 2 }) + (suffix ?? "")
    : String(value);
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/[0.03] last:border-0">
      <span className="text-xs text-foreground/45">{label}</span>
      <span className="text-xs font-mono text-foreground/75">{display}</span>
    </div>
  );
}

export function FundamentalsPanel({ symbol }: { symbol: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["fundamentals", symbol],
    queryFn: () => api.getStockFundamentals(symbol),
  });

  if (isLoading) {
    return (
      <div className="glass-card rounded-xl p-6">
        <div className="space-y-3">
          <div className="shimmer h-4 rounded w-1/3" />
          <div className="shimmer h-3 rounded w-full" />
          <div className="shimmer h-3 rounded w-2/3" />
        </div>
      </div>
    );
  }

  if (!data || !data.fundamentals) {
    return (
      <div className="glass-card rounded-xl p-6">
        <h3 className="section-header text-xs text-foreground/40 uppercase tracking-widest mb-2">Fundamentals</h3>
        <p className="text-foreground/30 text-sm">No fundamental data yet. Trigger a refresh from Settings.</p>
      </div>
    );
  }

  const f = data.fundamentals;
  const label = data.label;
  const styles = LABEL_STYLES[label as keyof typeof LABEL_STYLES] ?? LABEL_STYLES.Average;

  const formatPct = (v: number | null | undefined) =>
    v != null ? (v * 100).toFixed(2) + "%" : null;

  const formatCr = (v: number | null | undefined) => {
    if (v == null) return null;
    const cr = v / 10000000;
    if (cr >= 100000) return `\u20B9${(cr / 100000).toFixed(2)}L Cr`;
    return `\u20B9${cr.toFixed(0)} Cr`;
  };

  return (
    <div className="glass-card rounded-xl p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="section-header text-xs text-foreground/40 uppercase tracking-widest">Fundamentals</h3>
        <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${styles.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
          {label} ({data.score.toFixed(2)})
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
        <div>
          <div className="text-[10px] text-foreground/25 font-medium mb-1.5 uppercase tracking-wide">Valuation</div>
          <MetricRow label="P/E (TTM)" value={f.trailingPE as number} />
          <MetricRow label="P/E (Forward)" value={f.forwardPE as number} />
          <MetricRow label="P/B" value={f.priceToBook as number} />
          <MetricRow label="PEG Ratio" value={f.pegRatio as number} />
          <MetricRow label="Market Cap" value={formatCr(f.marketCap as number)} />
        </div>
        <div>
          <div className="text-[10px] text-foreground/25 font-medium mb-1.5 uppercase tracking-wide">Growth & Profitability</div>
          <MetricRow label="Revenue Growth" value={formatPct(f.revenueGrowth as number)} />
          <MetricRow label="Earnings Growth" value={formatPct(f.earningsGrowth as number)} />
          <MetricRow label="Profit Margin" value={formatPct(f.profitMargins as number)} />
          <MetricRow label="Operating Margin" value={formatPct(f.operatingMargins as number)} />
          <MetricRow label="EPS (TTM)" value={f.trailingEps as number} suffix="" />
        </div>
        <div className="mt-3">
          <div className="text-[10px] text-foreground/25 font-medium mb-1.5 uppercase tracking-wide">Health</div>
          <MetricRow label="Debt/Equity" value={f.debtToEquity as number} />
          <MetricRow label="Dividend Yield" value={formatPct(f.dividendYield as number)} />
          <MetricRow label="Book Value" value={f.bookValue as number} suffix="" />
          <MetricRow label="Beta" value={f.beta as number} />
        </div>
        <div className="mt-3">
          <div className="text-[10px] text-foreground/25 font-medium mb-1.5 uppercase tracking-wide">Info</div>
          <MetricRow label="Sector" value={f.sector as string} />
          <MetricRow label="Industry" value={f.industry as string} />
          <MetricRow label="52W High" value={f.fiftyTwoWeekHigh as number} />
          <MetricRow label="52W Low" value={f.fiftyTwoWeekLow as number} />
        </div>
      </div>
    </div>
  );
}

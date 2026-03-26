"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

const MACRO_LABEL_STYLES = {
  Favorable: { badge: "bg-ngreen/15 text-ngreen border-ngreen/25", dot: "bg-ngreen" },
  "Slightly Favorable": { badge: "bg-ngreen/10 text-ngreen border-ngreen/20", dot: "bg-ngreen" },
  "Slightly Unfavorable": { badge: "bg-nred/10 text-nred border-nred/20", dot: "bg-nred" },
  Unfavorable: { badge: "bg-nred/15 text-nred border-nred/25", dot: "bg-nred" },
} as const;

function MacroRow({ name, price, change_pct }: { name: string; price: number; change_pct: number }) {
  const isPositive = change_pct >= 0;
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/[0.03] last:border-0">
      <span className="text-xs text-foreground/50">{name}</span>
      <div className="flex items-center gap-2.5">
        <span className="text-xs font-mono">{price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${isPositive ? "bg-ngreen/10 text-ngreen" : "bg-nred/10 text-nred"}`}>
          {isPositive ? "+" : ""}{change_pct.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

export function MacroDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["macro"],
    queryFn: api.getMacro,
    refetchInterval: 10 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="glass-card rounded-xl p-5 shimmer h-48" />
    );
  }

  if (!data || data.count === 0) {
    return (
      <div className="glass-card rounded-xl p-5">
        <h3 className="section-header text-xs text-foreground/40 uppercase tracking-widest mb-2">Global Macro</h3>
        <p className="text-foreground/30 text-sm">No macro data yet. Fetching on first load...</p>
      </div>
    );
  }

  const label = data.label;
  const styles = MACRO_LABEL_STYLES[label as keyof typeof MACRO_LABEL_STYLES] ?? MACRO_LABEL_STYLES.Favorable;

  const displayOrder = ["sp500", "dow", "nasdaq", "hangseng", "crude_oil", "gold", "usd_inr", "us10y"];

  return (
    <div className="glass-card rounded-xl p-5 animate-fade-in animate-fade-in-d1">
      <div className="flex items-center justify-between mb-3">
        <h3 className="section-header text-xs text-foreground/40 uppercase tracking-widest">Global Macro</h3>
        <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${styles.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
          {label}
        </div>
      </div>
      <div>
        {displayOrder.map((key) => {
          const indicator = data.indicators[key];
          if (!indicator) return null;
          return (
            <MacroRow
              key={key}
              name={indicator.name}
              price={indicator.price}
              change_pct={indicator.change_pct}
            />
          );
        })}
      </div>
    </div>
  );
}

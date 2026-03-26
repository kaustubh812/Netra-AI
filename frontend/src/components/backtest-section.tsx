"use client";

import { useQuery } from "@tanstack/react-query";
import { api, BacktestResult } from "@/lib/api";

interface Props {
  symbol: string;
}

function StatCard({ label, value, suffix, color }: { label: string; value: string | number; suffix?: string; color?: string }) {
  return (
    <div className="bg-white/[0.03] rounded-lg p-3">
      <div className="text-foreground/30 text-[10px] uppercase tracking-wide mb-0.5">{label}</div>
      <div className={`font-mono text-base font-bold ${color ?? "text-foreground"}`}>
        {value}{suffix}
      </div>
    </div>
  );
}

export function BacktestSection({ symbol }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["backtest", symbol],
    queryFn: () => api.getBacktest(symbol),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="glass-card rounded-xl p-5">
        <div className="shimmer h-4 w-40 rounded" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="glass-card rounded-xl p-5">
        <div className="text-foreground/30 text-sm">No backtest results available. Run backtest from settings to generate.</div>
      </div>
    );
  }

  const beatsBH = data.total_return > data.buy_hold_return;

  return (
    <div className="glass-card rounded-xl p-5">
      <h3 className="section-header text-xs text-foreground/40 uppercase tracking-widest mb-4">Backtest Results (2024+)</h3>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 mb-3">
        <StatCard
          label="Strategy"
          value={data.total_return.toFixed(2)}
          suffix="%"
          color={data.total_return >= 0 ? "text-ngreen" : "text-nred"}
        />
        <StatCard
          label="Buy & Hold"
          value={data.buy_hold_return.toFixed(2)}
          suffix="%"
          color={data.buy_hold_return >= 0 ? "text-ngreen" : "text-nred"}
        />
        <StatCard
          label="Sharpe"
          value={data.sharpe_ratio.toFixed(3)}
          color={data.sharpe_ratio > 1 ? "text-ngreen" : "text-foreground"}
        />
        <StatCard
          label="Max DD"
          value={data.max_drawdown.toFixed(2)}
          suffix="%"
          color="text-nred"
        />
        <StatCard label="Win Rate" value={data.win_rate.toFixed(1)} suffix="%" />
        <StatCard label="Trades" value={data.total_trades} />
        <StatCard
          label="Avg Profit"
          value={`\u20B9${data.avg_profit.toFixed(0)}`}
          color="text-ngreen"
        />
        <StatCard
          label="Avg Loss"
          value={`\u20B9${Math.abs(data.avg_loss).toFixed(0)}`}
          color="text-nred"
        />
      </div>

      {beatsBH && (
        <div className="text-xs text-ngreen rounded-lg p-2.5 font-medium"
          style={{ background: "linear-gradient(135deg, rgba(0,200,83,0.1), rgba(0,229,255,0.05))" }}
        >
          Strategy outperforms buy-and-hold by {(data.total_return - data.buy_hold_return).toFixed(2)}%
        </div>
      )}
    </div>
  );
}

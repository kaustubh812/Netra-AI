"use client";

import { useQuery } from "@tanstack/react-query";
import { api, BacktestResult } from "@/lib/api";

interface Props {
  symbol: string;
}

function StatCard({ label, value, suffix, color }: { label: string; value: string | number; suffix?: string; color?: string }) {
  return (
    <div className="bg-surface-2 rounded p-3">
      <div className="text-foreground/40 text-xs mb-1">{label}</div>
      <div className={`font-mono text-lg font-bold ${color ?? "text-foreground"}`}>
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
      <div className="bg-surface rounded-lg border border-border p-6">
        <div className="text-foreground/40">Loading backtest results...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-surface rounded-lg border border-border p-6">
        <div className="text-foreground/40 text-sm">No backtest results available. Run backtest from settings to generate.</div>
      </div>
    );
  }

  const beatsBH = data.total_return > data.buy_hold_return;

  return (
    <div className="bg-surface rounded-lg border border-border p-4">
      <h3 className="text-sm font-medium text-foreground/50 mb-4">BACKTEST RESULTS (2024+)</h3>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <StatCard
          label="Strategy Return"
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
          label="Sharpe Ratio"
          value={data.sharpe_ratio.toFixed(4)}
          color={data.sharpe_ratio > 1 ? "text-ngreen" : "text-foreground"}
        />
        <StatCard
          label="Max Drawdown"
          value={data.max_drawdown.toFixed(2)}
          suffix="%"
          color="text-nred"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Win Rate" value={data.win_rate.toFixed(1)} suffix="%" />
        <StatCard label="Total Trades" value={data.total_trades} />
        <StatCard
          label="Avg Profit"
          value={`₹${data.avg_profit.toFixed(0)}`}
          color="text-ngreen"
        />
        <StatCard
          label="Avg Loss"
          value={`₹${Math.abs(data.avg_loss).toFixed(0)}`}
          color="text-nred"
        />
      </div>

      {beatsBH && (
        <div className="mt-3 text-xs text-ngreen bg-ngreen/10 rounded p-2 font-medium">
          Strategy outperforms buy-and-hold by {(data.total_return - data.buy_hold_return).toFixed(2)}%
        </div>
      )}
    </div>
  );
}

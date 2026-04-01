"use client";

import Link from "next/link";
import { PaperTradingStats, TradeSuggestion } from "@/lib/api";
import { SignalBadge } from "@/components/signal-badge";

interface OverviewViewProps {
  stats: PaperTradingStats | null;
  suggestions: TradeSuggestion[];
  onTakeTrade: (symbol: string, signal: string) => void;
}

export function OverviewView({ stats, suggestions, onTakeTrade }: OverviewViewProps) {
  const INR = (v: number, d = 0) =>
    v.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: d });

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-card rounded-xl p-4 gradient-border-cyan">
            <div className="text-foreground/30 text-[10px] uppercase tracking-wider mb-1">Total Trades</div>
            <div className="font-mono text-xl font-bold">{stats.total_trades}</div>
            <div className="text-[10px] text-foreground/25 mt-1">
              <span className="text-cyan/50">{stats.open_count}</span> open &middot; <span className="text-foreground/40">{stats.closed_count}</span> closed
            </div>
          </div>

          <div className="glass-card rounded-xl p-4">
            <div className="text-foreground/30 text-[10px] uppercase tracking-wider mb-1">Win Rate</div>
            <div className={`font-mono text-xl font-bold ${stats.win_rate >= 50 ? "text-ngreen" : stats.win_rate > 0 ? "text-nred" : ""}`}>
              {stats.win_rate}%
            </div>
            <div className="text-[10px] text-foreground/25 mt-1">Profit factor: {stats.profit_factor}</div>
            {/* Mini bar */}
            <div className="confidence-bar mt-2">
              <div
                className="confidence-bar-fill"
                style={{
                  width: `${stats.win_rate}%`,
                  background: stats.win_rate >= 50
                    ? "linear-gradient(90deg, rgba(16,185,129,0.6), rgba(16,185,129,0.3))"
                    : "linear-gradient(90deg, rgba(244,63,94,0.6), rgba(244,63,94,0.3))",
                }}
              />
            </div>
          </div>

          <div className="glass-card rounded-xl p-4">
            <div className="text-foreground/30 text-[10px] uppercase tracking-wider mb-1">Avg Return</div>
            <div className={`font-mono text-xl font-bold ${stats.avg_return_pct >= 0 ? "text-ngreen" : "text-nred"}`}>
              {stats.avg_return_pct >= 0 ? "+" : ""}{stats.avg_return_pct}%
            </div>
          </div>

          <div className="glass-card rounded-xl p-4">
            <div className="text-foreground/30 text-[10px] uppercase tracking-wider mb-1">Total P&L</div>
            <div className={`font-mono text-xl font-bold ${(stats.total_realized_pnl + stats.total_unrealized_pnl) >= 0 ? "text-ngreen" : "text-nred"}`}>
              {(stats.total_realized_pnl + stats.total_unrealized_pnl) >= 0 ? "+" : ""}
              {INR(stats.total_realized_pnl + stats.total_unrealized_pnl)}
            </div>
            <div className="text-[10px] text-foreground/25 mt-1">
              Realized: {INR(stats.total_realized_pnl)} &middot; Unrealized: {INR(stats.total_unrealized_pnl)}
            </div>
          </div>

          {/* Best & Worst Trade */}
          {stats.best_trade && (
            <div className="glass-card rounded-xl p-4 card-glow-green">
              <div className="text-foreground/30 text-[10px] uppercase tracking-wider mb-1">Best Trade</div>
              <div className="font-mono text-sm font-bold text-ngreen">{stats.best_trade.symbol}</div>
              <div className="font-mono text-lg font-bold text-ngreen">+{INR(stats.best_trade.pnl)}</div>
            </div>
          )}

          {stats.worst_trade && (
            <div className="glass-card rounded-xl p-4 card-glow-red">
              <div className="text-foreground/30 text-[10px] uppercase tracking-wider mb-1">Worst Trade</div>
              <div className="font-mono text-sm font-bold text-nred">{stats.worst_trade.symbol}</div>
              <div className="font-mono text-lg font-bold text-nred">{INR(stats.worst_trade.pnl)}</div>
            </div>
          )}
        </div>
      )}

      {/* Suggested Trades */}
      {suggestions.length > 0 && (
        <div className="glass-card rounded-xl p-5">
          <h3 className="section-header text-xs text-foreground/40 uppercase tracking-widest mb-4">
            Suggested Trades
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {suggestions.slice(0, 8).map((s) => (
              <div
                key={s.symbol}
                className={`glass-card rounded-lg p-3.5 border transition-all hover:border-white/[0.1] ${
                  s.signal === "BUY" ? "border-ngreen/[0.08]" : "border-nred/[0.08]"
                }`}
              >
                <div className="flex items-center justify-between mb-2.5">
                  <Link
                    href={`/stock/${encodeURIComponent(s.symbol)}`}
                    className="text-cyan hover:text-cyan/80 text-sm font-medium"
                  >
                    {s.name}
                  </Link>
                  <SignalBadge signal={s.signal} size="sm" />
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-foreground/40 mb-3">
                  <div>
                    Confidence{" "}
                    <span className="text-foreground/70 font-mono">{s.confidence.toFixed(0)}%</span>
                  </div>
                  <div>
                    Entry{" "}
                    <span className="text-foreground/70 font-mono">{s.entry_price.toLocaleString("en-IN")}</span>
                  </div>
                  <div>
                    SL{" "}
                    <span className="text-nred/70 font-mono">{s.stop_loss.toLocaleString("en-IN")}</span>
                  </div>
                  <div>
                    Target{" "}
                    <span className="text-ngreen/70 font-mono">{s.target_price.toLocaleString("en-IN")}</span>
                  </div>
                </div>

                {s.ltp !== null && (
                  <div className="text-[10px] text-foreground/30 mb-2 font-mono">
                    LTP: ₹{s.ltp.toLocaleString("en-IN")}
                  </div>
                )}

                <button
                  onClick={() => onTakeTrade(s.symbol, s.signal)}
                  className={`w-full py-1.5 rounded text-[10px] font-medium transition-colors ${
                    s.signal === "BUY"
                      ? "bg-ngreen/10 text-ngreen border border-ngreen/20 hover:bg-ngreen/20"
                      : "bg-nred/10 text-nred border border-nred/20 hover:bg-nred/20"
                  }`}
                >
                  Take Trade
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!stats?.total_trades && suggestions.length === 0 && (
        <div className="glass-card rounded-xl p-16 text-center">
          <div className="text-4xl mb-4 opacity-20">🚀</div>
          <h3 className="text-foreground/40 text-sm font-medium mb-1">No trading data yet</h3>
          <p className="text-foreground/20 text-xs">Place your first paper trade to start tracking performance</p>
        </div>
      )}
    </div>
  );
}

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, OptionPosition, OptionClosedTrade, OptionTradeStats, OptionLeg } from "@/lib/api";
import { OptionsTabs } from "@/components/options-tabs";

function biasColor(bias: string) {
  const b = bias.toUpperCase();
  if (b.includes("BULL")) return "text-ngreen bg-ngreen/10 border-ngreen/30";
  if (b.includes("BEAR")) return "text-nred bg-nred/10 border-nred/30";
  return "text-cyan bg-cyan/10 border-cyan/30";
}

function fmtINR(n: number) {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function LegsTable({ legs }: { legs: OptionLeg[] }) {
  return (
    <table className="w-full text-[10px] font-mono">
      <thead className="text-foreground/30 uppercase tracking-wider">
        <tr>
          <th className="text-left py-1">Side</th>
          <th className="text-left py-1">Type</th>
          <th className="text-right py-1">Strike</th>
          <th className="text-right py-1">Premium</th>
          <th className="text-right py-1">Δ</th>
        </tr>
      </thead>
      <tbody>
        {legs.map((l, i) => (
          <tr key={i} className="border-t border-white/[0.04]">
            <td className={`py-1 ${l.side === "BUY" ? "text-ngreen" : "text-nred"}`}>{l.side}</td>
            <td className="py-1">{l.option_type}</td>
            <td className="text-right py-1">{l.strike.toLocaleString("en-IN")}</td>
            <td className="text-right py-1">{l.premium.toFixed(2)}</td>
            <td className="text-right py-1 text-foreground/40">{l.delta?.toFixed(2) ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PositionCard({ pos, onClose, closing }: { pos: OptionPosition; onClose: (id: number) => void; closing: boolean }) {
  const pnl = pos.unrealized_pnl;
  const pnlPct = pos.unrealized_pnl_pct;
  const pnlPositive = (pnl ?? 0) >= 0;

  return (
    <div className="glass-card rounded-xl p-4 animate-fade-in">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-foreground font-semibold text-sm">{pos.symbol}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] border ${biasColor(pos.bias)}`}>{pos.bias}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/[0.05] text-foreground/50 border border-white/[0.06]">{pos.lots} lot{pos.lots > 1 ? "s" : ""}</span>
          </div>
          <div className="text-foreground/50 text-xs">{pos.strategy_name}</div>
          <div className="text-foreground/30 text-[10px] mt-0.5">Exp: {pos.expiry} · Opened: {pos.trade_date}</div>
        </div>
        <div className="text-right">
          <div className={`text-lg font-mono font-bold ${pnl == null ? "text-foreground/30" : pnlPositive ? "text-ngreen" : "text-nred"}`}>
            {pnl == null ? "—" : `${pnlPositive ? "+" : ""}${fmtINR(pnl)}`}
          </div>
          {pnlPct != null && (
            <div className={`text-[10px] font-mono ${pnlPositive ? "text-ngreen/70" : "text-nred/70"}`}>
              {pnlPositive ? "+" : ""}{pnlPct.toFixed(2)}%
            </div>
          )}
          {pos.spot != null && (
            <div className="text-foreground/30 text-[10px] mt-0.5">Spot {pos.spot.toLocaleString("en-IN")}</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3 text-[10px]">
        <div className="bg-white/[0.02] rounded p-1.5">
          <div className="text-foreground/30 uppercase tracking-wider">Max Profit</div>
          <div className="font-mono text-ngreen">{fmtINR(pos.max_profit * pos.lot_size * pos.lots)}</div>
        </div>
        <div className="bg-white/[0.02] rounded p-1.5">
          <div className="text-foreground/30 uppercase tracking-wider">Max Loss</div>
          <div className="font-mono text-nred">{fmtINR(pos.max_loss * pos.lot_size * pos.lots)}</div>
        </div>
        <div className="bg-white/[0.02] rounded p-1.5">
          <div className="text-foreground/30 uppercase tracking-wider">POP</div>
          <div className="font-mono text-cyan">{pos.pop != null ? `${(pos.pop * 100).toFixed(0)}%` : "—"}</div>
        </div>
      </div>

      <LegsTable legs={pos.legs} />

      {pos.breakevens.length > 0 && (
        <div className="mt-2 text-[10px] text-foreground/40">
          Breakevens: <span className="font-mono text-amber/80">{pos.breakevens.map(b => b.toLocaleString("en-IN")).join(", ")}</span>
        </div>
      )}

      <button
        onClick={() => onClose(pos.id)}
        disabled={closing}
        className="mt-3 w-full px-3 py-2 rounded-lg text-xs font-mono bg-nred/10 text-nred border border-nred/30 hover:bg-nred/20 transition-all disabled:opacity-40"
      >
        {closing ? "Closing..." : "Close Position"}
      </button>
    </div>
  );
}

function StatsBar({ stats }: { stats: OptionTradeStats }) {
  const totalPositive = stats.total_pnl >= 0;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-5">
      <div className="glass-card rounded-xl p-3">
        <div className="text-foreground/30 text-[10px] uppercase tracking-wider">Open</div>
        <div className="font-mono text-lg text-foreground">{stats.open_trades}</div>
      </div>
      <div className="glass-card rounded-xl p-3">
        <div className="text-foreground/30 text-[10px] uppercase tracking-wider">Closed</div>
        <div className="font-mono text-lg text-foreground">{stats.closed_trades}</div>
      </div>
      <div className="glass-card rounded-xl p-3">
        <div className="text-foreground/30 text-[10px] uppercase tracking-wider">Win Rate</div>
        <div className="font-mono text-lg text-cyan">{stats.win_rate != null ? `${(stats.win_rate * 100).toFixed(0)}%` : "—"}</div>
      </div>
      <div className="glass-card rounded-xl p-3">
        <div className="text-foreground/30 text-[10px] uppercase tracking-wider">Total PnL</div>
        <div className={`font-mono text-lg ${totalPositive ? "text-ngreen" : "text-nred"}`}>{totalPositive ? "+" : ""}{fmtINR(stats.total_pnl)}</div>
      </div>
      <div className="glass-card rounded-xl p-3">
        <div className="text-foreground/30 text-[10px] uppercase tracking-wider">Best</div>
        <div className="font-mono text-lg text-ngreen">{stats.best_trade != null ? `+${fmtINR(stats.best_trade)}` : "—"}</div>
      </div>
      <div className="glass-card rounded-xl p-3">
        <div className="text-foreground/30 text-[10px] uppercase tracking-wider">Worst</div>
        <div className="font-mono text-lg text-nred">{stats.worst_trade != null ? fmtINR(stats.worst_trade) : "—"}</div>
      </div>
    </div>
  );
}

function HistoryTable({ trades }: { trades: OptionClosedTrade[] }) {
  if (trades.length === 0) {
    return <div className="text-foreground/30 text-xs py-6 text-center">No closed trades yet.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-foreground/30 uppercase tracking-wider border-b border-white/[0.06]">
            <th className="text-left py-2 px-2">Symbol</th>
            <th className="text-left py-2 px-2">Strategy</th>
            <th className="text-left py-2 px-2">Bias</th>
            <th className="text-right py-2 px-2">Lots</th>
            <th className="text-right py-2 px-2">Entry</th>
            <th className="text-right py-2 px-2">Exit</th>
            <th className="text-right py-2 px-2">PnL</th>
            <th className="text-left py-2 px-2">Opened</th>
            <th className="text-left py-2 px-2">Closed</th>
          </tr>
        </thead>
        <tbody>
          {trades.map(t => {
            const positive = t.pnl >= 0;
            return (
              <tr key={t.id} className="border-b border-white/[0.02] hover:bg-white/[0.02]">
                <td className="py-1.5 px-2 font-mono text-foreground">{t.symbol}</td>
                <td className="py-1.5 px-2 text-foreground/70">{t.strategy_name}</td>
                <td className="py-1.5 px-2"><span className={`px-1.5 py-0.5 rounded text-[9px] border ${biasColor(t.bias)}`}>{t.bias}</span></td>
                <td className="py-1.5 px-2 text-right font-mono text-foreground/60">{t.lots}</td>
                <td className="py-1.5 px-2 text-right font-mono text-foreground/60">{t.entry_net_debit.toFixed(2)}</td>
                <td className="py-1.5 px-2 text-right font-mono text-foreground/60">{t.exit_net_debit.toFixed(2)}</td>
                <td className={`py-1.5 px-2 text-right font-mono font-semibold ${positive ? "text-ngreen" : "text-nred"}`}>{positive ? "+" : ""}{fmtINR(t.pnl)}</td>
                <td className="py-1.5 px-2 text-foreground/40">{t.trade_date}</td>
                <td className="py-1.5 px-2 text-foreground/40">{t.closed_date}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function OptionsPositionsPage() {
  const qc = useQueryClient();

  const { data: posData, isLoading: posLoading } = useQuery({
    queryKey: ["option-positions"],
    queryFn: () => api.getOptionPositions(),
    refetchInterval: 30000,
  });

  const { data: histData, isLoading: histLoading } = useQuery({
    queryKey: ["option-history"],
    queryFn: () => api.getOptionTradeHistory(50),
  });

  const { data: stats } = useQuery({
    queryKey: ["option-stats"],
    queryFn: () => api.getOptionTradeStats(),
    refetchInterval: 30000,
  });

  const closeMut = useMutation({
    mutationFn: (id: number) => api.closeOptionTrade(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["option-positions"] });
      qc.invalidateQueries({ queryKey: ["option-history"] });
      qc.invalidateQueries({ queryKey: ["option-stats"] });
    },
  });

  const positions = posData?.positions ?? [];
  const history = histData?.trades ?? [];

  return (
    <div className="px-6 py-6 relative z-10">
      <h1 className="text-xl font-bold text-foreground mb-3">Options</h1>
      <OptionsTabs />

      {stats && <StatsBar stats={stats} />}

      <div className="mb-6">
        <h3 className="section-header text-xs text-foreground/40 uppercase tracking-widest mb-3">Open Positions</h3>
        {posLoading && (
          <div className="glass-card rounded-xl p-8">
            <div className="shimmer h-4 w-48 rounded mb-3" />
            <div className="space-y-2">{[1, 2].map(i => <div key={i} className="shimmer h-20 rounded" />)}</div>
          </div>
        )}
        {!posLoading && positions.length === 0 && (
          <div className="glass-card rounded-xl p-8 text-center text-foreground/30 text-sm">
            No open positions. Place trades from the <a href="/options/signals" className="text-cyan hover:underline">Signals</a> tab.
          </div>
        )}
        {positions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {positions.map(p => (
              <PositionCard
                key={p.id}
                pos={p}
                onClose={(id) => {
                  if (confirm(`Close ${p.strategy_name} on ${p.symbol}?`)) closeMut.mutate(id);
                }}
                closing={closeMut.isPending && closeMut.variables === p.id}
              />
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="section-header text-xs text-foreground/40 uppercase tracking-widest mb-3">Trade History</h3>
        <div className="glass-card rounded-xl p-4">
          {histLoading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="shimmer h-6 rounded" />)}</div>
          ) : (
            <HistoryTable trades={history} />
          )}
        </div>
      </div>
    </div>
  );
}

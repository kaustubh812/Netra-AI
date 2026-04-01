"use client";

import { StockDetail } from "@/lib/api";
import { SignalBadge } from "./signal-badge";

interface Props {
  stock: StockDetail;
}

function Gauge({ value, min, max, label, color }: { value: number; min: number; max: number; label: string; color: string }) {
  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-foreground/45">{label}</span>
        <span className="font-mono" style={{ color }}>{value.toFixed(2)}</span>
      </div>
      <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function MiniBar({ value, avg, label }: { value: number; avg: number; label: string }) {
  const ratio = avg > 0 ? value / avg : 1;
  const pct = Math.min(200, ratio * 100);
  const isAbove = ratio > 1;

  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-foreground/45">{label}</span>
        <span className={`font-mono ${isAbove ? "text-ngreen" : "text-foreground/50"}`}>
          {ratio.toFixed(2)}x
        </span>
      </div>
      <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden relative">
        <div className="absolute left-1/2 top-0 h-full w-px bg-foreground/15" />
        <div
          className={`h-full rounded-full transition-all duration-700 ${isAbove ? "bg-ngreen" : "bg-foreground/20"}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

export function IndicatorPanel({ stock }: Props) {
  const ind = stock.indicators;

  return (
    <div className="space-y-5">
      {/* Indicator Breakdown */}
      {ind && (
        <div className="glass-card rounded-xl p-5 space-y-4 animate-fade-in animate-fade-in-d1">
          <div className="section-header text-xs text-foreground/40 uppercase tracking-widest mb-1">Indicator Breakdown</div>

          <Gauge
            value={ind.rsi ?? 50}
            min={0}
            max={100}
            label="RSI (14)"
            color={(ind.rsi ?? 50) > 60 ? "#f43f5e" : (ind.rsi ?? 50) < 40 ? "#10b981" : "#ffab00"}
          />

          <Gauge
            value={ind.adx ?? 0}
            min={0}
            max={60}
            label="ADX (Trend Strength)"
            color={(ind.adx ?? 0) > 25 ? "#22d3ee" : "#666"}
          />

          <Gauge
            value={ind.stoch_k ?? 50}
            min={0}
            max={100}
            label="Stochastic %K"
            color={(ind.stoch_k ?? 50) > 80 ? "#f43f5e" : (ind.stoch_k ?? 50) < 20 ? "#10b981" : "#ffab00"}
          />

          <MiniBar
            value={1}
            avg={1 / (ind.volume_sma_20 && ind.volume_sma_20 > 0 ? 1 : 1)}
            label="Volume vs Avg"
          />

          <div className="flex justify-between text-xs pt-3 border-t border-white/[0.04]">
            <span className="text-foreground/45">Supertrend</span>
            <span className={`font-mono font-bold ${ind.supertrend_direction === 1 ? "text-ngreen" : "text-nred"}`}>
              {ind.supertrend_direction === 1 ? "\u25B2 BULLISH" : "\u25BC BEARISH"}
            </span>
          </div>

          <div className="flex justify-between text-xs">
            <span className="text-foreground/45">MACD Histogram</span>
            <span className={`font-mono ${(ind.macd_hist ?? 0) > 0 ? "text-ngreen" : "text-nred"}`}>
              {(ind.macd_hist ?? 0).toFixed(4)}
            </span>
          </div>

          <div className="flex justify-between text-xs">
            <span className="text-foreground/45">ATR (14)</span>
            <span className="font-mono">{(ind.atr ?? 0).toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Signal History */}
      {stock.signal_history.length > 0 && (
        <div className="glass-card rounded-xl p-5 animate-fade-in animate-fade-in-d2">
          <div className="section-header text-xs text-foreground/40 uppercase tracking-widest mb-3">Signal History (Last 10)</div>
          <div className="space-y-2">
            {stock.signal_history.slice(0, 10).map((s, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-white/[0.03] last:border-0">
                <span className="font-mono text-foreground/40">{s.date}</span>
                <SignalBadge signal={s.signal} confidence={s.confidence} size="sm" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

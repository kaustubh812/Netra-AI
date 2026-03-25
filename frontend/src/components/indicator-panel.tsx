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
      <div className="flex justify-between text-xs mb-1">
        <span className="text-foreground/50">{label}</span>
        <span className="font-mono" style={{ color }}>{value.toFixed(2)}</span>
      </div>
      <div className="h-1.5 bg-surface rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
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
      <div className="flex justify-between text-xs mb-1">
        <span className="text-foreground/50">{label}</span>
        <span className={`font-mono ${isAbove ? "text-ngreen" : "text-foreground/60"}`}>
          {ratio.toFixed(2)}x
        </span>
      </div>
      <div className="h-1.5 bg-surface rounded-full overflow-hidden relative">
        <div className="absolute left-1/2 top-0 h-full w-px bg-foreground/20" />
        <div
          className={`h-full rounded-full transition-all ${isAbove ? "bg-ngreen" : "bg-foreground/30"}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

export function IndicatorPanel({ stock }: Props) {
  const sig = stock.current_signal;
  const ind = stock.indicators;

  return (
    <div className="space-y-6">
      {/* Current Signal */}
      {sig && (
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="text-xs text-foreground/50 mb-2">CURRENT SIGNAL</div>
          <div className="flex items-center gap-3 mb-3">
            <SignalBadge signal={sig.signal} confidence={sig.confidence} size="lg" />
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-foreground/40 text-xs">Entry</div>
              <div className="font-mono">{sig.entry_price.toLocaleString("en-IN")}</div>
            </div>
            <div>
              <div className="text-nred/60 text-xs">Stop Loss</div>
              <div className="font-mono text-nred">{sig.stop_loss.toLocaleString("en-IN")}</div>
            </div>
            <div>
              <div className="text-ngreen/60 text-xs">Target</div>
              <div className="font-mono text-ngreen">{sig.target_price.toLocaleString("en-IN")}</div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border">
            <div className="flex justify-between text-xs">
              <span className="text-foreground/40">Risk:Reward</span>
              <span className="font-mono text-cyan">
                1:{((sig.target_price - sig.entry_price) / Math.abs(sig.entry_price - sig.stop_loss)).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span className="text-foreground/40">Model Prob</span>
              <span className="font-mono">{(sig.model_probability * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span className="text-foreground/40">Composite</span>
              <span className="font-mono">{(sig.composite_score * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Indicator Breakdown */}
      {ind && (
        <div className="bg-surface rounded-lg border border-border p-4 space-y-4">
          <div className="text-xs text-foreground/50 mb-1">INDICATOR BREAKDOWN</div>

          <Gauge
            value={ind.rsi ?? 50}
            min={0}
            max={100}
            label="RSI (14)"
            color={(ind.rsi ?? 50) > 60 ? "#ff1744" : (ind.rsi ?? 50) < 40 ? "#00c853" : "#ffab00"}
          />

          <Gauge
            value={ind.adx ?? 0}
            min={0}
            max={60}
            label="ADX (Trend Strength)"
            color={(ind.adx ?? 0) > 25 ? "#00e5ff" : "#666"}
          />

          <Gauge
            value={ind.stoch_k ?? 50}
            min={0}
            max={100}
            label="Stochastic %K"
            color={(ind.stoch_k ?? 50) > 80 ? "#ff1744" : (ind.stoch_k ?? 50) < 20 ? "#00c853" : "#ffab00"}
          />

          <MiniBar
            value={1}
            avg={1 / (ind.volume_sma_20 && ind.volume_sma_20 > 0 ? 1 : 1)}
            label="Volume vs Avg"
          />

          <div className="flex justify-between text-xs pt-2 border-t border-border">
            <span className="text-foreground/50">Supertrend</span>
            <span className={`font-mono font-bold ${ind.supertrend_direction === 1 ? "text-ngreen" : "text-nred"}`}>
              {ind.supertrend_direction === 1 ? "▲ BULLISH" : "▼ BEARISH"}
            </span>
          </div>

          <div className="flex justify-between text-xs">
            <span className="text-foreground/50">MACD Histogram</span>
            <span className={`font-mono ${(ind.macd_hist ?? 0) > 0 ? "text-ngreen" : "text-nred"}`}>
              {(ind.macd_hist ?? 0).toFixed(4)}
            </span>
          </div>

          <div className="flex justify-between text-xs">
            <span className="text-foreground/50">ATR (14)</span>
            <span className="font-mono">{(ind.atr ?? 0).toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Signal History */}
      {stock.signal_history.length > 0 && (
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="text-xs text-foreground/50 mb-3">SIGNAL HISTORY (Last 10)</div>
          <div className="space-y-2">
            {stock.signal_history.slice(0, 10).map((s, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="font-mono text-foreground/50">{s.date}</span>
                <SignalBadge signal={s.signal} confidence={s.confidence} size="sm" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

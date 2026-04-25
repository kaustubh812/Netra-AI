"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, OptionsSignal, OptionStrategy, OptionLeg } from "@/lib/api";
import { OptionsTabs } from "@/components/options-tabs";

const BIAS_STYLE: Record<string, string> = {
  bullish: "bg-ngreen/15 text-ngreen border-ngreen/30",
  bearish: "bg-nred/15 text-nred border-nred/30",
  neutral: "bg-amber/15 text-amber border-amber/30",
  volatility_long: "bg-purple/15 text-purple border-purple/30",
};

const REGIME_LABEL: Record<string, string> = {
  trending_up: "Trending Up",
  trending_down: "Trending Down",
  ranging: "Ranging",
  volatile: "Volatile",
};

function formatINR(n: number): string {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function StrategyCard({
  signal,
  strategy,
  isPrimary,
  onTrade,
}: {
  signal: OptionsSignal;
  strategy: OptionStrategy;
  isPrimary: boolean;
  onTrade: (s: OptionStrategy) => void;
}) {
  const cardClass = isPrimary
    ? "glass-card rounded-xl p-5 gradient-border-cyan animate-fade-in"
    : "glass-card rounded-xl p-5 animate-fade-in";

  const isCredit = strategy.net_debit < 0;
  const popPct = Math.round(strategy.pop * 100);

  return (
    <div className={cardClass}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-semibold text-foreground">{strategy.name}</h3>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border uppercase tracking-wider ${BIAS_STYLE[strategy.bias] || ""}`}>
              {strategy.bias.replace("_", " ")}
            </span>
            {isPrimary && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border uppercase tracking-wider bg-cyan/15 text-cyan border-cyan/30">
                Top pick
              </span>
            )}
          </div>
          <p className="text-foreground/45 text-xs">{strategy.rationale}</p>
        </div>
        <button
          onClick={() => onTrade(strategy)}
          className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan/15 text-cyan border border-cyan/30 hover:bg-cyan/25 transition-colors"
        >
          Take Trade
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 pt-3 border-t border-white/[0.06]">
        <div>
          <div className="text-foreground/30 text-[10px] uppercase tracking-wide mb-0.5">POP</div>
          <div className={`font-mono text-base font-semibold ${popPct >= 65 ? "text-ngreen" : popPct >= 50 ? "text-amber" : "text-nred"}`}>
            {popPct}%
          </div>
        </div>
        <div>
          <div className="text-foreground/30 text-[10px] uppercase tracking-wide mb-0.5">Confidence</div>
          <div className="font-mono text-base font-semibold text-cyan">{Math.round(strategy.confidence * 100)}%</div>
        </div>
        <div>
          <div className="text-ngreen/50 text-[10px] uppercase tracking-wide mb-0.5">Max Profit</div>
          <div className="font-mono text-base font-semibold text-ngreen">
            {strategy.max_profit >= 999_000 ? "Unlimited" : `₹${formatINR(strategy.max_profit)}`}
          </div>
        </div>
        <div>
          <div className="text-nred/50 text-[10px] uppercase tracking-wide mb-0.5">Max Loss</div>
          <div className="font-mono text-base font-semibold text-nred">
            ₹{formatINR(Math.abs(strategy.max_loss))}
          </div>
        </div>
      </div>

      {/* Legs */}
      <div className="mb-4">
        <div className="text-foreground/25 text-[10px] uppercase tracking-wider mb-2">Legs</div>
        <div className="space-y-1.5">
          {strategy.legs.map((leg: OptionLeg, i: number) => (
            <div key={i} className="flex items-center gap-3 text-xs font-mono bg-white/[0.02] rounded-lg px-3 py-2">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${leg.action === "BUY" ? "bg-ngreen/15 text-ngreen" : "bg-nred/15 text-nred"}`}>
                {leg.action}
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${leg.opt_type === "CE" ? "bg-cyan/15 text-cyan" : "bg-amber/15 text-amber"}`}>
                {leg.opt_type}
              </span>
              <span className="text-foreground font-semibold">{leg.strike}</span>
              <span className="text-foreground/40 ml-auto">@ ₹{leg.premium.toFixed(2)}</span>
              <span className="text-foreground/30 text-[10px]">δ {leg.delta.toFixed(3)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Suggested exits */}
      <div className="grid grid-cols-2 gap-3 mb-3 p-3 rounded-lg bg-cyan/[0.03] border border-cyan/[0.08]">
        <div>
          <div className="text-ngreen/60 text-[10px] uppercase tracking-wide mb-0.5">🎯 Target (book 50% MP)</div>
          <div className="font-mono text-sm font-semibold text-ngreen">
            {strategy.max_profit >= 999_000 ? "Trail SL" : `+₹${formatINR(strategy.max_profit * 0.5)}`}
          </div>
        </div>
        <div>
          <div className="text-nred/60 text-[10px] uppercase tracking-wide mb-0.5">🛑 Stop (50% Max Loss)</div>
          <div className="font-mono text-sm font-semibold text-nred">
            -₹{formatINR(Math.abs(strategy.max_loss) * 0.5)}
          </div>
        </div>
      </div>

      {/* Footer stats */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-3 border-t border-white/[0.06] text-[11px]">
        <span className="text-foreground/40">
          {isCredit ? "Credit" : "Debit"}: <span className={`font-mono font-semibold ${isCredit ? "text-ngreen" : "text-amber"}`}>
            ₹{formatINR(Math.abs(strategy.net_debit))}
          </span>
        </span>
        <span className="text-foreground/40">
          R:R: <span className="font-mono font-semibold text-cyan">
            1:{strategy.risk_reward >= 99 ? "∞" : strategy.risk_reward.toFixed(2)}
          </span>
        </span>
        <span className="text-foreground/40">
          Breakeven: <span className="font-mono font-semibold text-foreground/70">
            {strategy.breakevens.map(b => formatINR(b)).join(" / ")}
          </span>
        </span>
        <span className="text-foreground/40">
          Margin: <span className="font-mono font-semibold text-foreground/70">₹{formatINR(strategy.margin_required)}</span>
        </span>
      </div>
    </div>
  );
}

function PayoffChart({ signal, strategy }: { signal: OptionsSignal; strategy: OptionStrategy }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { data: payoff } = useQuery({
    queryKey: ["payoff", signal.symbol, strategy.name],
    queryFn: () => api.computeOptionsPayoff(signal.symbol, strategy, 0.05),
  });

  useEffect(() => {
    if (!payoff || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const points = payoff.points;
    if (!points.length) return;
    const minPnL = Math.min(...points.map(p => p.pnl));
    const maxPnL = Math.max(...points.map(p => p.pnl));
    const minSpot = points[0].spot;
    const maxSpot = points[points.length - 1].spot;
    const padY = 20;
    const padX = 10;
    const span = Math.max(Math.abs(minPnL), Math.abs(maxPnL)) * 1.1 || 1;

    const xScale = (s: number) => padX + ((s - minSpot) / (maxSpot - minSpot)) * (W - padX * 2);
    const yScale = (p: number) => H / 2 - (p / span) * (H / 2 - padY);

    // Zero line
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(padX, H / 2);
    ctx.lineTo(W - padX, H / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Spot marker
    const spotX = xScale(signal.underlying);
    ctx.strokeStyle = "rgba(34,211,238,0.4)";
    ctx.beginPath();
    ctx.moveTo(spotX, padY);
    ctx.lineTo(spotX, H - padY);
    ctx.stroke();

    // Fill profit (green) / loss (red) regions
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = xScale(p.spot);
      const y = yScale(p.pnl);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(xScale(points[points.length - 1].spot), H / 2);
    ctx.lineTo(xScale(points[0].spot), H / 2);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "rgba(16,185,129,0.25)");
    grad.addColorStop(0.5, "rgba(16,185,129,0)");
    grad.addColorStop(0.5, "rgba(244,63,94,0)");
    grad.addColorStop(1, "rgba(244,63,94,0.25)");
    ctx.fillStyle = grad;
    ctx.fill();

    // Payoff line
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = xScale(p.spot);
      const y = yScale(p.pnl);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Breakeven dots
    ctx.fillStyle = "#facc15";
    strategy.breakevens.forEach(be => {
      if (be >= minSpot && be <= maxSpot) {
        ctx.beginPath();
        ctx.arc(xScale(be), H / 2, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }, [payoff, signal, strategy]);

  return (
    <div>
      <div className="text-foreground/25 text-[10px] uppercase tracking-wider mb-2">Payoff at expiry (±5%)</div>
      <canvas ref={canvasRef} className="w-full h-32" />
    </div>
  );
}

function SignalSection({ signal, onTrade }: { signal: OptionsSignal; onTrade: (sym: string, s: OptionStrategy) => void }) {
  const [selectedStrategy, setSelectedStrategy] = useState<OptionStrategy>(signal.recommended);
  return (
    <div className="mb-8">
      <div className="glass-card rounded-xl p-4 mb-4 animate-fade-in">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-foreground">{signal.symbol}</h2>
            <div className="text-foreground/40 text-xs mt-0.5">
              Spot <span className="text-foreground font-mono font-semibold">{formatINR(signal.underlying)}</span>
              {"  ·  "}Expiry <span className="text-foreground/70 font-mono">{signal.expiry}</span>
              {"  ·  "}Lot {signal.lot_size}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            <span className="text-foreground/40">Regime: <span className="text-foreground/80 font-semibold">{REGIME_LABEL[signal.regime] || signal.regime}</span></span>
            <span className="text-foreground/40">Bias: <span className={`font-semibold ${signal.bias === "BUY" ? "text-ngreen" : signal.bias === "SELL" ? "text-nred" : "text-amber"}`}>{signal.bias}</span></span>
            <span className="text-foreground/40">IV: <span className="text-foreground/80 font-mono font-semibold">{signal.iv}%</span> <span className="text-foreground/30 text-[10px]">({signal.iv_regime})</span></span>
            <span className="text-foreground/40">PCR: <span className="text-foreground/80 font-mono font-semibold">{signal.pcr.toFixed(2)}</span></span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2">
          <StrategyCard
            signal={signal}
            strategy={selectedStrategy}
            isPrimary={selectedStrategy.code === signal.recommended.code}
            onTrade={(s) => onTrade(signal.symbol, s)}
          />
        </div>
        <div className="glass-card rounded-xl p-4 animate-fade-in">
          <PayoffChart signal={signal} strategy={selectedStrategy} />
        </div>
      </div>

      {signal.alternatives.length > 0 && (
        <>
          <div className="text-foreground/30 text-[10px] uppercase tracking-wider mb-2">Alternatives</div>
          <div className="flex flex-wrap gap-2 mb-3">
            {[signal.recommended, ...signal.alternatives].map((s) => (
              <button
                key={s.code}
                onClick={() => setSelectedStrategy(s)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-mono border transition-all ${
                  selectedStrategy.code === s.code
                    ? "bg-cyan/15 text-cyan border-cyan/30"
                    : "bg-white/[0.03] text-foreground/40 border-white/[0.06] hover:text-foreground"
                }`}
              >
                {s.name} <span className="text-foreground/40">· {Math.round(s.confidence * 100)}%</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function OptionsSignalsPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["options-signals"],
    queryFn: () => api.getOptionsSignals(),
    refetchInterval: 5 * 60 * 1000,
  });

  const placeMut = useMutation({
    mutationFn: ({ symbol, strategy, lots }: { symbol: string; strategy: OptionStrategy; lots: number }) =>
      api.placeOptionTrade(symbol, strategy, lots),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["option-positions"] });
    },
  });

  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  function handleTrade(symbol: string, strategy: OptionStrategy) {
    const lotsStr = window.prompt(`Lots for ${strategy.name}? (default 1)`, "1");
    if (lotsStr === null) return;
    const lots = parseInt(lotsStr) || 1;
    placeMut.mutate(
      { symbol, strategy, lots },
      {
        onSuccess: () => setFeedback({ ok: true, msg: `Placed ${strategy.name} × ${lots} lot(s)` }),
        onError: (e: Error) => setFeedback({ ok: false, msg: e.message }),
      }
    );
    setTimeout(() => setFeedback(null), 4000);
  }

  return (
    <div className="px-6 py-6 relative z-10">
      <h1 className="text-xl font-bold text-foreground mb-3">Options</h1>
      <OptionsTabs />

      {feedback && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${feedback.ok ? "bg-ngreen/10 text-ngreen border border-ngreen/30" : "bg-nred/10 text-nred border border-nred/30"}`}>
          {feedback.msg}
        </div>
      )}

      {isLoading && (
        <div className="glass-card rounded-xl p-8">
          <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="shimmer h-32 rounded" />)}</div>
        </div>
      )}

      {error && (
        <div className="text-nred">Failed to load options signals.</div>
      )}

      {data && data.signals.length === 0 && (
        <div className="glass-card rounded-xl p-12 text-center">
          <div className="text-foreground/25 text-sm">No options signals available right now.</div>
        </div>
      )}

      {data?.signals.map((sig) => (
        <SignalSection key={sig.symbol} signal={sig} onTrade={handleTrade} />
      ))}
    </div>
  );
}

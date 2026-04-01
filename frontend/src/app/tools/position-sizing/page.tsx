"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, KellyCriterion } from "@/lib/api";

export default function PositionSizingPage() {
  const [account, setAccount] = useState(500000);
  const [riskPct, setRiskPct] = useState(2);
  const [entry, setEntry] = useState(1500);
  const [stopLoss, setStopLoss] = useState(1450);
  const [target, setTarget] = useState(1600);

  const { data: kelly } = useQuery<KellyCriterion>({
    queryKey: ["kelly-criterion"],
    queryFn: api.getKellyCriterion,
  });

  // Client-side calculation for instant feedback (no API round-trip)
  const result = useMemo(() => {
    if (entry <= 0 || stopLoss <= 0 || account <= 0) return null;
    const riskPerShare = Math.abs(entry - stopLoss);
    if (riskPerShare === 0) return null;

    const riskAmount = account * (riskPct / 100);
    const shares = Math.floor(riskAmount / riskPerShare);
    const posValue = shares * entry;
    const posPct = (posValue / account) * 100;
    const isLong = entry > stopLoss;
    const maxLoss = shares * riskPerShare;

    let rrRatio: number | null = null;
    let potentialGain: number | null = null;
    if (target > 0) {
      const rewardPerShare = isLong ? target - entry : entry - target;
      if (rewardPerShare > 0) {
        rrRatio = rewardPerShare / riskPerShare;
        potentialGain = shares * rewardPerShare;
      }
    }

    return {
      shares,
      posValue,
      posPct,
      riskAmount,
      riskPerShare,
      maxLoss,
      potentialGain,
      rrRatio,
      direction: isLong ? "LONG" : "SHORT",
    };
  }, [account, riskPct, entry, stopLoss, target]);

  return (
    <div className="min-h-screen p-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="section-header text-xl font-bold text-foreground/90">Position Sizing Calculator</h1>
        <p className="text-foreground/30 text-sm mt-1 ml-5">
          Calculate optimal position size based on your risk tolerance
        </p>
      </div>

      <div className="grid grid-cols-12 gap-5">
        {/* Input Panel */}
        <div className="col-span-12 lg:col-span-5">
          <div className="glass-card rounded-2xl p-6 gradient-border-cyan space-y-5">
            <h2 className="text-sm font-semibold text-foreground/60 uppercase tracking-wider">Parameters</h2>

            <InputField
              label="Account Size"
              prefix="&#8377;"
              value={account}
              onChange={setAccount}
              step={10000}
              min={0}
            />

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-foreground/40 font-medium">Risk Per Trade</label>
                <span className="text-sm font-mono font-bold text-cyan">{riskPct}%</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={10}
                step={0.25}
                value={riskPct}
                onChange={(e) => setRiskPct(parseFloat(e.target.value))}
                className="w-full accent-cyan-400"
                style={{ accentColor: "var(--cyan)" }}
              />
              <div className="flex justify-between text-[10px] text-foreground/20 mt-1">
                <span>0.5%</span>
                <span>Conservative (1-2%)</span>
                <span>10%</span>
              </div>
            </div>

            <InputField label="Entry Price" prefix="&#8377;" value={entry} onChange={setEntry} step={1} min={0.01} />
            <InputField label="Stop Loss" prefix="&#8377;" value={stopLoss} onChange={setStopLoss} step={1} min={0.01} />
            <InputField label="Target Price" prefix="&#8377;" value={target} onChange={setTarget} step={1} min={0} />

            {/* Quick presets */}
            <div>
              <p className="text-[10px] text-foreground/30 uppercase tracking-wider mb-2">Quick Presets</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Conservative", risk: 1 },
                  { label: "Moderate", risk: 2 },
                  { label: "Aggressive", risk: 5 },
                ].map((p) => (
                  <button
                    key={p.label}
                    onClick={() => setRiskPct(p.risk)}
                    className="text-[11px] px-3 py-1.5 rounded-lg font-medium transition-all"
                    style={{
                      background: riskPct === p.risk ? "rgba(34,211,238,0.15)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${riskPct === p.risk ? "rgba(34,211,238,0.3)" : "rgba(255,255,255,0.06)"}`,
                      color: riskPct === p.risk ? "var(--cyan)" : "rgba(255,255,255,0.4)",
                    }}
                  >
                    {p.label} ({p.risk}%)
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Kelly Criterion */}
          {kelly && (
            <div className="glass-card rounded-2xl p-6 mt-5 gradient-border-green animate-fade-in animate-fade-in-d2">
              <h2 className="text-sm font-semibold text-foreground/60 uppercase tracking-wider mb-4">
                Kelly Criterion
                <span className="text-[10px] text-foreground/25 ml-2 normal-case">(from paper trading)</span>
              </h2>
              {kelly.available ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <MetricBox label="Full Kelly" value={`${kelly.kelly_pct}%`} dim />
                    <MetricBox label="Half Kelly" value={`${kelly.half_kelly_pct}%`} highlight />
                    <MetricBox label="Quarter Kelly" value={`${kelly.quarter_kelly_pct}%`} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <MetricBox label="Win Rate" value={`${kelly.win_rate}%`} />
                    <MetricBox label="Payoff Ratio" value={`${kelly.payoff_ratio}x`} />
                    <MetricBox label="Trades" value={`${kelly.closed_trades}`} />
                  </div>
                  <p className="text-[10px] text-foreground/25 mt-2">
                    Half Kelly is recommended — it provides ~75% of optimal growth with much lower volatility.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-foreground/30">{kelly.reason}</p>
              )}
            </div>
          )}
        </div>

        {/* Results Panel */}
        <div className="col-span-12 lg:col-span-7">
          {result && result.shares > 0 ? (
            <div className="space-y-5 animate-fade-in animate-fade-in-d1">
              {/* Primary result */}
              <div className="glass-card-hero rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-foreground/60 uppercase tracking-wider">Result</h2>
                  <span
                    className="text-xs font-bold px-2.5 py-1 rounded-md"
                    style={{
                      background: result.direction === "LONG" ? "rgba(16,185,129,0.15)" : "rgba(244,63,94,0.15)",
                      color: result.direction === "LONG" ? "var(--green-bright)" : "var(--red-bright)",
                    }}
                  >
                    {result.direction}
                  </span>
                </div>

                <div className="text-center mb-6">
                  <p className="text-foreground/30 text-xs mb-1">Optimal Position</p>
                  <p className="text-5xl font-bold text-gradient-cyan font-mono">{result.shares}</p>
                  <p className="text-foreground/40 text-sm mt-1">shares</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <ResultCard
                    label="Position Value"
                    value={`\u20B9${result.posValue.toLocaleString("en-IN")}`}
                    sub={`${result.posPct.toFixed(1)}% of account`}
                  />
                  <ResultCard
                    label="Risk Amount"
                    value={`\u20B9${result.riskAmount.toLocaleString("en-IN")}`}
                    sub={`${riskPct}% of account`}
                    color="amber"
                  />
                  <ResultCard
                    label="Max Loss"
                    value={`\u20B9${result.maxLoss.toLocaleString("en-IN")}`}
                    sub={`\u20B9${result.riskPerShare.toFixed(2)} per share`}
                    color="red"
                  />
                  {result.potentialGain !== null ? (
                    <ResultCard
                      label="Potential Gain"
                      value={`\u20B9${result.potentialGain.toLocaleString("en-IN")}`}
                      sub={result.rrRatio ? `${result.rrRatio.toFixed(1)}:1 R:R` : ""}
                      color="green"
                    />
                  ) : (
                    <ResultCard label="Potential Gain" value="--" sub="Set target price" />
                  )}
                </div>
              </div>

              {/* Risk-Reward Visual */}
              {result.rrRatio !== null && result.rrRatio > 0 && (
                <div className="glass-card rounded-2xl p-6">
                  <h3 className="text-sm font-semibold text-foreground/60 uppercase tracking-wider mb-4">Risk / Reward</h3>
                  <RiskRewardBar entry={entry} stopLoss={stopLoss} target={target} rrRatio={result.rrRatio} />
                </div>
              )}

              {/* Account Impact */}
              <div className="glass-card rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-foreground/60 uppercase tracking-wider mb-4">Account Impact</h3>
                <div className="space-y-3">
                  <BarRow label="Position Size" pct={result.posPct} color="cyan" />
                  <BarRow label="Capital at Risk" pct={riskPct} color="amber" />
                  <BarRow label="Available After" pct={100 - result.posPct} color="green" />
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-card rounded-2xl p-12 text-center">
              <p className="text-foreground/20 text-sm">Adjust parameters to calculate position size</p>
              {result && result.shares === 0 && (
                <p className="text-amber-400/60 text-xs mt-2">Risk amount too small for the given stop loss distance</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────

function InputField({
  label,
  prefix,
  value,
  onChange,
  step,
  min,
}: {
  label: string;
  prefix?: string;
  value: number;
  onChange: (v: number) => void;
  step: number;
  min: number;
}) {
  return (
    <div>
      <label className="text-xs text-foreground/40 font-medium block mb-1.5">{label}</label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/25 text-sm" dangerouslySetInnerHTML={{ __html: prefix }} />
        )}
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          step={step}
          min={min}
          className="w-full rounded-lg py-2.5 pr-3 text-sm font-mono text-foreground/80 outline-none focus:border-cyan/40 transition-colors"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            paddingLeft: prefix ? "2rem" : "0.75rem",
          }}
        />
      </div>
    </div>
  );
}

function MetricBox({ label, value, highlight, dim }: { label: string; value: string; highlight?: boolean; dim?: boolean }) {
  return (
    <div
      className="rounded-lg p-3 text-center"
      style={{
        background: highlight ? "rgba(34,211,238,0.08)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${highlight ? "rgba(34,211,238,0.2)" : "rgba(255,255,255,0.05)"}`,
      }}
    >
      <p className="text-[10px] text-foreground/30 mb-1">{label}</p>
      <p
        className="text-sm font-bold font-mono"
        style={{
          color: highlight ? "var(--cyan)" : dim ? "var(--foreground)" : "var(--foreground)",
          opacity: dim ? 0.4 : 0.8,
        }}
      >
        {value}
      </p>
    </div>
  );
}

function ResultCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  const colors: Record<string, string> = {
    green: "var(--green-bright)",
    red: "var(--red-bright)",
    amber: "var(--amber)",
    cyan: "var(--cyan)",
  };
  return (
    <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <p className="text-[10px] text-foreground/30 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-lg font-bold font-mono" style={{ color: color ? colors[color] : "var(--foreground)" }}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-foreground/25 mt-0.5">{sub}</p>}
    </div>
  );
}

function RiskRewardBar({ entry, stopLoss, target, rrRatio }: { entry: number; stopLoss: number; target: number; rrRatio: number }) {
  const range = target - stopLoss;
  const entryPct = ((entry - stopLoss) / range) * 100;
  const isGood = rrRatio >= 2;
  const isOk = rrRatio >= 1;

  return (
    <div>
      <div className="relative h-8 rounded-lg overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
        {/* Risk zone (stop to entry) */}
        <div
          className="absolute top-0 bottom-0 left-0"
          style={{
            width: `${entryPct}%`,
            background: "linear-gradient(90deg, rgba(244,63,94,0.3), rgba(244,63,94,0.15))",
          }}
        />
        {/* Reward zone (entry to target) */}
        <div
          className="absolute top-0 bottom-0 right-0"
          style={{
            width: `${100 - entryPct}%`,
            background: "linear-gradient(90deg, rgba(16,185,129,0.15), rgba(16,185,129,0.3))",
          }}
        />
        {/* Entry marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5"
          style={{ left: `${entryPct}%`, background: "rgba(255,255,255,0.6)" }}
        />
      </div>
      <div className="flex justify-between mt-2 text-[10px]">
        <span className="text-red-400 font-mono">{"\u20B9"}{stopLoss}</span>
        <span className="text-foreground/50 font-mono">Entry: {"\u20B9"}{entry}</span>
        <span className="text-green-400 font-mono">{"\u20B9"}{target}</span>
      </div>
      <div className="text-center mt-2">
        <span
          className="text-xs font-bold px-3 py-1 rounded-full"
          style={{
            background: isGood ? "rgba(16,185,129,0.15)" : isOk ? "rgba(245,158,11,0.15)" : "rgba(244,63,94,0.15)",
            color: isGood ? "var(--green-bright)" : isOk ? "var(--amber)" : "var(--red-bright)",
          }}
        >
          {rrRatio.toFixed(1)}:1 {isGood ? "Favorable" : isOk ? "Acceptable" : "Poor"}
        </span>
      </div>
    </div>
  );
}

function BarRow({ label, pct, color }: { label: string; pct: number; color: string }) {
  const colors: Record<string, string> = {
    cyan: "var(--cyan)",
    amber: "var(--amber)",
    green: "var(--green)",
  };
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-foreground/40">{label}</span>
        <span className="font-mono text-foreground/60">{pct.toFixed(1)}%</span>
      </div>
      <div className="confidence-bar">
        <div
          className="confidence-bar-fill"
          style={{
            width: `${Math.min(pct, 100)}%`,
            background: colors[color] || "var(--cyan)",
            color: colors[color] || "var(--cyan)",
          }}
        />
      </div>
    </div>
  );
}

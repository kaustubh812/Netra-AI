"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, OptionStrike, OptionChainData } from "@/lib/api";

const SYMBOLS = ["NIFTY", "BANKNIFTY"];

export default function OptionsPage() {
  const [symbol, setSymbol] = useState("NIFTY");
  const [expiry, setExpiry] = useState<string | undefined>(undefined);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { data: chain, isLoading } = useQuery<OptionChainData | null>({
    queryKey: ["options", symbol, expiry],
    queryFn: () => api.getOptionsChain(symbol, expiry).catch(() => null),
    retry: false,
  });

  // OI bar chart
  useEffect(() => {
    if (!chain || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const strikes = chain.strikes.filter(s => s.call_oi > 0 || s.put_oi > 0);
    if (strikes.length === 0) return;

    const maxOI = Math.max(...strikes.map(s => Math.max(s.call_oi, s.put_oi)));
    const barW = Math.max(2, (width - 40) / strikes.length / 2 - 1);
    const margin = 20;
    const chartH = height - margin * 2;

    strikes.forEach((s, i) => {
      const x = margin + i * (barW * 2 + 2);
      const callH = (s.call_oi / maxOI) * chartH;
      const putH = (s.put_oi / maxOI) * chartH;

      ctx.fillStyle = "rgba(0, 200, 83, 0.6)";
      ctx.fillRect(x, height - margin - callH, barW, callH);

      ctx.fillStyle = "rgba(255, 23, 68, 0.6)";
      ctx.fillRect(x + barW + 1, height - margin - putH, barW, putH);

      // ATM marker
      if (s.strike === chain.atm_strike) {
        ctx.fillStyle = "#facc15";
        ctx.fillRect(x - 1, height - margin, barW * 2 + 3, 2);
      }
    });
  }, [chain]);

  return (
    <div className="px-6 py-6 relative z-10">
      <h1 className="text-xl font-bold text-foreground mb-5">Options Chain</h1>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex gap-1.5">
          {SYMBOLS.map(s => (
            <button
              key={s}
              onClick={() => { setSymbol(s); setExpiry(undefined); }}
              className={`px-4 py-1.5 rounded-full text-xs font-mono transition-all ${
                symbol === s
                  ? "bg-cyan/15 text-cyan border border-cyan/30"
                  : "bg-white/[0.03] text-foreground/40 border border-white/[0.06] hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        {chain?.expiry_dates && chain.expiry_dates.length > 0 && (
          <select
            value={expiry || chain.expiry}
            onChange={e => setExpiry(e.target.value)}
            className="bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-foreground outline-none focus:border-cyan/40"
          >
            {chain.expiry_dates.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        )}
        {chain && (
          <div className="ml-auto flex items-center gap-4 text-xs">
            <span className="text-foreground/40">Spot: <span className="text-foreground font-mono font-semibold">{chain.underlying.toLocaleString("en-IN")}</span></span>
            <span className="text-foreground/40">PCR: <span className="text-cyan font-mono font-semibold">{chain.pcr}</span></span>
            <span className="text-foreground/40">Max Pain: <span className="text-amber font-mono font-semibold">{chain.max_pain.toLocaleString("en-IN")}</span></span>
            {chain.source && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple/15 text-purple/70 border border-purple/20">{chain.source}</span>
            )}
          </div>
        )}
      </div>

      {isLoading && (
        <div className="glass-card rounded-xl p-8">
          <div className="shimmer h-4 w-48 rounded mx-auto mb-4" />
          <div className="space-y-2">{[1, 2, 3, 4, 5].map(i => <div key={i} className="shimmer h-8 rounded" />)}</div>
        </div>
      )}

      {chain && !isLoading && (
        <>
          {/* OI Distribution Chart */}
          <div className="glass-card rounded-xl p-4 mb-5 animate-fade-in">
            <h3 className="section-header text-xs text-foreground/40 uppercase tracking-widest mb-3">OI Distribution</h3>
            <div className="flex items-center gap-4 mb-2 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-ngreen/60" /> Call OI</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-nred/60" /> Put OI</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-1 rounded-sm bg-amber" /> ATM</span>
            </div>
            <canvas ref={canvasRef} className="w-full h-32" />
          </div>

          {/* Max Pain Card */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5 animate-fade-in animate-fade-in-d1">
            <div className="glass-card rounded-xl p-4">
              <div className="text-foreground/30 text-[10px] uppercase tracking-wider mb-1">Max Pain</div>
              <div className="font-mono text-xl font-bold text-amber">{chain.max_pain.toLocaleString("en-IN")}</div>
              <div className="text-foreground/25 text-[10px] mt-1">
                {chain.underlying > chain.max_pain ? `Spot ${((chain.underlying - chain.max_pain) / chain.max_pain * 100).toFixed(1)}% above` : `Spot ${((chain.max_pain - chain.underlying) / chain.max_pain * 100).toFixed(1)}% below`}
              </div>
            </div>
            <div className="glass-card rounded-xl p-4">
              <div className="text-foreground/30 text-[10px] uppercase tracking-wider mb-1">Total Call OI</div>
              <div className="font-mono text-xl font-bold text-ngreen">{(chain.total_call_oi / 1e6).toFixed(2)}M</div>
            </div>
            <div className="glass-card rounded-xl p-4">
              <div className="text-foreground/30 text-[10px] uppercase tracking-wider mb-1">Total Put OI</div>
              <div className="font-mono text-xl font-bold text-nred">{(chain.total_put_oi / 1e6).toFixed(2)}M</div>
            </div>
          </div>

          {/* Strike Table */}
          <div className="glass-card rounded-xl p-5 animate-fade-in animate-fade-in-d2">
            <h3 className="section-header text-xs text-foreground/40 uppercase tracking-widest mb-3">Option Chain</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th colSpan={5} className="text-center text-ngreen/60 py-1.5 uppercase tracking-wider">Calls</th>
                    <th className="text-center py-1.5 text-foreground/40 uppercase tracking-wider">Strike</th>
                    <th colSpan={5} className="text-center text-nred/60 py-1.5 uppercase tracking-wider">Puts</th>
                  </tr>
                  <tr className="text-foreground/25 uppercase tracking-wider border-b border-white/[0.06]">
                    <th className="text-right py-1.5 px-1.5">OI</th>
                    <th className="text-right py-1.5 px-1.5">LTP</th>
                    <th className="text-right py-1.5 px-1.5">IV</th>
                    <th className="text-right py-1.5 px-1.5">Delta</th>
                    <th className="text-right py-1.5 px-1.5">Theta</th>
                    <th className="text-center py-1.5 px-1.5"></th>
                    <th className="text-right py-1.5 px-1.5">Delta</th>
                    <th className="text-right py-1.5 px-1.5">IV</th>
                    <th className="text-right py-1.5 px-1.5">LTP</th>
                    <th className="text-right py-1.5 px-1.5">OI</th>
                    <th className="text-right py-1.5 px-1.5">Theta</th>
                  </tr>
                </thead>
                <tbody>
                  {chain.strikes.map((s: OptionStrike) => {
                    const isATM = s.strike === chain.atm_strike;
                    const isMaxPain = s.strike === chain.max_pain;
                    const isITMCall = s.strike < chain.underlying;
                    const isITMPut = s.strike > chain.underlying;
                    return (
                      <tr
                        key={s.strike}
                        className={`border-b border-white/[0.02] ${isATM ? "bg-amber/[0.06]" : ""} ${isMaxPain ? "bg-cyan/[0.04]" : ""}`}
                      >
                        <td className={`text-right py-1.5 px-1.5 font-mono ${isITMCall ? "bg-ngreen/[0.04]" : ""}`}>{s.call_oi > 0 ? (s.call_oi / 1000).toFixed(0) + "K" : "—"}</td>
                        <td className={`text-right py-1.5 px-1.5 font-mono ${isITMCall ? "bg-ngreen/[0.04]" : ""}`}>{s.call_ltp || "—"}</td>
                        <td className={`text-right py-1.5 px-1.5 font-mono text-foreground/40 ${isITMCall ? "bg-ngreen/[0.04]" : ""}`}>{s.call_iv ? s.call_iv.toFixed(1) : "—"}</td>
                        <td className={`text-right py-1.5 px-1.5 font-mono text-foreground/40 ${isITMCall ? "bg-ngreen/[0.04]" : ""}`}>{s.call_delta || "—"}</td>
                        <td className={`text-right py-1.5 px-1.5 font-mono text-foreground/40 ${isITMCall ? "bg-ngreen/[0.04]" : ""}`}>{s.call_theta || "—"}</td>
                        <td className={`text-center py-1.5 px-1.5 font-mono font-semibold ${isATM ? "text-amber" : isMaxPain ? "text-cyan" : "text-foreground/60"}`}>
                          {s.strike.toLocaleString("en-IN")}
                          {isATM && <span className="text-[8px] ml-1 text-amber">ATM</span>}
                        </td>
                        <td className={`text-right py-1.5 px-1.5 font-mono text-foreground/40 ${isITMPut ? "bg-nred/[0.04]" : ""}`}>{s.put_delta || "—"}</td>
                        <td className={`text-right py-1.5 px-1.5 font-mono text-foreground/40 ${isITMPut ? "bg-nred/[0.04]" : ""}`}>{s.put_iv ? s.put_iv.toFixed(1) : "—"}</td>
                        <td className={`text-right py-1.5 px-1.5 font-mono ${isITMPut ? "bg-nred/[0.04]" : ""}`}>{s.put_ltp || "—"}</td>
                        <td className={`text-right py-1.5 px-1.5 font-mono ${isITMPut ? "bg-nred/[0.04]" : ""}`}>{s.put_oi > 0 ? (s.put_oi / 1000).toFixed(0) + "K" : "—"}</td>
                        <td className={`text-right py-1.5 px-1.5 font-mono text-foreground/40 ${isITMPut ? "bg-nred/[0.04]" : ""}`}>{s.put_theta || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!chain && !isLoading && (
        <div className="glass-card rounded-xl p-12 text-center">
          <div className="text-foreground/25 text-sm">Option chain data unavailable. NSE may be blocking the request.</div>
        </div>
      )}
    </div>
  );
}

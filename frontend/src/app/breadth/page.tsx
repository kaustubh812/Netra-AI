"use client";

import { useQuery } from "@tanstack/react-query";
import { api, BreadthData } from "@/lib/api";
import { Sparkline } from "@/components/sparkline";

const SIGNAL_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  strongly_bullish: { label: "Strongly Bullish", color: "var(--green-bright)", bg: "rgba(16,185,129,0.15)" },
  bullish: { label: "Bullish", color: "var(--green)", bg: "rgba(16,185,129,0.1)" },
  neutral: { label: "Neutral", color: "var(--amber)", bg: "rgba(245,158,11,0.1)" },
  bearish: { label: "Bearish", color: "var(--red)", bg: "rgba(244,63,94,0.1)" },
  strongly_bearish: { label: "Strongly Bearish", color: "var(--red-bright)", bg: "rgba(244,63,94,0.15)" },
};

export default function BreadthPage() {
  const { data, isLoading } = useQuery<BreadthData>({
    queryKey: ["breadth"],
    queryFn: api.getBreadth,
    refetchInterval: 5 * 60 * 1000,
  });

  const signal = data ? SIGNAL_STYLES[data.breadth_signal] || SIGNAL_STYLES.neutral : null;

  return (
    <div className="min-h-screen p-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="section-header text-xl font-bold text-foreground/90">Market Breadth</h1>
        <p className="text-foreground/30 text-sm mt-1 ml-5">
          Nifty 50 internal health indicators
        </p>
      </div>

      {isLoading && (
        <div className="grid grid-cols-12 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="col-span-4 glass-card rounded-xl h-40 shimmer" />
          ))}
        </div>
      )}

      {data?.available && (
        <div className="space-y-5">
          {/* Top row: Summary cards */}
          <div className="grid grid-cols-12 gap-4 animate-fade-in animate-fade-in-d1">
            {/* A/D Gauge */}
            <div className="col-span-12 md:col-span-4">
              <div className="glass-card rounded-2xl p-5 gradient-border-cyan h-full">
                <h3 className="text-xs font-semibold text-foreground/40 uppercase tracking-wider mb-4">Advance / Decline</h3>
                <div className="flex items-end justify-between mb-3">
                  <div>
                    <span className="text-3xl font-bold font-mono" style={{ color: "var(--green-bright)" }}>{data.current.advances}</span>
                    <span className="text-foreground/20 mx-2 text-lg">/</span>
                    <span className="text-3xl font-bold font-mono" style={{ color: "var(--red-bright)" }}>{data.current.declines}</span>
                  </div>
                  <span className="text-sm font-mono text-foreground/50">
                    {data.current.ad_ratio.toFixed(2)} ratio
                  </span>
                </div>
                {/* A/D bar */}
                <div className="h-3 rounded-full overflow-hidden flex" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <div
                    className="h-full rounded-l-full"
                    style={{
                      width: `${(data.current.advances / data.total_stocks) * 100}%`,
                      background: "linear-gradient(90deg, var(--green), var(--green-bright))",
                      boxShadow: "0 0 8px var(--green-glow)",
                    }}
                  />
                  <div
                    className="h-full"
                    style={{
                      width: `${(data.current.unchanged / data.total_stocks) * 100}%`,
                      background: "var(--amber)",
                      opacity: 0.5,
                    }}
                  />
                  <div
                    className="h-full rounded-r-full"
                    style={{
                      width: `${(data.current.declines / data.total_stocks) * 100}%`,
                      background: "linear-gradient(90deg, var(--red), var(--red-bright))",
                      boxShadow: "0 0 8px var(--red-glow)",
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-foreground/25 mt-1.5">
                  <span>{data.current.unchanged} unchanged</span>
                  <span>{data.total_stocks} total</span>
                </div>
              </div>
            </div>

            {/* Breadth Signal */}
            <div className="col-span-12 md:col-span-4">
              <div className="glass-card rounded-2xl p-5 h-full flex flex-col justify-between">
                <h3 className="text-xs font-semibold text-foreground/40 uppercase tracking-wider mb-3">Breadth Signal</h3>
                {signal && (
                  <div className="text-center py-2">
                    <span
                      className="text-lg font-bold px-4 py-2 rounded-xl inline-block"
                      style={{ background: signal.bg, color: signal.color }}
                    >
                      {signal.label}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs mt-3">
                  <span className="text-foreground/30">McClellan Oscillator</span>
                  <span
                    className="font-mono font-bold"
                    style={{ color: data.mcclellan_current >= 0 ? "var(--green)" : "var(--red)" }}
                  >
                    {data.mcclellan_current.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>

            {/* 52-Week Highs/Lows */}
            <div className="col-span-12 md:col-span-4">
              <div className="glass-card rounded-2xl p-5 h-full">
                <h3 className="text-xs font-semibold text-foreground/40 uppercase tracking-wider mb-4">52-Week Extremes</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold font-mono" style={{ color: "var(--green-bright)" }}>{data.current.high_52w}</p>
                    <p className="text-[10px] text-foreground/30 mt-1">Near 52W High</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold font-mono" style={{ color: "var(--red-bright)" }}>{data.current.low_52w}</p>
                    <p className="text-[10px] text-foreground/30 mt-1">Near 52W Low</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Moving Average Breadth */}
          <div className="grid grid-cols-12 gap-4 animate-fade-in animate-fade-in-d2">
            {[
              { label: "Above 20 DMA", pct: data.current.above_20dma_pct, count: data.current.above_20dma },
              { label: "Above 50 DMA", pct: data.current.above_50dma_pct, count: data.current.above_50dma },
              { label: "Above 200 DMA", pct: data.current.above_200dma_pct, count: data.current.above_200dma },
            ].map((item) => (
              <div key={item.label} className="col-span-12 md:col-span-4">
                <div className="glass-card rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-foreground/40">{item.label}</h3>
                    <span className="text-xs font-mono text-foreground/50">{item.count}/{data.total_stocks}</span>
                  </div>
                  {/* Circular-like gauge as a bar */}
                  <div className="relative">
                    <div className="text-center mb-2">
                      <span
                        className="text-3xl font-bold font-mono"
                        style={{
                          color: item.pct > 60 ? "var(--green-bright)" : item.pct > 40 ? "var(--amber)" : "var(--red-bright)",
                        }}
                      >
                        {item.pct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="confidence-bar">
                      <div
                        className="confidence-bar-fill"
                        style={{
                          width: `${item.pct}%`,
                          background: item.pct > 60 ? "var(--green)" : item.pct > 40 ? "var(--amber)" : "var(--red)",
                          color: item.pct > 60 ? "var(--green)" : item.pct > 40 ? "var(--amber)" : "var(--red)",
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Historical Charts */}
          <div className="grid grid-cols-12 gap-4 animate-fade-in animate-fade-in-d3">
            {/* Net Advances Trend */}
            <div className="col-span-12 md:col-span-6">
              <div className="glass-card rounded-xl p-5">
                <h3 className="text-xs font-semibold text-foreground/40 uppercase tracking-wider mb-3">Net Advances (20D)</h3>
                <Sparkline
                  data={data.history.net_advances}
                  width={400}
                  height={80}
                  positive={data.history.net_advances[data.history.net_advances.length - 1] >= 0}
                />
                <div className="flex justify-between text-[10px] text-foreground/20 mt-2">
                  <span>{data.history.dates[0]}</span>
                  <span>{data.history.dates[data.history.dates.length - 1]}</span>
                </div>
              </div>
            </div>

            {/* McClellan Oscillator Trend */}
            <div className="col-span-12 md:col-span-6">
              <div className="glass-card rounded-xl p-5">
                <h3 className="text-xs font-semibold text-foreground/40 uppercase tracking-wider mb-3">McClellan Oscillator (20D)</h3>
                <Sparkline
                  data={data.history.mcclellan}
                  width={400}
                  height={80}
                  positive={data.mcclellan_current >= 0}
                />
                <div className="flex justify-between text-[10px] text-foreground/20 mt-2">
                  <span>{data.history.dates[0]}</span>
                  <span>{data.history.dates[data.history.dates.length - 1]}</span>
                </div>
              </div>
            </div>

            {/* % Above 50 DMA Trend */}
            <div className="col-span-12 md:col-span-6">
              <div className="glass-card rounded-xl p-5">
                <h3 className="text-xs font-semibold text-foreground/40 uppercase tracking-wider mb-3">% Above 50 DMA (20D)</h3>
                <Sparkline
                  data={data.history.above_50dma}
                  width={400}
                  height={80}
                  positive={data.current.above_50dma_pct > 50}
                />
                <div className="flex justify-between text-[10px] text-foreground/20 mt-2">
                  <span>{data.history.dates[0]}</span>
                  <span>{data.history.dates[data.history.dates.length - 1]}</span>
                </div>
              </div>
            </div>

            {/* % Above 200 DMA Trend */}
            <div className="col-span-12 md:col-span-6">
              <div className="glass-card rounded-xl p-5">
                <h3 className="text-xs font-semibold text-foreground/40 uppercase tracking-wider mb-3">% Above 200 DMA (20D)</h3>
                <Sparkline
                  data={data.history.above_200dma}
                  width={400}
                  height={80}
                  positive={data.current.above_200dma_pct > 50}
                />
                <div className="flex justify-between text-[10px] text-foreground/20 mt-2">
                  <span>{data.history.dates[0]}</span>
                  <span>{data.history.dates[data.history.dates.length - 1]}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

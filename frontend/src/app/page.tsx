"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { StockTicker } from "@/components/stock-ticker";
import { DailyBriefCard } from "@/components/daily-brief-card";
import { AnomalyFeed } from "@/components/anomaly-feed";

function isMarketHours(): boolean {
  const now = new Date();
  const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const day = ist.getDay();
  if (day === 0 || day === 6) return false;
  const mins = ist.getHours() * 60 + ist.getMinutes();
  return mins >= 9 * 60 + 15 && mins <= 15 * 60 + 30;
}

/* ═══════════════════════════════════════════════
   SINGLE DASHBOARD QUERY — loads everything in one call
   ═══════════════════════════════════════════════ */
function useDashboardData() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: api.getDashboard,
    refetchInterval: 30_000,
    staleTime: 10_000, // show cached data for 10s before considering stale
    refetchOnWindowFocus: true,
  });
}

/* ═══════════════════════════════════════════════
   1. MARKET STATUS BAR — Bigger, bolder, visible
   ═══════════════════════════════════════════════ */
function MarketStatusBar({ data }: { data: any }) {
  if (!data) return <div className="glass-card rounded-xl h-12 shimmer" />;

  const nifty = data.nifty50;
  const bank = data.banknifty;
  const pcr = data.sentiment?.pcr;
  const vix = data.sentiment?.vix;
  const marketOpen = data.market_open;
  const breadth = data.breadth;

  return (
    <div className="glass-card rounded-xl px-4 py-2.5 flex items-center gap-5 animate-fade-in overflow-x-auto" style={{ borderColor: marketOpen ? "rgba(16,185,129,0.12)" : "rgba(244,63,94,0.08)" }}>
      {/* Status */}
      <div className="flex items-center gap-2 shrink-0">
        {marketOpen ? (
          <>
            <span className="relative w-2.5 h-2.5 shrink-0">
              <span className="absolute inset-0 rounded-full bg-ngreen pulse-ring-green" />
              <span className="absolute inset-0 rounded-full bg-ngreen" />
            </span>
            <span className="text-ngreen text-xs font-bold tracking-wider">LIVE</span>
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-nred shadow-[0_0_8px_rgba(244,63,94,0.5)] shrink-0" />
            <span className="text-nred text-xs font-bold tracking-wider">CLOSED</span>
          </>
        )}
      </div>

      <div className="w-px h-5 bg-white/[0.08]" />

      {/* NIFTY */}
      {nifty && (
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="text-foreground/40 text-[11px] font-bold">NIFTY</span>
          <span className="font-mono text-[15px] font-bold text-foreground/90">{nifty.value.toLocaleString("en-IN", { maximumFractionDigits: 1 })}</span>
          <span className={`font-mono text-xs font-bold ${(nifty.change_pct ?? 0) >= 0 ? "text-ngreen" : "text-nred"}`}>
            {(nifty.change_pct ?? 0) >= 0 ? "+" : ""}{nifty.change_pct?.toFixed(2)}%
          </span>
        </div>
      )}

      <div className="w-px h-5 bg-white/[0.08]" />

      {/* BANK */}
      {bank && (
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="text-foreground/40 text-[11px] font-bold">BANK</span>
          <span className="font-mono text-[15px] font-bold text-foreground/90">{bank.value.toLocaleString("en-IN", { maximumFractionDigits: 1 })}</span>
          <span className={`font-mono text-xs font-bold ${(bank.change_pct ?? 0) >= 0 ? "text-ngreen" : "text-nred"}`}>
            {(bank.change_pct ?? 0) >= 0 ? "+" : ""}{bank.change_pct?.toFixed(2)}%
          </span>
        </div>
      )}

      <div className="w-px h-5 bg-white/[0.08]" />

      {/* VIX */}
      {vix != null && (
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-foreground/40 text-[11px] font-bold">VIX</span>
          <span className={`font-mono text-sm font-bold ${vix > 20 ? "text-nred" : vix < 14 ? "text-ngreen" : "text-amber"}`}>{vix}</span>
        </div>
      )}

      {/* PCR */}
      {pcr != null && (
        <>
          <div className="w-px h-5 bg-white/[0.08]" />
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-foreground/40 text-[11px] font-bold">PCR</span>
            <span className={`font-mono text-sm font-bold ${pcr > 1 ? "text-ngreen" : pcr < 0.7 ? "text-nred" : "text-amber"}`}>{pcr.toFixed(2)}</span>
          </div>
        </>
      )}

      {/* Breadth */}
      {breadth && (
        <>
          <div className="w-px h-5 bg-white/[0.08]" />
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="text-ngreen text-[11px] font-mono font-bold">{breadth.bullish}B</span>
            <span className="text-amber text-[11px] font-mono font-bold">{breadth.neutral}H</span>
            <span className="text-nred text-[11px] font-mono font-bold">{breadth.bearish}S</span>
          </div>
          <div className="min-w-[100px] max-w-[180px] h-2 rounded-full bg-white/[0.06] flex overflow-hidden shrink-0">
            <div className="bg-ngreen h-full" style={{ width: `${(breadth.bullish / breadth.total) * 100}%` }} />
            <div className="bg-amber h-full" style={{ width: `${(breadth.neutral / breadth.total) * 100}%` }} />
            <div className="bg-nred h-full" style={{ width: `${(breadth.bearish / breadth.total) * 100}%` }} />
          </div>
        </>
      )}

      {/* Regime — compact inline */}
      <div className="w-px h-5 bg-white/[0.08]" />
      <RegimeInline data={null} />
    </div>
  );
}

/* Regime inline for status bar */
function RegimeInline({ data }: { data: any }) {
  if (!data) return null;
  const regimeLabel = data.regime === "trending_up" ? "Bullish" : data.regime === "trending_down" ? "Bearish" : data.regime === "volatile" ? "Volatile" : "Ranging";
  const emoji = regimeLabel === "Bullish" ? "🟢" : regimeLabel === "Bearish" ? "🔴" : regimeLabel === "Volatile" ? "⚡" : "🟡";
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className="text-[13px]">{emoji}</span>
      <span className="text-foreground/60 text-[11px] font-bold">{regimeLabel}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   2. TOP SIGNAL CARDS — 2x2 grid to fill space
   ═══════════════════════════════════════════════ */
function TopSignalCards({ stocks }: { stocks: any[] }) {
  const router = useRouter();

  if (stocks.length === 0) {
    return (
      <div className="grid grid-cols-2 gap-2 h-full">
        {[...Array(4)].map((_, i) => <div key={i} className="glass-card rounded-xl h-28 shimmer" />)}
      </div>
    );
  }

  const buys = stocks.filter((s: any) => s.signal === "BUY").sort((a: any, b: any) => (b.confidence ?? 0) - (a.confidence ?? 0)).slice(0, 2);
  const sells = stocks.filter((s: any) => s.signal === "SELL").sort((a: any, b: any) => (b.confidence ?? 0) - (a.confidence ?? 0)).slice(0, 1);
  const holds = stocks.filter((s: any) => s.signal === "HOLD").sort((a: any, b: any) => (b.confidence ?? 0) - (a.confidence ?? 0)).slice(0, 1);
  const top4 = [...buys, ...sells, ...holds].slice(0, 4);

  if (top4.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2 h-full">
      {top4.map((stock: any, i: number) => {
        const isBuy = stock.signal === "BUY";
        const isSell = stock.signal === "SELL";
        const accentColor = isBuy ? "#10b981" : isSell ? "#f43f5e" : "#f59e0b";
        const pctChange = stock.change_pct ?? 0;

        return (
          <button
            key={stock.symbol}
            onClick={() => router.push(`/stock/${encodeURIComponent(stock.symbol)}`)}
            className="glass-card glass-card-hover rounded-xl p-3.5 text-left relative overflow-hidden animate-fade-in group flex flex-col"
            style={{ animationDelay: `${i * 0.06}s`, borderColor: `${accentColor}18` }}
          >
            {/* Top glow line */}
            <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}60, transparent)` }} />

            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-sm text-foreground/90 group-hover:text-foreground">{stock.name}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${isBuy ? "bg-ngreen/15 text-ngreen" : isSell ? "bg-nred/15 text-nred" : "bg-amber/15 text-amber"}`}>
                {stock.signal}
              </span>
            </div>

            <div className="flex items-baseline gap-2.5">
              <span className="font-mono text-xl font-bold">{stock.ltp?.toLocaleString("en-IN", { maximumFractionDigits: 1 })}</span>
              <span className={`font-mono text-xs font-bold ${pctChange >= 0 ? "text-ngreen" : "text-nred"}`}>
                {pctChange >= 0 ? "▲" : "▼"} {pctChange >= 0 ? "+" : ""}{pctChange.toFixed(2)}%
              </span>
            </div>

            {/* Entry / Target / SL row */}
            {(stock.entry || stock.target) && (
              <div className="mt-2 flex gap-4 text-[11px] font-mono">
                {stock.entry && <span className="text-foreground/35">E {stock.entry.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>}
                {stock.target && <span className="text-ngreen/60">T {stock.target.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>}
                {stock.stop_loss && <span className="text-nred/60">SL {stock.stop_loss.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>}
              </div>
            )}

            {/* Confidence — push to bottom */}
            <div className="mt-auto pt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${stock.confidence ?? 0}%`, background: `linear-gradient(90deg, ${accentColor}80, ${accentColor})`, boxShadow: `0 0 6px ${accentColor}30` }} />
              </div>
              <span className="text-foreground/30 text-[10px] font-mono font-semibold shrink-0">{stock.confidence?.toFixed(0)}%</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   3. PORTFOLIO CARD — Compact
   ═══════════════════════════════════════════════ */
function PortfolioCard({ data }: { data: any }) {
  const totalPnl = data?.total_realized_pnl ?? 0;
  const isPositive = totalPnl >= 0;
  const portfolioVal = 10_00_000 + totalPnl;
  const stats = data ?? { win_rate: 0, total_trades: 0, open_positions: 0 };

  return (
    <div className="glass-card-hero rounded-xl p-3.5 animate-fade-in flex-1 flex flex-col">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-foreground/35 text-[10px] font-bold uppercase tracking-widest">Portfolio</span>
        <span className="text-[9px] text-cyan/40 bg-cyan/10 px-1.5 py-0.5 rounded font-mono">Paper</span>
      </div>
      <div className="text-2xl font-bold font-mono tracking-tight">
        ₹{portfolioVal.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
      </div>
      <div className={`text-xs font-mono font-bold mt-0.5 ${isPositive ? "text-ngreen" : "text-nred"}`}>
        {isPositive ? "▲ +" : "▼ "}₹{Math.abs(totalPnl).toLocaleString("en-IN", { maximumFractionDigits: 0 })} P&L
      </div>
      <div className="mt-auto grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.05]">
        <div>
          <div className="text-foreground/20 text-[9px] uppercase">Win Rate</div>
          <div className={`font-mono text-sm font-bold ${stats.win_rate >= 50 ? "text-ngreen" : "text-nred"}`}>{stats.win_rate.toFixed(0)}%</div>
        </div>
        <div>
          <div className="text-foreground/20 text-[9px] uppercase">Trades</div>
          <div className="font-mono text-sm font-bold">{stats.total_trades}</div>
        </div>
        <div>
          <div className="text-foreground/20 text-[9px] uppercase">Open</div>
          <div className="font-mono text-sm font-bold text-cyan">{stats.open_positions ?? stats.open_count ?? 0}</div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   4. MARKET PULSE — Ultra compact
   ═══════════════════════════════════════════════ */
function MarketPulseCard({ overview }: { overview: any }) {
  const pcr = overview?.sentiment?.pcr;
  const pcrLabel = pcr ? (pcr > 1 ? "Bullish" : pcr < 0.7 ? "Bearish" : "Neutral") : "—";
  const breadth = overview?.breadth;

  return (
    <div className="glass-card-glow rounded-xl p-3.5 animate-fade-in animate-fade-in-d1">
      <div className="text-foreground/35 text-[10px] font-bold uppercase tracking-widest mb-2">Market Pulse</div>
      {breadth && (
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-foreground/40 text-[11px]">Breadth</span>
            <div className="flex gap-2 text-[10px] font-mono font-bold">
              <span className="text-ngreen">{breadth.bullish}</span>
              <span className="text-amber">{breadth.neutral}</span>
              <span className="text-nred">{breadth.bearish}</span>
            </div>
          </div>
          <div className="h-2 rounded-full bg-white/[0.04] flex overflow-hidden">
            <div className="bg-ngreen h-full" style={{ width: `${(breadth.bullish / breadth.total) * 100}%` }} />
            <div className="bg-amber h-full" style={{ width: `${(breadth.neutral / breadth.total) * 100}%` }} />
            <div className="bg-nred h-full" style={{ width: `${(breadth.bearish / breadth.total) * 100}%` }} />
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-foreground/40 text-[11px]">PCR Mood</span>
        <span className={`text-[11px] font-bold ${pcr && pcr > 1 ? "text-ngreen" : pcr && pcr < 0.7 ? "text-nred" : "text-amber"}`}>
          {pcrLabel} {pcr ? `(${pcr.toFixed(2)})` : ""}
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   5. COMPACT SIGNAL TABLE — 7 rows max
   ═══════════════════════════════════════════════ */
function CompactSignalTable({ mode, dashboardStocks }: { mode: "daily" | "intraday"; dashboardStocks: any[] }) {
  const router = useRouter();

  // For daily mode, use the already-fetched dashboard stocks
  // For intraday, fetch separately (only when needed)
  const { data: intradayData, isLoading: intradayLoading } = useQuery({
    queryKey: ["intraday-signals"],
    queryFn: api.getIntradaySignals,
    refetchInterval: 30_000,
    enabled: mode === "intraday", // only fetch when intraday tab is active
  });

  const stocks = mode === "daily"
    ? dashboardStocks
    : (intradayData as any)?.signals ?? [];

  const top10 = useMemo(() =>
    [...stocks].sort((a: any, b: any) => (b.confidence ?? 0) - (a.confidence ?? 0)).slice(0, 7),
    [stocks]
  );

  if (mode === "intraday" && intradayLoading) return <div className="glass-card rounded-xl h-40 shimmer" />;
  if (stocks.length === 0) return <div className="glass-card rounded-xl h-40 shimmer" />;

  return (
    <div className="glass-card rounded-xl overflow-hidden animate-fade-in">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="text-left px-3 py-2 text-foreground/30 font-bold text-[10px] uppercase tracking-wider">Stock</th>
              <th className="text-right px-2 py-2 text-foreground/30 font-bold text-[10px] uppercase tracking-wider">LTP</th>
              <th className="text-right px-2 py-2 text-foreground/30 font-bold text-[10px] uppercase tracking-wider">Chg%</th>
              <th className="text-center px-2 py-2 text-foreground/30 font-bold text-[10px] uppercase tracking-wider">Signal</th>
              <th className="text-right px-2 py-2 text-foreground/30 font-bold text-[10px] uppercase tracking-wider hidden md:table-cell">Str</th>
              <th className="text-right px-2 py-2 text-foreground/30 font-bold text-[10px] uppercase tracking-wider hidden lg:table-cell">Entry</th>
              <th className="text-right px-2 py-2 text-foreground/30 font-bold text-[10px] uppercase tracking-wider hidden lg:table-cell">Target</th>
              <th className="text-right px-3 py-2 text-foreground/30 font-bold text-[10px] uppercase tracking-wider hidden lg:table-cell">SL</th>
            </tr>
          </thead>
          <tbody>
            {top10.map((s: any) => {
              const pct = s.change_pct ?? 0;
              const isBuy = s.signal === "BUY";
              const isSell = s.signal === "SELL";
              return (
                <tr
                  key={s.symbol}
                  onClick={() => router.push(`/stock/${encodeURIComponent(s.symbol)}`)}
                  className="border-b border-white/[0.03] hover:bg-cyan/[0.04] cursor-pointer transition-colors group"
                >
                  <td className="px-3 py-2">
                    <span className={`font-semibold text-[13px] ${isBuy ? "text-ngreen" : isSell ? "text-nred" : "text-cyan"} group-hover:underline`}>{s.name}</span>
                  </td>
                  <td className="text-right px-2 py-2 font-mono text-foreground/60 text-[13px]">{s.ltp?.toLocaleString("en-IN", { maximumFractionDigits: 1 })}</td>
                  <td className={`text-right px-2 py-2 font-mono font-bold text-[12px] ${pct >= 0 ? "text-ngreen" : "text-nred"}`}>
                    {pct >= 0 ? "+" : ""}{pct.toFixed(2)}%
                  </td>
                  <td className="text-center px-2 py-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isBuy ? "bg-ngreen/15 text-ngreen" : isSell ? "bg-nred/15 text-nred" : "bg-amber/15 text-amber"}`}>{s.signal}</span>
                  </td>
                  <td className="text-right px-2 py-2 font-mono text-foreground/40 hidden md:table-cell">{s.confidence?.toFixed(0)}%</td>
                  <td className="text-right px-2 py-2 font-mono text-foreground/30 text-[12px] hidden lg:table-cell">{s.entry?.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                  <td className="text-right px-2 py-2 font-mono text-ngreen/50 text-[12px] hidden lg:table-cell">{s.target?.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                  <td className="text-right px-3 py-2 font-mono text-nred/40 text-[12px] hidden lg:table-cell">{s.stop_loss?.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {stocks.length > 10 && (
        <div className="px-3 py-2 border-t border-white/[0.04] text-center">
          <button onClick={() => router.push("/screener")} className="text-cyan/60 hover:text-cyan text-[11px] font-medium transition-colors">
            View all {stocks.length} signals →
          </button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MAIN DASHBOARD
   ═══════════════════════════════════════════════ */
export default function Dashboard() {
  const [mode, setMode] = useState<"daily" | "intraday">("daily");
  const { data, isLoading } = useDashboardData();

  useEffect(() => {
    if (isMarketHours()) setMode("intraday");
  }, []);

  // Extract data from the combined response
  const marketOverview = data?.market_overview ?? null;
  const stocks = data?.stocks?.stocks ?? [];
  const regime = data?.regime ?? null;
  const paperStats = data?.paper_stats ?? null;

  return (
    <>
      {/* Stock Ticker — full width above everything */}
      <StockTicker />

      <div className="px-4 py-2 relative z-10 space-y-2 max-w-[1600px]">
      {/* ROW 1: Status Bar */}
      {isLoading ? (
        <div className="glass-card rounded-xl h-12 shimmer" />
      ) : (
        <MarketStatusBar data={marketOverview} />
      )}

      {/* AI DAILY BRIEF */}
      <DailyBriefCard />

      {/* ROW 2: Signal Cards (2x2) + Portfolio/Pulse */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
        <div className="lg:col-span-8">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-2 h-full">
              {[...Array(4)].map((_, i) => <div key={i} className="glass-card rounded-xl h-28 shimmer" />)}
            </div>
          ) : (
            <TopSignalCards stocks={stocks} />
          )}
        </div>
        <div className="lg:col-span-4 flex flex-col gap-2">
          <PortfolioCard data={paperStats} />
          <MarketPulseCard overview={marketOverview} />
        </div>
      </div>

      {/* Anomaly Feed */}
      <AnomalyFeed />

      {/* ROW 3: Signal Table */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-foreground/40 text-xs font-bold uppercase tracking-widest">Signals</span>
          <div className="flex gap-1">
            {(["daily", "intraday"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                  mode === m
                    ? "bg-cyan/15 text-cyan border-cyan/30 shadow-[0_0_10px_rgba(34,211,238,0.1)]"
                    : "bg-white/[0.02] text-foreground/30 border-white/[0.06] hover:text-foreground/50"
                }`}
              >
                {m === "daily" ? "Daily" : "Intraday"}
              </button>
            ))}
          </div>
        </div>
        <CompactSignalTable mode={mode} dashboardStocks={stocks} />
      </div>
    </div>
    </>
  );
}

"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { api, PaperPosition, PaperTrade, TradeSuggestion } from "@/lib/api";
import { SignalBadge } from "@/components/signal-badge";

export default function PaperTradingPage() {
  const queryClient = useQueryClient();
  const [showTrade, setShowTrade] = useState(false);
  const [showClose, setShowClose] = useState<PaperPosition | null>(null);
  const [closePrice, setClosePrice] = useState("");
  const [form, setForm] = useState({
    symbol: "", trade_type: "BUY" as "BUY" | "SELL", quantity: "", price: "",
    stop_loss: "", target_price: "", signal_confidence: "", notes: "",
  });

  const { data: positionsData } = useQuery({
    queryKey: ["paper-positions"],
    queryFn: api.getPaperPositions,
    refetchInterval: 30_000,
  });

  const { data: statsData } = useQuery({
    queryKey: ["paper-stats"],
    queryFn: api.getPaperTradingStats,
  });

  const { data: historyData } = useQuery({
    queryKey: ["paper-history"],
    queryFn: () => api.getPaperTradeHistory(50),
  });

  const { data: suggestionsData } = useQuery({
    queryKey: ["paper-suggestions"],
    queryFn: api.getTradeSuggestions,
  });

  const { data: stocksData } = useQuery({
    queryKey: ["stocks"],
    queryFn: api.getStocks,
    staleTime: 60_000,
  });

  const placeMutation = useMutation({
    mutationFn: () => api.placePaperTrade(
      form.symbol, form.trade_type, parseFloat(form.quantity), parseFloat(form.price),
      form.stop_loss ? parseFloat(form.stop_loss) : undefined,
      form.target_price ? parseFloat(form.target_price) : undefined,
      form.signal_confidence ? parseFloat(form.signal_confidence) : undefined,
      form.notes || undefined,
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["paper-positions"] });
      queryClient.invalidateQueries({ queryKey: ["paper-stats"] });
      queryClient.invalidateQueries({ queryKey: ["paper-suggestions"] });
      setShowTrade(false);
      setForm({ symbol: "", trade_type: "BUY", quantity: "", price: "", stop_loss: "", target_price: "", signal_confidence: "", notes: "" });
    },
  });

  const closeMutation = useMutation({
    mutationFn: ({ id, price }: { id: number; price: number }) => api.closePaperTrade(id, price),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["paper-positions"] });
      queryClient.invalidateQueries({ queryKey: ["paper-stats"] });
      queryClient.invalidateQueries({ queryKey: ["paper-history"] });
      queryClient.invalidateQueries({ queryKey: ["paper-suggestions"] });
      setShowClose(null);
      setClosePrice("");
    },
  });

  const positions = positionsData?.positions ?? [];
  const stats = statsData;
  const history = historyData?.trades ?? [];
  const suggestions = suggestionsData?.suggestions ?? [];
  const allStocks = stocksData?.stocks ?? [];

  const openTradeFromSuggestion = (s: TradeSuggestion) => {
    setForm({
      symbol: s.symbol,
      trade_type: s.signal as "BUY" | "SELL",
      quantity: "1",
      price: String(s.ltp ?? s.entry_price),
      stop_loss: String(s.stop_loss),
      target_price: String(s.target_price),
      signal_confidence: String(s.confidence),
      notes: "",
    });
    setShowTrade(true);
  };

  const openCloseModal = (p: PaperPosition) => {
    setClosePrice(String(p.ltp ?? ""));
    setShowClose(p);
  };

  // Preview P&L for close modal
  let closePnlPreview: number | null = null;
  if (showClose && closePrice) {
    const ep = parseFloat(closePrice);
    if (!isNaN(ep)) {
      if (showClose.trade_type === "BUY") {
        closePnlPreview = (ep - showClose.entry_price) * showClose.quantity;
      } else {
        closePnlPreview = (showClose.entry_price - ep) * showClose.quantity;
      }
    }
  }

  const INR = (v: number, decimals = 0) => v.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: decimals });

  return (
    <div className="px-6 py-6 relative z-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-foreground">Paper Trading</h1>
        <button
          onClick={() => setShowTrade(true)}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-cyan/15 text-cyan border border-cyan/30 hover:bg-cyan/25 transition-colors"
        >
          + Place Trade
        </button>
      </div>

      {/* Summary Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 animate-fade-in">
          <div className="glass-card rounded-xl p-4">
            <div className="text-foreground/30 text-[10px] uppercase tracking-wider mb-1">Total Trades</div>
            <div className="font-mono text-lg font-bold">{stats.total_trades}</div>
            <div className="text-[10px] text-foreground/25 mt-0.5">{stats.open_count} open &middot; {stats.closed_count} closed</div>
          </div>
          <div className="glass-card rounded-xl p-4">
            <div className="text-foreground/30 text-[10px] uppercase tracking-wider mb-1">Win Rate</div>
            <div className={`font-mono text-lg font-bold ${stats.win_rate >= 50 ? "text-ngreen" : stats.win_rate > 0 ? "text-nred" : ""}`}>
              {stats.win_rate}%
            </div>
            <div className="text-[10px] text-foreground/25 mt-0.5">Profit factor: {stats.profit_factor}</div>
          </div>
          <div className="glass-card rounded-xl p-4">
            <div className="text-foreground/30 text-[10px] uppercase tracking-wider mb-1">Avg Return</div>
            <div className={`font-mono text-lg font-bold ${stats.avg_return_pct >= 0 ? "text-ngreen" : "text-nred"}`}>
              {stats.avg_return_pct >= 0 ? "+" : ""}{stats.avg_return_pct}%
            </div>
          </div>
          <div className="glass-card rounded-xl p-4">
            <div className="text-foreground/30 text-[10px] uppercase tracking-wider mb-1">Total P&amp;L</div>
            <div className={`font-mono text-lg font-bold ${(stats.total_realized_pnl + stats.total_unrealized_pnl) >= 0 ? "text-ngreen" : "text-nred"}`}>
              {(stats.total_realized_pnl + stats.total_unrealized_pnl) >= 0 ? "+" : ""}
              {INR(stats.total_realized_pnl + stats.total_unrealized_pnl)}
            </div>
            <div className="text-[10px] text-foreground/25 mt-0.5">
              Realized: {INR(stats.total_realized_pnl)} &middot; Unrealized: {INR(stats.total_unrealized_pnl)}
            </div>
          </div>
        </div>
      )}

      {/* Open Positions */}
      <div className="glass-card rounded-xl p-5 mb-5 animate-fade-in animate-fade-in-d1">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="section-header text-xs text-foreground/40 uppercase tracking-widest">Open Positions</h3>
          <span className="pulse-ring-green" style={{ width: 6, height: 6 }} />
          <span className="text-[9px] text-foreground/20 font-mono">LIVE</span>
        </div>
        {positions.length === 0 ? (
          <div className="text-center py-10 text-foreground/25 text-sm">No open positions. Place a trade or pick from suggestions below.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-foreground/30 uppercase tracking-wider border-b border-white/[0.06]">
                  <th className="text-left py-2 px-2">Stock</th>
                  <th className="text-center py-2 px-2">Type</th>
                  <th className="text-right py-2 px-2">Qty</th>
                  <th className="text-right py-2 px-2">Entry</th>
                  <th className="text-right py-2 px-2">LTP</th>
                  <th className="text-right py-2 px-2">P&amp;L</th>
                  <th className="text-right py-2 px-2">SL</th>
                  <th className="text-right py-2 px-2">Target</th>
                  <th className="text-center py-2 px-2">Signal</th>
                  <th className="text-center py-2 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => (
                  <tr key={p.id} className={`border-b border-white/[0.03] hover:bg-white/[0.02] ${!p.signal_alignment ? "bg-nred/[0.03]" : ""}`}>
                    <td className="py-2.5 px-2">
                      <Link href={`/stock/${encodeURIComponent(p.symbol)}`} className="text-cyan hover:text-cyan/80 font-medium">
                        {p.name}
                      </Link>
                    </td>
                    <td className="text-center py-2.5 px-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${p.trade_type === "BUY" ? "bg-ngreen/15 text-ngreen" : "bg-nred/15 text-nred"}`}>
                        {p.trade_type}
                      </span>
                    </td>
                    <td className="text-right py-2.5 px-2 font-mono">{p.quantity}</td>
                    <td className="text-right py-2.5 px-2 font-mono">{p.entry_price.toLocaleString("en-IN")}</td>
                    <td className="text-right py-2.5 px-2 font-mono">{p.ltp?.toLocaleString("en-IN") ?? "—"}</td>
                    <td className={`text-right py-2.5 px-2 font-mono font-semibold ${p.unrealized_pnl !== null && p.unrealized_pnl >= 0 ? "text-ngreen" : "text-nred"}`}>
                      {p.unrealized_pnl !== null
                        ? `${p.unrealized_pnl >= 0 ? "+" : ""}${p.unrealized_pnl.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
                        : "—"}
                      {p.unrealized_pnl_pct !== null && (
                        <span className="text-[10px] ml-1">({p.unrealized_pnl_pct >= 0 ? "+" : ""}{p.unrealized_pnl_pct}%)</span>
                      )}
                    </td>
                    <td className="text-right py-2.5 px-2 font-mono text-foreground/40">{p.stop_loss?.toLocaleString("en-IN") ?? "—"}</td>
                    <td className="text-right py-2.5 px-2 font-mono text-foreground/40">{p.target_price?.toLocaleString("en-IN") ?? "—"}</td>
                    <td className="text-center py-2.5 px-2">
                      <div className="flex items-center justify-center gap-1">
                        {p.signal ? <SignalBadge signal={p.signal} size="sm" /> : "—"}
                        {!p.signal_alignment && (
                          <span title="Signal misalignment — current signal contradicts your position" className="text-amber-400 text-sm cursor-help">&#9888;</span>
                        )}
                      </div>
                    </td>
                    <td className="text-center py-2.5 px-2">
                      <button
                        onClick={() => openCloseModal(p)}
                        className="px-2 py-1 rounded text-[10px] font-medium bg-white/[0.06] text-foreground/50 hover:text-foreground hover:bg-white/[0.1] transition-colors"
                      >
                        Close
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="glass-card rounded-xl p-5 mb-5 animate-fade-in animate-fade-in-d2">
          <h3 className="section-header text-xs text-foreground/40 uppercase tracking-widest mb-3">Suggested Trades</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {suggestions.slice(0, 8).map((s) => (
              <div key={s.symbol} className="glass-card rounded-lg p-3 border border-white/[0.04]">
                <div className="flex items-center justify-between mb-2">
                  <Link href={`/stock/${encodeURIComponent(s.symbol)}`} className="text-cyan hover:text-cyan/80 text-sm font-medium">
                    {s.name}
                  </Link>
                  <SignalBadge signal={s.signal} size="sm" />
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-foreground/40 mb-3">
                  <div>Confidence <span className="text-foreground/70 font-mono">{s.confidence.toFixed(0)}%</span></div>
                  <div>Entry <span className="text-foreground/70 font-mono">{s.entry_price.toLocaleString("en-IN")}</span></div>
                  <div>SL <span className="text-nred/70 font-mono">{s.stop_loss.toLocaleString("en-IN")}</span></div>
                  <div>Target <span className="text-ngreen/70 font-mono">{s.target_price.toLocaleString("en-IN")}</span></div>
                </div>
                <button
                  onClick={() => openTradeFromSuggestion(s)}
                  className="w-full py-1.5 rounded text-[10px] font-medium bg-cyan/10 text-cyan border border-cyan/20 hover:bg-cyan/20 transition-colors"
                >
                  Take Trade
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trade History */}
      <div className="glass-card rounded-xl p-5 animate-fade-in animate-fade-in-d3">
        <h3 className="section-header text-xs text-foreground/40 uppercase tracking-widest mb-3">Trade History</h3>
        {history.length === 0 ? (
          <div className="text-center py-10 text-foreground/25 text-sm">No closed trades yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-foreground/30 uppercase tracking-wider border-b border-white/[0.06]">
                  <th className="text-left py-2 px-2">Date</th>
                  <th className="text-left py-2 px-2">Stock</th>
                  <th className="text-center py-2 px-2">Type</th>
                  <th className="text-right py-2 px-2">Qty</th>
                  <th className="text-right py-2 px-2">Entry</th>
                  <th className="text-right py-2 px-2">Exit</th>
                  <th className="text-right py-2 px-2">P&amp;L</th>
                  <th className="text-right py-2 px-2">Return</th>
                </tr>
              </thead>
              <tbody>
                {history.map((t) => (
                  <tr key={t.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="py-2.5 px-2 text-foreground/40">{t.closed_date ?? t.trade_date}</td>
                    <td className="py-2.5 px-2">
                      <Link href={`/stock/${encodeURIComponent(t.symbol)}`} className="text-cyan hover:text-cyan/80 font-medium">
                        {t.name}
                      </Link>
                    </td>
                    <td className="text-center py-2.5 px-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${t.trade_type === "BUY" ? "bg-ngreen/15 text-ngreen" : "bg-nred/15 text-nred"}`}>
                        {t.trade_type}
                      </span>
                    </td>
                    <td className="text-right py-2.5 px-2 font-mono">{t.quantity}</td>
                    <td className="text-right py-2.5 px-2 font-mono">{t.entry_price.toLocaleString("en-IN")}</td>
                    <td className="text-right py-2.5 px-2 font-mono">{t.exit_price?.toLocaleString("en-IN") ?? "—"}</td>
                    <td className={`text-right py-2.5 px-2 font-mono font-semibold ${t.pnl !== null && t.pnl >= 0 ? "text-ngreen" : "text-nred"}`}>
                      {t.pnl !== null ? `${t.pnl >= 0 ? "+" : ""}${t.pnl.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—"}
                    </td>
                    <td className={`text-right py-2.5 px-2 font-mono ${t.pnl_pct !== null && t.pnl_pct >= 0 ? "text-ngreen" : "text-nred"}`}>
                      {t.pnl_pct !== null ? `${t.pnl_pct >= 0 ? "+" : ""}${t.pnl_pct}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Place Trade Modal */}
      {showTrade && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setShowTrade(false)} />
          <div className="fixed top-[12%] left-1/2 -translate-x-1/2 z-50 w-full max-w-md">
            <div className="glass-card rounded-xl p-6" style={{ background: "rgba(12,12,22,0.95)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <h3 className="text-lg font-bold mb-4">Place Paper Trade</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-foreground/40 uppercase tracking-wider block mb-1">Stock</label>
                  <select
                    value={form.symbol}
                    onChange={e => setForm({ ...form, symbol: e.target.value })}
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-cyan/40"
                  >
                    <option value="">Select stock...</option>
                    {allStocks.map(s => (
                      <option key={s.symbol} value={s.symbol}>{s.name} ({s.symbol})</option>
                    ))}
                  </select>
                </div>

                {/* BUY/SELL Toggle */}
                <div>
                  <label className="text-xs text-foreground/40 uppercase tracking-wider block mb-1">Direction</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setForm({ ...form, trade_type: "BUY" })}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${form.trade_type === "BUY" ? "bg-ngreen/20 text-ngreen border border-ngreen/40" : "bg-white/[0.05] text-foreground/40 border border-white/[0.08]"}`}
                    >
                      BUY
                    </button>
                    <button
                      onClick={() => setForm({ ...form, trade_type: "SELL" })}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${form.trade_type === "SELL" ? "bg-nred/20 text-nred border border-nred/40" : "bg-white/[0.05] text-foreground/40 border border-white/[0.08]"}`}
                    >
                      SELL
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-foreground/40 uppercase tracking-wider block mb-1">Quantity</label>
                    <input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })}
                      className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-cyan/40" placeholder="1" />
                  </div>
                  <div>
                    <label className="text-xs text-foreground/40 uppercase tracking-wider block mb-1">Price</label>
                    <input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}
                      className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-cyan/40" placeholder="1500" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-foreground/40 uppercase tracking-wider block mb-1">Stop Loss</label>
                    <input type="number" value={form.stop_loss} onChange={e => setForm({ ...form, stop_loss: e.target.value })}
                      className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-cyan/40" placeholder="Optional" />
                  </div>
                  <div>
                    <label className="text-xs text-foreground/40 uppercase tracking-wider block mb-1">Target</label>
                    <input type="number" value={form.target_price} onChange={e => setForm({ ...form, target_price: e.target.value })}
                      className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-cyan/40" placeholder="Optional" />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-foreground/40 uppercase tracking-wider block mb-1">Notes</label>
                  <input type="text" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-cyan/40" placeholder="Optional" />
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowTrade(false)} className="flex-1 py-2 rounded-lg text-sm border border-white/[0.08] text-foreground/40 hover:text-foreground hover:bg-white/[0.04] transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={() => placeMutation.mutate()}
                    disabled={!form.symbol || !form.quantity || !form.price}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-30 ${form.trade_type === "BUY" ? "bg-ngreen/15 text-ngreen border border-ngreen/30 hover:bg-ngreen/25" : "bg-nred/15 text-nred border border-nred/30 hover:bg-nred/25"}`}
                  >
                    Place {form.trade_type}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Close Confirm Modal */}
      {showClose && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setShowClose(null)} />
          <div className="fixed top-[25%] left-1/2 -translate-x-1/2 z-50 w-full max-w-sm">
            <div className="glass-card rounded-xl p-6" style={{ background: "rgba(12,12,22,0.95)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <h3 className="text-lg font-bold mb-1">Close Position</h3>
              <p className="text-xs text-foreground/40 mb-4">
                {showClose.name} &middot; {showClose.trade_type} &middot; {showClose.quantity} qty @ {showClose.entry_price.toLocaleString("en-IN")}
              </p>

              <div className="mb-4">
                <label className="text-xs text-foreground/40 uppercase tracking-wider block mb-1">Exit Price</label>
                <input
                  type="number" value={closePrice} onChange={e => setClosePrice(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-cyan/40"
                  placeholder={String(showClose.ltp ?? "")}
                  autoFocus
                />
              </div>

              {closePnlPreview !== null && (
                <div className={`text-center py-3 rounded-lg mb-4 ${closePnlPreview >= 0 ? "bg-ngreen/10 text-ngreen" : "bg-nred/10 text-nred"}`}>
                  <div className="text-xs text-foreground/40 mb-0.5">Estimated P&amp;L</div>
                  <div className="font-mono text-lg font-bold">
                    {closePnlPreview >= 0 ? "+" : ""}{INR(closePnlPreview)}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setShowClose(null)} className="flex-1 py-2 rounded-lg text-sm border border-white/[0.08] text-foreground/40 hover:text-foreground hover:bg-white/[0.04] transition-colors">
                  Cancel
                </button>
                <button
                  onClick={() => closeMutation.mutate({ id: showClose.id, price: parseFloat(closePrice) })}
                  disabled={!closePrice || isNaN(parseFloat(closePrice))}
                  className="flex-1 py-2 rounded-lg text-sm font-medium bg-cyan/15 text-cyan border border-cyan/30 hover:bg-cyan/25 transition-colors disabled:opacity-30"
                >
                  Confirm Close
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

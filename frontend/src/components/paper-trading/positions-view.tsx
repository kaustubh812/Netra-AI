"use client";

import { useState } from "react";
import Link from "next/link";
import { PaperPosition } from "@/lib/api";
import { SignalBadge } from "@/components/signal-badge";

interface PositionsViewProps {
  positions: PaperPosition[];
  onSelectSymbol: (symbol: string) => void;
  onClose: (id: number, price: number) => void;
  isClosing?: boolean;
}

export function PositionsView({ positions, onSelectSymbol, onClose, isClosing }: PositionsViewProps) {
  const [confirmClose, setConfirmClose] = useState<PaperPosition | null>(null);
  const [closePrice, setClosePrice] = useState("");

  const totalInvested = positions.reduce((s, p) => s + p.entry_price * p.quantity, 0);
  const totalCurrent = positions.reduce((s, p) => s + (p.ltp ?? p.entry_price) * p.quantity, 0);
  const totalPnl = positions.reduce((s, p) => s + (p.unrealized_pnl ?? 0), 0);
  const dayPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

  const INR = (v: number, d = 0) =>
    v.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: d });

  const handleConfirmClose = () => {
    if (!confirmClose || !closePrice) return;
    onClose(confirmClose.id, parseFloat(closePrice));
    setConfirmClose(null);
    setClosePrice("");
  };

  // Preview P&L for close
  let closePnlPreview: number | null = null;
  if (confirmClose && closePrice) {
    const ep = parseFloat(closePrice);
    if (!isNaN(ep)) {
      closePnlPreview = confirmClose.trade_type === "BUY"
        ? (ep - confirmClose.entry_price) * confirmClose.quantity
        : (confirmClose.entry_price - ep) * confirmClose.quantity;
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* P&L Summary Bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card rounded-xl p-4">
          <div className="text-foreground/30 text-[10px] uppercase tracking-wider mb-1">Total Invested</div>
          <div className="font-mono text-sm font-bold">{INR(totalInvested)}</div>
        </div>
        <div className="glass-card rounded-xl p-4">
          <div className="text-foreground/30 text-[10px] uppercase tracking-wider mb-1">Current Value</div>
          <div className="font-mono text-sm font-bold">{INR(totalCurrent)}</div>
        </div>
        <div className="glass-card rounded-xl p-4">
          <div className="text-foreground/30 text-[10px] uppercase tracking-wider mb-1">Day P&L</div>
          <div className={`font-mono text-sm font-bold ${totalPnl >= 0 ? "text-ngreen" : "text-nred"}`}>
            {totalPnl >= 0 ? "+" : ""}{INR(totalPnl)}
            <span className="text-[10px] ml-1">({dayPnlPct >= 0 ? "+" : ""}{dayPnlPct.toFixed(2)}%)</span>
          </div>
        </div>
      </div>

      {/* Positions Table */}
      <div className="glass-card rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="section-header text-xs text-foreground/40 uppercase tracking-widest">Open Positions</h3>
          <span className="pulse-ring-green" style={{ width: 6, height: 6 }} />
          <span className="text-[9px] text-foreground/20 font-mono">LIVE</span>
          <span className="ml-auto text-[10px] text-foreground/25 font-mono">{positions.length} positions</span>
        </div>

        {positions.length === 0 ? (
          <div className="text-center py-12 text-foreground/25 text-sm">
            <div className="text-3xl mb-3 opacity-20">📊</div>
            No open positions. Switch to Trade tab to place your first trade.
          </div>
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
                  <th className="text-right py-2 px-2">P&L</th>
                  <th className="text-right py-2 px-2">SL</th>
                  <th className="text-right py-2 px-2">Target</th>
                  <th className="text-center py-2 px-2">Signal</th>
                  <th className="text-center py-2 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => (
                  <tr
                    key={p.id}
                    className={`border-b border-white/[0.03] hover:bg-white/[0.02] cursor-pointer transition-colors ${!p.signal_alignment ? "bg-nred/[0.03]" : ""}`}
                    onClick={() => onSelectSymbol(p.symbol)}
                  >
                    <td className="py-2.5 px-2">
                      <Link
                        href={`/stock/${encodeURIComponent(p.symbol)}`}
                        className="text-cyan hover:text-cyan/80 font-medium"
                        onClick={(e) => e.stopPropagation()}
                      >
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
                    <td className="text-center py-2.5 px-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        {p.signal ? <SignalBadge signal={p.signal} size="sm" /> : "—"}
                        {!p.signal_alignment && (
                          <span title="Signal misalignment" className="text-amber-400 text-sm cursor-help">&#9888;</span>
                        )}
                      </div>
                    </td>
                    <td className="text-center py-2.5 px-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          setClosePrice(String(p.ltp ?? ""));
                          setConfirmClose(p);
                        }}
                        className="px-2.5 py-1 rounded text-[10px] font-medium bg-white/[0.06] text-foreground/50 hover:text-foreground hover:bg-white/[0.1] transition-colors"
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

      {/* Close Confirmation Inline */}
      {confirmClose && (
        <>
          <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-md" onClick={() => setConfirmClose(null)} />
          <div className="fixed top-[25%] left-1/2 -translate-x-1/2 z-50 w-full max-w-sm">
            <div className="glass-card rounded-xl p-6" style={{ background: "rgba(12,12,22,0.95)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <h3 className="text-lg font-bold mb-1">Close Position</h3>
              <p className="text-xs text-foreground/40 mb-4">
                {confirmClose.name} &middot; {confirmClose.trade_type} &middot; {confirmClose.quantity} qty @ {confirmClose.entry_price.toLocaleString("en-IN")}
              </p>

              <div className="mb-4">
                <label className="text-xs text-foreground/40 uppercase tracking-wider block mb-1">Exit Price</label>
                <input
                  type="number"
                  value={closePrice}
                  onChange={(e) => setClosePrice(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-cyan/40"
                  placeholder={String(confirmClose.ltp ?? "")}
                  autoFocus
                />
              </div>

              {closePnlPreview !== null && (
                <div className={`text-center py-3 rounded-lg mb-4 ${closePnlPreview >= 0 ? "bg-ngreen/10 text-ngreen" : "bg-nred/10 text-nred"}`}>
                  <div className="text-xs text-foreground/40 mb-0.5">Estimated P&L</div>
                  <div className="font-mono text-lg font-bold">
                    {closePnlPreview >= 0 ? "+" : ""}{INR(closePnlPreview)}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmClose(null)}
                  className="flex-1 py-2 rounded-lg text-sm border border-white/[0.08] text-foreground/40 hover:text-foreground hover:bg-white/[0.04] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmClose}
                  disabled={!closePrice || isNaN(parseFloat(closePrice)) || isClosing}
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

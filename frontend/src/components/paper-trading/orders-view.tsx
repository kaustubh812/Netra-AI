"use client";

import { useState } from "react";
import Link from "next/link";
import { PaperTrade } from "@/lib/api";

interface OrdersViewProps {
  trades: PaperTrade[];
}

type FilterType = "ALL" | "EXECUTED" | "CLOSED";

export function OrdersView({ trades }: OrdersViewProps) {
  const [filter, setFilter] = useState<FilterType>("ALL");

  const filtered = trades.filter((t) => {
    if (filter === "EXECUTED") return t.status === "OPEN";
    if (filter === "CLOSED") return t.status === "CLOSED";
    return true;
  });

  const filters: { label: string; value: FilterType }[] = [
    { label: "All", value: "ALL" },
    { label: "Executed", value: "EXECUTED" },
    { label: "Closed", value: "CLOSED" },
  ];

  const INR = (v: number, d = 0) =>
    v.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: d });

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Filter Pills */}
      <div className="flex items-center gap-2">
        <h3 className="section-header text-xs text-foreground/40 uppercase tracking-widest">Order Book</h3>
        <div className="flex gap-1.5 ml-4">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1 rounded-full text-[10px] font-medium transition-all ${
                filter === f.value
                  ? "bg-cyan/10 text-cyan border border-cyan/30"
                  : "bg-white/[0.04] text-foreground/35 border border-white/[0.06] hover:text-foreground/50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[10px] text-foreground/25 font-mono">{filtered.length} orders</span>
      </div>

      {/* Orders Table */}
      <div className="glass-card rounded-xl p-5">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-foreground/25 text-sm">
            <div className="text-3xl mb-3 opacity-20">📋</div>
            No orders to display.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-foreground/30 uppercase tracking-wider border-b border-white/[0.05]">
                  <th className="text-left py-2 px-2">Date</th>
                  <th className="text-left py-2 px-2">Stock</th>
                  <th className="text-center py-2 px-2">Type</th>
                  <th className="text-center py-2 px-2">Order</th>
                  <th className="text-center py-2 px-2">Product</th>
                  <th className="text-right py-2 px-2">Qty</th>
                  <th className="text-right py-2 px-2">Entry</th>
                  <th className="text-right py-2 px-2">Exit</th>
                  <th className="text-right py-2 px-2">P&L</th>
                  <th className="text-right py-2 px-2">Return</th>
                  <th className="text-center py-2 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <td className="py-2.5 px-2 text-foreground/40 font-mono text-[10px]">
                      {t.closed_date ?? t.trade_date}
                    </td>
                    <td className="py-2.5 px-2">
                      <Link href={`/stock/${encodeURIComponent(t.symbol)}`} className="text-cyan hover:text-cyan-bright font-medium transition-colors duration-150">
                        {t.name}
                      </Link>
                    </td>
                    <td className="text-center py-2.5 px-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${t.trade_type === "BUY" ? "bg-ngreen/15 text-ngreen" : "bg-nred/15 text-nred"}`}>
                        {t.trade_type}
                      </span>
                    </td>
                    <td className="text-center py-2.5 px-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-purple/10 text-purple/70">
                        {t.order_type ?? "MARKET"}
                      </span>
                    </td>
                    <td className="text-center py-2.5 px-2">
                      <span className="text-[10px] text-foreground/35 font-mono">
                        {t.product_type ?? "DELIVERY"}
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
                    <td className="text-center py-2.5 px-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                        t.status === "OPEN" ? "bg-cyan/10 text-cyan" : "bg-white/[0.06] text-foreground/40"
                      }`}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

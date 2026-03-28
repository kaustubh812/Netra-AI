"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SignalBadge } from "@/components/signal-badge";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function WatchlistsPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [addSymbol, setAddSymbol] = useState("");

  // Fetch all watchlists
  const { data: listData } = useQuery({
    queryKey: ["watchlists"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/watchlists`);
      return res.json();
    },
  });

  // Fetch selected watchlist detail
  const { data: wlDetail, isLoading: detailLoading } = useQuery({
    queryKey: ["watchlist", selectedId],
    queryFn: async () => {
      if (!selectedId) return null;
      const res = await fetch(`${API_BASE}/api/watchlists/${selectedId}`);
      return res.json();
    },
    enabled: !!selectedId,
    refetchInterval: 30 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await fetch(`${API_BASE}/api/watchlists?name=${encodeURIComponent(newName)}`, { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlists"] });
      setNewName("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`${API_BASE}/api/watchlists/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlists"] });
      setSelectedId(null);
    },
  });

  const addStockMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId) return;
      await fetch(`${API_BASE}/api/watchlists/${selectedId}/add?symbol=${encodeURIComponent(addSymbol)}`, { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist", selectedId] });
      setAddSymbol("");
    },
  });

  const removeStockMutation = useMutation({
    mutationFn: async (symbol: string) => {
      if (!selectedId) return;
      await fetch(`${API_BASE}/api/watchlists/${selectedId}/remove?symbol=${encodeURIComponent(symbol)}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["watchlist", selectedId] }),
  });

  const watchlists = listData?.watchlists ?? [];
  const stocks = wlDetail?.stocks ?? [];
  const summary = wlDetail?.summary ?? { buy: 0, sell: 0, hold: 0 };

  // Auto-select first watchlist
  if (!selectedId && watchlists.length > 0) {
    setSelectedId(watchlists[0].id);
  }

  return (
    <div className="px-6 py-6 relative z-10">
      <h1 className="section-header text-xs font-medium text-foreground/40 uppercase tracking-widest mb-6">
        Watchlists
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Left: Watchlist list + create */}
        <div className="lg:col-span-1 space-y-4">
          {/* Create new */}
          <div className="glass-card rounded-xl p-3">
            <div className="flex gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="New watchlist..."
                className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-foreground placeholder-foreground/20 outline-none focus:border-cyan/30"
              />
              <button
                onClick={() => createMutation.mutate()}
                disabled={!newName.trim()}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan/15 text-cyan border border-cyan/25 hover:bg-cyan/25 transition-colors disabled:opacity-30"
              >
                Create
              </button>
            </div>
          </div>

          {/* Watchlist list */}
          <div className="glass-card rounded-xl overflow-hidden">
            {watchlists.map((wl: Record<string, unknown>) => (
              <div
                key={wl.id as number}
                onClick={() => setSelectedId(wl.id as number)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelectedId(wl.id as number); }}
                className={`w-full flex items-center justify-between px-4 py-3 text-left border-b border-white/[0.03] last:border-0 transition-colors cursor-pointer ${
                  selectedId === wl.id ? "bg-cyan/[0.06] text-foreground" : "text-foreground/50 hover:bg-white/[0.03]"
                }`}
              >
                <div>
                  <div className="text-sm font-medium">{wl.name as string}</div>
                  <div className="text-[10px] text-foreground/25">{wl.stock_count as number} stocks</div>
                </div>
                {!wl.is_default && selectedId === wl.id && (
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(wl.id as number); }}
                    className="text-nred/40 hover:text-nred text-[10px] transition-colors"
                  >
                    Delete
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Watchlist detail */}
        <div className="lg:col-span-3">
          {selectedId ? (
            <>
              {/* Summary bar */}
              <div className="glass-card rounded-xl p-4 mb-4 flex items-center gap-6">
                <div className="text-sm font-medium text-foreground/60">{wlDetail?.name ?? ""}</div>
                <div className="flex gap-3 text-xs font-mono">
                  <span className="text-ngreen">{summary.buy} BUY</span>
                  <span className="text-nred">{summary.sell} SELL</span>
                  <span className="text-amber">{summary.hold} HOLD</span>
                </div>
                <div className="ml-auto flex gap-2 items-center">
                  <input
                    value={addSymbol}
                    onChange={(e) => setAddSymbol(e.target.value.toUpperCase())}
                    placeholder="Add symbol..."
                    className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1 text-xs font-mono text-foreground placeholder-foreground/20 outline-none focus:border-cyan/30 w-28"
                    onKeyDown={(e) => e.key === "Enter" && addStockMutation.mutate()}
                  />
                  <button
                    onClick={() => addStockMutation.mutate()}
                    disabled={!addSymbol.trim()}
                    className="text-xs text-cyan hover:text-cyan/80 disabled:opacity-30"
                  >
                    + Add
                  </button>
                </div>
              </div>

              {/* Stock table */}
              <div className="glass-card rounded-xl overflow-hidden animate-fade-in">
                {detailLoading ? (
                  <div className="p-8 text-center"><div className="shimmer h-4 w-40 rounded mx-auto" /></div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b border-white/[0.06] bg-white/[0.02]">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-foreground/40">Stock</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-foreground/40">LTP</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-foreground/40">Change %</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-foreground/40">Signal</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-foreground/40">Strength</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-foreground/40"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.03]">
                        {stocks.map((s: Record<string, unknown>) => (
                          <tr key={s.symbol as string} className="hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-2.5">
                              <Link href={`/stock/${encodeURIComponent(s.symbol as string)}`} className="text-cyan hover:underline font-medium">
                                {s.name as string}
                              </Link>
                            </td>
                            <td className="px-4 py-2.5 font-mono text-sm">
                              {(s.ltp as number)?.toLocaleString("en-IN", { maximumFractionDigits: 2 }) ?? "\u2014"}
                            </td>
                            <td className="px-4 py-2.5">
                              {s.change_pct != null ? (
                                <span className={`font-mono text-xs px-1.5 py-0.5 rounded ${(s.change_pct as number) >= 0 ? "bg-ngreen/10 text-ngreen" : "bg-nred/10 text-nred"}`}>
                                  {(s.change_pct as number) >= 0 ? "+" : ""}{(s.change_pct as number).toFixed(2)}%
                                </span>
                              ) : "\u2014"}
                            </td>
                            <td className="px-4 py-2.5">
                              {s.signal ? <SignalBadge signal={s.signal as string} size="sm" /> : "\u2014"}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-xs text-foreground/50">
                              {s.confidence != null ? `${(s.confidence as number).toFixed(0)}%` : "\u2014"}
                            </td>
                            <td className="px-4 py-2.5">
                              {!wlDetail?.is_default && (
                                <button
                                  onClick={() => removeStockMutation.mutate(s.symbol as string)}
                                  className="text-nred/30 hover:text-nred text-xs transition-colors"
                                >
                                  Remove
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {stocks.length === 0 && (
                      <div className="py-12 text-center text-sm text-foreground/25">
                        No stocks in this watchlist. Add some above.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="glass-card rounded-xl p-12 text-center text-foreground/25">
              Select a watchlist to view stocks
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

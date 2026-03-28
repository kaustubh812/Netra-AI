"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const ALERT_TYPE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  signal_change: { bg: "bg-purple/15", text: "text-purple", label: "SIGNAL CHANGE" },
  strength_spike: { bg: "bg-cyan/15", text: "text-cyan", label: "STRENGTH SPIKE" },
  volume_surge: { bg: "bg-amber/15", text: "text-amber", label: "VOLUME SURGE" },
  price_cross: { bg: "bg-ngreen/15", text: "text-ngreen", label: "PRICE CROSS" },
  regime_change: { bg: "bg-nred/15", text: "text-nred", label: "REGIME CHANGE" },
};

export default function AlertsPage() {
  const queryClient = useQueryClient();
  const [newSymbol, setNewSymbol] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newDirection, setNewDirection] = useState("above");

  const { data: alertsData, isLoading } = useQuery({
    queryKey: ["alerts"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/alerts?limit=100`);
      return res.json();
    },
    refetchInterval: 30 * 1000,
  });

  const { data: rulesData } = useQuery({
    queryKey: ["alert-rules"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/alerts/rules`);
      return res.json();
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async () => {
      await fetch(`${API_BASE}/api/alerts/read`, { method: "POST" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alerts"] }),
  });

  const createRuleMutation = useMutation({
    mutationFn: async () => {
      const params = new URLSearchParams({
        symbol: newSymbol.endsWith(".NS") ? newSymbol : newSymbol + ".NS",
        alert_type: "price_cross",
        price: newPrice,
        direction: newDirection,
      });
      await fetch(`${API_BASE}/api/alerts/rules?${params}`, { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-rules"] });
      setNewSymbol("");
      setNewPrice("");
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (ruleId: number) => {
      await fetch(`${API_BASE}/api/alerts/rules/${ruleId}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alert-rules"] }),
  });

  const alerts = alertsData?.alerts ?? [];
  const unread = alertsData?.unread ?? 0;
  const rules = rulesData?.rules ?? [];

  return (
    <div className="px-6 py-6 relative z-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="section-header text-xs font-medium text-foreground/40 uppercase tracking-widest mb-1">
            Alerts
          </h1>
          <p className="text-foreground/20 text-xs">
            {unread > 0 ? `${unread} unread alert${unread > 1 ? "s" : ""}` : "All caught up"}
          </p>
        </div>
        {unread > 0 && (
          <button
            onClick={() => markReadMutation.mutate()}
            className="text-xs text-cyan hover:text-cyan/80 px-3 py-1.5 rounded-lg border border-cyan/20 hover:border-cyan/30 transition-colors"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Create Price Alert */}
      <div className="glass-card rounded-xl p-4 mb-6 animate-fade-in">
        <h3 className="text-xs font-medium text-foreground/40 uppercase tracking-wider mb-3">Create Price Alert</h3>
        <div className="flex items-end gap-3">
          <div>
            <label className="block text-[10px] text-foreground/25 mb-1">Symbol</label>
            <input
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
              placeholder="RELIANCE"
              className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs font-mono text-foreground placeholder-foreground/20 outline-none focus:border-cyan/30 w-32"
            />
          </div>
          <div>
            <label className="block text-[10px] text-foreground/25 mb-1">Direction</label>
            <select
              value={newDirection}
              onChange={(e) => setNewDirection(e.target.value)}
              className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-foreground outline-none w-24"
            >
              <option value="above">Above</option>
              <option value="below">Below</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-foreground/25 mb-1">Price</label>
            <input
              type="number"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              placeholder="0.00"
              className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs font-mono text-foreground placeholder-foreground/20 outline-none focus:border-cyan/30 w-28"
            />
          </div>
          <button
            onClick={() => createRuleMutation.mutate()}
            disabled={!newSymbol || !newPrice}
            className="px-4 py-1.5 rounded-lg text-xs font-medium bg-cyan/15 text-cyan border border-cyan/25 hover:bg-cyan/25 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Create
          </button>
        </div>
      </div>

      {/* Active Rules */}
      {rules.length > 0 && (
        <div className="glass-card rounded-xl p-4 mb-6 animate-fade-in animate-fade-in-d1">
          <h3 className="text-xs font-medium text-foreground/40 uppercase tracking-wider mb-3">Active Rules ({rules.length})</h3>
          <div className="space-y-2">
            {rules.map((rule: Record<string, unknown>) => {
              const conditions = rule.condition_json ? JSON.parse(rule.condition_json as string) : {};
              return (
                <div key={rule.id as number} className="flex items-center justify-between py-2 border-b border-white/[0.03] last:border-0">
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${rule.enabled ? "bg-ngreen/15 text-ngreen" : "bg-white/[0.05] text-foreground/25"}`}>
                      {rule.enabled ? "ACTIVE" : "OFF"}
                    </span>
                    <span className="text-sm text-foreground/60">
                      {(rule.symbol as string)?.replace(".NS", "")} &middot; {rule.alert_type as string} &middot;{" "}
                      {conditions.direction} {conditions.price?.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <button
                    onClick={() => deleteRuleMutation.mutate(rule.id as number)}
                    className="text-nred/40 hover:text-nred text-xs transition-colors"
                  >
                    Delete
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Alert History */}
      <div className="glass-card rounded-xl overflow-hidden animate-fade-in animate-fade-in-d2">
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <h3 className="text-xs font-medium text-foreground/40 uppercase tracking-wider">Alert History</h3>
        </div>
        {isLoading ? (
          <div className="p-8 text-center"><div className="shimmer h-4 w-40 rounded mx-auto" /></div>
        ) : alerts.length === 0 ? (
          <div className="py-12 text-center text-sm text-foreground/25">
            No alerts triggered yet. Alerts are generated automatically when signals change, volume surges, or strength spikes.
          </div>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {alerts.map((alert: Record<string, unknown>) => {
              const typeStyle = ALERT_TYPE_STYLES[(alert.alert_type as string)] ?? ALERT_TYPE_STYLES.signal_change;
              return (
                <div key={alert.id as number} className={`flex items-start gap-3 px-4 py-3 ${alert.read ? "" : "bg-cyan/[0.02]"}`}>
                  <span className={`shrink-0 text-[9px] px-2 py-0.5 rounded-full font-mono font-medium ${typeStyle.bg} ${typeStyle.text} mt-0.5`}>
                    {typeStyle.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-foreground/70">{alert.message as string}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Link
                        href={`/stock/${encodeURIComponent(alert.symbol as string)}`}
                        className="text-[10px] text-cyan hover:underline font-mono"
                      >
                        {(alert.symbol as string)?.replace(".NS", "")}
                      </Link>
                      <span className="text-[10px] text-foreground/20 font-mono">
                        {alert.triggered_at as string}
                      </span>
                    </div>
                  </div>
                  {!alert.read && <span className="w-2 h-2 rounded-full bg-cyan shrink-0 mt-1.5" />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

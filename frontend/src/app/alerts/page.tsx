"use client";

import { useState, useEffect } from "react";
import { api, SmartAlert, SmartAlertCondition, TriggeredAlert, ConditionTypeDef } from "@/lib/api";
import Link from "next/link";
import { toUrlSymbol } from "@/lib/symbol";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);
  const [triggered, setTriggered] = useState<TriggeredAlert[]>([]);
  const [conditionTypes, setConditionTypes] = useState<Record<string, ConditionTypeDef>>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Builder state
  const [alertName, setAlertName] = useState("");
  const [alertSymbol, setAlertSymbol] = useState("");
  const [alertLogic, setAlertLogic] = useState<"AND" | "OR">("AND");
  const [conditions, setConditions] = useState<SmartAlertCondition[]>([
    { type: "signal", value: "BUY" },
  ]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [alertsData, typesData] = await Promise.all([
        api.getSmartAlerts(),
        api.getConditionTypes(),
      ]);
      setAlerts(alertsData.alerts);
      setTriggered(alertsData.triggered);
      setConditionTypes(typesData.types);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  function addCondition() {
    if (conditions.length >= 5) return;
    setConditions([...conditions, { type: "rsi_below", value: "40" }]);
  }

  function removeCondition(idx: number) {
    if (conditions.length <= 1) return;
    setConditions(conditions.filter((_, i) => i !== idx));
  }

  function updateCondition(idx: number, field: "type" | "value", val: string) {
    const updated = [...conditions];
    updated[idx] = { ...updated[idx], [field]: val };
    setConditions(updated);
  }

  async function handleCreate() {
    if (!alertName.trim() || conditions.length === 0) return;
    setCreating(true);
    try {
      await api.createSmartAlert(
        alertName,
        conditions,
        alertSymbol || undefined,
        alertLogic,
      );
      setAlertName("");
      setAlertSymbol("");
      setConditions([{ type: "signal", value: "BUY" }]);
      await loadData();
    } catch {
      // silent
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await api.deleteSmartAlert(id);
      await loadData();
    } catch {
      // silent
    }
  }

  async function handleScan() {
    try {
      const res = await api.scanSmartAlerts();
      if (res.new_triggers > 0) await loadData();
    } catch {
      // silent
    }
  }

  const typeKeys = Object.keys(conditionTypes);

  return (
    <div className="min-h-screen p-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="section-header text-xl font-bold text-foreground/90">Smart Alert Builder</h1>
        <p className="text-foreground/30 text-sm mt-1 ml-5">Create multi-condition alerts with AND/OR logic</p>
      </div>

      {/* Alert Builder */}
      <div className="glass-card-glow rounded-2xl p-5 mb-5">
        <h2 className="text-sm font-semibold text-foreground/70 mb-4">New Alert</h2>

        <div className="grid grid-cols-12 gap-3 mb-4">
          <div className="col-span-5">
            <label className="text-[10px] text-foreground/30 uppercase tracking-wider mb-1 block">Alert Name</label>
            <input
              type="text"
              value={alertName}
              onChange={(e) => setAlertName(e.target.value)}
              placeholder="e.g. Oversold BUY signals"
              className="w-full rounded-lg py-2 px-3 text-sm text-foreground/80 outline-none"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            />
          </div>
          <div className="col-span-4">
            <label className="text-[10px] text-foreground/30 uppercase tracking-wider mb-1 block">Stock (optional, blank = all)</label>
            <input
              type="text"
              value={alertSymbol}
              onChange={(e) => setAlertSymbol(e.target.value.toUpperCase())}
              placeholder="e.g. RELIANCE.NS"
              className="w-full rounded-lg py-2 px-3 text-sm text-foreground/80 outline-none"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            />
          </div>
          <div className="col-span-3">
            <label className="text-[10px] text-foreground/30 uppercase tracking-wider mb-1 block">Logic</label>
            <div className="flex gap-2">
              {(["AND", "OR"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setAlertLogic(l)}
                  className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
                  style={{
                    background: alertLogic === l ? "rgba(34,211,238,0.15)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${alertLogic === l ? "rgba(34,211,238,0.4)" : "rgba(255,255,255,0.06)"}`,
                    color: alertLogic === l ? "var(--cyan)" : "rgba(255,255,255,0.35)",
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Conditions */}
        <div className="space-y-2 mb-4">
          {conditions.map((cond, idx) => (
            <div key={idx} className="flex items-center gap-2">
              {idx > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded"
                  style={{ background: "rgba(34,211,238,0.1)", color: "var(--cyan)" }}>
                  {alertLogic}
                </span>
              )}
              <select
                value={cond.type}
                onChange={(e) => updateCondition(idx, "type", e.target.value)}
                className="rounded-lg py-2 px-3 text-sm text-foreground/70 outline-none flex-1"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                {typeKeys.map((tk) => (
                  <option key={tk} value={tk}>{conditionTypes[tk]?.label || tk}</option>
                ))}
              </select>

              {conditionTypes[cond.type]?.values ? (
                <select
                  value={String(cond.value)}
                  onChange={(e) => updateCondition(idx, "value", e.target.value)}
                  className="rounded-lg py-2 px-3 text-sm text-foreground/70 outline-none w-32"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  {conditionTypes[cond.type].values?.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  value={String(cond.value)}
                  onChange={(e) => updateCondition(idx, "value", e.target.value)}
                  className="rounded-lg py-2 px-3 text-sm text-foreground/70 outline-none w-32"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                />
              )}

              <span className="text-[10px] text-foreground/20 w-8">
                {conditionTypes[cond.type]?.unit || ""}
              </span>

              <button onClick={() => removeCondition(idx)} className="text-foreground/20 hover:text-red-400 transition-colors text-lg px-1">
                &times;
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={addCondition}
            disabled={conditions.length >= 5}
            className="text-xs px-3 py-1.5 rounded-lg transition-all"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)", opacity: conditions.length >= 5 ? 0.3 : 1 }}
          >
            + Add Condition
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !alertName.trim()}
            className="text-xs px-5 py-1.5 rounded-lg font-semibold transition-all"
            style={{
              background: "linear-gradient(135deg, rgba(34,211,238,0.2), rgba(167,139,250,0.15))",
              border: "1px solid rgba(34,211,238,0.3)",
              color: "var(--cyan)",
              opacity: creating || !alertName.trim() ? 0.4 : 1,
            }}
          >
            {creating ? "Creating..." : "Create Alert"}
          </button>
          <button
            onClick={handleScan}
            className="text-xs px-4 py-1.5 rounded-lg transition-all ml-auto"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}
          >
            Scan Now
          </button>
        </div>
      </div>

      {/* Active Alerts + Triggered Feed */}
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-7">
          <h2 className="section-header text-sm font-semibold text-foreground/60 mb-3">Active Alerts ({alerts.length})</h2>
          {loading && <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="glass-card rounded-xl h-16 shimmer" />)}</div>}
          {!loading && alerts.length === 0 && (
            <div className="glass-card rounded-xl p-8 text-center"><p className="text-foreground/20 text-sm">No alerts created yet</p></div>
          )}
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div key={alert.id} className="glass-card rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="text-sm font-semibold text-foreground/80">{alert.name}</span>
                    {alert.symbol && (
                      <Link href={`/stock/${toUrlSymbol(alert.symbol)}`} className="ml-2 text-xs text-cyan/60 hover:text-cyan transition-colors">
                        {alert.symbol.replace(".NS", "")}
                      </Link>
                    )}
                    <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: "rgba(34,211,238,0.1)", color: "var(--cyan)" }}>
                      {alert.logic}
                    </span>
                  </div>
                  <button onClick={() => handleDelete(alert.id)} className="text-foreground/15 hover:text-red-400 transition-colors text-xs">
                    Delete
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {alert.conditions.map((c, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded font-mono"
                      style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.15)", color: "rgba(167,139,250,0.7)" }}>
                      {conditionTypes[c.type]?.label || c.type}: {String(c.value)}{conditionTypes[c.type]?.unit || ""}
                    </span>
                  ))}
                </div>
                {alert.last_triggered_at && (
                  <p className="text-[10px] text-foreground/20 mt-2">Last triggered: {new Date(alert.last_triggered_at).toLocaleString("en-IN")}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-5">
          <h2 className="section-header text-sm font-semibold text-foreground/60 mb-3">Recent Triggers</h2>
          {triggered.length === 0 && !loading && (
            <div className="glass-card rounded-xl p-6 text-center"><p className="text-foreground/20 text-xs">No triggers yet</p></div>
          )}
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {triggered.map((t) => (
              <div key={t.id} className="glass-card rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Link href={`/stock/${toUrlSymbol(t.symbol)}`} className="text-sm font-semibold text-foreground/70 hover:text-cyan transition-colors">
                    {t.symbol.replace(".NS", "")}
                  </Link>
                  <span className="text-[10px] text-foreground/20">{new Date(t.triggered_at).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}</span>
                </div>
                <p className="text-xs text-foreground/40">{t.message}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

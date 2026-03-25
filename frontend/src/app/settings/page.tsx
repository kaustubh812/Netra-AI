"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [refreshStatus, setRefreshStatus] = useState("");
  const [retrainStatus, setRetrainStatus] = useState("");

  const { data: metrics } = useQuery({
    queryKey: ["training-metrics"],
    queryFn: api.getTrainingMetrics,
  });

  const refreshMutation = useMutation({
    mutationFn: api.refreshData,
    onSuccess: (data) => {
      setRefreshStatus(data.status);
      queryClient.invalidateQueries();
    },
    onError: (err) => setRefreshStatus(`Error: ${err.message}`),
  });

  const retrainMutation = useMutation({
    mutationFn: api.retrain,
    onSuccess: (data) => {
      setRetrainStatus(data.status);
      queryClient.invalidateQueries({ queryKey: ["training-metrics"] });
    },
    onError: (err) => setRetrainStatus(`Error: ${err.message}`),
  });

  const metricEntries = Object.entries(metrics?.metrics ?? {});

  return (
    <div className="max-w-screen-lg mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {/* Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="bg-surface rounded-lg border border-border p-4">
          <h3 className="font-medium mb-2">Data Refresh</h3>
          <p className="text-sm text-foreground/50 mb-3">
            Fetch latest market data and regenerate signals for all stocks.
          </p>
          <button
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            className="px-4 py-2 rounded bg-cyan/20 text-cyan border border-cyan/30 text-sm font-medium hover:bg-cyan/30 transition-colors disabled:opacity-50"
          >
            {refreshMutation.isPending ? "Refreshing..." : "Refresh Data"}
          </button>
          {refreshStatus && (
            <div className="mt-2 text-xs text-ngreen">{refreshStatus}</div>
          )}
        </div>

        <div className="bg-surface rounded-lg border border-border p-4">
          <h3 className="font-medium mb-2">Model Retraining</h3>
          <p className="text-sm text-foreground/50 mb-3">
            Retrain XGBoost models for all stocks with latest data.
          </p>
          <button
            onClick={() => retrainMutation.mutate()}
            disabled={retrainMutation.isPending}
            className="px-4 py-2 rounded bg-amber/20 text-amber border border-amber/30 text-sm font-medium hover:bg-amber/30 transition-colors disabled:opacity-50"
          >
            {retrainMutation.isPending ? "Retraining..." : "Retrain Models"}
          </button>
          {retrainStatus && (
            <div className="mt-2 text-xs text-ngreen">{retrainStatus}</div>
          )}
        </div>
      </div>

      {/* Training Metrics */}
      <div className="bg-surface rounded-lg border border-border p-4">
        <h3 className="font-medium mb-4">Training Metrics</h3>
        {metricEntries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr>
                  <th className="px-3 py-2 text-left text-xs text-foreground/50">Symbol</th>
                  <th className="px-3 py-2 text-left text-xs text-foreground/50">Accuracy</th>
                  <th className="px-3 py-2 text-left text-xs text-foreground/50">Precision</th>
                  <th className="px-3 py-2 text-left text-xs text-foreground/50">Recall</th>
                  <th className="px-3 py-2 text-left text-xs text-foreground/50">F1 Score</th>
                  <th className="px-3 py-2 text-left text-xs text-foreground/50">Samples</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {metricEntries.map(([sym, m]: [string, any]) => (
                  <tr key={sym} className="hover:bg-surface-2">
                    <td className="px-3 py-2 font-mono text-cyan">{sym}</td>
                    <td className="px-3 py-2 font-mono">{((m.accuracy ?? 0) * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2 font-mono">{((m.precision ?? 0) * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2 font-mono">{((m.recall ?? 0) * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2 font-mono">{((m.f1_score ?? 0) * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2 font-mono text-foreground/50">
                      {m.train_samples ?? "—"} / {m.test_samples ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-foreground/40 text-sm">
            No training metrics available yet. Train models first using the button above or the CLI.
          </div>
        )}
      </div>

      {/* Signal Thresholds Info */}
      <div className="bg-surface rounded-lg border border-border p-4 mt-4">
        <h3 className="font-medium mb-3">Signal Configuration</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-foreground/50">BUY Threshold:</span>
            <span className="font-mono ml-2">{'>'} 0.65</span>
          </div>
          <div>
            <span className="text-foreground/50">SELL Threshold:</span>
            <span className="font-mono ml-2">{'<'} 0.35</span>
          </div>
          <div>
            <span className="text-foreground/50">XGBoost Weight:</span>
            <span className="font-mono ml-2">40%</span>
          </div>
          <div>
            <span className="text-foreground/50">Supertrend Weight:</span>
            <span className="font-mono ml-2">20%</span>
          </div>
          <div>
            <span className="text-foreground/50">RSI Weight:</span>
            <span className="font-mono ml-2">15%</span>
          </div>
          <div>
            <span className="text-foreground/50">MACD Weight:</span>
            <span className="font-mono ml-2">15%</span>
          </div>
          <div>
            <span className="text-foreground/50">Volume Weight:</span>
            <span className="font-mono ml-2">10%</span>
          </div>
          <div>
            <span className="text-foreground/50">Stop Loss ATR Mult:</span>
            <span className="font-mono ml-2">1.5x</span>
          </div>
        </div>
        <p className="text-xs text-foreground/30 mt-3">
          To change thresholds, edit backend/config.py and restart the server.
        </p>
      </div>
    </div>
  );
}

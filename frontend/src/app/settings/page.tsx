"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

const BTN_STYLES = {
  cyan: "bg-cyan/15 text-cyan border border-cyan/25 hover:bg-cyan/25 hover:shadow-[0_0_16px_rgba(0,229,255,0.15)]",
  amber: "bg-amber/15 text-amber border border-amber/25 hover:bg-amber/25 hover:shadow-[0_0_16px_rgba(255,171,0,0.15)]",
  green: "bg-ngreen/15 text-ngreen border border-ngreen/25 hover:bg-ngreen/25 hover:shadow-[0_0_16px_rgba(0,200,83,0.15)]",
} as const;

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [refreshStatus, setRefreshStatus] = useState("");
  const [retrainStatus, setRetrainStatus] = useState("");
  const [newsStatus, setNewsStatus] = useState("");
  const [fundStatus, setFundStatus] = useState("");
  const [metaStatus, setMetaStatus] = useState("");
  const [seedStatus, setSeedStatus] = useState("");
  const [intradayGenStatus, setIntradayGenStatus] = useState("");

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

  const newsMutation = useMutation({
    mutationFn: api.refreshNews,
    onSuccess: (data) => {
      setNewsStatus(data.status);
      queryClient.invalidateQueries({ queryKey: ["market-news"] });
    },
    onError: (err) => setNewsStatus(`Error: ${err.message}`),
  });

  const fundMutation = useMutation({
    mutationFn: api.refreshFundamentals,
    onSuccess: (data) => {
      setFundStatus(data.status);
      queryClient.invalidateQueries({ queryKey: ["fundamentals"] });
    },
    onError: (err) => setFundStatus(`Error: ${err.message}`),
  });

  const metaMutation = useMutation({
    mutationFn: api.trainMetaModel,
    onSuccess: (data) => {
      setMetaStatus(data.status);
      queryClient.invalidateQueries({ queryKey: ["meta-model"] });
    },
    onError: (err) => setMetaStatus(`Error: ${err.message}`),
  });

  const { data: metaMetrics } = useQuery({
    queryKey: ["meta-model"],
    queryFn: api.getMetaModelMetrics,
  });

  const seedMutation = useMutation({
    mutationFn: api.seedIntraday,
    onSuccess: (data) => {
      setSeedStatus(data.status);
    },
    onError: (err) => setSeedStatus(`Error: ${err.message}`),
  });

  const intradayGenMutation = useMutation({
    mutationFn: api.generateIntraday,
    onSuccess: (data) => {
      setIntradayGenStatus(data.status);
      queryClient.invalidateQueries({ queryKey: ["intraday-signals"] });
    },
    onError: (err) => setIntradayGenStatus(`Error: ${err.message}`),
  });

  const metricEntries = Object.entries(metrics?.metrics ?? {});

  return (
    <div className="max-w-screen-lg mx-auto px-6 py-8 relative z-10">
      <h1 className="text-2xl font-bold mb-8">Settings</h1>

      {/* Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="glass-card rounded-xl p-5">
          <h3 className="font-medium mb-2">Data Refresh</h3>
          <p className="text-sm text-foreground/40 mb-4">
            Fetch latest market data and regenerate signals for all stocks.
          </p>
          <button
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 ${BTN_STYLES.cyan}`}
          >
            {refreshMutation.isPending ? "Refreshing..." : "Refresh Data"}
          </button>
          {refreshStatus && (
            <div className="mt-2 text-xs text-ngreen">{refreshStatus}</div>
          )}
        </div>

        <div className="glass-card rounded-xl p-5">
          <h3 className="font-medium mb-2">Model Retraining</h3>
          <p className="text-sm text-foreground/40 mb-4">
            Retrain XGBoost models for all stocks with latest data.
          </p>
          <button
            onClick={() => retrainMutation.mutate()}
            disabled={retrainMutation.isPending}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 ${BTN_STYLES.amber}`}
          >
            {retrainMutation.isPending ? "Retraining..." : "Retrain Models"}
          </button>
          {retrainStatus && (
            <div className="mt-2 text-xs text-ngreen">{retrainStatus}</div>
          )}
        </div>

        <div className="glass-card rounded-xl p-5">
          <h3 className="font-medium mb-2">News Sentiment</h3>
          <p className="text-sm text-foreground/40 mb-4">
            Fetch latest news from RSS feeds and score sentiment with GPT-5.4-mini.
          </p>
          <button
            onClick={() => newsMutation.mutate()}
            disabled={newsMutation.isPending}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 ${BTN_STYLES.green}`}
          >
            {newsMutation.isPending ? "Fetching..." : "Refresh News"}
          </button>
          {newsStatus && (
            <div className="mt-2 text-xs text-ngreen">{newsStatus}</div>
          )}
        </div>

        <div className="glass-card rounded-xl p-5">
          <h3 className="font-medium mb-2">Fundamentals</h3>
          <p className="text-sm text-foreground/40 mb-4">
            Fetch P/E, P/B, margins, growth data from yfinance for all stocks.
          </p>
          <button
            onClick={() => fundMutation.mutate()}
            disabled={fundMutation.isPending}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 ${BTN_STYLES.cyan}`}
          >
            {fundMutation.isPending ? "Fetching..." : "Refresh Fundamentals"}
          </button>
          {fundStatus && (
            <div className="mt-2 text-xs text-ngreen">{fundStatus}</div>
          )}
        </div>
      </div>

      {/* Intraday Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="glass-card rounded-xl p-5 gradient-border-cyan">
          <h3 className="font-medium mb-2">Seed Intraday Data</h3>
          <p className="text-sm text-foreground/40 mb-4">
            Fetch 60 days of 5-minute candles for all NIFTY 50 stocks. One-time setup for the intraday engine.
          </p>
          <button
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 ${BTN_STYLES.cyan}`}
          >
            {seedMutation.isPending ? "Seeding..." : "Seed Intraday Data"}
          </button>
          {seedStatus && (
            <div className="mt-2 text-xs text-ngreen">{seedStatus}</div>
          )}
        </div>

        <div className="glass-card rounded-xl p-5 gradient-border-cyan">
          <h3 className="font-medium mb-2">Generate Intraday Signals</h3>
          <p className="text-sm text-foreground/40 mb-4">
            Run the 8-component intraday signal engine on the latest 5-minute candle data.
          </p>
          <button
            onClick={() => intradayGenMutation.mutate()}
            disabled={intradayGenMutation.isPending}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 ${BTN_STYLES.green}`}
          >
            {intradayGenMutation.isPending ? "Generating..." : "Generate Intraday Signals"}
          </button>
          {intradayGenStatus && (
            <div className="mt-2 text-xs text-ngreen">{intradayGenStatus}</div>
          )}
        </div>
      </div>

      {/* Training Metrics */}
      <div className="glass-card rounded-xl p-5 gradient-border-cyan">
        <h3 className="section-header text-xs text-foreground/40 uppercase tracking-widest mb-4">Training Metrics</h3>
        {metricEntries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-white/[0.06]">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs text-foreground/40">Symbol</th>
                  <th className="px-3 py-2.5 text-left text-xs text-foreground/40">Accuracy</th>
                  <th className="px-3 py-2.5 text-left text-xs text-foreground/40">Precision</th>
                  <th className="px-3 py-2.5 text-left text-xs text-foreground/40">Recall</th>
                  <th className="px-3 py-2.5 text-left text-xs text-foreground/40">F1 Score</th>
                  <th className="px-3 py-2.5 text-left text-xs text-foreground/40">Samples</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {metricEntries.map(([sym, m]: [string, any]) => (
                  <tr key={sym} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-3 py-2.5 font-mono text-cyan">{sym}</td>
                    <td className="px-3 py-2.5 font-mono">{((m.accuracy ?? 0) * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2.5 font-mono">{((m.precision ?? 0) * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2.5 font-mono">{((m.recall ?? 0) * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2.5 font-mono">{((m.f1_score ?? 0) * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2.5 font-mono text-foreground/40">
                      {m.train_samples ?? "\u2014"} / {m.test_samples ?? "\u2014"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-foreground/30 text-sm">
            No training metrics available yet. Train models first using the button above or the CLI.
          </div>
        )}
      </div>

      <div className="section-divider" />

      {/* Signal Thresholds Info */}
      <div className="glass-card rounded-xl p-5">
        <h3 className="section-header text-xs text-foreground/40 uppercase tracking-widest mb-4">Signal Configuration</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-foreground/40">BUY Threshold:</span>
            <span className="font-mono ml-2">{'>'} 0.65</span>
          </div>
          <div>
            <span className="text-foreground/40">SELL Threshold:</span>
            <span className="font-mono ml-2">{'<'} 0.35</span>
          </div>
          <div>
            <span className="text-foreground/40">XGBoost Ensemble:</span>
            <span className="font-mono ml-2">20%</span>
          </div>
          <div>
            <span className="text-foreground/40">LSTM Deep Learning:</span>
            <span className="font-mono ml-2 text-cyan">12%</span>
          </div>
          <div>
            <span className="text-foreground/40">Supertrend Weight:</span>
            <span className="font-mono ml-2">10%</span>
          </div>
          <div>
            <span className="text-foreground/40">RSI Weight:</span>
            <span className="font-mono ml-2">8%</span>
          </div>
          <div>
            <span className="text-foreground/40">MACD Weight:</span>
            <span className="font-mono ml-2">8%</span>
          </div>
          <div>
            <span className="text-foreground/40">Volume Weight:</span>
            <span className="font-mono ml-2">5%</span>
          </div>
          <div>
            <span className="text-foreground/40">News Sentiment:</span>
            <span className="font-mono ml-2 text-ngreen">12%</span>
          </div>
          <div>
            <span className="text-foreground/40">Fundamentals:</span>
            <span className="font-mono ml-2 text-cyan">13%</span>
          </div>
          <div>
            <span className="text-foreground/40">Macro Signals:</span>
            <span className="font-mono ml-2 text-amber">12%</span>
          </div>
          <div>
            <span className="text-foreground/40">Stop Loss ATR Mult:</span>
            <span className="font-mono ml-2">1.5x</span>
          </div>
        </div>
        <p className="text-xs text-foreground/20 mt-4">
          To change thresholds, edit backend/config.py and restart the server.
        </p>
      </div>

      <div className="section-divider" />

      {/* Meta-Model */}
      <div className="glass-card rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="section-header text-xs text-foreground/40 uppercase tracking-widest">Meta-Model (Layer 2)</h3>
          <button
            onClick={() => metaMutation.mutate()}
            disabled={metaMutation.isPending}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50 ${BTN_STYLES.amber}`}
          >
            {metaMutation.isPending ? "Training..." : "Train Meta-Model"}
          </button>
        </div>
        {metaStatus && (
          <div className="text-xs text-ngreen mb-2">{metaStatus}</div>
        )}
        <p className="text-xs text-foreground/35 mb-4">
          The meta-model learns optimal signal component weights from historical performance.
          It takes all 8 component scores as input and produces a refined BUY/SELL/HOLD prediction.
        </p>
        {metaMetrics?.available && metaMetrics.metrics ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-foreground/40 text-xs">Meta Accuracy:</span>
              <div className="font-mono text-ngreen">{((metaMetrics.metrics.accuracy as number) * 100).toFixed(1)}%</div>
            </div>
            <div>
              <span className="text-foreground/40 text-xs">Static Accuracy:</span>
              <div className="font-mono">{((metaMetrics.metrics.static_accuracy as number) * 100).toFixed(1)}%</div>
            </div>
            <div>
              <span className="text-foreground/40 text-xs">Improvement:</span>
              <div className={`font-mono ${(metaMetrics.metrics.improvement as number) > 0 ? "text-ngreen" : "text-nred"}`}>
                {(metaMetrics.metrics.improvement as number) > 0 ? "+" : ""}{((metaMetrics.metrics.improvement as number) * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <span className="text-foreground/40 text-xs">Samples:</span>
              <div className="font-mono text-foreground/60">
                {metaMetrics.metrics.train_samples as number} / {metaMetrics.metrics.test_samples as number}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-foreground/30 text-sm">
            No meta-model trained yet. Click &quot;Train Meta-Model&quot; after generating enough signal history.
          </div>
        )}
      </div>
    </div>
  );
}

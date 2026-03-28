"use client";

import { createContext, useContext } from "react";

export interface WorkspaceContextType {
  linkedSymbol: string;
  setLinkedSymbol: (symbol: string) => void;
}

export const WorkspaceContext = createContext<WorkspaceContextType>({
  linkedSymbol: "RELIANCE.NS",
  setLinkedSymbol: () => {},
});

export function useWorkspace() {
  return useContext(WorkspaceContext);
}

// Panel type definitions
export type PanelType =
  | "chart"
  | "indicators"
  | "news"
  | "fundamentals"
  | "signals"
  | "backtest"
  | "heatmap-mini"
  | "watchlist"
  | "macro"
  | "regime";

export interface PanelConfig {
  id: string;
  type: PanelType;
  title: string;
}

export interface WorkspaceLayout {
  id: string;
  name: string;
  columns: number;
  panels: PanelConfig[];
}

export const PANEL_CATALOG: { type: PanelType; label: string; description: string }[] = [
  { type: "chart", label: "Price Chart", description: "Candlestick chart with signals" },
  { type: "indicators", label: "Indicators", description: "Technical indicator breakdown" },
  { type: "news", label: "News", description: "Stock news & sentiment" },
  { type: "fundamentals", label: "Fundamentals", description: "Valuation & financial health" },
  { type: "signals", label: "Signal Table", description: "All stock signals overview" },
  { type: "backtest", label: "Backtest", description: "Historical signal performance" },
  { type: "heatmap-mini", label: "Mini Heatmap", description: "Quick market heatmap" },
  { type: "watchlist", label: "Watchlist", description: "Watched stocks with prices" },
  { type: "macro", label: "Macro", description: "Global macro indicators" },
  { type: "regime", label: "Regime", description: "Market regime detection" },
];

export const PRESET_LAYOUTS: WorkspaceLayout[] = [
  {
    id: "overview",
    name: "Overview",
    columns: 2,
    panels: [
      { id: "p1", type: "chart", title: "Price Chart" },
      { id: "p2", type: "signals", title: "Signal Table" },
      { id: "p3", type: "macro", title: "Macro" },
      { id: "p4", type: "regime", title: "Regime" },
    ],
  },
  {
    id: "trading",
    name: "Trading",
    columns: 3,
    panels: [
      { id: "p1", type: "chart", title: "Price Chart" },
      { id: "p2", type: "indicators", title: "Indicators" },
      { id: "p3", type: "news", title: "News" },
      { id: "p4", type: "fundamentals", title: "Fundamentals" },
      { id: "p5", type: "backtest", title: "Backtest" },
      { id: "p6", type: "watchlist", title: "Watchlist" },
    ],
  },
  {
    id: "analysis",
    name: "Analysis",
    columns: 2,
    panels: [
      { id: "p1", type: "chart", title: "Price Chart" },
      { id: "p2", type: "fundamentals", title: "Fundamentals" },
      { id: "p3", type: "indicators", title: "Indicators" },
      { id: "p4", type: "backtest", title: "Backtest" },
    ],
  },
];

let _counter = 0;
export function generatePanelId(): string {
  _counter++;
  return `p-${Date.now()}-${_counter}`;
}

"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, PaperTrade } from "@/lib/api";
import { TradeView } from "@/components/paper-trading/trade-view";
import { PositionsView } from "@/components/paper-trading/positions-view";
import { OrdersView } from "@/components/paper-trading/orders-view";
import { OverviewView } from "@/components/paper-trading/overview-view";

type Tab = "trade" | "positions" | "orders" | "overview";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "trade", label: "Trade", icon: "📈" },
  { key: "positions", label: "Positions", icon: "💼" },
  { key: "orders", label: "Orders", icon: "📋" },
  { key: "overview", label: "Overview", icon: "📊" },
];

export default function PaperTradingPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("trade");
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  // ─── Queries ────────────────────────────────────────────────────
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
    queryFn: () => api.getPaperTradeHistory(100),
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

  // ─── Mutations ──────────────────────────────────────────────────
  const placeMutation = useMutation({
    mutationFn: (params: {
      trade_type: "BUY" | "SELL";
      quantity: number;
      price: number;
      stop_loss?: number;
      target_price?: number;
      order_type: string;
      product_type: string;
    }) =>
      api.placePaperTrade(
        selectedSymbol!,
        params.trade_type,
        params.quantity,
        params.price,
        params.stop_loss,
        params.target_price,
        undefined, // signal_confidence
        undefined, // notes
        params.order_type,
        params.product_type
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["paper-positions"] });
      queryClient.invalidateQueries({ queryKey: ["paper-stats"] });
      queryClient.invalidateQueries({ queryKey: ["paper-suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["paper-history"] });
    },
  });

  const closeMutation = useMutation({
    mutationFn: ({ id, price }: { id: number; price: number }) =>
      api.closePaperTrade(id, price),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["paper-positions"] });
      queryClient.invalidateQueries({ queryKey: ["paper-stats"] });
      queryClient.invalidateQueries({ queryKey: ["paper-history"] });
      queryClient.invalidateQueries({ queryKey: ["paper-suggestions"] });
    },
  });

  // ─── Derived Data ───────────────────────────────────────────────
  const positions = positionsData?.positions ?? [];
  const stats = statsData ?? null;
  const history = historyData?.trades ?? [];
  const suggestions = suggestionsData?.suggestions ?? [];
  const allStocks = stocksData?.stocks ?? [];
  const marketOpen = stocksData?.market_open ?? false;

  // All trades (open + closed) for orders view
  const allTrades: PaperTrade[] = [
    ...positions.map((p) => ({
      id: p.id,
      symbol: p.symbol,
      name: p.name,
      trade_type: p.trade_type,
      quantity: p.quantity,
      entry_price: p.entry_price,
      exit_price: null,
      pnl: p.unrealized_pnl,
      pnl_pct: p.unrealized_pnl_pct,
      trade_date: p.trade_date,
      closed_date: null,
      signal_confidence: p.signal_confidence,
      status: "OPEN",
      order_type: p.order_type,
      product_type: p.product_type,
    })),
    ...history,
  ];

  // ─── Handlers ───────────────────────────────────────────────────
  const handleSelectSymbol = (symbol: string) => {
    setSelectedSymbol(symbol);
    setActiveTab("trade");
  };

  const handleTakeTrade = (symbol: string) => {
    setSelectedSymbol(symbol);
    setActiveTab("trade");
  };

  const handleClose = (id: number, price: number) => {
    closeMutation.mutate({ id, price });
  };

  return (
    <div className="px-6 py-6 relative z-10">
      {/* Header + Tabs */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-foreground">Paper Trading</h1>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 mb-5 bg-white/[0.02] rounded-xl p-1 border border-white/[0.04] w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === tab.key
                ? "bg-cyan/10 text-cyan border border-cyan/20 shadow-[0_0_16px_rgba(34,211,238,0.12)]"
                : "text-foreground/40 hover:text-foreground/60 hover:bg-white/[0.03] border border-transparent"
            }`}
            id={`tab-${tab.key}`}
          >
            <span className="text-sm">{tab.icon}</span>
            {tab.label}
            {tab.key === "positions" && positions.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono bg-cyan/10 text-cyan/60">
                {positions.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "trade" && (
        <TradeView
          stocks={allStocks}
          selectedSymbol={selectedSymbol}
          onSelectSymbol={handleSelectSymbol}
          onTrade={(params) => placeMutation.mutate(params)}
          isPlacing={placeMutation.isPending}
          stats={stats}
          marketOpen={marketOpen}
        />
      )}

      {activeTab === "positions" && (
        <PositionsView
          positions={positions}
          onSelectSymbol={handleSelectSymbol}
          onClose={handleClose}
          isClosing={closeMutation.isPending}
        />
      )}

      {activeTab === "orders" && <OrdersView trades={allTrades} />}

      {activeTab === "overview" && (
        <OverviewView
          stats={stats}
          suggestions={suggestions}
          onTakeTrade={handleTakeTrade}
        />
      )}
    </div>
  );
}

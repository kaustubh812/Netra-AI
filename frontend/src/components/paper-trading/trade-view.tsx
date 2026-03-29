"use client";

import { useMemo } from "react";
import { StockInfo, PaperTradingStats } from "@/lib/api";
import { StockChart } from "@/components/chart";
import { StockSearch } from "./stock-search";
import { BuySellPanel } from "./buy-sell-panel";

interface TradeViewProps {
  stocks: StockInfo[];
  selectedSymbol: string | null;
  onSelectSymbol: (symbol: string) => void;
  onTrade: (params: {
    trade_type: "BUY" | "SELL";
    quantity: number;
    price: number;
    stop_loss?: number;
    target_price?: number;
    order_type: string;
    product_type: string;
  }) => void;
  isPlacing?: boolean;
  stats: PaperTradingStats | null;
  marketOpen?: boolean;
}

const PAPER_STARTING_BALANCE = 10_00_000; // ₹10,00,000

export function TradeView({ stocks, selectedSymbol, onSelectSymbol, onTrade, isPlacing, stats, marketOpen }: TradeViewProps) {
  const selectedStock = useMemo(
    () => stocks.find((s) => s.symbol === selectedSymbol),
    [stocks, selectedSymbol]
  );

  // Compute paper balance (starting - invested + realized P&L)
  const balance = useMemo(() => {
    if (!stats) return PAPER_STARTING_BALANCE;
    return PAPER_STARTING_BALANCE + stats.total_realized_pnl;
  }, [stats]);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Search Bar */}
      <StockSearch
        stocks={stocks}
        onSelect={onSelectSymbol}
        selectedSymbol={selectedSymbol ?? undefined}
      />

      {selectedSymbol && selectedStock ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Chart Section — col-span-8 */}
          <div className="lg:col-span-8 space-y-3">
            {/* Stock Header */}
            <div className="glass-card rounded-xl px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <h2 className="text-base font-bold text-foreground">
                    {selectedStock.name}
                  </h2>
                  <span className="text-[10px] font-mono text-foreground/30">
                    NSE: {selectedSymbol.replace(".NS", "")}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-lg font-bold">
                  ₹{selectedStock.ltp?.toLocaleString("en-IN") ?? "—"}
                </div>
                {selectedStock.change_pct !== undefined && (
                  <div
                    className={`font-mono text-xs ${
                      selectedStock.change_pct >= 0 ? "text-ngreen" : "text-nred"
                    }`}
                  >
                    {selectedStock.change !== undefined && (
                      <span>
                        {selectedStock.change >= 0 ? "+" : ""}
                        {selectedStock.change.toFixed(2)}{" "}
                      </span>
                    )}
                    ({selectedStock.change_pct >= 0 ? "+" : ""}
                    {selectedStock.change_pct}%)
                  </div>
                )}
              </div>
            </div>

            {/* Chart */}
            <StockChart
              symbol={selectedSymbol}
              entryPrice={selectedStock.entry_price}
              stopLoss={selectedStock.stop_loss}
              targetPrice={selectedStock.target_price}
              signal={selectedStock.signal}
            />
          </div>

          {/* Buy/Sell Panel — col-span-4 */}
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-4">
              <BuySellPanel
                symbol={selectedSymbol}
                stockName={selectedStock.name}
                ltp={selectedStock.ltp ?? null}
                signal={selectedStock.signal}
                onTrade={onTrade}
                isPlacing={isPlacing}
                balance={balance}
                marketOpen={marketOpen}
              />
            </div>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="glass-card rounded-xl p-16 text-center animate-fade-in">
          <div className="text-4xl mb-4 opacity-20">📈</div>
          <h3 className="text-foreground/40 text-sm font-medium mb-1">
            Search for a stock to start trading
          </h3>
          <p className="text-foreground/20 text-xs">
            Use the search bar above to find and select a stock
          </p>
        </div>
      )}
    </div>
  );
}

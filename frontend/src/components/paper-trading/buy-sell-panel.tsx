"use client";

import { useState, useEffect, useMemo } from "react";

interface BuySellPanelProps {
  symbol: string;
  stockName: string;
  ltp: number | null;
  signal?: string;
  onTrade: (params: {
    trade_type: "BUY" | "SELL";
    quantity: number;
    price: number;
    stop_loss?: number;
    target_price?: number;
    order_type: string;
    product_type: string;
    notes?: string;
  }) => void;
  isPlacing?: boolean;
  balance: number;
  marketOpen?: boolean;
}

export function BuySellPanel({ symbol, stockName, ltp, signal, onTrade, isPlacing, balance, marketOpen = true }: BuySellPanelProps) {
  const [tradeType, setTradeType] = useState<"BUY" | "SELL">(
    signal === "SELL" ? "SELL" : "BUY"
  );
  const [orderType, setOrderType] = useState<"MARKET" | "LIMIT">("MARKET");
  const [productType, setProductType] = useState<"DELIVERY" | "INTRADAY">("DELIVERY");
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [target, setTarget] = useState("");

  // Update price when LTP changes (for market orders)
  useEffect(() => {
    if (ltp !== null && orderType === "MARKET") {
      setPrice(String(ltp));
    }
  }, [ltp, orderType]);

  // Update on symbol change
  useEffect(() => {
    if (ltp !== null) setPrice(String(ltp));
    setQuantity("1");
    setStopLoss("");
    setTarget("");
  }, [symbol, ltp]);

  // Sync trade type with signal
  useEffect(() => {
    if (signal === "SELL") setTradeType("SELL");
    else if (signal === "BUY") setTradeType("BUY");
  }, [signal]);

  const qty = parseFloat(quantity) || 0;
  const prc = parseFloat(price) || 0;
  const orderValue = qty * prc;

  const isValid = qty > 0 && prc > 0 && symbol;
  const isBuy = tradeType === "BUY";

  const handleSubmit = () => {
    if (!isValid) return;
    onTrade({
      trade_type: tradeType,
      quantity: qty,
      price: prc,
      stop_loss: stopLoss ? parseFloat(stopLoss) : undefined,
      target_price: target ? parseFloat(target) : undefined,
      order_type: orderType,
      product_type: productType,
    });
  };

  const INR = (v: number) =>
    v.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

  return (
    <div
      className="glass-card rounded-xl overflow-hidden animate-fade-in"
      style={{ border: `1px solid ${isBuy ? "rgba(0,200,83,0.15)" : "rgba(255,23,68,0.15)"}` }}
    >
      {/* BUY / SELL Toggle */}
      <div className="flex">
        <button
          onClick={() => setTradeType("BUY")}
          className={`flex-1 py-3 text-sm font-semibold tracking-wide transition-all ${
            isBuy
              ? "bg-ngreen/15 text-ngreen border-b-2 border-ngreen"
              : "bg-white/[0.02] text-foreground/40 border-b-2 border-transparent hover:text-foreground/60"
          }`}
        >
          BUY
        </button>
        <button
          onClick={() => setTradeType("SELL")}
          className={`flex-1 py-3 text-sm font-semibold tracking-wide transition-all ${
            !isBuy
              ? "bg-nred/15 text-nred border-b-2 border-nred"
              : "bg-white/[0.02] text-foreground/40 border-b-2 border-transparent hover:text-foreground/60"
          }`}
        >
          SELL
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Market Closed Banner */}
        {!marketOpen && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-nred/[0.08] border border-nred/20">
            <span className="text-nred text-sm">⏸</span>
            <div>
              <p className="text-[11px] text-nred font-medium">Market Closed</p>
              <p className="text-[9px] text-foreground/30">Mon–Fri, 9:15 AM – 3:30 PM IST</p>
            </div>
          </div>
        )}
        {/* Product Type: Delivery / Intraday */}
        <div className="flex gap-2">
          {(["DELIVERY", "INTRADAY"] as const).map((pt) => (
            <button
              key={pt}
              onClick={() => setProductType(pt)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                productType === pt
                  ? "bg-cyan/10 text-cyan border border-cyan/30"
                  : "bg-white/[0.04] text-foreground/40 border border-white/[0.06] hover:text-foreground/60"
              }`}
            >
              {pt === "DELIVERY" ? "Delivery" : "Intraday"}
            </button>
          ))}
        </div>

        {/* Quantity */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] text-foreground/40 uppercase tracking-wider">Qty</label>
            <span className="text-[10px] text-foreground/25 font-mono">NSE</span>
          </div>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            min="1"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-foreground font-mono outline-none focus:border-cyan/40 transition-colors"
            placeholder="1"
            id="buy-sell-qty"
          />
        </div>

        {/* Price + Order Type */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] text-foreground/40 uppercase tracking-wider">Price</label>
            <div className="flex gap-1">
              {(["MARKET", "LIMIT"] as const).map((ot) => (
                <button
                  key={ot}
                  onClick={() => {
                    setOrderType(ot);
                    if (ot === "MARKET" && ltp !== null) setPrice(String(ltp));
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                    orderType === ot
                      ? "bg-purple/15 text-purple border border-purple/30"
                      : "bg-white/[0.04] text-foreground/35 border border-white/[0.06] hover:text-foreground/50"
                  }`}
                >
                  {ot}
                </button>
              ))}
            </div>
          </div>
          <input
            type="number"
            value={orderType === "MARKET" ? (ltp !== null ? ltp.toFixed(2) : "") : price}
            onChange={(e) => setPrice(e.target.value)}
            disabled={orderType === "MARKET"}
            className={`w-full border rounded-lg px-3 py-2.5 text-sm font-mono outline-none transition-colors ${
              orderType === "MARKET"
                ? "bg-white/[0.02] border-white/[0.05] text-foreground/40 cursor-not-allowed"
                : "bg-white/[0.04] border-white/[0.08] text-foreground focus:border-cyan/40"
            }`}
            placeholder={ltp !== null ? `₹${ltp.toLocaleString("en-IN")}` : "Price"}
            id="buy-sell-price"
          />
          {orderType === "MARKET" && (
            <p className="text-[9px] text-foreground/25 mt-1 flex items-center gap-1">
              <span className="text-amber/60">⚠</span> Market order — subject to price fluctuation
            </p>
          )}
        </div>

        {/* Stop Loss / Target */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-foreground/40 uppercase tracking-wider block mb-1.5">
              Stop Loss
            </label>
            <input
              type="number"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-foreground font-mono outline-none focus:border-nred/40 transition-colors"
              placeholder="Optional"
              id="buy-sell-sl"
            />
          </div>
          <div>
            <label className="text-[10px] text-foreground/40 uppercase tracking-wider block mb-1.5">
              Target
            </label>
            <input
              type="number"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-foreground font-mono outline-none focus:border-ngreen/40 transition-colors"
              placeholder="Optional"
              id="buy-sell-target"
            />
          </div>
        </div>

        {/* Divider */}
        <div className="section-divider !my-3" />

        {/* Balance + Order Value */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-foreground/30">Balance</span>
            <span className="font-mono text-foreground/50">{INR(balance)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-foreground/30">Order Value</span>
            <span className={`font-mono font-semibold ${orderValue > 0 ? (isBuy ? "text-ngreen" : "text-nred") : "text-foreground/40"}`}>
              {orderValue > 0 ? INR(orderValue) : "—"}
            </span>
          </div>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={!isValid || isPlacing || !marketOpen}
          className={`w-full py-3 rounded-xl text-sm font-semibold tracking-wide transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
            isBuy
              ? "bg-ngreen/20 text-ngreen border border-ngreen/30 hover:bg-ngreen/30 hover:shadow-[0_0_20px_rgba(0,200,83,0.15)]"
              : "bg-nred/20 text-nred border border-nred/30 hover:bg-nred/30 hover:shadow-[0_0_20px_rgba(255,23,68,0.15)]"
          }`}
          id="buy-sell-submit"
        >
          {isPlacing ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Placing...
            </span>
          ) : (
            `${tradeType} ${stockName || symbol.replace(".NS", "")}`
          )}
        </button>
      </div>
    </div>
  );
}

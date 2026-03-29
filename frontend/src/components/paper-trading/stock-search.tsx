"use client";

import { useState, useRef, useEffect } from "react";
import { StockInfo } from "@/lib/api";

interface StockSearchProps {
  stocks: StockInfo[];
  onSelect: (symbol: string) => void;
  selectedSymbol?: string;
}

export function StockSearch({ stocks, onSelect, selectedSymbol }: StockSearchProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filtered = query.length > 0
    ? stocks.filter(
        (s) =>
          s.name.toLowerCase().includes(query.toLowerCase()) ||
          s.symbol.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 12)
    : [];

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectedStock = stocks.find((s) => s.symbol === selectedSymbol);

  return (
    <div className="relative">
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (query.length > 0) setIsOpen(true);
          }}
          placeholder={selectedStock ? `${selectedStock.name} (${selectedStock.symbol.replace('.NS', '')})` : "Search stocks..."}
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-10 pr-4 py-3 text-sm text-foreground outline-none focus:border-cyan/40 focus:bg-white/[0.06] transition-all placeholder:text-foreground/30"
          id="stock-search-input"
        />
        {selectedSymbol && !query && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <span className="text-[10px] font-mono text-cyan/60 bg-cyan/10 px-2 py-0.5 rounded-full">
              {selectedSymbol.replace(".NS", "")}
            </span>
          </div>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && filtered.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 z-50 glass-card rounded-xl overflow-hidden max-h-[320px] overflow-y-auto"
          style={{
            background: "rgba(12,12,22,0.96)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 12px 48px rgba(0,0,0,0.5)",
          }}
        >
          {filtered.map((s) => (
            <button
              key={s.symbol}
              onClick={() => {
                onSelect(s.symbol);
                setQuery("");
                setIsOpen(false);
              }}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.05] transition-colors text-left group"
            >
              <div className="flex flex-col">
                <span className="text-sm text-foreground font-medium group-hover:text-cyan transition-colors">
                  {s.name}
                </span>
                <span className="text-[10px] text-foreground/30 font-mono">
                  {s.symbol.replace(".NS", "")}
                </span>
              </div>
              <div className="text-right">
                {s.ltp !== undefined && (
                  <div className="font-mono text-xs text-foreground/60">
                    ₹{s.ltp.toLocaleString("en-IN")}
                  </div>
                )}
                {s.change_pct !== undefined && (
                  <div
                    className={`font-mono text-[10px] ${
                      s.change_pct >= 0 ? "text-ngreen" : "text-nred"
                    }`}
                  >
                    {s.change_pct >= 0 ? "+" : ""}
                    {s.change_pct}%
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {isOpen && query.length > 0 && filtered.length === 0 && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 z-50 glass-card rounded-xl p-4 text-center text-foreground/30 text-sm"
          style={{
            background: "rgba(12,12,22,0.96)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          No stocks found for &ldquo;{query}&rdquo;
        </div>
      )}
    </div>
  );
}

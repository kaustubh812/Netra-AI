"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface CommandItem {
  id: string;
  label: string;
  sublabel?: string;
  type: "stock" | "page" | "action";
  href?: string;
  action?: () => void;
}

const PAGES: CommandItem[] = [
  { id: "page-dashboard", label: "Dashboard", sublabel: "Home overview", type: "page", href: "/" },
  { id: "page-portfolio", label: "Portfolio", sublabel: "Holdings tracker & P&L", type: "page", href: "/portfolio" },
  { id: "page-paper-trading", label: "Paper Trading", sublabel: "Virtual trading simulator", type: "page", href: "/paper-trading" },
  { id: "page-options", label: "Options", sublabel: "Option chain viewer & Greeks", type: "page", href: "/options" },
  { id: "page-heatmap", label: "Heatmap", sublabel: "NIFTY 50 treemap", type: "page", href: "/heatmap" },
  { id: "page-screener", label: "Screener", sublabel: "Multi-criteria stock filter", type: "page", href: "/screener" },
  { id: "page-calendar", label: "Calendar", sublabel: "Economic & earnings events", type: "page", href: "/calendar" },
  { id: "page-watchlists", label: "Watchlists", sublabel: "Custom stock groups", type: "page", href: "/watchlists" },
  { id: "page-analytics", label: "Analytics", sublabel: "Correlation, comparison, volatility", type: "page", href: "/analytics" },
  { id: "page-workspace", label: "Workspace", sublabel: "Multi-panel Bloomberg-style workspace", type: "page", href: "/workspace" },
  { id: "page-alerts", label: "Alerts", sublabel: "Signal alerts & notifications", type: "page", href: "/alerts" },
  { id: "page-settings", label: "Settings", sublabel: "System controls", type: "page", href: "/settings" },
];

function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return true;
  // Simple fuzzy: all chars in order
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

function getRecentSearches(): string[] {
  try {
    const saved = localStorage.getItem("netra-recent-searches");
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function addRecentSearch(id: string) {
  const recent = getRecentSearches().filter((r) => r !== id);
  recent.unshift(id);
  localStorage.setItem("netra-recent-searches", JSON.stringify(recent.slice(0, 8)));
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { data: stocksData } = useQuery({
    queryKey: ["stocks"],
    queryFn: api.getStocks,
    staleTime: 60 * 1000,
  });

  const stockItems: CommandItem[] = (stocksData?.stocks ?? []).map((s) => ({
    id: `stock-${s.symbol}`,
    label: s.name,
    sublabel: `${s.signal ?? "—"} · ${s.ltp?.toLocaleString("en-IN", { maximumFractionDigits: 2 }) ?? "—"} · ${s.change_pct !== undefined ? (s.change_pct >= 0 ? "+" : "") + s.change_pct.toFixed(2) + "%" : ""}`,
    type: "stock" as const,
    href: `/stock/${encodeURIComponent(s.symbol)}`,
  }));

  const allItems = [...PAGES, ...stockItems];

  const filtered = query.trim()
    ? allItems.filter((item) => fuzzyMatch(query, item.label) || (item.sublabel && fuzzyMatch(query, item.sublabel)))
    : allItems.slice(0, 12);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const execute = useCallback(
    (item: CommandItem) => {
      addRecentSearch(item.id);
      onClose();
      if (item.href) {
        router.push(item.href);
      } else if (item.action) {
        item.action();
      }
    },
    [router, onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && filtered[selectedIndex]) {
        e.preventDefault();
        execute(filtered[selectedIndex]);
      } else if (e.key === "Escape") {
        onClose();
      }
    },
    [filtered, selectedIndex, execute, onClose]
  );

  if (!open) return null;

  const TYPE_ICONS = {
    stock: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-cyan/50">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </svg>
    ),
    page: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-purple/50">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="9" y1="3" x2="9" y2="21" />
      </svg>
    ),
    action: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-amber/50">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-md" onClick={onClose} />

      {/* Palette */}
      <div className="fixed top-[15%] left-1/2 -translate-x-1/2 z-50 w-full max-w-xl">
        <div
          className="rounded-xl overflow-hidden shadow-2xl"
          style={{
            background: "rgba(8, 8, 16, 0.96)",
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow: "0 25px 60px rgba(0,0,0,0.55), 0 0 60px rgba(34,211,238,0.06), 0 0 120px rgba(167,139,250,0.03)",
          }}
        >
          {/* Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.05]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-cyan/60 shrink-0">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search stocks, pages..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder-foreground/25 outline-none"
              autoComplete="off"
              spellCheck={false}
            />
            <kbd className="text-[10px] text-foreground/20 bg-white/[0.05] px-1.5 py-0.5 rounded font-mono">ESC</kbd>
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-foreground/25">
                No results for &ldquo;{query}&rdquo;
              </div>
            ) : (
              filtered.map((item, i) => (
                <button
                  key={item.id}
                  onClick={() => execute(item)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all duration-150 ${
                    i === selectedIndex ? "bg-cyan/10 text-foreground" : "text-foreground/60 hover:bg-white/[0.03]"
                  }`}
                >
                  {TYPE_ICONS[item.type]}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{item.label}</div>
                    {item.sublabel && (
                      <div className="text-[11px] text-foreground/30 truncate">{item.sublabel}</div>
                    )}
                  </div>
                  {i === selectedIndex && (
                    <kbd className="text-[10px] text-foreground/20 bg-white/[0.05] px-1.5 py-0.5 rounded font-mono shrink-0">
                      &crarr;
                    </kbd>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-4 px-4 py-2 border-t border-white/[0.05] text-[10px] text-foreground/15">
            <span><kbd className="font-mono bg-white/[0.05] px-1 py-0.5 rounded">&uarr;&darr;</kbd> navigate</span>
            <span><kbd className="font-mono bg-white/[0.05] px-1 py-0.5 rounded">&crarr;</kbd> select</span>
            <span><kbd className="font-mono bg-white/[0.05] px-1 py-0.5 rounded">esc</kbd> close</span>
          </div>
        </div>
      </div>
    </>
  );
}

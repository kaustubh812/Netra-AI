"use client";

import { useEffect, useRef } from "react";

const SHORTCUTS = [
  { keys: ["Ctrl", "K"], label: "Open command palette" },
  { keys: ["/"], label: "Open command palette" },
  { keys: ["?"], label: "Show keyboard shortcuts" },
  { keys: ["H"], label: "Go to Dashboard" },
  { keys: ["S"], label: "Go to Screener" },
  { keys: ["T"], label: "Go to Settings" },
  { keys: ["D"], label: "Switch to Daily signals" },
  { keys: ["I"], label: "Switch to Intraday signals" },
  { keys: ["Esc"], label: "Close any overlay" },
];

export function ShortcutHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={ref}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm rounded-xl overflow-hidden"
        style={{
          background: "rgba(12, 12, 22, 0.95)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
        }}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
          <h2 className="text-sm font-semibold text-foreground/70">Keyboard Shortcuts</h2>
          <button onClick={onClose} className="text-foreground/25 hover:text-foreground/50 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-3 space-y-2">
          {SHORTCUTS.map((s, i) => (
            <div key={i} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-foreground/50">{s.label}</span>
              <div className="flex items-center gap-1">
                {s.keys.map((k, j) => (
                  <span key={j}>
                    <kbd className="text-[11px] font-mono bg-white/[0.06] text-foreground/40 px-2 py-0.5 rounded border border-white/[0.06]">
                      {k}
                    </kbd>
                    {j < s.keys.length - 1 && <span className="text-foreground/15 mx-0.5">+</span>}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

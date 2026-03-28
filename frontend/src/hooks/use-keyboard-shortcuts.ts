"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface ShortcutHandlers {
  onCommandPalette: () => void;
  onShortcutHelp: () => void;
}

export function useKeyboardShortcuts({ onCommandPalette, onShortcutHelp }: ShortcutHandlers) {
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        // But still allow Ctrl+K and Escape in inputs
        if (e.key === "k" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          onCommandPalette();
        }
        return;
      }

      // Ctrl+K or "/" — Command Palette
      if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || e.key === "/") {
        e.preventDefault();
        onCommandPalette();
        return;
      }

      // "?" — Shortcut help
      if (e.key === "?" && e.shiftKey) {
        e.preventDefault();
        onShortcutHelp();
        return;
      }

      // Single-key shortcuts (no modifiers)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key.toLowerCase()) {
        case "h":
          router.push("/");
          break;
        case "s":
          router.push("/screener");
          break;
        case "t":
          router.push("/settings");
          break;
        case "d":
          // Toggle daily mode - dispatch custom event
          window.dispatchEvent(new CustomEvent("netra-mode", { detail: "daily" }));
          break;
        case "i":
          // Toggle intraday mode
          window.dispatchEvent(new CustomEvent("netra-mode", { detail: "intraday" }));
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router, onCommandPalette, onShortcutHelp]);
}

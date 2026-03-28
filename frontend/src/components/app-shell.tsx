"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "./sidebar";
import { CommandPalette } from "./command-palette";
import { ShortcutHelp } from "./shortcut-help";
import { NewsTicker } from "./news-ticker";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("netra-sidebar-collapsed");
    if (saved === "true") setSidebarCollapsed(true);

    // Poll localStorage for sidebar state (simple cross-component sync)
    const interval = setInterval(() => {
      const val = localStorage.getItem("netra-sidebar-collapsed");
      setSidebarCollapsed(val === "true");
    }, 300);

    return () => clearInterval(interval);
  }, []);

  useKeyboardShortcuts({
    onCommandPalette: () => setCommandPaletteOpen(true),
    onShortcutHelp: () => setShortcutHelpOpen(true),
  });

  return (
    <>
      <Sidebar />
      <main
        className="min-h-screen transition-all duration-300 ease-in-out pb-10"
        style={{ marginLeft: sidebarCollapsed ? 64 : 224 }}
      >
        {children}
      </main>
      <NewsTicker />
      <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
      <ShortcutHelp open={shortcutHelpOpen} onClose={() => setShortcutHelpOpen(false)} />
    </>
  );
}

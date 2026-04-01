"use client";

import { Sidebar } from "./sidebar";
import { CommandPalette } from "./command-palette";
import { ShortcutHelp } from "./shortcut-help";
import { NewsTicker } from "./news-ticker";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useState } from "react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);

  useKeyboardShortcuts({
    onCommandPalette: () => setCommandPaletteOpen(true),
    onShortcutHelp: () => setShortcutHelpOpen(true),
  });

  return (
    <>
      <Sidebar />
      <main
        className="min-h-screen pb-10"
        style={{ marginLeft: 76 }}
      >
        {children}
      </main>
      <NewsTicker />
      <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
      <ShortcutHelp open={shortcutHelpOpen} onClose={() => setShortcutHelpOpen(false)} />
    </>
  );
}

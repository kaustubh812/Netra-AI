"use client";

import { useState, useEffect, useCallback } from "react";
import {
  WorkspaceContext,
  PRESET_LAYOUTS,
  PANEL_CATALOG,
  generatePanelId,
  type WorkspaceLayout,
  type PanelConfig,
} from "@/hooks/use-workspace";
import { PanelContent, SecuritySelector } from "@/components/workspace-panels";

const PILL_ACTIVE = "bg-cyan/20 text-cyan border-cyan/40";
const PILL_INACTIVE = "bg-white/[0.03] text-foreground/40 border-white/[0.08] hover:bg-white/[0.06]";

function loadSavedLayouts(): WorkspaceLayout[] {
  try {
    const saved = localStorage.getItem("netra-workspace-custom");
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveCustomLayouts(layouts: WorkspaceLayout[]) {
  localStorage.setItem("netra-workspace-custom", JSON.stringify(layouts));
}

function loadActiveLayout(): string {
  try {
    return localStorage.getItem("netra-workspace-active") ?? "overview";
  } catch {
    return "overview";
  }
}

export default function WorkspacePage() {
  const [linkedSymbol, setLinkedSymbol] = useState("RELIANCE.NS");
  const [customLayouts, setCustomLayouts] = useState<WorkspaceLayout[]>([]);
  const [activeLayoutId, setActiveLayoutId] = useState("overview");
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Load saved state
  useEffect(() => {
    setCustomLayouts(loadSavedLayouts());
    setActiveLayoutId(loadActiveLayout());
  }, []);

  const allLayouts = [...PRESET_LAYOUTS, ...customLayouts];
  const activeLayout = allLayouts.find((l) => l.id === activeLayoutId) ?? PRESET_LAYOUTS[0];

  const switchLayout = (id: string) => {
    setActiveLayoutId(id);
    localStorage.setItem("netra-workspace-active", id);
  };

  const createCustomLayout = () => {
    const name = `Custom ${customLayouts.length + 1}`;
    const newLayout: WorkspaceLayout = {
      id: `custom-${Date.now()}`,
      name,
      columns: 2,
      panels: [
        { id: generatePanelId(), type: "chart", title: "Price Chart" },
        { id: generatePanelId(), type: "signals", title: "Signal Table" },
      ],
    };
    const updated = [...customLayouts, newLayout];
    setCustomLayouts(updated);
    saveCustomLayouts(updated);
    switchLayout(newLayout.id);
    setEditMode(true);
  };

  const deleteCustomLayout = (id: string) => {
    const updated = customLayouts.filter((l) => l.id !== id);
    setCustomLayouts(updated);
    saveCustomLayouts(updated);
    if (activeLayoutId === id) {
      switchLayout("overview");
    }
  };

  const updateLayout = useCallback(
    (fn: (layout: WorkspaceLayout) => WorkspaceLayout) => {
      // Only allow editing custom layouts
      if (!activeLayout.id.startsWith("custom-")) return;
      setCustomLayouts((prev) => {
        const updated = prev.map((l) => (l.id === activeLayout.id ? fn(l) : l));
        saveCustomLayouts(updated);
        return updated;
      });
    },
    [activeLayout.id]
  );

  const addPanel = (type: PanelConfig["type"]) => {
    const catalog = PANEL_CATALOG.find((p) => p.type === type);
    updateLayout((l) => ({
      ...l,
      panels: [...l.panels, { id: generatePanelId(), type, title: catalog?.label ?? type }],
    }));
    setAddPanelOpen(false);
  };

  const removePanel = (panelId: string) => {
    updateLayout((l) => ({
      ...l,
      panels: l.panels.filter((p) => p.id !== panelId),
    }));
  };

  const setColumns = (cols: number) => {
    updateLayout((l) => ({ ...l, columns: cols }));
  };

  const isCustom = activeLayout.id.startsWith("custom-");

  return (
    <WorkspaceContext.Provider value={{ linkedSymbol, setLinkedSymbol }}>
      <div className="px-4 py-4 relative z-10 animate-fade-in">
        {/* Top Bar */}
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          {/* Layout tabs */}
          <div className="flex gap-1.5">
            {allLayouts.map((l) => (
              <button
                key={l.id}
                onClick={() => switchLayout(l.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  activeLayoutId === l.id ? PILL_ACTIVE : PILL_INACTIVE
                }`}
              >
                {l.name}
              </button>
            ))}
            <button
              onClick={createCustomLayout}
              className="px-2.5 py-1.5 rounded-full text-xs font-medium border border-dashed border-white/[0.1] text-foreground/25 hover:text-foreground/50 hover:border-white/[0.2] transition-all"
            >
              +
            </button>
          </div>

          {/* Security selector */}
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-cyan/40">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              <span className="text-[10px] text-foreground/20 uppercase tracking-wider">Linked</span>
            </div>
            <SecuritySelector />
          </div>
        </div>

        {/* Edit controls for custom layouts */}
        {isCustom && (
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => setEditMode(!editMode)}
              className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                editMode ? "border-cyan/40 text-cyan bg-cyan/10" : "border-white/[0.08] text-foreground/30 hover:text-foreground/50"
              }`}
            >
              {editMode ? "Done Editing" : "Edit Layout"}
            </button>

            {editMode && (
              <>
                <div className="flex items-center gap-1.5 text-[10px] text-foreground/25">
                  Columns:
                  {[1, 2, 3, 4].map((c) => (
                    <button
                      key={c}
                      onClick={() => setColumns(c)}
                      className={`w-6 h-6 rounded text-xs font-mono ${
                        activeLayout.columns === c
                          ? "bg-cyan/20 text-cyan border border-cyan/40"
                          : "bg-white/[0.03] text-foreground/30 border border-white/[0.08] hover:bg-white/[0.06]"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setAddPanelOpen(!addPanelOpen)}
                  className="px-3 py-1 rounded-lg text-xs font-medium border border-white/[0.08] text-foreground/30 hover:text-foreground/50 hover:bg-white/[0.04] transition-all"
                >
                  + Add Panel
                </button>

                <button
                  onClick={() => deleteCustomLayout(activeLayout.id)}
                  className="px-3 py-1 rounded-lg text-xs font-medium border border-nred/20 text-nred/50 hover:text-nred hover:bg-nred/10 transition-all ml-auto"
                >
                  Delete Layout
                </button>
              </>
            )}
          </div>
        )}

        {/* Add Panel Popover */}
        {addPanelOpen && (
          <div className="glass-card rounded-xl p-3 mb-3 grid grid-cols-2 md:grid-cols-5 gap-2">
            {PANEL_CATALOG.map((p) => (
              <button
                key={p.type}
                onClick={() => addPanel(p.type)}
                className="text-left p-2.5 rounded-lg border border-white/[0.06] hover:border-cyan/30 hover:bg-cyan/5 transition-all"
              >
                <div className="text-xs font-medium text-foreground/60">{p.label}</div>
                <div className="text-[10px] text-foreground/20 mt-0.5">{p.description}</div>
              </button>
            ))}
          </div>
        )}

        {/* Panel Grid */}
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: `repeat(${activeLayout.columns}, 1fr)`,
          }}
        >
          {activeLayout.panels.map((panel) => (
            <div
              key={panel.id}
              className="glass-card rounded-xl overflow-hidden"
              style={{ minHeight: panel.type === "chart" ? 340 : 200 }}
            >
              {/* Panel header */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
                <span className="text-[10px] text-foreground/30 uppercase tracking-wider font-medium">{panel.title}</span>
                {editMode && isCustom && (
                  <button
                    onClick={() => removePanel(panel.id)}
                    className="text-foreground/15 hover:text-nred text-xs transition-colors"
                    title="Remove panel"
                  >
                    &times;
                  </button>
                )}
              </div>
              {/* Panel content */}
              <div className="p-3">
                <PanelContent type={panel.type} />
              </div>
            </div>
          ))}
        </div>

        {activeLayout.panels.length === 0 && (
          <div className="glass-card rounded-xl p-12 text-center">
            <div className="text-foreground/20 text-sm mb-3">No panels in this workspace</div>
            {isCustom && (
              <button
                onClick={() => {
                  setEditMode(true);
                  setAddPanelOpen(true);
                }}
                className="px-4 py-2 rounded-lg text-xs font-medium border border-cyan/30 text-cyan hover:bg-cyan/10 transition-all"
              >
                Add your first panel
              </button>
            )}
          </div>
        )}
      </div>
    </WorkspaceContext.Provider>
  );
}

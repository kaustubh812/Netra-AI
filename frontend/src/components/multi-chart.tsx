"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

const CHART_COLORS = [
  "#00e5ff", // cyan
  "#a78bfa", // purple
  "#00c853", // green
  "#ff1744", // red
  "#ffab00", // amber
];

interface StockLine {
  symbol: string;
  name: string;
  color: string;
  visible: boolean;
}

export function MultiChart() {
  const [selectedStocks, setSelectedStocks] = useState<StockLine[]>([
    { symbol: "RELIANCE.NS", name: "RELIANCE", color: CHART_COLORS[0], visible: true },
    { symbol: "TCS.NS", name: "TCS", color: CHART_COLORS[1], visible: true },
  ]);
  const [addSymbol, setAddSymbol] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Fetch all stocks for the autocomplete
  const { data: stocksData } = useQuery({
    queryKey: ["stocks"],
    queryFn: api.getStocks,
    staleTime: 60 * 1000,
  });

  // Fetch chart data for each selected stock
  const chartQueries = selectedStocks.map((s) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useQuery({
      queryKey: ["chart", s.symbol, "3M"],
      queryFn: () => api.getChart(s.symbol, "3M"),
      staleTime: 10 * 60 * 1000,
    })
  );

  const allLoaded = chartQueries.every((q) => !q.isLoading);

  // Draw comparison chart on canvas
  useEffect(() => {
    if (!canvasRef.current || !allLoaded) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;

    // Clear
    ctx.clearRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      const y = (H / 5) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Zero line
    const zeroY = H / 2;
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, zeroY);
    ctx.lineTo(W, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Y-axis labels
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.font = "10px monospace";
    ctx.textAlign = "right";

    // Draw each stock line
    let maxRange = 0;
    const normalizedData: { color: string; points: number[]; name: string }[] = [];

    for (let si = 0; si < selectedStocks.length; si++) {
      const s = selectedStocks[si];
      if (!s.visible) continue;

      const chartData = chartQueries[si]?.data;
      if (!chartData?.candles?.length) continue;

      const closes = chartData.candles.map((c: { close: number }) => c.close);
      const base = closes[0];
      if (base <= 0) continue;

      const pctChanges = closes.map((c: number) => ((c - base) / base) * 100);
      const range = Math.max(Math.abs(Math.min(...pctChanges)), Math.abs(Math.max(...pctChanges)));
      if (range > maxRange) maxRange = range;

      normalizedData.push({ color: s.color, points: pctChanges, name: s.name });
    }

    if (maxRange === 0) maxRange = 10;
    maxRange = Math.ceil(maxRange / 5) * 5 + 5; // Round up with padding

    // Y-axis labels
    for (let i = -2; i <= 2; i++) {
      const val = (maxRange / 2) * i;
      const y = zeroY - (val / maxRange) * H;
      ctx.fillText(`${val > 0 ? "+" : ""}${val.toFixed(0)}%`, W - 4, y + 3);
    }

    // Draw lines
    for (const nd of normalizedData) {
      const stepX = W / (nd.points.length - 1 || 1);

      ctx.strokeStyle = nd.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      for (let i = 0; i < nd.points.length; i++) {
        const x = i * stepX;
        const y = zeroY - (nd.points[i] / maxRange) * H;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Label at end
      const lastY = zeroY - (nd.points[nd.points.length - 1] / maxRange) * H;
      const lastVal = nd.points[nd.points.length - 1];
      ctx.fillStyle = nd.color;
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`${nd.name} ${lastVal >= 0 ? "+" : ""}${lastVal.toFixed(1)}%`, 8, lastY - 6);
    }
  }, [allLoaded, selectedStocks, chartQueries]);

  const addStock = () => {
    if (!addSymbol.trim() || selectedStocks.length >= 5) return;
    const sym = addSymbol.toUpperCase();
    const fullSym = sym.endsWith(".NS") ? sym : sym + ".NS";
    if (selectedStocks.some((s) => s.symbol === fullSym)) return;

    setSelectedStocks((prev) => [
      ...prev,
      { symbol: fullSym, name: sym.replace(".NS", ""), color: CHART_COLORS[prev.length % CHART_COLORS.length], visible: true },
    ]);
    setAddSymbol("");
  };

  const removeStock = (symbol: string) => {
    setSelectedStocks((prev) => prev.filter((s) => s.symbol !== symbol));
  };

  const toggleStock = (symbol: string) => {
    setSelectedStocks((prev) => prev.map((s) => s.symbol === symbol ? { ...s, visible: !s.visible } : s));
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Stock selector */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center gap-4 flex-wrap">
          {selectedStocks.map((s) => (
            <div key={s.symbol} className="flex items-center gap-2">
              <button
                onClick={() => toggleStock(s.symbol)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all"
                style={{
                  borderColor: s.visible ? s.color : "rgba(255,255,255,0.08)",
                  color: s.visible ? s.color : "rgba(255,255,255,0.25)",
                  backgroundColor: s.visible ? `${s.color}15` : "transparent",
                }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.visible ? s.color : "rgba(255,255,255,0.1)" }} />
                {s.name}
              </button>
              <button onClick={() => removeStock(s.symbol)} className="text-foreground/20 hover:text-nred text-xs">&times;</button>
            </div>
          ))}

          {selectedStocks.length < 5 && (
            <div className="flex gap-1.5">
              <input
                value={addSymbol}
                onChange={(e) => setAddSymbol(e.target.value.toUpperCase())}
                placeholder="Add stock..."
                className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1 text-xs font-mono text-foreground placeholder-foreground/20 outline-none focus:border-cyan/30 w-28"
                onKeyDown={(e) => e.key === "Enter" && addStock()}
              />
              <button onClick={addStock} className="text-xs text-cyan hover:text-cyan/80">+</button>
            </div>
          )}

          <span className="text-[10px] text-foreground/20 ml-auto">3M normalized to % change</span>
        </div>
      </div>

      {/* Chart canvas */}
      <div className="glass-card rounded-xl p-4">
        <canvas
          ref={canvasRef}
          className="w-full"
          style={{ height: 400 }}
        />
        {!allLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="shimmer h-full w-full rounded-lg" />
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  createSeriesMarkers,
  type IChartApi,
  type CandlestickData,
  type HistogramData,
  type Time,
  type SeriesMarker,
} from "lightweight-charts";
import { api, ChartData } from "@/lib/api";

interface ChartProps {
  symbol: string;
}

const PERIODS = ["1M", "3M", "6M", "1Y", "5Y"] as const;

export function StockChart({ symbol }: ChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<IChartApi | null>(null);
  const [period, setPeriod] = useState<string>("1Y");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!chartRef.current) return;

    // Clean up previous chart
    if (chartInstance.current) {
      chartInstance.current.remove();
      chartInstance.current = null;
    }

    const chart = createChart(chartRef.current, {
      layout: {
        background: { color: "#12121a" },
        textColor: "#e0e0e0",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#1a1a2530" },
        horzLines: { color: "#1a1a2530" },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: "#00e5ff40", width: 1, style: 2 },
        horzLine: { color: "#00e5ff40", width: 1, style: 2 },
      },
      timeScale: {
        borderColor: "#2a2a3a",
        timeVisible: false,
      },
      rightPriceScale: {
        borderColor: "#2a2a3a",
      },
      width: chartRef.current.clientWidth,
      height: 500,
    });

    chartInstance.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#00c853",
      downColor: "#ff1744",
      borderUpColor: "#00c853",
      borderDownColor: "#ff1744",
      wickUpColor: "#00c85380",
      wickDownColor: "#ff174480",
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    // Fetch data
    setLoading(true);
    api.getChart(symbol, period)
      .then((data: ChartData) => {
        const candles: CandlestickData<Time>[] = data.candles.map((c) => ({
          time: c.time as Time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));

        const volumes: HistogramData<Time>[] = data.candles.map((c) => ({
          time: c.time as Time,
          value: c.volume,
          color: c.close >= c.open ? "#00c85330" : "#ff174430",
        }));

        candleSeries.setData(candles);
        volumeSeries.setData(volumes);

        // Add signal markers
        if (data.markers.length) {
          const markers: SeriesMarker<Time>[] = data.markers.map((m) => ({
            time: m.time as Time,
            position: m.position as "belowBar" | "aboveBar",
            color: m.color,
            shape: m.shape as "arrowUp" | "arrowDown",
            text: m.text,
          }));
          createSeriesMarkers(candleSeries, markers);
        }

        chart.timeScale().fitContent();
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Resize handler
    const handleResize = () => {
      if (chartRef.current && chartInstance.current) {
        chartInstance.current.applyOptions({ width: chartRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartInstance.current = null;
    };
  }, [symbol, period]);

  return (
    <div>
      <div className="flex gap-1 mb-3">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
              period === p
                ? "bg-cyan/20 text-cyan border border-cyan/30"
                : "bg-surface-2 text-foreground/50 border border-border hover:text-foreground"
            }`}
          >
            {p}
          </button>
        ))}
      </div>
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface/80 z-10 rounded-lg">
            <span className="text-foreground/40">Loading chart...</span>
          </div>
        )}
        <div ref={chartRef} className="rounded-lg overflow-hidden border border-border" />
      </div>
    </div>
  );
}

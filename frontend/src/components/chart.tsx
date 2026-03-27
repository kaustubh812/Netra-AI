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
  entryPrice?: number;
  stopLoss?: number;
  targetPrice?: number;
  signal?: string;
}

const PERIODS = ["1D", "1W", "1M", "3M", "6M", "1Y", "5Y"] as const;

const PERIOD_ACTIVE = "bg-cyan/15 text-cyan border border-cyan/30 shadow-[0_0_8px_rgba(0,229,255,0.15)]";
const PERIOD_INACTIVE = "bg-white/[0.03] text-foreground/40 border border-white/[0.06] hover:text-foreground hover:bg-white/[0.06]";

export function StockChart({ symbol, entryPrice, stopLoss, targetPrice, signal }: ChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<IChartApi | null>(null);
  const [period, setPeriod] = useState<string>("6M");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!chartRef.current) return;

    if (chartInstance.current) {
      chartInstance.current.remove();
      chartInstance.current = null;
    }

    const chart = createChart(chartRef.current, {
      layout: {
        background: { color: "#0f0f18" },
        textColor: "#e0e0e0",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.02)" },
        horzLines: { color: "rgba(255,255,255,0.02)" },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: "#00e5ff40", width: 1, style: 2 },
        horzLine: { color: "#00e5ff40", width: 1, style: 2 },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.06)",
        timeVisible: period === "1D" || period === "1W",
        secondsVisible: false,
        rightOffset: 5,
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.06)",
      },
      width: chartRef.current.clientWidth,
      height: 480,
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

    setLoading(true);
    api.getChart(symbol, period)
      .then((data: ChartData) => {
        const candles: CandlestickData<Time>[] = data.candles.map((c) => ({
          time: (typeof c.time === "number" ? c.time : c.time) as Time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));

        const volumes: HistogramData<Time>[] = data.candles.map((c) => ({
          time: (typeof c.time === "number" ? c.time : c.time) as Time,
          value: c.volume,
          color: c.close >= c.open ? "#00c85320" : "#ff174420",
        }));

        candleSeries.setData(candles);
        volumeSeries.setData(volumes);

        // Add entry/stop-loss/target price lines
        if (entryPrice) {
          candleSeries.createPriceLine({
            price: entryPrice,
            color: "#00e5ff",
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: "Entry",
          });
        }
        if (stopLoss) {
          candleSeries.createPriceLine({
            price: stopLoss,
            color: "#ff1744",
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: "Stop Loss",
          });
        }
        if (targetPrice) {
          candleSeries.createPriceLine({
            price: targetPrice,
            color: "#00c853",
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: "Target",
          });
        }

        if (data.markers.length) {
          const markers: SeriesMarker<Time>[] = data.markers.map((m) => ({
            time: (typeof m.time === "number" ? m.time : m.time) as Time,
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
  }, [symbol, period, entryPrice, stopLoss, targetPrice, signal]);

  return (
    <div className="glass-card rounded-xl p-4 animate-fade-in">
      <div className="flex gap-1.5 mb-3">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-mono transition-all ${
              period === p ? PERIOD_ACTIVE : PERIOD_INACTIVE
            }`}
          >
            {p}
          </button>
        ))}
      </div>
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface/80 backdrop-blur-sm z-10 rounded-lg">
            <div className="shimmer h-3 w-32 rounded" />
          </div>
        )}
        <div ref={chartRef} className="rounded-lg overflow-hidden" />
      </div>
    </div>
  );
}

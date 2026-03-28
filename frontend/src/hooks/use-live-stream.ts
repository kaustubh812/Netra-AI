"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface LiveHeadline {
  headline: string;
  source: string;
  symbol: string;
  sentiment: number;
  time: string;
}

interface StreamData {
  prices: Record<string, { price: number; change: number; change_pct: number }>;
  marketOpen: boolean;
  breadth: { buy: number; sell: number; hold: number } | null;
  headlines: LiveHeadline[];
  connected: boolean;
}

export function useLiveStream(): StreamData {
  const [data, setData] = useState<StreamData>({
    prices: {},
    marketOpen: false,
    breadth: null,
    headlines: [],
    connected: false,
  });

  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const connect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
    }

    const es = new EventSource(`${API_BASE}/api/stream`);
    esRef.current = es;

    es.onopen = () => {
      setData((d) => ({ ...d, connected: true }));
    };

    es.addEventListener("prices", (e) => {
      try {
        const payload = JSON.parse(e.data);
        setData((d) => ({
          ...d,
          prices: payload.prices ?? {},
          marketOpen: payload.market_open ?? false,
        }));
      } catch { /* ignore */ }
    });

    es.addEventListener("breadth", (e) => {
      try {
        const payload = JSON.parse(e.data);
        setData((d) => ({ ...d, breadth: payload }));
      } catch { /* ignore */ }
    });

    es.addEventListener("news", (e) => {
      try {
        const payload = JSON.parse(e.data);
        setData((d) => ({ ...d, headlines: payload.headlines ?? [] }));
      } catch { /* ignore */ }
    });

    es.onerror = () => {
      setData((d) => ({ ...d, connected: false }));
      es.close();
      // Retry after 10 seconds
      retryRef.current = setTimeout(connect, 10000);
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [connect]);

  return data;
}

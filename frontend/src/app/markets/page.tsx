"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, GlobalMarketsData } from "@/lib/api";
import { WorldMap } from "@/components/world-map";
import { CountryCard } from "@/components/country-card";

// Display order: India first, then US, then sorted by abs(change%)
function sortCountryCodes(data: GlobalMarketsData): string[] {
  const codes = Object.keys(data.countries);
  const priority: Record<string, number> = { IN: 0, US: 1 };

  return codes.sort((a, b) => {
    const pa = priority[a] ?? 99;
    const pb = priority[b] ?? 99;
    if (pa !== pb) return pa - pb;
    const absA = Math.abs(data.countries[a].overall_change_pct);
    const absB = Math.abs(data.countries[b].overall_change_pct);
    return absB - absA;
  });
}

export default function MarketsPage() {
  const [selectedCountry, setSelectedCountry] = useState<string | null>("IN");

  const { data, isLoading, error } = useQuery<GlobalMarketsData>({
    queryKey: ["global-markets"],
    queryFn: api.getGlobalMarkets,
    refetchInterval: 5 * 60 * 1000,
  });

  const sortedCodes = data ? sortCountryCodes(data) : [];

  // Build ticker items for bottom bar
  const tickerItems = data
    ? sortedCodes.flatMap((code) =>
        data.countries[code].indices.map((idx) => ({
          name: idx.name,
          price: idx.price,
          change_pct: idx.change_pct,
        }))
      )
    : [];

  return (
    <div className="min-h-screen p-6 animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="section-header text-xl font-bold text-foreground/90">Global Markets</h1>
        <p className="text-foreground/30 text-sm mt-1 ml-5">
          World indices overview &mdash; {data?.count ?? 0} countries tracked
        </p>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-7 glass-card rounded-2xl p-6 h-[420px] shimmer" />
          <div className="col-span-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="glass-card rounded-xl p-4 h-[72px] shimmer" />
            ))}
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="glass-card rounded-2xl p-8 text-center">
          <p className="text-red-400 text-sm">Failed to load global markets data</p>
          <p className="text-foreground/30 text-xs mt-1">{String(error)}</p>
        </div>
      )}

      {/* Main content */}
      {data && (
        <>
          <div className="grid grid-cols-12 gap-5 animate-fade-in animate-fade-in-d1">
            {/* World Map */}
            <div className="col-span-12 lg:col-span-7">
              <div className="glass-card rounded-2xl p-5 gradient-border-cyan">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-foreground/60">World Overview</h2>
                  <span className="text-[10px] text-foreground/25 font-mono">
                    Updated {new Date(data.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div style={{ height: 360 }}>
                  <WorldMap
                    countries={data.countries}
                    selectedCountry={selectedCountry}
                    onSelectCountry={setSelectedCountry}
                  />
                </div>
              </div>
            </div>

            {/* Country Cards */}
            <div className="col-span-12 lg:col-span-5">
              <div
                className="space-y-3 overflow-y-auto pr-1"
                style={{ maxHeight: 440 }}
              >
                {sortedCodes.map((code) => {
                  const c = data.countries[code];
                  return (
                    <div key={code} className="animate-fade-in">
                      <CountryCard
                        code={code}
                        country={c.country}
                        indices={c.indices}
                        overallChange={c.overall_change_pct}
                        selected={selectedCountry === code}
                        onClick={() => setSelectedCountry(code)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom Ticker */}
          {tickerItems.length > 0 && (
            <div className="mt-6 glass-card rounded-xl overflow-hidden animate-fade-in animate-fade-in-d3">
              <div
                className="flex items-center py-2.5 px-4"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
              >
                <span className="text-[10px] font-semibold text-foreground/30 uppercase tracking-wider mr-4 shrink-0">
                  Live Indices
                </span>
                <div className="overflow-hidden flex-1">
                  <div className="markets-ticker-scroll flex items-center gap-6 whitespace-nowrap">
                    {/* Duplicate for seamless scroll */}
                    {[...tickerItems, ...tickerItems].map((item, i) => (
                      <span key={i} className="inline-flex items-center gap-2 text-xs">
                        <span className="text-foreground/50 font-medium">{item.name}</span>
                        <span className="text-foreground/70 font-mono">
                          {item.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                        <span
                          className="font-mono font-semibold"
                          style={{
                            color: item.change_pct >= 0 ? "var(--green)" : "var(--red)",
                          }}
                        >
                          {item.change_pct >= 0 ? "+" : ""}
                          {item.change_pct.toFixed(2)}%
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

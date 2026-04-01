"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, DailyBrief } from "@/lib/api";

export function DailyBriefCard() {
  const [expanded, setExpanded] = useState(true);

  const { data, isLoading, error } = useQuery<DailyBrief>({
    queryKey: ["daily-brief"],
    queryFn: api.getDailyBrief,
    refetchInterval: 30 * 60 * 1000, // 30 min
    staleTime: 10 * 60 * 1000,
  });

  if (error) return null;

  return (
    <div className="glass-card-glow rounded-2xl overflow-hidden animate-fade-in">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3.5"
        style={{ borderBottom: expanded ? "1px solid rgba(255,255,255,0.05)" : "none" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, rgba(34,211,238,0.2), rgba(167,139,250,0.15))",
              border: "1px solid rgba(34,211,238,0.2)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a5 5 0 015 5c0 2.76-5 8-5 8s-5-5.24-5-8a5 5 0 015-5z" />
              <circle cx="12" cy="7" r="1.5" />
              <path d="M5 21h14" />
              <path d="M12 17v4" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-foreground/70">AI Market Brief</span>
          {data?.available && (
            <span className="text-[9px] text-foreground/20 font-mono">
              {new Date(data.generated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className="text-foreground/20 transition-transform"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-5 py-4">
          {isLoading ? (
            <div className="space-y-2">
              <div className="h-3 w-full shimmer rounded" />
              <div className="h-3 w-11/12 shimmer rounded" />
              <div className="h-3 w-4/5 shimmer rounded" />
              <div className="h-3 w-full shimmer rounded" />
              <div className="h-3 w-3/4 shimmer rounded" />
            </div>
          ) : data?.available ? (
            <p className="text-sm text-foreground/60 leading-relaxed whitespace-pre-line">
              {data.brief}
            </p>
          ) : (
            <p className="text-xs text-foreground/25">{data?.brief || "Brief unavailable"}</p>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { Sparkline } from "./sparkline";

// Country code to flag emoji
const FLAG_EMOJI: Record<string, string> = {
  IN: "\u{1F1EE}\u{1F1F3}",
  US: "\u{1F1FA}\u{1F1F8}",
  CN: "\u{1F1E8}\u{1F1F3}",
  JP: "\u{1F1EF}\u{1F1F5}",
  GB: "\u{1F1EC}\u{1F1E7}",
  DE: "\u{1F1E9}\u{1F1EA}",
  FR: "\u{1F1EB}\u{1F1F7}",
  HK: "\u{1F1ED}\u{1F1F0}",
  KR: "\u{1F1F0}\u{1F1F7}",
  AU: "\u{1F1E6}\u{1F1FA}",
};

interface CountryCardProps {
  code: string;
  country: string;
  indices: Array<{
    key: string;
    name: string;
    price: number;
    change_pct: number;
    sparkline: number[];
  }>;
  overallChange: number;
  selected?: boolean;
  onClick?: () => void;
}

export function CountryCard({ code, country, indices, overallChange, selected, onClick }: CountryCardProps) {
  const positive = overallChange >= 0;
  const primary = indices[0];

  return (
    <button
      onClick={onClick}
      className="glass-card glass-card-hover rounded-xl p-4 w-full text-left transition-all duration-200"
      style={{
        borderColor: selected
          ? positive
            ? "rgba(16, 185, 129, 0.35)"
            : "rgba(244, 63, 94, 0.35)"
          : undefined,
        boxShadow: selected
          ? positive
            ? "0 0 30px rgba(16, 185, 129, 0.1)"
            : "0 0 30px rgba(244, 63, 94, 0.1)"
          : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: country info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{FLAG_EMOJI[code] || code}</span>
            <span className="font-semibold text-sm text-foreground/90 truncate">{country}</span>
          </div>
          <p className="text-[11px] text-foreground/30 truncate">
            {indices.map((i) => i.name).join(" · ")}
          </p>
        </div>

        {/* Right: change */}
        <div className="text-right shrink-0">
          <span
            className="text-sm font-bold font-mono"
            style={{ color: positive ? "var(--green-bright)" : "var(--red-bright)" }}
          >
            {positive ? "+" : ""}
            {overallChange.toFixed(2)}%
          </span>
          {primary && (
            <p className="text-[11px] text-foreground/40 font-mono mt-0.5">
              {primary.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          )}
        </div>
      </div>

      {/* Sparkline */}
      {primary?.sparkline && (
        <div className="mt-3">
          <Sparkline data={primary.sparkline} width={260} height={36} positive={positive} />
        </div>
      )}

      {/* Multi-index row (if more than 1 index) */}
      {indices.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {indices.slice(1).map((idx) => (
            <div key={idx.key} className="flex items-center gap-1.5 text-[10px]">
              <span className="text-foreground/40">{idx.name}</span>
              <span
                className="font-mono font-medium"
                style={{ color: idx.change_pct >= 0 ? "var(--green)" : "var(--red)" }}
              >
                {idx.change_pct >= 0 ? "+" : ""}{idx.change_pct.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </button>
  );
}

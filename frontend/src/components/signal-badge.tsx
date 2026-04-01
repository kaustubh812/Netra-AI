"use client";

interface SignalBadgeProps {
  signal: string;
  confidence?: number;
  size?: "sm" | "md" | "lg";
}

const SIGNAL_COLORS: Record<string, string> = {
  BUY: "bg-ngreen/20 text-ngreen border-ngreen/30",
  SELL: "bg-nred/20 text-nred border-nred/30",
  HOLD: "bg-amber/20 text-amber border-amber/30",
};

const SIGNAL_GLOW: Record<string, string> = {
  BUY: "shadow-[0_0_16px_rgba(16,185,129,0.35)]",
  SELL: "shadow-[0_0_16px_rgba(244,63,94,0.35)]",
  HOLD: "shadow-[0_0_16px_rgba(245,158,11,0.35)]",
};

const SIZE_CLASSES: Record<string, string> = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-3 py-1 text-sm",
  lg: "px-5 py-2.5 text-lg",
};

export function SignalBadge({ signal, confidence, size = "md" }: SignalBadgeProps) {
  const clean = signal.replace(" (CAUTION)", "");
  const hasCaution = signal.includes("CAUTION");

  const colorClass = SIGNAL_COLORS[clean] || SIGNAL_COLORS.HOLD;
  const glowClass = size === "lg" ? (SIGNAL_GLOW[clean] || "") : "";
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-block rounded-lg border font-mono font-bold transition-all duration-200 ${colorClass} ${glowClass} ${sizeClass}`}
      >
        {clean}
      </span>
      {confidence !== undefined && (
        <span className="text-foreground/50 font-mono text-xs">
          {confidence.toFixed(0)}%
        </span>
      )}
      {hasCaution && (
        <span className="text-amber text-xs font-medium">CAUTION</span>
      )}
    </span>
  );
}

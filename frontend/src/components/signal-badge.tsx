"use client";

interface SignalBadgeProps {
  signal: string;
  confidence?: number;
  size?: "sm" | "md" | "lg";
}

export function SignalBadge({ signal, confidence, size = "md" }: SignalBadgeProps) {
  const clean = signal.replace(" (CAUTION)", "");
  const hasCaution = signal.includes("CAUTION");

  const colors: Record<string, string> = {
    BUY: "bg-ngreen/20 text-ngreen border-ngreen/30 glow-green",
    SELL: "bg-nred/20 text-nred border-nred/30 glow-red",
    HOLD: "bg-amber/20 text-amber border-amber/30 glow-amber",
  };

  const sizes: Record<string, string> = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-3 py-1 text-sm",
    lg: "px-4 py-2 text-lg",
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-block rounded border font-mono font-bold ${colors[clean] || colors.HOLD} ${sizes[size]}`}
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

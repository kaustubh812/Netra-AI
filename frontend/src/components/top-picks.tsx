"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, Signal } from "@/lib/api";
import { SignalBadge } from "./signal-badge";

function PickCard({ signal }: { signal: Signal }) {
  const isBuy = signal.signal === "BUY";

  return (
    <Link
      href={`/stock/${encodeURIComponent(signal.symbol)}`}
      className={`block p-4 rounded-lg border transition-all hover:scale-[1.02] ${
        isBuy
          ? "bg-ngreen/5 border-ngreen/20 hover:border-ngreen/40"
          : "bg-nred/5 border-nred/20 hover:border-nred/40"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-foreground">{signal.name}</span>
        <SignalBadge signal={signal.signal} confidence={signal.confidence} size="sm" />
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs font-mono">
        <div>
          <span className="text-foreground/40">Entry</span>
          <div className="text-foreground/80">{signal.entry_price.toLocaleString("en-IN")}</div>
        </div>
        <div>
          <span className="text-nred/60">SL</span>
          <div className="text-nred/80">{signal.stop_loss.toLocaleString("en-IN")}</div>
        </div>
        <div>
          <span className="text-ngreen/60">Target</span>
          <div className="text-ngreen/80">{signal.target_price.toLocaleString("en-IN")}</div>
        </div>
      </div>
    </Link>
  );
}

export function TopPicks() {
  const { data } = useQuery({
    queryKey: ["latest-signals"],
    queryFn: api.getLatestSignals,
  });

  if (!data?.signals.length) return null;

  const buys = data.signals.filter((s) => s.signal === "BUY").slice(0, 3);
  const sells = data.signals.filter((s) => s.signal === "SELL").slice(0, 3);

  if (!buys.length && !sells.length) return null;

  return (
    <div className="mb-6">
      <h2 className="text-sm font-medium text-foreground/50 mb-3">TOP PICKS</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {buys.map((s) => (
          <PickCard key={s.symbol} signal={s} />
        ))}
        {sells.map((s) => (
          <PickCard key={s.symbol} signal={s} />
        ))}
      </div>
    </div>
  );
}

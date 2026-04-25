"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/options", label: "Chain" },
  { href: "/options/signals", label: "Signals" },
  { href: "/options/positions", label: "Positions" },
];

export function OptionsTabs() {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-1.5 mb-5">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`px-4 py-1.5 rounded-full text-xs font-mono transition-all ${
              active
                ? "bg-cyan/15 text-cyan border border-cyan/30"
                : "bg-white/[0.03] text-foreground/40 border border-white/[0.06] hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Navbar() {
  const pathname = usePathname();

  const links = [
    { href: "/", label: "Dashboard" },
    { href: "/settings", label: "Settings" },
  ];

  return (
    <nav className="border-b border-border bg-surface sticky top-0 z-50">
      <div className="max-w-screen-2xl mx-auto px-4 flex items-center h-14 gap-8">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="text-cyan font-bold text-xl font-mono tracking-tight">
            NETRA
          </span>
          <span className="text-foreground/40 text-sm hidden sm:inline">
            नेत्र
          </span>
        </Link>

        <div className="flex gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                pathname === link.href
                  ? "bg-cyan/10 text-cyan"
                  : "text-foreground/60 hover:text-foreground hover:bg-surface-2"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="ml-auto text-xs text-foreground/30 font-mono hidden md:block">
          The eye that sees the market
        </div>
      </div>
    </nav>
  );
}

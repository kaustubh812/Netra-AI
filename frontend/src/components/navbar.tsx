"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINK_STYLES = {
  active: "bg-cyan/10 text-cyan shadow-[0_0_12px_rgba(0,229,255,0.15)]",
  inactive: "text-foreground/50 hover:text-foreground hover:bg-white/[0.04]",
} as const;

export function Navbar() {
  const pathname = usePathname();

  const links = [
    { href: "/", label: "Dashboard" },
    { href: "/settings", label: "Settings" },
  ];

  return (
    <nav className="glass-card border-b border-white/[0.06] sticky top-0 z-50">
      <div className="max-w-screen-2xl mx-auto px-6 flex items-center h-16 gap-8">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          {/* Eye icon */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5Z" stroke="url(#eyeGrad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="12" cy="12" r="3.5" stroke="url(#eyeGrad)" strokeWidth="1.5"/>
            <defs>
              <linearGradient id="eyeGrad" x1="1" y1="12" x2="23" y2="12">
                <stop stopColor="#00e5ff"/>
                <stop offset="1" stopColor="#a78bfa"/>
              </linearGradient>
            </defs>
          </svg>
          <span className="text-gradient-cyan font-bold text-xl font-mono tracking-tight">
            NETRA
          </span>
          <span className="text-foreground/30 text-sm hidden sm:inline">
            नेत्र
          </span>
        </Link>

        <div className="flex gap-1">
          {links.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${isActive ? NAV_LINK_STYLES.active : NAV_LINK_STYLES.inactive}`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="ml-auto text-xs text-foreground/20 font-mono hidden md:block">
          The eye that sees the market
        </div>
      </div>
      {/* Gradient accent line */}
      <div className="h-px bg-gradient-to-r from-transparent via-cyan/30 to-transparent" />
    </nav>
  );
}

"use client";

import { usePathname } from "next/navigation";
import { Logo } from "@/components/branding/Logo";

/**
 * Tablet + desktop top bar (UI-2A). Deliberately minimal for the
 * foundation phase: brand mark (tablet only — desktop shows it in the
 * sidebar) plus the current section title, derived from the pathname so no
 * page needs to change. It is `sticky` in normal flow (not fixed) so
 * content below it is never overlapped; `main.min-h-screen` is trimmed by
 * `--topbar-h` in globals.css so short pages still fill exactly one
 * viewport. CSS (`html[data-layout] .app-topbar`) controls visibility —
 * hidden on phone, no first-paint flash.
 */

const SECTION_TITLES: Array<[prefix: string, title: string]> = [
  ["/kingdom-map", "Home"],
  ["/puzzles", "Puzzles"],
  ["/play/tournaments", "Tournaments"],
  ["/play", "Play"],
  ["/learn", "Learn"],
  ["/academy", "Academy"],
  ["/chess-mind", "Chess Mind"],
  ["/discover", "Discover"],
  ["/piece-library", "Piece Library"],
  ["/profile", "Profile"],
  ["/more", "More"],
  ["/parent-dashboard", "Parent Dashboard"],
];

function sectionTitle(pathname: string): string {
  const hit = SECTION_TITLES.find(
    ([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  return hit ? hit[1] : "";
}

export function AppTopBar() {
  const pathname = usePathname();
  const title = sectionTitle(pathname);

  return (
    <header
      className="app-topbar sticky top-0 z-30 h-14 flex-none items-center gap-3 border-b border-premium-gold/10 bg-premium-midnightDeep/85 px-4 backdrop-blur-md"
      style={{ minHeight: "var(--topbar-h)" }}
    >
      {/* Brand — only on tablet, where there is no sidebar to carry it. */}
      <span className="app-topbar-brand hidden">
        <Logo variant="horizontal" size={22} />
      </span>
      {title && (
        <span className="font-classic-display text-base text-premium-ivory/90 truncate">
          {title}
        </span>
      )}
    </header>
  );
}

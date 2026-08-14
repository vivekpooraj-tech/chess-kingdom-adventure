"use client";

import { useState } from "react";
import Link from "next/link";
import { getDailyPuzzle } from "@/content/puzzles";
import { LOCAL_TEST_MODE } from "@/lib/devTestMode";

/**
 * Phase 20 — the visible half of local test mode (see lib/devTestMode.ts
 * for the LOCAL_TEST_MODE flag itself, and why it can't activate in a
 * production build regardless of this component even existing). Mounted
 * unconditionally in app/layout.tsx; this early return is what actually
 * keeps it out of the tree everywhere except a local dev server with the
 * flag on — same single check as everything else this phase.
 *
 * Deliberately NOT styled like the rest of the app (red/amber instead of
 * the premium gold palette) so it never gets mistaken for real product UI.
 */
export function DevTestModeBar() {
  const [open, setOpen] = useState(false);

  if (!LOCAL_TEST_MODE) {
    return null;
  }

  const dailyPuzzle = getDailyPuzzle();

  const links: { label: string; href: string }[] = [
    { label: "Chess Kingdom", href: "/kingdom-map" },
    { label: "Learn", href: "/learn" },
    { label: "Chess Mind", href: "/chess-mind" },
    { label: "Play", href: "/play" },
    { label: "Random Match", href: "/matchmaking" },
    { label: "Daily Challenge", href: `/puzzles?id=${dailyPuzzle.id}` },
    { label: "Tactics", href: "/academy/tactics" },
    { label: "Profile", href: "/profile" },
    { label: "Premium Preview", href: "/dev/premium-preview" },
  ];

  return (
    <div className="fixed top-2 right-2 z-[999] font-mono">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="dev-test-mode-menu"
        className="rounded px-2 py-1 text-[10px] font-bold tracking-wide bg-red-600 text-white shadow-lg border border-red-300/50"
      >
        DEV TEST MODE
      </button>

      {open && (
        <div
          id="dev-test-mode-menu"
          role="menu"
          aria-label="Developer quick navigation"
          className="mt-1 w-48 max-h-[70vh] overflow-y-auto rounded bg-black/90 border border-red-400/40 shadow-xl p-1.5 flex flex-col gap-0.5"
        >
          {links.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="rounded px-2 py-1.5 text-xs text-white/90 hover:bg-red-600/40 transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

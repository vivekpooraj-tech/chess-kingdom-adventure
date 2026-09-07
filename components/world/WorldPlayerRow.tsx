"use client";

import type { ReactNode } from "react";
import { useWorldLocation } from "@/lib/world/useWorldLocation";

/**
 * A player's row beside the board — plain by default, a premium card when a
 * location is active.
 *
 * The important property is that this component WRAPS rather than replaces.
 * `children` is the exact JSX the game page already rendered, clock element
 * and all, so `LiveChessClock` keeps owning every millisecond of timing and
 * this file contains no clock arithmetic whatsoever. With no location selected
 * it renders its children in the original layout and adds nothing at all.
 *
 * That is what lets the same call site serve both experiences without the game
 * page branching on presentation.
 */
export function WorldPlayerRow({
  label,
  icon,
  rating,
  isActive,
  isOpponent,
  children,
}: {
  /** "You — White", "Opponent", … — supplied by the page, not invented here. */
  label: ReactNode;
  icon: string;
  /** Shown only if the page has one; the card degrades without it. */
  rating?: number | null;
  /** Whose clock is running. Drives the highlight only. */
  isActive?: boolean;
  isOpponent?: boolean;
  children: ReactNode;
}) {
  const { location } = useWorldLocation();

  // No location: exactly the markup the page had before this component existed.
  if (!location) {
    return (
      <div
        className={`flex w-full items-center justify-between font-classic-body text-sm ${
          isOpponent ? "text-premium-ivory/70" : "text-premium-ivory"
        }`}
      >
        <span className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          {label}
        </span>
        <span className="flex items-center gap-2">{children}</span>
      </div>
    );
  }

  // Active side gets a warm edge; the other stays cool. One glance should say
  // whose move it is without reading a number.
  const edge = isActive
    ? "border-premium-gold/60 bg-black/45 shadow-[0_0_1.5rem_rgba(212,175,55,0.15)]"
    : "border-white/10 bg-black/35";

  return (
    <div
      className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 backdrop-blur-md transition-colors ${edge}`}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        {/* Avatar stand-in. The app has avatar ids on children but the game page
            does not currently load them into this row; rather than fetch here —
            which would put a network call inside a decorative component — the
            emoji the page already passes is framed instead. */}
        <span
          aria-hidden="true"
          className="grid h-9 w-9 flex-none place-items-center rounded-full border border-white/15 bg-white/[0.06] text-lg"
        >
          {icon}
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block truncate font-classic-body text-sm text-premium-ivory">
            {label}
          </span>
          {typeof rating === "number" && (
            <span className="block font-classic-body text-[11px] text-premium-ivory/55">
              {rating}
            </span>
          )}
        </span>
      </span>

      {/* The clock element the page passed in, untouched. */}
      <span className="flex flex-none items-center gap-2">{children}</span>
    </div>
  );
}

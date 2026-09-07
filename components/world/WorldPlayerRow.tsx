"use client";

import type { ReactNode } from "react";

import { ClockProgressBar } from "@/components/game/ClockProgressBar";
import type { ClockSync } from "@/lib/game/useRemainingMs";
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
 *
 * On flags: the card has no country row because the app stores no country. The
 * `children` table has no such column (verified against the live schema), and
 * the only country the codebase knows is the request-IP one Vercel supplies for
 * Stripe pricing — that is the paying parent's network location, not the young
 * player's nationality, and showing it as a flag would be asserting something
 * about a child that nobody ever told us. An invented flag is worse than none.
 */
export function WorldPlayerRow({
  label,
  icon,
  rating,
  isActive,
  isOpponent,
  clock,
  children,
}: {
  /** "You — White", "Opponent", … — supplied by the page, not invented here. */
  label: ReactNode;
  icon: string;
  /** Live rating from children.rating. Omitted rather than guessed when the
   *  page has none — see the page's comment on why the opponent has none. */
  rating?: number | null;
  /** Whose clock is running. Drives the highlight only. */
  isActive?: boolean;
  isOpponent?: boolean;
  /** The same server-authoritative clock props the page gives LiveChessClock,
   *  plus the starting time to scale against. Absent on untimed games. */
  clock?: ClockSync & { totalMs: number | null | undefined };
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
  // whose move it is without reading a number. The change is carried by border,
  // glow and glass depth rather than motion — this sits directly beside a live
  // board, and anything that moves here steals attention from the pieces.
  const edge = isActive
    ? "border-premium-gold/70 bg-black/50 shadow-[0_0_0_1px_rgba(212,175,55,0.25),0_0_1.75rem_rgba(212,175,55,0.22)]"
    : "border-white/10 bg-black/35";

  return (
    <div
      data-testid="player-card"
      data-active={isActive ? "true" : "false"}
      className={`w-full rounded-2xl border px-3 py-2.5 backdrop-blur-md transition-[border-color,box-shadow,background-color] duration-300 ${edge}`}
    >
      <div className="flex w-full items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2.5">
          {/* Avatar stand-in. The app has avatar ids on children but the game
              page does not currently load them into this row; rather than fetch
              here — which would put a network call inside a decorative
              component — the emoji the page already passes is framed instead. */}
          <span
            aria-hidden="true"
            className={`grid h-9 w-9 flex-none place-items-center rounded-full border bg-white/[0.06] text-lg transition-colors duration-300 ${
              isActive ? "border-premium-gold/50" : "border-white/15"
            }`}
          >
            {icon}
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate font-classic-body text-sm text-premium-ivory">
              {label}
            </span>
            {typeof rating === "number" && (
              <span
                data-testid="player-rating"
                className="block font-classic-body text-[11px] tabular-nums text-premium-ivory/55"
              >
                {rating}
              </span>
            )}
          </span>
        </span>

        {/* The clock element the page passed in, untouched. */}
        <span className="flex flex-none items-center gap-2">{children}</span>
      </div>

      {clock && (
        <div className="mt-2">
          <ClockProgressBar {...clock} label={isOpponent ? "Opponent" : "Your"} />
        </div>
      )}
    </div>
  );
}

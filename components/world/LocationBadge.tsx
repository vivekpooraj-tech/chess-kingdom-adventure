"use client";

import Link from "next/link";

import { useWorldLocation } from "@/lib/world/useWorldLocation";

/**
 * The in-game location chrome: a badge naming where you are, and an ambience
 * card. Both are glass panels pinned to the top corners, well clear of the
 * board's centre column.
 *
 * Sizing is deliberately restrained. This sits beside a live game, so it reads
 * as a caption rather than a headline — anything louder would compete with the
 * clocks, which are the only thing on screen allowed to demand attention.
 *
 * Hidden entirely below `sm`. On a phone the board already fills the viewport
 * and every pixel of chrome costs board size; the location is still visible on
 * the switcher chip at the bottom.
 */
export function LocationBadge() {
  const { location } = useWorldLocation();
  if (!location) return null;

  return (
    <>
      {/* Top left — where you are. */}
      <div className="pointer-events-none absolute left-3 top-3 z-20 hidden sm:block">
        <div className="pointer-events-auto rounded-2xl border border-white/10 bg-black/35 px-4 py-3 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="font-classic-display text-sm text-premium-ivory">{location.name}</span>
          </div>
          <p className="font-classic-body text-[11px] uppercase tracking-wider text-premium-ivory/55">
            {location.title}
          </p>
          {location.flavour && (
            <p className="mt-1.5 max-w-[14rem] font-classic-body text-[11px] italic leading-snug text-premium-ivory/70">
              “{location.flavour}”
            </p>
          )}
        </div>
      </div>

      {/* Top right — ambience. Static values from the registry, not a live feed:
          a second ticking number beside two chess clocks would be noise, and a
          weather API would be a dependency bought for decoration. */}
      <div className="pointer-events-none absolute right-3 top-3 z-20 hidden md:block">
        <div className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-right backdrop-blur-md">
          <div className="flex items-center justify-end gap-3">
            <span className="font-classic-body text-[11px] text-premium-ivory/60">
              {location.city}, {location.country}
            </span>
            <span className="font-classic-body text-sm text-premium-ivory">
              {location.ambience.temperature}
            </span>
          </div>
          <div className="mt-0.5 flex items-center justify-end gap-3">
            <span className="font-classic-body text-[11px] uppercase tracking-wider text-premium-gold/80">
              {location.ambience.label}
            </span>
            <span className="font-classic-body text-sm text-premium-ivory/85">
              {location.ambience.detail}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * The bottom-left switcher chip — "Playing in London Eye".
 *
 * A link rather than an in-game picker on purpose: changing scenery mid-game
 * is not something to make one tap away from a player under clock pressure,
 * and the World page is where that decision belongs.
 */
export function LocationSwitcherChip() {
  const { location } = useWorldLocation();
  if (!location) return null;

  return (
    <Link
      href="/world"
      className="absolute bottom-3 left-3 z-20 hidden items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-3 py-2 backdrop-blur-md transition-colors hover:border-premium-gold/40 sm:flex"
    >
      <span
        aria-hidden="true"
        className="h-8 w-8 rounded-lg"
        style={{
          background: `linear-gradient(140deg, ${location.palette.from}, ${location.palette.via} 55%, ${location.palette.to})`,
        }}
      />
      <span className="leading-tight">
        <span className="block font-classic-body text-[10px] uppercase tracking-wider text-premium-ivory/50">
          Playing in
        </span>
        <span className="block font-classic-display text-sm text-premium-ivory">{location.name}</span>
      </span>
      <span aria-hidden="true" className="ml-1 text-premium-ivory/40">
        ›
      </span>
      <span className="sr-only">Change location</span>
    </Link>
  );
}

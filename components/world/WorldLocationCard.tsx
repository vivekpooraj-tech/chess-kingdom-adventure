"use client";

import Link from "next/link";
import type { WorldLocation } from "@/lib/world/locations";

/**
 * One location card.
 *
 * Playable locations link to their preview. Locked ones are rendered as a
 * `div`, not a disabled link — a keyboard user should not be able to tab onto
 * something that goes nowhere, and `aria-disabled` on a focusable anchor would
 * announce it as interactive when it is not.
 *
 * The artwork is a CSS gradient from the location's own palette. That keeps
 * this page free of image bytes and means a new location gets a card the
 * moment it has an entry in the registry, with no asset pipeline in between.
 */
export function WorldLocationCard({
  location,
  isActive,
}: {
  location: WorldLocation;
  isActive: boolean;
}) {
  const playable = location.status === "available";

  const art = (
    <span
      aria-hidden="true"
      className="relative block h-28 w-full overflow-hidden rounded-xl sm:h-32"
      style={{
        background: `linear-gradient(150deg, ${location.palette.from} 0%, ${location.palette.via} 52%, ${location.palette.to} 100%)`,
      }}
    >
      {/* A horizon line and a low sun, so every card reads as a place rather
          than a swatch — cheap, and it scales to any future palette. */}
      <span
        className="absolute inset-x-0 bottom-0 h-1/3"
        style={{ background: "linear-gradient(to top, rgba(8,10,20,0.85), transparent)" }}
      />
      <span
        className="absolute left-1/2 h-10 w-10 -translate-x-1/2 rounded-full blur-md"
        style={{ bottom: "26%", background: location.palette.accent, opacity: 0.75 }}
      />
      {!playable && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/45">
          <span className="text-lg" aria-hidden="true">
            🔒
          </span>
        </span>
      )}
      {/* Rare by design — see the note on `badge` in the registry. It sits on
          the artwork rather than beside the name so it reads as a stamp on the
          place, and it is aria-hidden because the visible text below already
          names the location; a screen reader gains nothing from "Flagship"
          announced out of context. */}
      {playable && location.badge && (
        <span className="absolute left-2 top-2 rounded-full border border-premium-gold/40 bg-black/55 px-2 py-0.5 font-classic-body text-[10px] uppercase tracking-[0.14em] text-premium-gold backdrop-blur-sm">
          {location.badge}
        </span>
      )}
    </span>
  );

  const body = (
    <>
      {art}
      {/* No flag emoji here, deliberately. Windows ships no flag glyphs, so
          🇬🇧 falls back to the regional-indicator letters "GB" in tw
          boxes — verified on this machine — which reads as broken rather than
          decorative. The city and country carry the same meaning in text. */}
      <span className="mt-3 block font-classic-display text-sm text-premium-ivory">
        {location.name}
      </span>
      <span className="mt-0.5 block font-classic-body text-[11px] text-premium-ivory/55">
        {location.city} &middot; {location.title}
      </span>
      <span className="mt-3 block">
        {playable ? (
          <span className="inline-flex w-full items-center justify-center rounded-premiumBtn bg-premium-gold/90 px-3 py-2 font-classic-body text-xs font-semibold text-premium-midnightDeep">
            {isActive ? "Selected" : "Play Here"}
          </span>
        ) : (
          <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-premiumBtn border border-white/10 bg-white/[0.03] px-3 py-2 font-classic-body text-xs text-premium-ivory/45">
            Coming soon
          </span>
        )}
      </span>
    </>
  );

  const shell = `group flex flex-col rounded-2xl border p-3 transition-all ${
    isActive
      ? "border-premium-gold/60 bg-premium-navy/50"
      : "border-white/10 bg-premium-navy/30"
  }`;

  if (!playable) {
    return (
      <div className={`${shell} opacity-70`}>
        {body}
        <span className="sr-only">{location.name} is not available yet</span>
      </div>
    );
  }

  return (
    <Link
      href={`/world/${location.id}`}
      className={`${shell} hover:-translate-y-0.5 hover:border-premium-gold/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-premium-gold motion-reduce:hover:translate-y-0`}
    >
      {body}
    </Link>
  );
}

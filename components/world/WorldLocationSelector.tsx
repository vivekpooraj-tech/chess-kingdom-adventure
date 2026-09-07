"use client";

import { useState } from "react";
import { WORLD_LOCATIONS } from "@/lib/world/locations";
import { useWorldLocation } from "@/lib/world/useWorldLocation";
import { WorldLocationCard } from "./WorldLocationCard";

type Filter = "all" | "available" | "premium";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "available", label: "Available" },
  { id: "premium", label: "Premium" },
];

/**
 * The location grid, with filters and a way back to the plain game.
 *
 * A grid rather than the horizontal rail in the concept: a rail hides its
 * contents behind a horizontal scroll that is awkward on a touch device inside
 * a vertically scrolling page, and with six locations there is nothing to
 * hide. It also reflows to one column on a phone for free.
 */
export function WorldLocationSelector() {
  const { location, select } = useWorldLocation();
  const [filter, setFilter] = useState<Filter>("all");

  const shown = WORLD_LOCATIONS.filter((l) => {
    if (filter === "available") return l.status === "available";
    if (filter === "premium") return l.isPremium;
    return true;
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Filter locations"
          className="flex gap-1 rounded-full border border-white/10 bg-premium-navy/40 p-1"
        >
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={`rounded-full px-4 py-1.5 font-classic-body text-xs transition-colors ${
                filter === f.id
                  ? "bg-premium-gold text-premium-midnightDeep"
                  : "text-premium-ivory/60 hover:text-premium-ivory"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* The exit. A themed game must always be one click from the plain one,
            or the feature becomes something done TO the player. */}
        {location && (
          <button
            type="button"
            onClick={() => select(null)}
            className="rounded-premiumBtn border border-white/10 px-4 py-2 font-classic-body text-xs text-premium-ivory/70 transition-colors hover:border-premium-gold/40 hover:text-premium-ivory"
          >
            Play without a location
          </button>
        )}
      </div>

      {location && (
        <p className="font-classic-body text-xs text-premium-ivory/60">
          Your games are currently set in{" "}
          <span className="text-premium-gold">{location.name}</span>. This changes how the game
          looks — never how it plays.
        </p>
      )}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((l) => (
          <li key={l.id}>
            <WorldLocationCard location={l} isActive={location?.id === l.id} />
          </li>
        ))}
      </ul>
    </div>
  );
}

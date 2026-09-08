"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TabPageShell } from "@/components/nav/TabPageShell";
import { TEXT } from "@/lib/designSystem";
import { WorldSceneBackdrop } from "@/components/world/WorldSceneBackdrop";
import {
  WORLD_LOCATIONS,
  WORLD_NAME,
  WORLD_TAGLINE,
  playHereHref,
  type WorldLocation,
} from "@/lib/world/locations";
import {
  readPassport,
  recordVisit,
  totalGames,
  playedLocations,
  lastPlayed,
  worldAchievements,
  readSelectedLocation,
  writeSelectedLocation,
  type Passport,
} from "@/lib/world/passport";

/**
 * Chess Mind World.
 *
 * Two locations, both real, both finished. There is deliberately no row of
 * locked "coming soon" cards: a lock implies a progression system, and there
 * isn't one, so a locked card would be a promise the app cannot keep.
 *
 * The passport below shows only what actually happened — where a game was
 * really started, and how many. Opening this page records a visit; it does
 * not record a game, and nothing here is awarded for looking.
 *
 * A client page because the passport lives in localStorage (per device — see
 * lib/world/passport.ts, which says plainly why). It renders its full shell
 * on the first paint with an empty passport and fills the numbers in after,
 * so there is no hydration mismatch and no blank screen.
 */
function LocationCard({
  location,
  entry,
  favourite,
  onVisit,
  onToggleFavourite,
}: {
  location: WorldLocation;
  entry: Passport[keyof Passport];
  favourite: boolean;
  onVisit: () => void;
  onToggleFavourite: () => void;
}) {
  const [preview, setPreview] = useState(false);

  return (
    <article className="w-full rounded-premiumCard overflow-hidden border border-white/10 bg-premium-navy shadow-premiumCard flex flex-col">
      {/* The card's own gradient stands in for the scene until the reader
          asks for it, so opening this page downloads no scene code at all. */}
      <div
        className={`relative w-full aspect-[16/9] bg-gradient-to-br ${location.cardGradient}`}
      >
        {preview && <WorldSceneBackdrop locationId={location.id} scrim={0.15} />}
        <div className="absolute inset-0 bg-gradient-to-t from-premium-navy via-transparent to-transparent" />

        {/* Favourite is a plain per-device preference — see
            readSelectedLocation/writeSelectedLocation — not a claim about
            gameplay, so it needs no earned/real-event guard the way the
            passport line below does. */}
        <button
          type="button"
          onClick={onToggleFavourite}
          aria-pressed={favourite}
          aria-label={favourite ? `Remove ${location.title} as favourite` : `Set ${location.title} as favourite`}
          className="absolute top-3 right-3 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-black/30 hover:bg-black/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 text-xl"
        >
          <span aria-hidden="true">{favourite ? "⭐" : "☆"}</span>
        </button>

        <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="font-classic-display text-xl text-white drop-shadow">
              <span aria-hidden="true">{location.emoji} </span>
              {location.title}
            </p>
            <p className="font-classic-body text-xs text-white/80">{location.tagline}</p>
          </div>
          {!preview && (
            <button
              type="button"
              onClick={() => {
                setPreview(true);
                onVisit();
              }}
              className="flex-none min-h-[44px] px-3.5 rounded-full border border-white/40 bg-black/30 font-classic-body text-xs font-semibold text-white hover:bg-black/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              Look around
            </button>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-5 flex flex-col gap-3 flex-1">
        <p className={`${TEXT.caption} uppercase tracking-wide`}>{location.atmosphere}</p>
        <p className={`${TEXT.body} flex-1`}>{location.story}</p>

        {/* Only ever real numbers. No entry, no line. */}
        {entry?.playedAt ? (
          <p className={`${TEXT.caption} normal-case`} style={{ color: location.accent }}>
            ✓ {entry.games} {entry.games === 1 ? "game" : "games"} played here
            {entry.wins > 0 && ` · ${entry.wins} ${entry.wins === 1 ? "win" : "wins"}`}
          </p>
        ) : entry ? (
          <p className={`${TEXT.caption} normal-case`}>Visited — no games here yet.</p>
        ) : null}

        <Link
          href={playHereHref(location.id)}
          className="self-start font-classic-body text-sm font-semibold text-premium-midnight bg-premium-gold rounded-full px-5 min-h-[44px] flex items-center active:scale-[0.98] transition-transform duration-100 motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/60"
        >
          ♟ Play here →
        </Link>
      </div>
    </article>
  );
}

export default function WorldPage() {
  const [passport, setPassport] = useState<Passport>({});
  const [favourite, setFavourite] = useState<WorldLocation["id"] | null>(null);

  useEffect(() => {
    setPassport(readPassport());
    setFavourite(readSelectedLocation());
  }, []);

  const played = playedLocations(passport);
  const games = totalGames(passport);
  const recent = lastPlayed(passport);
  const recentLocation = WORLD_LOCATIONS.find((l) => l.id === recent) ?? null;
  const achievements = worldAchievements(passport);

  function toggleFavourite(id: WorldLocation["id"]) {
    const next = favourite === id ? null : id;
    setFavourite(next);
    writeSelectedLocation(next);
  }

  return (
    <TabPageShell maxWidth="wide">
      <header className="w-full">
        <p className={`${TEXT.meta} text-premium-gold`}>🌍 {WORLD_NAME}</p>
        <h1 className={`${TEXT.display} mt-1`}>{WORLD_TAGLINE}</h1>
        <p className={`${TEXT.body} mt-2`}>
          The rules never change. Everything around them can. Choose a place, and play there.
        </p>
      </header>

      <div
        className="auto-grid items-stretch w-full"
        style={{ "--grid-min": "20rem", "--grid-gap": "clamp(1rem, 3vw, 1.75rem)" } as React.CSSProperties}
      >
        {WORLD_LOCATIONS.map((location) => (
          <LocationCard
            key={location.id}
            location={location}
            entry={passport[location.id]}
            favourite={favourite === location.id}
            onVisit={() => setPassport(recordVisit(location.id))}
            onToggleFavourite={() => toggleFavourite(location.id)}
          />
        ))}
      </div>

      {/* The passport. Shown only once there is something true to say — an
          empty passport is a heading with nothing under it, so it isn't
          rendered at all. */}
      {games > 0 && (
        <section
          aria-labelledby="passport-heading"
          className="w-full rounded-premiumCard border border-premium-gold/25 bg-premium-navyLight/60 p-5 flex flex-col gap-3"
        >
          <h2 id="passport-heading" className={`${TEXT.meta} text-premium-gold`}>
            🗺️ Your World Passport
          </h2>
          <p className={TEXT.body}>
            {games} {games === 1 ? "game" : "games"} played across {played.length}{" "}
            {played.length === 1 ? "location" : "locations"}.
          </p>
          {recentLocation && (
            <p className={`${TEXT.caption} normal-case`}>
              Most recently: {recentLocation.title}.
            </p>
          )}

          {/* Real achievements only — derived straight from the same
              passport, so this can never claim something the numbers above
              don't back up. See lib/world/passport.ts's worldAchievements. */}
          {achievements.length > 0 && (
            <ul className="flex flex-wrap gap-2 list-none mt-1">
              {achievements.map((a) => (
                <li
                  key={a.key}
                  title={a.description}
                  className="font-classic-body text-xs text-premium-ivory/85 border border-premium-gold/30 bg-white/[0.03] rounded-full px-3 py-1.5"
                >
                  <span aria-hidden="true">{a.emoji} </span>
                  {a.title}
                </li>
              ))}
            </ul>
          )}

          <p className={`${TEXT.caption} normal-case text-premium-ivory/45`}>
            Your passport is saved on this device.
          </p>
        </section>
      )}
    </TabPageShell>
  );
}

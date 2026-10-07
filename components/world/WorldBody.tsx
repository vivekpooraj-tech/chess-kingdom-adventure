"use client";

import Link from "next/link";
import { useState } from "react";
import { WorldBranch } from "@/components/layout/WorldBranch";
import { WorldSceneBackdrop } from "@/components/world/WorldSceneBackdrop";
import { WORLD_NAME, WORLD_TAGLINE, playHereHref, type WorldLocation } from "@/lib/world/locations";
import type { Passport, WorldAchievement } from "@/lib/world/passport";

/**
 * /world in three world presentations. The page (app/world/page.tsx) owns ALL state and logic: the per-device passport, the favourite
 * place, the visit recording, the derived counts. This component only lays the same real values and the same working controls out three ways
 * (the favourite star, "Look around", "Play here", the passport): it adds no control, no selection and no state of its own beyond whether a
 * card's preview has been opened (exactly as before).
 *   Enchanted: realm portals: large scene cards with a gold seal on the favourite.
 *   Atelier:   an editorial pair: one wide and one narrow plate, ruled text, a chartreuse bar on the favourite.
 *   Classic:   rooms: framed scene plates in a spacious two-up, an emerald rule on the favourite.
 * The page is a play-location picker (a location is a backdrop for Free Play), not a chooser of the three worlds; this component does not
 * change that. Styles: `.wd-*` in app/world-world.css, one section per world (`.wd-en`, `.wd-at`, `.wd-cl`).
 */

export interface WorldBodyProps {
  locations: readonly WorldLocation[];
  passport: Passport;
  favourite: WorldLocation["id"] | null;
  onVisit: (id: WorldLocation["id"]) => void;
  onToggleFavourite: (id: WorldLocation["id"]) => void;
  games: number;
  playedCount: number;
  recentLocation: WorldLocation | null;
  achievements: WorldAchievement[];
}

type Cls = "wd-en" | "wd-at" | "wd-cl";

function LocationCard({
  p,
  location,
  cls,
  index,
}: {
  p: WorldBodyProps;
  location: WorldLocation;
  cls: Cls;
  index: number;
}) {
  const [preview, setPreview] = useState(false);
  const entry = p.passport[location.id];
  const favourite = p.favourite === location.id;

  return (
    <article className={`${cls}-card${favourite ? " is-favourite" : ""}`} data-location={location.id} data-index={index}>
      {/* The card's own gradient stands in for the scene until the reader asks for it, so opening this page downloads no scene code at all. */}
      <div className={`${cls}-scene bg-gradient-to-br ${location.cardGradient}`}>
        {preview && <WorldSceneBackdrop locationId={location.id} scrim={0.15} />}
        <div className="wd-scrim" />

        {/* Favourite is a plain per-device preference, not a claim about gameplay. */}
        <button
          type="button"
          onClick={() => p.onToggleFavourite(location.id)}
          aria-pressed={favourite}
          aria-label={favourite ? `Remove ${location.title} as favourite` : `Set ${location.title} as favourite`}
          className="wd-fav"
        >
          <span aria-hidden="true">{favourite ? "⭐" : "☆"}</span>
        </button>

        <div className="wd-scene__foot">
          <div className="wd-scene__titles">
            <p className="wd-scene__title">
              <span aria-hidden="true">{location.emoji} </span>
              {location.title}
            </p>
            <p className="wd-scene__tag">{location.tagline}</p>
          </div>
          {!preview && (
            <button
              type="button"
              onClick={() => {
                setPreview(true);
                p.onVisit(location.id);
              }}
              className="wd-look"
            >
              Look around
            </button>
          )}
        </div>
      </div>

      <div className={`${cls}-body`}>
        <p className="wd-atmos">{location.atmosphere}</p>
        <p className="wd-story">{location.story}</p>

        {/* Only ever real numbers. No entry, no line. */}
        {entry?.playedAt ? (
          <p className="wd-played">
            ✓ {entry.games} {entry.games === 1 ? "game" : "games"} played here
            {entry.wins > 0 && ` · ${entry.wins} ${entry.wins === 1 ? "win" : "wins"}`}
          </p>
        ) : entry ? (
          <p className="wd-visited">Visited — no games here yet.</p>
        ) : null}

        <Link href={playHereHref(location.id)} className="wd-play">
          ♟ Play here →
        </Link>
      </div>
    </article>
  );
}

function Passport({ p, cls }: { p: WorldBodyProps; cls: Cls }) {
  // The passport. Shown only once there is something true to say: an empty passport is a heading with nothing under it, so it isn't rendered.
  return (
    <>
      {p.games > 0 && (
        <section aria-labelledby={`${cls}-passport`} className="wd-passport">
          <h2 id={`${cls}-passport`} className="wd-passport__title">
            🗺️ Your World Passport
          </h2>
          <p className="wd-passport__line">
            {p.games} {p.games === 1 ? "game" : "games"} played across {p.playedCount} {p.playedCount === 1 ? "location" : "locations"}.
          </p>
          {p.recentLocation && <p className="wd-passport__sub">Most recently: {p.recentLocation.title}.</p>}
          {/* Real achievements only, derived from the same passport. */}
          {p.achievements.length > 0 && (
            <ul className="wd-passport__chips">
              {p.achievements.map((a) => (
                <li key={a.key} title={a.description}>
                  <span aria-hidden="true">{a.emoji} </span>
                  {a.title}
                </li>
              ))}
            </ul>
          )}
          <p className="wd-passport__note">Your passport is saved on this device.</p>
        </section>
      )}
    </>
  );
}

function Cards({ p, cls }: { p: WorldBodyProps; cls: Cls }) {
  return (
    <div className={`${cls}-cards`}>
      {p.locations.map((l, i) => (
        <LocationCard key={l.id} p={p} location={l} cls={cls} index={i} />
      ))}
    </div>
  );
}

/* ------------------------------ Enchanted ------------------------------ */
function Enchanted(p: WorldBodyProps) {
  return (
    <div className="wd wd-en">
      <header className="wd-en-head world-enter">
        <p className="world-kicker">🌍 {WORLD_NAME}</p>
        <h1 className="wd-en-title">{WORLD_TAGLINE}</h1>
        <p className="wd-en-lede">The rules never change. Everything around them can. Choose a place, and play there.</p>
      </header>
      <Cards p={p} cls="wd-en" />
      <Passport p={p} cls="wd-en" />
    </div>
  );
}

/* ------------------------------- Atelier -------------------------------- */
function Atelier(p: WorldBodyProps) {
  return (
    <div className="wd wd-at">
      <header className="wd-at-mast">
        <p className="wd-at-eyebrow">🌍 {WORLD_NAME}</p>
        <h1 className="wd-at-title">{WORLD_TAGLINE}</h1>
        <p className="wd-at-lede">The rules never change. Everything around them can. Choose a place, and play there.</p>
      </header>
      <Cards p={p} cls="wd-at" />
      <Passport p={p} cls="wd-at" />
    </div>
  );
}

/* ------------------------------- Classic -------------------------------- */
function Classic(p: WorldBodyProps) {
  return (
    <div className="wd wd-cl">
      <header className="wd-cl-top">
        <p className="world-kicker">🌍 {WORLD_NAME}</p>
        <h1 className="wd-cl-title">{WORLD_TAGLINE}</h1>
        <p className="wd-cl-lede">The rules never change. Everything around them can. Choose a place, and play there.</p>
      </header>
      <Cards p={p} cls="wd-cl" />
      <Passport p={p} cls="wd-cl" />
    </div>
  );
}

export function WorldBody(props: WorldBodyProps) {
  return <WorldBranch classic={<Classic {...props} />} atelier={<Atelier {...props} />} other={<Enchanted {...props} />} />;
}

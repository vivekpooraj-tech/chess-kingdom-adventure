"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { getWorldLocation, type WorldLocationId } from "@/lib/world/locations";
import { WorldArtScene } from "./WorldArtScene";

/**
 * Renders a World location behind whatever is on top of it.
 *
 * CODE SPLITTING IS THE POINT. Scenes are `dynamic(..., { ssr: false })`, so
 * a scene's markup ships only to someone who actually opens that location.
 * A learner who never visits the World never downloads a pixel of it, and
 * Free Play's bundle does not grow for a feature it is not using. This is
 * also why lib/world/locations.ts holds no React: importing the registry to
 * list two cards must not pull in two scenes.
 *
 * MOBILE SIMPLIFICATION. Below 640px the scene is told to simplify: fewer
 * generated elements, no ambient motion. Measured once on mount and on
 * resize, never per frame.
 *
 * WHAT IT CANNOT DO. Every node is pointer-events-none and aria-hidden. It
 * never receives the game, a move handler or a clock; it is a sibling behind
 * the board, and the scrim below keeps the pieces legible over any scene.
 */
const SCENES: Record<WorldLocationId, React.ComponentType<{ simplify?: boolean }>> = {
  "london-eye": dynamic(() => import("./scenes/LondonEyeScene"), { ssr: false }),
  chaturanga: dynamic(() => import("./scenes/ChaturangaScene"), { ssr: false }),
};

export function WorldSceneBackdrop({
  locationId,
  /** How much to dim the scene. The board sits on top of this, so it is the
   *  single knob that keeps pieces readable against any artwork. */
  scrim = 0.45,
  className = "",
}: {
  locationId: WorldLocationId | null | undefined;
  scrim?: number;
  className?: string;
}) {
  const [simplify, setSimplify] = useState(true);

  useEffect(() => {
    const check = () => setSimplify(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const s = Math.min(Math.max(scrim, 0), 0.9);
  const location = getWorldLocation(locationId);
  if (!location) return null;

  /*
   * Painted art wins when the location has it; otherwise the drawn scene.
   *
   * This is what lets artwork land one location at a time. A location with an
   * `art` entry renders its plates through the single WorldArtScene; one
   * without keeps the CSS/SVG scene it has today, unchanged. There is no flag,
   * no migration state and no moment where half the World is broken — and when
   * the last location gets art, SCENES and this branch delete together.
   */
  const Scene = SCENES[location.id];

  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden="true"
      data-world-location={location.id}
    >
      {location.art ? (
        <WorldArtScene art={location.art} simplify={simplify} />
      ) : (
        <Scene simplify={simplify} />
      )}
      {/*
        Readability scrim, concentrated where the pieces are rather than
        spread flat over everything.

        A flat fill dimmed the horizon, the sky and the landmark just as hard
        as the squares, which is most of why the World read as a muddy border
        instead of a place. This keeps the same protection under the board —
        the ellipse is centred on the board band — and lets the scene keep its
        contrast everywhere the eye is not reading a piece.
      */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 92% 46% at 50% 34%, rgba(8,6,18,${s}) 0%, rgba(8,6,18,${(
            s * 0.72
          ).toFixed(3)}) 52%, rgba(8,6,18,${(s * 0.22).toFixed(3)}) 100%)`,
        }}
      />
    </div>
  );
}

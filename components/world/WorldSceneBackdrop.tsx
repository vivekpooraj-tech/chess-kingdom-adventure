"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { getWorldLocation, type WorldLocationId } from "@/lib/world/locations";

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

  const location = getWorldLocation(locationId);
  if (!location) return null;

  const Scene = SCENES[location.id];

  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden="true"
      data-world-location={location.id}
    >
      <Scene simplify={simplify} />
      <div
        className="absolute inset-0 bg-premium-midnight"
        style={{ opacity: Math.min(Math.max(scrim, 0), 0.9) }}
      />
    </div>
  );
}

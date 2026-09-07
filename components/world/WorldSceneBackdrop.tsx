"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { useWorldLocation } from "@/lib/world/useWorldLocation";
import { LocationBadge, LocationSwitcherChip } from "./LocationBadge";

/**
 * Mounts the active location's scene behind a game screen, or renders nothing.
 *
 * This is the ONE integration point between Chess Mind World and gameplay. A
 * game page adds this component and nothing else: no props to thread, no state
 * to own, no change to how the board, clocks or controls work. Delete the line
 * and the page is exactly what it was before.
 *
 * The scene is `next/dynamic` with `ssr: false`, so neither the component nor
 * its stylesheet is in any bundle a player downloads until they have actually
 * chosen a location. Someone who never opens World pays nothing for it.
 */
const LondonEyeScene = dynamic(
  () => import("./LondonEyeScene").then((m) => m.LondonEyeScene),
  { ssr: false }
);

/** id -> scene. The only place a location id maps to a component. */
const SCENES: Record<string, React.ComponentType> = {
  "london-eye": LondonEyeScene,
};

export function WorldSceneBackdrop() {
  const { location, ready } = useWorldLocation();
  const active = Boolean(ready && location && SCENES[location.id]);

  /**
   * The root flag that lets the scene show through the game shell.
   *
   * ChessFocusLayout owns the board-sizing contract for every board screen and
   * paints an opaque background; it is not modified by this feature. So the
   * shell is made transparent from the outside, exactly the way
   * lib/chessFocus/focusMode.ts already toggles `html.chess-focus-active` —
   * see worldOverlay.module.css.
   *
   * Removed on unmount, so navigating away from a game can never leave a
   * transparent shell behind on a normal page.
   */
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    root.classList.add("cm-world-active");
    return () => root.classList.remove("cm-world-active");
  }, [active]);

  if (!active || !location) return null;

  const Scene = SCENES[location.id];
  return (
    <>
      <Scene />
      <LocationBadge />
      <LocationSwitcherChip />
    </>
  );
}

export default WorldSceneBackdrop;

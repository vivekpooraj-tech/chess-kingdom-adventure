"use client";

import { useEffect } from "react";
import { useWorldLocation } from "@/lib/world/useWorldLocation";
import { LocationBadge, LocationSwitcherChip } from "./LocationBadge";
import { getScene } from "./sceneRegistry";

/**
 * Mounts the active location's scene behind a game screen, or renders nothing.
 *
 * This is the ONE integration point between Chess Mind World and gameplay. A
 * game page adds this component and nothing else: no props to thread, no state
 * to own, no change to how the board, clocks or controls work. Delete the line
 * and the page is exactly what it was before.
 *
 * Scenes are code-split in sceneRegistry, so neither a scene component nor its
 * stylesheet is in any bundle a player downloads until they have actually
 * chosen a location. Someone who never opens World pays nothing for it.
 */
export function WorldSceneBackdrop() {
  const { location, ready } = useWorldLocation();
  const Scene = getScene(location?.id);
  const active = Boolean(ready && location && Scene);

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

    /*
     * The location's own UI tokens, set as custom properties beside the flag.
     *
     * Set here rather than in each scene's stylesheet because the surfaces
     * they colour (.chess-focus-panel and friends) are rendered by the game,
     * outside the scene's subtree. Every rule in worldOverlay.css falls back
     * to London's value, so a location with no theme is unchanged.
     */
    const theme = location?.theme;
    const vars: [string, string | undefined][] = [
      ["--cm-world-glass", theme?.glass],
      ["--cm-world-glass-solid", theme?.glassSolid],
      ["--cm-world-board-shadow", theme?.boardShadow],
    ];
    for (const [name, value] of vars) if (value) root.style.setProperty(name, value);

    return () => {
      root.classList.remove("cm-world-active");
      for (const [name] of vars) root.style.removeProperty(name);
    };
  }, [active, location]);

  if (!active || !location || !Scene) return null;

  return (
    <>
      <Scene />
      <LocationBadge />
      <LocationSwitcherChip />
    </>
  );
}

export default WorldSceneBackdrop;

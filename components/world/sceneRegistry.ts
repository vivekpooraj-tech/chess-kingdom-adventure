"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

/**
 * id -> scene component. The ONE place a location id maps to a component.
 *
 * There used to be two: this map inside WorldSceneBackdrop, and a
 * `location.id === "london-eye"` conditional inside LocationPreview. Two
 * registries meant a new location could render in-game but not on its own
 * preview screen — exactly the kind of half-wired feature that looks finished
 * until someone opens the second page. Adding a location is now one entry
 * here, one registry entry, and one scene file.
 *
 * Every scene is `next/dynamic` with `ssr: false`, so neither the component
 * nor its stylesheet is in any bundle a player downloads until they have
 * actually chosen a location. Someone who never opens World pays nothing.
 */
const SCENES: Record<string, ComponentType> = {
  "london-eye": dynamic(() => import("./LondonEyeScene").then((m) => m.LondonEyeScene), {
    ssr: false,
  }),
  chaturanga: dynamic(() => import("./ChaturangaScene").then((m) => m.ChaturangaScene), {
    ssr: false,
  }),
};

/** The scene for a location, or null for one with no scene built yet. */
export function getScene(locationId: string | null | undefined): ComponentType | null {
  if (!locationId) return null;
  return SCENES[locationId] ?? null;
}

/** Ids that actually have a scene component. Used by tests to prove the
 *  registry and the location catalogue agree with each other. */
export function sceneIds(): string[] {
  return Object.keys(SCENES);
}

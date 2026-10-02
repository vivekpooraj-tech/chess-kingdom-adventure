"use client";

import { createContext, useContext } from "react";
import { DEFAULT_WORLD, type WorldId } from "@/lib/world/worlds";

export const WorldContext = createContext<WorldId>(DEFAULT_WORLD);

/** False until WorldScope has read the real world from `html[data-mode]`
 *  (or was pinned). Server render and first hydration pass are unresolved. */
export const WorldResolvedContext = createContext<boolean>(true);

export function useWorld(): WorldId {
  return useContext(WorldContext);
}

export function useWorldResolved(): boolean {
  return useContext(WorldResolvedContext);
}

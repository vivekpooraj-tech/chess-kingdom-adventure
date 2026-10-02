"use client";

import { useWorld } from "@/lib/world/WorldContext";
import { playArenaTitle } from "./playArena";

export function PlayArenaHeading({ fallback }: { fallback: string }) {
  return <>{playArenaTitle(useWorld(), fallback)}</>;
}

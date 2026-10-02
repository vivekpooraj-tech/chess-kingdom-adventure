"use client";

import { useWorld } from "@/lib/world/WorldContext";
import { puzzleArenaTitle } from "@/lib/puzzles/puzzleArena";

export function PuzzleArenaHeading({ fallback }: { fallback: string }) {
  return <>{puzzleArenaTitle(useWorld(), fallback)}</>;
}

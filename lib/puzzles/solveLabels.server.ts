/**
 * Server-only: turn a solved puzzle id back into something a parent or
 * child can read — its theme/skill name and source library.
 *
 * SERVER ONLY, same reason as tacticsLibrary.server.ts: resolving a tactics
 * id means looking it up in the 1.8MB library, which must never reach the
 * client bundle.
 *
 * Ids are namespaced by which library they came from (see
 * lib/puzzles/tacticsTypes.ts: tactics ids are `lc-<id>`), so a lookup never
 * has to guess or query wrong — content/puzzles.ts (mate library, ids
 * unprefixed) and the tactics library are checked based on that prefix
 * alone, and an id that matches neither returns null rather than a made-up
 * label.
 */
import { getPuzzleById } from "@/content/puzzles";
import { getTacticsLibrary } from "./tacticsLibrary.server";
import { getSkill } from "@/lib/analysis/skills";

export interface SolveLabel {
  /** Human-readable theme/skill name — always real, stored data. */
  theme: string;
  emoji: string;
  library: "mate" | "tactics";
}

let tacticsIndex: Map<string, ReturnType<typeof getTacticsLibrary>[number]> | null = null;
function getTacticsIndex() {
  if (!tacticsIndex) {
    tacticsIndex = new Map(getTacticsLibrary().map((p) => [p.id, p]));
  }
  return tacticsIndex;
}

export function labelForSolvedPuzzle(puzzleId: string): SolveLabel | null {
  if (typeof puzzleId !== "string" || !puzzleId) return null;

  if (puzzleId.startsWith("lc-")) {
    const puzzle = getTacticsIndex().get(puzzleId);
    if (!puzzle) return null;
    const skill = getSkill(puzzle.skill);
    return { theme: skill.name, emoji: skill.emoji, library: "tactics" };
  }

  const puzzle = getPuzzleById(puzzleId);
  if (!puzzle) return null;
  return { theme: puzzle.theme, emoji: "♛", library: "mate" };
}

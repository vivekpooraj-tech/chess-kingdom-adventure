import type { TacticsPuzzle } from "@/lib/puzzles/tacticsTypes";
import type { EngineCategory, Level, TrainExercise } from "../../curriculum";

/**
 * A family is one KIND of exercise (e.g. "Compare candidate moves"). Each puzzle
 * or authored key belongs to at most one family per category, so the same
 * position is never offered as two different exercises in one category.
 */
export interface BuildArgs {
  key: string;
  level: Level;
  /** Present for library-backed families. */
  puzzle?: TacticsPuzzle;
}

export interface FamilyDef {
  id: string;
  category: EngineCategory;
  label: string;
  /** What this trains, in plain words (also shown to the learner). */
  skill: string;
  /**
   * Families that ask the SAME question about a position share a signature. A
   * puzzle is given to at most one family per signature (the first in registry
   * order), so the same question about the same position is never offered twice
   * — not within a category, and not across categories.
   */
  signature?: string;
  /** Library-backed: the level this puzzle serves, or null if it is not eligible. */
  classify?: (puzzle: TacticsPuzzle) => Level | null;
  /** Authored / generated: every key this family can build, with its level. */
  statics?: () => { key: string; level: Level }[];
  /** Build the exercise. Returns null if it fails validation (it is then skipped). */
  build: (args: BuildArgs) => TrainExercise | null;
}

export interface Descriptor {
  /** Stable exercise id, used for per-child history. */
  id: string;
  family: string;
  category: EngineCategory;
  level: Level;
  key: string;
}

export function exerciseId(familyId: string, key: string): string {
  return `x:${familyId}:${key}`;
}

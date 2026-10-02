import type { WorldId } from "@/lib/world/worlds";
import {
  PUZZLE_LEVELS,
  currentPuzzleLevel,
  levelStatus,
  type LevelStatus,
} from "@/lib/puzzles/puzzleLevels";

export function puzzleArenaTitle(world: WorldId, fallback: string): string {
  if (world === "enchanted") return "Puzzle Quest";
  if (world === "atelier") return "Tactical Lab";
  if (world === "classic") return "Chess Study";
  return fallback;
}

export function puzzleNextLabel(world: WorldId): string {
  if (world === "enchanted") return "Continue quest";
  if (world === "atelier") return "Next drill";
  return "Next Position";
}

/** Honest elapsed clock for the current puzzle — never engine time-to-solve. */
export function puzzleElapsed(startedAt?: string): string {
  if (!startedAt) return "—";
  const ms = Date.now() - Date.parse(startedAt);
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * First-try rate for THIS session only. "—" until a puzzle has been solved,
 * so an empty lab never invents an accuracy number.
 */
export function sessionAccuracyLabel(solvedCount: number, firstTrySolves: number): string {
  if (solvedCount <= 0) return "—";
  const n = Math.max(0, Math.min(firstTrySolves, solvedCount));
  return `${Math.round((n / solvedCount) * 100)}%`;
}

export const MASTERY_RAIL = [
  { id: "beginner", label: "Beginner", min: 0 },
  { id: "developing", label: "Developing", min: 11 },
  { id: "advanced", label: "Advanced", min: 31 },
  { id: "mastery", label: "Mastery", min: 101 },
] as const;

function railIdForLevel(levelId: string): (typeof MASTERY_RAIL)[number]["id"] {
  if (levelId === "easy") return "beginner";
  if (levelId === "medium") return "developing";
  if (levelId === "hard" || levelId === "expert") return "advanced";
  return "mastery";
}

export function masteryRailState(solvedCount: number): {
  id: (typeof MASTERY_RAIL)[number]["id"];
  status: LevelStatus;
}[] {
  const here = railIdForLevel(currentPuzzleLevel(solvedCount).id);
  const order = MASTERY_RAIL.map((s) => s.id);
  const hereIdx = order.indexOf(here);
  return MASTERY_RAIL.map((step, i) => ({
    id: step.id,
    status: (i < hereIdx ? "completed" : i === hereIdx ? "current" : "locked") as LevelStatus,
  }));
}

/** Chamber tokens for the quest path — lock state from lifetime solves. */
export function puzzleChambers(solvedCount: number) {
  return PUZZLE_LEVELS.map((level) => ({
    id: level.id,
    label: level.achievement,
    status: levelStatus(level, solvedCount),
  }));
}

export function starsFromAttempt(status: "playing" | "correct" | "incorrect", missCount: number): number {
  if (status !== "correct") return 0;
  if (missCount <= 0) return 3;
  if (missCount === 1) return 2;
  return 1;
}

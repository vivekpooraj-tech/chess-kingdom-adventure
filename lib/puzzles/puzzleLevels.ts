/**
 * Puzzle Tower — the leveling data behind the Puzzles tab's hero screen
 * (components/puzzles/PuzzleTower.tsx), keyed purely off how many puzzles a
 * child has ever solved (lifetime count from puzzle_library_solves, the one
 * table both the mate trainer and the Tactics Trainer write to).
 *
 * Deliberately decorative, not a gate. The Tactics Trainer's real difficulty
 * already comes from tierForLearner() in tacticsLibrary.server.ts — adaptive,
 * server-side, and never shown to the child as a raw label (see the
 * ChessPuzzle.level doc comment in lib/types.ts for the same rule on the
 * mate-trainer side). Nothing in this module changes which puzzles are
 * served or restricts access to any of them; it only decides which floor of
 * the tower is drawn as "you are here" and what the locked floors above it
 * say. Every floor is reachable the instant "Solve a Puzzle" is pressed.
 */
export interface PuzzleLevel {
  id: string;
  label: string;
  rangeLabel: string;
  min: number;
  max: number | null;
  icon: string;
  /** Short line under the level name on its tower floor. */
  tagline: string;
  /** What Ollie says while this is the child's current floor — see the
   * WOW-brief's per-level Ollie copy. Fixed per level (not randomized), so
   * it's identical on every render and carries no hydration risk. */
  ollieLine: string;
  /** A truthful, earned title for reaching this floor — shown once it
   * becomes the child's current or a past level. Never claims anything the
   * solved count doesn't actually support. */
  achievement: string;
}

export const PUZZLE_LEVELS: readonly PuzzleLevel[] = [
  {
    id: "easy",
    label: "Easy",
    rangeLabel: "1 – 10",
    min: 0,
    max: 10,
    icon: "🌟",
    tagline: "Learn to spot ideas",
    ollieLine: "Every master started with one move.",
    achievement: "Puzzle Explorer",
  },
  {
    id: "medium",
    label: "Medium",
    rangeLabel: "11 – 30",
    min: 11,
    max: 30,
    icon: "♟️",
    tagline: "See deeper",
    ollieLine: "You're starting to see patterns!",
    achievement: "Pattern Hunter",
  },
  {
    id: "hard",
    label: "Hard",
    rangeLabel: "31 – 60",
    min: 31,
    max: 60,
    icon: "⚔️",
    tagline: "Calculate carefully",
    ollieLine: "Slow down. Calculate deeper.",
    achievement: "Calculation Climber",
  },
  {
    id: "expert",
    label: "Expert",
    rangeLabel: "61 – 100",
    min: 61,
    max: 100,
    icon: "🧠",
    tagline: "Think like a tactician",
    ollieLine: "Now you're thinking ahead.",
    achievement: "First Tactician",
  },
  {
    id: "master",
    label: "Master",
    rangeLabel: "100+",
    min: 101,
    max: null,
    icon: "👑",
    tagline: "See what others miss",
    ollieLine: "Welcome to the sharpest floor in the tower.",
    achievement: "Tower Master",
  },
];

/** The tower floor a given lifetime solved-count sits on. Always resolves —
 * a negative or absurd count clamps to the nearest real band. */
export function currentPuzzleLevel(solvedCount: number): PuzzleLevel {
  const count = Math.max(0, solvedCount);
  return (
    PUZZLE_LEVELS.find((l) => count >= l.min && (l.max === null || count <= l.max)) ??
    PUZZLE_LEVELS[PUZZLE_LEVELS.length - 1]
  );
}

export type LevelStatus = "completed" | "current" | "locked";

/** How a given floor relates to the child's real progress — drives the
 * ✅ / 📍 / 🔒 treatment on the tower without re-deriving the comparison at
 * every call site. */
export function levelStatus(level: PuzzleLevel, solvedCount: number): LevelStatus {
  const current = currentPuzzleLevel(solvedCount);
  if (level.id === current.id) return "current";
  return level.min < current.min ? "completed" : "locked";
}

/** Puzzles still needed to reach a locked floor; 0 or negative means it's
 * already reachable (current or completed). Used for "N more to unlock". */
export function puzzlesUntilLevel(level: PuzzleLevel, solvedCount: number): number {
  return Math.max(0, level.min - Math.max(0, solvedCount));
}

/** The next floor up from the child's current one, or null once they've
 * reached Master — there is nothing left to unlock. */
export function nextPuzzleLevel(solvedCount: number): PuzzleLevel | null {
  const current = currentPuzzleLevel(solvedCount);
  const idx = PUZZLE_LEVELS.findIndex((l) => l.id === current.id);
  return PUZZLE_LEVELS[idx + 1] ?? null;
}

/** Progress toward the milestone gauge, capped at 100 — matches the "X / 100
 * puzzles solved" framing regardless of how far past Master a child gets. */
export function puzzleGaugeProgress(solvedCount: number): { solved: number; cap: number } {
  return { solved: Math.min(Math.max(0, solvedCount), 100), cap: 100 };
}

/**
 * Rotating header copy — deterministic on the solved count (never
 * Math.random or Date.now), so server- and client-computed values can never
 * disagree and a screenshot/test always sees the same line for the same
 * progress. Cycles rather than repeats the same message every visit.
 */
const MOTIVATIONAL_LINES: readonly string[] = [
  "Every move makes you sharper.",
  "Spot the idea. Find the move.",
  "Small puzzles. Big thinking.",
  "One good move at a time.",
  "Sharper eyes, stronger games.",
];

export function motivationalLine(solvedCount: number): string {
  const i = Math.max(0, solvedCount) % MOTIVATIONAL_LINES.length;
  return MOTIVATIONAL_LINES[i];
}

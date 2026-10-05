/**
 * Train Your Chess Mind — shared curriculum vocabulary (client-safe: types and
 * constants only, no chess engine, no puzzle library).
 *
 * LEARN -> TRAIN -> CHALLENGE -> MASTER is expressed as five internal levels per
 * category. Level comes from genuine cognitive complexity (line length, number of
 * candidate ideas, subtlety of the motif, how much must be held in the mind), not
 * from timers or cosmetics.
 */

export const LEVELS = [1, 2, 3, 4, 5] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_NAMES: Record<Level, string> = {
  1: "Foundation",
  2: "Developing",
  3: "Intermediate",
  4: "Advanced",
  5: "Master",
};

/** Free accounts train Foundation + Developing; Premium unlocks the full ladder. */
export const FREE_MAX_LEVEL: Level = 2;

export const TRAIN_CATEGORIES = [
  "pattern",
  "visualization",
  "calculation",
  "memory",
  "spatial",
  "mathematics",
  "reaction",
] as const;
export type TrainCategory = (typeof TRAIN_CATEGORIES)[number];

/** Every category is served by the shared exercise engine (/api/chess-mind/train).
 *  Reaction adds speed/consistency tracking on top, in its own trainer UI. */
export type EngineCategory = TrainCategory;

export function isTrainCategory(v: unknown): v is TrainCategory {
  return typeof v === "string" && (TRAIN_CATEGORIES as readonly string[]).includes(v);
}

export function isEngineCategory(v: unknown): v is EngineCategory {
  return isTrainCategory(v);
}

export function clampLevel(n: number): Level {
  const r = Math.round(n);
  return (r < 1 ? 1 : r > 5 ? 5 : r) as Level;
}

export function isLevelAllowed(level: Level, isPremium: boolean): boolean {
  return isPremium || level <= FREE_MAX_LEVEL;
}

/** Puzzle rating -> level band. Shared by every family that draws on the
 *  tactics library so "Foundation" means the same difficulty everywhere. */
export function ratingToLevel(rating: number): Level {
  if (rating < 1000) return 1;
  if (rating < 1350) return 2;
  if (rating < 1650) return 3;
  if (rating < 1900) return 4;
  return 5;
}

// ---------------------------------------------------------------------------
// Wire shapes. Sent to the client by /api/chess-mind/train.
// ---------------------------------------------------------------------------

export interface ExerciseExplanation {
  /** Shown after a correct answer: reinforces WHAT the learner noticed. */
  correct: string;
  /** Shown after a wrong answer: teaches why, without being unkind. */
  incorrect: string;
}

interface ExerciseBase {
  /** Stable, deterministic id used for per-child history. */
  id: string;
  category: EngineCategory;
  family: string;
  familyLabel: string;
  level: Level;
  /** The cognitive/chess skill this exercise trains, in plain words. */
  skill: string;
  prompt: string;
  explanation: ExerciseExplanation;
  /** Which side the board is drawn from. */
  orientation: "w" | "b";
}

/** Memory/visualization stage: show the board, then hide it. */
export interface BlindSpec {
  /** Seconds the position is shown before being hidden. */
  showSeconds: number;
  /** Optional board to show alongside the question (e.g. "a piece was removed"). */
  questionFen?: string;
  /** Optional text shown during the reveal (e.g. a move sequence to remember). */
  revealNote?: string;
}

export interface ChoiceExercise extends ExerciseBase {
  kind: "choice";
  fen: string;
  /** Squares to emphasise on the board (e.g. the two pieces being compared). */
  highlight?: string[];
  choices: string[];
  correctIndex: number;
  blind?: BlindSpec;
}

export interface MoveStep {
  from: string;
  to: string;
  promotion?: string;
  /** Other moves that satisfy this step equally (e.g. a second knight fork). */
  alts?: { from: string; to: string; promotion?: string }[];
  /** Scripted opponent reply played automatically after this step. */
  reply?: { from: string; to: string; promotion?: string };
}

/** The learner plays the move(s) on the board. */
export interface MoveExercise extends ExerciseBase {
  kind: "move";
  fen: string;
  steps: MoveStep[];
  /** On the final step, any checkmating move is accepted. */
  finalStepAcceptsAnyMate: boolean;
}

export type TrainExercise = ChoiceExercise | MoveExercise;

export interface TrainResponse {
  exercise: TrainExercise | null;
  /** Set when a FREE child has used today's 3 completed exercises IN THIS CATEGORY. No
   *  exercise content is sent. Enforced server-side. */
  dailyLimit?: { used: number; limit: number };
  /** Set when the requested level needs Premium; no exercise content is sent. */
  locked?: { level: Level; levelName: string; reason: "premium" };
  /** The level actually served (always <= the requested level when clamped). */
  servedLevel?: Level;
}

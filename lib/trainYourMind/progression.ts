import { LEVEL_NAMES, FREE_MAX_LEVEL, type Level, type TrainCategory } from "./curriculum";

/**
 * Deterministic, explainable progression for Train Your Chess Mind.
 *
 * No machine learning, no hidden scores. Every rule below is a plain sentence a
 * parent could read, and every decision returns the reason it was made.
 *
 *  LEVEL UP     5+ attempts at the level, accuracy >= 80% (unassisted answers only),
 *               and the learner is not hopelessly slow (see SPEED).
 *  LEVEL DOWN   3 of the last 4 attempts wrong -> step down one level to reinforce.
 *  REINFORCE    3 wrong in a row in the same exercise family -> serve an easier
 *               exercise of that family next.
 *  SPEED        accurate but slow (median correct time > 2x the level's target):
 *               stay at the level and train speed; after 10 attempts progress anyway.
 *  MASTERED     Master level, 8+ of the last 10 answered correctly without help.
 *
 * "Assisted" means the learner used the Show-board help. Assisted answers are
 * recorded and taught from, but never count towards promotion or mastery.
 * A fast wrong answer is never treated as mastery: time only matters when the
 * answer is correct.
 */

export interface Attempt {
  correct: boolean;
  ms: number;
  assisted: boolean;
  family: string;
  level: Level;
  /** Target seconds for a correct answer at this level (Reaction uses shorter targets). */
  targetSeconds?: number;
}

export interface FamilyStat {
  attempts: number;
  correct: number;
}

export interface ProgressState {
  level: Level;
  bestLevel: Level;
  attempts: number;
  correct: number;
  /** Most recent attempts at the CURRENT level (reset on a level change). */
  window: { c: 0 | 1; ms: number; a: 0 | 1; f: string }[];
  /** Last results across levels, for mastery (newest last, max 10). */
  lastTen: (0 | 1)[];
  familyStats: Record<string, FamilyStat>;
  /** A family to reinforce with an easier exercise next, if any. */
  reinforce: string | null;
  mastered: boolean;
}

export type ProgressEvent =
  | { kind: "none" }
  | { kind: "level-up"; to: Level; message: string }
  | { kind: "level-down"; to: Level; message: string }
  | { kind: "premium-cap"; message: string }
  | { kind: "speed"; message: string }
  | { kind: "reinforce"; family: string; message: string }
  | { kind: "mastered"; message: string };

const WINDOW_MAX = 10;
const MAX_FAMILIES = 40;

/** Seconds a learner should reasonably need for a correct answer, per level. */
export const TARGET_SECONDS: Record<Level, number> = { 1: 20, 2: 30, 3: 45, 4: 70, 5: 100 };

/** Reaction is a speed-and-accuracy trainer, so its targets are much shorter. */
export const REACTION_TARGET_SECONDS: Record<Level, number> = { 1: 10, 2: 10, 3: 12, 4: 15, 5: 20 };

export function initialProgress(): ProgressState {
  return {
    level: 1,
    bestLevel: 1,
    attempts: 0,
    correct: 0,
    window: [],
    lastTen: [],
    familyStats: {},
    reinforce: null,
    mastered: false,
  };
}

export function maxLevelFor(isPremium: boolean): Level {
  return isPremium ? 5 : FREE_MAX_LEVEL;
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Progress towards the next level, as "x of y", for the UI. */
export function levelProgress(state: ProgressState): { have: number; need: number } {
  const need = 5;
  const have = Math.min(need, state.window.filter((w) => w.c === 1 && w.a === 0).length);
  return { have, need };
}

export function applyAttempt(prev: ProgressState, attempt: Attempt, isPremium: boolean): { state: ProgressState; event: ProgressEvent } {
  const state: ProgressState = {
    ...prev,
    attempts: prev.attempts + 1,
    correct: prev.correct + (attempt.correct && !attempt.assisted ? 1 : 0),
    window: [
      ...prev.window,
      { c: (attempt.correct ? 1 : 0) as 0 | 1, ms: Math.max(0, Math.round(attempt.ms)), a: (attempt.assisted ? 1 : 0) as 0 | 1, f: attempt.family },
    ].slice(-WINDOW_MAX),
    lastTen: [...prev.lastTen, attempt.correct && !attempt.assisted ? (1 as const) : (0 as const)].slice(-10),
    familyStats: { ...prev.familyStats },
    reinforce: prev.reinforce,
  };

  // Family stats (bounded).
  const fs = state.familyStats[attempt.family] ?? { attempts: 0, correct: 0 };
  state.familyStats[attempt.family] = { attempts: fs.attempts + 1, correct: fs.correct + (attempt.correct && !attempt.assisted ? 1 : 0) };
  const keys = Object.keys(state.familyStats);
  if (keys.length > MAX_FAMILIES) delete state.familyStats[keys[0]];

  // Reinforcement: 3 wrong in a row in the same family.
  const lastThree = state.window.slice(-3);
  if (!attempt.correct && lastThree.length === 3 && lastThree.every((w) => w.c === 0 && w.f === attempt.family)) {
    state.reinforce = attempt.family;
  } else if (attempt.correct && state.reinforce === attempt.family) {
    state.reinforce = null;
  }

  let event: ProgressEvent = { kind: "none" };
  if (state.reinforce && state.reinforce === attempt.family && !attempt.correct && lastThree.length === 3) {
    event = { kind: "reinforce", family: attempt.family, message: "Let's reinforce this skill with an easier one." };
  }

  // Level down: 3 of the last 4 wrong at this level.
  const lastFour = state.window.slice(-4);
  if (lastFour.length === 4 && lastFour.filter((w) => w.c === 0).length >= 3 && state.level > 1) {
    const to = (state.level - 1) as Level;
    return {
      state: { ...state, level: to, window: [], reinforce: null },
      event: { kind: "level-down", to, message: `Let's build ${LEVEL_NAMES[to]} skills first — a stronger base makes the next level easier.` },
    };
  }

  // Level up.
  const clean = state.window.filter((w) => w.c === 1 && w.a === 0);
  const accuracy = state.window.length ? clean.length / state.window.length : 0;
  const enough = state.window.length >= 5 && clean.length >= 4 && accuracy >= 0.8;
  if (enough && state.level < 5) {
    const target = attempt.targetSeconds ?? TARGET_SECONDS[state.level];
    const slow = median(clean.map((w) => w.ms)) > target * 1000 * 2;
    if (slow && state.window.length < 10) {
      return {
        state,
        event: { kind: "speed", message: "Accurate! Now try to get faster before moving up — speed comes with practice." },
      };
    }
    if (state.level >= maxLevelFor(isPremium)) {
      return {
        state,
        event: { kind: "premium-cap", message: `You're ready for ${LEVEL_NAMES[(state.level + 1) as Level]} — unlock the full ladder with Premium.` },
      };
    }
    const to = (state.level + 1) as Level;
    return {
      state: { ...state, level: to, bestLevel: Math.max(state.bestLevel, to) as Level, window: [] },
      event: { kind: "level-up", to, message: `Level up! You're now training at ${LEVEL_NAMES[to]}.` },
    };
  }

  // Mastery at the top level.
  if (state.level === 5 && !state.mastered && state.lastTen.length === 10 && state.lastTen.reduce<number>((a, b) => a + b, 0) >= 8) {
    return { state: { ...state, mastered: true }, event: { kind: "mastered", message: "Master level achieved — outstanding." } };
  }

  return { state, event };
}

/** The level to ask the server for, honouring entitlement. */
export function levelToServe(state: ProgressState, isPremium: boolean): Level {
  return Math.min(state.level, maxLevelFor(isPremium)) as Level;
}

/** Plain-language status for a category tile. */
export function statusLabel(state: ProgressState | null, category: TrainCategory): string {
  void category;
  if (!state || state.attempts === 0) return "Not started";
  if (state.mastered) return "Mastered";
  return LEVEL_NAMES[state.level];
}

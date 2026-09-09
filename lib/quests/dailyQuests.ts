/**
 * Daily Quests — three small, healthy goals for today.
 *
 * DESIGN DECISION (Phase: Daily Quests v1): quests are DERIVED, never stored.
 *
 * There is no `daily_quests` table and no quest-progress write path. A quest's
 * progress is counted, at read time, from activity rows the app already writes
 * for its own reasons:
 *
 *   puzzle -> puzzle_library_solves        (0029)
 *   play   -> child_game_reviews           (0033)
 *   learn  -> child_lesson_progress (0001) + child_academy_progress (0010)
 *
 * puzzle_library_solves alone covers the puzzle quest because it already
 * records solves from BOTH the Puzzle Trainer and the Daily Challenge
 * (source in ('trainer','daily')), deduplicated per (child, puzzle) — that
 * de-duplication is the reason 0029 exists. Counting daily_challenge_history
 * on top of it would double-count the Daily Challenge every morning.
 *
 * That choice is what makes the rest of this file's guarantees cheap:
 *
 *   * The client can never claim completion — there is nothing to claim
 *     against. Progress is whatever the activity tables say, under the RLS
 *     those tables already enforce (parent -> own children only).
 *   * Duplicate completion records are impossible — no records exist.
 *   * Date rollover is automatic: "today" is a query bound, not stored state.
 *   * Generation is idempotent because it is a pure function of
 *     (childId, date, experience level) — see selectDailyQuests().
 *   * No migration is required, so nothing here depends on a schema change
 *     that could not be applied or verified from this environment.
 *
 * Deliberately NOT used as sources, after checking:
 *   * free_game_usage (0019) — consume_free_game_credit() returns early for
 *     premium children WITHOUT inserting a row, so a Play quest keyed off it
 *     would sit at 0/1 forever for exactly the paying users. Verified in
 *     supabase/migrations/0019_daily_free_game_limits.sql.
 *   * child_chess_mind_activity (0014) — unique per (child, date, module), so
 *     it can answer "practised today?" but never "how many", and the streak
 *     already owns it.
 */
import {
  effectiveExperienceLevel,
  prefersNeutralHomeTone,
  type ExperienceLevel,
  type AgeBand,
} from "@/lib/learner/experienceLevel";

export type QuestKind = "puzzle" | "play" | "learn";

/**
 * Today's counts, one field per quest source.
 *
 * `null` means "this source could not be read" (missing table, permission
 * error, network failure) — NOT "zero". The two must stay distinguishable:
 * a failed read renders no quest at all, rather than a confident 0/3 that
 * would be fake progress in the pessimistic direction. See buildDailyQuests().
 */
export interface DailyQuestActivity {
  puzzlesSolved: number | null;
  gamesPlayed: number | null;
  learningCompleted: number | null;
}

export interface DailyQuest {
  /** Stable for the whole day: `${date}:${kind}`. Safe as a React key. */
  id: string;
  kind: QuestKind;
  icon: string;
  title: string;
  /** How many of the thing today. Always >= 1. */
  target: number;
  /** Capped at `target` — what the progress bar and "n / m" label use. */
  progress: number;
  /** Uncapped real count. Kept so extra activity is never silently rewritten. */
  rawProgress: number;
  complete: boolean;
}

export interface DailyQuestSet {
  date: string;
  quests: DailyQuest[];
  completedCount: number;
  allComplete: boolean;
}

export interface DailyQuestParams {
  childId: string;
  date: string;
  experienceLevel: ExperienceLevel | null | undefined;
  ageBand: AgeBand | null | undefined;
  activity: DailyQuestActivity;
}

/**
 * Daily targets by experience level.
 *
 * Every number here is deliberately small and FIXED. Quest targets never
 * scale with how much someone already played today, because "do more than
 * yesterday" is the grinding treadmill this system is explicitly not allowed
 * to become. A child who plays a lot and a child who plays a little get the
 * same reachable set, and both are done for the day once they finish it.
 */
const TARGETS: Record<ExperienceLevel, Record<QuestKind, number>> = {
  new: { puzzle: 2, play: 1, learn: 1 },
  knows_basics: { puzzle: 3, play: 1, learn: 1 },
  plays_regularly: { puzzle: 4, play: 1, learn: 1 },
};

/**
 * Copy comes in two registers, picked by the same prefersNeutralHomeTone()
 * that already decides Home's greeting — so an adult never gets told to "warm
 * up their mind" and a seven-year-old never gets a bare task list. Several
 * phrasings per register, rotated by date so the card is not word-for-word
 * identical every morning; the OBJECTIVE never changes with the wording.
 */
const WARM_TITLES: Record<QuestKind, string[]> = {
  puzzle: ["Warm up your mind", "Sharpen your eye", "Spot the winning move"],
  play: ["Play a thoughtful game", "Take on a game today", "Play a full game"],
  learn: ["Learn something new", "Discover an idea", "Add to what you know"],
};

const NEUTRAL_TITLES: Record<QuestKind, string[]> = {
  puzzle: ["Solve puzzles", "Tactics practice", "Puzzle set"],
  play: ["Play a game", "Complete a game", "Play a rated or casual game"],
  learn: ["Complete a lesson", "Finish a learning activity", "Study a concept"],
};

const ICONS: Record<QuestKind, string> = {
  puzzle: "\u{1F9E9}", // 🧩
  play: "♟️", // ♟️
  learn: "\u{1F9E0}", // 🧠
};

/** Order is fixed so the card never reshuffles under the user mid-day. */
const KINDS: QuestKind[] = ["puzzle", "play", "learn"];

/**
 * Small deterministic string hash (FNV-1a, 32-bit). Used only to rotate COPY,
 * never to pick objectives or rewards — there is deliberately no randomness
 * anywhere in this system that could read as a slot machine.
 */
export function questSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function titleFor(kind: QuestKind, neutral: boolean, seed: number, target: number): string {
  const pool = neutral ? NEUTRAL_TITLES[kind] : WARM_TITLES[kind];
  const base = pool[seed % pool.length];
  // Only the puzzle quest has a target worth naming inline; "Play a game x1"
  // reads like a checklist, "Solve 3 puzzles" reads like a goal.
  if (kind === "puzzle") return neutral ? `Solve ${target} puzzles` : `${base} — solve ${target} puzzles`;
  return base;
}

/** Clamp a raw count to a sane non-negative integer. */
function normalizeCount(value: number | null): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.floor(value));
}

function rawFor(kind: QuestKind, activity: DailyQuestActivity): number | null {
  switch (kind) {
    case "puzzle":
      return normalizeCount(activity.puzzlesSolved);
    case "play":
      return normalizeCount(activity.gamesPlayed);
    case "learn":
      return normalizeCount(activity.learningCompleted);
  }
}

/**
 * Build today's quest set.
 *
 * Pure and total: same inputs -> same output, no I/O, no clock read (the date
 * is passed in). That is what lets scripts/test-daily-quests.js verify
 * generation, idempotency, rollover and completion without any database.
 *
 * A quest whose source returned `null` is omitted entirely — see
 * DailyQuestActivity. Everything else always yields exactly three quests.
 */
export function selectDailyQuests(params: DailyQuestParams): DailyQuestSet {
  const { childId, date, experienceLevel, ageBand, activity } = params;
  const level = effectiveExperienceLevel(experienceLevel);
  const neutral = prefersNeutralHomeTone(experienceLevel, ageBand);
  // childId participates so two children on one device don't read identically;
  // date participates so the wording refreshes daily. Both are stable inputs,
  // so the same child sees the same words all day.
  const seed = questSeed(`${childId}:${date}`);

  const quests: DailyQuest[] = [];
  for (const kind of KINDS) {
    const raw = rawFor(kind, activity);
    if (raw === null) continue; // unreadable source -> show nothing, not 0

    const target = TARGETS[level][kind];
    const progress = Math.min(raw, target);
    quests.push({
      id: `${date}:${kind}`,
      kind,
      icon: ICONS[kind],
      title: titleFor(kind, neutral, seed, target),
      target,
      progress,
      rawProgress: raw,
      complete: raw >= target,
    });
  }

  const completedCount = quests.filter((q) => q.complete).length;
  return {
    date,
    quests,
    completedCount,
    // An empty set is not "all complete" — nothing was measured.
    allComplete: quests.length > 0 && completedCount === quests.length,
  };
}

/**
 * The one line shown under the quest list.
 *
 * Never scolds, never mentions a lost streak, never counts down a deadline.
 * Missing a day costs nothing here by construction: quests are derived per
 * date, so yesterday's unfinished set simply stops being asked about.
 */
export function questSummaryLine(set: DailyQuestSet, neutral: boolean): string {
  if (set.quests.length === 0) return "";
  if (set.allComplete) {
    return neutral ? "All done for today." : "All done for today — brilliant work!";
  }
  const remaining = set.quests.length - set.completedCount;
  if (set.completedCount === 0) {
    return neutral ? `${set.quests.length} to go today.` : "Pick whichever one looks fun.";
  }
  return neutral
    ? `${set.completedCount} of ${set.quests.length} done — ${remaining} to go.`
    : `${set.completedCount} done, ${remaining} to go. Nice going!`;
}

/** Where each quest sends the user when tapped. */
export function questHref(kind: QuestKind): string {
  switch (kind) {
    case "puzzle":
      return "/puzzles";
    case "play":
      return "/play";
    case "learn":
      return "/learn";
  }
}

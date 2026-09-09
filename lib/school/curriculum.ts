/**
 * Chess School curriculum — the five stages of "Speak Chess in 30 Days".
 *
 * WHAT THIS IS.
 *
 * content/lessons.ts holds 30 real lessons, each tagged with the skills it
 * teaches. content/kingdomZones.ts groups those days into six *story* zones
 * (Pawn Village, Knight Forest, ...) which drive free-lesson gating. Neither
 * says what a learner actually LEARNS across the course — a parent looking at
 * "Bishop Temple" cannot tell whether their child is on tactics or endgames.
 *
 * This module adds that one missing view: a curriculum stage per day, derived
 * from the skill tags the lessons already carry. It creates no lessons, no
 * second course, no new progress storage and no new gating. Kingdom zones are
 * untouched and still own free-lesson access.
 *
 * HOW A DAY IS CLASSIFIED.
 *
 * Every skill tag in the course belongs to exactly one stage (TAG_STAGE), and
 * a day is placed in the most advanced stage any of its tags belongs to. So
 * Day 7 "The Knight's Fork Academy" — tagged knight_movement AND fork_pattern
 * — is Tactics, not Foundations: the movement tag is the prerequisite, the
 * fork tag is the lesson.
 *
 * A handful of days are tagged more thinly than they are taught (Day 27 "The
 * Brave Endgame King" carries only king_movement + king_safety, which would
 * read as Foundations). Those carry an explicit, listed override. Overrides
 * are editorial judgement about real lessons, not invented content, and the
 * tests assert every one of them points at a day that exists.
 *
 * Pure — LESSONS in, stages out. No database, no clock, no randomness.
 */
import { LESSONS } from "@/content/lessons";
import type { Lesson } from "@/lib/types";

export type StageId = "foundations" | "tactics" | "strategy" | "endgames" | "final";

export interface CurriculumStage {
  id: StageId;
  name: string;
  emoji: string;
  /** One line a parent or learner can read without knowing chess. */
  blurb: string;
}

/**
 * Ordered easiest to hardest. The order is the teaching order of the ideas,
 * not the day order — days interleave (Day 15 teaches promotion, Day 16 goes
 * back to pawn structure), which is deliberate spaced practice and is exactly
 * why a stage view has to be computed rather than sliced off day ranges.
 */
export const CURRICULUM_STAGES: readonly CurriculumStage[] = [
  {
    id: "foundations",
    name: "Learn the Board",
    emoji: "♟",
    blurb: "The board, every piece, how each one moves, and keeping your king safe.",
  },
  {
    id: "tactics",
    name: "Tactics",
    emoji: "♞",
    blurb: "Forks, pins, skewers, back-rank mates — the patterns that win material.",
  },
  {
    id: "strategy",
    name: "Strategy",
    emoji: "♜",
    blurb: "Openings, outposts, open files and pawn structure — how to form a plan.",
  },
  {
    id: "endgames",
    name: "Endgames",
    emoji: "♛",
    blurb: "Promotion, king activity and converting an advantage into a win.",
  },
  {
    id: "final",
    name: "Final Challenge",
    emoji: "\u{1F3C6}",
    blurb: "Everything together, in one last battle.",
  },
];

/** Rank = position in CURRICULUM_STAGES. Higher wins when a day has several. */
const STAGE_RANK: Record<StageId, number> = CURRICULUM_STAGES.reduce(
  (acc, stage, index) => ({ ...acc, [stage.id]: index }),
  {} as Record<StageId, number>
);

/**
 * Every skill tag used by content/lessons.ts, mapped to the stage it belongs
 * to. A tag missing from here is a content change that outgrew this map — the
 * tests fail loudly rather than letting the day fall silently into
 * Foundations, which is the failure mode that would quietly mis-describe the
 * course to a parent.
 */
const TAG_STAGE: Record<string, StageId> = {
  // Foundations — what a piece is and how it moves.
  pawn_movement: "foundations",
  pawn_capture: "foundations",
  knight_movement: "foundations",
  bishop_movement: "foundations",
  rook_movement: "foundations",
  queen_movement: "foundations",
  king_movement: "foundations",
  king_safety: "foundations",
  // Tactics — a concrete pattern that wins something.
  fork_pattern: "tactics",
  pin_pattern: "tactics",
  back_rank_mate: "tactics",
  queen_king_mate: "tactics",
  tactics_mixed: "tactics",
  // Strategy — position, plans, structure.
  opening_principles: "strategy",
  knight_outpost: "strategy",
  bishop_pair: "strategy",
  open_file: "strategy",
  pawn_structure: "strategy",
  rook_doubling: "strategy",
  queen_safety: "strategy",
  // Endgames — few pieces, one goal.
  promotion: "endgames",
  basic_endgames: "endgames",
};

/**
 * Days whose tags under-describe what the lesson actually teaches. Each is
 * listed with the reason, because an unexplained override is indistinguishable
 * from a mistake.
 */
const STAGE_OVERRIDES: Record<number, { stage: StageId; because: string }> = {
  // "The King and Rook's Endgame Dance" — tagged back_rank_mate (a tactic),
  // but it is the king-and-rook mating technique, which is an endgame.
  21: { stage: "endgames", because: "king + rook mating technique" },
  // "Knight versus Bishop" — tagged with both movement tags, but the lesson is
  // about which minor piece suits which position.
  23: { stage: "strategy", because: "minor piece comparison, not movement" },
  // "The Long Diagonal Watchtower" — tagged bishop_movement, but it teaches
  // long-diagonal control.
  24: { stage: "strategy", because: "long-diagonal control, not movement" },
  // "The Brave Endgame King" — tagged king_movement + king_safety, but it is
  // the activated endgame king.
  27: { stage: "endgames", because: "the king as an endgame attacker" },
};

/** The final day is the final challenge, whatever it is tagged with. */
function isFinalDay(dayNumber: number, totalDays: number): boolean {
  return totalDays > 0 && dayNumber === totalDays;
}

/**
 * The stage a single day belongs to. Exported so a lesson page can label
 * itself without recomputing the whole course.
 */
export function stageForDay(
  dayNumber: number,
  lessons: readonly Lesson[] = LESSONS
): StageId {
  if (isFinalDay(dayNumber, lessons.length)) return "final";

  const override = STAGE_OVERRIDES[dayNumber];
  if (override) return override.stage;

  const lesson = lessons.find((l) => l.dayNumber === dayNumber);
  if (!lesson) return "foundations";

  let best: StageId = "foundations";
  for (const tag of lesson.skillTags ?? []) {
    const stage = TAG_STAGE[tag];
    if (stage && STAGE_RANK[stage] > STAGE_RANK[best]) best = stage;
  }
  return best;
}

export interface StageProgress extends CurriculumStage {
  /** Day numbers in this stage, ascending. Never empty in the returned list. */
  days: number[];
  /** How many of those days the learner has completed. */
  completedCount: number;
  /** 0-100, rounded. */
  percentComplete: number;
  isComplete: boolean;
  /** True when the learner's current day falls in this stage. */
  isCurrent: boolean;
  /** The first day of this stage the learner has NOT completed, or null. */
  nextDay: number | null;
}

/**
 * The whole course, grouped into stages, with real per-stage progress.
 *
 * Stages with no days are dropped rather than shown at 0/0 — an empty
 * "Endgames" row would describe a course that does not exist.
 */
export function courseJourney(input: {
  currentDay: number;
  completedDays: readonly number[];
  lessons?: readonly Lesson[];
}): StageProgress[] {
  const lessons = input.lessons ?? LESSONS;
  const completed = new Set<number>();
  for (const raw of input.completedDays ?? []) {
    if (Number.isFinite(raw)) completed.add(Math.floor(raw));
  }

  const byStage = new Map<StageId, number[]>();
  for (const lesson of lessons) {
    const stage = stageForDay(lesson.dayNumber, lessons);
    const days = byStage.get(stage) ?? [];
    days.push(lesson.dayNumber);
    byStage.set(stage, days);
  }

  const out: StageProgress[] = [];
  for (const stage of CURRICULUM_STAGES) {
    const days = (byStage.get(stage.id) ?? []).slice().sort((a, b) => a - b);
    if (days.length === 0) continue;

    const completedCount = days.filter((d) => completed.has(d)).length;
    out.push({
      ...stage,
      days,
      completedCount,
      percentComplete: Math.round((completedCount / days.length) * 100),
      isComplete: completedCount === days.length,
      isCurrent: days.includes(input.currentDay),
      nextDay: days.find((d) => !completed.has(d)) ?? null,
    });
  }
  return out;
}

/**
 * The skills a learner has actually finished, for the graduation screen.
 *
 * Derived from completed days only — a skill appears because the day that
 * teaches it is done, never because the learner reached the end. Returned as
 * readable labels, deduplicated, in course order.
 */
const TAG_LABEL: Record<string, string> = {
  pawn_movement: "Pawn movement",
  pawn_capture: "Pawn captures",
  knight_movement: "Knight movement",
  bishop_movement: "Bishop movement",
  rook_movement: "Rook movement",
  queen_movement: "Queen movement",
  king_movement: "King movement",
  king_safety: "King safety",
  fork_pattern: "Forks",
  pin_pattern: "Pins & skewers",
  back_rank_mate: "Back-rank mate",
  queen_king_mate: "Queen & king mate",
  tactics_mixed: "Mixed tactics",
  opening_principles: "Opening principles",
  knight_outpost: "Knight outposts",
  bishop_pair: "The bishop pair",
  open_file: "Open files",
  pawn_structure: "Pawn structure",
  rook_doubling: "Doubled rooks",
  queen_safety: "Queen safety",
  promotion: "Promotion",
  basic_endgames: "Basic endgames",
};

export function skillsLearned(
  completedDays: readonly number[],
  lessons: readonly Lesson[] = LESSONS
): string[] {
  const done = new Set<number>();
  for (const raw of completedDays ?? []) {
    if (Number.isFinite(raw)) done.add(Math.floor(raw));
  }

  const labels: string[] = [];
  const seen = new Set<string>();
  for (const lesson of [...lessons].sort((a, b) => a.dayNumber - b.dayNumber)) {
    if (!done.has(lesson.dayNumber)) continue;
    for (const tag of lesson.skillTags ?? []) {
      const label = TAG_LABEL[tag];
      if (label && !seen.has(label)) {
        seen.add(label);
        labels.push(label);
      }
    }
  }
  return labels;
}

/** Every tag the map knows about — exported so tests can prove the map covers
 *  content/lessons.ts exactly, with nothing missing and nothing stale. */
export const KNOWN_SKILL_TAGS = Object.keys(TAG_STAGE);
export const STAGE_OVERRIDE_DAYS = Object.keys(STAGE_OVERRIDES).map(Number);

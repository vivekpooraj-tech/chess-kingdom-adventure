/**
 * Chess School — "Speak Chess in 30 Days".
 *
 * WHAT THIS IS, AND WHAT IT DELIBERATELY IS NOT.
 *
 * The 30-day course already exists. content/lessons.ts holds exactly 30
 * day-numbered lessons running pieces -> tactics -> strategy -> endgames ->
 * a final challenge, each with a seven-step flow, and real progress is
 * already tracked by children.current_day plus child_lesson_progress rows.
 * content/kingdomZones.ts already groups those 30 days into six named stages
 * with per-stage free-lesson gating.
 *
 * So this module adds NO second course, NO parallel lesson list, NO new
 * stage taxonomy and NO new progress storage. Building any of those would
 * duplicate a working system and split one child's progress across two
 * sources of truth.
 *
 * What was genuinely missing is framing. The course was presented as an
 * open-ended story quest — "Your Kingdom Journey" — and never told anyone
 * they were on day 12 of a 30-day course with 18 to go. This computes that
 * framing from the data that already exists, and nothing else.
 *
 * Pure: every input is a parameter, so all of it is testable without a
 * database (see scripts/test-chess-school.js).
 */
import { LESSONS } from "@/content/lessons";

export const COURSE_NAME = "Chess School";
export const COURSE_TITLE = "Speak Chess in 30 Days";
export const COURSE_TAGLINE = "Learn chess by playing, thinking and practicing.";

/** The course length is whatever content/lessons.ts actually holds — never a
 *  hardcoded 30, so the label can't drift from the real lesson list. */
export const TOTAL_DAYS = LESSONS.length;

export interface ChessSchoolInput {
  /** children.current_day — the day the child is currently on. */
  currentDay: number;
  /** Day numbers with a completed child_lesson_progress row. */
  completedDays: readonly number[];
  /** Defaults to the real lesson count; a parameter so tests can vary it. */
  totalDays?: number;
}

export interface ChessSchoolProgress {
  /** Clamped into [1, totalDays]. The day "Continue" opens. */
  currentDay: number;
  totalDays: number;
  /** Distinct, in-range completed days. Never exceeds totalDays. */
  completedCount: number;
  /** 0-100, rounded. 0 when the course is empty. */
  percentComplete: number;
  /** Every day done. */
  isComplete: boolean;
  /** How many remain. 0 once complete. */
  daysRemaining: number;
  /** True before any day is finished — the "not started yet" state. */
  isNotStarted: boolean;
}

/**
 * Normalise the completed-day list.
 *
 * Real rows can carry duplicates (a lesson re-completed) and, after a course
 * length change, day numbers outside the current range. Counting either would
 * overstate progress — the one direction this must never fail in — so both
 * are dropped before counting.
 */
function countCompleted(completedDays: readonly number[], totalDays: number): number {
  const seen = new Set<number>();
  for (const raw of completedDays ?? []) {
    if (!Number.isFinite(raw)) continue;
    const day = Math.floor(raw);
    if (day < 1 || day > totalDays) continue;
    seen.add(day);
  }
  return seen.size;
}

function clampDay(day: number, totalDays: number): number {
  if (!Number.isFinite(day)) return 1;
  return Math.min(Math.max(Math.floor(day), 1), Math.max(totalDays, 1));
}

export function chessSchoolProgress(input: ChessSchoolInput): ChessSchoolProgress {
  const totalDays = Math.max(0, Math.floor(input.totalDays ?? TOTAL_DAYS));
  const completedCount = countCompleted(input.completedDays, totalDays);
  const currentDay = clampDay(input.currentDay, totalDays);

  return {
    currentDay,
    totalDays,
    completedCount,
    percentComplete: totalDays > 0 ? Math.round((completedCount / totalDays) * 100) : 0,
    isComplete: totalDays > 0 && completedCount >= totalDays,
    daysRemaining: Math.max(0, totalDays - completedCount),
    isNotStarted: completedCount === 0,
  };
}

/**
 * "Day 12 of 30" — the single most load-bearing string in this feature, and
 * the thing the course never said before.
 */
export function dayOfLabel(day: number, totalDays: number = TOTAL_DAYS): string {
  return `Day ${clampDay(day, totalDays)} of ${Math.max(totalDays, 1)}`;
}

/**
 * The one line under the progress bar.
 *
 * Two registers, chosen by the same prefersNeutralHomeTone() Home already
 * uses, so an adult learner is not congratulated like a seven-year-old and a
 * seven-year-old is not handed a status readout. Never nags about the days
 * not yet done — the count is stated, not weaponised.
 */
export function schoolSummary(progress: ChessSchoolProgress, neutralTone: boolean): string {
  const { completedCount, totalDays, daysRemaining, isComplete, isNotStarted } = progress;

  if (totalDays === 0) return "";
  if (isComplete) {
    return neutralTone
      ? `Course complete — all ${totalDays} days.`
      : `You finished all ${totalDays} days. Incredible!`;
  }
  if (isNotStarted) {
    return neutralTone
      ? `${totalDays} days, start to finish.`
      : `${totalDays} days of chess ahead of you.`;
  }
  return neutralTone
    ? `${completedCount} of ${totalDays} days complete · ${daysRemaining} to go.`
    : `${completedCount} days done, ${daysRemaining} to go. Keep going!`;
}

/** Label for the primary action, given where the learner stands. */
export function continueLabel(progress: ChessSchoolProgress): string {
  if (progress.isComplete) return "Review your course →";
  if (progress.isNotStarted) return "Start Day 1 →";
  return `Continue ${dayOfLabel(progress.currentDay, progress.totalDays)} →`;
}

/** Where the primary action goes. Always a real lesson route. */
export function continueHref(progress: ChessSchoolProgress): string {
  return `/lesson/${progress.currentDay}`;
}

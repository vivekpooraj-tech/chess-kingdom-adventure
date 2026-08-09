/**
 * Real, honest completion criteria for the opening progress ladder — no
 * status is ever claimed without a measurable event behind it. Thresholds
 * live here as named constants specifically so they're easy to find and
 * adjust later, per the "keep thresholds configurable" instruction.
 */
export type OpeningStatus = "discovered" | "studied" | "practiced" | "mastered";

/** "Successfully" practiced N times before a status reads MASTERED — not
 * just attempted. See recordOpeningPracticeAttempt in lib/supabase/queries.ts
 * for what counts as a "success" (playing the full defining move sequence
 * without deviating from it). */
export const MASTERY_THRESHOLD = 3;

export interface OpeningEncounterRow {
  opening_id: string;
  first_seen_at: string | null;
  studied_at: string | null;
  practice_attempts: number;
  practice_successes: number;
}

/** The highest tier actually reached — each tier's event can happen
 * independently (e.g. a child can study an opening in the Academy before
 * ever reaching it in a real game), so this reads "furthest progress made"
 * rather than enforcing a strict order. */
export function getOpeningStatus(row: OpeningEncounterRow | null | undefined): OpeningStatus | null {
  if (!row) return null;
  if (row.practice_successes >= MASTERY_THRESHOLD) return "mastered";
  if (row.practice_attempts > 0) return "practiced";
  if (row.studied_at) return "studied";
  if (row.first_seen_at) return "discovered";
  return null;
}

export const STATUS_LABELS: Record<OpeningStatus, string> = {
  discovered: "Discovered",
  studied: "Studied",
  practiced: "Practiced",
  mastered: "Mastered",
};

/**
 * Per-theme tactics progress — turns the 5,000-puzzle library and a child's
 * solved-id list into real, per-skill counts for a theme browser.
 *
 * WHY THIS IS ITS OWN MODULE. tacticsLibrary.server.ts is server-only (it
 * reads a 1.8MB file with `fs`). This module does the actual COUNTING, and
 * takes the library and solved ids as plain arrays — no `fs`, no Supabase —
 * so the arithmetic is testable with a small fixture instead of the real
 * 5,000-puzzle file, and the module itself could run on the client if a
 * future surface ever needed that (it won't need the library import to do
 * so, only the counts already computed server-side).
 *
 * WHAT COUNTS AS "SOLVED". Tactics library ids are namespaced `lc-<id>` (see
 * TacticsPuzzle.id) specifically so they can share the same
 * puzzle_library_solves table as the mate library without ever colliding.
 * `solvedIds` here is expected to be that shared table's full id list; this
 * module filters to the ones that actually match a tactics puzzle rather
 * than assuming every id belongs to it — a mate-puzzle id quietly counting
 * toward a tactics theme would overstate real progress, which this product
 * never does.
 */
import type { TacticsPuzzle, TacticsSkill, TacticsTier } from "./tacticsTypes";
import { TACTICS_SKILLS } from "./tacticsTypes";

export interface ThemeProgress {
  skill: TacticsSkill;
  /** Puzzles in the library for this skill, across all tiers. */
  total: number;
  /** How many of those this child has solved. Never exceeds `total`. */
  solved: number;
  /** 0-100, rounded. 0 when the theme has no puzzles at all. */
  percentComplete: number;
  /** Counts broken down by tier, for a finer view if ever needed. */
  byTier: Record<TacticsTier, { total: number; solved: number }>;
}

/**
 * Real per-skill counts. Order matches TACTICS_SKILLS, and a skill absent
 * from the library entirely still appears with total 0 — a theme browser
 * should be able to show "not yet in the library" honestly rather than
 * silently dropping a row.
 */
export function themeProgress(
  library: readonly TacticsPuzzle[],
  solvedIds: readonly string[]
): ThemeProgress[] {
  const solved = new Set(solvedIds ?? []);

  const totals = new Map<TacticsSkill, { total: number; solved: number; byTier: Record<TacticsTier, { total: number; solved: number }> }>();
  for (const skill of TACTICS_SKILLS) {
    totals.set(skill, {
      total: 0,
      solved: 0,
      byTier: {
        beginner: { total: 0, solved: 0 },
        intermediate: { total: 0, solved: 0 },
        advanced: { total: 0, solved: 0 },
      },
    });
  }

  for (const puzzle of library ?? []) {
    const bucket = totals.get(puzzle.skill);
    if (!bucket) continue; // a skill the library carries but the runtime list forgot — see the wiring test
    bucket.total++;
    const tierBucket = bucket.byTier[puzzle.tier];
    if (tierBucket) tierBucket.total++;
    if (solved.has(puzzle.id)) {
      bucket.solved++;
      if (tierBucket) tierBucket.solved++;
    }
  }

  return TACTICS_SKILLS.map((skill) => {
    const bucket = totals.get(skill)!;
    return {
      skill,
      total: bucket.total,
      solved: bucket.solved,
      percentComplete: bucket.total > 0 ? Math.round((bucket.solved / bucket.total) * 100) : 0,
      byTier: bucket.byTier,
    };
  });
}

/** Total solved across every theme — the one honest headline number. */
export function totalThemesSolved(progress: readonly ThemeProgress[]): number {
  return progress.reduce((sum, p) => sum + p.solved, 0);
}

/** Themes with at least one solve — "you've started" vs "not started". */
export function startedThemeCount(progress: readonly ThemeProgress[]): number {
  return progress.filter((p) => p.solved > 0).length;
}

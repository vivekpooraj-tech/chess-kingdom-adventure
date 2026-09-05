import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { ACTIVE_CHILD_COOKIE_NAME } from "@/lib/childSession";
import {
  resolveActiveChildCached,
  getSkillSignals,
  getSolvedPuzzleIds,
  getPuzzleAccuracyStats,
} from "@/lib/supabase/queries";
import { deriveLearnerProfile } from "@/lib/ollie/learnerContext";
import { getSkill } from "@/lib/analysis/skills";
import { selectTacticsPuzzle, tierForLearner } from "@/lib/puzzles/tacticsLibrary.server";
import type { TacticsSkill, TacticsTier, TacticsPuzzleResponse } from "@/lib/puzzles/tacticsTypes";

/**
 * Serve ONE tactics puzzle.
 *
 * This route is the whole point of the scalable architecture: the 5,000-puzzle
 * library (~1.8MB) stays on the server, and the browser receives only the
 * single puzzle it is about to solve — roughly 300 bytes. The library can grow
 * to tens of thousands without the client download changing at all.
 *
 * Personalization uses only signals the app genuinely records:
 *   - skill: the child's recurring weakness (child_skill_signals, via the same
 *     deriveLearnerProfile that Ollie and the Chess Brain panel use, so all
 *     three agree about what needs work). Absent that, a balanced pick.
 *   - difficulty: experience level, promoted only on a real puzzle track
 *     record (see tierForLearner).
 *   - repetition: excludes everything in puzzle_library_solves for this child.
 *
 * Nothing is invented. When there is no weakness signal the response says so
 * (`reason: null`) instead of inventing a justification for the UI to display.
 */
const VALID_SKILLS = new Set<TacticsSkill>([
  "forks", "pins", "skewers", "discovered_attacks", "piece_safety",
  "king_safety", "tactical_awareness", "calculation", "endgame", "checks",
]);
const VALID_TIERS = new Set<TacticsTier>(["beginner", "intermediate", "advanced"]);

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const user = await getSessionUser(supabase);
  if (!user) {
    return NextResponse.json({ puzzle: null, reason: null } satisfies TacticsPuzzleResponse, { status: 401 });
  }

  const cookieChildId = cookies().get(ACTIVE_CHILD_COOKIE_NAME)?.value ?? null;
  // Goes through RLS on `children`, so this can only ever resolve a child the
  // caller actually owns.
  const resolution = await resolveActiveChildCached(supabase, user.id, cookieChildId);
  const child = resolution.child;
  if (!child) {
    return NextResponse.json({ puzzle: null, reason: null } satisfies TacticsPuzzleResponse);
  }

  const url = new URL(req.url);
  const requestedSkill = url.searchParams.get("skill");
  const requestedTier = url.searchParams.get("tier");
  // Client-supplied ids to skip (e.g. the puzzle currently on screen). Capped
  // so a crafted request can't make us build an enormous set.
  const clientExclude = (url.searchParams.get("exclude") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50);

  const [signals, solvedIds, accuracy] = await Promise.all([
    getSkillSignals(supabase, child.id).catch(() => ({})),
    getSolvedPuzzleIds(supabase, child.id).catch(() => [] as string[]),
    getPuzzleAccuracyStats(supabase, child.id).catch(() => null),
  ]);

  const profile = deriveLearnerProfile(signals, []);

  // An explicit ?skill= (e.g. from an Ollie recommendation) wins; otherwise
  // fall back to the child's recurring weakness, if they have one.
  const explicitSkill =
    requestedSkill && VALID_SKILLS.has(requestedSkill as TacticsSkill)
      ? (requestedSkill as TacticsSkill)
      : null;
  const profileSkill =
    profile.focusSkill && VALID_SKILLS.has(profile.focusSkill as TacticsSkill)
      ? (profile.focusSkill as TacticsSkill)
      : null;
  const skill = explicitSkill ?? profileSkill;

  const firstTryRate =
    accuracy && accuracy.totalAttempts > 0
      ? accuracy.firstTryCorrect / accuracy.totalAttempts
      : null;
  const tier =
    requestedTier && VALID_TIERS.has(requestedTier as TacticsTier)
      ? (requestedTier as TacticsTier)
      : tierForLearner(child.experience_level ?? null, firstTryRate, solvedIds.length);

  const exclude = new Set<string>([...solvedIds, ...clientExclude]);
  const puzzle = selectTacticsPuzzle({ skill, tier, exclude });

  // Only claim a reason when the pick was actually driven by a recorded
  // weakness AND the puzzle we found really is for that skill.
  const reason =
    profileSkill && !explicitSkill && puzzle?.skill === profileSkill && profile.focusSkillWeakCount
      ? {
          skill: profileSkill,
          skillName: getSkill(profileSkill).name,
          weakCount: profile.focusSkillWeakCount,
        }
      : null;

  return NextResponse.json({ puzzle, reason } satisfies TacticsPuzzleResponse, {
    // Per-child and stateful — must never be cached by the CDN.
    headers: { "Cache-Control": "no-store" },
  });
}

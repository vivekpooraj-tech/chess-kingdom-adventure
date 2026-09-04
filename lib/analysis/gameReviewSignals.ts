import type { CompletedGameRecord, GameAnalysisResult, AnalyzedMove } from "./gameAnalysis";
import type { SkillId } from "./skills";
import type { GameReviewInput } from "@/lib/supabase/queries";

/**
 * Turns a finished analysis into the shape lib/supabase/queries.ts persists
 * (child_game_reviews + child_skill_signals via 0033). Pure — no I/O, no
 * fabrication: every field is read straight from data the review already
 * computed and shows on screen.
 */

/** Resolve the skill actually shown for a flagged mistake: the explain
 * API's choice, else the conservative mapper's, else the neutral bucket —
 * exactly the precedence PostGameAnalysis uses for the UI. */
function resolvedSkill(m: AnalyzedMove, apiSkill: string | undefined): SkillId {
  return (apiSkill as SkillId | undefined) ?? m.skill?.skill ?? "advantage_loss";
}

export function buildGameReviewInput(
  analysis: GameAnalysisResult,
  record: CompletedGameRecord,
  source: "free_play" | "online",
  biggestMomentSkill: SkillId | null,
  biggestMomentPly: number | null
): GameReviewInput {
  const result: "win" | "loss" | "draw" | null = record.result.isDraw
    ? "draw"
    : record.result.winner === record.playerColor
      ? "win"
      : record.result.winner
        ? "loss"
        : null;

  return {
    source,
    playedColor: record.playerColor,
    result,
    accuracy: analysis.accuracy.movesConsidered > 0 ? analysis.accuracy.score : null,
    totalMoves: Math.ceil(record.moves.length / 2),
    mistakes: analysis.counts.mistake,
    blunders: analysis.counts.blunder,
    inaccuracies: analysis.counts.inaccuracy,
    biggestMomentSkill,
    biggestMomentPly,
    openingName: record.openingName,
  };
}

/**
 * SkillId -> how many of the game's flagged mistakes it caused (using the
 * same resolved-skill precedence as the UI). Fed to bumpSkillWeaknesses.
 */
export function skillWeaknessCounts(
  analysis: GameAnalysisResult,
  apiSkillByPly: Record<number, string | undefined>
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const m of analysis.flaggedMistakes) {
    const skill = resolvedSkill(m, apiSkillByPly[m.ply]);
    counts[skill] = (counts[skill] ?? 0) + 1;
  }
  return counts;
}

/** How many times a skill has been the flagged cause of a mistake across
 * this child's past reviews — the threshold for "you've seen this before".
 * 3+ is a genuine pattern (matches the feature-vision mockup). */
export const RECURRING_SKILL_THRESHOLD = 3;

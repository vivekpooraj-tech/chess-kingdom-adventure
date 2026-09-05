/**
 * "Your Next Best Practice" — one action, and the evidence for it.
 *
 * Pure: no I/O.
 *
 * This is the point where statistics become useful, and also the easiest place
 * in the app to lie. A recommendation implies "we know something about you",
 * so every branch below is tied to a counter the player could verify, and the
 * function returns null rather than inventing a reason to send someone
 * somewhere. No recommendation is a valid, common, and honest answer.
 *
 * Ordering is by how much the evidence supports acting:
 *   1. a skill that keeps causing flagged mistakes  (strongest — repeated, specific)
 *   2. a statistically significant colour weakness  (significance-tested)
 *   3. weak puzzle accuracy with enough attempts    (large sample, but general)
 * Anything thinner produces nothing.
 */

import type { ChessBrainView } from "@/lib/learner/chessBrain";

/** Puzzle attempts below this cannot support a claim about tactics. */
export const MIN_PUZZLE_ATTEMPTS = 20;
/** First-try rate under this, with enough attempts, is worth acting on. */
export const WEAK_PUZZLE_RATE = 0.5;

export interface Recommendation {
  /** What to do. */
  title: string;
  /** Why — always a real, checkable count. */
  evidence: string;
  href: string;
  cta: string;
}

export interface RecommendationInput {
  brain: ChessBrainView | null;
  /** From byColor(): a significance-tested claim, or null. */
  colorClaim: string | null;
  /** Weaker colour, when colorClaim is set. */
  weakerColor: "w" | "b" | null;
  puzzleAttempts: number;
  puzzleFirstTryRate: number | null;
  /** Whether the player has any finished games at all. */
  totalGames: number;
}

export function buildRecommendation(input: RecommendationInput): Recommendation | null {
  const focus = input.brain?.focus ?? null;

  // 1. A specific skill that keeps costing them games. The strongest evidence
  //    available: it is repeated, it is specific, and it names itself.
  if (focus && focus.weakCount > 0) {
    return {
      title: `Practise ${focus.name}`,
      evidence:
        `${focus.name} has been the cause of a flagged mistake ` +
        `${focus.weakCount === 1 ? "once" : `${focus.weakCount} times`} in your reviewed games.`,
      href: `/puzzles/tactics?skill=${encodeURIComponent(focus.skill)}`,
      cta: "Train this skill",
    };
  }

  // 2. A colour difference that survived a two-proportion test.
  if (input.colorClaim && input.weakerColor) {
    const colorName = input.weakerColor === "w" ? "White" : "Black";
    return {
      title: `Review a game you played as ${colorName}`,
      evidence: input.colorClaim,
      href: "/profile",
      cta: "Open your games",
    };
  }

  // 3. Broad tactical accuracy, with a big enough sample to mean something.
  if (
    input.puzzleAttempts >= MIN_PUZZLE_ATTEMPTS &&
    input.puzzleFirstTryRate !== null &&
    input.puzzleFirstTryRate < WEAK_PUZZLE_RATE
  ) {
    return {
      title: "Work on how you search a position",
      evidence:
        `You are solving ${Math.round(input.puzzleFirstTryRate * 100)}% of puzzles first time ` +
        `across ${input.puzzleAttempts} attempts. A search order helps more than more puzzles here.`,
      href: "/academy/tactical-thinking",
      cta: "Start Tactical Thinking",
    };
  }

  // Deliberately nothing. The player has not yet generated evidence for a
  // recommendation, and guessing would undermine the ones that are real.
  return null;
}

/**
 * What Ollie says on the stats page, or nothing.
 *
 * Ollie only speaks to a fact the page is already showing. He does not
 * congratulate, pad, or fill space: an insight that appears every visit stops
 * being read, and one that is not backed by the data is worse than silence.
 */
export function ollieStatsNote(input: {
  trend: "improving" | "steady" | "declining" | null;
  games: number;
  recommendation: Recommendation | null;
}): string | null {
  if (input.trend === "improving") {
    return "Your results have genuinely improved over your recent games — that is a real change, not a hot streak. Whatever you have been practising, keep at it.";
  }
  if (input.trend === "declining") {
    return "Your recent results have dipped. That is usually pace rather than ability: playing a slower time control for a few games is the quickest way to tell.";
  }
  if (input.recommendation) {
    return "One thing at a time is how ratings actually move. Work the practice below until it feels boring, then come back and look at this page again.";
  }
  return null;
}

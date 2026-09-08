/**
 * What a puzzle says to you when you miss, and when you solve it.
 *
 * The rule this file exists to enforce: a missed puzzle move is not an error
 * state. It is the normal middle of learning something. So the copy here never
 * says wrong, failed, incorrect, or no — it acknowledges the try and points
 * somewhere useful, and it gets MORE helpful on later attempts rather than
 * more disappointed.
 *
 * HONESTY CONSTRAINT: `hint` may only ever be real stored data — a puzzle's
 * own `theme` (content/puzzles.ts) or the tactical skill a Tactics Trainer
 * puzzle is filed under. Nothing here derives, guesses, or narrates WHY a move
 * works; there is no engine explanation behind these strings, so none is
 * claimed. Naming the pattern a puzzle is already labelled with is a signpost,
 * not an analysis.
 *
 * Pure and deterministic — same inputs, same words. No randomness anywhere:
 * feedback that varies unpredictably reads as a slot machine and is also
 * untestable.
 */

export interface MissContext {
  /** 1-based: 1 is the first miss on this puzzle. Values < 1 clamp to 1. */
  attempt: number;
  /** Adult / experienced register vs. warm child register. */
  neutralTone: boolean;
  /**
   * A real, stored label for the idea in this position — puzzle.theme or a
   * skill name. Omit (or pass null) when nothing accurate is available; the
   * copy then simply doesn't name one rather than inventing a direction.
   */
  hint?: string | null;
}

export interface SolveContext {
  /** Solved with no misses on this puzzle. */
  firstTry: boolean;
  /** Consecutive first-try solves, for the "in a row" line. 0 when unknown. */
  streak: number;
  neutralTone: boolean;
}

/**
 * Words that must never reach a child mid-puzzle. Asserted in
 * scripts/test-puzzle-encouragement.js against every string this module can
 * produce, so a future edit cannot quietly reintroduce a harsh register.
 */
export const DISCOURAGING_PATTERN =
  /\b(wrong|incorrect|failed|failure|fail|bad|mistake|blunder|no+pe|oops|nope)\b/i;

function clampAttempt(attempt: number): number {
  if (!Number.isFinite(attempt)) return 1;
  return Math.max(1, Math.floor(attempt));
}

/** Trim a hint to something that reads naturally mid-sentence. */
function cleanHint(hint: string | null | undefined): string | null {
  if (typeof hint !== "string") return null;
  const trimmed = hint.trim();
  if (!trimmed) return null;
  return trimmed;
}

/**
 * The line shown after a move that doesn't solve the puzzle.
 *
 * The ladder deliberately runs gentle -> concrete, never gentle -> stern:
 *   1st  acknowledge the try, invite another look
 *   2nd  suggest a different idea
 *   3rd+ name the pattern the puzzle is filed under, if we actually have it
 *
 * Later attempts give MORE information, so a stuck child is helped rather
 * than nagged. There is no attempt limit and no lockout.
 */
export function encourageAfterMiss(ctx: MissContext): string {
  const attempt = clampAttempt(ctx.attempt);
  const hint = cleanHint(ctx.hint);

  if (ctx.neutralTone) {
    if (attempt === 1) return "That doesn't finish it — take another look.";
    if (attempt === 2) return "Still not it. Try a different idea.";
    return hint
      ? `Try a different idea — this one is ${hint.toLowerCase()}.`
      : "Try a different idea — look at every checking move.";
  }

  if (attempt === 1) return "Interesting move — let's look again.";
  if (attempt === 2) return "Almost! Try another idea.";
  return hint
    ? `Keep going — you're close. This one is ${hint.toLowerCase()}.`
    : "Keep going — you're close. Look at every check you could give.";
}

/**
 * The line shown on a solve.
 *
 * A first-try solve gets the warmer line; a solve after a few tries is still
 * celebrated, because getting there after three attempts is the same skill
 * arriving slightly later, and treating it as a lesser result is exactly the
 * discouragement this module exists to avoid.
 */
export function celebrateSolve(ctx: SolveContext): string {
  const streak = Number.isFinite(ctx.streak) ? Math.max(0, Math.floor(ctx.streak)) : 0;

  if (ctx.neutralTone) {
    if (ctx.firstTry && streak >= 2) return `Solved — ${streak} in a row, first try.`;
    if (ctx.firstTry) return "Solved — first try.";
    return "Solved.";
  }

  if (ctx.firstTry && streak >= 2) return `Checkmate — that's ${streak} in a row, first try!`;
  if (ctx.firstTry) return "Checkmate — you found it!";
  return "You got it — nice persistence!";
}

/**
 * The quiet mid-solution nudge, between a correct non-final move and the end
 * of the line. Stays factual in both registers: it is progress information,
 * not praise to be spent on every ply.
 */
export function progressNudge(movesRemaining: number, neutralTone: boolean): string {
  const remaining = Math.max(1, Math.floor(movesRemaining));
  if (remaining === 1) {
    return neutralTone ? "Good move — now finish it." : "Good move — now find the checkmate!";
  }
  return neutralTone
    ? `Good move — ${remaining} to go.`
    : `Good move — ${remaining} moves to go. Keep going!`;
}

/**
 * Ollie's voice for the moments the content cannot know in advance.
 *
 * A session's content carries three scoped lines — intro, mistake, success —
 * and that is right for the session as a whole. But inside a session the same
 * moment recurs: three puzzles in a drill, four wrong tries on one board, a
 * game that ends one of three ways. Saying "You didn't get lucky" three times
 * in a row turns a companion into a slot machine. So the repeating moments
 * draw from short curated lists here, chosen by COUNT rather than at random —
 * the second success gets the second line, every time, on every device, which
 * keeps it testable and keeps Ollie from contradicting himself.
 *
 * The direction is identity and thinking, never empty praise. Not "correct",
 * but "you saw it before it happened". Not "wrong", but "that's a real move —
 * and here's what it missed". Short enough for a seven-year-old to read
 * before the next tap.
 */

const pick = (lines: readonly string[], n: number): string =>
  lines[Math.min(Math.max(n, 0), lines.length - 1)];

/** A puzzle or guided goal solved. `n` = how many solved so far in this step (0-based). */
export function solvedLine(n: number): string {
  return pick(
    [
      "You didn't guess. You spotted it.",
      "Again. That's not luck, that's a pattern you can see now.",
      "Three for three. You're not learning this anymore — you know it.",
      "Still seeing it. That's what a chess player does.",
    ],
    n
  );
}

/** A legal move that was not the goal. `n` = misses so far on this board (0-based). */
export function missLine(n: number): string {
  return pick(
    [
      "That's a real move — it just isn't the one. Look again.",
      "Close. Slow down and check what that square attacks.",
      "Still not it, and that's fine. Even I did that when I was learning.",
      "Let me show you. Watch what the right move does.",
    ],
    n
  );
}

/** A tap that wasn't even a legal move. Gentle, and never more than a nudge. */
export function illegalLine(n: number): string {
  return pick(
    [
      "That piece can't go there. Tap it again and look at where it lights up.",
      "Not a legal square for that piece. Try a different one.",
    ],
    n
  );
}

/** The whole board step solved after some struggle. */
export function perseveranceLine(misses: number): string {
  if (misses === 0) return "First try. You saw it before it happened.";
  if (misses === 1) return "Second look and you had it. That's exactly how it's supposed to go.";
  return "It took a few tries, and you got there. That's not weakness — that's learning out loud.";
}

/** How a bot game ended. */
export function gameEndLine(result: "win" | "loss" | "draw", hintsAllowed: boolean): string {
  if (result === "win") {
    return hintsAllowed
      ? "You WON. You made every one of those moves yourself — I only pointed."
      : "You won it with nobody helping. That's the whole point of today, and you did it.";
  }
  if (result === "draw") return "A draw — neither side could break through. That's a real result, and a real game.";
  return "That one got away. Every chess player alive has lost a game. You played the whole thing, and next time you'll see it coming.";
}

/** Reached the move goal without the game ending. */
export function gameGoalLine(hintsAllowed: boolean): string {
  return hintsAllowed
    ? "That's a game of chess, start to finish. Not a puzzle — a game."
    : "Sixteen moves, no hints, nobody helping. Every one of those was yours.";
}

/** Bot match: what to say by move count while it's going. */
export function gameProgressLine(moves: number, required: number): string {
  if (moves === 0) return "Your move first. White always starts.";
  if (moves < required / 2) return "Good. Keep looking for free pieces before every move.";
  if (moves < required) return "Halfway. Is your King safe? Is anything of yours hanging?";
  return "You've played enough to count. Finish the game if you like — or continue.";
}

/** Parent Mode. */
export const PARENT_MODE_LINES = {
  waitingForGrownUp: "Watch what they do. Your turn is next.",
  childNudge: "That's a legal move, but it isn't the one. One square attacks TWO things — find it.",
  parentNudge: "Not that one — follow the instruction above exactly, so the trap is really there.",
  success: "You did that to a REAL person.",
} as const;

/** Pass-and-play. */
export const PASS_AND_PLAY_LINES = {
  start: "White moves first. Pass the phone after every move — nobody else can see this game.",
  playing: "Take your time. The other player can wait — that's how real chess works.",
  finished: "You played a person, all the way through. Shake hands.",
} as const;

/**
 * Crossing into a new act (module.ts groups the 30 sessions into four:
 * I SPEAK CHESS / I SEE TRAPS / I PLAY FOR REAL / I CHALLENGE SOMEONE).
 * Said once, on the finish screen of the LAST session of the act just left,
 * so progress reads as a journey through acts rather than "session complete,
 * next session" thirty times in a row. Returns null for act 1 -- there is
 * nothing to have crossed yet on session 1.
 */
export function actTransitionLine(enteringAct: 1 | 2 | 3 | 4): string | null {
  switch (enteringAct) {
    case 2:
      return "You speak chess now. What comes next is where it gets interesting.";
    case 3:
      return "Chess players start seeing things other people miss. You are about to.";
    case 4:
      return "Time to trust yourself. This is where you start playing for real.";
    default:
      return null;
  }
}

/** The welcome back after a bookmark was restored. */
export function resumedLine(stepTitle: string): string {
  return `You were in the middle of "${stepTitle}". Picking up right there.`;
}

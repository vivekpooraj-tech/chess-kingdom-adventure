/**
 * What Ollie says at the end of a course lesson, and when a learner is stuck.
 *
 * Text only — safe to import from client components.
 *
 * Ollie appears in exactly two places in a lesson: once at the end, to connect
 * what was just learned to actually playing, and once during practice after
 * repeated failed attempts, where a nudge is genuinely wanted. He does not
 * comment on every move. A coach who talks constantly stops being listened to,
 * and the value of "Ollie noticed something" depends entirely on him not
 * saying it all the time.
 *
 * The tone is deliberately calm and adult. Chess Mind is used by grown
 * beginners as well as children, and encouragement that reads as babying is
 * worse than silence for both.
 */

/** Said once, on completing a lesson: the bridge from lesson to real play. */
export const COURSE_COMPLETION_NOTE: Record<string, string> = {
  "tactical-thinking":
    "You now have a search order — checks, captures, threats, then their reply. Run it before every move in your next game, especially when nothing looks like it is happening. That is when tactics get missed.",
  strategy:
    "Before you look for the best move, ask what the position actually needs. That question is most of what strategy is, and it is available on every quiet move.",
  endgames:
    "Your king is a fighting piece now. When the queens come off, decide where it is going before you touch anything else.",
};

/** Said during practice, after repeated failed attempts on one exercise. */
export const COURSE_STUCK_NOTE: Record<string, string> = {
  "tactical-thinking":
    "Slow down and list them: every check first, then every capture, then every threat. The move is in that list — the difficulty is looking properly, not seeing further.",
  strategy:
    "There is no tactic here, so do not hunt for one. Ask instead which of your pieces is doing the least, and what this position is missing.",
  endgames:
    "Count rather than guess. In an endgame the answer is usually a tempo, not an idea.",
};

export const OLLIE_DEFAULT_STUCK =
  "Take one more look before you move. Say what the position is asking for, then choose.";

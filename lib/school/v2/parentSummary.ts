import { getSession, TOTAL_SESSIONS } from "@/content/school/sessions";
import type { SchoolProgress, SchoolSkillTag } from "@/content/school/types";
import { completedCount, currentModule, nextSession, nextSessionNumber } from "./progress";

/**
 * Progress in words a parent would actually say.
 *
 * WHY THIS FILE EXISTS AT ALL. The obvious thing to put on a parent screen is
 * a number — 62%, "chess intelligence 73", a rating. All of those are either
 * meaningless or invented, and the invented ones are worse: a parent who is
 * told their child's "chess IQ is 64" has been given a psychological
 * measurement that does not exist. This app does not do that.
 *
 * So progress is reported as CLAIMS, and every claim is backed by a session
 * the child actually finished. "Your child can now confidently move the
 * Knight" is true because session 4 is in completedSessions. If they have not
 * finished it, the sentence does not appear. There is no partial credit and no
 * estimated skill level, because there is no honest way to compute one.
 *
 * The one number that IS shown is "9 of 30 sessions", which is a count of
 * things that happened, not a measurement of a child.
 */

/**
 * One sentence per skill, phrased as something a parent can check for
 * themselves at the kitchen table. Every one of these is a claim the app is
 * willing to defend if the parent asks the child to demonstrate it.
 */
const SKILL_SENTENCES: Readonly<Record<SchoolSkillTag, string>> = {
  board_setup: "set up a chess board correctly",
  pawn_movement: "move pawns, including the two-square first move",
  pawn_capture: "capture with pawns (diagonally, not forwards)",
  pawn_promotion: "turn a pawn into a Queen at the far end",
  knight_movement: "move the Knight in its L-shape, including jumping over pieces",
  bishop_movement: "move the Bishop along diagonals",
  rook_movement: "move the Rook in straight lines",
  queen_movement: "move the Queen in every direction",
  king_movement: "move the King one square at a time",
  check: "explain what check means",
  hanging_pieces: "spot a piece that can be taken for free",
  fork: "play a fork — one piece attacking two at once",
  pin: "pin a piece so it cannot move",
  skewer: "play a skewer",
  back_rank: "spot a back-rank checkmate",
  escape_check: "get out of check three different ways",
  checkmate: "deliver checkmate",
  castling: "castle the King to safety",
  opening_principles: "start a game well without memorising anything",
  king_safety: "keep their King safe",
  planning: "look at what their opponent is threatening",
  endgame_king: "use the King actively at the end of a game",
  full_game: "play a full game from start to finish",
  teaching_others: "teach the basics to someone else",
};

/**
 * Things to try together, keyed on the most advanced skill the child has.
 * Deliberately practical: a parent reading this should be able to act on it in
 * the next five minutes without knowing chess themselves.
 */
const PRACTICE_TOGETHER: Readonly<Partial<Record<SchoolSkillTag, string>>> = {
  board_setup: "Ask them to set the board up and tell you where the Queen goes. (She starts on her own colour.)",
  pawn_promotion: "Ask them what happens when a pawn reaches the other end. The answer should make them grin.",
  knight_movement: "Ask them to show you the one piece that can jump over others.",
  bishop_movement: "Ask them why a Bishop can never reach half the squares on the board.",
  rook_movement: "Play a mini-game with only Kings and Rooks. It is short and they will probably beat you.",
  queen_movement: "Ask them which two pieces the Queen copies. (Rook and Bishop.)",
  check: "Ask them the three ways to get out of check: move, block, take.",
  hanging_pieces: "Before each of your moves, ask them 'is anything of mine free right now?'",
  fork: "Let them show you a fork. Session 13 is designed for exactly this — they may already have done it to you.",
  pin: "Ask them to explain the difference between a pin and a skewer. It is a good test of real understanding.",
  checkmate: "Ask them to explain why a check is not always checkmate.",
  castling: "Ask them to show you the only move where two pieces move at once.",
  opening_principles: "Ask them for their three rules for starting a game. Middle, pieces out, castle.",
  full_game: "Play a full game with them. They are ready — that is the whole point of the course.",
  teaching_others: "Ask them to teach the rules to someone who does not know them. It is the strongest test there is.",
};

export interface ParentSummary {
  /** "9 of 30 sessions" — a count, not a score. */
  sessionsLine: string;
  /** The module they are in right now, in plain words. */
  currentFocus: string;
  /** Up to three "Your child can now…" claims, most recent first. */
  canNowDo: readonly string[];
  /** EVERY skill earned, as short phrases, most recent first — the full list
   *  for the parent page, where "up to three" would hide real progress. */
  allSkills: readonly string[];
  /** The skill the next session teaches, as a phrase: "keep their King safe". */
  currentlyLearning: string;
  /** What the next session teaches (title + subtitle). */
  learningNext: string;
  /** The session after that — so a parent can see the direction of travel. */
  afterThat: string;
  /** One concrete thing to do together tonight. */
  practiceTogether: string;
  /** True once the course is finished. */
  graduated: boolean;
}

/**
 * The full parent-facing picture.
 *
 * Everything returned here is derived from completed sessions. A child who has
 * finished nothing gets an honest empty state, not an encouraging fiction.
 */
export function parentSummary(progress: SchoolProgress): ParentSummary {
  const done = completedCount(progress);
  const graduated = progress.graduatedAt !== null;

  const claims = orderedSkillClaims(progress);
  const canNowDo = claims.slice(0, 3).map((s) => `Your child can now ${s}.`);

  const module = currentModule(progress);
  const next = nextSession(progress);
  const after = next ? getSession(next.number + 1) : null;

  const practiceKey = mostAdvancedPracticeSkill(progress);
  const practiceTogether =
    (practiceKey && PRACTICE_TOGETHER[practiceKey]) ??
    "Sit down and ask them to show you how one piece moves. That is enough to start.";

  return {
    sessionsLine: `${done} of ${TOTAL_SESSIONS} sessions`,
    currentFocus: graduated
      ? "Finished the whole course."
      : module
      ? `${module.title} — ${module.blurb}`
      : "Just getting started.",
    canNowDo:
      canNowDo.length > 0
        ? canNowDo
        : ["Nothing yet — they have not finished a session. That is a completely normal place to start."],
    allSkills: claims,
    currentlyLearning: graduated
      ? "everything this course teaches"
      : next
      ? SKILL_SENTENCES[next.skillTags[0]]
      : "",
    learningNext: graduated
      ? "Nothing left to learn here. Now they need opponents."
      : next
      ? `${next.title} — ${next.subtitle}`
      : "",
    afterThat: after ? `${after.title} — ${after.subtitle}` : "",
    practiceTogether,
    graduated,
  };
}

/**
 * Skill sentences in the order they were earned, most recent first.
 *
 * Ordered by the session that taught them rather than alphabetically, so the
 * three claims a parent sees are the three most recent things that happened —
 * which is what makes them recognisable ("oh, that's what she was doing last
 * night").
 */
export function orderedSkillClaims(progress: SchoolProgress): readonly string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of [...progress.completedSessions].sort((a, b) => b - a)) {
    const session = getSession(n);
    if (!session) continue;
    for (const tag of session.skillTags) {
      if (seen.has(tag)) continue;
      seen.add(tag);
      out.push(SKILL_SENTENCES[tag]);
    }
  }
  return out;
}

/** The most recently earned skill that has a "try this together" suggestion. */
function mostAdvancedPracticeSkill(progress: SchoolProgress): SchoolSkillTag | null {
  for (const n of [...progress.completedSessions].sort((a, b) => b - a)) {
    const session = getSession(n);
    if (!session) continue;
    for (const tag of session.skillTags) {
      if (PRACTICE_TOGETHER[tag]) return tag;
    }
  }
  return null;
}

/** The child-facing version of the same idea: short, second person, no jargon. */
export function childProgressLine(progress: SchoolProgress): string {
  const done = completedCount(progress);
  if (progress.graduatedAt) return "You finished Chess School. You are a chess player.";
  if (done === 0) return "You haven't started yet. Session 1 takes about ten minutes.";
  const next = nextSessionNumber(progress);
  return `You've finished ${done} of ${TOTAL_SESSIONS}. Next up is session ${next}.`;
}

/** Exported for the certificate — the skills, as short phrases. */
export function skillPhrase(tag: SchoolSkillTag): string {
  return SKILL_SENTENCES[tag];
}

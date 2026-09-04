/**
 * Game Review context for the Ollie coach (Phase 26 / Phase E).
 *
 * When a child opens the "Ask Ollie" chat from their post-game review, the
 * client sends this block: the deterministic facts the Game Review already
 * computed (the biggest mistake's move, the engine's better move, the skill
 * it was attributed to, the "what to notice" principle, the accuracy, the
 * mistake count, and — only when there is real history — whether this skill
 * keeps coming up).
 *
 * The system-prompt line built here tells Ollie to explain THAT mistake and
 * skill using ONLY these facts, adapted to the learner, and NOT to invent a
 * tactical story or add generic commentary when the facts already answer
 * the question. Same anti-fabrication contract as boardContext.ts.
 */

export interface OllieReviewContext {
  /** e.g. "White" / "Black". */
  playerColor?: "w" | "b";
  result?: "win" | "loss" | "draw";
  accuracy?: number;
  mistakeCount?: number;
  blunderCount?: number;
  /** The biggest learning moment. */
  moveNumber?: number;
  playedSan?: string;
  bestSan?: string;
  category?: "inaccuracy" | "mistake" | "blunder";
  missedMate?: boolean;
  missedMaterial?: boolean;
  /** Human name of the skill (e.g. "Piece Safety"), from lib/analysis/skills.ts. */
  skillName?: string;
  /** The reusable principle already shown on the card. */
  whatToNotice?: string;
  /** Position BEFORE the mistake (FEN) — so Ollie can answer position questions. */
  fenBefore?: string;
  /** True only when there is genuine multi-review history for this skill. */
  recurringSkill?: boolean;
  /** What the review recommends practicing next. */
  practiceSkillName?: string;
}

function clip(s: string | undefined, n = 120): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) : s;
}

export function buildReviewContextLine(ctx: OllieReviewContext | undefined): string {
  if (!ctx) return "";

  const facts: string[] = [];
  if (ctx.playerColor) facts.push(`The child played ${ctx.playerColor === "w" ? "White" : "Black"}.`);
  if (typeof ctx.accuracy === "number") facts.push(`Their accuracy this game was ${ctx.accuracy}%.`);
  if (typeof ctx.mistakeCount === "number") {
    facts.push(
      `The review flagged ${ctx.mistakeCount} mistake${ctx.mistakeCount === 1 ? "" : "s"}` +
        (ctx.blunderCount ? ` (${ctx.blunderCount} of them serious).` : ".")
    );
  }

  const moment: string[] = [];
  if (ctx.moveNumber && ctx.playedSan) {
    moment.push(`On move ${ctx.moveNumber} they played ${ctx.playedSan}${ctx.category === "blunder" ? " — a serious mistake" : ""}.`);
  }
  if (ctx.missedMate) moment.push("A forced checkmate was available and missed.");
  else if (ctx.missedMaterial) moment.push("A move that wins material was available and missed.");
  if (ctx.bestSan) moment.push(`One strong move here was ${ctx.bestSan}.`);
  if (ctx.skillName) moment.push(`The review says the skill to work on is: ${ctx.skillName}.`);
  if (ctx.whatToNotice) moment.push(`The takeaway shown to the child: "${clip(ctx.whatToNotice)}"`);
  if (ctx.recurringSkill && ctx.skillName) {
    moment.push(`This skill (${ctx.skillName}) has come up in the child's recent games before — it is a pattern.`);
  }
  if (ctx.practiceSkillName) moment.push(`The review suggests practicing ${ctx.practiceSkillName} next.`);

  const line =
    `\n\nGAME REVIEW CONTEXT — the child is asking about a game they just finished. ` +
    `These are facts a chess engine and the Chess Mind review already worked out; treat them as true ` +
    `and DO NOT add your own analysis of other moves, invent threats or tactics you were not told about, ` +
    `or give generic advice when these facts already answer the question. If they ask "why was this a ` +
    `mistake" or "how do I avoid this", answer from the skill and takeaway below. If they ask something ` +
    `the facts don't cover, say what you can and keep it short.\n` +
    (facts.length ? facts.join(" ") + "\n" : "") +
    (moment.length ? "Biggest learning moment: " + moment.join(" ") : "");

  return line.slice(0, 4000) || line;
}

/** Learner-adaptation line — keeps the tone/pace right for this child
 * without ever putting their identity in the prompt. */
export function buildLearnerToneLine(
  experienceLevel: "new" | "knows_basics" | "plays_regularly" | undefined,
  ageBand: "young" | "tween" | "teen" | "adult" | undefined
): string {
  const bits: string[] = [];
  if (experienceLevel === "new") bits.push("This child is new to chess — keep it very simple, avoid notation where you can, one idea at a time.");
  else if (experienceLevel === "knows_basics") bits.push("This child knows the basics — you can use simple notation and name common tactics.");
  else if (experienceLevel === "plays_regularly") bits.push("This child plays regularly — you can be a bit more direct and use standard chess terms.");
  if (ageBand === "young") bits.push("Use short, warm sentences a young child follows easily.");
  else if (ageBand === "adult") bits.push("An older learner — you can drop the childlike framing but stay encouraging and concise.");
  return bits.length ? "\n\n" + bits.join(" ") : "";
}

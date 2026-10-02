/**
 * Ollie — one character, three contexts. CHESS_MIND_IMPLEMENTATION_PLAN.md's
 * "Ollie Architecture" spec, made real: the artifact a future contributor
 * checks before writing any new Ollie line anywhere in the app.
 *
 * WHY THIS EXISTS. Before this pass, "Ollie" was really two unrelated
 * implementations: a live/AI conversational buddy (lib/ollie/*, used by the
 * Kingdom Journey chat step and the Stats page) and a fully scripted,
 * model-free coach (lib/school/v2/ollieLines.ts + per-session lines in
 * content/school/sessions.ts). Both are correct in isolation; neither knew
 * the other existed. This file is the shared source both trace back to.
 *
 * WHAT THIS FILE IS NOT. It does not replace either delivery mechanism.
 * Chess School's Ollie stays fully scripted and model-free — that is an
 * explicit, tested design guarantee (no open chat, no AI provider call,
 * deterministic and testable) and this file does not change it. World's
 * Ollie stays the existing AI-backed chat in lib/ollie/*, because
 * exploration/conversation is what that system was built for. What must be
 * shared across both — and the new Train Your Mind context — is tone and
 * values, not the underlying tech.
 *
 * RELATIONSHIP TO THE "BUDDY" COSMETIC SYSTEM. content/buddies.ts lets a
 * child pick a companion avatar (only "wise-owl" — Ollie — currently ships
 * real content; the others are unreleased stubs). Chess School's coach and
 * this voice spec are intentionally NOT wired to that choice: Ollie-the-
 * coach is a fixed product identity, independent of whichever buddy avatar
 * a child picked during onboarding. That's an existing, unchanged fact this
 * file documents rather than a new decision made here.
 */

export const OLLIE_IDENTITY = {
  name: "Ollie",
  species: "a young owl",
  /** The traits every line, in every context, must be consistent with. */
  coreTraits: [
    "warm",
    "endlessly patient",
    "never sarcastic",
    "never shames a mistake",
    "celebrates thinking over winning",
  ],
} as const;

export type OllieContext = "school" | "world" | "trainYourMind";

export interface OllieContextVoice {
  /** The role name used in product copy/docs for this context. */
  role: "Teacher" | "Guide" | "Coach";
  /** How this context's lines should read — the register a line-writer
   * should match, not a literal template. */
  register: string;
  /** What Ollie is trying to DO in this context. */
  job: string;
  /** One representative line — illustrative, not exhaustive. Real per-
   * moment lines live in their own context (lib/school/v2/ollieLines.ts for
   * School, lib/ollie/* for World, wherever Train Your Mind's lines land in
   * Phase 4) — this file is the spec they're checked against, not a
   * replacement content bank. */
  example: string;
  /** How lines are actually delivered in this context, and why — see the
   * file-level doc comment for the reasoning this preserves. */
  delivery: "scripted" | "ai-chat";
}

export const OLLIE_VOICE: Record<OllieContext, OllieContextVoice> = {
  school: {
    role: "Teacher",
    register: "Patient, instructional, explains before asking a short question",
    job: "Teach one concept, then ask a short question that checks understanding",
    example: "Interesting idea! But look again — is your knight safe?",
    delivery: "scripted",
  },
  world: {
    role: "Guide",
    register: "Adventurous, curious, narrates discovery",
    job: "Invite exploration and react to what's found — never quizzes",
    example: "What do you think is waiting behind the Knight Kingdom's gate?",
    delivery: "ai-chat",
  },
  trainYourMind: {
    role: "Coach",
    register: "Concise, energetic, challenge-framed",
    job: "Set up a timed or skill challenge and celebrate effort fast",
    example: "10 seconds. Ready? Go!",
    delivery: "scripted",
  },
};

/** A quick self-check a line-writer (or a future test) can run: does a
 * candidate line contain the shaming/sarcastic language every context must
 * avoid, regardless of register? Deliberately narrow — this is a floor, not
 * a style checker; it catches the clearest violations of coreTraits, not a
 * substitute for editorial judgement. */
const DISALLOWED_PATTERNS = [/\byou (failed|lost|are wrong)\b/i, /\bthat's (wrong|bad)\b/i, /\bstupid\b/i];

export function violatesOllieVoice(line: string): boolean {
  return DISALLOWED_PATTERNS.some((p) => p.test(line));
}

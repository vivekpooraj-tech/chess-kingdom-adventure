import { SCHOOL_SESSIONS, TOTAL_SESSIONS, getSession } from "@/content/school/sessions";
import { PIECE_SUPERPOWERS, SCHOOL_MODULES, moduleForSession } from "@/content/school/modules";
import type {
  SchoolProgress,
  SchoolSession,
  SchoolSkillTag,
  SchoolModule,
} from "@/content/school/types";

/**
 * Chess School V2 — every rule about where a child is and what happens next.
 *
 * PURE. No React, no Supabase, no clock it did not receive. Every input is a
 * parameter, so the mastery rules, the remedial path and the graduation gate
 * are all testable without a database (scripts/test-chess-school-v2.js), and
 * the same functions run on the server and in the browser.
 *
 * TWO RULES DECIDE EVERYTHING HERE.
 *
 * 1. PROGRESS IS EARNED, NEVER INFLATED. Duplicate rows, session numbers from
 *    a future version of the course, a graduation timestamp on a child who has
 *    finished four sessions — all of it is absorbed on read. A course that
 *    says "12 of 30" when the truth is 9 is worse than no number at all,
 *    because a parent believes it.
 *
 * 2. A CHILD IS NEVER PERMANENTLY BLOCKED. Missing a drill routes to a
 *    remedial position and a retry, not a locked door. The gate on the NEXT
 *    session is "you finished the one before", and that is the only gate —
 *    no dates, no streaks, no zone unlocks.
 */

/** The empty state: a child who has just walked in. */
export const EMPTY_PROGRESS: SchoolProgress = {
  completedSessions: [],
  skillTags: [],
  unlocks: [],
  graduatedAt: null,
};

const VALID_SKILLS = new Set<string>(
  SCHOOL_SESSIONS.flatMap((s) => s.skillTags as readonly string[])
);
const VALID_UNLOCKS = new Set<string>(
  SCHOOL_SESSIONS.flatMap((s) => (s.shareUnlock ? [s.shareUnlock.id] : []))
);

/**
 * Turn whatever the database (or a stale client, or a hand-edited row) hands
 * us into a progress object every screen can trust.
 *
 * Anything unrecognised is DROPPED rather than coerced: an unknown skill tag
 * is not evidence a child learned something, and a session number of 47 is not
 * evidence they are ahead.
 */
export function normalizeProgress(raw: unknown): SchoolProgress {
  if (!raw || typeof raw !== "object") return EMPTY_PROGRESS;
  const r = raw as Record<string, unknown>;

  const sessions = Array.isArray(r.completedSessions) ? r.completedSessions : [];
  const completedSessions = Array.from(
    new Set(
      sessions
        .filter((n): n is number => typeof n === "number" && Number.isFinite(n))
        .map((n) => Math.floor(n))
        .filter((n) => n >= 1 && n <= TOTAL_SESSIONS)
    )
  ).sort((a, b) => a - b);

  const rawSkills = Array.isArray(r.skillTags) ? r.skillTags : [];
  const skillTags = Array.from(
    new Set(rawSkills.filter((t): t is SchoolSkillTag => typeof t === "string" && VALID_SKILLS.has(t)))
  );

  const rawUnlocks = Array.isArray(r.unlocks) ? r.unlocks : [];
  const unlocks = Array.from(
    new Set(rawUnlocks.filter((u): u is string => typeof u === "string" && VALID_UNLOCKS.has(u)))
  );

  // Graduation is a claim about having finished the course. It is only
  // honoured if the completed list actually backs it up.
  const rawGraduated = typeof r.graduatedAt === "string" ? r.graduatedAt : null;
  const graduatedAt =
    rawGraduated && completedSessions.includes(TOTAL_SESSIONS) ? rawGraduated : null;

  return { completedSessions, skillTags, unlocks, graduatedAt };
}

/** How many sessions are finished. Never more than the course holds. */
export function completedCount(progress: SchoolProgress): number {
  return progress.completedSessions.length;
}

export function isSessionComplete(progress: SchoolProgress, sessionNumber: number): boolean {
  return progress.completedSessions.includes(sessionNumber);
}

/**
 * The session "Continue Learning" opens.
 *
 * The first unfinished one, in order — NOT "highest completed plus one", which
 * would skip a session a child went back and left half-done. Once everything
 * is finished it stays on the last session, so Continue never points at
 * nothing.
 */
export function nextSessionNumber(progress: SchoolProgress): number {
  for (let n = 1; n <= TOTAL_SESSIONS; n++) {
    if (!progress.completedSessions.includes(n)) return n;
  }
  return TOTAL_SESSIONS;
}

export function nextSession(progress: SchoolProgress): SchoolSession | null {
  return getSession(nextSessionNumber(progress));
}

/**
 * Whether a session can be opened.
 *
 * The rule is deliberately generous: anything already finished stays open
 * forever (a child who wants to replay Fork Festival should be able to), and
 * the frontier session is open. Nothing beyond the frontier, so the arc is
 * still an arc — but nothing is ever taken away either.
 */
export function isSessionUnlocked(progress: SchoolProgress, sessionNumber: number): boolean {
  if (sessionNumber < 1 || sessionNumber > TOTAL_SESSIONS) return false;
  if (progress.completedSessions.includes(sessionNumber)) return true;
  return sessionNumber === nextSessionNumber(progress);
}

/**
 * Record a finished session.
 *
 * Additive and idempotent: finishing session 12 twice does not award Fork
 * Master twice, and never removes a skill already earned. Returns a NEW
 * object — callers hold the old one for comparison (what was just unlocked?).
 */
export function completeSession(
  progress: SchoolProgress,
  sessionNumber: number,
  now: () => Date = () => new Date()
): SchoolProgress {
  const session = getSession(sessionNumber);
  if (!session) return progress;

  const completedSessions = Array.from(
    new Set([...progress.completedSessions, sessionNumber])
  ).sort((a, b) => a - b);
  const skillTags = Array.from(new Set([...progress.skillTags, ...session.skillTags]));
  const unlocks = session.shareUnlock
    ? Array.from(new Set([...progress.unlocks, session.shareUnlock.id]))
    : [...progress.unlocks];

  // Finishing the final session IS graduation. Win or lose the duel — the
  // duel has no win condition, and that is the product decision, not an
  // oversight: a child who loses their graduation game still learned chess.
  const graduatedAt =
    sessionNumber === TOTAL_SESSIONS && !progress.graduatedAt
      ? now().toISOString()
      : progress.graduatedAt;

  return { completedSessions, skillTags, unlocks, graduatedAt };
}

export function hasGraduated(progress: SchoolProgress): boolean {
  return progress.graduatedAt !== null;
}

/** The outcome of a drill attempt, and what the runner should do next. */
export type DrillOutcome = "passed" | "remedial";

/**
 * Did the child clear the drill?
 *
 * A miss is never terminal — it routes to `remedial`, which is one easier
 * position plus a smaller explanation, and then a retry. There is no third
 * state, because there is no state in this course that means "you may not
 * continue".
 */
export function drillOutcome(correct: number, passRequired: number): DrillOutcome {
  return correct >= passRequired ? "passed" : "remedial";
}

/** After the remedial position, the child continues regardless. Mastery here
 *  means "was taught again", not "was tested until they passed". */
export function remedialClears(): true {
  return true;
}

export interface ModuleProgress {
  module: SchoolModule;
  completed: number;
  total: number;
  isCurrent: boolean;
}

/** Per-module counts for the home screen. Real counts only — a module with
 *  nothing finished says zero. */
export function moduleProgress(progress: SchoolProgress): readonly ModuleProgress[] {
  const next = nextSessionNumber(progress);
  return SCHOOL_MODULES.map((module) => ({
    module,
    completed: module.sessionNumbers.filter((n) => progress.completedSessions.includes(n)).length,
    total: module.sessionNumbers.length,
    isCurrent: module.sessionNumbers.includes(next),
  }));
}

export function currentModule(progress: SchoolProgress): SchoolModule | null {
  return moduleForSession(nextSessionNumber(progress));
}

/**
 * The next starred session BEYOND the one about to be played — the thing to
 * look forward to.
 *
 * "Coming up: Fork Festival" is worth more to an eight-year-old than any
 * percentage, which is why the home screen leads with this and not a bar.
 * Strictly beyond `next`, so it never repeats the "up next" card when the
 * next session happens to be starred itself.
 */
export function nextBigMoment(progress: SchoolProgress): SchoolSession | null {
  const next = nextSessionNumber(progress);
  return (
    SCHOOL_SESSIONS.find((s) => s.starred && s.number > next && !progress.completedSessions.includes(s.number)) ??
    null
  );
}

/**
 * Superpower ids revealed so far, newest first.
 *
 * Driven by each superpower's own `unlockedBySession`, not by a session's
 * `superpowerId` — session 7 reveals two (Queen and King) and a session can
 * only name one as its headline. The registry is the source of truth.
 */
export function unlockedSuperpowerIds(progress: SchoolProgress): readonly string[] {
  return PIECE_SUPERPOWERS.filter((sp) => progress.completedSessions.includes(sp.unlockedBySession))
    .sort((a, b) => b.unlockedBySession - a.unlockedBySession)
    .map((sp) => sp.id);
}

export { TOTAL_SESSIONS };

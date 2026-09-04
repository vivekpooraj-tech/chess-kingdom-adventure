import type { ChatTurn } from "./types";
import type { OllieReviewContext } from "./reviewContext";
import type { ExperienceLevel, AgeBand } from "@/lib/learner/experienceLevel";

export const MAX_MESSAGE_LENGTH = 500;
export const MAX_HISTORY_MESSAGES = 16;
export const MAX_HISTORY_MESSAGE_LENGTH = 1000;
const MAX_FIELD_LENGTH = 200;

export interface ValidatedCoachRequest {
  message: string;
  history: ChatTurn[];
  boardFen?: string;
  lessonTitle?: string;
  dayNumber?: number;
  lessonTopic?: string;
  buddyName?: string;
  childId?: string;
  reviewContext?: OllieReviewContext;
  experienceLevel?: ExperienceLevel;
  ageBand?: AgeBand;
}

const EXPERIENCE_LEVELS = new Set(["new", "knows_basics", "plays_regularly"]);
const AGE_BANDS = new Set(["young", "tween", "teen", "adult"]);
const REVIEW_CATEGORIES = new Set(["inaccuracy", "mistake", "blunder"]);

/** Validates the optional Game Review context block. Every field is
 * optional; strings are hard-clipped, numbers bounded, unknown keys
 * dropped — the client is never trusted. Returns undefined if the block is
 * absent or not an object. */
function validateReviewContext(raw: unknown): OllieReviewContext | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown, n = 60): string | undefined =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, n) : undefined;
  const num = (v: unknown, lo: number, hi: number): number | undefined =>
    typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : undefined;
  const bool = (v: unknown): boolean | undefined => (typeof v === "boolean" ? v : undefined);

  const ctx: OllieReviewContext = {
    playerColor: r.playerColor === "w" || r.playerColor === "b" ? r.playerColor : undefined,
    result: r.result === "win" || r.result === "loss" || r.result === "draw" ? r.result : undefined,
    accuracy: num(r.accuracy, 0, 100),
    mistakeCount: num(r.mistakeCount, 0, 200),
    blunderCount: num(r.blunderCount, 0, 200),
    moveNumber: num(r.moveNumber, 0, 300),
    playedSan: str(r.playedSan, 12),
    bestSan: str(r.bestSan, 12),
    category: REVIEW_CATEGORIES.has(r.category as string) ? (r.category as OllieReviewContext["category"]) : undefined,
    missedMate: bool(r.missedMate),
    missedMaterial: bool(r.missedMaterial),
    skillName: str(r.skillName, 40),
    whatToNotice: str(r.whatToNotice, 200),
    fenBefore: typeof r.fenBefore === "string" && r.fenBefore.length <= 100 ? r.fenBefore : undefined,
    recurringSkill: bool(r.recurringSkill),
    practiceSkillName: str(r.practiceSkillName, 40),
  };
  return ctx;
}

export type ValidationResult =
  | { ok: true; data: ValidatedCoachRequest }
  | { ok: false; error: string };

/**
 * Server-side gate on everything the client sends -- the client is never
 * trusted to have already enforced these limits itself. Rejects rather
 * than silently truncating malformed shapes (a bad `from` role in history,
 * a non-string field) so a client bug surfaces immediately instead of
 * quietly sending garbage to the model.
 */
export function validateCoachRequest(body: unknown): ValidationResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid request body" };
  }
  const b = body as Record<string, unknown>;

  if (typeof b.message !== "string") {
    return { ok: false, error: "message is required" };
  }
  const message = b.message.trim();
  if (!message) {
    return { ok: false, error: "message is required" };
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, error: "message is too long" };
  }

  let history: ChatTurn[] = [];
  if (b.history !== undefined) {
    if (!Array.isArray(b.history)) {
      return { ok: false, error: "history must be an array" };
    }
    if (b.history.length > 200) {
      return { ok: false, error: "history is too long" };
    }
    for (const turn of b.history) {
      if (
        !turn ||
        typeof turn !== "object" ||
        (turn as any).from !== "buddy" && (turn as any).from !== "child" ||
        typeof (turn as any).text !== "string"
      ) {
        return { ok: false, error: "history contains an invalid entry" };
      }
      if ((turn as any).text.length > MAX_HISTORY_MESSAGE_LENGTH) {
        return { ok: false, error: "a history entry is too long" };
      }
    }
    history = (b.history as ChatTurn[]).slice(-MAX_HISTORY_MESSAGES);
  }

  const boardFen =
    typeof b.boardFen === "string" && b.boardFen.length <= 100 ? b.boardFen : undefined;
  const lessonTitle =
    typeof b.lessonTitle === "string" ? b.lessonTitle.slice(0, MAX_FIELD_LENGTH) : undefined;
  const dayNumber =
    typeof b.dayNumber === "number" && Number.isFinite(b.dayNumber) ? b.dayNumber : undefined;
  const lessonTopic =
    typeof b.lessonTopic === "string" ? b.lessonTopic.slice(0, MAX_FIELD_LENGTH) : undefined;
  const buddyName =
    typeof b.buddyName === "string" ? b.buddyName.slice(0, MAX_FIELD_LENGTH) : undefined;
  const childId = typeof b.childId === "string" ? b.childId : undefined;
  const reviewContext = validateReviewContext(b.reviewContext);
  const experienceLevel =
    typeof b.experienceLevel === "string" && EXPERIENCE_LEVELS.has(b.experienceLevel)
      ? (b.experienceLevel as ExperienceLevel)
      : undefined;
  const ageBand =
    typeof b.ageBand === "string" && AGE_BANDS.has(b.ageBand) ? (b.ageBand as AgeBand) : undefined;

  return {
    ok: true,
    data: {
      message,
      history,
      boardFen,
      lessonTitle,
      dayNumber,
      lessonTopic,
      buddyName,
      childId,
      reviewContext,
      experienceLevel,
      ageBand,
    },
  };
}

import type { ChatTurn } from "./types";

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

  return {
    ok: true,
    data: { message, history, boardFen, lessonTitle, dayNumber, lessonTopic, buddyName, childId },
  };
}

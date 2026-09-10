import type { ChessTimeSession } from "./types";
import type { ChessTimeActivityId } from "./types";

/** Session is PIN-locked until parent exits — includes expired completion state. */
export function isChessTimeLocked(session: ChessTimeSession | null | undefined): boolean {
  return session?.active === true;
}

/**
 * When Chess Time has expired but the session is still PIN-locked, hide all
 * app navigation so the child stays on the completion hub.
 */
export function shouldHideAppNavDuringLock(
  session: ChessTimeSession | null | undefined,
  expired: boolean
): boolean {
  return isChessTimeLocked(session) && expired;
}

/**
 * Activities for filtered nav during an active (non-expired) lock.
 * Returns null when nav should show normally or be fully hidden (expired lock).
 */
export function chessTimeNavActivities(
  session: ChessTimeSession | null | undefined,
  expired: boolean
): ChessTimeActivityId[] | null {
  if (!isChessTimeLocked(session)) return null;
  if (expired) return null;
  return session!.allowedActivities;
}

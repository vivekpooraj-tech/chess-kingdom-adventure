import { isActivityAllowed } from "./activities";
import type { ChessTimeSession } from "./types";
import { isChessTimeExpired } from "./chessTime";

/** Parent Lock admin — reachable only after parent gate in normal flow. */
const PARENT_ADMIN_PREFIXES = ["/parent-dashboard"];

export function shouldRedirectToChessTimeHub(input: {
  pathname: string;
  session: ChessTimeSession | null;
  nowMs?: number;
}): boolean {
  const { pathname, session, nowMs = Date.now() } = input;
  if (!session?.active) return false;

  // Parent admin (dashboard, daily limits, Parent Lock settings) must stay
  // reachable even when the child's focus session has expired — the child
  // stays on /chess-time until PIN exit; the grown-up still needs to adjust
  // limits on the same device.
  if (
    PARENT_ADMIN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  ) {
    return false;
  }

  if (isChessTimeExpired(session, nowMs)) return pathname !== "/chess-time";
  if (pathname === "/chess-time" || pathname.startsWith("/chess-time/")) return false;

  return !isActivityAllowed(pathname, session.allowedActivities);
}

export function chessTimeHubHref(): string {
  return "/chess-time";
}

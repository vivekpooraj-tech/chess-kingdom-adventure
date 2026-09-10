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
  if (isChessTimeExpired(session, nowMs)) return pathname !== "/chess-time";
  if (pathname === "/chess-time" || pathname.startsWith("/chess-time/")) return false;

  if (
    PARENT_ADMIN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  ) {
    return false;
  }

  return !isActivityAllowed(pathname, session.allowedActivities);
}

export function chessTimeHubHref(): string {
  return "/chess-time";
}

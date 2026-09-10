import type { ChessTimeActivity, ChessTimeActivityId } from "./types";

export const CHESS_TIME_ACTIVITIES: ChessTimeActivity[] = [
  {
    id: "chess_school",
    label: "Chess School",
    emoji: "🏫",
    description: "Structured lessons and the beginner course",
  },
  {
    id: "play",
    label: "Play Chess",
    emoji: "♟",
    description: "Free play, vs computer, and online games",
  },
  {
    id: "puzzles",
    label: "Puzzles",
    emoji: "🧩",
    description: "Tactics trainer and daily puzzles",
  },
  {
    id: "world",
    label: "Chess Mind World",
    emoji: "🌍",
    description: "Play in scenic world backdrops",
  },
  {
    id: "academy",
    label: "Academy",
    emoji: "📚",
    description: "Openings, strategy, and learning courses",
  },
];

/** Route prefixes allowed per activity during Chess Time. */
export const ACTIVITY_ROUTE_PREFIXES: Record<ChessTimeActivityId, readonly string[]> = {
  chess_school: ["/chess-school", "/lesson"],
  play: ["/play", "/free-play", "/matchmaking", "/online"],
  puzzles: ["/puzzles"],
  world: ["/world"],
  academy: ["/academy", "/learn", "/chess-mind"],
};

/**
 * Routes always reachable during Chess Time — auth, Chess Time hub, parent setup.
 * Parent dashboard itself stays behind parent-gate; listed here so a parent who
 * exits with PIN is not bounced.
 */
export const CHESS_TIME_ALWAYS_ALLOWED_PREFIXES: readonly string[] = [
  "/chess-time",
  "/sign-in",
  "/auth",
  "/welcome",
  "/onboarding",
  "/choose-child",
  "/parent-gate",
  "/reset-password",
  "/upgrade",
];

export function getActivityForPath(pathname: string): ChessTimeActivityId | null {
  for (const activity of CHESS_TIME_ACTIVITIES) {
    const prefixes = ACTIVITY_ROUTE_PREFIXES[activity.id];
    if (prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      return activity.id;
    }
  }
  return null;
}

export function isActivityAllowed(
  pathname: string,
  allowed: readonly ChessTimeActivityId[]
): boolean {
  if (
    CHESS_TIME_ALWAYS_ALLOWED_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    )
  ) {
    return true;
  }
  const activity = getActivityForPath(pathname);
  if (!activity) return false;
  return allowed.includes(activity);
}

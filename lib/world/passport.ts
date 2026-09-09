/**
 * The World Passport — where you have actually played.
 *
 * WHAT IS RECORDED, AND WHEN. Real events only:
 *
 *   visitedAt  the first time a location's scene was opened
 *   playedAt   the first time a GAME was actually started there
 *   games      how many games have been started there
 *   firstWinAt the first time a game STARTED here was actually WON
 *   wins       how many of those games were won
 *
 * "Played" means a real game began — not a card tapped, not a preview
 * scrolled past. A win means chess.js declared checkmate for the child's
 * side in a game that was actually played there — see recordGameWon's call
 * site in app/free-play/page.tsx's own onGameOver handler, the same real
 * event Free Play already uses to decide what to show the child. Nothing
 * here is awarded for looking, and there is no badge a learner did not earn
 * by playing.
 *
 * WHY A WIN CAN BE RECORDED WITHOUT A DATABASE TABLE FOR IT. Free Play's AI
 * games have no server-side row at all — confirmed in
 * lib/supabase/queries.ts's startAiGame: "Free Play has no server-side game
 * row; Stockfish runs client-side." That is an existing, deliberate product
 * choice this feature does not change. The win is still a REAL event (the
 * browser genuinely sees checkmate happen); it is simply — like every other
 * field here — not synced across devices. Building a database table
 * specifically so a World achievement could sync would mean the World
 * inventing persistence Free Play itself doesn't have, which is a bigger
 * and riskier change than the achievement is worth.
 *
 * WHERE IT LIVES. localStorage, per device. Stated plainly rather than
 * hidden: a passport does not follow a child between devices, and clearing
 * site data clears it. The alternative is a database migration this session
 * cannot apply, and a passport backed by a table that does not exist would be
 * exactly the fake progress this product does not ship. When the World earns
 * a table, this module is the one place that has to change — every reader
 * goes through it.
 *
 * Everything is pure except read/write, and those never throw.
 */
import { isWorldLocationId, getWorldLocation, type WorldLocationId } from "./locations";

export interface PassportEntry {
  /** ISO timestamp of the first visit. */
  visitedAt: string;
  /** ISO timestamp of the first game started here, or null if none yet. */
  playedAt: string | null;
  /** Games started here. Never decremented, never inflated. */
  games: number;
  /** ISO timestamp of the first WIN here, or null if none yet. */
  firstWinAt: string | null;
  /** Games won here. Never exceeds `games`. */
  wins: number;
}

export type Passport = Partial<Record<WorldLocationId, PassportEntry>>;

export const PASSPORT_STORAGE_KEY = "chessmind.world.passport.v1";

function normalizeEntry(raw: unknown): PassportEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const visitedAt = typeof value.visitedAt === "string" ? value.visitedAt : null;
  if (!visitedAt) return null;
  const games = Number(value.games);
  const wins = Number(value.wins);
  const safeGames = Number.isFinite(games) && games > 0 ? Math.floor(games) : 0;
  // Junk, negatives and fractions all collapse to something honest rather
  // than to a bigger number — and wins can never exceed games, or a
  // corrupted/hand-edited value in storage could claim more victories than
  // games ever played.
  const safeWins = Number.isFinite(wins) && wins > 0 ? Math.min(Math.floor(wins), safeGames) : 0;
  return {
    visitedAt,
    playedAt: typeof value.playedAt === "string" ? value.playedAt : null,
    games: safeGames,
    firstWinAt: safeWins > 0 && typeof value.firstWinAt === "string" ? value.firstWinAt : null,
    wins: safeWins,
  };
}

/** Coerce anything at all into a valid passport. Unknown ids are dropped. */
export function normalizePassport(raw: unknown): Passport {
  if (!raw || typeof raw !== "object") return {};
  const out: Passport = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isWorldLocationId(id)) continue;
    const entry = normalizeEntry(value);
    if (entry) out[id] = entry;
  }
  return out;
}

export function parsePassport(json: string | null): Passport {
  if (!json) return {};
  try {
    return normalizePassport(JSON.parse(json));
  } catch {
    return {};
  }
}

const EMPTY_ENTRY = (now: string): PassportEntry => ({
  visitedAt: now,
  playedAt: null,
  games: 0,
  firstWinAt: null,
  wins: 0,
});

/** Record a visit. Never overwrites an earlier first-visit timestamp. */
export function withVisit(passport: Passport, id: WorldLocationId, now: string): Passport {
  if (!isWorldLocationId(id)) return passport;
  const existing = passport[id];
  if (existing) return passport;
  return { ...passport, [id]: EMPTY_ENTRY(now) };
}

/**
 * Record that a game was STARTED here.
 *
 * Also records a visit if somehow none exists — you cannot have played
 * somewhere you never went, and a passport that says otherwise is wrong.
 */
export function withGame(passport: Passport, id: WorldLocationId, now: string): Passport {
  if (!isWorldLocationId(id)) return passport;
  const existing = passport[id] ?? EMPTY_ENTRY(now);
  return {
    ...passport,
    [id]: {
      ...existing,
      playedAt: existing.playedAt ?? now,
      games: existing.games + 1,
    },
  };
}

/**
 * Record that a game played here was WON.
 *
 * Deliberately does NOT call withGame: the game itself was already counted
 * when it STARTED (recordGameStarted, called the moment a difficulty is
 * picked in Free Play) — calling withGame again here would double-count
 * that same game. If somehow no game was ever recorded (a win reported with
 * no matching start, which real gameplay cannot produce), one game is
 * credited so the entry can never read "0 games, 1 win" — a contradiction a
 * parent could actually notice — but this is a defensive floor, not the
 * normal path.
 */
export function withWin(passport: Passport, id: WorldLocationId, now: string): Passport {
  if (!isWorldLocationId(id)) return passport;
  const existing = passport[id] ?? EMPTY_ENTRY(now);
  return {
    ...passport,
    [id]: {
      ...existing,
      playedAt: existing.playedAt ?? now,
      games: Math.max(existing.games, 1),
      firstWinAt: existing.firstWinAt ?? now,
      wins: existing.wins + 1,
    },
  };
}

/** Locations where a real game has been played. */
export function playedLocations(passport: Passport): WorldLocationId[] {
  return (Object.keys(passport) as WorldLocationId[]).filter((id) => passport[id]?.playedAt);
}

/** Total games across the whole world. */
export function totalGames(passport: Passport): number {
  return Object.values(passport).reduce((sum, entry) => sum + (entry?.games ?? 0), 0);
}

/** The location most recently played in, or null. Ties break by id so the
 *  answer is stable rather than dependent on object key order. */
export function lastPlayed(passport: Passport): WorldLocationId | null {
  let best: WorldLocationId | null = null;
  let bestAt = "";
  for (const id of Object.keys(passport) as WorldLocationId[]) {
    const at = passport[id]?.playedAt;
    if (!at) continue;
    if (at > bestAt || (at === bestAt && best !== null && id < best)) {
      best = id;
      bestAt = at;
    }
  }
  return best;
}

export interface WorldAchievement {
  key: string;
  locationId: WorldLocationId;
  title: string;
  description: string;
  emoji: string;
  earnedAt: string;
}

/**
 * Derives earned achievements straight from the passport — never a separate
 * "earned" list that could drift from the counts a parent can also see.
 * Two per location, matching the brief's own examples exactly: a first game
 * and a first win. Both require the real event (playedAt / firstWinAt) to
 * be set; nothing here is granted for a visit alone.
 */
export function worldAchievements(passport: Passport): WorldAchievement[] {
  const out: WorldAchievement[] = [];
  for (const id of Object.keys(passport) as WorldLocationId[]) {
    const entry = passport[id];
    if (!entry) continue;
    const location = getWorldLocation(id);
    if (!location) continue;

    if (entry.playedAt) {
      out.push({
        key: `${id}:first_game`,
        locationId: id,
        title: `First Game in ${location.title}`,
        description: `Played your first game at ${location.title}.`,
        emoji: location.emoji,
        earnedAt: entry.playedAt,
      });
    }
    if (entry.firstWinAt) {
      out.push({
        key: `${id}:first_win`,
        locationId: id,
        title: `First Victory in ${location.title}`,
        description: `Won your first game at ${location.title}.`,
        emoji: "🏆",
        earnedAt: entry.firstWinAt,
      });
    }
  }
  // Oldest first — reads as a timeline of how the world was discovered.
  return out.sort((a, b) => (a.earnedAt < b.earnedAt ? -1 : a.earnedAt > b.earnedAt ? 1 : 0));
}

// --- Storage (never throws) ------------------------------------------------

export function readPassport(): Passport {
  if (typeof window === "undefined") return {};
  try {
    return parsePassport(window.localStorage.getItem(PASSPORT_STORAGE_KEY));
  } catch {
    return {};
  }
}

export function writePassport(passport: Passport): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PASSPORT_STORAGE_KEY, JSON.stringify(normalizePassport(passport)));
  } catch {
    /* private mode, quota, blocked site data */
  }
}

export function recordVisit(id: WorldLocationId): Passport {
  const next = withVisit(readPassport(), id, new Date().toISOString());
  writePassport(next);
  return next;
}

export function recordGameStarted(id: WorldLocationId): Passport {
  const next = withGame(readPassport(), id, new Date().toISOString());
  writePassport(next);
  return next;
}

export function recordGameWon(id: WorldLocationId): Passport {
  const next = withWin(readPassport(), id, new Date().toISOString());
  writePassport(next);
  return next;
}

// --- The chosen location (also per device) ---------------------------------

export const SELECTED_LOCATION_KEY = "chessmind.world.location.v1";

export function readSelectedLocation(): WorldLocationId | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(SELECTED_LOCATION_KEY);
    return isWorldLocationId(value) ? value : null;
  } catch {
    return null;
  }
}

/** Pass null to go back to the plain board. */
export function writeSelectedLocation(id: WorldLocationId | null): void {
  if (typeof window === "undefined") return;
  try {
    if (id === null) window.localStorage.removeItem(SELECTED_LOCATION_KEY);
    else if (isWorldLocationId(id)) window.localStorage.setItem(SELECTED_LOCATION_KEY, id);
  } catch {
    /* not worth failing a game for */
  }
}

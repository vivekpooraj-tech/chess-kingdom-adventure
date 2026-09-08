/**
 * The World Passport — where you have actually played.
 *
 * WHAT IS RECORDED, AND WHEN. Exactly two things, both real events:
 *
 *   visitedAt  the first time a location's scene was opened
 *   playedAt   the first time a GAME was actually started there
 *   games      how many games have been started there
 *
 * "Played" means a real game began — not a card tapped, not a preview
 * scrolled past. Nothing is awarded for looking, and there is no badge here
 * that a learner did not earn by playing.
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
import { isWorldLocationId, type WorldLocationId } from "./locations";

export interface PassportEntry {
  /** ISO timestamp of the first visit. */
  visitedAt: string;
  /** ISO timestamp of the first game started here, or null if none yet. */
  playedAt: string | null;
  /** Games started here. Never decremented, never inflated. */
  games: number;
}

export type Passport = Partial<Record<WorldLocationId, PassportEntry>>;

export const PASSPORT_STORAGE_KEY = "chessmind.world.passport.v1";

function normalizeEntry(raw: unknown): PassportEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const visitedAt = typeof value.visitedAt === "string" ? value.visitedAt : null;
  if (!visitedAt) return null;
  const games = Number(value.games);
  return {
    visitedAt,
    playedAt: typeof value.playedAt === "string" ? value.playedAt : null,
    // Junk, negatives and fractions all collapse to something honest rather
    // than to a bigger number.
    games: Number.isFinite(games) && games > 0 ? Math.floor(games) : 0,
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

/** Record a visit. Never overwrites an earlier first-visit timestamp. */
export function withVisit(passport: Passport, id: WorldLocationId, now: string): Passport {
  if (!isWorldLocationId(id)) return passport;
  const existing = passport[id];
  if (existing) return passport;
  return { ...passport, [id]: { visitedAt: now, playedAt: null, games: 0 } };
}

/**
 * Record that a game was STARTED here.
 *
 * Also records a visit if somehow none exists — you cannot have played
 * somewhere you never went, and a passport that says otherwise is wrong.
 */
export function withGame(passport: Passport, id: WorldLocationId, now: string): Passport {
  if (!isWorldLocationId(id)) return passport;
  const existing = passport[id] ?? { visitedAt: now, playedAt: null, games: 0 };
  return {
    ...passport,
    [id]: {
      visitedAt: existing.visitedAt,
      playedAt: existing.playedAt ?? now,
      games: existing.games + 1,
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

/**
 * Player statistics — what the game record can honestly support.
 *
 * Pure: no I/O. The caller fetches rows; this decides what may be shown.
 *
 * The hard part of a stats page is not arithmetic, it is refusing to answer.
 * A win rate over four games is noise, and "you are weaker as Black" drawn
 * from a 3-game gap is worse than saying nothing — it sends someone off to fix
 * a problem they do not have. So every figure here carries its own state, and
 * a caller cannot render a number without also learning whether that number
 * means anything:
 *
 *   { kind: "none" }          nothing recorded yet
 *   { kind: "insufficient" }  some data, not enough to speak — with how many
 *                             games are still needed, so the UI can say so
 *   { kind: "ok" }            enough evidence
 *
 * Comparative claims (White vs Black, one time control vs another) go further
 * and require a two-proportion z-test at 95%, so a difference is reported only
 * when it is unlikely to be chance. That is the difference between a stats
 * page and a horoscope.
 *
 * This deliberately does NOT score skills. lib/learner/chessBrain.ts already
 * covers that from real skill signals, and duplicating it here with a rival
 * set of numbers would leave two panels disagreeing about the same player.
 */

/** Below this, a percentage is noise; show counts instead. */
export const MIN_GAMES_FOR_RATE = 10;
/** Per-bucket minimum before a split (colour, time control) gets a rate. */
export const MIN_GAMES_PER_SPLIT = 8;
/** A trend needs two windows to compare. */
export const TREND_WINDOW = 10;
export const MIN_GAMES_FOR_TREND = TREND_WINDOW * 2;

export type Stat<T> =
  | { kind: "none" }
  | { kind: "insufficient"; have: number; need: number }
  | { kind: "ok"; value: T };

export function ok<T>(value: T): Stat<T> {
  return { kind: "ok", value };
}

/** A finished game, from this child's point of view. */
export interface GameRecord {
  id: string;
  /** ISO timestamp the game was created. */
  playedAt: string;
  /** The colour this child had. */
  color: "w" | "b";
  result: "win" | "loss" | "draw";
  /** Time-control id (e.g. "5+0"), or null for legacy untimed games. */
  timeControl: string | null;
  /** "random" (rated) or "invite" / tournament. */
  matchType: string;
  ratingBefore: number | null;
  ratingAfter: number | null;
}

export interface Record3 {
  games: number;
  wins: number;
  losses: number;
  draws: number;
}

const EMPTY_RECORD: Record3 = { games: 0, wins: 0, losses: 0, draws: 0 };

export function tally(games: GameRecord[]): Record3 {
  const r = { ...EMPTY_RECORD, games: games.length };
  for (const g of games) {
    if (g.result === "win") r.wins++;
    else if (g.result === "loss") r.losses++;
    else r.draws++;
  }
  return r;
}

/**
 * Win rate as a fraction, counting a draw as half a point — the scoring chess
 * actually uses. A "win rate" that discards draws would flatter anyone who
 * draws a lot and is not what any chess player means by the term.
 */
export function scoreRate(r: Record3): number | null {
  if (r.games === 0) return null;
  return (r.wins + r.draws * 0.5) / r.games;
}

export function rateStat(r: Record3, min = MIN_GAMES_FOR_RATE): Stat<number> {
  if (r.games === 0) return { kind: "none" };
  if (r.games < min) return { kind: "insufficient", have: r.games, need: min };
  return ok(scoreRate(r)!);
}

/**
 * Two-proportion z-test, normal approximation.
 *
 * Returns true when two score rates differ enough that chance is an unlikely
 * explanation (|z| >= 1.96, i.e. p < 0.05 two-tailed). Used to gate every
 * comparative claim, so the app never tells someone their Black games are a
 * weakness on the strength of a coin-flip.
 *
 * The normal approximation needs a few successes and failures in each group to
 * be trustworthy, so it declines below that rather than reporting nonsense.
 */
export function isSignificantDifference(a: Record3, b: Record3): boolean {
  if (a.games < MIN_GAMES_PER_SPLIT || b.games < MIN_GAMES_PER_SPLIT) return false;
  const pa = scoreRate(a);
  const pb = scoreRate(b);
  if (pa === null || pb === null) return false;

  const pooled = (a.wins + a.draws * 0.5 + (b.wins + b.draws * 0.5)) / (a.games + b.games);
  // Guard the degenerate all-wins / all-losses case, where the pooled variance
  // is zero and z would be infinite.
  if (pooled <= 0 || pooled >= 1) return false;
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / a.games + 1 / b.games));
  if (se === 0) return false;
  return Math.abs((pa - pb) / se) >= 1.96;
}

export interface SplitRow<K extends string = string> {
  key: K;
  label: string;
  record: Record3;
  /** Null until the bucket has enough games of its own. */
  rate: number | null;
}

function splitRow<K extends string>(key: K, label: string, games: GameRecord[]): SplitRow<K> {
  const record = tally(games);
  return {
    key,
    label,
    record,
    rate: record.games >= MIN_GAMES_PER_SPLIT ? scoreRate(record) : null,
  };
}

/** Results by the colour the child played. */
export function byColor(games: GameRecord[]): {
  white: SplitRow<"w">;
  black: SplitRow<"b">;
  /** A claim about the difference, only when it survives the significance test. */
  claim: string | null;
} {
  const white = splitRow("w", "As White", games.filter((g) => g.color === "w"));
  const black = splitRow("b", "As Black", games.filter((g) => g.color === "b"));

  let claim: string | null = null;
  if (isSignificantDifference(white.record, black.record)) {
    const wr = scoreRate(white.record)!;
    const br = scoreRate(black.record)!;
    const stronger = wr > br ? "White" : "Black";
    const weaker = wr > br ? "Black" : "White";
    claim = `You score meaningfully better as ${stronger} than as ${weaker}. Reviewing a few of your ${weaker} games is likely the fastest gain available.`;
  }
  return { white, black, claim };
}

/** Results by time control, bucketed by the pacing category. */
export function byTimeControl(
  games: GameRecord[],
  categoryOf: (id: string | null) => string | null
): SplitRow[] {
  const buckets = new Map<string, GameRecord[]>();
  for (const g of games) {
    const cat = categoryOf(g.timeControl);
    if (!cat) continue;
    const list = buckets.get(cat);
    if (list) list.push(g);
    else buckets.set(cat, [g]);
  }
  return [...buckets.entries()]
    .map(([cat, list]) => splitRow(cat, cat, list))
    .sort((a, b) => b.record.games - a.record.games);
}

export type Direction = "improving" | "steady" | "declining";

/**
 * Direction of results over time, comparing the most recent window against the
 * one before it.
 *
 * Requires the difference to clear the same significance bar as every other
 * comparison here — "you are improving" is exactly the kind of encouraging
 * claim it is tempting to make from noise, and the one a learner will most
 * resent discovering was invented.
 */
export function resultTrend(games: GameRecord[]): Stat<Direction> {
  if (games.length === 0) return { kind: "none" };
  if (games.length < MIN_GAMES_FOR_TREND) {
    return { kind: "insufficient", have: games.length, need: MIN_GAMES_FOR_TREND };
  }
  // Oldest first, so "recent" is the tail.
  const ordered = [...games].sort((a, b) => a.playedAt.localeCompare(b.playedAt));
  const recent = tally(ordered.slice(-TREND_WINDOW));
  const previous = tally(ordered.slice(-TREND_WINDOW * 2, -TREND_WINDOW));

  if (!isSignificantDifference(recent, previous)) return ok<Direction>("steady");
  return ok<Direction>(scoreRate(recent)! > scoreRate(previous)! ? "improving" : "declining");
}

/** Longest run of consecutive wins ending at the most recent game. */
export function currentWinStreak(games: GameRecord[]): number {
  const ordered = [...games].sort((a, b) => b.playedAt.localeCompare(a.playedAt));
  let n = 0;
  for (const g of ordered) {
    if (g.result !== "win") break;
    n++;
  }
  return n;
}

/** Peak rating seen in the record, from the rating values games carry. */
export function peakRating(
  games: GameRecord[],
  currentRating: number | null,
  /** Ratings from rating_history, oldest or newest order — only the max matters. */
  historyRatings: number[] = []
): Stat<number> {
  const values: number[] = [];
  for (const g of games) {
    if (typeof g.ratingAfter === "number") values.push(g.ratingAfter);
    if (typeof g.ratingBefore === "number") values.push(g.ratingBefore);
  }
  for (const r of historyRatings) {
    if (typeof r === "number") values.push(r);
  }

  // The current rating alone is NOT a peak. Every child starts on a default
  // (400 now, 1200 historically), so counting it unconditionally reported
  // "Peak rating 1200" to someone who had never played a rated game — a number
  // they never reached, presented as an achievement. A peak needs at least one
  // real recorded rating; without one the UI shows "no rated games yet", which
  // is what its own fallback copy already says.
  if (!values.length) return { kind: "none" };

  if (typeof currentRating === "number") values.push(currentRating);
  return ok(Math.max(...values));
}

/** Games inside a period, for the 7/30/90/all filters. */
export function withinDays(games: GameRecord[], days: number | null, now = Date.now()): GameRecord[] {
  if (days === null) return games;
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  return games.filter((g) => {
    const t = Date.parse(g.playedAt);
    return Number.isFinite(t) && t >= cutoff;
  });
}

export interface PlayerOverview {
  record: Record3;
  rate: Stat<number>;
  trend: Stat<Direction>;
  streak: number;
  peak: Stat<number>;
  rated: Record3;
}

export function buildOverview(
  games: GameRecord[],
  currentRating: number | null,
  historyRatings: number[] = []
): PlayerOverview {
  return {
    record: tally(games),
    rate: rateStat(tally(games)),
    trend: resultTrend(games),
    streak: currentWinStreak(games),
    peak: peakRating(games, currentRating, historyRatings),
    rated: tally(games.filter((g) => g.matchType === "random")),
  };
}

/**
 * Opening results, from reviewed games.
 *
 * Openings come from child_game_reviews.opening_name, which is only populated
 * for games that were actually reviewed — so this measures reviewed games, not
 * all games, and the UI must say so rather than implying full coverage.
 *
 * The threshold matters more here than anywhere else on the page. Telling
 * someone the Caro-Kann is their weakest opening on the strength of two losses
 * is how players abandon openings that were fine.
 */
export const MIN_GAMES_PER_OPENING = 6;

export interface OpeningRow {
  name: string;
  record: Record3;
  /** Null until the opening clears MIN_GAMES_PER_OPENING. */
  rate: number | null;
}

export interface OpeningInsights {
  /** Every opening seen, most-played first. */
  rows: OpeningRow[];
  /** Only set when at least one opening has a real sample. */
  best: OpeningRow | null;
  worst: OpeningRow | null;
  /** True when openings were seen but none has enough games to rate. */
  allBelowThreshold: boolean;
}

export function byOpening(
  reviews: { openingName: string | null; result: "win" | "loss" | "draw" | null }[]
): OpeningInsights {
  const buckets = new Map<string, Record3>();
  for (const r of reviews) {
    const name = r.openingName?.trim();
    if (!name || !r.result) continue;
    const rec = buckets.get(name) ?? { games: 0, wins: 0, losses: 0, draws: 0 };
    rec.games++;
    if (r.result === "win") rec.wins++;
    else if (r.result === "loss") rec.losses++;
    else rec.draws++;
    buckets.set(name, rec);
  }

  const rows: OpeningRow[] = [...buckets.entries()]
    .map(([name, record]) => ({
      name,
      record,
      rate: record.games >= MIN_GAMES_PER_OPENING ? scoreRate(record) : null,
    }))
    .sort((a, b) => b.record.games - a.record.games);

  const rated = rows.filter((r) => r.rate !== null);
  // Best/worst are only meaningful when there are two rated openings to
  // compare; a single one is just "your opening".
  const best = rated.length >= 2 ? rated.reduce((a, b) => (b.rate! > a.rate! ? b : a)) : null;
  const worst = rated.length >= 2 ? rated.reduce((a, b) => (b.rate! < a.rate! ? b : a)) : null;

  return { rows, best, worst, allBelowThreshold: rows.length > 0 && rated.length === 0 };
}

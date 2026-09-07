/**
 * Which abandoned games can be settled without a browser, and which must be
 * left alone.
 *
 * Pure: no I/O, no clock of its own — `serverNow` is passed in. That is what
 * makes every branch below testable without a database.
 *
 * IMPORTANT — this module is NOT the authority.
 *
 * It decides only whether a game is worth asking the database about. The
 * actual settlement is done by claim_timeout_as_server, which re-reads the row
 * under `for update` and redoes this arithmetic against clock_timestamp(). If
 * this module and the database ever disagree, the database wins and the
 * sweeper simply reports that it settled nothing. Selecting a candidate is a
 * hint; finishing a game is a transaction.
 *
 * The governing rule, from which everything else follows:
 *
 *   A game should remain unresolved rather than have a winner invented for it.
 *
 * So every uncertain case resolves to "skip", and the reasons are enumerated
 * rather than collapsed into a boolean, because the dry-run report has to be
 * able to explain itself for each individual row.
 */

/** The columns the sweeper needs. Deliberately not the whole row: `moves` and
 *  `fen` are never loaded, because settlement is decided by the clock. */
export interface SweepableGame {
  id: string;
  status: string;
  /** '10+0', '3+2', … or null for an untimed game. */
  time_control: string | null;
  /** 'w' | 'b' — whose clock is running. Null on rows predating clocks. */
  current_turn: string | null;
  /** ISO timestamp of the last move, or of game creation for move one. */
  last_move_at: string | null;
  white_time_ms: number | null;
  black_time_ms: number | null;
  match_type: string;
  rating_applied: boolean;
  created_at: string;
}

export type SkipReason =
  | "not_active"
  | "untimed"
  | "no_current_turn"
  | "no_last_move_at"
  | "malformed_clock"
  | "time_remaining";

export type SweepDecision =
  | {
      action: "settle";
      /** The side that ran out — the OTHER side wins. Advisory; the database
       *  recomputes it. Reported so a dry run can be checked by eye. */
      flagged: "w" | "b";
      expectedWinner: "w" | "b";
      /** How far past zero the clock is, by this module's arithmetic. */
      overshootMs: number;
    }
  | {
      action: "skip";
      reason: SkipReason;
      /** Present when the clock is simply still running. */
      remainingMs?: number;
    };

/**
 * Grace period before a flagged clock is settled.
 *
 * The sweeper is not competing with the players. A client that is still open
 * calls claim_timeout the instant the flag falls, which is the better
 * experience (immediate, and the loser sees it happen). This exists for games
 * nobody is watching, so it can afford to wait — and waiting removes any
 * chance of racing a move that is legitimately in flight when the cron fires.
 *
 * Correctness does not depend on this value: the database re-checks the clock
 * under a row lock either way. It only decides how eagerly the sweeper acts.
 */
export const SETTLEMENT_GRACE_MS = 30_000;

/** Clocks above this are treated as corrupt rather than believed. 24h is far
 *  past the longest control the app offers (15+10). */
const MAX_PLAUSIBLE_CLOCK_MS = 24 * 60 * 60 * 1000;

/**
 * Decide what the sweeper should do with one game.
 *
 * `serverNow` must come from the server (or the database), never from a
 * browser — a client-supplied clock is exactly the thing this whole subsystem
 * exists to avoid trusting.
 */
export function decideSweep(game: SweepableGame, serverNow: Date): SweepDecision {
  // Already finished, still waiting for an opponent, or anything else: not
  // ours. Checked first so a finished game is cheap to skip on every run.
  if (game.status !== "active") {
    return { action: "skip", reason: "not_active" };
  }

  // No clock means no way to prove anyone lost. An abandoned untimed game is
  // genuinely undecidable — neither player has forfeited anything — so it
  // stays active. See the module docs in app/api/cron/settle-games.
  if (game.time_control === null) {
    return { action: "skip", reason: "untimed" };
  }

  // Rows created before clocks existed. Without knowing whose turn it is,
  // there is no way to say whose clock was running.
  if (game.current_turn !== "w" && game.current_turn !== "b") {
    return { action: "skip", reason: "no_current_turn" };
  }

  if (!game.last_move_at) {
    return { action: "skip", reason: "no_last_move_at" };
  }

  const lastMoveMs = Date.parse(game.last_move_at);
  if (!Number.isFinite(lastMoveMs)) {
    return { action: "skip", reason: "no_last_move_at" };
  }

  const stored = game.current_turn === "w" ? game.white_time_ms : game.black_time_ms;
  if (
    typeof stored !== "number" ||
    !Number.isFinite(stored) ||
    stored < 0 ||
    stored > MAX_PLAUSIBLE_CLOCK_MS
  ) {
    return { action: "skip", reason: "malformed_clock" };
  }

  // A last_move_at in the future means the row is wrong, or this process's
  // clock is behind the database's. Either way, do not settle on it: elapsed
  // would be negative and the game would look healthier than it is, which is
  // the safe direction, but say so explicitly rather than by accident.
  const elapsedMs = serverNow.getTime() - lastMoveMs;
  if (elapsedMs < 0) {
    return { action: "skip", reason: "malformed_clock" };
  }

  const remainingMs = stored - elapsedMs;

  if (remainingMs + SETTLEMENT_GRACE_MS > 0) {
    return { action: "skip", reason: "time_remaining", remainingMs };
  }

  const flagged = game.current_turn;
  return {
    action: "settle",
    flagged,
    expectedWinner: flagged === "w" ? "b" : "w",
    overshootMs: -remainingMs,
  };
}

/**
 * Should the sweeper try to settle the rating for this game after finishing it?
 *
 * apply_match_rating is itself idempotent and re-checks all of this under a row
 * lock, so this is purely about not making a pointless round trip.
 */
export function shouldSettleRating(game: Pick<SweepableGame, "match_type" | "rating_applied">): boolean {
  return game.match_type === "random" && !game.rating_applied;
}

/**
 * Stale WAITING games are deliberately NOT swept. See the reasoning in
 * app/api/cron/settle-games/route.ts; this function exists so the dry-run
 * report can state the decision for waiting rows rather than omitting them.
 */
export function describeWaiting(game: SweepableGame, serverNow: Date): string {
  const ageH = Math.floor((serverNow.getTime() - Date.parse(game.created_at)) / 3_600_000);
  return `waiting ${ageH}h — left alone (an unjoined invite reserves nothing and may still be opened)`;
}

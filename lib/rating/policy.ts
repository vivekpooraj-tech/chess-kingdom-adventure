/**
 * Chess Mind competitive rating policy: the single written-down copy of the numbers behind public.apply_match_rating (migration 0056).
 *
 * The database is the authority (it runs the update, server side, once per game). This module is the same rule in TypeScript so the UI can
 * quote the numbers and so scripts/test-rating-policy.js can check the SQL against it. It is NOT a second formula: it is the Elo logistic that
 * 0008/0020/0026 have always used, with the K factor chosen once per game from how many rated games the two players have completed.
 *
 *   - New players start at STARTING_RATING (1200). Existing players keep whatever they have: this number is only the default for NEW rows.
 *   - A player is provisional for their first PROVISIONAL_GAMES completed rated games.
 *   - K is per GAME: if EITHER player is provisional, K = K_PROVISIONAL for BOTH players; otherwise K = K_ESTABLISHED (32, the value that was
 *     always used) for both. Both players move by the same K, so one player's gain is the other's loss (apart from rounding and the floor).
 *   - A rating never falls below RATING_FLOOR.
 *   - "Completed rated game" = a random-match game whose rating was applied (one rating_history row per player per game). Training, puzzles,
 *     logins, computer games, invite games, tournament games and abandoned pre-start matches are never counted and never move a rating.
 *   - Lichess ratings are a different rating on a different site: nothing here reads, converts or writes them (see lib/lichess/ratings.ts).
 *     Lichess fallback matchmaking is not implemented yet.
 */
export const STARTING_RATING = 1200;
export const RATING_FLOOR = 400;
export const PROVISIONAL_GAMES = 10;
export const K_PROVISIONAL = 64;
export const K_ESTABLISHED = 32;

/** Provisional until PROVISIONAL_GAMES rated games are complete. `gamesCompleted` counts games BEFORE the one being settled. */
export function isProvisional(gamesCompleted: number): boolean {
  return gamesCompleted < PROVISIONAL_GAMES;
}

/** The one K used for BOTH players of a game: provisional if either of them is still provisional. Arguments are games completed BEFORE it. */
export function kFactorForGame(gamesCompletedA: number, gamesCompletedB: number): number {
  return isProvisional(gamesCompletedA) || isProvisional(gamesCompletedB) ? K_PROVISIONAL : K_ESTABLISHED;
}

/** Elo expected score of a player rated `rating` against `opponent`. */
export function expectedScore(rating: number, opponent: number): number {
  return 1 / (1 + Math.pow(10, (opponent - rating) / 400));
}

/**
 * The player's new rating after one rated game. `score` is 1 (win), 0.5 (draw) or 0 (loss); `ownGames` and `opponentGames` are how many rated
 * games each player had completed before this one (the same K applies to both). Rounded and floored exactly as the SQL does (round half away
 * from zero, then greatest(floor, ...)); ratings are positive, so that is round half up.
 */
export function ratingAfter(rating: number, opponent: number, score: number, ownGames: number, opponentGames: number): number {
  const raw = rating + kFactorForGame(ownGames, opponentGames) * (score - expectedScore(rating, opponent));
  return Math.max(RATING_FLOOR, Math.round(raw));
}

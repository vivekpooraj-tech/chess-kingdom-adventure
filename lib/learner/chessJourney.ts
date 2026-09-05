/**
 * "Your Chess Journey" — the time dimension of a learner's progress.
 *
 * The app could already say what a child is good at and what to work on (see
 * chessBrain.ts). What it could never say is whether any of it is WORKING:
 * every stat on the profile was a lifetime total, so a child who had improved
 * enormously and one who had plateaued saw the same six counters.
 *
 * This module answers "am I improving, and how have I changed?" from two
 * records the app already writes on every rated game and every reviewed game:
 * rating_history and child_game_reviews.
 *
 * The hard part is not the arithmetic, it is refusing to answer. A trend drawn
 * from three games is noise wearing a graph's clothes, and a child shown
 * "you're declining" after two unlucky matches learns the wrong lesson from a
 * number that means nothing. So every claim here has a minimum sample, and
 * below it the honest output is "not enough games yet" rather than a shape.
 *
 * Pure — no I/O. The caller fetches; this decides what may honestly be said.
 */

import type { RatingPoint } from "@/lib/supabase/queries";
import type { LearnerReviewRow } from "@/lib/ollie/learnerContext";

/**
 * Rated games needed before a rating direction is claimed.
 *
 * Chess ratings are volatile: a provisional player can swing 100 points in
 * three games without their strength changing at all. Eight is the point at
 * which a direction starts reflecting play rather than pairing luck, and it is
 * also roughly a week of casual play — recent enough to feel like "me now".
 */
export const MIN_RATED_GAMES_FOR_TREND = 8;

/** Reviewed games needed before an accuracy direction is claimed (4 per half). */
export const MIN_REVIEWS_FOR_TREND = 8;

/** Rating points inside which a change is called steady rather than movement. */
const RATING_NOISE_BAND = 15;

/** Accuracy points inside which a change is called steady. */
const ACCURACY_NOISE_BAND = 4;

export type Direction = "improving" | "steady" | "dipping";

export interface RatingJourney {
  current: number;
  /** Net change across the window, not lifetime. */
  change: number;
  direction: Direction;
  gamesInWindow: number;
  best: number;
  /** Newest-last, for a sparkline. */
  series: number[];
  record: { wins: number; losses: number; draws: number };
}

export interface AccuracyJourney {
  direction: Direction;
  /** Mean accuracy of the newer half, rounded. */
  recent: number;
  /** Mean accuracy of the older half, rounded. */
  previous: number;
  reviewsInWindow: number;
}

export interface ChessJourney {
  /** Null when there are too few rated games to say anything honest. */
  rating: RatingJourney | null;
  /** Null when there are too few reviewed games. */
  accuracy: AccuracyJourney | null;
  /** How many more rated games are needed before a trend appears. Only set
   *  while below the threshold, so the UI can tell the child what unlocks it
   *  instead of just showing nothing. */
  ratedGamesNeeded: number | null;
  isEmpty: boolean;
}

function direction(delta: number, band: number): Direction {
  if (delta > band) return "improving";
  if (delta < -band) return "dipping";
  return "steady";
}

function mean(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

function buildRating(points: RatingPoint[]): RatingJourney | null {
  if (points.length < MIN_RATED_GAMES_FOR_TREND) return null;

  const series = points.map((p) => p.newRating);
  const change = points.reduce((s, p) => s + p.ratingChange, 0);
  const record = { wins: 0, losses: 0, draws: 0 };
  for (const p of points) {
    if (p.result === "win") record.wins++;
    else if (p.result === "loss") record.losses++;
    else record.draws++;
  }

  return {
    current: series[series.length - 1],
    change,
    direction: direction(change, RATING_NOISE_BAND),
    gamesInWindow: points.length,
    best: Math.max(...series),
    series,
    record,
  };
}

function buildAccuracy(reviews: LearnerReviewRow[]): AccuracyJourney | null {
  // Callers pass newest-first (that is what getRecentGameReviews returns).
  const scored = reviews
    .filter((r): r is LearnerReviewRow & { accuracy: number } => typeof r.accuracy === "number")
    .slice(0, 20);
  if (scored.length < MIN_REVIEWS_FOR_TREND) return null;

  const half = Math.floor(scored.length / 2);
  const recent = mean(scored.slice(0, half).map((r) => r.accuracy));
  const previous = mean(scored.slice(half).map((r) => r.accuracy));

  return {
    direction: direction(recent - previous, ACCURACY_NOISE_BAND),
    recent: Math.round(recent),
    previous: Math.round(previous),
    reviewsInWindow: scored.length,
  };
}

export function buildChessJourney(
  ratingPoints: RatingPoint[],
  reviews: LearnerReviewRow[]
): ChessJourney {
  // Defensive despite the types: this runs during a page render, and both
  // callers get their inputs from queries that swallow failures. A missing
  // array here would take the whole profile down over a stats panel.
  const points = Array.isArray(ratingPoints) ? ratingPoints : [];
  const reviewRows = Array.isArray(reviews) ? reviews : [];

  const rating = buildRating(points);
  const accuracy = buildAccuracy(reviewRows);

  // Only offer the "N more games" nudge when they have actually started —
  // telling someone with zero rated games that they need eight more is a
  // chore, not encouragement.
  const ratedGamesNeeded =
    rating === null && points.length > 0 ? MIN_RATED_GAMES_FOR_TREND - points.length : null;

  return {
    rating,
    accuracy,
    ratedGamesNeeded,
    isEmpty: rating === null && accuracy === null && ratedGamesNeeded === null,
  };
}

/** Child-readable phrasing. Deliberately gentle on the down case: a dip is a
 *  normal part of playing stronger opponents, not a failure to announce. */
export function describeDirection(d: Direction, subject: "rating" | "accuracy"): string {
  if (subject === "rating") {
    if (d === "improving") return "Your rating is climbing.";
    if (d === "dipping") return "Your rating dipped a little in this stretch.";
    return "Your rating is holding steady.";
  }
  if (d === "improving") return "Your accuracy is improving.";
  if (d === "dipping") return "Your accuracy slipped a little recently.";
  return "Your accuracy is holding steady.";
}

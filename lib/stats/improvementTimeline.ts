/**
 * Rating progression over time.
 *
 * Pure: no I/O.
 *
 * rating_history has been recorded for a while but nothing ever drew it. This
 * turns those rows into a chronological view of whether a player is actually
 * climbing — the single question a rating is for.
 *
 * The honesty problem here is different from win rates. A two-point line is
 * drawable but meaningless: it always looks like a dramatic rise or fall
 * because there is nothing else on the axis. So a timeline needs a real number
 * of rated games before it is shown at all, and below that the UI is told
 * exactly how many more are needed rather than being handed a misleading chart.
 */

export interface RatingPoint {
  newRating: number;
  ratingChange: number;
  result: "win" | "loss" | "draw";
  createdAt: string;
}

/** Fewer rated games than this cannot make a meaningful line. */
export const MIN_POINTS_FOR_TIMELINE = 5;

export interface TimelineLocked {
  kind: "locked";
  have: number;
  need: number;
}

export interface TimelineReady {
  kind: "ready";
  points: RatingPoint[];
  first: number;
  last: number;
  /** last - first across the whole window. */
  net: number;
  min: number;
  max: number;
  /** Highest rating reached anywhere in the window. */
  peak: number;
  /** Normalised 0..1 coordinates, oldest first, for drawing. */
  coords: { x: number; y: number }[];
}

export type ImprovementTimeline = TimelineLocked | TimelineReady;

/**
 * `points` must be oldest-first (getRatingTimeline already reverses into that
 * order). Anything shorter than the minimum returns a locked state.
 */
export function buildImprovementTimeline(points: RatingPoint[]): ImprovementTimeline {
  if (points.length < MIN_POINTS_FOR_TIMELINE) {
    return { kind: "locked", have: points.length, need: MIN_POINTS_FOR_TIMELINE };
  }

  const ratings = points.map((p) => p.newRating);
  const min = Math.min(...ratings);
  const max = Math.max(...ratings);
  const first = ratings[0];
  const last = ratings[ratings.length - 1];

  // A flat line still has to render sensibly: with no spread, every point sits
  // on the middle of the box rather than dividing by zero.
  const span = max - min;
  const coords = ratings.map((r, i) => ({
    x: points.length === 1 ? 0.5 : i / (points.length - 1),
    y: span === 0 ? 0.5 : 1 - (r - min) / span,
  }));

  return {
    kind: "ready",
    points,
    first,
    last,
    net: last - first,
    min,
    max,
    peak: max,
    coords,
  };
}

/**
 * A plain-language summary of the window, or null when the movement is too
 * small to be worth a sentence. Rating noise of a few points is not a story.
 */
export function describeTimeline(t: ImprovementTimeline): string | null {
  if (t.kind === "locked") return null;
  if (Math.abs(t.net) < 10) {
    return `Your rating has held steady around ${t.last} across these ${t.points.length} rated games.`;
  }
  if (t.net > 0) {
    return `You have gained ${t.net} rating points across these ${t.points.length} rated games.`;
  }
  return `You are down ${Math.abs(t.net)} rating points across these ${t.points.length} rated games. Rating dips are normal; the trend over more games is what matters.`;
}

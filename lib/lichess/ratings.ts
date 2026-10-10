import { isLichessEligible } from "./eligibility";

/**
 * Which Lichess rating applies to a Chess Mind speed, for the Lichess fallback. A Lichess rating is a different rating on a different site: this
 * module only ever RETURNS one. It never converts it, never substitutes the Chess Mind rating for a missing one, and nothing in it can write
 * either rating (Chess Mind's rating moves only inside public.apply_match_rating, for Chess Mind games).
 *
 * Eligibility is checked here as well as at connection time, so a caller cannot get a Lichess rating for someone who must never be sent to
 * Lichess: only an explicitly connected adult (age band "adult", see ./eligibility) qualifies, and an unknown age band never does.
 */
export type LichessPerfName = "bullet" | "blitz" | "rapid" | "classical";

export type LichessPerf = { rating?: number; games?: number; prov?: boolean };
export type LichessPerfs = Partial<Record<string, LichessPerf | undefined>>;

/** Lichess groups a game by its estimated duration in seconds: base time + 40 increments (bullet < 180, blitz < 480, rapid < 1500). */
export function lichessPerfForTimeControl(timeControl: string): LichessPerfName | null {
  const m = /^(\d+)\+(\d+)$/.exec(timeControl.trim());
  if (!m) return null;
  const estimated = Number(m[1]) * 60 + Number(m[2]) * 40;
  if (estimated < 180) return "bullet";
  if (estimated < 480) return "blitz";
  if (estimated < 1500) return "rapid";
  return "classical";
}

export type LichessRating = { perf: LichessPerfName; rating: number; provisional: boolean };

/**
 * The player's actual Lichess rating for the selected speed, or null when it is not available, when the speed is unknown, or when the player is
 * not an explicitly connected adult. Null means "no Lichess rating": the caller must not fall back to the Chess Mind rating or invent a number.
 */
export function lichessRatingFor(input: {
  ageBand: string | null | undefined;
  connected: boolean;
  perfs: LichessPerfs | null | undefined;
  timeControl: string;
}): LichessRating | null {
  if (!input.connected || !isLichessEligible(input.ageBand)) return null;
  const perf = lichessPerfForTimeControl(input.timeControl);
  if (!perf) return null;
  const p = input.perfs?.[perf];
  if (!p || typeof p.rating !== "number" || !Number.isFinite(p.rating)) return null;
  return { perf, rating: Math.round(p.rating), provisional: p.prov === true };
}

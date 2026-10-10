/**
 * How much of a video has ACTUALLY been played, for features that unlock after N seconds of playback (the welcome intro's Skip button).
 *
 * It is a running total of the playback time that passed between two consecutive `timeupdate` events, so it is not:
 *   - wall-clock time since the page opened (a viewer who stares at a paused or buffering video earns nothing);
 *   - `currentTime` (a seek to the end must not look like "20 seconds watched").
 *
 * Rules:
 *   - paused, or in the middle of a seek: nothing counts;
 *   - a forward jump bigger than MAX_STEP seconds between two updates is a seek, not playback: nothing counts;
 *   - a backward move (replay, seek back) counts nothing, and watching on from there counts again;
 *   - buffering: the clock stands still while the picture does, so nothing counts, and on resume the baseline is re-read (resync);
 *   - the total never goes down, so "reached" never flips back once it is true.
 */
export const SKIP_AFTER_SECONDS = 20;

/** Largest forward step between two timeupdates still treated as normal playback (browsers fire ~4 per second; throttled tabs far fewer). */
export const MAX_STEP_SECONDS = 3;

export interface PlaybackClock {
  /** Seconds of real playback so far. */
  watched: number;
  /** currentTime at the previous update, or null when there is no baseline yet. */
  last: number | null;
}

export function createPlaybackClock(): PlaybackClock {
  return { watched: 0, last: null };
}

/** Call from `timeupdate`. Returns the total seconds of real playback so far. */
export function tick(clock: PlaybackClock, currentTime: number, state: { paused: boolean; seeking: boolean }): number {
  const last = clock.last;
  clock.last = currentTime;
  if (last === null || state.paused || state.seeking) return clock.watched;
  const step = currentTime - last;
  if (step > 0 && step <= MAX_STEP_SECONDS) clock.watched += step;
  return clock.watched;
}

/** Call from `play`, `playing`, `seeking`, `seeked` and `waiting`: forget the baseline so a jump or a gap can never be counted as playback. */
export function resync(clock: PlaybackClock, currentTime: number): void {
  clock.last = currentTime;
}

export function reached(clock: PlaybackClock, seconds: number = SKIP_AFTER_SECONDS): boolean {
  return clock.watched >= seconds;
}

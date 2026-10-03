/**
 * The welcome video's fallback decision, as a pure state machine.
 *
 * The Play / Continue overlay must mean "autoplay genuinely cannot proceed",
 * not "the video was slow to start". A fixed deadline from page-ready
 * conflated the two: on a slow Android launch the decoder started ~11.5s
 * after launch, the 8s timer had already shown the overlay, and autoplay
 * then succeeded underneath it.
 *
 * So the fallback is driven by what the video is actually doing:
 *  - a real `error`, or both autoplay attempts rejecting, falls back at once;
 *  - otherwise it only falls back when the video has gone silent
 *    (NO_PROGRESS_MS with no loading/playback event), or as a last-resort
 *    ceiling (MAX_WAIT_MS) so a trickling connection can never trap the user;
 *  - the same silence rule applies after playback has started, so a video
 *    that freezes mid-play still reaches Continue;
 *  - `waiting` / `stalled` are not failures;
 *  - `playing` always wins and clears any fallback, however late it arrives;
 *  - a promise result from an older attempt can never act on a newer one.
 *
 * Pure: events in, state + side-effect requests out. The page owns the
 * timers, the <video> element and navigation. Timestamps only need to be
 * monotonic and in milliseconds.
 */

/**
 * No loading or playback event at all for this long = the video is stuck.
 * Deliberately above the slowest observed healthy start (~11.5s on a real
 * Android launch), so a slow-but-live start does not flash the overlay even
 * if the media stack emits nothing in the meantime.
 */
export const NO_PROGRESS_MS = 15_000;
/** Absolute ceiling from ready (or from a Play tap), even if events trickle in. */
export const MAX_WAIT_MS = 30_000;
/**
 * The page ticks every second. A gap much larger than that means the page
 * itself was suspended or starved (backgrounded app, blocked main thread,
 * clock jump), so the silence during the gap says nothing about the video.
 */
export const TICK_GAP_FORGIVE_MS = 3_000;

export type WelcomePhase = "loading" | "starting" | "playing" | "fallback" | "settled";
export type WelcomeFailure = "error" | "autoplay-blocked" | "stalled" | "timeout" | null;

export interface WelcomeState {
  phase: WelcomePhase;
  failure: WelcomeFailure;
  readyAt: number | null;
  lastProgressAt: number | null;
  lastTickAt: number | null;
  /** Id of the newest play attempt; results from older ids are ignored. */
  attempt: number;
  soundTried: boolean;
  mutedTried: boolean;
}

export type WelcomeEvent =
  | { type: "ready"; at: number }
  | { type: "progress"; at: number } // loadstart/progress/loadedmetadata/loadeddata/timeupdate…
  | { type: "canplay"; at: number }
  | { type: "unmuted-rejected"; at: number; attempt: number }
  | { type: "muted-rejected"; at: number; attempt: number }
  | { type: "playing"; at: number }
  | { type: "error"; at: number }
  | { type: "waiting"; at: number } // informational only
  | { type: "stalled"; at: number } // informational only
  | { type: "tap-play"; at: number }
  | { type: "tick"; at: number }
  | { type: "settled"; at: number };

export interface WelcomeEffect {
  kind: "play-unmuted" | "play-muted";
  /** Echoed back on the rejection event so stale results can be recognised. */
  attempt: number;
}

export interface WelcomeStep {
  state: WelcomeState;
  effects: WelcomeEffect[];
}

export function initialWelcomeState(): WelcomeState {
  return {
    phase: "loading",
    failure: null,
    readyAt: null,
    lastProgressAt: null,
    lastTickAt: null,
    attempt: 0,
    soundTried: false,
    mutedTried: false,
  };
}

function done(state: WelcomeState): boolean {
  return state.phase === "playing" || state.phase === "settled";
}

function fallback(state: WelcomeState, failure: Exclude<WelcomeFailure, null>): WelcomeState {
  return { ...state, phase: "fallback", failure };
}

/** A real load/decode error is the more useful reason; keep it. */
function holdsError(state: WelcomeState): boolean {
  return state.phase === "fallback" && state.failure === "error";
}

export function reduceWelcome(prev: WelcomeState, event: WelcomeEvent): WelcomeStep {
  if (prev.phase === "settled") return { state: prev, effects: [] };

  // Whatever the first event is, that is when the clock starts.
  const state: WelcomeState = {
    ...prev,
    readyAt: prev.readyAt ?? event.at,
    lastProgressAt: prev.lastProgressAt ?? event.at,
  };

  switch (event.type) {
    case "ready":
      return { state, effects: [] };

    case "progress":
      // Also counts while playing: timeupdate is what shows playback is alive.
      return { state: { ...state, lastProgressAt: event.at }, effects: [] };

    case "canplay": {
      if (done(state)) return { state, effects: [] };
      const next: WelcomeState = {
        ...state,
        lastProgressAt: event.at,
        phase: state.phase === "fallback" ? "fallback" : "starting",
      };
      if (state.soundTried) return { state: next, effects: [] };
      // One sound-first attempt per load; never retried, never unmuted later.
      const attempt = state.attempt + 1;
      return {
        state: { ...next, soundTried: true, attempt },
        effects: [{ kind: "play-unmuted", attempt }],
      };
    }

    case "unmuted-rejected": {
      if (done(state) || event.attempt !== state.attempt || holdsError(state)) {
        return { state, effects: [] };
      }
      if (!state.mutedTried) {
        return {
          state: { ...state, mutedTried: true },
          effects: [{ kind: "play-muted", attempt: state.attempt }],
        };
      }
      return { state: fallback(state, "autoplay-blocked"), effects: [] };
    }

    case "muted-rejected":
      if (done(state) || event.attempt !== state.attempt || holdsError(state)) {
        return { state, effects: [] };
      }
      return { state: fallback(state, "autoplay-blocked"), effects: [] };

    case "playing":
      return {
        state: { ...state, phase: "playing", failure: null, lastProgressAt: event.at },
        effects: [],
      };

    case "error":
      if (done(state)) return { state, effects: [] };
      return { state: fallback(state, "error"), effects: [] };

    case "waiting":
    case "stalled":
      return { state, effects: [] };

    case "tap-play": {
      if (done(state)) return { state, effects: [] };
      // Fresh attempt from a user gesture: restart both clocks so the stale
      // tick that put the overlay up cannot immediately put it back, and
      // retire any attempt still in flight.
      const attempt = state.attempt + 1;
      return {
        state: {
          ...state,
          phase: "starting",
          failure: null,
          soundTried: true,
          mutedTried: false,
          attempt,
          readyAt: event.at,
          lastProgressAt: event.at,
        },
        effects: [{ kind: "play-unmuted", attempt }],
      };
    }

    case "tick": {
      const gap = state.lastTickAt === null ? 0 : event.at - state.lastTickAt;
      // A suspended/starved page cannot judge silence: forgive the gap.
      const lastProgressAt = gap > TICK_GAP_FORGIVE_MS ? event.at : (state.lastProgressAt as number);
      const next: WelcomeState = { ...state, lastTickAt: event.at, lastProgressAt };
      if (next.phase === "loading" || next.phase === "starting") {
        if (event.at - (next.readyAt as number) >= MAX_WAIT_MS) {
          return { state: fallback(next, "timeout"), effects: [] };
        }
      } else if (next.phase !== "playing") {
        return { state: next, effects: [] };
      }
      if (event.at - lastProgressAt >= NO_PROGRESS_MS) {
        return { state: fallback(next, "stalled"), effects: [] };
      }
      return { state: next, effects: [] };
    }

    case "settled":
      return { state: { ...state, phase: "settled" }, effects: [] };
  }
}

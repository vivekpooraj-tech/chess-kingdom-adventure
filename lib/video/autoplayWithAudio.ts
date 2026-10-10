/**
 * Start a video with sound if the browser allows it, and silently otherwise.
 *
 * Order, and nothing else:
 *   1. try UNMUTED autoplay (no tap needed);
 *   2. if the browser refuses (autoplay policy: NotAllowedError, or any older WebView's equivalent), try MUTED autoplay so the video still plays;
 *   3. if even that is refused, nothing is playing: leave the element unmuted, so that when the viewer taps Play (a user gesture, which browsers
 *      always honour) it starts WITH sound.
 *
 * It never starts muted and later unmutes by itself: once step 2 ran, only the viewer's own "Sound On" tap can turn the sound on. Callers must
 * therefore run this ONCE per video element (the page guards it), because `canplay` fires again after every rebuffer or seek.
 *
 * Browsers decide whether step 1 is allowed (user activation on the page, a muted/unmuted policy, the WebView's own setting). This code only
 * asks and reacts to the answer: it can never force sound to autoplay where the browser prohibits it.
 */
export type AutoplayOutcome =
  | "unmuted" // playing, with sound
  | "muted" // playing, muted (the browser blocked unmuted autoplay)
  | "blocked" // nothing could start; the element is left unmuted for a tap on Play
  | "interrupted"; // the element was paused / removed while starting (AbortError): nothing to react to

export type PlayableVideo = { muted: boolean; play: () => Promise<void> | void };

const isAbort = (e: unknown) => !!e && typeof e === "object" && (e as { name?: string }).name === "AbortError";

async function attempt(video: PlayableVideo): Promise<void> {
  const result = video.play();
  // Very old WebViews return undefined instead of a promise: there is no rejection to wait for, so treat the call as started.
  if (result && typeof (result as Promise<void>).then === "function") await result;
}

export async function startWithAudioFirst(video: PlayableVideo): Promise<AutoplayOutcome> {
  video.muted = false;
  try {
    await attempt(video);
    return "unmuted";
  } catch (e) {
    if (isAbort(e)) return "interrupted";
  }
  video.muted = true;
  try {
    await attempt(video);
    return "muted";
  } catch (e) {
    video.muted = false;
    return isAbort(e) ? "interrupted" : "blocked";
  }
}

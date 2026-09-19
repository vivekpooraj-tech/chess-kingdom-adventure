/**
 * Subtle background music for the World pre-game cinematic
 * (components/world/LocationCinematic.tsx) — deliberately isolated from
 * lib/sound/moveSound.ts's chess move/capture/checkmate sounds: separate
 * module, separate concern, never touched by or touching that system. This
 * is not a global audio system — it manages exactly one music track at a
 * time, scoped to however long the cinematic is on screen.
 *
 * AUTOPLAY: the cinematic's own <video> plays muted (video autoplay is
 * always allowed), but audible MUSIC needs the same real user gesture the
 * difficulty button already provides. primeCinematicAudio() must be called
 * synchronously inside that button's onClick — before the async
 * startAiGame() round-trip that precedes the cinematic actually mounting —
 * so the very first Audio.play() on the page happens inside a genuine
 * gesture. WebView/Chromium then extend that page's audio-autoplay
 * allowance to later NON-gesture play() calls in the same session (the same
 * mechanism ChessBoard's own local auto-opponent move-sound already relies
 * on), so playCinematicMusic() — called later, from an effect once the
 * cinematic mounts — is then allowed to play audibly without its own fresh
 * gesture.
 */

let unlocked = false;
let currentAudio: HTMLAudioElement | null = null;

/** Call synchronously inside a real user gesture (the difficulty button's
 * onClick), before any `await`. Silent and instantaneous — pauses itself
 * immediately, so nothing is ever audible from this call itself. */
export function primeCinematicAudio(): void {
  if (unlocked || typeof window === "undefined") return;
  try {
    const a = new Audio();
    a.volume = 0;
    a.play()?.catch(() => {});
    a.pause();
    unlocked = true;
  } catch {
    // Nothing to do — playCinematicMusic()'s own play().catch() below still
    // degrades gracefully even if priming didn't take.
  }
}

/**
 * Subtle: ~20% volume, well under normal app audio (chess move sounds,
 * opening/login-welcome video audio) so it never competes with them.
 * Never loops — the cinematic itself plays exactly once.
 */
const MUSIC_VOLUME = 0.6;

export function playCinematicMusic(url: string): void {
  stopCinematicMusic();
  if (typeof window === "undefined") return;
  const audio = new Audio(url);
  audio.volume = MUSIC_VOLUME;
  audio.loop = false;
  audio.play().catch(() => {
    // Blocked or failed to load — the cinematic's video and the game start
    // are completely unaffected; the player simply gets no music this time.
  });
  currentAudio = audio;
}

/** Idempotent — safe to call from settle() and from an effect's cleanup
 * without double-handling. */
export function stopCinematicMusic(): void {
  if (!currentAudio) return;
  currentAudio.pause();
  currentAudio.currentTime = 0;
  currentAudio = null;
}

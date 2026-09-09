/**
 * Voice narration — the provider contract.
 *
 * Chess Mind teaches children, some of whom cannot yet read comfortably.
 * Narration exists for them. It is ALWAYS additive: every word spoken is
 * already on screen, so a learner with no speech synthesis, no permission, or
 * no interest loses nothing at all. Nothing in a lesson may ever depend on
 * having heard something.
 *
 * The provider is abstracted so the Web Speech implementation — which is free,
 * needs no key and no network — can be swapped for a hosted voice later
 * without touching a single lesson component.
 */

/** Who is being spoken to. Changes the words, not just the voice. */
export type VoiceRegister = "child" | "adult";

export type NarrationState =
  | "idle"
  | "speaking"
  | "paused"
  /** The device or browser cannot speak at all. */
  | "unavailable";

export interface SpeakOptions {
  /** 0.1–10 in the Web Speech spec; we keep well inside a sane band. */
  rate?: number;
  pitch?: number;
  /** BCP-47, e.g. "en-GB". Used to pick a voice, never to translate. */
  lang?: string;
}

export interface VoiceProvider {
  readonly id: string;
  /** Cheap, synchronous capability check. Must never throw. */
  isAvailable(): boolean;
  /**
   * Speak `text`, replacing anything currently being spoken.
   *
   * Only ever called from a user gesture — see useNarration. A provider must
   * not queue behind an existing utterance: a learner who presses play on a
   * new step expects that step, not a backlog.
   */
  speak(text: string, options?: SpeakOptions): void;
  pause(): void;
  resume(): void;
  /** Idempotent. Safe to call when nothing is speaking. */
  stop(): void;
  /** Subscribe to state changes; returns an unsubscribe function. */
  subscribe(listener: (state: NarrationState) => void): () => void;
  getState(): NarrationState;
}

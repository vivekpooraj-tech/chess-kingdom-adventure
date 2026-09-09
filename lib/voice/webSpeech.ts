"use client";

import type { NarrationState, SpeakOptions, VoiceProvider } from "./types";
import { chunkForSpeech, pickVoice } from "./script";

/**
 * Narration on the Web Speech API.
 *
 * Chosen because it costs nothing, needs no API key, sends no audio anywhere
 * and works offline. It is also inconsistent between browsers, so this file
 * is mostly about containing that:
 *
 *   - Long utterances get truncated or stall, so text is chunked and queued
 *     (chunkForSpeech).
 *   - getVoices() is empty until the voiceschanged event fires on some
 *     engines, so voice selection is done at speak time, not at construction.
 *   - A cancel() while speaking fires an "error" or "end" event depending on
 *     the browser; both are treated as "we stopped", not as a failure.
 *   - Chrome pauses synthesis when a tab is backgrounded and does not always
 *     resume; stopping on hide is more honest than leaving a stuck control.
 *
 * NOTHING here starts on its own. speak() is only ever called from a user
 * gesture (see useNarration), which is both an accessibility requirement and
 * the browser's own autoplay rule.
 */

type Synth = SpeechSynthesis;

function getSynth(): Synth | null {
  if (typeof window === "undefined") return null;
  const synth = window.speechSynthesis;
  if (!synth || typeof window.SpeechSynthesisUtterance !== "function") return null;
  return synth;
}

export function createWebSpeechProvider(): VoiceProvider {
  let state: NarrationState = "idle";
  const listeners = new Set<(s: NarrationState) => void>();
  /** Chunks still to speak for the current request. */
  let queue: string[] = [];
  let cancelling = false;

  const setState = (next: NarrationState) => {
    if (state === next) return;
    state = next;
    for (const listener of listeners) {
      try {
        listener(next);
      } catch {
        /* a broken subscriber must not stop narration */
      }
    }
  };

  const speakNext = (synth: Synth, options: SpeakOptions) => {
    const text = queue.shift();
    if (!text) {
      setState("idle");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    const lang = options.lang ?? "en-GB";
    utterance.lang = lang;
    // Clamped: engines behave badly outside this band, and an unlistenable
    // voice is the same as no voice for the child who needs it.
    utterance.rate = Math.min(Math.max(options.rate ?? 1, 0.5), 1.5);
    utterance.pitch = Math.min(Math.max(options.pitch ?? 1, 0.5), 1.5);

    let voices: SpeechSynthesisVoice[] = [];
    try {
      voices = synth.getVoices() ?? [];
    } catch {
      voices = [];
    }
    const voice = pickVoice(voices, lang);
    if (voice) utterance.voice = voice;

    utterance.onend = () => {
      if (cancelling) return;
      if (queue.length > 0) speakNext(synth, options);
      else setState("idle");
    };
    // An error here is almost always "cancelled" or "interrupted". Either way
    // the honest state is "we are no longer speaking" — never a thrown error
    // in the middle of a lesson.
    utterance.onerror = () => {
      queue = [];
      setState("idle");
    };

    setState("speaking");
    try {
      synth.speak(utterance);
    } catch {
      queue = [];
      setState("idle");
    }
  };

  const provider: VoiceProvider = {
    id: "web-speech",

    isAvailable() {
      return getSynth() !== null;
    },

    speak(text, options = {}) {
      const synth = getSynth();
      if (!synth) {
        setState("unavailable");
        return;
      }
      const chunks = chunkForSpeech(text);
      if (chunks.length === 0) {
        setState("idle");
        return;
      }

      // Replace, never queue behind: pressing play on a new step must speak
      // that step, not wait out the previous one.
      cancelling = true;
      try {
        synth.cancel();
      } catch {
        /* nothing was speaking */
      }
      cancelling = false;

      queue = chunks;
      speakNext(synth, options);
    },

    pause() {
      const synth = getSynth();
      if (!synth || state !== "speaking") return;
      try {
        synth.pause();
        setState("paused");
      } catch {
        /* unsupported on some mobile engines; the control just won't latch */
      }
    },

    resume() {
      const synth = getSynth();
      if (!synth || state !== "paused") return;
      try {
        synth.resume();
        setState("speaking");
      } catch {
        setState("idle");
      }
    },

    stop() {
      const synth = getSynth();
      queue = [];
      if (!synth) {
        setState("idle");
        return;
      }
      cancelling = true;
      try {
        synth.cancel();
      } catch {
        /* already stopped */
      }
      cancelling = false;
      setState("idle");
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    getState() {
      return state;
    },
  };

  return provider;
}

/**
 * One provider per document. Speech synthesis is a single global resource —
 * two providers would fight over the same queue and cancel each other, so a
 * lesson and Ollie share this one.
 */
let shared: VoiceProvider | null = null;
export function getVoiceProvider(): VoiceProvider {
  if (!shared) shared = createWebSpeechProvider();
  return shared;
}

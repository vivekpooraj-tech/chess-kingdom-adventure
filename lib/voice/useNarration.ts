"use client";

import { useCallback, useEffect, useState } from "react";
import type { NarrationState } from "./types";
import { getVoiceProvider } from "./webSpeech";
import { voiceSettingsFor } from "./script";
import {
  DEFAULT_PREFERENCES,
  readPreferences,
  writePreferences,
  registerFor,
  type LearningPreferences,
} from "./preference";

/**
 * Narration and learning preferences for a client component.
 *
 * Two rules this hook exists to enforce:
 *
 *   1. NOTHING SPEAKS ON ITS OWN. There is no auto-play path, not even when
 *      narration is enabled — `speak` is returned for a click handler to
 *      call, and the hook never calls it. Enabling narration turns the
 *      CONTROL on, not the sound.
 *   2. Leaving stops the voice. The cleanup below cancels on unmount and when
 *      the tab is hidden, so a lesson closed mid-sentence does not keep
 *      talking from a background tab.
 *
 * Preferences start at their defaults on the server and on the first client
 * render — reading localStorage during render would hydrate-mismatch — and
 * are loaded in an effect. So the first paint always shows narration off,
 * which is also the safe direction to be wrong in.
 */
export function useNarration(neutralTone: boolean) {
  const [prefs, setPrefs] = useState<LearningPreferences>(DEFAULT_PREFERENCES);
  const [state, setState] = useState<NarrationState>("idle");
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    setPrefs(readPreferences());

    const provider = getVoiceProvider();
    setAvailable(provider.isAvailable());
    setState(provider.getState());
    const unsubscribe = provider.subscribe(setState);

    const stopOnHide = () => {
      if (document.visibilityState === "hidden") provider.stop();
    };
    document.addEventListener("visibilitychange", stopOnHide);

    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", stopOnHide);
      provider.stop();
    };
  }, []);

  const update = useCallback((patch: Partial<LearningPreferences>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      writePreferences(next);
      // Turning narration off must silence it immediately, not at the end of
      // the current sentence.
      if (patch.narrationEnabled === false) getVoiceProvider().stop();
      return next;
    });
  }, []);

  const register = registerFor(prefs, neutralTone);

  const speak = useCallback(
    (text: string) => {
      if (!text) return;
      const provider = getVoiceProvider();
      if (!provider.isAvailable()) return;
      provider.speak(text, { ...voiceSettingsFor(register), lang: "en-GB" });
    },
    [register]
  );

  const pause = useCallback(() => getVoiceProvider().pause(), []);
  const resume = useCallback(() => getVoiceProvider().resume(), []);
  const stop = useCallback(() => getVoiceProvider().stop(), []);

  return {
    /** True only when this device can actually speak. */
    available,
    state,
    prefs,
    register,
    setPreferences: update,
    speak,
    pause,
    resume,
    stop,
  };
}

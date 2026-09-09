/**
 * Learning preferences: narration, and the no-reading-required mode.
 *
 * WHERE THIS LIVES, AND WHY.
 *
 * In localStorage, per device — NOT in the children table. Two reasons, and
 * the second is the real one:
 *
 *   1. Adding a column means a migration, and a migration this session cannot
 *      apply is a half-shipped feature.
 *   2. These are device preferences, not identity. Whether narration helps
 *      depends on where you are — a tablet on the sofa with the sound on, a
 *      phone on a bus in silence — not on who you are. A parent turning
 *      narration on for the tablet has not asked for it on the family laptop.
 *
 * The consequence, stated plainly rather than hidden: preferences do not
 * follow a child between devices, and clearing site data resets them. That is
 * an acceptable trade for a preference whose wrong value costs one tap.
 *
 * Everything here is pure except read/write, and those never throw: private
 * browsing, disabled site data and quota errors all degrade to defaults.
 */

/** "auto" follows the learner's stated experience level; the other two are
 *  an explicit choice that overrides it. */
export type VoiceRegisterPreference = "auto" | "child" | "adult";

export interface LearningPreferences {
  /** Narration is OFF until asked for. Nothing ever speaks unprompted. */
  narrationEnabled: boolean;
  /**
   * Minimal-text mode for learners who cannot read comfortably yet: bigger
   * visuals, fewer words, a repeat button. Never hides safety, payment or
   * parent information — see the lesson components that consume it.
   */
  simpleMode: boolean;
  register: VoiceRegisterPreference;
}

export const DEFAULT_PREFERENCES: LearningPreferences = {
  narrationEnabled: false,
  simpleMode: false,
  register: "auto",
};

export const PREFERENCES_STORAGE_KEY = "chessmind.learning.v1";

/**
 * Coerce anything at all into valid preferences.
 *
 * Storage holds whatever an older build, another tab, or a user with dev
 * tools left there. A malformed value must produce defaults, never a crash
 * and never a half-populated object that reads as "narration on".
 */
export function normalizePreferences(raw: unknown): LearningPreferences {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_PREFERENCES };
  const value = raw as Record<string, unknown>;
  return {
    narrationEnabled: value.narrationEnabled === true,
    simpleMode: value.simpleMode === true,
    register:
      value.register === "adult" || value.register === "child" ? value.register : "auto",
  };
}

export function parsePreferences(json: string | null): LearningPreferences {
  if (!json) return { ...DEFAULT_PREFERENCES };
  try {
    return normalizePreferences(JSON.parse(json));
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function serializePreferences(prefs: LearningPreferences): string {
  return JSON.stringify(normalizePreferences(prefs));
}

/** Reads preferences from this device. Returns defaults on any failure. */
export function readPreferences(): LearningPreferences {
  if (typeof window === "undefined") return { ...DEFAULT_PREFERENCES };
  try {
    return parsePreferences(window.localStorage.getItem(PREFERENCES_STORAGE_KEY));
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

/** Writes preferences. Silently does nothing if storage is unavailable —
 *  the setting still applies for this session, it just will not persist. */
export function writePreferences(prefs: LearningPreferences): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, serializePreferences(prefs));
  } catch {
    /* private mode, quota, blocked site data — not worth failing a lesson for */
  }
}

/**
 * The register to narrate in, given the learner's stated experience.
 *
 * Mirrors prefersNeutralHomeTone: an adult learner gets the precise wording,
 * a child gets the warm one. An explicit preference always wins over the
 * inference.
 */
export function registerFor(
  prefs: LearningPreferences,
  neutralTone: boolean
): "child" | "adult" {
  if (prefs.register !== "auto") return prefs.register;
  return neutralTone ? "adult" : "child";
}

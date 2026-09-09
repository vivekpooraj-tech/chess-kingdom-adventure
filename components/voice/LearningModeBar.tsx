"use client";

import type { NarrationState } from "@/lib/voice/types";
import type { LearningPreferences } from "@/lib/voice/preference";
import { NarrationControls } from "./NarrationControls";

/**
 * The one row of learning controls above a lesson: listen, and simple mode.
 *
 * Purely presentational — every value comes in as a prop, so the lesson owns
 * the single useNarration instance and there is no chance of two components
 * fighting over one speech queue.
 *
 * What is deliberately NOT here: an "auto-read" switch. Every browser blocks
 * unprompted speech anyway, and a child arriving at a lesson that starts
 * talking at them is startling rather than helpful. Speech begins on a press.
 */
export function LearningModeBar({
  available,
  state,
  prefs,
  onChange,
  onPlay,
  onPause,
  onResume,
  onStop,
  listenLabel = "Listen",
  className = "",
}: {
  /** False when this device has no speech synthesis at all. */
  available: boolean;
  state: NarrationState;
  prefs: LearningPreferences;
  onChange: (patch: Partial<LearningPreferences>) => void;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  listenLabel?: string;
  className?: string;
}) {
  const toggle =
    "font-classic-body text-xs font-semibold min-h-[44px] px-3.5 rounded-full flex items-center gap-2 border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/60";
  const on = "text-premium-gold border-premium-gold/50 bg-premium-gold/10";
  const off = "text-premium-ivory/60 border-white/15 hover:bg-white/5";

  return (
    <div className={`w-full max-w-lg flex items-center gap-2 flex-wrap ${className}`}>
      {/* The listen toggle only exists where listening is possible. On a
          device with no speech synthesis it is absent rather than disabled —
          there is nothing to explain to the learner, and nothing they can do
          about it. */}
      {available && (
        <button
          type="button"
          onClick={() => onChange({ narrationEnabled: !prefs.narrationEnabled })}
          aria-pressed={prefs.narrationEnabled}
          className={`${toggle} ${prefs.narrationEnabled ? on : off}`}
        >
          <span aria-hidden="true">🔊</span>
          Read aloud
        </button>
      )}

      <button
        type="button"
        onClick={() => onChange({ simpleMode: !prefs.simpleMode })}
        aria-pressed={prefs.simpleMode}
        className={`${toggle} ${prefs.simpleMode ? on : off}`}
      >
        <span aria-hidden="true">🖼️</span>
        Fewer words
      </button>

      {available && prefs.narrationEnabled && (
        <NarrationControls
          state={state}
          onPlay={onPlay}
          onPause={onPause}
          onResume={onResume}
          onStop={onStop}
          label={listenLabel}
        />
      )}
    </div>
  );
}

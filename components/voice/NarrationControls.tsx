"use client";

import type { NarrationState } from "@/lib/voice/types";

/**
 * The listen / pause / repeat control that sits under a lesson step.
 *
 * Design rules, all of them load-bearing:
 *
 *   - It renders NOTHING when the device cannot speak. A dead play button is
 *     a lie about what the app can do.
 *   - The text it narrates is always already on screen. This control adds a
 *     way to hear the lesson; it never becomes the only way to receive it.
 *   - Every button is a real 44px target with a real label, because the
 *     learners most likely to need narration are also the least likely to
 *     manage a 24px icon.
 *   - Nothing here starts on mount. Speech begins on a press, always.
 */
export function NarrationControls({
  state,
  onPlay,
  onPause,
  onResume,
  onStop,
  /** Shown next to the controls so the purpose is legible without reading a
   *  manual — e.g. "Listen to the story". */
  label = "Listen",
  className = "",
}: {
  state: NarrationState;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  label?: string;
  className?: string;
}) {
  if (state === "unavailable") return null;

  const speaking = state === "speaking";
  const paused = state === "paused";

  const button =
    "font-classic-body text-sm font-semibold min-h-[44px] min-w-[44px] px-4 rounded-full flex items-center gap-2 border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/60";

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      {!speaking && !paused && (
        <button
          type="button"
          onClick={onPlay}
          aria-label={`${label} — read this aloud`}
          className={`${button} text-premium-gold border-premium-gold/40 hover:bg-premium-gold/10`}
        >
          <span aria-hidden="true">🔊</span> {label}
        </button>
      )}

      {speaking && (
        <button
          type="button"
          onClick={onPause}
          aria-label="Pause reading"
          className={`${button} text-premium-ivory border-white/20 hover:bg-white/5`}
        >
          <span aria-hidden="true">⏸</span> Pause
        </button>
      )}

      {paused && (
        <button
          type="button"
          onClick={onResume}
          aria-label="Continue reading"
          className={`${button} text-premium-gold border-premium-gold/40 hover:bg-premium-gold/10`}
        >
          <span aria-hidden="true">▶</span> Continue
        </button>
      )}

      {(speaking || paused) && (
        <button
          type="button"
          onClick={onStop}
          aria-label="Stop reading"
          className={`${button} text-premium-ivory/70 border-white/15 hover:bg-white/5`}
        >
          <span aria-hidden="true">⏹</span> Stop
        </button>
      )}

      {/* Repeat is a separate, always-available action: "say that again" is the
          single most requested thing from a learner who is still decoding
          words, and making them stop first would be a worse control. */}
      {(speaking || paused) && (
        <button
          type="button"
          onClick={onPlay}
          aria-label="Read it again from the start"
          className={`${button} text-premium-ivory/70 border-white/15 hover:bg-white/5`}
        >
          <span aria-hidden="true">🔁</span> Again
        </button>
      )}

      {/* Screen readers get the state as text; sighted users get the button
          swap above. Neither depends on colour. */}
      <span role="status" aria-live="polite" className="sr-only">
        {speaking ? "Reading aloud" : paused ? "Reading paused" : "Not reading"}
      </span>
    </div>
  );
}

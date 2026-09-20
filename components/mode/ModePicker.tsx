"use client";

import { useMode } from "@/lib/mode/useMode";
import { MODES, type ModeId } from "@/lib/mode/modes";
import { CheckIcon } from "@/components/nav/icons";
import { TEXT } from "@/lib/designSystem";

/**
 * Mode selector for the More screen — same structural pattern as
 * ThemePicker (radiogroup, arrow-key nav, no colour-only selection state),
 * but a separate control for a separate axis: THEME is the app's colour
 * identity, MODE is which of the three Chess Mind presentation experiences
 * is active. Selecting a mode never touches the current theme, and vice
 * versa — see lib/mode/useMode.ts and app/modes.css.
 */
export function ModePicker() {
  const { mode, setMode } = useMode();

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
    const next = MODES[(index + delta + MODES.length) % MODES.length];
    setMode(next.id);
    document.getElementById(`mode-opt-${next.id}`)?.focus();
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="font-classic-display text-sm text-premium-gold uppercase tracking-wide">
          Chess Mind Worlds
        </p>
        <p className={`${TEXT.caption} normal-case mt-0.5`}>
          One Chess Mind. Three experiences. Your account, games, ratings,
          friends and progress are the same in every one — only how it looks
          and feels changes.
        </p>
      </div>

      <div role="radiogroup" aria-label="Chess Mind presentation mode" className="flex flex-col gap-2">
        {MODES.map((m, i) => {
          const selected = m.id === mode;
          return (
            <button
              key={m.id}
              id={`mode-opt-${m.id}`}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => setMode(m.id as ModeId)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={`w-full min-h-[64px] rounded-premiumCard border p-3 flex items-center gap-3 text-left transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/60 ${
                selected
                  ? "border-premium-gold/50 bg-premium-navy"
                  : "border-white/10 bg-premium-navy/60 hover:border-premium-gold/30"
              }`}
            >
              <span
                aria-hidden="true"
                className="flex flex-none items-center justify-center h-10 w-10 rounded-premiumBtn border border-white/10 bg-premium-midnightDeep text-xl"
              >
                {m.emoji}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block font-classic-display text-base text-premium-ivory">
                  {m.name}
                </span>
                <span className={`block ${TEXT.caption} normal-case`}>{m.tagline}</span>
              </span>

              <span
                className={`flex h-6 w-6 flex-none items-center justify-center rounded-full border ${
                  selected
                    ? "border-premium-gold bg-premium-gold text-premium-midnightDeep"
                    : "border-white/20"
                }`}
              >
                {selected && <CheckIcon className="h-4 w-4" />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

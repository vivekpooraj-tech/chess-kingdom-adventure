"use client";

import { useTheme } from "@/lib/theme/useTheme";
import { THEMES, type ThemeId } from "@/lib/theme/themes";
import { CheckIcon } from "@/components/nav/icons";
import { TEXT } from "@/lib/designSystem";

/**
 * Theme selector for the More screen.
 *
 * Previews are drawn from three CSS colour chips per theme rather than
 * screenshots. Four preview images would cost every visitor bandwidth for
 * something three `<span>`s convey, and they would drift out of date the
 * moment a theme's colours changed.
 *
 * Rendered as a radiogroup: arrow keys move between themes and the selected
 * one is announced, which a grid of buttons would not do. Selection is shown
 * by a check plus a ring, never by colour alone — in a theme picker,
 * colour-only state is exactly the wrong signal.
 */
export function ThemePicker() {
  const { theme, setTheme } = useTheme();

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
    const next = THEMES[(index + delta + THEMES.length) % THEMES.length];
    setTheme(next.id);
    // Move focus with the selection so the keyboard user follows the change.
    document.getElementById(`theme-opt-${next.id}`)?.focus();
  }

  return (
    <div role="radiogroup" aria-label="Appearance" className="flex flex-col gap-2">
      {THEMES.map((t, i) => {
        const selected = t.id === theme;
        return (
          <button
            key={t.id}
            id={`theme-opt-${t.id}`}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => setTheme(t.id as ThemeId)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`w-full min-h-[64px] rounded-premiumCard border p-3 flex items-center gap-3 text-left transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/60 ${
              selected
                ? "border-premium-gold/50 bg-premium-navy"
                : "border-white/10 bg-premium-navy/60 hover:border-premium-gold/30"
            }`}
          >
            {/* Palette preview — the theme's ground, card and accent. */}
            <span
              aria-hidden="true"
              className="flex flex-none items-center gap-1 rounded-premiumBtn border border-white/10 p-1.5"
              style={{ backgroundColor: t.swatch.ground }}
            >
              <span
                className="block h-6 w-3 rounded-sm"
                style={{ backgroundColor: t.swatch.surface }}
              />
              <span
                className="block h-6 w-3 rounded-sm"
                style={{ backgroundColor: t.swatch.accent }}
              />
            </span>

            <span className="min-w-0 flex-1">
              <span className="block font-classic-display text-base text-premium-ivory">
                {t.name}
              </span>
              <span className={`block ${TEXT.caption} normal-case`}>{t.description}</span>
            </span>

            {/* Not colour-only: a check confirms the selection. */}
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
  );
}

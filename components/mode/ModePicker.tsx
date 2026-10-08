"use client";

import { useId } from "react";
import { useMode } from "@/lib/mode/useMode";
import { MODES, type ModeId } from "@/lib/mode/modes";
import { CheckIcon } from "@/components/nav/icons";
import { TEXT } from "@/lib/designSystem";

/**
 * The Chess Mind Experience selector: which of the three experiences (Enchanted Kingdom, Master Training Atelier, Classic Pro) is active.
 * A radiogroup with arrow-key navigation and no colour-only selection state (the selected option carries a check mark). State is the
 * one source of truth in lib/mode/useMode.ts (`html[data-mode]` + localStorage); nothing here keeps a second copy of it.
 *
 * Two looks of the same control: the default (the More screen) and `variant="profile"`, which borrows the Profile page's own rows
 * (`cls` = pf-en / pf-at / pf-cl, styled per world in app/world-profile.css) so it reads as a natural Profile setting.
 */
export const EXPERIENCE_TITLE = "Chess Mind Experience";
export const EXPERIENCE_HELP = "Choose how Chess Mind feels and plays.";

export function ModePicker({ variant = "more", cls = "pf-cl" }: { variant?: "more" | "profile"; cls?: string }) {
  const { mode, setMode } = useMode();
  const uid = useId();
  const profile = variant === "profile";

  /** Switching can swap the whole Profile layout (a different world tree mounts), so the focused option is found again afterwards. */
  function focusOption(id: ModeId) {
    window.setTimeout(() => {
      const el = [...document.querySelectorAll<HTMLElement>(`[data-exp="${id}"]`)].find((e) => e.offsetParent !== null);
      el?.focus();
    }, 60);
  }

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
    const next = MODES[(index + delta + MODES.length) % MODES.length];
    setMode(next.id);
    focusOption(next.id);
  }

  const group = (
    <div
      role="radiogroup"
      aria-labelledby={`${uid}-title`}
      className={profile ? `${cls}-custom ${cls}-xp__list` : "flex flex-col gap-2"}
    >
      {MODES.map((m, i) => {
        const selected = m.id === mode;
        const common = {
          type: "button" as const,
          role: "radio" as const,
          "aria-checked": selected,
          tabIndex: selected ? 0 : -1,
          "data-exp": m.id,
          "data-selected": selected ? "" : undefined,
          onClick: () => setMode(m.id as ModeId),
          onKeyDown: (e: React.KeyboardEvent) => onKeyDown(e, i),
        };

        if (profile) {
          return (
            <div key={m.id} role="presentation" className={`${cls}-xp__item`}>
              <button {...common} className={`${cls}-custom__row ${cls}-xp__opt`}>
                <span className={`${cls}-custom__icon`} aria-hidden="true">{m.emoji}</span>
                <span className={`${cls}-custom__text`}>
                  <span className={`${cls}-custom__title`}>{m.name}</span>
                  <span className={`${cls}-custom__now`}>{m.tagline}</span>
                </span>
                <span className={`${cls}-xp__check`} aria-hidden="true">{selected && <CheckIcon className="h-4 w-4" />}</span>
              </button>
            </div>
          );
        }

        return (
          <button
            key={m.id}
            id={`mode-opt-${m.id}`}
            {...common}
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
              <span className="block font-classic-display text-base text-premium-ivory">{m.name}</span>
              <span className={`block ${TEXT.caption} normal-case`}>{m.tagline}</span>
            </span>

            <span
              className={`flex h-6 w-6 flex-none items-center justify-center rounded-full border ${
                selected ? "border-premium-gold bg-premium-gold text-premium-midnightDeep" : "border-white/20"
              }`}
            >
              {selected && <CheckIcon className="h-4 w-4" />}
            </span>
          </button>
        );
      })}
    </div>
  );

  if (profile) {
    return (
      <section className={`${cls}-xp`} data-exp-picker aria-labelledby={`${uid}-title`}>
        <h2 id={`${uid}-title`} className={`${cls}-label ${cls}-eyebrow`}>{EXPERIENCE_TITLE}</h2>
        <p className={`${cls}-xp__help`}>{EXPERIENCE_HELP}</p>
        {group}
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-3" data-exp-picker>
      <div>
        <p id={`${uid}-title`} className="font-classic-display text-sm text-premium-gold uppercase tracking-wide">
          {EXPERIENCE_TITLE}
        </p>
        <p className={`${TEXT.caption} normal-case mt-0.5`}>{EXPERIENCE_HELP}</p>
      </div>
      {group}
    </div>
  );
}

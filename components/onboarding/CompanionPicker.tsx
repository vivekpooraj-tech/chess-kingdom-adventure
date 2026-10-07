"use client";

import { motion } from "framer-motion";
import type { AvatarOption } from "@/lib/types";
import { COMPANION_ART, COMPANION_BLURB } from "./companionArt";

/**
 * The signup character screen, presentation only ("Choose your companion"). The page (app/onboarding/avatar/page.tsx) owns every bit of logic:
 * the signed-in child, which character is selected, saving it and moving on. This component only draws the four characters it is given and calls
 * the handlers it is given; it holds no state of its own. Styles: `.cp-*` in app/world-onboarding.css (Enchanted Kingdom).
 */
export function CompanionPicker({
  avatars,
  selected,
  saving,
  onSelect,
  onConfirm,
}: {
  avatars: readonly AvatarOption[];
  selected: string | null;
  saving: boolean;
  onSelect: (id: string) => void;
  onConfirm: () => void;
}) {
  return (
    <div className="cp-wrap">
      <header className="cp-head world-enter">
        <p className="world-kicker">Your journey begins</p>
        <h1 className="cp-title">Choose your companion</h1>
        <p className="cp-lede">Who will join you on your chess adventure?</p>
      </header>

      <div role="radiogroup" aria-label="Choose your companion" className="cp-grid">
        {avatars.map((a, i) => {
          const isSelected = selected === a.id;
          const art = COMPANION_ART[a.id];
          return (
            <motion.button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              data-avatar={a.id}
              onClick={() => onSelect(a.id)}
              whileTap={{ scale: 0.97 }}
              className={`cp-card world-enter world-enter-delay-${Math.min(i, 2)}${isSelected ? " is-selected" : ""}`}
              style={{ ["--cp-from" as string]: a.colorFrom, ["--cp-to" as string]: a.colorTo }}
            >
              <span className="cp-plate">
                {art ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={art} alt="" className="cp-art" loading="eager" />
                ) : (
                  <span className="cp-emoji" aria-hidden="true">{a.emoji}</span>
                )}
                <span className="cp-check" aria-hidden="true">✓</span>
              </span>
              <span className="cp-name">{a.name}</span>
              <span className="cp-blurb">{COMPANION_BLURB[a.id]}</span>
            </motion.button>
          );
        })}
      </div>

      <button type="button" className="cp-cta" disabled={!selected || saving} onClick={onConfirm}>
        {saving ? "Saving..." : "Continue →"}
      </button>
    </div>
  );
}

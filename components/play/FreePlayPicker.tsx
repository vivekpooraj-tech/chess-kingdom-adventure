"use client";

import { useState } from "react";
import Link from "next/link";
import { WorldBranch } from "@/components/layout/WorldBranch";
import { backLabel } from "@/lib/navigation/destinations";
import type { Difficulty } from "@/lib/chess-engine/stockfishEngine";

/**
 * Free Play — choosing the computer opponent (the screen between /play and the game).
 *
 * Presentation only, in three world presentations (Enchanted "Choose Your Challenge", Atelier "Select Training
 * Intensity", Classic "Select Match Level"). The options are the page's own real difficulty list, passed in; picking one
 * and pressing the primary action calls the SAME `onStart(difficulty)` the page always used (eligibility check, paywall,
 * game creation, cinematic). Nothing here knows about engines or games. Styles: `.fp-*` (plus the shared `.pl-*` world
 * palettes) in app/worlds.css. The caller wraps this in WorldScope; the world is read from there.
 */

export interface FreePlayOption {
  key: Difficulty;
  label: string;
  emoji: string;
  /** The Enchanted wording (the original copy); Atelier / Classic have their own below. */
  blurb: string;
}

const VOICE: Record<"atelier" | "classic", Record<Difficulty, string>> = {
  atelier: {
    "very-easy": "Unhurried. Learn the flow of a full game.",
    easy: "Light resistance, with room to try ideas.",
    medium: "A real test of your plans.",
    hard: "Full resistance. No favours.",
  },
  classic: {
    "very-easy": "A relaxed pace for early games.",
    easy: "A gentle, beatable opponent.",
    medium: "A balanced, competitive opponent.",
    hard: "The strongest opponent on offer.",
  },
};

const DEFAULT_PICK: Difficulty = "easy";

interface Props {
  options: readonly FreePlayOption[];
  starting: boolean;
  onStart: (difficulty: Difficulty) => void;
}

function Back() {
  return (
    <Link href="/play" className="fp-back">
      {backLabel("PLAY")}
    </Link>
  );
}

function Group({
  options,
  value,
  onChange,
  label,
  className,
  children,
}: {
  options: readonly FreePlayOption[];
  value: Difficulty;
  onChange: (d: Difficulty) => void;
  label: string;
  className: string;
  children: (o: FreePlayOption, i: number, selected: boolean) => React.ReactNode;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={className}>
      {options.map((o, i) => {
        const selected = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={selected}
            data-difficulty={o.key}
            onClick={() => onChange(o.key)}
            className={`fp-opt${selected ? " is-selected" : ""}`}
          >
            {children(o, i, selected)}
          </button>
        );
      })}
    </div>
  );
}

const TIER = ["teal", "purple", "gold", "coral"] as const;

function Enchanted({ options, starting, onStart }: Props) {
  const [pick, setPick] = useState<Difficulty>(DEFAULT_PICK);
  return (
    <div className="pl-en fp-en">
      <header className="pl-en__head world-enter">
        <p className="world-kicker">Enchanted Kingdom</p>
        <h1 className="pl-en__title">Choose Your Challenge</h1>
        <p className="pl-en__lede">Pick how strong your opponent is, then begin.</p>
      </header>
      <Group options={options} value={pick} onChange={setPick} label="Challenge" className="fp-en-grid">
        {(o, i, selected) => (
          <span className={`fp-en-card fp-en-card--${TIER[i % 4]}`}>
            <span className="fp-en-card__medal" aria-hidden="true">{o.emoji}</span>
            <span className="fp-en-card__text">
              <span className="fp-en-card__title">{o.label}</span>
              <span className="fp-en-card__desc">{o.blurb}</span>
            </span>
            <span className="fp-en-card__stars" aria-hidden="true">
              {options.map((_, s) => (
                <span key={s} className={s <= i ? "on" : ""}>★</span>
              ))}
            </span>
            <span className="fp-en-card__tick" aria-hidden="true">{selected ? "✓" : ""}</span>
          </span>
        )}
      </Group>
      <button type="button" className="fp-en-cta" disabled={starting} onClick={() => onStart(pick)}>
        <span aria-hidden="true">✦</span> Begin the Quest <span aria-hidden="true">✦</span>
      </button>
      <Back />
    </div>
  );
}

function Atelier({ options, starting, onStart }: Props) {
  const [pick, setPick] = useState<Difficulty>(DEFAULT_PICK);
  return (
    <div className="pl-at fp-at">
      <header className="pl-at-mast fp-at-mast">
        <p className="pl-at-eyebrow">Master Training Atelier</p>
        <h1 className="pl-at-title">
          Select Training <em>Intensity</em>
        </h1>
        <p className="pl-at-lede">One full game against the computer. Choose the resistance.</p>
      </header>
      <Group options={options} value={pick} onChange={setPick} label="Training intensity" className="fp-at-list">
        {(o, i, selected) => (
          <>
            <span className="fp-at-no" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
            <span className="fp-at-text">
              <span className="fp-at-title">{o.label}</span>
              <span className="fp-at-desc">{VOICE.atelier[o.key]}</span>
            </span>
            <span className="fp-at-mark" aria-hidden="true">{selected ? "●" : "○"}</span>
          </>
        )}
      </Group>
      <div className="fp-at-actions">
        <button type="button" className="pl-at-cta fp-at-cta" disabled={starting} onClick={() => onStart(pick)}>
          Begin session <span aria-hidden="true">→</span>
        </button>
        <Back />
      </div>
    </div>
  );
}

function Classic({ options, starting, onStart }: Props) {
  const [pick, setPick] = useState<Difficulty>(DEFAULT_PICK);
  return (
    <div className="pl-cl fp-cl">
      <header className="pl-cl-top">
        <p className="world-kicker">Classic Pro</p>
        <h1 className="pl-cl-title">Select Match Level</h1>
        <p className="pl-cl-lede">One full game against the computer.</p>
      </header>
      <Group options={options} value={pick} onChange={setPick} label="Match level" className="fp-cl-grid">
        {(o, i, selected) => (
          <>
            <span className="fp-cl-level" aria-hidden="true">Level {i + 1}</span>
            <span className="fp-cl-title">{o.label}</span>
            <span className="fp-cl-desc">{VOICE.classic[o.key]}</span>
            <span className="fp-cl-radio" aria-hidden="true">{selected ? "✓" : ""}</span>
          </>
        )}
      </Group>
      <div className="fp-cl-actions">
        <button type="button" className="fp-cl-cta" disabled={starting} onClick={() => onStart(pick)}>
          Start match <span aria-hidden="true">→</span>
        </button>
        <Back />
      </div>
    </div>
  );
}

export function FreePlayPicker(props: Props) {
  return <WorldBranch classic={<Classic {...props} />} atelier={<Atelier {...props} />} other={<Enchanted {...props} />} />;
}

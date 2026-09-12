"use client";

import { useEffect, useState, type ReactNode } from "react";
import { TEXT } from "@/lib/designSystem";
import type { SchoolUnlock } from "@/content/school/types";

/**
 * Ollie, as a coach rather than a chat box.
 *
 * There is no text input here and that is the design, not a missing feature.
 * An open box invites a child to ask anything, which means either a live model
 * call in the middle of a lesson (a spinner, a cost, and a dependency on a
 * network) or a canned "I don't know that yet" that teaches them Ollie is
 * useless. Instead Ollie says one relevant thing at a time, written by the
 * content, always about the skill in front of the child right now.
 */
export function OllieCoach({
  line,
  tone = "calm",
  children,
}: {
  line: string;
  /** "calm" for teaching, "warm" after a mistake, "proud" after a success. */
  tone?: "calm" | "warm" | "proud";
  children?: ReactNode;
}) {
  const ring =
    tone === "proud"
      ? "border-premium-gold/45 bg-premium-gold/10"
      : tone === "warm"
      ? "border-amber-300/30 bg-amber-200/[0.07]"
      : "border-white/10 bg-white/[0.04]";

  return (
    <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${ring}`}>
      <span aria-hidden="true" className="mt-0.5 flex-none text-2xl leading-none">
        🦉
      </span>
      <div className="min-w-0">
        <p className={`${TEXT.body} text-premium-ivory/90`}>{line}</p>
        {children}
      </div>
    </div>
  );
}

/**
 * A milestone card, built to be screenshotted.
 *
 * The tagline is the whole point — "Challenge me." is an invitation a child can
 * act on, and a badge that only says "well done" is a dead end. Nothing here
 * links out or shares automatically: a grown-up screenshots it, or they don't.
 * No child-generated content leaves this device from Chess School.
 *
 * `staged` (set by an epic ceremony) plays the reveal as a two-beat sequence —
 * "NEW TITLE UNLOCKED" first, the actual title a moment later — instead of
 * showing everything at once. Omit it (every non-epic caller does) and the
 * card renders exactly as it always has, complete from the first frame.
 */
export function MilestoneCard({
  unlock,
  childName,
  staged = false,
}: {
  unlock: SchoolUnlock;
  childName?: string;
  staged?: boolean;
}) {
  const [titleShown, setTitleShown] = useState(!staged);
  useEffect(() => {
    if (!staged) return;
    const t = setTimeout(() => setTitleShown(true), 900);
    return () => clearTimeout(t);
  }, [staged]);

  return (
    <div className="relative overflow-hidden rounded-premiumCard border border-premium-gold/30 bg-gradient-to-br from-[#241a3a] via-[#3a2a52] to-[#5a3f2e] p-6 text-center shadow-premiumCard">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(232,165,107,0.35), transparent 70%)",
        }}
      />
      <div className="relative">
        <p className="text-5xl leading-none" aria-hidden="true">
          {unlock.emoji}
        </p>
        <p className={`${TEXT.meta} mt-3 text-premium-gold`}>
          {staged && !titleShown ? "NEW TITLE UNLOCKED" : "MILESTONE UNLOCKED"}
        </p>
        <div className="mt-1 min-h-[2.25rem]">
          <h3
            className={`font-classic-display text-2xl tracking-wide text-premium-ivory transition-all duration-500 ${
              titleShown ? "opacity-100 scale-100" : "opacity-0 scale-90"
            }`}
          >
            {titleShown ? unlock.title : ""}
          </h3>
        </div>
        {childName ? (
          <p className={`${TEXT.caption} mt-1`}>{childName}</p>
        ) : null}
        <p
          className={`mt-4 font-classic-body text-lg italic text-premium-ivory/85 transition-opacity duration-500 ${
            titleShown ? "opacity-100" : "opacity-0"
          }`}
        >
          &ldquo;{unlock.tagline}&rdquo;
        </p>
      </div>
    </div>
  );
}

/** A small labelled pill — module name, skill name, minutes. */
export function SchoolChip({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "gold" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 font-classic-body text-[11px] uppercase tracking-wide ${
        tone === "gold"
          ? "border-premium-gold/40 bg-premium-gold/10 text-premium-gold"
          : "border-white/12 bg-white/[0.04] text-premium-ivory/60"
      }`}
    >
      {children}
    </span>
  );
}

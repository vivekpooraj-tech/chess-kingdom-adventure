/**
 * Phase 10B typography hierarchy — the premium system's single source of
 * truth for text styling, so screens compose these instead of picking a
 * font/size/color combination by eye each time. Six tiers, matching the
 * Phase 10B brief exactly: Display, Heading, Subheading, Body, Caption,
 * Metadata.
 *
 * These are plain Tailwind class strings (not a CSS-in-JS system) so they
 * stay simple to override with a few extra classes via clsx when a screen
 * needs it. Fraunces (classic-display) carries the "premium/elegant" voice
 * for anything display-weight; Source Sans (classic-body) carries
 * everything meant to be read at length — matching the existing font
 * system already wired up in tailwind.config.ts, no new font added.
 *
 * Color opacities follow the accessible scale documented in
 * tailwind.config.ts next to the `premium` palette — do not substitute an
 * arbitrary opacity here without checking that comment first.
 */
export const TEXT = {
  /** The one big statement on a screen — hero headlines ("CHESS ACADEMY"). */
  display: "font-classic-display text-3xl sm:text-4xl text-premium-ivory tracking-tight",
  /** Section/page titles. */
  heading: "font-classic-display text-xl sm:text-2xl text-premium-ivory",
  /** Card titles, sub-sections. */
  subheading: "font-classic-display text-base sm:text-lg text-premium-ivory",
  /** Default reading text — descriptions, explanations. */
  body: "font-classic-body text-sm text-premium-ivory/70 leading-relaxed",
  /** Small supporting text — helper copy, secondary labels. */
  caption: "font-classic-body text-xs text-premium-ivory/50",
  /** Timestamps, counts, ECO codes — the smallest, least emphasized tier. */
  meta: "font-classic-body text-[10px] text-premium-ivory/50 uppercase tracking-wide",
} as const;

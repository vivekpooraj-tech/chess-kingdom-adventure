/**
 * Phase 10B typography hierarchy — the premium system's single source of
 * truth for text styling, so screens compose these instead of picking a
 * font/size/color combination by eye each time.
 *
 * Sizes are FLUID (Phase 2 responsive refactor): each tier scales smoothly
 * with the viewport via clamp() instead of jumping once at `sm:`. The min
 * is a comfortable phone size, the max a comfortable large-desktop size,
 * and the slope in between keeps tablets from looking like blown-up phones
 * or desktops looking oversized. Line-heights are pinned per tier so the
 * fluid size never drags them out of proportion.
 *
 *   tier        phone (~360)   tablet (~768)   desktop (>=1280)
 *   display     ~26px          ~31px           ~38–40px
 *   heading     ~20px          ~24px           ~28px
 *   subheading  ~16px          ~18px           ~19px
 *   body        ~14.5px        ~16px           ~17px
 *
 * Fraunces (classic-display) carries the "premium/elegant" voice for
 * anything display-weight; Source Sans (classic-body) carries everything
 * meant to be read at length. Color opacities follow the accessible scale
 * documented in tailwind.config.ts next to the `premium` palette.
 */
export const TEXT = {
  /** The one big statement on a screen — page titles, hero headlines. */
  display:
    "font-classic-display text-[clamp(1.6rem,1.2rem+1.6vw,2.5rem)] leading-[1.12] tracking-tight text-premium-ivory",
  /** Section / page-section titles. */
  heading:
    "font-classic-display text-[clamp(1.25rem,1.1rem+0.7vw,1.75rem)] leading-[1.2] text-premium-ivory",
  /** Card titles, sub-sections. */
  subheading:
    "font-classic-display text-[clamp(1rem,0.95rem+0.25vw,1.2rem)] leading-snug text-premium-ivory",
  /** Default reading text — descriptions, explanations. */
  body:
    "font-classic-body text-[clamp(0.9rem,0.86rem+0.18vw,1.0625rem)] leading-relaxed text-premium-ivory/70",
  /** Small supporting text — helper copy, secondary labels. */
  caption:
    "font-classic-body text-[clamp(0.75rem,0.72rem+0.12vw,0.8125rem)] text-premium-ivory/50",
  /** Timestamps, counts, ECO codes — the smallest, least emphasized tier. */
  meta: "font-classic-body text-[10px] text-premium-ivory/50 uppercase tracking-wide",
} as const;

/**
 * Single source of truth for product branding. Swap `name`/`tagline` here
 * once the final brand is chosen instead of hunting down hardcoded strings
 * across the app, Stripe, and email templates.
 *
 * Two places live outside the Next.js bundle and can't import this at
 * runtime — update these by hand when the name is finalized:
 *   - capacitor.config.ts        (native app name shown during install)
 *   - android/app/src/main/res/values/strings.xml  (Android launcher label)
 */
export const BRAND = {
  name: "Chess Mind",
  shortName: "Chess Mind",
  tagline: "Think. Learn. Master.",
  academyName: "Chess Academy",
  academyTagline: "Learn. Practice. Master.",
} as const;

/**
 * Two visual experiences the same product can render in — see design system
 * tokens in tailwind.config.ts (`font-display`/`font-body` for Adventure,
 * `font-classic-display`/`font-classic-body` and the `premium` color group
 * for Classic). Mode selection UI lands in a later phase; this type is the
 * shared contract components can already build against.
 */
export type ExperienceMode = "adventure" | "classic";

export const DEFAULT_EXPERIENCE_MODE: ExperienceMode = "adventure";

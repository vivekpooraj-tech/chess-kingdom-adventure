/**
 * The three Chess Mind presentation modes.
 *
 * Pure data — no React, no CSS, no side effects — exactly mirroring
 * lib/theme/themes.ts's own doc comment reasoning: safe to import from a
 * server component, a client component, or a bootstrap script alike.
 *
 * Mode is a SEPARATE axis from theme (see app/modes.css vs app/themes.css):
 * theme is the app's colour identity, mode is which of the three Chess Mind
 * presentation experiences (Kids / Adult / Classic-Pro) is active. The two
 * attributes — [data-theme] and [data-mode] — are independently settable and
 * neither reads or depends on the other.
 */

export const MODE_IDS = ["kids", "adult", "classic-pro"] as const;

export type ModeId = (typeof MODE_IDS)[number];

/**
 * classic-pro is the default: it IS the app's current, already-shipping
 * presentation. Selecting it (or having no stored preference at all) must
 * render byte-for-byte identical to the app before this mode system existed
 * — the same guarantee chess-kingdom makes for theme. Phase 1 introduces the
 * attribute and its CSS channels but wires no component to branch on them
 * yet, so this is true by construction, not merely by value choice.
 */
export const DEFAULT_MODE: ModeId = "classic-pro";

export interface ModeDefinition {
  id: ModeId;
  /** The Chess Mind "world" name, e.g. "Enchanted Kingdom". */
  name: string;
  /** Short tagline shown under the name, e.g. "Play & Discover". */
  tagline: string;
  /** One sentence describing who this mode is for. */
  description: string;
  /** Decorative — every card also carries the name/tagline in text. */
  emoji: string;
}

export const MODES: ModeDefinition[] = [
  {
    id: "kids",
    name: "Enchanted Kingdom",
    tagline: "Play & Discover",
    description: "A magical, colorful chess adventure built for young explorers.",
    emoji: "\u{1F3F0}",
  },
  {
    id: "adult",
    name: "Master Training Atelier",
    tagline: "Train & Improve",
    description: "A focused, premium training space for deliberate improvement.",
    emoji: "\u{1F393}",
  },
  {
    id: "classic-pro",
    name: "Classic / Pro",
    tagline: "Play & Compete",
    description: "The familiar, chess-first Chess Mind experience.",
    emoji: "♙",
  },
];

/** localStorage key. Also hard-coded in ModeBootstrapScript, which cannot
 *  import from here — it runs as a raw string before hydration. Deliberately
 *  a distinct key from THEME_STORAGE_KEY so the two preferences never
 *  collide or overwrite one another. */
export const MODE_STORAGE_KEY = "chessmind-mode";

export function isModeId(value: unknown): value is ModeId {
  return typeof value === "string" && (MODE_IDS as readonly string[]).includes(value);
}

export function getMode(id: ModeId): ModeDefinition {
  return MODES.find((m) => m.id === id) ?? MODES[2];
}

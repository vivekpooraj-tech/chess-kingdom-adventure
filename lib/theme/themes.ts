/**
 * The four Chess Mind themes.
 *
 * Pure data — no React, no CSS, no side effects — so this is safe to import
 * from a server component, a client component or the bootstrap script alike.
 * The actual colours live in app/themes.css; the swatches here exist only so
 * the settings UI can draw a preview without shipping preview images.
 *
 * Keep the swatch hexes in sync with app/themes.css. They are duplicated on
 * purpose: reading live CSS variables for four inactive themes at once would
 * mean mounting four hidden themed subtrees, which costs more than three
 * strings per theme.
 */

export const THEME_IDS = [
  "chess-kingdom",
  "midnight-grandmaster",
  "royal-classic",
  "future-arena",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME: ThemeId = "chess-kingdom";

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  description: string;
  /** Three-colour preview: ground, card surface, accent. */
  swatch: { ground: string; surface: string; accent: string };
}

export const THEMES: ThemeDefinition[] = [
  {
    id: "chess-kingdom",
    name: "Chess Kingdom",
    description: "The original Chess Mind experience.",
    swatch: { ground: "#0F1629", surface: "#1B2440", accent: "#D4AF37" },
  },
  {
    id: "midnight-grandmaster",
    name: "Midnight Grandmaster",
    description: "Dark, focused and professional.",
    swatch: { ground: "#0C0F14", surface: "#161A21", accent: "#8FB0D9" },
  },
  {
    id: "royal-classic",
    name: "Royal Classic",
    description: "Timeless elegance for serious chess.",
    swatch: { ground: "#14201A", surface: "#1C2B23", accent: "#C9A227" },
  },
  {
    id: "future-arena",
    name: "Future Arena",
    description: "Modern, competitive and futuristic.",
    swatch: { ground: "#0A0E17", surface: "#121A2B", accent: "#4DA3FF" },
  },
];

/** localStorage key. Also hard-coded in the bootstrap script, which cannot
 *  import from here — it runs as a raw string before hydration. */
export const THEME_STORAGE_KEY = "chessmind-theme";

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as readonly string[]).includes(value);
}

export function getTheme(id: ThemeId): ThemeDefinition {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

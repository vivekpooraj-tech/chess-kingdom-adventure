/**
 * Chess Mind's three visual worlds — a separate axis from app/themes.css
 * (`data-theme`, colour identity) and app/modes.css (`data-mode`, Kids /
 * Adult / Classic-Pro presentation).
 *
 * World is the *place* the player is in: Enchanted Kingdom, Master Training
 * Atelier, or Classic Pro. Tokens live in app/worlds.css and apply through
 * `data-world` on a subtree (Home, Chess School, and Play arenas).
 */

export const WORLD_IDS = ["enchanted", "atelier", "classic"] as const;

export type WorldId = (typeof WORLD_IDS)[number];

export const DEFAULT_WORLD: WorldId = "classic";

export function isWorldId(value: unknown): value is WorldId {
  return typeof value === "string" && (WORLD_IDS as readonly string[]).includes(value);
}

/**
 * Presentation mode → Home world.
 * kids → enchanted, adult → atelier, classic-pro (default / no attr) → classic.
 */
export function worldFromMode(mode: string | null | undefined): WorldId {
  if (mode === "adult") return "atelier";
  if (mode === "kids") return "enchanted";
  return "classic";
}

/** QA / explicit pin. */
export function parseWorldQuery(value: unknown): WorldId | undefined {
  if (value === "enchanted" || value === "atelier" || value === "classic") return value;
  return undefined;
}

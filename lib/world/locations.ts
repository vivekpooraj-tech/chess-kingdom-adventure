/**
 * Chess Mind World — "Play the same game somewhere extraordinary."
 *
 * WHAT THE WORLD IS, AND — MORE IMPORTANTLY — WHAT IT IS NOT.
 *
 * A location is a BACKDROP. It changes where a game feels like it is
 * happening and nothing else. It has no effect on move legality, the clock,
 * matchmaking, ratings, settlement or any rule of chess, and it never
 * receives the game object, a move handler or a clock. That boundary is the
 * whole architecture: chess is one system, the world is scenery around it,
 * and a bug in the scenery can never cost anyone a rated game.
 *
 * So the World does not host its own board. Free Play already owns playing a
 * game against Stockfish — with the free-game limit, the opening recogniser
 * and post-game analysis — and building a second game page inside the World
 * would duplicate a working system and split one child's games across two
 * code paths. Instead Free Play renders a location behind its existing
 * arena, and the World is the place you choose one.
 *
 * TWO LOCATIONS, NOT TEN. Each is hand-built original artwork in CSS and SVG;
 * shipping ten thin ones would be worse than two that are actually good.
 * Nothing here is "coming soon" — a locked card for a place that does not
 * exist is the fake progress this product does not do.
 *
 * Pure data. No I/O, no React, no scene components — the scene is loaded
 * lazily by id (see WorldSceneBackdrop), so importing this registry costs
 * nothing but the metadata.
 */

export type WorldLocationId = "london-eye" | "chaturanga";

export interface WorldLocation {
  id: WorldLocationId;
  /** The place. */
  title: string;
  /** One line, on the card. */
  tagline: string;
  /** Two or three sentences, on the location itself. */
  story: string;
  /** Flag or motif. Decorative — every card also carries the title in text. */
  emoji: string;
  /** Time of day the scene depicts; used for the card's own gradient. */
  atmosphere: string;
  /** Tailwind gradient classes for the card preview, so a card looks like
   *  its scene without loading the scene. */
  cardGradient: string;
  /** Accent colour for chips and rings, as a CSS colour. */
  accent: string;
}

export const WORLD_NAME = "Chess Mind World";
export const WORLD_TAGLINE = "Play the same game somewhere extraordinary.";

export const WORLD_LOCATIONS: readonly WorldLocation[] = [
  {
    id: "london-eye",
    title: "London Eye",
    tagline: "Play above the city.",
    story:
      "A glass capsule turning slowly above the river, with the whole city laid out beneath you. The light goes gold, then amber, then dark — and the game goes on either way.",
    emoji: "\u{1F1EC}\u{1F1E7}",
    atmosphere: "Sunset over the river",
    cardGradient: "from-[#2a1a3e] via-[#5b3a5f] to-[#c76b4a]",
    accent: "#e8a56b",
  },
  {
    id: "chaturanga",
    title: "Chaturanga",
    tagline: "Where the game began.",
    story:
      "Warm sandstone, carved arches and long afternoon shadows. Chess grew out of chaturanga, an Indian game of the sixth century, and it has been travelling ever since.",
    emoji: "\u{1F1EE}\u{1F1F3}",
    atmosphere: "Afternoon in the courtyard",
    cardGradient: "from-[#3a2313] via-[#8a5a2b] to-[#d9a441]",
    accent: "#d9a441",
  },
];

export function getWorldLocation(id: string | null | undefined): WorldLocation | null {
  if (!id) return null;
  return WORLD_LOCATIONS.find((l) => l.id === id) ?? null;
}

export function isWorldLocationId(id: unknown): id is WorldLocationId {
  return typeof id === "string" && WORLD_LOCATIONS.some((l) => l.id === id);
}

/**
 * The href that starts a game in a location.
 *
 * Free Play, with the location as a query parameter — deliberately NOT a
 * separate game route. One game implementation, one free-game limit, one
 * settlement path; the location only changes what is drawn behind it.
 */
export function playHereHref(id: WorldLocationId): string {
  return `/free-play?world=${encodeURIComponent(id)}`;
}

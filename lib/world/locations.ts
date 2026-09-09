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
  /**
   * Painted environment art, when this location has any.
   *
   * OPTIONAL ON PURPOSE. A location without it falls back to its drawn CSS/SVG
   * scene, so art can land one location at a time without a flag day and
   * without a half-migrated World in between. When every location has art, the
   * drawn scenes and this fallback go together.
   *
   * The art is composed against the app's real geometry, not against taste:
   * measured on a 411x914 phone the board occupies 21.4%-64.7% of the screen
   * height and 1.9%-98.1% of its width, so that band of the image has to be
   * empty table. Everything the player should actually see — the landmark, the
   * opponent — lives above 22%.
   */
  art?: WorldArt;
}

export interface WorldArt {
  /** Portrait plate, shown on phones. Tall (9:20 preferred). */
  portrait: WorldArtPlate;
  /** Wide plate for tablets and landscape. Falls back to portrait if absent. */
  wide?: WorldArtPlate;
  /**
   * A handful of bytes of blurred base64, painted instantly under the real
   * plate so a slow connection shows the location's colour rather than a black
   * rectangle. The Capacitor app loads over the network, so this is the
   * difference between "loading" and "broken" on a cold cellular start.
   */
  lqip?: string;
  /**
   * object-position for the plate. Only matters when the device aspect differs
   * from the art's: cover then crops, and the default centre crop would slide
   * the empty-table band away from the board. Anchor it here instead.
   */
  objectPosition?: string;
}

export interface WorldArtPlate {
  /** AVIF first — roughly half the bytes of WebP at this kind of content. */
  avif: string;
  /** WebP fallback. Every Android WebView in range supports at least this. */
  webp: string;
  /**
   * Optional near-table layer with transparency, drawn IN FRONT of the board
   * so the board sits into the scene instead of on top of a photograph.
   */
  foreground?: { webp: string };
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
    art: {
      portrait: {
        avif: "/world/london-eye/bg-portrait.avif",
        webp: "/world/london-eye/bg-portrait.webp",
      },
      /*
       * FRAMED AGAINST THE LAYOUT, NOT AGAINST TASTE.
       *
       * Produced from the original 787x1998 illustration by:
       *
       *   node scripts/encode-world-art.js london-eye <source> 787:1750:0:185
       *
       * The crop is not cosmetic. The board covers roughly 17%-65% of the
       * screen's height, so the opponent's face has to clear the TOP of that
       * band or the child is playing against an empty chair. Measured on the
       * original, his chin sits at 21.8% and the table's edge at 33.5%, so
       * the face would have been behind the board. Lifting the window 185
       * source pixels puts his chin at 14.3% -- clear of the board's 16.6%
       * with room to spare -- and his hair at 4.9%.
       *
       * Note the width: 787 is the FULL width of the original, because
       * 787 x 1750 is already exactly 9:20. Nothing is cropped sideways, so
       * the wheel keeps its capsules on the left and Big Ben keeps its clock
       * face on the right. An earlier illustration framed lower and had to be
       * narrowed by a fifth to lift the face, which cost most of the wheel;
       * getting the framing right in the generator is worth more than any
       * amount of cropping afterwards.
       *
       * The plate is cut to the phone's own 9:20 so it maps almost 1:1 and
       * nothing important is cropped away at run time. "top" is what keeps
       * the sky and the opponent when the aspect does differ -- a shorter
       * viewport, or the 16/9 preview card on the World page -- and spends
       * the overflow on table, which is the part the board covers anyway.
       */
      objectPosition: "center top",
    },
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
    art: {
      portrait: {
        avif: "/world/chaturanga/bg-portrait.avif",
        webp: "/world/chaturanga/bg-portrait.webp",
      },
      /*
       * Produced from the original 841x1870 illustration by:
       *
       *   node scripts/encode-world-art.js chaturanga <source> 729:1620:56:250
       *
       * This is the first illustration composed against the zones rather than
       * rescued afterwards, and the numbers show it: the court table's far
       * edge lands at 21.0% against a board that starts at 17.5%, so the board
       * sits almost entirely ON the table instead of floating over the
       * opponent's chest the way London Eye's does. The prince's chin is at
       * 14.2% and his hair at 8.6%.
       *
       * The 250-pixel lift costs 13% of the width, taken evenly from both
       * sides, which the composition can afford: the carved pillars that frame
       * the arch both survive it, and what goes is curtain.
       */
      objectPosition: "center top",
    },
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

/**
 * Chess Mind World — the location registry.
 *
 * A location is PRESENTATION ONLY. Nothing here may ever influence chess
 * rules, matchmaking, pairing, clocks, results or ratings; those all live in
 * the existing engine and RPC layer and are deliberately untouched. A location
 * decides what the game is wrapped in, never how it is played.
 *
 * That separation is why two players in the same game can each be somewhere
 * different: the choice is local, so it needs no synchronisation, no schema
 * change, and no new failure mode in multiplayer.
 *
 * Adding a location later means adding one entry here and one scene component.
 * Nothing else in the app should ever name a specific location — the only
 * hard-coded id in the codebase is DEFAULT_LOCATION_ID below.
 */

export type LocationStatus = "available" | "coming-soon";

export interface WorldLocation {
  id: string;
  name: string;
  city: string;
  country: string;
  /** Two-letter ISO code. Metadata only — the UI never renders flag glyphs,
   *  because Windows ships none and they fall back to letter-boxes. */
  countryCode: string;
  /** The headline shown on the card and in-game badge. */
  title: string;
  /** One short line under the title. */
  subtitle: string;
  /** Two or three sentences for the preview screen. */
  description: string;
  /** A short in-world line shown on the in-game badge. Keep it calm — it sits
   *  beside a live board and must not compete with it. */
  flavour: string;
  status: LocationStatus;
  isPremium: boolean;
  /** Local time-of-day flavour for the ambience card. Static by design: a real
   *  clock would be one more thing ticking next to two chess clocks. */
  ambience: { label: string; detail: string; temperature: string };
  /** Card gradient, also used as the scene's cheap first paint. Tailwind-free
   *  so it can be inlined as a style without a class-name round trip. */
  palette: { from: string; via: string; to: string; accent: string };
  /** A short, rare label on the location card. Optional and meant to stay
   *  that way: if more than one or two locations carry a badge it stops
   *  meaning anything. */
  badge?: string;
  /**
   * Per-location UI tokens, applied as CSS custom properties on the root while
   * this location is active (see WorldSceneBackdrop) and consumed by
   * worldOverlay.css.
   *
   * This exists because the game panels sit ON the scene. London's cool navy
   * glass over Chaturanga's sandstone would read as a bug, not a theme. Every
   * token is optional and every rule that uses one carries London's value as
   * its `var()` fallback, so a location that specifies nothing looks exactly
   * as it did before this field existed.
   */
  theme?: {
    /** Fill for .chess-focus-panel and the World glass surfaces. */
    glass?: string;
    /** The same fill for prefers-reduced-transparency, where blur is dropped
     *  and the panel must carry contrast on its own. */
    glassSolid?: string;
    /** Drop shadow under the board. Warm scenes need a warmer shadow or the
     *  board looks pasted on. */
    boardShadow?: string;
  };
}

/**
 * The catalogue.
 *
 * Chaturanga and London Eye are built. The rest carry enough metadata to
 * render an honest "coming soon" card — they are a promise of where this goes, not a stub
 * pretending to work. None of them is reachable: the preview route refuses any
 * id whose status is not "available".
 */
export const WORLD_LOCATIONS: WorldLocation[] = [
  {
    id: "chaturanga",
    name: "Chaturanga",
    city: "Royal Court",
    country: "India",
    countryCode: "IN",
    title: "The Birthplace of Strategy",
    subtitle: "Where the game began",
    description:
      "Chess grew out of chaturanga, played in India more than a thousand years ago. This place is not one of those courts and does not pretend to be — it is a room built for the game, where sandstone arches open onto a courtyard and the light turns gold before evening. The board between you is where all of it ended up.",
    flavour: "Every move has a long memory.",
    status: "available",
    isPremium: false,
    badge: "Flagship",
    ambience: { label: "Royal Sunset", detail: "6:48 PM", temperature: "31°C" },
    palette: { from: "#2b1630", via: "#9c4a35", to: "#eaa84f", accent: "#ffd98a" },
    theme: {
      glass: "rgba(26, 13, 12, 0.55)",
      glassSolid: "rgba(26, 13, 12, 0.92)",
      boardShadow: "drop-shadow(0 1.5rem 3rem rgba(28, 10, 4, 0.78))",
    },
  },
  {
    id: "london-eye",
    name: "London Eye",
    city: "London",
    country: "United Kingdom",
    countryCode: "GB",
    title: "Chess Above the City",
    subtitle: "A game with a view",
    description:
      "Rise above London in a glass capsule as the sun goes down. The Thames turns to copper, Big Ben lights up across the water, and the city gets quieter the higher you climb. Your opponent is sitting opposite. The board is between you.",
    flavour: "New views. Better moves.",
    status: "available",
    isPremium: false,
    ambience: { label: "Sunset", detail: "7:24 PM", temperature: "18°C" },
    palette: { from: "#2a1b4d", via: "#8c3b6b", to: "#e8834a", accent: "#ffb26b" },
  },
  {
    id: "scottish-castle",
    name: "Scottish Castle",
    city: "Highlands",
    country: "Scotland",
    countryCode: "GB",
    title: "The King's Game",
    subtitle: "Stone, mist and firelight",
    description: "",
    flavour: "",
    status: "coming-soon",
    isPremium: true,
    ambience: { label: "Dusk", detail: "", temperature: "" },
    palette: { from: "#1b2430", via: "#37485c", to: "#7d8fa3", accent: "#a8bccd" },
  },
  {
    id: "paris-rooftop",
    name: "Paris Rooftop",
    city: "Paris",
    country: "France",
    countryCode: "FR",
    title: "A Game of Elegance",
    subtitle: "Above the zinc roofs",
    description: "",
    flavour: "",
    status: "coming-soon",
    isPremium: true,
    ambience: { label: "Golden hour", detail: "", temperature: "" },
    palette: { from: "#2b1e3a", via: "#7a4a63", to: "#d99a6c", accent: "#f0c08a" },
  },
  {
    id: "tokyo-temple",
    name: "Tokyo Temple",
    city: "Tokyo",
    country: "Japan",
    countryCode: "JP",
    title: "Peaceful Moves",
    subtitle: "Lanterns and blossom",
    description: "",
    flavour: "",
    status: "coming-soon",
    isPremium: true,
    ambience: { label: "Evening", detail: "", temperature: "" },
    palette: { from: "#241a2e", via: "#6b3350", to: "#c4657f", accent: "#f2a8bd" },
  },
  {
    id: "new-york-skyline",
    name: "New York Skyline",
    city: "New York",
    country: "United States",
    countryCode: "US",
    title: "The City That Never Stops",
    subtitle: "Steel, glass and neon",
    description: "",
    flavour: "",
    status: "coming-soon",
    isPremium: true,
    ambience: { label: "Night", detail: "", temperature: "" },
    palette: { from: "#0f1a2b", via: "#25405e", to: "#4f7ba8", accent: "#8fc0e8" },
  },
  {
    id: "dubai-skyline",
    name: "Dubai Skyline",
    city: "Dubai",
    country: "United Arab Emirates",
    countryCode: "AE",
    title: "Future Moves",
    subtitle: "Desert light on glass",
    description: "",
    flavour: "",
    status: "coming-soon",
    isPremium: true,
    ambience: { label: "Sunset", detail: "", temperature: "" },
    palette: { from: "#2d1d24", via: "#8a4a35", to: "#e0a25c", accent: "#ffd08a" },
  },
];

/** The one hard-coded id in the app. Everything else goes through lookups. */
export const DEFAULT_LOCATION_ID = "london-eye";

export function getLocation(id: string | null | undefined): WorldLocation | null {
  if (!id) return null;
  return WORLD_LOCATIONS.find((l) => l.id === id) ?? null;
}

/** Only locations that are actually built. The preview route gates on this. */
export function isPlayable(location: WorldLocation | null): boolean {
  return location?.status === "available";
}

/** 🇬🇧 from "GB". Purely decorative, and always paired with the country name
 *  in text so a font without flag glyphs loses nothing meaningful. */
export function flagEmoji(countryCode: string): string {
  return countryCode
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

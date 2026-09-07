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
  /** Two-letter ISO code, used for the flag emoji. */
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
}

/**
 * The catalogue.
 *
 * Only London Eye is built. The rest carry enough metadata to render an honest
 * "coming soon" card — they are a promise of where this goes, not a stub
 * pretending to work. None of them is reachable: the preview route refuses any
 * id whose status is not "available".
 */
export const WORLD_LOCATIONS: WorldLocation[] = [
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

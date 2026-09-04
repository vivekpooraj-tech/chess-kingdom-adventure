import { HomeIcon, PuzzlePieceIcon, PlayIcon, AcademyIcon, MoreIcon } from "./icons";

/**
 * The five primary destinations — the app's information architecture — and
 * the active-route matching for them. Extracted here (UI-2A) so the phone
 * `PrimaryNav` (bottom bar) and the desktop `SideNav` render from ONE
 * source and can never drift apart. Destinations, order, routes and match
 * prefixes are UNCHANGED from the previous inline definition in
 * PrimaryNav.tsx.
 */
export type NavItem = {
  label: string;
  href: string;
  icon: (props: { className?: string }) => JSX.Element;
  match?: string[];
};

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Home",
    href: "/kingdom-map",
    icon: HomeIcon,
    match: ["/kingdom-map", "/discover", "/piece-library"],
  },
  {
    label: "Puzzles",
    href: "/puzzles",
    icon: PuzzlePieceIcon,
  },
  {
    label: "Play",
    href: "/play",
    icon: PlayIcon,
    match: ["/play", "/free-play", "/matchmaking", "/online"],
  },
  {
    label: "Learn",
    href: "/learn",
    icon: AcademyIcon,
    match: ["/learn", "/academy", "/chess-mind", "/lesson"],
  },
  {
    label: "More",
    href: "/more",
    icon: MoreIcon,
    match: ["/more", "/profile", "/kingdom-map/customize", "/parent-gate", "/parent-dashboard"],
  },
];

export function isNavItemActive(pathname: string, item: NavItem): boolean {
  const prefixes = item.match ?? [item.href];
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Which pathnames get the persistent AppShell chrome (bottom nav on
 * phone/tablet, sidebar on desktop). This is the exact set of routes that
 * rendered `<PrimaryNav />` before UI-2A — no behaviour change, just moved
 * to one place. Everything else (auth, onboarding, welcome, splash, the
 * full-screen game / lesson / customize screens) renders bare.
 */
const APP_PREFIXES = [
  "/kingdom-map",
  "/puzzles",
  "/play",
  "/learn",
  "/more",
  "/profile",
  "/academy",
  "/chess-mind",
  "/discover",
  "/piece-library",
  "/parent-dashboard",
];

/** Full-screen sub-routes that never showed the nav even though their
 * parent prefix is an app route. */
const FORCE_BARE_PREFIXES = [
  "/kingdom-map/customize",
  "/kingdom-map/board-skin",
  "/kingdom-map/piece-set",
];

export function isAppChromeRoute(pathname: string): boolean {
  if (FORCE_BARE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return false;
  }
  // The tactics-lesson runner (/academy/tactics/<lessonId>) is a full-screen
  // board experience; the /academy/tactics index is a normal app page.
  if (/^\/academy\/tactics\/.+/.test(pathname)) return false;
  return APP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

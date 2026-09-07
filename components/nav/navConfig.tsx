import {
  HomeIcon,
  PuzzlePieceIcon,
  PlayIcon,
  AcademyIcon,
  MoreIcon,
  ChessMindIcon,
  DiscoverIcon,
  ProfileIcon,
  GlobeIcon,
} from "./icons";

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

/**
 * Secondary destinations, shown ONLY in the desktop sidebar.
 *
 * On a phone these correctly live behind Home and More: five thumb-reachable
 * tabs is the right ceiling, and burying the rest one tap deeper costs
 * almost nothing there. On desktop that same routing is pure friction — the
 * sidebar is a full-height column carrying five items and roughly 70% empty
 * space, while Academy, Chess Mind, Profile and Discover each need a detour
 * through Learn or More.
 *
 * So this is a chrome affordance for one layout, NOT an IA change: every
 * route here is already reachable exactly as before, the phone bottom bar is
 * untouched, and nothing is added or removed from the five primary tabs.
 *
 * Parent Dashboard is deliberately absent. It sits behind the parent gate,
 * and putting it in a child's primary chrome would both invite them to
 * knock on that door and imply it is theirs.
 */
export const SECONDARY_NAV_ITEMS: NavItem[] = [
  // Chess Mind World sits here, not in NAV_ITEMS, for the reason stated above:
  // five thumb-reachable tabs is the ceiling on a phone, and a sixth would
  // shrink all six. It is reachable from the Play hub on every device, which
  // is also where a player is already thinking about starting a game.
  { label: "World", href: "/world", icon: GlobeIcon },
  { label: "Academy", href: "/academy", icon: AcademyIcon },
  { label: "Chess Mind", href: "/chess-mind", icon: ChessMindIcon },
  { label: "Profile", href: "/profile", icon: ProfileIcon },
  { label: "Discover", href: "/discover", icon: DiscoverIcon },
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
  "/world",
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
  // Same shape for Chess Mind World: /world is a normal tab page, but a
  // location preview (/world/<id>) is a full-bleed cinematic screen and the
  // chrome would box it in.
  if (/^\/world\/.+/.test(pathname)) return false;
  return APP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

import {
  HomeIcon,
  PuzzlePieceIcon,
  PlayIcon,
  AcademyIcon,
  ChessMindIcon,
  DiscoverIcon,
  ProfileIcon,
  WorldIcon,
} from "./icons";

/**
 * The five primary destinations — the app's information architecture — and
 * the active-route matching for them. Extracted here (UI-2A) so the phone
 * `PrimaryNav` (bottom bar) and the desktop `SideNav` render from ONE
 * source and can never drift apart.
 *
 * CHESS MIND PHASE 4 NAVIGATION (approved): Home / School / Puzzles / Play /
 * World. Chess School is promoted to a primary tab — it was previously
 * reachable only via a Home card, which the UX audit identified as the
 * single biggest navigation gap for the flagship paid product. World is
 * promoted for the same reason (a named product differentiator with no
 * primary presence before). Learn (the Academy library) and "More"
 * (Profile/Appearance/Parent access) are no longer primary tabs, but are
 * NOT buried — see UTILITY_NAV_ITEMS below, rendered as a persistent,
 * named top-bar entry on every breakpoint (AppTopBar for tablet/desktop,
 * PhoneUtilityIcons for phone), specifically so nothing becomes
 * undiscoverable just because it isn't one of the five primary tabs.
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
    href: "/home",
    icon: HomeIcon,
    // /discover is NOT grouped here: it is its own Explore destination (SECONDARY_NAV_ITEMS), so on the desktop sidebar Discover is the
    // single active item there and Home is not also highlighted.
    // /lesson (Kingdom Journey) is provisionally grouped under Home — it is
    // entered from a Home section today and has not yet been repositioned
    // into World (that migration is its own later implementation phase).
    // This keeps the active-tab highlight correct without pre-empting that
    // decision.
    match: ["/home", "/piece-library", "/lesson"],
  },
  {
    label: "School",
    href: "/chess-school",
    icon: AcademyIcon,
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
    label: "World",
    href: "/world",
    icon: WorldIcon,
  },
];

/**
 * Utility destinations — not one of the five primary tabs, but each still
 * needs a persistent, named, always-reachable entry point (per the approved
 * navigation decision: "do not hide important product areas behind a
 * generic More"). Rendered by AppTopBar (tablet/desktop) and
 * PhoneUtilityIcons (phone) — see those components for the Chess-Time-aware
 * visibility rules, which intentionally do NOT live here (this file stays
 * pure configuration, matching the rest of navConfig.tsx).
 */
export const UTILITY_NAV_ITEMS: NavItem[] = [
  {
    label: "Learn",
    href: "/learn",
    icon: DiscoverIcon,
    match: ["/learn", "/academy", "/chess-mind"],
  },
  {
    label: "More",
    href: "/more",
    icon: ProfileIcon,
    match: ["/more", "/profile", "/profile/customize", "/parent-gate", "/parent-dashboard"],
  },
];

/**
 * Secondary destinations, shown ONLY in the desktop sidebar.
 *
 * On a phone/tablet these live behind the persistent Learn and More
 * utility icons (UTILITY_NAV_ITEMS, rendered via AppTopBar/
 * PhoneUtilityIcons): five thumb-reachable tabs is the right ceiling, and
 * a clearly-labeled icon one tap away costs almost nothing there. On
 * desktop that same routing is pure friction — the sidebar is a
 * full-height column with room to spare, so Academy, Chess Mind, Profile
 * and Discover get one-click direct links instead of a detour through
 * Learn or More.
 *
 * World was removed from this list when it was promoted to a primary tab
 * (NAV_ITEMS) — it would otherwise appear twice in desktop chrome.
 *
 * So this remains a chrome affordance for one layout, NOT a second IA —
 * every route here is already reachable exactly as before, the phone
 * bottom bar is untouched, and nothing here duplicates a primary tab.
 *
 * Parent Dashboard is deliberately absent. It sits behind the parent gate,
 * and putting it in a child's primary chrome would both invite them to
 * knock on that door and imply it is theirs.
 */
export const SECONDARY_NAV_ITEMS: NavItem[] = [
  { label: "Academy", href: "/academy", icon: AcademyIcon },
  { label: "Train Your Mind", href: "/chess-mind", icon: ChessMindIcon },
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
  "/home",
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
  "/world",
  "/chess-school",
  "/chess-time",
];

/** Full-screen sub-routes that never showed the nav even though their
 * parent prefix is an app route. */
const FORCE_BARE_PREFIXES = [
  "/profile/customize",
  "/profile/customize",
  "/profile/customize",
  // Chess School V2 session runner: a board-first screen, bare like /lesson.
  "/chess-school/session",
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

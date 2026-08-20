"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon, PuzzlePieceIcon, PlayIcon, AcademyIcon, MoreIcon } from "./icons";

type NavItem = {
  label: string;
  href: string;
  icon: (props: { className?: string }) => JSX.Element;
  /** Matches this item as active for any path under these prefixes too
   * (defaults to just `href`) — for destinations reached from this tab
   * that live at their own top-level route rather than as a /href/* child. */
  match?: string[];
};

// Five primary destinations (mobile UI/UX redesign) — Home/Puzzles/Play/
// Learn/More, matching what a chess app's own users expect to find as
// dedicated tabs rather than reaching Puzzles through Play or reaching
// Profile/settings-adjacent screens with no tab of their own. "Home" keeps
// the existing /kingdom-map URL (no redirect-site changes needed anywhere
// else in the app) — it's the same route, restructured as a dashboard, not
// a new page — and Chess Kingdom's deeper journey content still lives
// there too, immediately below the dashboard section, so nothing about
// "Chess Kingdom" actually moved or lost a route.
const NAV_ITEMS: NavItem[] = [
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

function isNavItemActive(pathname: string, item: NavItem): boolean {
  const prefixes = item.match ?? [item.href];
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function PrimaryNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 inset-x-0 z-40 border-t border-premium-gold/15 bg-premium-midnightDeep/95 backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto max-w-md flex items-stretch justify-between px-1">
        {NAV_ITEMS.map((item) => {
          const isActive = isNavItemActive(pathname, item);
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              // min-h-[48px] total tap target (icon + label + padding),
              // flex-1 so all five share the bar evenly on any phone width.
              className={`flex-1 min-h-[52px] flex flex-col items-center justify-center gap-1 py-2 transition-colors active:scale-95 duration-100 ${
                isActive ? "text-premium-gold" : "text-premium-ivory/55 hover:text-premium-ivory"
              }`}
            >
              <Icon className={isActive ? "w-6 h-6" : "w-6 h-6"} />
              <span className={`font-classic-body text-[10px] tracking-wide ${isActive ? "font-semibold" : ""}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

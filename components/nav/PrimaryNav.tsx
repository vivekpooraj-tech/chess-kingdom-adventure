"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { KingdomIcon, AcademyIcon, PlayIcon, ProfileIcon } from "./icons";

type NavItem = {
  label: string;
  href: string;
  icon: (props: { className?: string }) => JSX.Element;
  /** Matches this item as active for any path under these prefixes too
   * (defaults to just `href`) — for destinations reached from this tab
   * that live at their own top-level route rather than as a /href/* child. */
  match?: string[];
  enabled: boolean;
};

// Four primary destinations (Phase 19 simplification — down from five).
// Chess Kingdom (/kingdom-map) is the beginner home/hub. Learn (/learn) is
// a new combined index over the existing Academy and Chess Mind sections —
// neither of those routes was removed, they're just no longer separate top-
// level tabs (see app/learn/page.tsx, which links directly into their real
// sub-pages). Discover also drops out of the bar without losing its route —
// it's now one of Chess Kingdom's own destination cards instead.
const NAV_ITEMS: NavItem[] = [
  {
    label: "Chess Kingdom",
    href: "/kingdom-map",
    icon: KingdomIcon,
    // Everything reachable from Chess Kingdom's own destination cards that
    // isn't nested under /kingdom-map/* in the URL — still "inside" Chess
    // Kingdom conceptually, so the tab should stay lit up for it.
    match: ["/kingdom-map", "/discover", "/piece-library"],
    enabled: true,
  },
  {
    label: "Learn",
    href: "/learn",
    icon: AcademyIcon,
    match: ["/learn", "/academy", "/chess-mind", "/lesson"],
    enabled: true,
  },
  {
    label: "Play",
    href: "/play",
    icon: PlayIcon,
    match: ["/play", "/free-play", "/matchmaking", "/puzzles", "/online"],
    enabled: true,
  },
  { label: "Profile", href: "/profile", icon: ProfileIcon, enabled: true },
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
    >
      <div className="mx-auto max-w-md flex items-stretch justify-between px-2">
        {NAV_ITEMS.map((item) => {
          const isActive = item.enabled && isNavItemActive(pathname, item);
          const Icon = item.icon;

          if (!item.enabled) {
            return (
              <div
                key={item.label}
                className="relative flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-premium-ivory/25"
                aria-disabled="true"
              >
                <Icon className="w-5 h-5" />
                <span className="font-classic-body text-[10px] tracking-wide">{item.label}</span>
                <span className="absolute top-1 right-2.5 border border-premium-gold/40 text-premium-gold/70 text-[8px] font-semibold tracking-wide px-1.5 py-0.5 rounded-full">
                  SOON
                </span>
              </div>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-colors ${
                isActive ? "text-premium-gold" : "text-premium-ivory/60 hover:text-premium-ivory"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-classic-body text-[10px] tracking-wide">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

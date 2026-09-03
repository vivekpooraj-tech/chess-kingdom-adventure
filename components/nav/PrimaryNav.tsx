"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon, PuzzlePieceIcon, PlayIcon, AcademyIcon, MoreIcon } from "./icons";

type NavItem = {
  label: string;
  href: string;
  icon: (props: { className?: string }) => JSX.Element;
  match?: string[];
};

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

/**
 * Bottom navigation, on every device. The bar spans the full width and is
 * safe-area aware (--bottom-nav-h + env(safe-area-inset-bottom)); the tap
 * targets sit in a centred, width-capped group so on a wide desktop they
 * read as an intentional bar rather than five icons stretched across
 * 1900px. No is-phone / is-tablet gating — sizing is viewport-driven.
 */
export function PrimaryNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="layout-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-premium-gold/15 bg-premium-midnightDeep/95 backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto flex w-full max-w-lg items-stretch justify-between px-1 sm:px-2">
        {NAV_ITEMS.map((item) => {
          const isActive = isNavItemActive(pathname, item);
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-h-[var(--bottom-nav-h)] flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors duration-100 active:scale-95 ${
                isActive ? "text-premium-gold" : "text-premium-ivory/55 hover:text-premium-ivory"
              }`}
            >
              <Icon className="h-6 w-6" />
              <span
                className={`font-classic-body text-xs tracking-wide ${
                  isActive ? "font-semibold" : ""
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

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

function NavLink({
  item,
  isActive,
  layout,
}: {
  item: NavItem;
  isActive: boolean;
  layout: "bottom" | "side";
}) {
  const Icon = item.icon;

  if (layout === "side") {
    return (
      <Link
        href={item.href}
        aria-current={isActive ? "page" : undefined}
        className={`flex items-center gap-3 rounded-premiumBtn px-3 py-2.5 transition-colors active:scale-[0.98] duration-100 ${
          isActive
            ? "bg-premium-gold/15 text-premium-gold border border-premium-gold/25"
            : "text-premium-ivory/70 hover:text-premium-ivory hover:bg-white/5 border border-transparent"
        }`}
      >
        <Icon className="w-5 h-5 flex-none" />
        <span className={`font-classic-body text-sm ${isActive ? "font-semibold" : ""}`}>{item.label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      className={`flex-1 min-h-[52px] flex flex-col items-center justify-center gap-1 py-2 transition-colors active:scale-95 duration-100 ${
        isActive ? "text-premium-gold" : "text-premium-ivory/55 hover:text-premium-ivory"
      }`}
    >
      <Icon className="w-6 h-6" />
      <span className={`font-classic-body text-[10px] tracking-wide ${isActive ? "font-semibold" : ""}`}>
        {item.label}
      </span>
    </Link>
  );
}

export function PrimaryNav() {
  const pathname = usePathname();

  return (
    <>
      {/* Tablet/desktop — chess.com-style left sidebar */}
      <nav
        aria-label="Primary"
        className="layout-sidebar-nav hidden tablet:flex fixed left-0 top-0 bottom-0 z-40 w-56 flex-col border-r border-premium-gold/15 bg-premium-midnightDeep/98 backdrop-blur-md"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-5 border-b border-premium-gold/10">
          <p className="font-classic-display text-lg text-premium-ivory leading-tight">Chess Mind</p>
          <p className="font-classic-body text-[11px] text-premium-ivory/45 mt-1">Think. Learn. Master.</p>
        </div>
        <div className="flex-1 flex flex-col gap-1 p-3 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.label}
              item={item}
              isActive={isNavItemActive(pathname, item)}
              layout="side"
            />
          ))}
        </div>
      </nav>

      {/* Phone — bottom tab bar */}
      <nav
        aria-label="Primary"
        className="layout-bottom-nav tablet:hidden fixed bottom-0 inset-x-0 z-40 border-t border-premium-gold/15 bg-premium-midnightDeep/95 backdrop-blur-md"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="mx-auto max-w-lg flex items-stretch justify-between px-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.label}
              item={item}
              isActive={isNavItemActive(pathname, item)}
              layout="bottom"
            />
          ))}
        </div>
      </nav>
    </>
  );
}

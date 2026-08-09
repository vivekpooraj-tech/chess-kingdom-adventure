"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PlayIcon, AcademyIcon, ChessMindIcon, DiscoverIcon, ProfileIcon } from "./icons";

type NavItem = {
  label: string;
  href: string;
  icon: (props: { className?: string }) => JSX.Element;
  /** Matches this item as active for any path under `match` (defaults to `href`). */
  match?: string[];
  enabled: boolean;
};

// All five areas now route to real, working pages. "Home" (the command
// center dashboard, currently at /kingdom-map) is reached via redirects
// after sign-in/onboarding and via the various "Back to Home" links, not
// via its own nav tab — matches the Phase 10B brief's exact five-item list.
const NAV_ITEMS: NavItem[] = [
  { label: "Play", href: "/play", icon: PlayIcon, enabled: true },
  { label: "Academy", href: "/academy", icon: AcademyIcon, enabled: true },
  { label: "Chess Mind", href: "/chess-mind", icon: ChessMindIcon, enabled: true },
  { label: "Discover", href: "/discover", icon: DiscoverIcon, enabled: true },
  { label: "Profile", href: "/profile", icon: ProfileIcon, enabled: true },
];

export function PrimaryNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 inset-x-0 z-40 border-t border-premium-gold/15 bg-premium-midnightDeep/95 backdrop-blur-md"
    >
      <div className="mx-auto max-w-md flex items-stretch justify-between px-2">
        {NAV_ITEMS.map((item) => {
          const isActive = item.enabled && pathname.startsWith(item.href);
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

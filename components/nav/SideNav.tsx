"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/branding/Logo";
import { ChevronRightIcon } from "./icons";
import { NAV_ITEMS, isNavItemActive } from "./navConfig";

// Labels + the brand wordmark are ALWAYS in the DOM and hidden purely by
// CSS off `html[data-sidenav="collapsed"]` (set pre-paint by
// ShellBootstrapScript), so a reload into a collapsed sidebar shows no
// label flash. The `collapsed` prop only drives layout/aria that CSS
// cannot (justify, the chevron direction, the toggle's a11y state).

/**
 * Desktop-only left sidebar (UI-2A). Renders the SAME five destinations as
 * the phone bottom bar (from navConfig) — this is a chrome change, not an
 * IA change. Visibility is CSS-driven (`html[data-layout="desktop"]
 * .app-sidenav` in globals.css) so it never flashes on non-desktop.
 *
 * Expanded ≈ 240px (icon + label), collapsed ≈ 72px (icon only, with an
 * accessible name + native title tooltip — a full Tooltip system is a
 * later phase). The collapse state is owned by AppShell and mirrored onto
 * `<html data-sidenav>` so the CSS width var and label visibility stay in
 * sync with no layout shift.
 */
export function SideNav({
  collapsed,
  onToggleCollapsed,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="app-sidenav fixed inset-y-0 left-0 z-40 w-[var(--app-sidenav-w)] flex-col border-r border-premium-gold/15 bg-premium-midnightDeep/95 backdrop-blur-md"
    >
      <div className="flex h-14 flex-none items-center px-4">
        <Link href="/kingdom-map" aria-label="Chess Mind — Home" className="inline-flex items-center">
          <span className="app-sidenav-crest">
            <Logo variant="compact" size={28} />
          </span>
          <span className="app-sidenav-wordmark">
            <Logo variant="horizontal" size={26} />
          </span>
        </Link>
      </div>

      <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-2">
        {NAV_ITEMS.map((item) => {
          const isActive = isNavItemActive(pathname, item);
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              title={item.label}
              className={`app-sidenav-item relative flex min-h-[48px] items-center gap-3 rounded-premiumBtn px-3 font-classic-body text-sm transition-colors duration-100 ${
                isActive
                  ? "bg-premium-navyLight/60 text-premium-gold"
                  : "text-premium-ivory/60 hover:bg-premium-navy/60 hover:text-premium-ivory"
              }`}
            >
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-premium-gold"
                />
              )}
              <Icon className="h-5 w-5 flex-none" />
              <span className="app-sidenav-label truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="flex-none border-t border-white/5 px-2 py-2">
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-pressed={collapsed}
          className="app-sidenav-item flex min-h-[44px] w-full items-center gap-3 rounded-premiumBtn px-3 font-classic-body text-xs text-premium-ivory/45 transition-colors duration-100 hover:bg-premium-navy/60 hover:text-premium-ivory/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/50"
        >
          <ChevronRightIcon
            className={`h-4 w-4 flex-none transition-transform duration-200 ${
              collapsed ? "" : "rotate-180"
            }`}
          />
          <span className="app-sidenav-label">Collapse</span>
        </button>
      </div>
    </nav>
  );
}

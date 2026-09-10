"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isNavItemActive } from "./navConfig";
import { useChessTimeOptional } from "@/components/parentLock/ChessTimeProvider";
import { filterNavItemsForChessTime } from "@/lib/parentLock/navFilter";
import {
  chessTimeNavActivities,
  shouldHideAppNavDuringLock,
} from "@/lib/parentLock/sessionLock";

export function PrimaryNav() {
  const pathname = usePathname();
  const chessTime = useChessTimeOptional();
  const session = chessTime?.session ?? null;
  const expired = chessTime?.expired ?? false;

  if (shouldHideAppNavDuringLock(session, expired)) {
    return null;
  }

  const activities = chessTimeNavActivities(session, expired);
  const items = filterNavItemsForChessTime(NAV_ITEMS, activities);

  if (activities && items.length === 0) return null;

  return (
    <nav
      aria-label="Primary"
      className="layout-bottom-nav fixed inset-x-0 bottom-0 z-50 border-t border-premium-gold/15 bg-premium-midnightDeep/95 backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto flex w-full max-w-lg items-stretch justify-between px-1 sm:px-2">
        {items.map((item) => {
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

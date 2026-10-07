"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PHONE_NAV_ITEMS, PHONE_PLAY_ITEM, isNavItemActive } from "./navConfig";
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
  const items = filterNavItemsForChessTime(PHONE_NAV_ITEMS, activities);
  const showPlay = filterNavItemsForChessTime([PHONE_PLAY_ITEM], activities).length > 0;

  if (activities && items.length === 0 && !showPlay) return null;

  const PlayIcon = PHONE_PLAY_ITEM.icon;

  return (
    <nav
      aria-label="Primary"
      className="layout-bottom-nav world-shell fixed inset-x-0 bottom-0 z-50 border-t border-premium-gold/15 bg-premium-midnightDeep/95 backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto flex w-full max-w-lg flex-col">
        {showPlay && (
          <Link
            href={PHONE_PLAY_ITEM.href}
            data-nav="play"
            className="nav-play-cta"
          >
            <PlayIcon className="h-5 w-5" />
            <span>Play</span>
          </Link>
        )}
        <div className="flex items-stretch justify-between px-1 sm:px-2">
          {items.map((item) => {
            const Icon = item.icon;

            if (item.disabled) {
              // Future feature: visible, clearly inactive, never navigates.
              return (
                <button
                  key={item.label}
                  type="button"
                  disabled
                  aria-disabled="true"
                  data-nav={item.label.toLowerCase()}
                  data-soon="true"
                  className="nav-soon flex min-h-[var(--bottom-nav-row-h)] flex-1 cursor-default flex-col items-center justify-center gap-1 py-2 text-premium-ivory/30"
                >
                  <Icon className="h-6 w-6" />
                  <span className="font-classic-body text-xs tracking-wide">{item.label}</span>
                  <span className="nav-soon-tag" aria-hidden="true">Soon</span>
                </button>
              );
            }

            const isActive = isNavItemActive(pathname, item);

            return (
              <Link
                key={item.label}
                href={item.href}
                data-nav={item.label.toLowerCase()}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-[var(--bottom-nav-row-h)] flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors duration-100 active:scale-95 ${
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
      </div>
    </nav>
  );
}

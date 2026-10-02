"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UTILITY_NAV_ITEMS, isNavItemActive } from "./navConfig";
import { useChessTimeOptional } from "@/components/parentLock/ChessTimeProvider";
import { chessTimeNavActivities, shouldHideAppNavDuringLock } from "@/lib/parentLock/sessionLock";

/**
 * The persistent Learn + More icon pair — not one of the five primary
 * tabs, but each still needs a named, always-reachable entry point (the
 * approved navigation decision: "do not hide important product areas
 * behind a generic More"). Rendered inline by AppTopBar on tablet/desktop
 * and inside a small fixed wrapper (PhoneUtilityIcons) on phone, so the
 * Chess-Time-aware visibility logic below lives in exactly one place
 * regardless of breakpoint.
 *
 * Chess-Time awareness is handled HERE, independently of
 * lib/parentLock/navFilter.ts, because these are no longer primary
 * NavItems that filter ever sees. The rules mirror what that filter used
 * to do for `/learn` and always did for `/more`:
 *   - An expired, locked session hides everything (matches PrimaryNav).
 *   - An active, restricted session hides More entirely (parent settings
 *     stay behind the PIN) and shows Learn only when "academy" is
 *     explicitly allowed — narrower than the old merged `/learn` check
 *     (which also accepted "chess_school"), because Chess School now has
 *     its own dedicated primary tab with its own allow-list check.
 *   - No restriction (the common case): both show normally.
 */
export function UtilityNavIcons({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const chessTime = useChessTimeOptional();
  const session = chessTime?.session ?? null;
  const expired = chessTime?.expired ?? false;

  if (shouldHideAppNavDuringLock(session, expired)) return null;

  const activities = chessTimeNavActivities(session, expired);
  const items = activities
    ? UTILITY_NAV_ITEMS.filter((item) => {
        if (item.href === "/more") return false;
        if (item.href === "/learn") return activities.includes("academy");
        return false;
      })
    : UTILITY_NAV_ITEMS;

  if (items.length === 0) return null;

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {items.map((item) => {
        const isActive = isNavItemActive(pathname, item);
        const Icon = item.icon;
        return (
          <Link
            key={item.label}
            href={item.href}
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
            className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-colors ${
              isActive
                ? "text-premium-gold"
                : "text-premium-ivory/60 hover:text-premium-ivory hover:bg-white/5"
            }`}
          >
            <Icon className="h-5 w-5" />
            <span className="sr-only">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

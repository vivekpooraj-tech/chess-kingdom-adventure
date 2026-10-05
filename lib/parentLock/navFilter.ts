import type { NavItem } from "@/components/nav/navConfig";
import type { ChessTimeActivityId } from "./types";

/**
 * During an active Chess Time session, only show primary nav tabs that lead
 * to allowed activities. More is hidden (parent settings behind PIN).
 *
 * COMPATIBILITY UPDATE (Chess Mind navigation restructuring, approved as a
 * narrow exception to "do not modify Parent Lock" — see
 * CHESS_MIND_IMPLEMENTATION_PLAN.md): NAV_ITEMS now includes `/chess-school`
 * and `/world` as primary tabs (previously reachable only via a merged
 * `/learn` tab or a Home card, neither of which this filter needed a branch
 * for). Without these two branches, both would silently fall through to
 * `return false` below and stay hidden even when a parent explicitly
 * allowed them — this update is what keeps the existing allow-list
 * guarantee correct after that navigation change, not a change to what the
 * allow-list itself can express. `/puzzles`, `/play`, and `/more` are
 * unchanged. The old `/learn` branch is removed because Learn is no longer
 * a primary NavItem this filter ever receives (it's now a persistent
 * utility icon — see components/nav/AppTopBar.tsx and
 * PhoneUtilityIcons.tsx, which apply the equivalent `academy` check
 * directly, independently of this function).
 */
export function filterNavItemsForChessTime(
  items: readonly NavItem[],
  allowedActivities: ChessTimeActivityId[] | null
): NavItem[] {
  if (!allowedActivities) return [...items];
  const allowed = new Set(allowedActivities);

  return items.filter((item) => {
    if (item.href === "/more") return false;
    if (item.href === "/home") return false;
    if (item.href === "/puzzles") return allowed.has("puzzles");
    if (item.href === "/play") return allowed.has("play");
    if (item.href === "/chess-school") return allowed.has("chess_school");
    if (item.href === "/world") return allowed.has("world");
    return false;
  });
}

import type { NavItem } from "@/components/nav/navConfig";
import type { ChessTimeActivityId } from "./types";

/**
 * During an active Chess Time session, only show primary nav tabs that lead
 * to allowed activities. More is hidden (parent settings behind PIN).
 */
export function filterNavItemsForChessTime(
  items: readonly NavItem[],
  allowedActivities: ChessTimeActivityId[] | null
): NavItem[] {
  if (!allowedActivities) return [...items];
  const allowed = new Set(allowedActivities);

  return items.filter((item) => {
    if (item.href === "/more") return false;
    if (item.href === "/kingdom-map") return false;
    if (item.href === "/puzzles") return allowed.has("puzzles");
    if (item.href === "/play") return allowed.has("play");
    if (item.href === "/learn") {
      return allowed.has("academy") || allowed.has("chess_school");
    }
    return false;
  });
}

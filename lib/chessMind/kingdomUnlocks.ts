/**
 * Chess Mind -> Kingdom Journey connection, per the product spec ("When a
 * child completes enough Chess Mind challenges, unlock progress in the
 * Kingdom Journey"). Thresholds live here, not scattered across
 * components, so they're easy to find and tune.
 *
 * Deliberately implemented as a bonus "zone spotlight" rather than
 * literally advancing `children.current_day` or bypassing the per-zone
 * free-lesson gate — the day-gate is server-enforced (see
 * supabase/migrations/0009_mark_lesson_complete_rpc.sql and its Phase 14
 * successor) specifically to close a real paywall bypass found during
 * Phase 5, and this feature shouldn't reopen it. The reward is real (a
 * genuine, visible unlock on the Kingdom Map) without touching the
 * paywall-sensitive progression.
 */
export interface KingdomUnlockRule {
  moduleId: string;
  count: number;
  zoneId: string; // matches an id in content/kingdomZones.ts
  label: string;
}

export const KINGDOM_UNLOCK_RULES: KingdomUnlockRule[] = [
  { moduleId: "pattern", count: 10, zoneId: "knight-forest", label: "Knight Forest Spotlight" },
  { moduleId: "visualization", count: 20, zoneId: "bishop-temple", label: "Bishop Temple Spotlight" },
  { moduleId: "spatial", count: 15, zoneId: "rook-fortress", label: "Rook Fortress Spotlight" },
  { moduleId: "mathematics", count: 15, zoneId: "queens-court", label: "Queen's Court Spotlight" },
  { moduleId: "memory", count: 20, zoneId: "kings-castle", label: "King's Castle Spotlight" },
];

export interface UnlockedBonus {
  zoneId: string;
  label: string;
}

/** `totals` is module_id -> total_solved, e.g. from getChessMindStatsByModule(). */
export function getUnlockedKingdomBonuses(totals: Record<string, number>): UnlockedBonus[] {
  return KINGDOM_UNLOCK_RULES.filter((rule) => (totals[rule.moduleId] ?? 0) >= rule.count).map(
    (rule) => ({ zoneId: rule.zoneId, label: rule.label })
  );
}

/**
 * Groups the 30 existing lesson days into the six Kingdom zones from the
 * product spec (Pawn Village -> King's Castle). Purely a display/labeling
 * layer over the real `dayNumber` progression already in content/lessons.ts
 * — no lesson content changes, no new data model.
 */
export interface KingdomZone {
  id: string;
  name: string;
  emoji: string;
  dayStart: number;
  dayEnd: number;
  /**
   * How many of this zone's lessons are free before Premium is required
   * (Phase 14 — replaces the old flat "days 1-3 free" rule). Pawn Village
   * gets one extra lesson as a bigger taste of the very first zone; every
   * later zone gets two, so a free child can see the start of every zone
   * instead of stalling right after onboarding.
   */
  freeLessonCount: number;
}

export const KINGDOM_ZONES: KingdomZone[] = [
  { id: "pawn-village", name: "Pawn Village", emoji: "\u{1F33E}", dayStart: 1, dayEnd: 5, freeLessonCount: 3 },
  { id: "knight-forest", name: "Knight Forest", emoji: "\u{1F332}", dayStart: 6, dayEnd: 10, freeLessonCount: 2 },
  { id: "bishop-temple", name: "Bishop Temple", emoji: "\u{1F6D5}", dayStart: 11, dayEnd: 15, freeLessonCount: 2 },
  { id: "rook-fortress", name: "Rook Fortress", emoji: "\u{1F3EF}", dayStart: 16, dayEnd: 20, freeLessonCount: 2 },
  { id: "queens-court", name: "Queen's Court", emoji: "\u{1F451}", dayStart: 21, dayEnd: 25, freeLessonCount: 2 },
  { id: "kings-castle", name: "King's Castle", emoji: "\u{1F3F0}", dayStart: 26, dayEnd: 30, freeLessonCount: 2 },
];

/** Days beyond 30 (course complete) clamp to the final zone. */
export function getZoneForDay(day: number): KingdomZone {
  const clamped = Math.min(Math.max(day, 1), KINGDOM_ZONES[KINGDOM_ZONES.length - 1].dayEnd);
  return (
    KINGDOM_ZONES.find((z) => clamped >= z.dayStart && clamped <= z.dayEnd) ??
    KINGDOM_ZONES[KINGDOM_ZONES.length - 1]
  );
}

/**
 * Whether a day is free under the new per-zone rule — replaces the old
 * flat `dayNumber <= FREE_DAY_LIMIT` check everywhere it was used. This is
 * the client-side mirror of the same formula enforced server-side in
 * mark_lesson_complete (supabase/migrations/0015_zone_based_free_lessons.sql)
 * — keep both in sync, same manual-sync tradeoff already accepted for the
 * old FREE_DAY_LIMIT constant.
 */
export function isDayFree(dayNumber: number): boolean {
  const zone = getZoneForDay(dayNumber);
  return dayNumber - zone.dayStart < zone.freeLessonCount;
}

/**
 * Every free day number across the whole Kingdom, in order (e.g.
 * [1,2,3,6,7,11,12,...]). Used to check "has this free user completed
 * every free day before this one" without requiring the *premium* days in
 * between — a plain `dayNumber <= currentDay` sequential check would trap
 * a free user at the first premium day forever, since current_day only
 * advances past a day once it's completed, and free users can never
 * complete a premium day. See KingdomMapCards.
 */
export function getFreeDayNumbers(): number[] {
  const days: number[] = [];
  for (const zone of KINGDOM_ZONES) {
    for (let d = zone.dayStart; d < zone.dayStart + zone.freeLessonCount && d <= zone.dayEnd; d++) {
      days.push(d);
    }
  }
  return days;
}

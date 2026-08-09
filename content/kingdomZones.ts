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
}

export const KINGDOM_ZONES: KingdomZone[] = [
  { id: "pawn-village", name: "Pawn Village", emoji: "\u{1F33E}", dayStart: 1, dayEnd: 5 },
  { id: "knight-forest", name: "Knight Forest", emoji: "\u{1F332}", dayStart: 6, dayEnd: 10 },
  { id: "bishop-temple", name: "Bishop Temple", emoji: "\u{1F6D5}", dayStart: 11, dayEnd: 15 },
  { id: "rook-fortress", name: "Rook Fortress", emoji: "\u{1F3EF}", dayStart: 16, dayEnd: 20 },
  { id: "queens-court", name: "Queen's Court", emoji: "\u{1F451}", dayStart: 21, dayEnd: 25 },
  { id: "kings-castle", name: "King's Castle", emoji: "\u{1F3F0}", dayStart: 26, dayEnd: 30 },
];

/** Days beyond 30 (course complete) clamp to the final zone. */
export function getZoneForDay(day: number): KingdomZone {
  const clamped = Math.min(Math.max(day, 1), KINGDOM_ZONES[KINGDOM_ZONES.length - 1].dayEnd);
  return (
    KINGDOM_ZONES.find((z) => clamped >= z.dayStart && clamped <= z.dayEnd) ??
    KINGDOM_ZONES[KINGDOM_ZONES.length - 1]
  );
}

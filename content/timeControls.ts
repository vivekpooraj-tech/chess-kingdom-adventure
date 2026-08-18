export interface TimeControl {
  /** Also the value stored in online_games.time_control. */
  id: string;
  /** "5 + 0" */
  label: string;
  /** Plain, non-official pacing description — not a claim about any
   * governing body's classification. Also doubles as the Blitz/Rapid
   * category filter for Group Tournament creation (content/tournaments
   * reads this field directly rather than adding a separate category). */
  description: "Blitz" | "Rapid";
  initialSeconds: number;
  incrementSeconds: number;
}

// Expanded for Group Tournament creation (Phase 23) — the original 3 remain
// exactly as they were (same ids, same values) so Random Match and Invite a
// Friend are unaffected; 4 more added to match the Blitz/Rapid presets
// tournament creators can pick from. Every id here must also appear in the
// online_games.time_control CHECK constraint and the clock-defaults
// trigger's CASE statement (supabase/migrations/0017, extended by 0021) —
// kept in sync by hand, same tradeoff already accepted for the original 3.
export const TIME_CONTROLS: TimeControl[] = [
  { id: "3+0", label: "3 + 0", description: "Blitz", initialSeconds: 3 * 60, incrementSeconds: 0 },
  { id: "3+2", label: "3 + 2", description: "Blitz", initialSeconds: 3 * 60, incrementSeconds: 2 },
  { id: "5+0", label: "5 + 0", description: "Blitz", initialSeconds: 5 * 60, incrementSeconds: 0 },
  { id: "5+3", label: "5 + 3", description: "Blitz", initialSeconds: 5 * 60, incrementSeconds: 3 },
  { id: "10+0", label: "10 + 0", description: "Rapid", initialSeconds: 10 * 60, incrementSeconds: 0 },
  { id: "10+5", label: "10 + 5", description: "Rapid", initialSeconds: 10 * 60, incrementSeconds: 5 },
  { id: "15+10", label: "15 + 10", description: "Rapid", initialSeconds: 15 * 60, incrementSeconds: 10 },
];

export const DEFAULT_TIME_CONTROL_ID = "10+0";

export function getTimeControl(id: string | null | undefined): TimeControl {
  return (
    TIME_CONTROLS.find((t) => t.id === id) ??
    TIME_CONTROLS.find((t) => t.id === DEFAULT_TIME_CONTROL_ID)!
  );
}

export function getTimeControlsByCategory(category: "Blitz" | "Rapid"): TimeControl[] {
  return TIME_CONTROLS.filter((t) => t.description === category);
}

export interface TimeControl {
  /** Also the value stored in online_games.time_control. */
  id: string;
  /** "5 + 0" */
  label: string;
  /** Plain, non-official pacing description — not a claim about any
   * governing body's classification. */
  description: string;
  initialSeconds: number;
  incrementSeconds: number;
}

// Deliberately just three presets, not a configurable marketplace — easy
// to extend later by adding another entry here; nothing else needs to
// change (Random Match and Invite a Friend both just read this list).
export const TIME_CONTROLS: TimeControl[] = [
  { id: "5+0", label: "5 + 0", description: "Blitz", initialSeconds: 5 * 60, incrementSeconds: 0 },
  { id: "10+0", label: "10 + 0", description: "Rapid", initialSeconds: 10 * 60, incrementSeconds: 0 },
  { id: "15+10", label: "15 + 10", description: "Rapid", initialSeconds: 15 * 60, incrementSeconds: 10 },
];

export const DEFAULT_TIME_CONTROL_ID = "10+0";

export function getTimeControl(id: string | null | undefined): TimeControl {
  return (
    TIME_CONTROLS.find((t) => t.id === id) ??
    TIME_CONTROLS.find((t) => t.id === DEFAULT_TIME_CONTROL_ID)!
  );
}

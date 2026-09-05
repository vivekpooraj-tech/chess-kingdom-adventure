/**
 * Wire shape for the Reaction trainer.
 *
 * Types only — no data, no chess engine, no `fs` — so the client can import
 * this without pulling the puzzle library into the browser bundle.
 */

export interface ReactionOption {
  from: string;
  to: string;
  san: string;
  promotion?: string;
}

export interface ReactionChallenge {
  id: string;
  fen: string;
  sideToMove: "w" | "b";
  /** Shuffled: the correct move plus decoys, all legal in this position. */
  options: ReactionOption[];
  /**
   * Index of the correct option.
   *
   * Deliberately sent to the client. This is a timed trainer, so the answer
   * must be checkable the instant the learner taps — a network round trip would
   * be counted as thinking time and would make the measurement meaningless.
   * There is nothing to protect here: it is solo practice against your own
   * previous times, with no ranking or reward attached.
   */
  correctIndex: number;
  rating: number;
  /** Difficulty band this challenge was drawn from, for the UI to display. */
  tier: "beginner" | "intermediate" | "advanced";
}

export interface ReactionResponse {
  challenge: ReactionChallenge | null;
}

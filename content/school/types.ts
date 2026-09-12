/**
 * Chess School V2 — the content contract.
 *
 * WHAT THIS IS NOT. It is not content/lessons.ts under a new name. That file
 * holds the thirty-day Kingdom Journey, it is live, children have progress
 * against it, and nothing here reads it or writes to it. The two courses share
 * the ChessBoard, chess.js and the design system, and nothing else.
 *
 * WHY A SEPARATE SHAPE AT ALL. The Kingdom Journey's lesson is a story beat
 * plus a fixed seven-step ritual. Chess School is trying to do a different
 * job — move a child from "chess is confusing" to "I am someone who plays
 * chess" — and that job needs step kinds the Journey has no concept of: a
 * board where a parent is quietly coached through a losing move, a duel on
 * one phone between two humans, a ceremony that is not a lesson at all.
 *
 * EVERYTHING A CHILD READS IS DATA. Every line Ollie says in a session is
 * written here, in the content, as a plain string. Nothing in the core loop
 * calls a model. That is a deliberate product constraint, not a limitation:
 * a child in the middle of their first checkmate must never see a spinner
 * because an API key expired, a quota ran out, or a train went into a tunnel.
 * Live AI can enrich this later; it can never be load-bearing.
 */

/** The kinds of step a session can be built from. */
export type SchoolStepType =
  | "teach"
  | "guided_board"
  | "puzzle_drill"
  | "bot_match"
  | "parent_mode"
  | "pass_and_play"
  | "exam"
  | "ceremony"
  | "recap";

/**
 * A skill the course can claim a child has learned. Deliberately a small,
 * closed vocabulary: every one of these has to be expressible as a sentence a
 * parent would actually say out loud (see lib/school/v2/parentSummary.ts),
 * which is impossible for a taxonomy that grows without limit.
 */
export type SchoolSkillTag =
  | "board_setup"
  | "pawn_movement"
  | "pawn_capture"
  | "pawn_promotion"
  | "knight_movement"
  | "bishop_movement"
  | "rook_movement"
  | "queen_movement"
  | "king_movement"
  | "check"
  | "hanging_pieces"
  | "fork"
  | "pin"
  | "skewer"
  | "back_rank"
  | "escape_check"
  | "checkmate"
  | "castling"
  | "opening_principles"
  | "king_safety"
  | "planning"
  | "endgame_king"
  | "full_game"
  | "teaching_others";

/** A piece's memorable identity. One per major piece, no more. */
export interface PieceSuperpower {
  id: string;
  piece: "pawn" | "knight" | "bishop" | "rook" | "queen" | "king";
  /** The name a child repeats to a friend. */
  name: string;
  /** One sentence. This is the whole point of the superpower. */
  power: string;
  /** Which session number reveals it. */
  unlockedBySession: number;
  emoji: string;
}

/**
 * One puzzle in a drill.
 *
 * `solutionMoves` accepts SAN ("Nxe5") or UCI ("g1f3"); the runner and the
 * test suite both resolve them through chess.js against `fen`, so a typo is a
 * failing test rather than a child stuck on an unsolvable position. Any move
 * in the list counts as correct — some positions genuinely have two winning
 * forks and refusing the second one would teach the wrong lesson.
 */
export interface SchoolPuzzle {
  id: string;
  fen: string;
  prompt: string;
  solutionMoves: readonly string[];
  hint?: string;
  /**
   * A bespoke reaction said instead of the generic solvedLine rotation, for
   * the handful of puzzles where the generic "you spotted it" undersells the
   * moment (Fork Festival's "wait — that attacks BOTH?!"). Optional: every
   * puzzle without one keeps using the shared rotation exactly as before.
   */
  successLine?: string;
}

/**
 * A drill: two or three puzzles, a pass bar, and a way back for a child who
 * misses it. `remedial` is the easier position offered after a failure — never
 * a wall, always a smaller step.
 */
export interface SchoolDrill {
  puzzles: readonly SchoolPuzzle[];
  /** How many must be right to pass. Content sets it; typically 2 of 3. */
  passRequired: number;
  remedial: SchoolPuzzle;
  /** Said once, before the remedial puzzle. Explains the idea again, smaller. */
  remedialTeach: string;
}

/**
 * One scripted beat of Parent Mode: what the grown-up is told to do, and what
 * the child is trying to spot.
 */
export interface ParentModeStep {
  fen: string;
  /** Shown only on the parent's panel. The child never sees this text. */
  parentInstruction: string;
  /** Shown to the child as their goal. Never names the parent's move. */
  childGoal: string;
  /** The move that proves the child found it, SAN or UCI. */
  successMove?: string;
}

/** A milestone a child can show someone. */
export interface SchoolUnlock {
  id: string;
  title: string;
  /** The line printed on the share card. Written to be said out loud. */
  tagline: string;
  emoji: string;
}

/**
 * Steps are a discriminated union on `type`, so the runner cannot render a
 * parent_mode step with puzzle fields and TypeScript says so at the call site
 * rather than at a child's screen.
 */
interface StepBase {
  id: string;
  title: string;
}

export interface TeachStep extends StepBase {
  type: "teach";
  /** Two or three short lines. Never a wall of text. */
  lines: readonly string[];
  /** Optional position shown alongside, read-only. */
  fen?: string;
}

export interface GuidedBoardStep extends StepBase {
  type: "guided_board";
  fen: string;
  goal: string;
  /** Any of these completes the step (SAN or UCI). */
  acceptMoves: readonly string[];
  /**
   * Shown in order as the child struggles: gentle, then concrete, then the
   * square. The last rung names the move — but only after real attempts, which
   * is the difference between a hint and an answer key.
   */
  hintLadder: readonly string[];
  /** Said when the child plays something legal but not the goal. */
  onWrong: string;
}

export interface PuzzleDrillStep extends StepBase {
  type: "puzzle_drill";
  drill: SchoolDrill;
}

export interface BotMatchStep extends StepBase {
  type: "bot_match";
  fen?: string;
  goal: string;
  /** Play this many of the child's own moves to pass. Confidence, not rating. */
  movesRequired: number;
  /** No hint button exists at all when false — Session 24 depends on this. */
  hintsAllowed: boolean;
  /**
   * A one-time "get ready" screen shown BEFORE the board mounts — no engine
   * loaded, nothing to render, until the child taps through. Optional: a
   * bot_match with no prelude behaves exactly as it always has. Used for the
   * WOW moments where the moment before the game matters as much as the game.
   */
  prelude?: {
    headline: string;
    lines: readonly string[];
    cta: string;
  };
}

export interface ParentModeSessionStep extends StepBase {
  type: "parent_mode";
  intro: string;
  beats: readonly ParentModeStep[];
  celebration: string;
}

export interface PassAndPlayStep extends StepBase {
  type: "pass_and_play";
  intro: string;
  /** Shown to whoever is about to move. Local only — no network, no chat. */
  goal: string;
  /** Same "get ready" screen as bot_match's, for the Graduation Duel. Optional. */
  prelude?: {
    headline: string;
    lines: readonly string[];
    cta: string;
  };
  /**
   * Overrides the generic "White wins. Shake hands." ending. Used only where
   * the psychology of the result matters (Graduation: win or lose, you
   * graduate). Every existing pass_and_play step without this keeps its
   * current generic wording exactly.
   */
  resultLines?: {
    win: string;
    loss: string;
    draw: string;
  };
}

export interface ExamStep extends StepBase {
  type: "exam";
  intro: string;
  drill: SchoolDrill;
}

export interface CeremonyStep extends StepBase {
  type: "ceremony";
  headline: string;
  lines: readonly string[];
  unlock?: SchoolUnlock;
  /**
   * Reserves the biggest staged reveal and glow for genuine milestones —
   * "small success: subtle delight, major milestone: memorable ceremony".
   * Ordinary superpower reveals (Queen and King, meet the Rook) stay calm and
   * omit this; the five WOW moments and their share-card unlocks set it.
   */
  epic?: boolean;
}

export interface RecapStep extends StepBase {
  type: "recap";
  /** Three at most. What the child can now do, in their own words. */
  learned: readonly string[];
  nextTeaser: string;
  /**
   * Reveals `learned` one line at a time as a full-width title card instead
   * of an all-at-once checklist — the Graduation Day skill montage. Optional,
   * and every other recap keeps its instant checklist exactly as it is.
   */
  montage?: boolean;
}

export type SchoolStep =
  | TeachStep
  | GuidedBoardStep
  | PuzzleDrillStep
  | BotMatchStep
  | ParentModeSessionStep
  | PassAndPlayStep
  | ExamStep
  | CeremonyStep
  | RecapStep;

/**
 * Whether a session is fully authored or a signposted stop on the map.
 *
 * "preview" exists so the thirty-session arc can be REAL from day one without
 * pretending. A preview session shows what it will teach and says plainly that
 * it is still being built; it never opens a board that goes nowhere. The
 * alternative — thirty shallow sessions so the count looks right — is exactly
 * the fake content this course is not allowed to have.
 */
export type SchoolSessionStatus = "playable" | "preview";

export interface SchoolSession {
  id: string;
  /** 1–30. The order a child moves through them. */
  number: number;
  moduleId: string;
  title: string;
  /** One line under the title, on the card. */
  subtitle: string;
  skillTags: readonly SchoolSkillTag[];
  /** A starred session is a WOW moment and gets ceremony treatment. */
  starred: boolean;
  estimatedMinutes: number;
  status: SchoolSessionStatus;
  /** Superpower id revealed by finishing this session, if any. */
  superpowerId?: string;
  /** Deterministic coach copy, scoped to this session's one skill. */
  ollie: {
    intro: string;
    mistake: string;
    success: string;
  };
  steps: readonly SchoolStep[];
  shareUnlock?: SchoolUnlock;
}

/** The four acts of the arc. Pacing copy, never gating. */
export type SchoolAct = 1 | 2 | 3 | 4;

export interface SchoolModule {
  id: string;
  number: number;
  title: string;
  /** Plain English, for the child. */
  blurb: string;
  act: SchoolAct;
  sessionNumbers: readonly number[];
}

/** What the database stores, and what every screen reads. */
export interface SchoolProgress {
  /** Session numbers finished: ascending, de-duplicated, in range. */
  completedSessions: readonly number[];
  /** Skills the child has demonstrably learned. */
  skillTags: readonly SchoolSkillTag[];
  /** Share-card ids earned. */
  unlocks: readonly string[];
  graduatedAt: string | null;
}

export interface SchoolCertificate {
  childName: string;
  graduatedAt: string;
  skills: readonly string[];
  title: string;
}

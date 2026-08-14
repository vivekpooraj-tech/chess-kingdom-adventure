import type { Color } from "chess.js";

/**
 * Chess Mind — Calculation. Same "curated, programmatically-verified
 * positions" approach as content/chessMindPatterns.ts, not procedural
 * generation — every FEN, every step's from/to, and every scripted
 * opponent reply below was verified with chess.js before being added here
 * (legal position, correct side to move, each step legal in sequence, and
 * multi-move lines independently re-confirmed to end in real checkmate —
 * see the phase's own verification script, not asserted by eye).
 *
 * Levels 4-5's multi-move lines reuse already mate-in-N-verified starting
 * positions from the Daily Challenge/Tactics phases (a forced mate sound
 * against EVERY legal defense), then pick one concrete legal reply at each
 * step and re-verify the resulting follow-up — a valid subset of a
 * property already proven, not a new unverified claim.
 */

export type CalculationLevelNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface CalculationLevelInfo {
  level: CalculationLevelNumber;
  title: string;
  description: string;
}

export const CALCULATION_LEVELS: CalculationLevelInfo[] = [
  { level: 1, title: "Level 1", description: "Find the obvious best move." },
  { level: 2, title: "Level 2", description: "Find the opponent's response." },
  { level: 3, title: "Level 3", description: "Calculate one full variation." },
  { level: 4, title: "Level 4", description: "Calculate two moves ahead." },
  { level: 5, title: "Level 5", description: "Calculate three moves ahead." },
  { level: 6, title: "Level 6", description: "Compare two candidate moves." },
  { level: 7, title: "Level 7", description: "Mixed calculation challenges." },
];

export interface CalculationStep {
  from: string;
  to: string;
  /** Applied immediately after this step if this ISN'T the final step in
   * the sequence — a specific, pre-verified legal reply, not a live
   * engine/random opponent, so the whole line is exactly reproducible. */
  opponentReplyFrom?: string;
  opponentReplyTo?: string;
}

export interface CalculationSequenceChallenge {
  kind: "sequence";
  id: string;
  level: CalculationLevelNumber;
  fen: string;
  sideToMove: Color;
  prompt: string;
  steps: CalculationStep[];
  /** Level 3's "one full variation" framing — after the player's single
   * correct move, the scripted opponent reply plays out automatically on
   * the board (read-only) so they SEE the resulting position, rather than
   * the exercise just ending the instant they find the first move. */
  revealReplyAfter?: boolean;
  successMessage: string;
  failureMessage: string;
  explanation: string;
}

export interface CalculationChoiceOption {
  from: string;
  to: string;
  label: string;
  isBest: boolean;
}

export interface CalculationChoiceChallenge {
  kind: "choice";
  id: string;
  level: CalculationLevelNumber;
  fen: string;
  sideToMove: Color;
  prompt: string;
  options: CalculationChoiceOption[];
  successMessage: string;
  failureMessage: string;
  explanation: string;
}

export type CalculationChallenge = CalculationSequenceChallenge | CalculationChoiceChallenge;

export const CALCULATION_CHALLENGES: CalculationChallenge[] = [
  // --- Level 1: find the obvious best move (single move) ---
  {
    kind: "sequence",
    id: "calc-l1-hanging-bishop",
    level: 1,
    fen: "4k3/8/8/3b4/8/8/8/3RK3 w - - 0 1",
    sideToMove: "w",
    prompt: "Black's bishop is undefended. What's the obvious best move?",
    steps: [{ from: "d1", to: "d5" }],
    successMessage: "Exactly — no reason to look any further than the free piece sitting right there.",
    failureMessage: "Scan the board first: is anything of Black's just hanging?",
    explanation: "Rxd5 simply wins the bishop. Calculation always starts with the obvious — don't overthink a free piece.",
  },
  {
    kind: "sequence",
    id: "calc-l1-back-rank-mate",
    level: 1,
    fen: "6k1/5ppp/8/8/8/8/8/2Q4K w - - 0 1",
    sideToMove: "w",
    prompt: "Black's king has no escape squares. Find the obvious best move.",
    steps: [{ from: "c1", to: "c8" }],
    successMessage: "Checkmate — the king's own pawns sealed every exit.",
    failureMessage: "The king is boxed in by its own pawns. Which file gets your queen to the back rank?",
    explanation: "Qc8# — when the obvious move is checkmate, there's nothing left to calculate.",
  },

  // --- Level 2: find the opponent's response (single move, from the responding side's perspective) ---
  {
    kind: "sequence",
    id: "calc-l2-predict-fork",
    level: 2,
    fen: "8/8/2q3k1/8/8/3N4/8/6K1 w - - 0 1",
    sideToMove: "w",
    prompt: "White just threatened the queen with the knight. What's White's strongest follow-up?",
    steps: [{ from: "d3", to: "e5" }],
    successMessage: "Right — a fork on the king and queen at once.",
    failureMessage: "Look for a knight jump that attacks two things at once.",
    explanation: "Ne5+ forks the king and queen — Black can only save one.",
  },
  {
    kind: "sequence",
    id: "calc-l2-predict-capture",
    level: 2,
    fen: "4k3/8/8/8/3n4/8/8/3QK3 w - - 0 1",
    sideToMove: "w",
    prompt: "Black's knight is undefended. What's White's best response?",
    steps: [{ from: "d1", to: "d4" }],
    successMessage: "Right — the queen simply takes the free piece.",
    failureMessage: "Is Black's knight defended by anything at all?",
    explanation: "Qxd4 wins the knight outright — always check what's undefended before anything else.",
  },

  // --- Level 3: one full variation (move + revealed scripted reply) ---
  {
    kind: "sequence",
    id: "calc-l3-variation-a",
    level: 3,
    fen: "4k3/8/8/3b4/8/8/8/3RK3 w - - 0 1",
    sideToMove: "w",
    prompt: "Find White's best move — then watch how the position continues.",
    steps: [{ from: "d1", to: "d5", opponentReplyFrom: "e8", opponentReplyTo: "e7" }],
    revealReplyAfter: true,
    successMessage: "Rxd5 wins the bishop — and here's how Black actually replied.",
    failureMessage: "What's undefended for Black right now?",
    explanation: "A full variation isn't just your move — it's your move AND what happens next. Get used to looking one step further.",
  },
  {
    kind: "sequence",
    id: "calc-l3-variation-b",
    level: 3,
    fen: "6k1/5ppp/8/8/8/8/1Q6/6K1 w - - 0 1",
    sideToMove: "w",
    prompt: "Find White's strongest move — then see Black's reply.",
    steps: [{ from: "b2", to: "b7", opponentReplyFrom: "h7", opponentReplyTo: "h5" }],
    revealReplyAfter: true,
    successMessage: "Qb7 takes full control of the position — here's what Black played next.",
    failureMessage: "Which move gives your queen the most active square?",
    explanation: "Calculating a variation means picturing what the board looks like AFTER the reply, not just after your own move.",
  },

  // --- Level 4: two moves ahead (verified 2-player-move mate sequences) ---
  {
    kind: "sequence",
    id: "calc-l4-rook-ladder",
    level: 4,
    fen: "k7/1R6/8/8/8/8/8/KR6 w - - 0 1",
    sideToMove: "w",
    prompt: "Calculate two moves ahead — find the forced mate in 2.",
    steps: [
      { from: "b7", to: "b5", opponentReplyFrom: "a8", opponentReplyTo: "a7" },
      { from: "b5", to: "a5" },
    ],
    successMessage: "Checkmate in two, exactly as calculated.",
    failureMessage: "Think two moves ahead: where does the FIRST rook move need to go so the second one can finish it?",
    explanation: "Rb5 cuts the king off; wherever it goes, Ra5 delivers mate along the rank. That's calculating a full line, not just one move.",
  },
  {
    kind: "sequence",
    id: "calc-l4-queen-king",
    level: 4,
    fen: "k7/8/Q7/K7/8/8/8/8 w - - 0 1",
    sideToMove: "w",
    prompt: "Calculate two moves ahead — find the forced mate in 2.",
    steps: [
      { from: "a5", to: "b6", opponentReplyFrom: "a8", opponentReplyTo: "b8" },
      { from: "a6", to: "b7" },
    ],
    successMessage: "Checkmate — you calculated the whole sequence correctly.",
    failureMessage: "Bring the king closer first. Where does it need to stand so the queen can finish next move?",
    explanation: "Kb6 first, then Qb7# once the king is forced to b8 — the queen alone can't do it without the king's help.",
  },

  // --- Level 5: three moves ahead (verified 3-player-move mate sequences) ---
  {
    kind: "sequence",
    id: "calc-l5-queen-net",
    level: 5,
    fen: "k7/2Q5/8/K7/8/8/8/8 w - - 0 1",
    sideToMove: "w",
    prompt: "Calculate three moves ahead — find the forced mate in 3.",
    steps: [
      { from: "c7", to: "d7", opponentReplyFrom: "a8", opponentReplyTo: "b8" },
      { from: "a5", to: "a6", opponentReplyFrom: "b8", opponentReplyTo: "a8" },
      { from: "d7", to: "c8" },
    ],
    successMessage: "Checkmate — a full three-move calculation, right to the end.",
    failureMessage: "Take it one step at a time: where can the queen go that keeps the king boxed in, no matter what Black plays?",
    explanation: "Each move narrows the king's options further, until there's nowhere left to go on move 3. This is what \"looking three moves ahead\" really means.",
  },
  {
    kind: "sequence",
    id: "calc-l5-rook-box",
    level: 5,
    fen: "k7/8/R7/K7/8/8/8/8 w - - 0 1",
    sideToMove: "w",
    prompt: "Calculate three moves ahead — find the forced mate in 3.",
    steps: [
      { from: "a5", to: "b6", opponentReplyFrom: "a8", opponentReplyTo: "b8" },
      { from: "b6", to: "c6", opponentReplyFrom: "b8", opponentReplyTo: "c8" },
      { from: "a6", to: "a8" },
    ],
    successMessage: "Checkmate — you calculated all three moves correctly.",
    failureMessage: "Walk the king closer, one safe step at a time. Where does it need to end up before the rook can finish?",
    explanation: "The king and rook work together — the king shepherds, the rook cuts off, and the mate only appears on the third move.",
  },

  // --- Level 6: compare two candidate moves (multiple choice) ---
  {
    kind: "choice",
    id: "calc-l6-fork-vs-retreat",
    level: 6,
    fen: "8/8/2q3k1/8/8/3N4/8/6K1 w - - 0 1",
    sideToMove: "w",
    prompt: "Two candidate moves for the knight — which one is actually best?",
    options: [
      { from: "d3", to: "e5", label: "Ne5", isBest: true },
      { from: "d3", to: "c1", label: "Nc1", isBest: false },
    ],
    successMessage: "Right — Ne5 forks the king and queen. Nc1 does nothing at all.",
    failureMessage: "One of these attacks two pieces at once. The other just retreats. Which is which?",
    explanation: "Comparing candidates means asking what each move actually ACHIEVES, not just whether it's legal.",
  },
  {
    kind: "choice",
    id: "calc-l6-capture-vs-passive",
    level: 6,
    fen: "4k3/8/8/3b4/8/8/8/3RK3 w - - 0 1",
    sideToMove: "w",
    prompt: "Two candidate moves for the rook — which one is actually best?",
    options: [
      { from: "d1", to: "d5", label: "Rxd5", isBest: true },
      { from: "d1", to: "a1", label: "Ra1", isBest: false },
    ],
    successMessage: "Right — Rxd5 wins the bishop for free. Ra1 wins nothing.",
    failureMessage: "One of these captures a hanging piece. The other just moves sideways. Which is which?",
    explanation: "When a free piece is on the board, that's almost always the strongest candidate — compare what each option actually wins.",
  },
];

export function getCalculationChallengesForLevel(level: CalculationLevelNumber): CalculationChallenge[] {
  if (level === 7) return CALCULATION_CHALLENGES.filter((c) => c.level !== 7);
  return CALCULATION_CHALLENGES.filter((c) => c.level === level);
}

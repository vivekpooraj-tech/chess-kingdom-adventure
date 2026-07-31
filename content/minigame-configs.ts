/**
 * Bridges content/minigame-catalog.ts (metadata: which engine, skill tag,
 * difficulty) to the actual render-time props each engine component needs
 * (grid layout, pairs, timing) — kept as its own file so content/lessons.ts
 * stays about narrative/pedagogy and this stays about "what does the screen
 * actually look like."
 */

export interface DragToTargetContent {
  prompt: string;
  pieceGlyph: string;
  rows: number;
  cols: number;
  start: { row: number; col: number };
  grid: { row: number; col: number; correct: boolean }[];
}

export interface MemoryFlipContent {
  prompt: string;
  pairs: { id: string; glyph: string }[];
}

export interface TimedReactionContent {
  prompt: string;
  pieceGlyph: string;
  rows: number;
  cols: number;
  rounds?: number;
  roundTimeMs?: number;
}

export type DayMinigameConfig =
  | { dayNumber: number; catalogId: string; engine: "drag_to_target"; content: DragToTargetContent }
  | { dayNumber: number; catalogId: string; engine: "memory_flip"; content: MemoryFlipContent }
  | { dayNumber: number; catalogId: string; engine: "timed_reaction"; content: TimedReactionContent };

export const DAY_MINIGAME_CONFIGS: DayMinigameConfig[] = [
  {
    dayNumber: 1,
    catalogId: "pawn-race",
    engine: "drag_to_target",
    content: {
      prompt: "Tap the square where the Pawn Guard should march next!",
      pieceGlyph: "♙",
      rows: 1,
      cols: 4,
      start: { row: 0, col: 0 },
      grid: [
        { row: 0, col: 0, correct: false },
        { row: 0, col: 1, correct: true },
        { row: 0, col: 2, correct: false },
        { row: 0, col: 3, correct: false },
      ],
    },
  },
  {
    dayNumber: 2,
    catalogId: "knight-memory",
    engine: "memory_flip",
    content: {
      prompt: "Help the Knight remember its forest friends!",
      pairs: [
        { id: "n1", glyph: "♞" },
        { id: "p1", glyph: "♟" },
        { id: "b1", glyph: "♝" },
        { id: "r1", glyph: "♜" },
      ],
    },
  },
  {
    dayNumber: 3,
    catalogId: "bishop-diagonal-catch",
    engine: "timed_reaction",
    content: {
      prompt: "Tap the glowing square before the Bishop's light fades!",
      pieceGlyph: "♗",
      rows: 3,
      cols: 4,
      rounds: 3,
      roundTimeMs: 3500,
    },
  },
  {
    dayNumber: 4,
    catalogId: "rook-charge",
    engine: "drag_to_target",
    content: {
      prompt: "Tap the square where the Rook should charge to next!",
      pieceGlyph: "♖",
      rows: 1,
      cols: 5,
      start: { row: 0, col: 0 },
      grid: [
        { row: 0, col: 0, correct: false },
        { row: 0, col: 1, correct: false },
        { row: 0, col: 2, correct: false },
        { row: 0, col: 3, correct: false },
        { row: 0, col: 4, correct: true },
      ],
    },
  },
  {
    dayNumber: 5,
    catalogId: "queen-memory",
    engine: "memory_flip",
    content: {
      prompt: "Help the Queen remember her royal court!",
      pairs: [
        { id: "q1", glyph: "♛" },
        { id: "k1", glyph: "♚" },
        { id: "r1", glyph: "♜" },
        { id: "b1", glyph: "♝" },
      ],
    },
  },
  {
    dayNumber: 6,
    catalogId: "king-castle-race",
    engine: "timed_reaction",
    content: {
      prompt: "Tap the safe square before time runs out — keep the King safe!",
      pieceGlyph: "♔",
      rows: 3,
      cols: 4,
      rounds: 3,
      roundTimeMs: 3500,
    },
  },
  {
    dayNumber: 7,
    catalogId: "knight-fork-execute",
    engine: "drag_to_target",
    content: {
      prompt: "Tap the square where the Knight can fork both targets at once!",
      pieceGlyph: "♘",
      rows: 2,
      cols: 4,
      start: { row: 1, col: 0 },
      grid: [
        { row: 0, col: 0, correct: false },
        { row: 0, col: 1, correct: false },
        { row: 0, col: 2, correct: true },
        { row: 0, col: 3, correct: false },
        { row: 1, col: 0, correct: false },
        { row: 1, col: 1, correct: false },
        { row: 1, col: 2, correct: false },
        { row: 1, col: 3, correct: false },
      ],
    },
  },
  {
    dayNumber: 8,
    catalogId: "bishop-pin-spot",
    engine: "memory_flip",
    content: {
      prompt: "Remember the Bishop's secret pinned pieces!",
      pairs: [
        { id: "b1", glyph: "♝" },
        { id: "k1", glyph: "♚" },
        { id: "r1", glyph: "♜" },
        { id: "q1", glyph: "♛" },
      ],
    },
  },
  {
    dayNumber: 9,
    catalogId: "rook-back-rank",
    engine: "timed_reaction",
    content: {
      prompt: "Watch the back rank — tap the safe square before time's up!",
      pieceGlyph: "♖",
      rows: 3,
      cols: 4,
      rounds: 3,
      roundTimeMs: 3500,
    },
  },
  {
    dayNumber: 10,
    catalogId: "queen-mate-pattern",
    engine: "drag_to_target",
    content: {
      prompt: "Tap the square to deliver the final checkmate!",
      pieceGlyph: "♕",
      rows: 1,
      cols: 4,
      start: { row: 0, col: 0 },
      grid: [
        { row: 0, col: 0, correct: false },
        { row: 0, col: 1, correct: false },
        { row: 0, col: 2, correct: false },
        { row: 0, col: 3, correct: true },
      ],
    },
  },
  {
    dayNumber: 11,
    catalogId: "pawn-double-step",
    engine: "drag_to_target",
    content: {
      prompt: "Push the Pawn to control the center of the board!",
      pieceGlyph: "♙",
      rows: 1,
      cols: 5,
      start: { row: 0, col: 0 },
      grid: [
        { row: 0, col: 0, correct: false },
        { row: 0, col: 1, correct: false },
        { row: 0, col: 2, correct: true },
        { row: 0, col: 3, correct: false },
        { row: 0, col: 4, correct: false },
      ],
    },
  },
  {
    dayNumber: 12,
    catalogId: "knight-outpost",
    engine: "memory_flip",
    content: {
      prompt: "Remember the Knight's secret outpost square!",
      pairs: [
        { id: "n1", glyph: "♞" },
        { id: "p1", glyph: "♟" },
        { id: "k1", glyph: "♚" },
        { id: "q1", glyph: "♛" },
      ],
    },
  },
  {
    dayNumber: 13,
    catalogId: "bishop-pair",
    engine: "timed_reaction",
    content: {
      prompt: "Two Bishops, double the power — tap before the light fades!",
      pieceGlyph: "♗",
      rows: 3,
      cols: 4,
      rounds: 3,
      roundTimeMs: 3500,
    },
  },
  {
    dayNumber: 14,
    catalogId: "rook-open-file",
    engine: "drag_to_target",
    content: {
      prompt: "Slide the Rook down the open file!",
      pieceGlyph: "♖",
      rows: 1,
      cols: 5,
      start: { row: 0, col: 0 },
      grid: [
        { row: 0, col: 0, correct: false },
        { row: 0, col: 1, correct: false },
        { row: 0, col: 2, correct: false },
        { row: 0, col: 3, correct: false },
        { row: 0, col: 4, correct: true },
      ],
    },
  },
  {
    dayNumber: 15,
    catalogId: "mixed-endgame-maze",
    engine: "memory_flip",
    content: {
      prompt: "Remember the Pawn's path all the way to promotion!",
      pairs: [
        { id: "p1", glyph: "♟" },
        { id: "q1", glyph: "♛" },
        { id: "k1", glyph: "♚" },
        { id: "r1", glyph: "♜" },
      ],
    },
  },
  {
    dayNumber: 16,
    catalogId: "pawn-race",
    engine: "drag_to_target",
    content: {
      prompt: "Race the passed Pawn all the way down the board!",
      pieceGlyph: "♙",
      rows: 1,
      cols: 5,
      start: { row: 0, col: 0 },
      grid: [
        { row: 0, col: 0, correct: false },
        { row: 0, col: 1, correct: false },
        { row: 0, col: 2, correct: false },
        { row: 0, col: 3, correct: false },
        { row: 0, col: 4, correct: true },
      ],
    },
  },
  {
    dayNumber: 17,
    catalogId: "knight-fork-spot",
    engine: "memory_flip",
    content: {
      prompt: "Remember what's hiding behind the Knight!",
      pairs: [
        { id: "n1", glyph: "♞" },
        { id: "r1", glyph: "♜" },
        { id: "k1", glyph: "♚" },
        { id: "p1", glyph: "♟" },
      ],
    },
  },
  {
    dayNumber: 18,
    catalogId: "bishop-pin-execute",
    engine: "timed_reaction",
    content: {
      prompt: "Tap the glowing square before the skewer's light fades!",
      pieceGlyph: "♗",
      rows: 3,
      cols: 4,
      rounds: 3,
      roundTimeMs: 3500,
    },
  },
  {
    dayNumber: 19,
    catalogId: "rook-doubling",
    engine: "drag_to_target",
    content: {
      prompt: "Tap the square to double up your Rooks on the file!",
      pieceGlyph: "♖",
      rows: 2,
      cols: 4,
      start: { row: 1, col: 0 },
      grid: [
        { row: 0, col: 0, correct: false },
        { row: 0, col: 1, correct: true },
        { row: 0, col: 2, correct: false },
        { row: 0, col: 3, correct: false },
        { row: 1, col: 0, correct: false },
        { row: 1, col: 1, correct: false },
        { row: 1, col: 2, correct: false },
        { row: 1, col: 3, correct: false },
      ],
    },
  },
  {
    dayNumber: 20,
    catalogId: "queen-power-sweep",
    engine: "timed_reaction",
    content: {
      prompt: "Tournament Trial! Tap the glowing square before time runs out!",
      pieceGlyph: "♕",
      rows: 3,
      cols: 4,
      rounds: 4,
      roundTimeMs: 3200,
    },
  },
  {
    dayNumber: 21,
    catalogId: "king-safety-walk",
    engine: "drag_to_target",
    content: {
      prompt: "Tap the square to bring your King toward safety!",
      pieceGlyph: "♔",
      rows: 1,
      cols: 4,
      start: { row: 0, col: 0 },
      grid: [
        { row: 0, col: 0, correct: false },
        { row: 0, col: 1, correct: true },
        { row: 0, col: 2, correct: false },
        { row: 0, col: 3, correct: false },
      ],
    },
  },
  {
    dayNumber: 22,
    catalogId: "pawn-wall",
    engine: "memory_flip",
    content: {
      prompt: "Remember which Pawns link together in the chain!",
      pairs: [
        { id: "p1", glyph: "♟" },
        { id: "p2", glyph: "♟" },
        { id: "k1", glyph: "♚" },
        { id: "n1", glyph: "♞" },
      ],
    },
  },
  {
    dayNumber: 23,
    catalogId: "knight-vs-time",
    engine: "timed_reaction",
    content: {
      prompt: "Knight vs Bishop reflex trial — tap before time's up!",
      pieceGlyph: "♘",
      rows: 3,
      cols: 4,
      rounds: 3,
      roundTimeMs: 3200,
    },
  },
  {
    dayNumber: 24,
    catalogId: "bishop-maze",
    engine: "drag_to_target",
    content: {
      prompt: "Tap the far corner — the Bishop's long diagonal view!",
      pieceGlyph: "♗",
      rows: 1,
      cols: 5,
      start: { row: 0, col: 0 },
      grid: [
        { row: 0, col: 0, correct: false },
        { row: 0, col: 1, correct: false },
        { row: 0, col: 2, correct: false },
        { row: 0, col: 3, correct: false },
        { row: 0, col: 4, correct: true },
      ],
    },
  },
  {
    dayNumber: 25,
    catalogId: "rook-open-file",
    engine: "memory_flip",
    content: {
      prompt: "Remember the Rook's path down the open file!",
      pairs: [
        { id: "r1", glyph: "♜" },
        { id: "k1", glyph: "♚" },
        { id: "p1", glyph: "♟" },
        { id: "q1", glyph: "♛" },
      ],
    },
  },
  {
    dayNumber: 26,
    catalogId: "queen-fork",
    engine: "timed_reaction",
    content: {
      prompt: "The Queen strikes fast — tap before her light fades!",
      pieceGlyph: "♕",
      rows: 3,
      cols: 4,
      rounds: 4,
      roundTimeMs: 3000,
    },
  },
  {
    dayNumber: 27,
    catalogId: "king-safety-maze",
    engine: "drag_to_target",
    content: {
      prompt: "A brave King in the endgame! Tap where it should march.",
      pieceGlyph: "♔",
      rows: 1,
      cols: 4,
      start: { row: 0, col: 0 },
      grid: [
        { row: 0, col: 0, correct: false },
        { row: 0, col: 1, correct: false },
        { row: 0, col: 2, correct: true },
        { row: 0, col: 3, correct: false },
      ],
    },
  },
  {
    dayNumber: 28,
    catalogId: "pawn-structure",
    engine: "memory_flip",
    content: {
      prompt: "Remember your Pawn majority's marching order!",
      pairs: [
        { id: "p1", glyph: "♟" },
        { id: "p2", glyph: "♟" },
        { id: "p3", glyph: "♟" },
        { id: "k1", glyph: "♚" },
      ],
    },
  },
  {
    dayNumber: 29,
    catalogId: "knight-tour",
    engine: "timed_reaction",
    content: {
      prompt: "The Knight blockades the enemy — tap before time's up!",
      pieceGlyph: "♘",
      rows: 3,
      cols: 4,
      rounds: 3,
      roundTimeMs: 3000,
    },
  },
  {
    dayNumber: 30,
    catalogId: "mixed-boss-prep",
    engine: "timed_reaction",
    content: {
      prompt: "The Shadow King's Final Trial! Tap fast for the ultimate test!",
      pieceGlyph: "👑",
      rows: 3,
      cols: 4,
      rounds: 5,
      roundTimeMs: 3000,
    },
  },
];

export function getMinigameConfigForDay(dayNumber: number): DayMinigameConfig | undefined {
  return DAY_MINIGAME_CONFIGS.find((c) => c.dayNumber === dayNumber);
}

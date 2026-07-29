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
];

export function getMinigameConfigForDay(dayNumber: number): DayMinigameConfig | undefined {
  return DAY_MINIGAME_CONFIGS.find((c) => c.dayNumber === dayNumber);
}

import { ChessPuzzle } from "@/lib/types";

// Every position here was verified programmatically (not just by hand) to
// contain a genuine, sound mate — see lib/chess-engine/puzzleValidation.ts
// for what "sound" means for the mate-in-2 ones specifically.
export const PUZZLES: ChessPuzzle[] = [
  {
    id: "m1-backrank-rook",
    fen: "6k1/5ppp/8/8/8/8/8/4R2K w - - 0 1",
    sideToMove: "w",
    mateIn: 1,
    theme: "Back-Rank Mate",
  },
  {
    id: "m1-backrank-queen",
    fen: "6k1/5ppp/8/8/8/8/8/4Q2K w - - 0 1",
    sideToMove: "w",
    mateIn: 1,
    theme: "Back-Rank Mate",
  },
  {
    id: "m1-corner-queen-a",
    fen: "k7/7Q/1K6/8/8/8/8/8 w - - 0 1",
    sideToMove: "w",
    mateIn: 1,
    theme: "Cornered King",
  },
  {
    id: "m1-corner-queen-b",
    fen: "7k/Q7/6K1/8/8/8/8/8 w - - 0 1",
    sideToMove: "w",
    mateIn: 1,
    theme: "Cornered King",
  },
  {
    id: "m1-smothered-knight",
    fen: "6rk/6pp/7N/8/8/8/8/7K w - - 0 1",
    sideToMove: "w",
    mateIn: 1,
    theme: "Smothered Mate",
  },
  {
    id: "m1-king-rook-ladder",
    fen: "4k3/8/4K3/8/8/8/8/R7 w - - 0 1",
    sideToMove: "w",
    mateIn: 1,
    theme: "King & Rook Mate",
  },
  {
    id: "m2-two-rooks-a",
    fen: "7k/8/8/8/8/8/6R1/6RK w - - 0 1",
    sideToMove: "w",
    mateIn: 2,
    theme: "Rook Ladder",
  },
  {
    id: "m2-two-rooks-b",
    fen: "6k1/8/8/8/8/8/R7/1R5K w - - 0 1",
    sideToMove: "w",
    mateIn: 2,
    theme: "Rook Ladder",
  },
  {
    id: "m2-queen-king-a",
    fen: "7k/5K2/8/8/8/8/8/6Q1 w - - 0 1",
    sideToMove: "w",
    mateIn: 2,
    theme: "Queen & King",
  },
  {
    id: "m2-queen-king-b",
    fen: "k7/2K5/8/8/8/8/8/6Q1 w - - 0 1",
    sideToMove: "w",
    mateIn: 2,
    theme: "Queen & King",
  },
];

/**
 * Deterministic "puzzle of the day" — same pick for every player on a given
 * calendar date, no extra scheduling table needed. Cycles through the real
 * PUZZLES bank by day-of-year, so it's honest about only having this many
 * positions today rather than implying a curated daily drop.
 */
export function getDailyPuzzle(date: Date = new Date()): ChessPuzzle {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / 86_400_000);
  return PUZZLES[dayOfYear % PUZZLES.length];
}

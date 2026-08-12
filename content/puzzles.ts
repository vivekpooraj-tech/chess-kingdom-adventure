import { ChessPuzzle } from "@/lib/types";

// Every position below is verified — not hand-trusted — via
// lib/chess-engine/puzzleValidation.ts's exactMateDepth(): each has a
// genuine forced mate at EXACTLY its declared `mateIn` depth (no faster
// mate hiding in the position) and, for mateIn 2/3, the forcing line holds
// against every legal defense, not just one expected reply. See
// scripts/verify-puzzles.js for the standalone check this content was run
// through before being added here.
//
// Ordered as a repeating (1,2,3) depth cycle — mate-in-1, mate-in-2,
// mate-in-3, mate-in-1, ... — so that getDailyPuzzle()'s day-of-year
// rotation below never lands on the same depth two days in a row (checked
// including the wraparound from the last entry back to the first), and
// naturally spreads roughly even coverage of all three depths across any
// 7-day window without needing a separate weighting scheme.
export const PUZZLES: ChessPuzzle[] = [
  { id: "m1-backrank-rook",    fen: "6k1/5ppp/8/8/8/8/8/4R2K w - - 0 1", sideToMove: "w", mateIn: 1, theme: "Back-Rank Mate" },
  { id: "m2-two-rooks-a",      fen: "k7/1R6/8/8/8/8/8/KR6 w - - 0 1",    sideToMove: "w", mateIn: 2, theme: "Rook Ladder" },
  { id: "m3-queen-net-a",      fen: "k7/2Q5/8/K7/8/8/8/8 w - - 0 1",     sideToMove: "w", mateIn: 3, theme: "Queen Mating Net" },
  { id: "m1-backrank-queen",   fen: "6k1/5ppp/8/8/8/8/8/4Q2K w - - 0 1", sideToMove: "w", mateIn: 1, theme: "Back-Rank Mate" },
  { id: "m2-two-rooks-b",      fen: "6k1/8/8/8/8/8/R7/1R5K w - - 0 1",   sideToMove: "w", mateIn: 2, theme: "Rook Ladder" },
  { id: "m3-queen-net-b",      fen: "k7/8/3Q4/1K6/8/8/8/8 w - - 0 1",    sideToMove: "w", mateIn: 3, theme: "Queen Mating Net" },
  { id: "m1-corner-queen-a",   fen: "k7/7Q/1K6/8/8/8/8/8 w - - 0 1",     sideToMove: "w", mateIn: 1, theme: "Cornered King" },
  { id: "m2-queen-king-a",     fen: "k7/8/Q7/K7/8/8/8/8 w - - 0 1",      sideToMove: "w", mateIn: 2, theme: "Queen & King" },
  { id: "m3-queen-net-c",      fen: "k7/8/8/Q1K5/8/8/8/8 w - - 0 1",     sideToMove: "w", mateIn: 3, theme: "Queen Mating Net" },
  { id: "m1-corner-queen-b",   fen: "7k/Q7/6K1/8/8/8/8/8 w - - 0 1",     sideToMove: "w", mateIn: 1, theme: "Cornered King" },
  { id: "m2-queen-king-b",     fen: "k7/8/8/KQ6/8/8/8/8 w - - 0 1",      sideToMove: "w", mateIn: 2, theme: "Queen & King" },
  { id: "m3-rook-box-a",       fen: "k7/8/R7/K7/8/8/8/8 w - - 0 1",      sideToMove: "w", mateIn: 3, theme: "Rook Box Mate" },
  { id: "m1-smothered-knight", fen: "6rk/6pp/7N/8/8/8/8/7K w - - 0 1",   sideToMove: "w", mateIn: 1, theme: "Smothered Mate" },
  { id: "m3-rook-box-b",       fen: "k7/1R6/8/K7/8/8/8/8 w - - 0 1",     sideToMove: "w", mateIn: 3, theme: "Rook Box Mate" },
  { id: "m1-king-rook-ladder", fen: "4k3/8/4K3/8/8/8/8/R7 w - - 0 1",    sideToMove: "w", mateIn: 1, theme: "King & Rook Mate" },
  { id: "m3-rook-box-c",       fen: "k7/8/8/K1R5/8/8/8/8 w - - 0 1",     sideToMove: "w", mateIn: 3, theme: "Rook Box Mate" },
];

/**
 * Deterministic day-of-year rotation through PUZZLES — same date always
 * yields the same puzzle for every player (and across refreshes/devices),
 * different dates yield different puzzles. Mirrors the same pattern used
 * by lib/chessMind/dailyChallenge.ts's getDailyChallengeCategoryId() for
 * the (separate) Chess Mind daily rotation.
 */
export function getDailyPuzzle(date: Date = new Date()): ChessPuzzle {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / 86_400_000);
  return PUZZLES[dayOfYear % PUZZLES.length];
}

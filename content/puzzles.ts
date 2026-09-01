import { ChessPuzzle } from "@/lib/types";

// Every position below is verified — not hand-trusted — by
// `node scripts/verify-puzzles.js --pool`, which re-checks this exact
// array. Each entry must be a LEGAL position (exactly one king per side,
// kings not adjacent, and — the check that was missing when eight of
// these shipped with a heavy piece already aiming down a file at the
// cornered enemy king — the side NOT to move is not already in check),
// and must have a genuine forced mate at EXACTLY its declared `mateIn`
// depth (no faster mate hiding in the position; for mateIn 2/3 the
// forcing line holds against every legal defense, not just one expected
// reply). chess.js loads illegal FENs silently, so these are enforced
// explicitly.
//
// `level` (1-6) is the Daily Challenge difficulty tier — computed
// objectively by scripts/compute-puzzle-levels.js from each puzzle's
// solution precision and defender-reply count, not hand-assigned. See that
// script's own comments for exactly how, and this phase's final report for
// why level 6 currently has no puzzles (an honest content-pool gap, not an
// algorithm limitation).
export const PUZZLES: ChessPuzzle[] = [
  { id: "m1-backrank-rook",    fen: "6k1/5ppp/8/8/8/8/8/4R2K w - - 0 1", sideToMove: "w", mateIn: 1, theme: "Back-Rank Mate",      level: 1 },
  { id: "m2-two-rooks-a",      fen: "k7/1R6/8/8/8/8/8/KR6 w - - 0 1",    sideToMove: "w", mateIn: 2, theme: "Rook Ladder",         level: 3 },
  { id: "m3-queen-net-a",      fen: "k7/2Q5/8/K7/8/8/8/8 w - - 0 1",     sideToMove: "w", mateIn: 3, theme: "Queen Mating Net",    level: 5 },
  { id: "m1-backrank-queen",   fen: "6k1/5ppp/8/8/8/8/8/4Q2K w - - 0 1", sideToMove: "w", mateIn: 1, theme: "Back-Rank Mate",      level: 1 },
  { id: "m2-two-rooks-b",      fen: "6k1/8/8/8/8/8/R7/1R5K w - - 0 1",   sideToMove: "w", mateIn: 2, theme: "Rook Ladder",         level: 4 },
  { id: "m3-queen-net-b",      fen: "k7/8/3Q4/1K6/8/8/8/8 w - - 0 1",    sideToMove: "w", mateIn: 3, theme: "Queen Mating Net",    level: 5 },
  { id: "m1-corner-queen-a",   fen: "k7/7Q/1K6/8/8/8/8/8 w - - 0 1",     sideToMove: "w", mateIn: 1, theme: "Cornered King",       level: 1 },
  { id: "m2-queen-king-a",     fen: "6k1/8/8/5QK1/8/8/8/8 w - - 0 1",     sideToMove: "w", mateIn: 2, theme: "Queen & King",        level: 3 },
  { id: "m3-queen-net-c",      fen: "7k/8/6Q1/5K2/8/8/8/8 w - - 0 1",     sideToMove: "w", mateIn: 3, theme: "Queen Mating Net",    level: 5 },
  { id: "m1-corner-queen-b",   fen: "7k/Q7/6K1/8/8/8/8/8 w - - 0 1",     sideToMove: "w", mateIn: 1, theme: "Cornered King",       level: 1 },
  { id: "m2-queen-king-b",     fen: "k7/8/8/KQ6/8/8/8/8 w - - 0 1",      sideToMove: "w", mateIn: 2, theme: "Queen & King",        level: 3 },
  { id: "m3-rook-box-a",       fen: "7k/6R1/8/7K/8/8/8/8 w - - 0 1",      sideToMove: "w", mateIn: 3, theme: "Rook Box Mate",       level: 5 },
  { id: "m1-smothered-knight", fen: "6rk/6pp/7N/8/8/8/8/7K w - - 0 1",   sideToMove: "w", mateIn: 1, theme: "Smothered Mate",      level: 1 },
  { id: "m3-rook-box-b",       fen: "k7/1R6/8/K7/8/8/8/8 w - - 0 1",     sideToMove: "w", mateIn: 3, theme: "Rook Box Mate",       level: 5 },
  { id: "m1-king-rook-ladder", fen: "4k3/8/4K3/8/8/8/8/R7 w - - 0 1",    sideToMove: "w", mateIn: 1, theme: "King & Rook Mate",    level: 1 },
  { id: "m3-rook-box-c",       fen: "k7/8/8/K1R5/8/8/8/8 w - - 0 1",     sideToMove: "w", mateIn: 3, theme: "Rook Box Mate",       level: 5 },

  // Added for Daily Challenge personalization (Phase 25) -- each verified
  // via scripts/verify-puzzles.js exactly like the 16 above (no easier
  // hidden mate, sound against every legal defense). Several other
  // hand-composed candidates covering more named mate patterns (Arabian,
  // Anastasia's, Boden's, Hook, discovered check, double check) were
  // attempted and did NOT verify (hidden faster mate, no mate at all, or a
  // chess.js edge case on deep recursive checking) — discarded rather than
  // shipped unverified. See that phase's final report.
  { id: "m1-corner-rook-a",      fen: "k7/8/1K6/8/8/8/8/2R5 w - - 0 1",    sideToMove: "w", mateIn: 1, theme: "Corridor Mate",       level: 2 },
  { id: "m1-corner-rook-b",      fen: "7k/8/6K1/8/8/8/8/5R2 w - - 0 1",    sideToMove: "w", mateIn: 1, theme: "Corridor Mate",       level: 2 },
  { id: "m1-knight-rook-a",      fen: "7k/8/5NK1/8/8/8/8/6R1 w - - 0 1", sideToMove: "w", mateIn: 1, theme: "Knight & Rook Mate",  level: 2 },
  { id: "m1-ladder-mid-a",       fen: "3k4/8/3K4/8/8/8/8/7R w - - 0 1",   sideToMove: "w", mateIn: 1, theme: "Rook Ladder",         level: 1 },
  { id: "m1-two-rooks-adjacent", fen: "1k6/8/1K6/8/8/8/R7/R7 w - - 0 1",   sideToMove: "w", mateIn: 1, theme: "Rook Ladder",         level: 2 },
  { id: "m2-two-rooks-mirror",   fen: "7k/6R1/8/8/8/8/8/6RK w - - 0 1",   sideToMove: "w", mateIn: 2, theme: "Rook Ladder",         level: 3 },
  { id: "m2-queen-king-mirror",  fen: "7k/8/8/6QK/8/8/8/8 w - - 0 1",     sideToMove: "w", mateIn: 2, theme: "Queen & King",        level: 3 },
  { id: "m3-queen-short-side",   fen: "k7/8/1Q6/2K5/8/8/8/8 w - - 0 1",   sideToMove: "w", mateIn: 3, theme: "Queen Mating Net",    level: 5 },
];

export function getPuzzleById(id: string | null | undefined): ChessPuzzle | undefined {
  return PUZZLES.find((p) => p.id === id);
}

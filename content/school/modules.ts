import type { SchoolModule, PieceSuperpower } from "./types";

/**
 * The eight modules, and the four acts they sit inside.
 *
 * The acts are the emotional arc — "I speak chess", "I see traps", "I play for
 * real", "I challenge someone" — and they are the reason the course is not a
 * list. A child on session 11 is not 37% done; they are in the middle of the
 * act where they start seeing traps, and the next thing that happens to them
 * is Fork Festival. Modules are the smaller, concrete unit under that: what
 * the current handful of sessions is about.
 *
 * Neither one gates anything. Progression is mastery, not chapters — see
 * lib/school/v2/progress.ts.
 */
export const SCHOOL_MODULES: readonly SchoolModule[] = [
  {
    id: "m1-board",
    number: 1,
    title: "Learn the Board",
    blurb: "Where everything goes, and why it goes there.",
    act: 1,
    sessionNumbers: [1, 2, 3],
  },
  {
    id: "m2-pawns",
    number: 2,
    title: "Pawns and Captures",
    blurb: "The little ones, and how they take.",
    act: 1,
    sessionNumbers: [4, 5],
  },
  {
    id: "m3-knights-bishops",
    number: 3,
    title: "Knights and Bishops",
    blurb: "The jumper and the laser.",
    act: 1,
    sessionNumbers: [6, 7, 8],
  },
  {
    id: "m4-rooks-queen",
    number: 4,
    title: "Rooks and Queen",
    blurb: "The train, and the boss.",
    act: 2,
    sessionNumbers: [9, 10, 11],
  },
  {
    id: "m5-king",
    number: 5,
    title: "King and Safety",
    blurb: "The one you protect.",
    act: 2,
    sessionNumbers: [12, 13, 14, 15, 16],
  },
  {
    id: "m6-tactics",
    number: 6,
    title: "Tactics",
    blurb: "The tricks that win games.",
    act: 3,
    sessionNumbers: [17, 18, 19, 20],
  },
  {
    id: "m7-full-game",
    number: 7,
    title: "Full Game Skills",
    blurb: "Start to finish, on your own.",
    act: 3,
    sessionNumbers: [21, 22, 23, 24],
  },
  {
    id: "m8-graduate",
    number: 8,
    title: "Graduate Challenge",
    blurb: "Play a real person.",
    act: 4,
    sessionNumbers: [25, 26, 27, 28, 29, 30],
  },
];

/** Titles for the four acts, used above the module name on the home screen. */
export const SCHOOL_ACTS: Readonly<Record<number, string>> = {
  1: "Act 1 — I speak chess",
  2: "Act 2 — I see traps",
  3: "Act 3 — I play for real",
  4: "Act 4 — I challenge someone",
};

/**
 * Piece superpowers.
 *
 * A child who has been told "the knight moves in an L" forgets by Thursday. A
 * child who has been told "the knight is the only piece that jumps over walls"
 * tells their friend at school. That is the entire design intent: one sentence
 * per piece, memorable enough to be repeated out loud by someone who is eight.
 */
export const PIECE_SUPERPOWERS: readonly PieceSuperpower[] = [
  {
    id: "pawn-promotion",
    piece: "pawn",
    name: "Pawn Promotion",
    power: "The soldier that can become a Queen.",
    unlockedBySession: 2,
    emoji: "♟️",
  },
  {
    id: "knight-jump",
    piece: "knight",
    name: "Knight Jump",
    power: "The only piece that jumps over walls.",
    unlockedBySession: 4,
    emoji: "♞",
  },
  {
    id: "bishop-laser",
    piece: "bishop",
    name: "Bishop Laser",
    power: "The laser on diagonals.",
    unlockedBySession: 5,
    emoji: "♝",
  },
  {
    id: "rook-train",
    piece: "rook",
    name: "Rook Train",
    power: "The train on straight lines.",
    unlockedBySession: 6,
    emoji: "♜",
  },
  {
    id: "queen-boss",
    piece: "queen",
    name: "Queen Power",
    power: "The boss. She does what the rook and the bishop do, together.",
    unlockedBySession: 7,
    emoji: "♛",
  },
  {
    id: "king-protected",
    piece: "king",
    name: "The King",
    power: "The one you protect. Lose him and the game is over.",
    unlockedBySession: 7,
    emoji: "♚",
  },
];

export function getModule(id: string): SchoolModule | null {
  return SCHOOL_MODULES.find((m) => m.id === id) ?? null;
}

export function getSuperpower(id: string): PieceSuperpower | null {
  return PIECE_SUPERPOWERS.find((s) => s.id === id) ?? null;
}

/** The module a session number belongs to, or null for an out-of-range number. */
export function moduleForSession(sessionNumber: number): SchoolModule | null {
  return SCHOOL_MODULES.find((m) => m.sessionNumbers.includes(sessionNumber)) ?? null;
}

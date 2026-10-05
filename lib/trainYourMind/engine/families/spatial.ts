import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";
import { fnv1a } from "../../exerciseIds";
import { ratingToLevel, type ChoiceExercise, type Level } from "../../curriculum";
import { knightDistance } from "@/lib/chessMind/knightDistance";
import {
  PIECE_WORD,
  attackedSquares,
  attackersOf,
  boardMap,
  fileOf,
  pieceCount,
  rankOf,
  squareName,
} from "../geometry";
import { makeChoiceSet, seededPick, seededRng, seededShuffle } from "../rng";
import { sideWord } from "../puzzleContext";
import { exerciseId, type FamilyDef } from "./types";

/**
 * SPATIAL THINKING — chess geometry, from coordinates and king walks up to
 * multi-piece reasoning: shared attack squares, escape squares, mobility, square
 * control, and which move best restricts the enemy king. All answers come from
 * the real board (chess.js legal moves / ray geometry), never from tables.
 */

const b6 = (p: { id: string }) => parseInt(fnv1a(p.id), 36) % 6;

function allSquares(): Square[] {
  const out: Square[] = [];
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) out.push(squareName(f, r));
  return out;
}

function numChoices(correct: number, seed: string, max = 28) {
  const near: number[] = [];
  for (const d of [-3, -2, -1, 1, 2, 3, 4]) near.push(correct + d);
  return makeChoiceSet(
    String(correct),
    near.filter((n) => n >= 0 && n <= max && n !== correct).map(String),
    seed
  );
}

function plural(n: number, w: string) {
  return `${n} ${w}${n === 1 ? "" : "s"}`;
}

function levelFromBoard(game: Chess, rating: number, base: number): Level {
  const n = pieceCount(boardMap(game));
  const crowd = n > 20 ? 1 : 0;
  const r = ratingToLevel(rating) >= 4 ? 1 : 0;
  return Math.min(5, base + crowd + (r ? 0 : 0)) as Level;
}

// -- static geometry families: the board is BUILT from the exercise parameters ----
/**
 * RULE: if a question names a piece, a square a piece stands on, or a route, the
 * board shows exactly that. These three families used to display a board with two
 * kings on their home squares while the text talked about a king on a1 or a knight
 * on c3, so the text and the board described different positions. Now the position
 * is constructed from the exercise's own parameters (so the two cannot drift apart)
 * and checked with chess.js before the exercise can be served.
 */
type Placed = Array<[Square, string]>;

function placementFen(pieces: Placed): string {
  const grid: string[][] = Array.from({ length: 8 }, () => Array(8).fill(""));
  for (const [sq, ch] of pieces) grid[7 - rankOf(sq)][fileOf(sq)] = ch;
  return grid
    .map((row) => {
      let out = "";
      let empty = 0;
      for (const c of row) {
        if (!c) empty++;
        else {
          if (empty) out += empty;
          empty = 0;
          out += c;
        }
      }
      return out + (empty ? empty : "");
    })
    .join("/");
}

/** A legal static position or null: loads, one king each, White to move, nobody in check. */
function legalStaticFen(pieces: Placed): string | null {
  if (new Set(pieces.map(([sq]) => sq)).size !== pieces.length) return null;
  const fen = `${placementFen(pieces)} w - - 0 1`;
  try {
    const g = new Chess(fen);
    const blackKing = pieces.find(([, ch]) => ch === "k");
    const whiteKing = pieces.find(([, ch]) => ch === "K");
    if (!blackKing || !whiteKing) return null;
    if (g.isCheck() || g.isAttacked(blackKing[0], "w")) return null;
    return fen;
  } catch {
    return null;
  }
}

const kingDist = (a: Square, b: Square) => Math.max(Math.abs(fileOf(a) - fileOf(b)), Math.abs(rankOf(a) - rankOf(b)));

// Knight BFS that honours blocked squares (the kings), so the stated distance is true on THIS board.
function knightPathLength(from: Square, to: Square, blocked: ReadonlySet<string>): number {
  if (from === to) return 0;
  const offsets = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
  let frontier: Square[] = [from];
  const seen = new Set<string>([from]);
  for (let d = 1; d <= 8; d++) {
    const next: Square[] = [];
    for (const sq of frontier) {
      for (const [df, dr] of offsets) {
        const f = fileOf(sq) + df;
        const r = rankOf(sq) + dr;
        if (f < 0 || f > 7 || r < 0 || r > 7) continue;
        const n = squareName(f, r);
        if (blocked.has(n) || seen.has(n)) continue;
        if (n === to) return d;
        seen.add(n);
        next.push(n);
      }
    }
    frontier = next;
  }
  return -1;
}

// King BFS that refuses squares next to the enemy king (a king may never step beside the other king).
export function kingPathLength(from: Square, to: Square, enemyKing: Square): number {
  if (from === to) return 0;
  let frontier: Square[] = [from];
  const seen = new Set<string>([from]);
  for (let d = 1; d <= 8; d++) {
    const next: Square[] = [];
    for (const sq of frontier) {
      for (let df = -1; df <= 1; df++) {
        for (let dr = -1; dr <= 1; dr++) {
          if (!df && !dr) continue;
          const f = fileOf(sq) + df;
          const r = rankOf(sq) + dr;
          if (f < 0 || f > 7 || r < 0 || r > 7) continue;
          const n = squareName(f, r);
          if (seen.has(n) || kingDist(n, enemyKing) <= 1) continue;
          if (n === to) return d;
          seen.add(n);
          next.push(n);
        }
      }
    }
    frontier = next;
  }
  return -1;
}

export { knightPathLength };

// -- sp.coords: square colours (static) -----------------------------------------
const KING_HOMES: Array<[Square, Square]> = [
  ["e1", "e8"], ["a1", "h8"], ["h1", "a8"], ["a8", "h1"], ["h8", "a1"],
];

function coordsFen(sq: Square): string | null {
  for (const [wk, bk] of KING_HOMES) {
    if (wk === sq || bk === sq) continue;
    const fen = legalStaticFen([[wk, "K"], [bk, "k"], [sq, "N"]]);
    if (fen) return fen;
  }
  return null;
}

const coords: FamilyDef = {
  id: "sp.coords",
  category: "spatial",
  label: "Board coordinates",
  skill: "Know the board: which squares are light or dark",
  statics: () => allSquares().map((sq) => ({ key: `color:${sq}`, level: 1 as Level })),
  build: ({ key, level }) => {
    const sq = key.split(":")[1] as Square;
    if (!/^[a-h][1-8]$/.test(sq)) return null;
    const fen = coordsFen(sq);
    if (!fen) return null;
    const light = (fileOf(sq) + rankOf(sq)) % 2 === 1; // a1 is dark
    const answer = light ? "Light" : "Dark";
    return {
      kind: "choice",
      id: exerciseId("sp.coords", key),
      category: "spatial",
      family: "sp.coords",
      familyLabel: "Board coordinates",
      level,
      skill: "Know the board: which squares are light or dark",
      orientation: "w",
      fen,
      highlight: [sq],
      prompt: `A White knight stands on ${sq}. Is ${sq} a light square or a dark square?`,
      choices: ["Light", "Dark"],
      correctIndex: answer === "Light" ? 0 : 1,
      explanation: {
        correct: `Correct — ${sq} is ${answer.toLowerCase()}. Trick: a1 is dark, and squares alternate, so file + rank odd means light.`,
        incorrect: `${sq} is ${answer.toLowerCase()}. Trick: a1 is dark, and colours alternate along every rank and file.`,
      },
    } satisfies ChoiceExercise;
  },
};

// -- sp.kingwalk / sp.knight: distances (deterministic pair banks) ---------------
function pairKeys(prefix: string, count: number, accept: (a: Square, b: Square) => boolean): string[] {
  const rng = seededRng(`spatial-pairs:${prefix}`);
  const squares = allSquares();
  const out = new Set<string>();
  let guard = 0;
  while (out.size < count && guard++ < 5000) {
    const a = squares[Math.floor(rng() * 64)];
    const b = squares[Math.floor(rng() * 64)];
    if (a !== b && accept(a, b)) out.add(`${a}:${b}`);
  }
  return [...out];
}

/** A Black king far enough from the whole route box that it can never interfere. */
function kingWalkFen(a: Square, b: Square, seed: string): { fen: string; blackKing: Square } | null {
  const minF = Math.min(fileOf(a), fileOf(b)), maxF = Math.max(fileOf(a), fileOf(b));
  const minR = Math.min(rankOf(a), rankOf(b)), maxR = Math.max(rankOf(a), rankOf(b));
  const candidates = seededShuffle(allSquares(), seededRng(seed)).filter((sq) => {
    const dx = Math.max(minF - fileOf(sq), 0, fileOf(sq) - maxF);
    const dy = Math.max(minR - rankOf(sq), 0, rankOf(sq) - maxR);
    return Math.max(dx, dy) >= 2;
  });
  for (const bk of candidates) {
    const fen = legalStaticFen([[a, "K"], [bk, "k"]]);
    if (fen) return { fen, blackKing: bk };
  }
  return null;
}

const KING_PAIRS = pairKeys("king", 48, (a, b) => kingDist(a, b) >= 2);
const kingwalk: FamilyDef = {
  id: "sp.kingwalk",
  category: "spatial",
  label: "King walk",
  skill: "Measure distance the way a king moves",
  statics: () => KING_PAIRS.map((k) => ({ key: k, level: (kingDist(...(k.split(":") as [Square, Square])) <= 3 ? 1 : 2) as Level })),
  build: ({ key, level }) => {
    const [a, b] = key.split(":") as [Square, Square];
    const placed = kingWalkFen(a, b, `sp.kingwalk:${key}`);
    if (!placed) return null;
    const d = kingDist(a, b);
    // The stated distance must be true on THIS board (legal king moves, enemy king respected).
    if (kingPathLength(a, b, placed.blackKing) !== d) return null;
    const set = makeChoiceSet(String(d), [1, 2, 3, 4, 5, 6, 7].map(String), `sp.kingwalk:${key}`);
    if (!set) return null;
    return {
      kind: "choice",
      id: exerciseId("sp.kingwalk", key),
      category: "spatial",
      family: "sp.kingwalk",
      familyLabel: "King walk",
      level,
      skill: "Measure distance the way a king moves",
      orientation: "w",
      fen: placed.fen,
      highlight: [a, b],
      prompt: `The White king stands on ${a}; the Black king, on ${placed.blackKing}, is out of the way. What is the fewest moves the White king needs to reach ${b}?`,
      choices: set.choices,
      correctIndex: set.correctIndex,
      explanation: {
        correct: `Correct — ${d} moves. A king covers one file and one rank per move, so the distance is the larger of the file gap (${Math.abs(fileOf(a) - fileOf(b))}) and the rank gap (${Math.abs(rankOf(a) - rankOf(b))}).`,
        incorrect: `It takes ${d} moves. A king moves one square in any direction, so the distance is the larger of the file gap (${Math.abs(fileOf(a) - fileOf(b))}) and the rank gap (${Math.abs(rankOf(a) - rankOf(b))}).`,
      },
    } satisfies ChoiceExercise;
  },
};

/** Kings placed where they neither give check nor change the knight's shortest route. */
function knightFen(a: Square, b: Square, d: number, seed: string): { fen: string; whiteKing: Square; blackKing: Square } | null {
  const shuffled = seededShuffle(allSquares(), seededRng(seed));
  for (const bk of shuffled) {
    if (bk === a || bk === b || knightDistance(a, bk) === 1) continue; // not on route ends, not checked by the knight
    for (const wk of shuffled) {
      if (wk === a || wk === b || wk === bk || kingDist(wk, bk) <= 1) continue;
      if (knightPathLength(a, b, new Set([wk, bk])) !== d) continue;
      const fen = legalStaticFen([[a, "N"], [wk, "K"], [bk, "k"]]);
      if (fen) return { fen, whiteKing: wk, blackKing: bk };
    }
  }
  return null;
}

const KNIGHT_PAIRS = pairKeys("knight", 48, (a, b) => knightDistance(a, b) >= 2);
const knight: FamilyDef = {
  id: "sp.knight",
  category: "spatial",
  label: "Knight geometry",
  skill: "Plan a knight's route across the board",
  statics: () =>
    KNIGHT_PAIRS.map((k) => {
      const d = knightDistance(...(k.split(":") as [Square, Square]));
      return { key: k, level: (d <= 2 ? 2 : d === 3 ? 3 : 4) as Level };
    }),
  build: ({ key, level }) => {
    const [a, b] = key.split(":") as [Square, Square];
    const d = knightDistance(a, b);
    const placed = knightFen(a, b, d, `sp.knight:${key}`);
    if (!placed) return null;
    const set = makeChoiceSet(String(d), [1, 2, 3, 4, 5, 6].map(String), `sp.knight:${key}`);
    if (!set) return null;
    return {
      kind: "choice",
      id: exerciseId("sp.knight", key),
      category: "spatial",
      family: "sp.knight",
      familyLabel: "Knight geometry",
      level,
      skill: "Plan a knight's route across the board",
      orientation: "w",
      fen: placed.fen,
      highlight: [a, b],
      prompt: `The White knight stands on ${a}; the kings (${placed.whiteKing} and ${placed.blackKing}) are not in its way. What is the fewest knight moves needed to reach ${b}?`,
      choices: set.choices,
      correctIndex: set.correctIndex,
      explanation: {
        correct: `Correct — ${d} moves. A knight changes square colour with every move, so the colour of ${a} and ${b} tells you whether the count is odd or even.`,
        incorrect: `The shortest knight route takes ${d} moves. Remember each knight move changes the colour of its square, so squares of the same colour need an even count and different colours an odd one.`,
      },
    } satisfies ChoiceExercise;
  },
};

// -- puzzle-position families ---------------------------------------------------
function moverPiecesWithMoves(game: Chess) {
  const mover = game.turn();
  const board = boardMap(game);
  const out: { sq: Square; type: PieceSymbol; moves: number }[] = [];
  for (const [sq, p] of board) {
    if (p.color !== mover || p.type === "p") continue;
    const moves = game.moves({ square: sq, verbose: true }).length;
    if (moves >= 1) out.push({ sq, type: p.type, moves });
  }
  return out;
}

const reach: FamilyDef = {
  id: "sp.reach",
  category: "spatial",
  label: "Piece reach",
  skill: "Count where a piece can really go, blockers included",
  classify: (p) => {
    if (b6(p) !== 0) return null;
    const game = new Chess(p.fen);
    if (game.inCheck()) return null;
    const pieces = moverPiecesWithMoves(game).filter((x) => x.moves >= 2);
    if (!pieces.length) return null;
    const maxType = Math.max(...pieces.map((x) => ({ n: 1, k: 1, b: 2, r: 2, q: 3, p: 1 })[x.type]));
    return levelFromBoard(game, p.rating, maxType);
  },
  build: ({ key, level, puzzle }) => {
    if (!puzzle) return null;
    const game = new Chess(puzzle.fen);
    const pieces = moverPiecesWithMoves(game).filter((x) => x.moves >= 2 && x.type !== "k");
    const chosen = seededPick(pieces, 1, `sp.reach:${key}`)[0];
    if (!chosen) return null;
    const set = numChoices(chosen.moves, `sp.reach:${key}`);
    if (!set) return null;
    const mover = game.turn();
    return {
      kind: "choice",
      id: exerciseId("sp.reach", key),
      category: "spatial",
      family: "sp.reach",
      familyLabel: "Piece reach",
      level,
      skill: "Count where a piece can really go, blockers included",
      orientation: mover,
      fen: puzzle.fen,
      highlight: [chosen.sq],
      prompt: `${sideWord(mover)} to move. How many squares can the ${PIECE_WORD[chosen.type]} on ${chosen.sq} legally move to (captures count)?`,
      choices: set.choices,
      correctIndex: set.correctIndex,
      explanation: {
        correct: `Correct — ${plural(chosen.moves, "square")}. Sliding pieces stop at the first blocker (or capture it if it is an enemy), and every move must keep your own king safe.`,
        incorrect: `The ${PIECE_WORD[chosen.type]} has ${plural(chosen.moves, "legal move")}. Trace each line until it hits a piece or the edge, include a capture on an enemy blocker, and skip moves that would expose your king.`,
      },
    };
  },
};

const common: FamilyDef = {
  id: "sp.common",
  category: "spatial",
  label: "Shared squares",
  skill: "Find the square two pieces both control",
  classify: (p) => {
    if (b6(p) !== 1) return null;
    return shared(new Chess(p.fen)) ? (Math.max(2, Math.min(4, ratingToLevel(p.rating))) as Level) : null;
  },
  build: ({ key, level, puzzle }) => {
    if (!puzzle) return null;
    const game = new Chess(puzzle.fen);
    const s = shared(game);
    if (!s) return null;
    const board = boardMap(game);
    const aSet = new Set(attackedSquares(board, s.a));
    const bSet = new Set(attackedSquares(board, s.b));
    const either = [...new Set([...aSet, ...bSet])].filter((sq) => sq !== s.target && !(aSet.has(sq) && bSet.has(sq)));
    const set = makeChoiceSet(s.target, seededPick(either, 3, `sp.common:${key}`), `sp.common:${key}`);
    if (!set) return null;
    const pa = board.get(s.a)!;
    const pb = board.get(s.b)!;
    const name = (sq: Square, p: { type: PieceSymbol; color: Color }) => `${p.color === "w" ? "White" : "Black"} ${PIECE_WORD[p.type]} on ${sq}`;
    return {
      kind: "choice",
      id: exerciseId("sp.common", key),
      category: "spatial",
      family: "sp.common",
      familyLabel: "Shared squares",
      level,
      skill: "Find the square two pieces both control",
      orientation: game.turn(),
      fen: puzzle.fen,
      highlight: [s.a, s.b],
      prompt: `The ${name(s.a, pa)} and the ${name(s.b, pb)} both attack exactly one common square. Which square is it?`,
      choices: set.choices,
      correctIndex: set.correctIndex,
      explanation: {
        correct: `Correct — both pieces attack ${s.target}. Draw each piece's lines and stop at blockers; the square where they cross is the answer.`,
        incorrect: `Both pieces attack ${s.target}. Trace each piece's reach separately (sliders stop at the first piece in the way), then find the one square on both lists.`,
      },
    };
  },
};

function shared(game: Chess): { a: Square; b: Square; target: Square } | null {
  const board = boardMap(game);
  const pieces = [...board.entries()].filter(([, p]) => p.type !== "p" && p.type !== "k").map(([sq]) => sq);
  if (pieces.length < 2 || pieces.length > 14) return null;
  const rng = seededRng(`shared:${game.fen()}`);
  const pairs: [Square, Square][] = [];
  for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) pairs.push([pieces[i], pieces[j]]);
  for (const [a, b] of seededShuffle(pairs, rng)) {
    const A = new Set(attackedSquares(board, a));
    const B = attackedSquares(board, b).filter((sq) => A.has(sq));
    const attackable = (sq: Square, color: Color) => !board.has(sq) || board.get(sq)!.color !== color;
    const pa = board.get(a)!;
    const pb = board.get(b)!;
    // "Attack" means it could capture there: an own piece on the square is defended, not attacked.
    const both = [...new Set(B)].filter((sq) => attackable(sq, pa.color) && attackable(sq, pb.color));
    const distinctOther = new Set([...A, ...attackedSquares(board, b)]).size - both.length;
    if (both.length === 1 && distinctOther >= 3) return { a, b, target: both[0] };
  }
  return null;
}

const escape: FamilyDef = {
  id: "sp.escape",
  category: "spatial",
  label: "King escape squares",
  skill: "Count a king's safe squares — the geometry of king safety",
  classify: (p) => {
    if (b6(p) !== 2) return null;
    const game = new Chess(p.fen);
    if (game.isGameOver()) return null;
    const n = kingMoves(game);
    if (n < 1) return null;
    return (game.inCheck() ? 3 : Math.min(3, Math.max(2, ratingToLevel(p.rating)))) as Level;
  },
  build: ({ key, level, puzzle }) => {
    if (!puzzle) return null;
    const game = new Chess(puzzle.fen);
    const n = kingMoves(game);
    const set = numChoices(n, `sp.escape:${key}`, 8);
    if (!set) return null;
    const mover = game.turn();
    const kingSq = [...boardMap(game).entries()].find(([, p]) => p.type === "k" && p.color === mover)![0];
    const check = game.inCheck();
    return {
      kind: "choice",
      id: exerciseId("sp.escape", key),
      category: "spatial",
      family: "sp.escape",
      familyLabel: "King escape squares",
      level,
      skill: "Count a king's safe squares — the geometry of king safety",
      orientation: mover,
      fen: puzzle.fen,
      highlight: [kingSq],
      prompt: `${sideWord(mover)}'s king on ${kingSq}${check ? " is in check" : ""}. How many squares can it legally move to?`,
      choices: set.choices,
      correctIndex: set.correctIndex,
      explanation: {
        correct: `Correct — ${plural(n, "escape square")}. A square is available only if it is empty or holds an enemy piece, and no enemy piece attacks it${check ? " (and it must get out of check)" : ""}.`,
        incorrect: `The king has ${plural(n, "legal square")}. Check all eight neighbours: remove squares occupied by your own pieces, then squares attacked by the enemy${check ? ", and remember you must leave check" : ""}.`,
      },
    };
  },
};

function kingMoves(game: Chess): number {
  const mover = game.turn();
  const kingSq = [...boardMap(game).entries()].find(([, p]) => p.type === "k" && p.color === mover)?.[0];
  // Castling is not an "escape square": count single-step king moves only.
  return kingSq ? game.moves({ square: kingSq, verbose: true }).filter((m) => !m.san.startsWith("O-O")).length : 0;
}

const mobility: FamilyDef = {
  id: "sp.mobility",
  category: "spatial",
  label: "Most active piece",
  skill: "Judge which piece has the most room to move",
  classify: (p) => {
    if (b6(p) !== 3) return null;
    const game = new Chess(p.fen);
    return mobilitySet(game) ? (Math.max(3, Math.min(4, ratingToLevel(p.rating))) as Level) : null;
  },
  build: ({ key, level, puzzle }) => {
    if (!puzzle) return null;
    const game = new Chess(puzzle.fen);
    const m = mobilitySet(game, `sp.mobility:${key}`);
    if (!m) return null;
    const label = (x: { sq: Square; type: PieceSymbol }) => `${capitalizeWord(PIECE_WORD[x.type])} on ${x.sq}`;
    const set = makeChoiceSet(label(m.best), m.others.map(label), `sp.mobility:${key}`);
    if (!set) return null;
    const mover = game.turn();
    return {
      kind: "choice",
      id: exerciseId("sp.mobility", key),
      category: "spatial",
      family: "sp.mobility",
      familyLabel: "Most active piece",
      level,
      skill: "Judge which piece has the most room to move",
      orientation: mover,
      fen: puzzle.fen,
      highlight: [m.best.sq, ...m.others.map((o) => o.sq)],
      prompt: `${sideWord(mover)} to move. Which of these pieces has the most legal moves?`,
      choices: set.choices,
      correctIndex: set.correctIndex,
      explanation: {
        correct: `Correct — the ${PIECE_WORD[m.best.type]} on ${m.best.sq} has ${plural(m.best.moves, "legal move")}; the others have ${m.others.map((o) => o.moves).join(", ")}. Open lines and few blockers mean high mobility.`,
        incorrect: `The ${PIECE_WORD[m.best.type]} on ${m.best.sq} has the most (${m.best.moves}); the others have ${m.others.map((o) => o.moves).join(", ")}. Mobility depends on open lines, not on how valuable the piece is.`,
      },
    };
  },
};

function capitalizeWord(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function mobilitySet(game: Chess, seed = game.fen()) {
  const pieces = moverPiecesWithMoves(game).filter((x) => x.type !== "k");
  if (pieces.length < 4) return null;
  const sorted = [...pieces].sort((a, b) => b.moves - a.moves || a.sq.localeCompare(b.sq));
  const top = sorted[0];
  if (sorted[1].moves === top.moves) return null;
  const rest = sorted.slice(1).filter((x) => x.moves < top.moves);
  const others = seededPick(rest, 3, seed);
  return others.length === 3 ? { best: top, others } : null;
}

const control: FamilyDef = {
  id: "sp.control",
  category: "spatial",
  label: "Square control",
  skill: "Count the attackers bearing on a key square",
  classify: (p) => {
    if (b6(p) !== 4) return null;
    return controlTarget(new Chess(p.fen)) ? (Math.max(3, Math.min(4, ratingToLevel(p.rating))) as Level) : null;
  },
  build: ({ key, level, puzzle }) => {
    if (!puzzle) return null;
    const game = new Chess(puzzle.fen);
    const t = controlTarget(game);
    if (!t) return null;
    const set = numChoices(t.count, `sp.control:${key}`, 7);
    if (!set) return null;
    const side = sideWord(t.color);
    return {
      kind: "choice",
      id: exerciseId("sp.control", key),
      category: "spatial",
      family: "sp.control",
      familyLabel: "Square control",
      level,
      skill: "Count the attackers bearing on a key square",
      orientation: game.turn(),
      fen: puzzle.fen,
      highlight: [t.square],
      prompt: `How many ${side} pieces attack the square ${t.square}? (Count pieces that attack it directly — pinned or not — not ones hidden behind another piece.)`,
      choices: set.choices,
      correctIndex: set.correctIndex,
      explanation: {
        correct: `Correct — ${t.count} ${side} pieces: ${t.attackers.join(", ")}. Counting attackers is how you decide whether an exchange on a square works.`,
        incorrect: `${t.count} ${side} pieces attack ${t.square}: ${t.attackers.join(", ")}. Check each piece's lines and jumps. A piece hidden behind another slider is not counted as a direct attacker.`,
      },
    };
  },
};

function controlTarget(game: Chess): { square: Square; color: Color; count: number; attackers: Square[] } | null {
  const board = boardMap(game);
  const n = pieceCount(board);
  if (n < 8 || n > 24) return null;
  const color = game.turn();
  let best: { square: Square; count: number; attackers: Square[] } | null = null;
  for (const sq of allSquares()) {
    const attackers = attackersOf(board, sq, color);
    if (attackers.length >= 2 && (!best || attackers.length > best.count || (attackers.length === best.count && sq < best.square))) {
      best = { square: sq, count: attackers.length, attackers };
    }
  }
  if (!best || best.count > 6) return null;
  return { ...best, color };
}

const restrict: FamilyDef = {
  id: "sp.restrict",
  category: "spatial",
  label: "Restrict the king",
  skill: "Choose the move that shrinks the enemy king's space",
  classify: (p) => {
    if (b6(p) !== 5) return null;
    return restrictSet(new Chess(p.fen), p.id) ? (Math.max(4, ratingToLevel(p.rating)) as Level) : null;
  },
  build: ({ key, level, puzzle }) => {
    if (!puzzle) return null;
    const game = new Chess(puzzle.fen);
    const r = restrictSet(game, `sp.restrict:${key}`);
    if (!r) return null;
    const set = makeChoiceSet(r.best.san, r.others.map((o) => o.san), `sp.restrict:${key}`);
    if (!set) return null;
    const mover = game.turn();
    const rows = r.all.map((o) => `${o.san}: ${plural(o.escapes, "escape square")}`).join("; ");
    return {
      kind: "choice",
      id: exerciseId("sp.restrict", key),
      category: "spatial",
      family: "sp.restrict",
      familyLabel: "Restrict the king",
      level,
      skill: "Choose the move that shrinks the enemy king's space",
      orientation: mover,
      fen: puzzle.fen,
      prompt: `${sideWord(mover)} to move. Which move leaves the enemy king with the FEWEST legal squares afterwards?`,
      choices: set.choices,
      correctIndex: set.correctIndex,
      explanation: {
        correct: `Correct — ${r.best.san} leaves ${plural(r.best.escapes, "escape square")}. After each candidate: ${rows}.`,
        incorrect: `${r.best.san} leaves the fewest (${r.best.escapes}). After each candidate: ${rows}. Strong attackers reduce the king's space first — then the mating net follows.`,
      },
    };
  },
};

function restrictSet(game: Chess, seed: string) {
  if (game.inCheck()) return null;
  const ranked = game
    .moves({ verbose: true })
    .map((m) => ({ m, score: (/[+#]$/.test(m.san) ? 100 : 0) + (m.captured ? 10 : 0) }))
    .sort((a, b) => b.score - a.score || a.m.san.localeCompare(b.m.san))
    .slice(0, 12);
  const uniq = new Map(ranked.map((r) => [r.m.san, r.m]));
  const rows: { san: string; escapes: number }[] = [];
  for (const m of uniq.values()) {
    const g = new Chess(game.fen());
    g.move(m);
    if (g.isCheckmate() || g.isStalemate()) continue;
    const enemy = g.turn();
    const kingSq = [...boardMap(g).entries()].find(([, p]) => p.type === "k" && p.color === enemy)?.[0];
    if (!kingSq) continue;
    rows.push({ san: m.san, escapes: g.moves({ square: kingSq, verbose: true }).filter((x) => !x.san.startsWith("O-O")).length });
  }
  if (rows.length < 4) return null;
  const picked = seededPick(rows, 4, seed);
  const sorted = [...picked].sort((a, b) => a.escapes - b.escapes || a.san.localeCompare(b.san));
  if (sorted[0].escapes === sorted[1].escapes) return null;
  return { best: sorted[0], others: sorted.slice(1), all: sorted };
}

export const SPATIAL_FAMILIES: FamilyDef[] = [coords, kingwalk, knight, reach, common, escape, mobility, control, restrict];

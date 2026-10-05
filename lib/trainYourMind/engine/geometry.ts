import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";

/**
 * Pure board geometry for Train Your Chess Mind exercise generation.
 *
 * Everything here is derived from the real chess.js board state — no hidden
 * state, no invented rules. "Attack" means what chess players mean by it: the
 * piece could capture on that square if an enemy piece stood there (pins are
 * ignored; a pinned piece still "attacks"). Own pieces on the target square
 * count as "defended".
 */

export type BoardMap = Map<Square, { type: PieceSymbol; color: Color }>;

export const PIECE_VALUES: Record<Exclude<PieceSymbol, "k">, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };

export function valueOf(type: PieceSymbol): number {
  return type === "k" ? 0 : PIECE_VALUES[type];
}

export const PIECE_WORD: Record<PieceSymbol, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};

export const COLOR_WORD: Record<Color, string> = { w: "White", b: "Black" };

export function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function pieceName(type: PieceSymbol, color: Color): string {
  return `${COLOR_WORD[color]} ${PIECE_WORD[type]}`;
}

export function fileOf(sq: string): number {
  return sq.charCodeAt(0) - 97;
}
export function rankOf(sq: string): number {
  return parseInt(sq[1], 10) - 1;
}
export function squareName(file: number, rank: number): Square {
  return (String.fromCharCode(97 + file) + (rank + 1)) as Square;
}
export function onBoard(file: number, rank: number): boolean {
  return file >= 0 && file < 8 && rank >= 0 && rank < 8;
}

export function boardMap(game: Chess): BoardMap {
  const map: BoardMap = new Map();
  for (const row of game.board()) {
    for (const cell of row) {
      if (cell) map.set(cell.square, { type: cell.type, color: cell.color });
    }
  }
  return map;
}

const KNIGHT: [number, number][] = [
  [1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1],
];
const KING: [number, number][] = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
];
const ROOK_DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP_DIRS: [number, number][] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

/** Squares the piece on `from` attacks (including squares holding any piece,
 *  which are "attacked" if enemy and "defended" if friendly). */
export function attackedSquares(board: BoardMap, from: Square): Square[] {
  const piece = board.get(from);
  if (!piece) return [];
  const f = fileOf(from);
  const r = rankOf(from);
  const out: Square[] = [];

  const step = (offsets: [number, number][]) => {
    for (const [df, dr] of offsets) {
      if (onBoard(f + df, r + dr)) out.push(squareName(f + df, r + dr));
    }
  };
  const slide = (dirs: [number, number][]) => {
    for (const [df, dr] of dirs) {
      let nf = f + df;
      let nr = r + dr;
      while (onBoard(nf, nr)) {
        const sq = squareName(nf, nr);
        out.push(sq);
        if (board.has(sq)) break;
        nf += df;
        nr += dr;
      }
    }
  };

  switch (piece.type) {
    case "n": step(KNIGHT); break;
    case "k": step(KING); break;
    case "r": slide(ROOK_DIRS); break;
    case "b": slide(BISHOP_DIRS); break;
    case "q": slide([...ROOK_DIRS, ...BISHOP_DIRS]); break;
    case "p": {
      const dir = piece.color === "w" ? 1 : -1;
      for (const df of [-1, 1]) {
        if (onBoard(f + df, r + dir)) out.push(squareName(f + df, r + dir));
      }
      break;
    }
  }
  return out;
}

/** Squares of `color`'s pieces that attack `target`. */
export function attackersOf(board: BoardMap, target: Square, color: Color): Square[] {
  const out: Square[] = [];
  for (const [sq, p] of board) {
    if (p.color !== color) continue;
    if (attackedSquares(board, sq).includes(target)) out.push(sq);
  }
  return out;
}

export function materialOf(board: BoardMap, color: Color): number {
  let total = 0;
  for (const p of board.values()) if (p.color === color) total += valueOf(p.type);
  return total;
}

/** White material minus Black material, in standard points (P1 N3 B3 R5 Q9). */
export function materialBalance(board: BoardMap): number {
  return materialOf(board, "w") - materialOf(board, "b");
}

export function pieceCount(board: BoardMap): number {
  return board.size;
}

export function describePiece(board: BoardMap, sq: Square): string {
  const p = board.get(sq);
  return p ? `${pieceName(p.type, p.color)} on ${sq}` : sq;
}

/** Exchange value of capturing on `to` with the move `from`->`to`, assuming both
 *  sides keep capturing on that square only while it helps them (static exchange
 *  evaluation by exhaustive search over legal captures). Positive = the capturing
 *  side nets material. Uses chess.js legality, so pins and checks are respected. */
export function exchangeNet(fen: string, from: Square, to: Square): number | null {
  const game = new Chess(fen);
  const target = game.get(to);
  const mover = game.get(from);
  if (!target || !mover || target.color === mover.color) return null;
  const move = game
    .moves({ square: from, verbose: true })
    .find((m) => m.to === to && (!m.promotion || m.promotion === "q"));
  if (!move) return null;

  const gainAfter = (g: Chess): number => {
    // Best the side to move can still do on `to`: stand pat (0) or recapture.
    let best = 0;
    for (const m of g.moves({ verbose: true })) {
      if (m.to !== to || !m.captured) continue;
      const gain = valueOf(m.captured) + (m.promotion ? valueOf(m.promotion) - 1 : 0);
      g.move(m);
      const reply = gainAfter(g);
      g.undo();
      best = Math.max(best, gain - reply);
    }
    return best;
  };

  const first = valueOf(move.captured!) + (move.promotion ? valueOf(move.promotion) - 1 : 0);
  game.move(move);
  return first - gainAfter(game);
}

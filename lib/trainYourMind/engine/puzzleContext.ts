import { Chess, type Move, type Color } from "chess.js";
import type { TacticsPuzzle } from "@/lib/puzzles/tacticsTypes";
import { boardMap, materialBalance, valueOf, pieceName, PIECE_WORD, COLOR_WORD } from "./geometry";

/**
 * A tactics-library puzzle replayed through chess.js, so every fact an exercise
 * states (who captured what, whether it is mate, how much material changed) is
 * computed from legal play rather than asserted.
 *
 * Library convention (see /api/chess-mind/reaction): `fen` is the position with
 * the learner to move, `solution[0]` is the learner's move, `solution[1]` the
 * opponent's reply, and so on.
 */
export interface PuzzleContext {
  puzzle: TacticsPuzzle;
  player: Color;
  /** Verbose moves actually played along the solution line. */
  moves: Move[];
  /** FEN before ply i (index 0 = start); fens[moves.length] = final position. */
  fens: string[];
}

export function buildContext(puzzle: TacticsPuzzle): PuzzleContext | null {
  try {
    const game = new Chess(puzzle.fen);
    const player = game.turn();
    const fens = [game.fen()];
    const moves: Move[] = [];
    for (const uci of puzzle.solution) {
      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      const promotion = uci.length > 4 ? uci[4] : undefined;
      const m = game.move({ from, to, promotion });
      if (!m) return null;
      moves.push(m);
      fens.push(game.fen());
    }
    return { puzzle, player, moves, fens };
  } catch {
    return null;
  }
}

export function sideWord(c: Color): string {
  return COLOR_WORD[c];
}

/** Material change for the learner's side over plies [0, plies). Positive = gained. */
export function playerMaterialDelta(ctx: PuzzleContext, plies = ctx.moves.length): number {
  const start = materialBalance(boardMap(new Chess(ctx.fens[0])));
  const end = materialBalance(boardMap(new Chess(ctx.fens[plies])));
  const delta = end - start;
  return ctx.player === "w" ? delta : -delta;
}

export function isMateAt(ctx: PuzzleContext, plies = ctx.moves.length): boolean {
  return new Chess(ctx.fens[plies]).isCheckmate();
}

export function givesCheckAt(ctx: PuzzleContext, ply: number): boolean {
  return /[+#]$/.test(ctx.moves[ply].san);
}

/** "wins a knight", "wins a queen for a rook" etc. — only from verified material. */
export function outcomePhrase(ctx: PuzzleContext): string {
  if (isMateAt(ctx)) return "ends in checkmate";
  const delta = playerMaterialDelta(ctx);
  if (delta >= 1) return `nets ${delta} point${delta === 1 ? "" : "s"} of material`;
  if (delta === 0) return "keeps material level while winning the position";
  return `gives up ${-delta} point${delta === -1 ? "" : "s"} of material for a decisive attack`;
}

/** The learner's own moves in the line, as SAN (plies 0, 2, 4…). */
export function playerSan(ctx: PuzzleContext): string[] {
  return ctx.moves.filter((_, i) => i % 2 === 0).map((m) => m.san);
}

export function lineText(ctx: PuzzleContext, upTo = ctx.moves.length): string {
  const out: string[] = [];
  let num = new Chess(ctx.fens[0]).moveNumber();
  let color: Color = ctx.player;
  for (let i = 0; i < upTo; i++) {
    const san = ctx.moves[i].san;
    if (color === "w") out.push(`${num}.${san}`);
    else out.push(i === 0 ? `${num}...${san}` : san);
    if (color === "b") num++;
    color = color === "w" ? "b" : "w";
  }
  return out.join(" ");
}

export function capturedPiece(m: Move): string | null {
  return m.captured ? PIECE_WORD[m.captured] : null;
}

export { valueOf, pieceName };

/** Plain-language teaching line for Lichess motif themes. Only themes whose
 *  meaning is standard chess vocabulary are listed; the rest are ignored. */
export const MOTIF_TEACHING: Record<string, { label: string; idea: string }> = {
  fork: { label: "Fork", idea: "one piece attacks two targets at once, so the opponent can only save one." },
  pin: { label: "Pin", idea: "a piece cannot move without exposing something more valuable behind it." },
  skewer: { label: "Skewer", idea: "a valuable piece is forced to move and exposes the piece behind it." },
  discoveredAttack: { label: "Discovered attack", idea: "moving one piece uncovers an attack from the piece behind it." },
  discoveredCheck: { label: "Discovered check", idea: "moving one piece uncovers a check from another, leaving the moved piece free to do damage." },
  doubleCheck: { label: "Double check", idea: "two pieces give check at once, so the king must move." },
  hangingPiece: { label: "Hanging piece", idea: "an undefended piece can simply be taken." },
  trappedPiece: { label: "Trapped piece", idea: "a piece has no safe square and cannot escape." },
  deflection: { label: "Deflection", idea: "a defender is lured away from the job it was doing." },
  attraction: { label: "Attraction", idea: "a piece is drawn onto a square where it can be attacked." },
  clearance: { label: "Clearance", idea: "a piece moves away to open a line or square for another." },
  interference: { label: "Interference", idea: "a piece is placed on a line to cut the opponent's pieces off from each other." },
  xRayAttack: { label: "X-ray attack", idea: "a piece attacks through another piece along a line." },
  capturingDefender: { label: "Removing the defender", idea: "capturing the piece that guards something makes the target fall." },
  backRankMate: { label: "Back-rank mate", idea: "the king is trapped by its own pawns on the back rank." },
  smotheredMate: { label: "Smothered mate", idea: "a knight checks a king that is boxed in by its own pieces." },
  anastasiaMate: { label: "Anastasia's mate", idea: "a rook and knight trap the king against the edge and its own pawn." },
  arabianMate: { label: "Arabian mate", idea: "a rook and knight cooperate to mate a king in the corner." },
  zugzwang: { label: "Zugzwang", idea: "every legal move worsens the position for the side to move." },
  quietMove: { label: "Quiet move", idea: "a calm, non-forcing move creates an unstoppable threat." },
  intermezzo: { label: "In-between move", idea: "a forcing move is inserted before the expected recapture." },
  sacrifice: { label: "Sacrifice", idea: "material is given up to win something bigger." },
  defensiveMove: { label: "Defensive resource", idea: "the only move that holds the position together." },
  promotion: { label: "Promotion", idea: "a pawn reaches the last rank and becomes a queen or another piece." },
  mateIn1: { label: "Mate in 1", idea: "a single move delivers checkmate." },
  mateIn2: { label: "Mate in 2", idea: "checkmate is forced within two moves." },
  mateIn3: { label: "Mate in 3", idea: "checkmate is forced within three moves." },
};

/** First motif theme the puzzle carries, in teaching-priority order. */
const MOTIF_PRIORITY = [
  "smotheredMate", "backRankMate", "anastasiaMate", "arabianMate", "doubleCheck", "discoveredCheck",
  "discoveredAttack", "fork", "pin", "skewer", "hangingPiece", "trappedPiece", "deflection", "attraction",
  "capturingDefender", "xRayAttack", "interference", "clearance", "intermezzo", "quietMove", "zugzwang",
];

export function motifsOf(puzzle: TacticsPuzzle): string[] {
  return MOTIF_PRIORITY.filter((t) => puzzle.themes.includes(t));
}

export function primaryMotif(puzzle: TacticsPuzzle): string | null {
  return motifsOf(puzzle)[0] ?? null;
}

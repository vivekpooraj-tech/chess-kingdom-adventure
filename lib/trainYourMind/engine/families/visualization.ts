import { Chess, type PieceSymbol, type Square } from "chess.js";
import { fnv1a } from "../../exerciseIds";
import { ratingToLevel, type ChoiceExercise, type Level } from "../../curriculum";
import { PIECE_WORD, attackedSquares, boardMap, capitalise, fileOf, pieceName, rankOf, squareName } from "../geometry";
import { makeChoiceSet, seededPick } from "../rng";
import { buildContext, lineText, sideWord, type PuzzleContext } from "../puzzleContext";
import { exerciseId, type FamilyDef } from "./types";

/**
 * VISUALIZATION — keeping the board in your head. The position is shown, then
 * hidden (an always-available "Show board" assist lets anyone peek, which is
 * recorded as assisted help and does not count towards mastery). Questions are
 * about what the board looks like AFTER moves are played mentally: which square
 * is now empty, what stands where, how many pieces remain, what a piece attacks.
 * Every answer is replayed through chess.js, so the key can never desync.
 */

const b5 = (p: { id: string }) => parseInt(fnv1a(p.id), 36) % 5;
const SHOW_SECONDS: Record<Level, number> = { 1: 8, 2: 7, 3: 6, 4: 5, 5: 4 };

function blind(level: Level) {
  return { showSeconds: SHOW_SECONDS[level] };
}

function plural(n: number, w: string) {
  return `${n} ${w}${n === 1 ? "" : "s"}`;
}

const crowdLevel = (fen: string): number => {
  const n = boardMap(new Chess(fen)).size;
  return n <= 10 ? 0 : n <= 18 ? 1 : 2;
};

// -- viz.reach: where can this piece go? ---------------------------------------
const reach: FamilyDef = {
  id: "viz.reach",
  category: "visualization",
  label: "Where can it go?",
  skill: "Picture a piece's moves on a board you can no longer see",
  classify: (p) => {
    if (b5(p) !== 0) return null;
    const t = reachTarget(new Chess(p.fen), p.id);
    return t ? ((t.type === "n" ? 1 : 2) as Level) : null;
  },
  build: ({ key, level, puzzle }) => {
    if (!puzzle) return null;
    const game = new Chess(puzzle.fen);
    const t = reachTarget(game, `viz.reach:${key}`);
    if (!t) return null;
    const set = makeChoiceSet(t.correct, t.wrong, `viz.reach:${key}`);
    if (!set) return null;
    const mover = game.turn();
    return {
      kind: "choice",
      id: exerciseId("viz.reach", key),
      category: "visualization",
      family: "viz.reach",
      familyLabel: "Where can it go?",
      level,
      skill: "Picture a piece's moves on a board you can no longer see",
      orientation: mover,
      fen: puzzle.fen,
      blind: blind(level),
      prompt: `${sideWord(mover)} to move. Which square can the ${PIECE_WORD[t.type]} on ${t.from} legally move to?`,
      choices: set.choices,
      correctIndex: set.correctIndex,
      explanation: {
        correct: `Correct — the ${PIECE_WORD[t.type]} on ${t.from} can reach ${t.correct}. Its legal destinations are: ${t.all.join(", ")}.`,
        incorrect: `The ${PIECE_WORD[t.type]} on ${t.from} can reach ${t.correct} (all its destinations: ${t.all.join(", ")}). The other squares are either blocked, off its line, or would leave the king in check.`,
      },
    };
  },
};

function reachTarget(game: Chess, seed: string) {
  const mover = game.turn();
  const board = boardMap(game);
  const pieces = [...board.entries()].filter(([, p]) => p.color === mover && (p.type === "n" || p.type === "b" || p.type === "r" || p.type === "q"));
  const withMoves = pieces
    .map(([sq, p]) => ({ sq, type: p.type as PieceSymbol, moves: game.moves({ square: sq, verbose: true }) }))
    .filter((x) => x.moves.length >= 2);
  const chosen = seededPick(withMoves, 1, seed)[0];
  if (!chosen) return null;
  const dests = chosen.moves.map((m) => m.to as Square).sort();
  const destSet = new Set<string>(dests);
  const fromF = fileOf(chosen.sq);
  const fromR = rankOf(chosen.sq);
  // Plausible wrong answers: nearby squares the piece cannot legally reach.
  const wrong: Square[] = [];
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const sq = squareName(f, r);
      const d = Math.max(Math.abs(f - fromF), Math.abs(r - fromR));
      if (sq !== chosen.sq && !destSet.has(sq) && d <= 3) wrong.push(sq);
    }
  }
  if (wrong.length < 3) return null;
  const correct = seededPick(dests, 1, `${seed}:c`)[0];
  return { from: chosen.sq, type: chosen.type, correct, wrong: seededPick(wrong, 6, `${seed}:w`), all: dests };
}

// -- shared: replay k plies, with facts -----------------------------------------
function after(ctx: PuzzleContext, plies: number) {
  return new Chess(ctx.fens[plies]);
}

// -- viz.empty: which square is empty now? --------------------------------------
const empty: FamilyDef = {
  id: "viz.empty",
  category: "visualization",
  label: "What moved away?",
  skill: "Track which squares are vacated by a sequence of moves",
  classify: (p) => (b5(p) === 1 && p.solution.length <= 3 ? ((p.solution.length === 1 ? 1 : 2) as Level) : null),
  build: ({ key, level, puzzle }) => {
    const ctx = puzzle && buildContext(puzzle);
    if (!ctx) return null;
    const plies = Math.min(2, ctx.moves.length);
    const end = boardMap(after(ctx, plies));
    const start = boardMap(new Chess(ctx.fens[0]));
    const vacated = [...new Set(ctx.moves.slice(0, plies).map((m) => m.from as Square))].filter((sq) => !end.has(sq));
    if (!vacated.length) return null;
    const correct = seededPick(vacated, 1, `viz.empty:${key}`)[0];
    const untouched = [...start.keys()].filter((sq) => end.has(sq) && start.get(sq)!.type === end.get(sq)!.type && !vacated.includes(sq));
    const set = makeChoiceSet(correct, seededPick(untouched, 6, `viz.empty:${key}:d`), `viz.empty:${key}`);
    if (!set) return null;
    return {
      kind: "choice",
      id: exerciseId("viz.empty", key),
      category: "visualization",
      family: "viz.empty",
      familyLabel: "What moved away?",
      level,
      skill: "Track which squares are vacated by a sequence of moves",
      orientation: ctx.player,
      fen: ctx.fens[0],
      blind: blind(level),
      prompt: `${lineText(ctx, plies)} is played. Which of these squares is now EMPTY?`,
      choices: set.choices,
      correctIndex: set.correctIndex,
      explanation: {
        correct: `Correct — ${correct} was vacated by ${lineText(ctx, plies)}; the other squares still hold their pieces.`,
        incorrect: `${correct} is empty: a piece left it during ${lineText(ctx, plies)}. The other three squares were not touched by the moves. Follow each move's starting square.`,
      },
    } satisfies ChoiceExercise;
  },
};

// -- viz.count: how many pieces remain? -----------------------------------------
const count: FamilyDef = {
  id: "viz.count",
  category: "visualization",
  label: "Count after the captures",
  skill: "Update a position in your head as pieces are captured",
  classify: (p) => {
    if (b5(p) !== 2 || p.solution.length < 3) return null;
    return (p.solution.length === 3 ? 2 : 3) as Level;
  },
  build: ({ key, level, puzzle }) => {
    const ctx = puzzle && buildContext(puzzle);
    if (!ctx) return null;
    const plies = ctx.moves.length;
    if (!ctx.moves.some((m) => m.captured)) return null;
    const side = ctx.player === "w" ? "b" : "w";
    const before = [...boardMap(new Chess(ctx.fens[0])).values()].filter((x) => x.color === side).length;
    const afterN = [...boardMap(after(ctx, plies)).values()].filter((x) => x.color === side).length;
    const near = [-3, -2, -1, 1, 2, 3].map((d) => afterN + d).filter((n) => n >= 1 && n !== afterN);
    const set = makeChoiceSet(String(afterN), near.map(String), `viz.count:${key}`);
    if (!set) return null;
    const sideName = sideWord(side);
    return {
      kind: "choice",
      id: exerciseId("viz.count", key),
      category: "visualization",
      family: "viz.count",
      familyLabel: "Count after the captures",
      level,
      skill: "Update a position in your head as pieces are captured",
      orientation: ctx.player,
      fen: ctx.fens[0],
      blind: blind(level),
      prompt: `Now ${sideName} has ${before} pieces (including pawns and the king). After ${lineText(ctx)}, how many ${sideName} pieces remain?`,
      choices: set.choices,
      correctIndex: set.correctIndex,
      explanation: {
        correct: `Correct — ${sideName} has ${plural(afterN, "piece")} left after ${lineText(ctx)}.`,
        incorrect: `${sideName} has ${plural(afterN, "piece")} left (${before} before). Go through ${lineText(ctx)} and subtract one ${sideName} piece for each capture of theirs.`,
      },
    };
  },
};

// -- viz.attack: what does the piece attack now? ---------------------------------
const attack: FamilyDef = {
  id: "viz.attack",
  category: "visualization",
  label: "Attack map",
  skill: "Picture what a piece attacks in the position AFTER the moves",
  classify: (p) => {
    if (b5(p) !== 3) return null;
    const base = p.solution.length === 1 ? 2 : p.solution.length === 3 ? 3 : 4;
    return Math.min(5, base + (ratingToLevel(p.rating) >= 5 ? 1 : 0)) as Level;
  },
  build: ({ key, level, puzzle }) => {
    const ctx = puzzle && buildContext(puzzle);
    if (!ctx) return null;
    const plies = ctx.moves.length;
    const last = ctx.moves[plies - 1];
    if (last.piece === "p" || last.piece === "k") return null;
    const game = after(ctx, plies);
    const board = boardMap(game);
    const piece = board.get(last.to as Square);
    if (!piece) return null;
    // "Attacks" here means squares it could capture on or move to: empty or enemy-held.
    const attacked = new Set(
      attackedSquares(board, last.to as Square).filter((sq) => !board.has(sq) || board.get(sq)!.color !== piece.color)
    );
    // A clear answer: exactly one of the four squares is attacked.
    const near: Square[] = [];
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const sq = squareName(f, r);
        const d = Math.max(Math.abs(f - fileOf(last.to)), Math.abs(r - rankOf(last.to)));
        if (!attacked.has(sq) && sq !== last.to && d <= 4 && d >= 1) near.push(sq);
      }
    }
    const correctPool = [...attacked];
    if (correctPool.length < 1 || near.length < 3) return null;
    const correct = seededPick(correctPool, 1, `viz.attack:${key}:c`)[0];
    const set = makeChoiceSet(correct, seededPick(near, 6, `viz.attack:${key}:w`), `viz.attack:${key}`);
    if (!set) return null;
    return {
      kind: "choice",
      id: exerciseId("viz.attack", key),
      category: "visualization",
      family: "viz.attack",
      familyLabel: "Attack map",
      level,
      skill: "Picture what a piece attacks in the position AFTER the moves",
      orientation: ctx.player,
      fen: ctx.fens[0],
      blind: blind(level),
      prompt: `After ${lineText(ctx)}, the ${pieceName(piece.type, piece.color).toLowerCase()} on ${last.to} stands there. Which of these squares does it attack?`,
      choices: set.choices,
      correctIndex: set.correctIndex,
      explanation: {
        correct: `Correct — from ${last.to} the ${PIECE_WORD[piece.type]} attacks ${correct} (it attacks: ${[...attacked].sort().join(", ")}).`,
        incorrect: `The ${PIECE_WORD[piece.type]} on ${last.to} attacks ${correct} (all its attacked squares: ${[...attacked].sort().join(", ")}). Rebuild the position after the moves first, then trace the piece's lines from its new square.`,
      },
    };
  },
};

// -- viz.occupant: what stands there at the end? --------------------------------
const occupant: FamilyDef = {
  id: "viz.occupant",
  category: "visualization",
  label: "Who stands there?",
  skill: "Follow a sequence of exchanges and know what ends up on a square",
  classify: (p) => {
    if (b5(p) !== 4 || p.solution.length < 3) return null;
    const ctx = buildContext(p);
    return ctx && occupantTarget(ctx) ? (Math.min(5, (p.solution.length === 3 ? 3 : 4) + (ratingToLevel(p.rating) >= 5 ? 1 : 0)) as Level) : null;
  },
  build: ({ key, level, puzzle }) => {
    const ctx = puzzle && buildContext(puzzle);
    if (!ctx) return null;
    const t = occupantTarget(ctx);
    if (!t) return null;
    const names = [...new Set([...boardMap(after(ctx, ctx.moves.length)).values()].map((p) => capitalise(pieceName(p.type, p.color).toLowerCase())))];
    const answer = capitalise(pieceName(t.type, t.color).toLowerCase());
    const set = makeChoiceSet(answer, names, `viz.occupant:${key}`);
    if (!set) return null;
    return {
      kind: "choice",
      id: exerciseId("viz.occupant", key),
      category: "visualization",
      family: "viz.occupant",
      familyLabel: "Who stands there?",
      level,
      skill: "Follow a sequence of exchanges and know what ends up on a square",
      orientation: ctx.player,
      fen: ctx.fens[0],
      blind: blind(level),
      prompt: `${lineText(ctx)} is played. Which piece stands on ${t.square} at the end?`,
      choices: set.choices,
      correctIndex: set.correctIndex,
      explanation: {
        correct: `Correct — ${answer} on ${t.square}. The first piece to arrive there was captured, and ${answer.toLowerCase()} took its place during ${lineText(ctx)}.`,
        incorrect: `${t.square} ends up with the ${answer.toLowerCase()}. A square can change owners several times in an exchange — replay ${lineText(ctx)} and track who captures on ${t.square}.`,
      },
    };
  },
};

function occupantTarget(ctx: PuzzleContext): { square: Square; type: PieceSymbol; color: "w" | "b" } | null {
  // A square that was reached by one piece and later re-occupied by a different one.
  const firstTo = ctx.moves[0].to as Square;
  const end = boardMap(after(ctx, ctx.moves.length));
  const occ = end.get(firstTo);
  if (!occ) return null;
  const mover = ctx.moves[0];
  if (occ.color === mover.color && occ.type === mover.piece) return null;
  return { square: firstTo, type: occ.type, color: occ.color };
}

export const VISUALIZATION_FAMILIES: FamilyDef[] = [reach, empty, count, attack, occupant];

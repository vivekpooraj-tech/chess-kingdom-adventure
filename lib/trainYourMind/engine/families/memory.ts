import { Chess, type PieceSymbol, type Square, type Color } from "chess.js";
import { fnv1a } from "../../exerciseIds";
import { ratingToLevel, type Level } from "../../curriculum";
import { PIECE_WORD, attackersOf, boardMap, capitalise, pieceCount, pieceName } from "../geometry";
import { makeChoiceSet, seededPick } from "../rng";
import { buildContext, lineText, sideWord } from "../puzzleContext";
import { temptingMoves } from "./calculation";
import { hangingFacts } from "./pattern";
import { exerciseId, type FamilyDef } from "./types";

/**
 * MEMORY — chess memory, not generic memory-game mechanics. Learners remember
 * where specific pieces stood, notice what changed after a move, recall which
 * pieces were defended, and hold a short move sequence. The position is shown,
 * then hidden; the question and (where relevant) a second board are shown after.
 */

const b6 = (p: { id: string }) => parseInt(fnv1a(p.id), 36) % 6;

const SHOW_SECONDS: Record<Level, number> = { 1: 10, 2: 9, 3: 8, 4: 8, 5: 8 };

const crowd = (n: number): Level => (n <= 10 ? 1 : n <= 16 ? 2 : 3);

function pieceLabel(type: PieceSymbol, color: Color) {
  return capitalise(pieceName(type, color).toLowerCase());
}

// -- mem.where: which square held this piece? ----------------------------------
function uniquePieces(game: Chess) {
  const board = boardMap(game);
  const counts = new Map<string, number>();
  for (const p of board.values()) counts.set(p.color + p.type, (counts.get(p.color + p.type) ?? 0) + 1);
  return [...board.entries()].filter(([, p]) => p.type !== "k" && counts.get(p.color + p.type) === 1);
}

const where: FamilyDef = {
  id: "mem.where",
  category: "memory",
  label: "Where did it stand?",
  skill: "Remember exactly where key pieces stood",
  classify: (p) => {
    if (b6(p) !== 0) return null;
    const game = new Chess(p.fen);
    return uniquePieces(game).length && boardMap(game).size >= 5 ? crowd(boardMap(game).size) : null;
  },
  build: ({ key, level, puzzle }) => {
    if (!puzzle) return null;
    const game = new Chess(puzzle.fen);
    const unique = uniquePieces(game);
    const chosen = seededPick(unique, 1, `mem.where:${key}`)[0];
    if (!chosen) return null;
    const [sq, piece] = chosen;
    const board = boardMap(game);
    // Wrong answers are squares of OTHER pieces, so every choice is a plausible, real square.
    const others = [...board.keys()].filter((x) => x !== sq);
    const set = makeChoiceSet(sq, seededPick(others, 6, `mem.where:${key}:w`), `mem.where:${key}`);
    if (!set) return null;
    return {
      kind: "choice",
      id: exerciseId("mem.where", key),
      category: "memory",
      family: "mem.where",
      familyLabel: "Where did it stand?",
      level,
      skill: "Remember exactly where key pieces stood",
      orientation: game.turn(),
      fen: puzzle.fen,
      blind: { showSeconds: SHOW_SECONDS[level] },
      prompt: `On which square was the ${pieceLabel(piece.type, piece.color)}?`,
      choices: set.choices,
      correctIndex: set.correctIndex,
      explanation: {
        correct: `Correct — the ${pieceLabel(piece.type, piece.color).toLowerCase()} stood on ${sq}. Chunking helps: remember pieces in groups (the king's side, the centre) rather than one by one.`,
        incorrect: `The ${pieceLabel(piece.type, piece.color).toLowerCase()} stood on ${sq}. Try remembering pieces in groups — for example the king and the pieces near it — instead of one square at a time.`,
      },
    };
  },
};

// -- mem.missing: which piece was removed? -------------------------------------
const missing: FamilyDef = {
  id: "mem.missing",
  category: "memory",
  label: "What is missing?",
  skill: "Notice exactly which piece has disappeared",
  classify: (p) => {
    if (b6(p) !== 1) return null;
    const game = new Chess(p.fen);
    return uniquePieces(game).length >= 1 && boardMap(game).size >= 6 ? crowd(boardMap(game).size) : null;
  },
  build: ({ key, level, puzzle }) => {
    if (!puzzle) return null;
    const game = new Chess(puzzle.fen);
    const unique = uniquePieces(game);
    const chosen = seededPick(unique, 1, `mem.missing:${key}`)[0];
    if (!chosen) return null;
    const [sq, piece] = chosen;
    const after = new Chess(puzzle.fen);
    after.remove(sq);
    const present = [...new Set([...boardMap(after).values()].filter((p) => p.type !== "k").map((p) => pieceLabel(p.type, p.color)))];
    const answer = pieceLabel(piece.type, piece.color);
    const set = makeChoiceSet(answer, present.filter((x) => x !== answer), `mem.missing:${key}`);
    if (!set) return null;
    return {
      kind: "choice",
      id: exerciseId("mem.missing", key),
      category: "memory",
      family: "mem.missing",
      familyLabel: "What is missing?",
      level,
      skill: "Notice exactly which piece has disappeared",
      orientation: game.turn(),
      fen: puzzle.fen,
      blind: { showSeconds: SHOW_SECONDS[level], questionFen: after.fen() },
      prompt: "The position is back — but one piece has been removed. Which piece is missing?",
      choices: set.choices,
      correctIndex: set.correctIndex,
      explanation: {
        correct: `Correct — the ${answer.toLowerCase()} on ${sq} is gone. Comparing piece by piece (queens and rooks first) is the fastest way to find what changed.`,
        incorrect: `The missing piece is the ${answer.toLowerCase()} that stood on ${sq}. Compare the army piece type by piece type — queens, rooks, bishops, knights, then pawns.`,
      },
    };
  },
};

// -- mem.moved: what changed after the moves? -----------------------------------
const moved: FamilyDef = {
  id: "mem.moved",
  category: "memory",
  label: "What changed?",
  skill: "Compare a remembered position with the new one",
  classify: (p) => {
    if (b6(p) !== 2) return null;
    return (p.solution.length === 1 ? 2 : p.solution.length === 3 ? 3 : 4) as Level;
  },
  build: ({ key, level, puzzle }) => {
    const ctx = puzzle && buildContext(puzzle);
    if (!ctx) return null;
    // 1 ply: the learner's move. 3 plies: Black's reply (ply 1). 5 plies: the 2nd learner move (ply 2).
    const idx = ctx.moves.length === 1 ? 0 : ctx.moves.length === 3 ? 1 : 2;
    const plies = idx + 1;
    const m = ctx.moves[idx];
    const side: Color = m.color;
    const questionFen = ctx.fens[plies];
    const board = boardMap(new Chess(questionFen));
    const present = [...new Set([...board.values()].filter((p) => p.color === side && p.type !== "k").map((p) => pieceLabel(p.type, p.color)))];
    const answer = pieceLabel(m.piece, side);
    if (m.piece === "k") return null;
    const set = makeChoiceSet(answer, present.filter((x) => x !== answer), `mem.moved:${key}`);
    if (!set) return null;
    const which =
      ctx.moves.length === 1 ? "A move was played" : ctx.moves.length === 3 ? `${sideWord(ctx.player)} moved and ${sideWord(side)} replied` : `${plies} moves were played`;
    const askWhat =
      ctx.moves.length === 1
        ? `${sideWord(side)} made a move. Which piece moved?`
        : ctx.moves.length === 3
        ? `${sideWord(side)} replied. Which ${sideWord(side)} piece moved?`
        : `Which ${sideWord(side)} piece made ${sideWord(side)}'s second move?`;
    return {
      kind: "choice",
      id: exerciseId("mem.moved", key),
      category: "memory",
      family: "mem.moved",
      familyLabel: "What changed?",
      level,
      skill: "Compare a remembered position with the new one",
      orientation: ctx.player,
      fen: ctx.fens[0],
      blind: { showSeconds: SHOW_SECONDS[level], questionFen },
      prompt: `${which}. ${askWhat}`,
      choices: set.choices,
      correctIndex: set.correctIndex,
      explanation: {
        correct: `Correct — it was the ${answer.toLowerCase()}: ${m.san}, from ${m.from} to ${m.to}. Spotting what changed between two positions is the heart of chess memory.`,
        incorrect: `It was the ${answer.toLowerCase()}: ${m.san}, from ${m.from} to ${m.to}. Compare the two boards square by square — the vacated square and the new square tell you which piece moved.`,
      },
    };
  },
};

// -- mem.relation: which piece was undefended? ----------------------------------
function relationSet(game: Chess, seed: string) {
  const board = boardMap(game);
  const color = game.turn();
  const mine = [...board.entries()].filter(([, p]) => p.color === color && p.type !== "k");
  if (mine.length < 4) return null;
  const undefended = mine.filter(([sq]) => attackersOf(board, sq as Square, color).length === 0);
  const defended = mine.filter(([sq]) => attackersOf(board, sq as Square, color).length > 0);
  if (undefended.length !== 1 || defended.length < 3) return null;
  return { undefended: undefended[0], defended: seededPick(defended, 3, seed), color };
}

const relation: FamilyDef = {
  id: "mem.relation",
  category: "memory",
  label: "Who was protected?",
  skill: "Remember which pieces defend each other",
  classify: (p) => {
    if (b6(p) !== 3) return null;
    const game = new Chess(p.fen);
    return relationSet(game, p.id) ? (Math.max(3, Math.min(4, ratingToLevel(p.rating))) as Level) : null;
  },
  build: ({ key, level, puzzle }) => {
    if (!puzzle) return null;
    const game = new Chess(puzzle.fen);
    const r = relationSet(game, `mem.relation:${key}`);
    if (!r) return null;
    const label = ([sq, p]: [Square, { type: PieceSymbol; color: Color }]) => `${capitalise(PIECE_WORD[p.type])} on ${sq}`;
    const set = makeChoiceSet(label(r.undefended), r.defended.map(label), `mem.relation:${key}`);
    if (!set) return null;
    return {
      kind: "choice",
      id: exerciseId("mem.relation", key),
      category: "memory",
      family: "mem.relation",
      familyLabel: "Who was protected?",
      level,
      skill: "Remember which pieces defend each other",
      orientation: r.color,
      fen: puzzle.fen,
      blind: { showSeconds: SHOW_SECONDS[level] },
      prompt: `Looking at ${sideWord(r.color)}'s pieces: which of these had NO defender?`,
      choices: set.choices,
      correctIndex: set.correctIndex,
      explanation: {
        correct: `Correct — the ${label(r.undefended).toLowerCase()} was undefended; the other three were each protected by a friendly piece.`,
        incorrect: `The ${label(r.undefended).toLowerCase()} had no defender; the others were each protected. When you memorise a position, note who protects whom — loose pieces are where tactics happen.`,
      },
    };
  },
};

// -- mem.hanging: tactical information memory -----------------------------------
const hanging: FamilyDef = {
  id: "mem.hanging",
  category: "memory",
  label: "Spot it from memory",
  skill: "Recall the loose piece after the board is hidden",
  signature: "loose-piece",
  classify: (p) => {
    if (b6(p) !== 4) return null;
    if (!hangingFacts(p.fen)) return null;
    const n = pieceCount(boardMap(new Chess(p.fen)));
    return (n <= 14 ? 4 : 5) as Level;
  },
  build: ({ key, level, puzzle }) => {
    if (!puzzle) return null;
    const facts = hangingFacts(puzzle.fen);
    if (!facts) return null;
    const game = new Chess(puzzle.fen);
    const board = boardMap(game);
    const target = board.get(facts.hanging)!;
    const others = facts.enemyPieces.filter((x) => x !== facts.hanging);
    const label = (sq: Square) => `${capitalise(PIECE_WORD[board.get(sq)!.type])} on ${sq}`;
    const set = makeChoiceSet(label(facts.hanging), seededPick(others, 3, `mem.hanging:${key}`).map(label), `mem.hanging:${key}`);
    if (!set) return null;
    const mover = game.turn();
    return {
      kind: "choice",
      id: exerciseId("mem.hanging", key),
      category: "memory",
      family: "mem.hanging",
      familyLabel: "Spot it from memory",
      level,
      skill: "Recall the loose piece after the board is hidden",
      orientation: mover,
      fen: puzzle.fen,
      blind: { showSeconds: SHOW_SECONDS[level] },
      prompt: `${sideWord(mover)} to move. Which enemy piece was attacked and undefended?`,
      choices: set.choices,
      correctIndex: set.correctIndex,
      explanation: {
        correct: `Correct — the ${pieceName(target.type, target.color).toLowerCase()} on ${facts.hanging} could be captured for free.`,
        incorrect: `The loose piece was the ${pieceName(target.type, target.color).toLowerCase()} on ${facts.hanging}: attacked by a ${sideWord(mover)} piece and defended by nothing. Strong players remember attacked-and-undefended pieces first.`,
      },
    };
  },
};

// -- mem.sequence: remember a move sequence -------------------------------------
const sequence: FamilyDef = {
  id: "mem.sequence",
  category: "memory",
  label: "Remember the moves",
  skill: "Hold a short sequence of moves in memory",
  classify: (p) => (b6(p) === 5 && p.solution.length >= 3 ? ((p.solution.length === 3 ? 4 : 5) as Level) : null),
  build: ({ key, level, puzzle }) => {
    const ctx = puzzle && buildContext(puzzle);
    if (!ctx) return null;
    const n = ctx.moves.length;
    const idx = n === 3 ? 1 : 2; // the reply for 3 plies, the learner's 2nd move for 5
    const target = ctx.moves[idx];
    const start = new Chess(ctx.fens[idx]);
    const decoys = temptingMoves(start, target, 3);
    const set = makeChoiceSet(target.san, decoys.map((d) => d.san), `mem.sequence:${key}`);
    if (!set) return null;
    const ordinal = idx === 1 ? "second" : "third";
    return {
      kind: "choice",
      id: exerciseId("mem.sequence", key),
      category: "memory",
      family: "mem.sequence",
      familyLabel: "Remember the moves",
      level,
      skill: "Hold a short sequence of moves in memory",
      orientation: ctx.player,
      fen: ctx.fens[0],
      blind: { showSeconds: SHOW_SECONDS[level] + 2, revealNote: `Remember: ${lineText(ctx)}` },
      prompt: `You saw a sequence of ${n} moves. What was the ${ordinal} move?`,
      choices: set.choices,
      correctIndex: set.correctIndex,
      explanation: {
        correct: `Correct — the ${ordinal} move was ${target.san}. The full sequence was ${lineText(ctx)}. Linking moves into a story (why each follows the last) makes them stick.`,
        incorrect: `The ${ordinal} move was ${target.san}; the sequence was ${lineText(ctx)}. Remember moves as a story — each move is a reply to the one before.`,
      },
    };
  },
};

export const MEMORY_FAMILIES: FamilyDef[] = [where, missing, moved, relation, hanging, sequence];

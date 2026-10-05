import { Chess, type Square } from "chess.js";
import { fnv1a } from "../../exerciseIds";
import { ratingToLevel, type Level, type MoveStep, type TrainExercise } from "../../curriculum";
import { PATTERN_CHALLENGES } from "@/content/chessMindPatterns";
import { moveWasFork, moveWasHanging } from "@/lib/chessMind/patternVerification";
import { attackersOf, boardMap, pieceCount, pieceName, valueOf } from "../geometry";
import { makeChoiceSet, seededPick } from "../rng";
import { MOTIF_TEACHING, buildContext, lineText, motifsOf, outcomePhrase, primaryMotif, sideWord } from "../puzzleContext";
import { exerciseId, type FamilyDef } from "./types";

/**
 * PATTERN RECOGNITION — recognising the SHAPE of a tactic, from "this piece is
 * simply hanging" up to telling a pin from a skewer from an x-ray. Motif labels
 * come from the Lichess themes carried by the tactics library; "hanging piece"
 * questions are computed from the real board.
 */

const bucket = (p: { id: string }) => parseInt(fnv1a(p.id), 36) % 3;

/** Lowest level at which a motif is sensible to ask about. */
const MOTIF_MIN_LEVEL: Record<string, Level> = {
  fork: 1, pin: 1, hangingPiece: 1, backRankMate: 1,
  skewer: 2, discoveredAttack: 2, trappedPiece: 2, doubleCheck: 2,
  discoveredCheck: 3, deflection: 3, attraction: 3, capturingDefender: 3, smotheredMate: 3,
  xRayAttack: 4, interference: 4, clearance: 4, quietMove: 4, intermezzo: 4, anastasiaMate: 4, arabianMate: 4,
  zugzwang: 5,
};

/** Motifs that look alike — used to build harder, genuinely confusable choices. */
const SIMILAR_GROUPS: string[][] = [
  ["fork", "pin", "skewer", "xRayAttack", "discoveredAttack", "doubleCheck", "discoveredCheck"],
  ["deflection", "attraction", "capturingDefender", "clearance", "interference", "intermezzo"],
  ["backRankMate", "smotheredMate", "anastasiaMate", "arabianMate"],
];

function motifLevel(motif: string, rating: number): Level {
  return Math.min(5, Math.max(MOTIF_MIN_LEVEL[motif] ?? 3, ratingToLevel(rating))) as Level;
}

function distractorMotifs(motif: string, themes: readonly string[], level: Level, seed: string): string[] {
  const all = Object.keys(MOTIF_MIN_LEVEL).filter((m) => m !== motif && !themes.includes(m));
  const group = SIMILAR_GROUPS.find((g) => g.includes(motif)) ?? [];
  const similar = group.filter((m) => all.includes(m));
  const easy = all.filter((m) => (MOTIF_MIN_LEVEL[m] ?? 3) <= Math.max(2, level));
  // Higher levels draw first from confusable motifs; lower levels from simple ones.
  const pool = level >= 3 ? [...similar, ...seededPick(easy.filter((m) => !similar.includes(m)), 6, seed)] : seededPick(easy, 6, seed);
  return pool.map((m) => MOTIF_TEACHING[m]?.label).filter(Boolean) as string[];
}

// -- pat.name: name the tactical idea --------------------------------------------
const name: FamilyDef = {
  id: "pat.name",
  category: "pattern",
  label: "Name the tactic",
  skill: "Recognise which tactical idea decides the position",
  signature: "name-motif",
  classify: (p) => {
    const m = primaryMotif(p);
    return m && MOTIF_MIN_LEVEL[m] && !/Mate$/.test(m) && bucket(p) === 0 ? motifLevel(m, p.rating) : null;
  },
  build: ({ key, level, puzzle }) => {
    const ctx = puzzle && buildContext(puzzle);
    const motif = puzzle && primaryMotif(puzzle);
    if (!ctx || !puzzle || !motif) return null;
    const label = MOTIF_TEACHING[motif].label;
    const set = makeChoiceSet(label, distractorMotifs(motif, puzzle.themes, level, `pat.name:${key}`), `pat.name:${key}`);
    if (!set) return null;
    const first = ctx.moves[0].san;
    const prompt =
      level <= 3
        ? `${sideWord(ctx.player)} has a winning line that starts with ${first}. Which tactical idea is at work in it?`
        : `${sideWord(ctx.player)} to move. Before you choose a move: which tactical idea decides this position?`;
    return {
      kind: "choice",
      id: exerciseId("pat.name", key),
      category: "pattern",
      family: "pat.name",
      familyLabel: "Name the tactic",
      level,
      skill: "Recognise which tactical idea decides the position",
      orientation: ctx.player,
      fen: ctx.fens[0],
      prompt,
      choices: set.choices,
      correctIndex: set.correctIndex,
      explanation: {
        correct: `Correct — a ${label.toLowerCase()}: ${MOTIF_TEACHING[motif].idea} The winning line was ${lineText(ctx)}, which ${outcomePhrase(ctx)}.`,
        incorrect: `This is a ${label.toLowerCase()}: ${MOTIF_TEACHING[motif].idea} The winning line was ${lineText(ctx)}, which ${outcomePhrase(ctx)}. Name the idea first, then the move becomes easy to find.`,
      },
    };
  },
};

// -- pat.mate: name the mating pattern -------------------------------------------
const MATE_LABELS = ["backRankMate", "smotheredMate", "anastasiaMate", "arabianMate"];
const mate: FamilyDef = {
  id: "pat.mate",
  category: "pattern",
  label: "Mating patterns",
  skill: "Recognise classic checkmate shapes",
  classify: (p) => {
    const m = MATE_LABELS.find((x) => p.themes.includes(x));
    return m && p.solution.length <= 5 ? motifLevel(m, p.rating) : null;
  },
  build: ({ key, level, puzzle }) => {
    const ctx = puzzle && buildContext(puzzle);
    const motif = puzzle && MATE_LABELS.find((x) => puzzle.themes.includes(x));
    if (!ctx || !puzzle || !motif) return null;
    const label = MOTIF_TEACHING[motif].label;
    const distract = MATE_LABELS.filter((m) => m !== motif && !puzzle.themes.includes(m)).map((m) => MOTIF_TEACHING[m].label);
    distract.push("Ladder mate", "Boden's mate");
    const set = makeChoiceSet(label, [...new Set(distract)].filter((d) => d !== label), `pat.mate:${key}`);
    if (!set) return null;
    return {
      kind: "choice",
      id: exerciseId("pat.mate", key),
      category: "pattern",
      family: "pat.mate",
      familyLabel: "Mating patterns",
      level,
      skill: "Recognise classic checkmate shapes",
      orientation: ctx.player,
      fen: ctx.fens[0],
      prompt: `${sideWord(ctx.player)} to move and has a forced win. Which mating pattern is on the board?`,
      choices: set.choices,
      correctIndex: set.correctIndex,
      explanation: {
        correct: `Correct — ${label}: ${MOTIF_TEACHING[motif].idea} The line is ${lineText(ctx)}.`,
        incorrect: `This is ${label}: ${MOTIF_TEACHING[motif].idea} The line is ${lineText(ctx)}. Learn the shape and you will spot it in real games.`,
      },
    };
  },
};

// -- pat.find: find the named tactic ---------------------------------------------
const find: FamilyDef = {
  id: "pat.find",
  category: "pattern",
  label: "Find the tactic",
  skill: "Use a named pattern to find the winning move",
  classify: (p) => {
    const m = primaryMotif(p);
    return m && MOTIF_MIN_LEVEL[m] && !/Mate$/.test(m) && p.solution.length <= 3 && bucket(p) === 1 ? motifLevel(m, p.rating) : null;
  },
  build: ({ key, level, puzzle }) => {
    const ctx = puzzle && buildContext(puzzle);
    const motif = puzzle && primaryMotif(puzzle);
    if (!ctx || !puzzle || !motif) return null;
    const t = MOTIF_TEACHING[motif];
    const m = ctx.moves[0];
    const step: MoveStep = { from: m.from, to: m.to, ...(m.promotion ? { promotion: m.promotion } : {}) };
    return {
      kind: "move",
      id: exerciseId("pat.find", key),
      category: "pattern",
      family: "pat.find",
      familyLabel: "Find the tactic",
      level,
      skill: "Use a named pattern to find the winning move",
      orientation: ctx.player,
      fen: ctx.fens[0],
      prompt: `${sideWord(ctx.player)} to move. There is a ${t.label.toLowerCase()} in this position — find the first move of the winning line.`,
      steps: [step],
      finalStepAcceptsAnyMate: puzzle.solution.length === 1 && puzzle.themes.includes("mateIn1"),
      explanation: {
        correct: `Correct — ${m.san}. ${t.label}: ${t.idea} The full line is ${lineText(ctx)}.`,
        incorrect: `The move was ${m.san}. ${t.label}: ${t.idea} The full line is ${lineText(ctx)}. Look for the targets first — the move follows from them.`,
      },
    };
  },
};

// -- pat.hanging: which piece is undefended? (computed) --------------------------
interface HangingFacts {
  hanging: Square;
  enemyPieces: Square[];
}

export function hangingFacts(fen: string): HangingFacts | null {
  const game = new Chess(fen);
  const mover = game.turn();
  const enemy = mover === "w" ? "b" : "w";
  const board = boardMap(game);
  const enemyPieces = [...board.entries()].filter(([, p]) => p.color === enemy && p.type !== "k").map(([sq]) => sq);
  if (enemyPieces.length < 4) return null;
  if (game.inCheck()) return null;
  const legalCaptureSquares = new Set(game.moves({ verbose: true }).filter((m) => m.captured).map((m) => m.to));
  // Attacked, undefended, and genuinely capturable with a legal move.
  const hanging = enemyPieces.filter(
    (sq) => legalCaptureSquares.has(sq) && attackersOf(board, sq, enemy).length === 0
  );
  const nonPawnHanging = hanging.filter((sq) => board.get(sq)!.type !== "p");
  // Exactly one clearly-hanging piece, so the answer is unambiguous.
  if (hanging.length !== 1 || nonPawnHanging.length !== 1) return null;
  return { hanging: hanging[0], enemyPieces };
}

const hanging: FamilyDef = {
  id: "pat.hanging",
  category: "pattern",
  label: "Spot the loose piece",
  skill: "See which enemy piece is attacked and undefended",
  signature: "loose-piece",
  classify: (p) => {
    if (bucket(p) !== 2 || p.solution.length < 3) return null;
    // Mating-pattern puzzles belong to pat.mate; one puzzle, one family per category.
    if (MATE_LABELS.some((m) => p.themes.includes(m))) return null;
    const facts = hangingFacts(p.fen);
    if (!facts) return null;
    const n = pieceCount(boardMap(new Chess(p.fen)));
    return (n <= 10 ? 1 : n <= 16 ? 2 : n <= 22 ? 3 : 4) as Level;
  },
  build: ({ key, level, puzzle }) => {
    if (!puzzle) return null;
    const facts = hangingFacts(puzzle.fen);
    if (!facts) return null;
    const game = new Chess(puzzle.fen);
    const board = boardMap(game);
    const mover = game.turn();
    const target = board.get(facts.hanging)!;
    const others = facts.enemyPieces.filter((sq) => sq !== facts.hanging);
    const picked = seededPick(others, 3, `pat.hanging:${key}`);
    const set = makeChoiceSet(facts.hanging, picked, `pat.hanging:${key}`);
    if (!set) return null;
    const attackerSq = attackersOf(board, facts.hanging, mover)[0];
    const attacker = board.get(attackerSq)!;
    return {
      kind: "choice",
      id: exerciseId("pat.hanging", key),
      category: "pattern",
      family: "pat.hanging",
      familyLabel: "Spot the loose piece",
      level,
      skill: "See which enemy piece is attacked and undefended",
      orientation: mover,
      fen: puzzle.fen,
      prompt: `${sideWord(mover)} to move. Which enemy piece is attacked and has no defender?`,
      choices: set.choices,
      correctIndex: set.correctIndex,
      explanation: {
        correct: `Correct — the ${pieceName(target.type, target.color).toLowerCase()} on ${facts.hanging} is attacked by the ${pieceName(attacker.type, attacker.color).toLowerCase()} on ${attackerSq} and nothing protects it. Always check "attacked and undefended" first.`,
        incorrect: `The loose piece is the ${pieceName(target.type, target.color).toLowerCase()} on ${facts.hanging}: the ${pieceName(attacker.type, attacker.color).toLowerCase()} on ${attackerSq} attacks it and no piece defends it. Ask of every enemy piece: is it attacked? Is it defended?`,
      },
    };
  },
};

// -- pat.classic: the original hand-verified positions, kept ---------------------
const classic: FamilyDef = {
  id: "pat.classic",
  category: "pattern",
  label: "Core patterns",
  skill: "Forks, pins, checks and loose pieces in clean positions",
  statics: () => PATTERN_CHALLENGES.map((c) => ({ key: c.id, level: 1 as Level })),
  build: ({ key, level }) => {
    const c = PATTERN_CHALLENGES.find((x) => x.id === key);
    if (!c) return null;
    const game = new Chess(c.fen);
    const mover = game.turn();
    const base = {
      id: exerciseId("pat.classic", key),
      category: "pattern" as const,
      family: "pat.classic",
      familyLabel: "Core patterns",
      level,
      skill: "Forks, pins, checks and loose pieces in clean positions",
      orientation: mover,
      fen: c.fen,
      prompt: c.prompt,
      explanation: { correct: `Exactly right! ${c.explanation}`, incorrect: `Not quite — ${c.explanation}` },
    };
    if (c.type === "pin") {
      const choices = c.pinChoices ?? [];
      const correctIndex = choices.indexOf(c.targetSquare ?? "");
      if (correctIndex < 0) return null;
      return { ...base, kind: "choice", choices, correctIndex, highlight: [] } satisfies TrainExercise;
    }
    const legal = game.moves({ verbose: true });
    const main = legal.find((m) => m.san === c.correctSan);
    if (!main) return null;
    const fits = (m: (typeof legal)[number]): boolean => {
      if (c.type === "fork") return moveWasFork(c.fen, m.from, m.to);
      if (c.type === "hanging") return moveWasHanging(c.fen, m.from, m.to);
      if (c.type === "check") return /\+$/.test(m.san);
      if (c.type === "checkmate") return /#$/.test(m.san);
      return false;
    };
    const alts = legal
      .filter((m) => fits(m) && !(m.from === main.from && m.to === main.to))
      .map((m) => ({ from: m.from, to: m.to, ...(m.promotion ? { promotion: m.promotion } : {}) }));
    return {
      ...base,
      kind: "move",
      steps: [{ from: main.from, to: main.to, ...(main.promotion ? { promotion: main.promotion } : {}), ...(alts.length ? { alts } : {}) }],
      finalStepAcceptsAnyMate: c.type === "checkmate",
    } satisfies TrainExercise;
  },
};

export const PATTERN_FAMILIES: FamilyDef[] = [classic, hanging, find, name, mate];
export { motifsOf, valueOf };

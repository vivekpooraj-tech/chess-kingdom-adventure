import { Chess, type Move } from "chess.js";
import { fnv1a } from "../../exerciseIds";
import { ratingToLevel, type Level, type MoveStep, type TrainExercise } from "../../curriculum";
import { CALCULATION_CHALLENGES } from "@/content/chessMindCalculation";
import { valueOf } from "../geometry";
import { makeChoiceSet } from "../rng";
import {
  MOTIF_TEACHING,
  buildContext,
  lineText,
  outcomePhrase,
  primaryMotif,
  sideWord,
  type PuzzleContext,
} from "../puzzleContext";
import { exerciseId, type FamilyDef } from "./types";

/**
 * CALCULATION — teaches a calculation PROCESS, not just "find the move":
 * list checks/captures/threats, predict the reply, compare candidates, then
 * hold a line in the head. Difficulty is line length and the number of live
 * candidate ideas, never a timer.
 *
 * Library convention: every puzzle's first move is the learner's; the library
 * (Lichess-derived) guarantees the winning line, so "the move that works" is a
 * verified fact rather than an opinion.
 */

const bucket = (p: { id: string }) => parseInt(fnv1a(p.id), 36) % 3;
const isMatePuzzle = (themes: readonly string[]) =>
  themes.includes("mateIn1") || themes.includes("mateIn2") || themes.includes("mateIn3");

function uciStep(m: Move, reply?: Move): MoveStep {
  return {
    from: m.from,
    to: m.to,
    ...(m.promotion ? { promotion: m.promotion } : {}),
    ...(reply ? { reply: { from: reply.from, to: reply.to, ...(reply.promotion ? { promotion: reply.promotion } : {}) } } : {}),
  };
}

function stepsOf(ctx: PuzzleContext): MoveStep[] {
  const steps: MoveStep[] = [];
  for (let i = 0; i < ctx.moves.length; i += 2) steps.push(uciStep(ctx.moves[i], ctx.moves[i + 1]));
  return steps;
}

function motifLine(ctx: PuzzleContext): string {
  const m = primaryMotif(ctx.puzzle);
  if (!m) return "";
  const t = MOTIF_TEACHING[m];
  return t ? ` The key idea is a ${t.label.toLowerCase()}: ${t.idea}` : "";
}

/** Legal moves other than the solution, ordered by how tempting they look
 *  (checks first, then big captures) so decoys are genuinely plausible. */
export function temptingMoves(game: Chess, exclude: Move, n: number): Move[] {
  const scored = game
    .moves({ verbose: true })
    .filter((m) => !(m.from === exclude.from && m.to === exclude.to && m.promotion === exclude.promotion))
    .map((m) => ({
      m,
      score: (/[+#]$/.test(m.san) ? 100 : 0) + (m.captured ? 10 + valueOf(m.captured) : 0),
    }));
  scored.sort((a, b) => b.score - a.score || a.m.san.localeCompare(b.m.san));
  return scored.slice(0, n).map((s) => s.m);
}

function hint(level: Level): string {
  return level <= 2 ? " Look at every check, capture and threat first." : "";
}

// -- calc.find: one forcing move -------------------------------------------------
const find: FamilyDef = {
  id: "calc.find",
  category: "calculation",
  label: "Find the forcing move",
  skill: "Scan checks, captures and threats before you move",
  classify: (p) => (p.solution.length === 1 ? (Math.min(3, ratingToLevel(p.rating)) as Level) : null),
  build: ({ key, level, puzzle }) => {
    const ctx = puzzle && buildContext(puzzle);
    if (!ctx) return null;
    const m = ctx.moves[0];
    return {
      kind: "move",
      id: exerciseId("calc.find", key),
      category: "calculation",
      family: "calc.find",
      familyLabel: "Find the forcing move",
      level,
      skill: "Scan checks, captures and threats before you move",
      orientation: ctx.player,
      fen: ctx.fens[0],
      prompt: `${sideWord(ctx.player)} to move. Find the strongest move.${hint(level)}`,
      steps: [uciStep(m)],
      finalStepAcceptsAnyMate: puzzle!.themes.includes("mateIn1"),
      explanation: {
        correct: `Correct — ${m.san} ${outcomePhrase(ctx)}.${motifLine(ctx)}`,
        incorrect: `The strongest move was ${m.san}, which ${outcomePhrase(ctx)}.${motifLine(ctx)} Next time list every check and capture, then ask what each one achieves.`,
      },
    };
  },
};

// -- calc.line2 / calc.line3: hold a forced line ---------------------------------
function lineFamily(id: "calc.line2" | "calc.line3", plies: 3 | 5): FamilyDef {
  const minLevel: Level = plies === 3 ? 2 : 3;
  const label = plies === 3 ? "Two-move line" : "Three-move line";
  const skill = plies === 3 ? "Calculate your move AND the opponent's reply" : "Hold a three-move forcing line in your head";
  return {
    id,
    category: "calculation",
    label,
    skill,
    classify: (p) =>
      p.solution.length === plies && !isMatePuzzle(p.themes) && bucket(p) === 0
        ? (Math.max(minLevel, ratingToLevel(p.rating)) as Level)
        : null,
    build: ({ key, level, puzzle }) => {
      const ctx = puzzle && buildContext(puzzle);
      if (!ctx) return null;
      const n = Math.ceil(plies / 2);
      return {
        kind: "move",
        id: exerciseId(id, key),
        category: "calculation",
        family: id,
        familyLabel: label,
        level,
        skill,
        orientation: ctx.player,
        fen: ctx.fens[0],
        prompt: `${sideWord(ctx.player)} to move and has a forcing line of ${n} moves. Play it — expect the opponent's best reply after each move.`,
        steps: stepsOf(ctx),
        finalStepAcceptsAnyMate: false,
        explanation: {
          correct: `Correct. The line was ${lineText(ctx)}, and it ${outcomePhrase(ctx)}.${motifLine(ctx)} The key moment was seeing the reply before committing to the first move.`,
          incorrect: `The line that works is ${lineText(ctx)} — it ${outcomePhrase(ctx)}.${motifLine(ctx)} Try to predict the opponent's best reply BEFORE you play your first move.`,
        },
      };
    },
  };
}

// -- calc.mate: forced mate ------------------------------------------------------
const mate: FamilyDef = {
  id: "calc.mate",
  category: "calculation",
  label: "Forced mate",
  skill: "Calculate a forced checkmate move by move",
  classify: (p) => {
    const n = p.themes.includes("mateIn1") ? 1 : p.themes.includes("mateIn2") ? 2 : p.themes.includes("mateIn3") ? 3 : 0;
    // Mate-in-1 puzzles live in calc.find; this family is the multi-move mates.
    if (n < 2 || p.solution.length !== n * 2 - 1) return null;
    const lvl = ratingToLevel(p.rating);
    const clamped = n === 2 ? Math.min(4, Math.max(2, lvl)) : Math.max(3, lvl);
    return clamped as Level;
  },
  build: ({ key, level, puzzle }) => {
    const ctx = puzzle && buildContext(puzzle);
    if (!ctx) return null;
    const n = Math.ceil(ctx.moves.length / 2);
    if (!new Chess(ctx.fens[ctx.moves.length]).isCheckmate()) return null;
    return {
      kind: "move",
      id: exerciseId("calc.mate", key),
      category: "calculation",
      family: "calc.mate",
      familyLabel: "Forced mate",
      level,
      skill: "Calculate a forced checkmate move by move",
      orientation: ctx.player,
      fen: ctx.fens[0],
      prompt: `${sideWord(ctx.player)} to move and mates in ${n}. Find the forcing sequence.`,
      steps: stepsOf(ctx),
      finalStepAcceptsAnyMate: true,
      explanation: {
        correct: `Checkmate. The mating line was ${lineText(ctx)}.${motifLine(ctx)} Forcing moves (checks) leave the opponent few replies, which is what makes a mate calculable.`,
        incorrect: `The mating line was ${lineText(ctx)}.${motifLine(ctx)} When you look for mate, start with checks — each one limits the opponent's replies.`,
      },
    };
  },
};

// -- calc.candidates: compare candidate first moves ------------------------------
const candidates: FamilyDef = {
  id: "calc.candidates",
  category: "calculation",
  label: "Compare candidate moves",
  skill: "Compare several forcing ideas and pick the one that works",
  signature: "pick-best-move",
  classify: (p) =>
    p.solution.length >= 3 && !isMatePuzzle(p.themes) && bucket(p) === 1
      ? (Math.max(2, ratingToLevel(p.rating)) as Level)
      : null,
  build: ({ key, level, puzzle }) => {
    const ctx = puzzle && buildContext(puzzle);
    if (!ctx) return null;
    const start = new Chess(ctx.fens[0]);
    const decoys = temptingMoves(start, ctx.moves[0], 3);
    const set = makeChoiceSet(ctx.moves[0].san, decoys.map((d) => d.san), `calc.candidates:${key}`);
    if (!set) return null;
    return {
      kind: "choice",
      id: exerciseId("calc.candidates", key),
      category: "calculation",
      family: "calc.candidates",
      familyLabel: "Compare candidate moves",
      level,
      skill: "Compare several forcing ideas and pick the one that works",
      orientation: ctx.player,
      fen: ctx.fens[0],
      prompt: `${sideWord(ctx.player)} to move. Several moves look forcing — which one starts the line that works?`,
      choices: set.choices,
      correctIndex: set.correctIndex,
      explanation: {
        correct: `Correct — ${ctx.moves[0].san} starts the line ${lineText(ctx)}, which ${outcomePhrase(ctx)}.${motifLine(ctx)}`,
        incorrect: `${ctx.moves[0].san} is the move that works: the line ${lineText(ctx)} ${outcomePhrase(ctx)}.${motifLine(ctx)} The other candidates are forcing-looking but do not win by force — calculate the reply to each before choosing.`,
      },
    };
  },
};

// -- calc.finish: calculate without moving pieces -------------------------------
const finish: FamilyDef = {
  id: "calc.finish",
  category: "calculation",
  label: "Calculate the finish",
  skill: "Play a line in your head and find the finishing move",
  classify: (p) =>
    p.solution.length >= 3 && !isMatePuzzle(p.themes) && bucket(p) === 2
      ? (Math.max(3, ratingToLevel(p.rating)) as Level)
      : null,
  build: ({ key, level, puzzle }) => {
    const ctx = puzzle && buildContext(puzzle);
    if (!ctx) return null;
    const n = ctx.moves.length;
    const last = ctx.moves[n - 1];
    const before = new Chess(ctx.fens[n - 1]);
    const decoys = temptingMoves(before, last, 3);
    const set = makeChoiceSet(last.san, decoys.map((d) => d.san), `calc.finish:${key}`);
    if (!set) return null;
    return {
      kind: "choice",
      id: exerciseId("calc.finish", key),
      category: "calculation",
      family: "calc.finish",
      familyLabel: "Calculate the finish",
      level,
      skill: "Play a line in your head and find the finishing move",
      orientation: ctx.player,
      fen: ctx.fens[0],
      prompt: `${sideWord(ctx.player)} plays ${lineText(ctx, n - 1)}. Without moving the pieces — what is the finishing move?`,
      choices: set.choices,
      correctIndex: set.correctIndex,
      ...(level >= 4 ? { blind: { showSeconds: 8 } } : {}),
      explanation: {
        correct: `Correct. After ${lineText(ctx, n - 1)}, ${last.san} finishes the combination and it ${outcomePhrase(ctx)}.${motifLine(ctx)}`,
        incorrect: `The finishing move was ${last.san}: the full line is ${lineText(ctx)}, and it ${outcomePhrase(ctx)}.${motifLine(ctx)} Replay each move in your head and picture the board before choosing.`,
      },
    };
  },
};

// -- calc.classic: the original hand-verified positions, kept -------------------
const CLASSIC_LEVEL: Record<number, Level> = { 1: 1, 2: 2, 3: 2, 4: 3, 5: 4, 6: 3, 7: 4 };

const classic: FamilyDef = {
  id: "calc.classic",
  category: "calculation",
  label: "Guided calculation",
  skill: "Step-by-step calculation with a coach's explanation",
  statics: () => CALCULATION_CHALLENGES.map((c) => ({ key: c.id, level: CLASSIC_LEVEL[c.level] ?? 2 })),
  build: ({ key, level }) => {
    const c = CALCULATION_CHALLENGES.find((x) => x.id === key);
    if (!c) return null;
    const base = {
      id: exerciseId("calc.classic", key),
      category: "calculation" as const,
      family: "calc.classic",
      familyLabel: "Guided calculation",
      level,
      skill: "Step-by-step calculation with a coach's explanation",
      orientation: c.sideToMove,
      fen: c.fen,
      prompt: c.prompt,
      explanation: { correct: `${c.successMessage} ${c.explanation}`.trim(), incorrect: `${c.failureMessage} ${c.explanation}`.trim() },
    };
    if (c.kind === "sequence") {
      const steps: MoveStep[] = c.steps.map((s) => ({
        from: s.from,
        to: s.to,
        ...(s.opponentReplyFrom && s.opponentReplyTo ? { reply: { from: s.opponentReplyFrom, to: s.opponentReplyTo } } : {}),
      }));
      return { ...base, kind: "move", steps, finalStepAcceptsAnyMate: false } satisfies TrainExercise;
    }
    const game = new Chess(c.fen);
    const labelOf = (o: { from: string; to: string }) =>
      game.moves({ verbose: true }).find((m) => m.from === o.from && m.to === o.to)?.san ?? `${o.from}-${o.to}`;
    const sans = c.options.map((o) => labelOf(o));
    const correct = c.options.findIndex((o) => o.isBest);
    if (correct < 0 || new Set(sans).size !== sans.length) return null;
    return { ...base, kind: "choice", choices: sans, correctIndex: correct } satisfies TrainExercise;
  },
};

export const CALCULATION_FAMILIES: FamilyDef[] = [
  classic,
  find,
  lineFamily("calc.line2", 3),
  mate,
  candidates,
  lineFamily("calc.line3", 5),
  finish,
];

import { Chess, type Move } from "chess.js";
import { fnv1a } from "../../exerciseIds";
import { ratingToLevel, type ChoiceExercise, type Level } from "../../curriculum";
import { PIECE_WORD, attackersOf, boardMap, capitalise, pieceCount, valueOf } from "../geometry";
import { makeChoiceSet, seededPick } from "../rng";
import { MOTIF_TEACHING, buildContext, lineText, outcomePhrase, primaryMotif, sideWord } from "../puzzleContext";
import { temptingMoves } from "./calculation";
import { hangingFacts, PATTERN_FAMILIES } from "./pattern";
import { exerciseId, type FamilyDef } from "./types";

/**
 * REACTION — speed AND accuracy. Each mode trains one fast recognition skill. The
 * exercises are the same kind of verified, computed question as everywhere else;
 * what is different is how Reaction measures the answer (accuracy, response time
 * and consistency — a fast wrong answer is never treated as progress).
 *
 * Modes: Tactical flash, Check recognition, Hanging piece, Threat recognition,
 * Pattern flash.
 */

const b5 = (p: { id: string }) => parseInt(fnv1a(p.id), 36) % 5;
const crowd = (fen: string): number => pieceCount(boardMap(new Chess(fen)));

function base(familyId: string, label: string, skill: string, key: string, level: Level, fen: string, orientation: "w" | "b") {
  return {
    kind: "choice" as const,
    id: exerciseId(familyId, key),
    category: "reaction" as const,
    family: familyId,
    familyLabel: label,
    level,
    skill,
    orientation,
    fen,
  };
}

// -- rx.flash: find the winning move, fast ---------------------------------------
const flash: FamilyDef = {
  id: "rx.flash",
  category: "reaction",
  label: "Tactical flash",
  skill: "Spot the winning move at a glance",
  signature: "pick-best-move",
  classify: (p) => (b5(p) === 0 && p.solution.length <= 3 ? ratingToLevel(p.rating) : null),
  build: ({ key, level, puzzle }) => {
    const ctx = puzzle && buildContext(puzzle);
    if (!ctx) return null;
    const decoys = temptingMoves(new Chess(ctx.fens[0]), ctx.moves[0], 3);
    const set = makeChoiceSet(ctx.moves[0].san, decoys.map((d) => d.san), `rx.flash:${key}`);
    if (!set) return null;
    return {
      ...base("rx.flash", "Tactical flash", "Spot the winning move at a glance", key, level, ctx.fens[0], ctx.player),
      prompt: `${sideWord(ctx.player)} to move. Pick the winning move.`,
      choices: set.choices,
      correctIndex: set.correctIndex,
      explanation: {
        correct: `Right move — ${ctx.moves[0].san} starts ${lineText(ctx)}, which ${outcomePhrase(ctx)}.`,
        incorrect: `The move was ${ctx.moves[0].san}: ${lineText(ctx)} ${outcomePhrase(ctx)}. Scan checks and captures first — the winning move is usually among them.`,
      },
    } satisfies ChoiceExercise;
  },
};

// -- rx.check: which move gives check? ---------------------------------------------
function checkSet(game: Chess): { correct: Move; wrong: Move[] } | null {
  if (game.inCheck()) return null;
  const moves = game.moves({ verbose: true });
  const checks = moves.filter((m) => /[+#]$/.test(m.san));
  if (checks.length !== 1) return null;
  const wrong = moves
    .filter((m) => !/[+#]$/.test(m.san))
    .sort((a, b) => (b.captured ? valueOf(b.captured) + 10 : 0) - (a.captured ? valueOf(a.captured) + 10 : 0) || a.san.localeCompare(b.san));
  return wrong.length >= 3 ? { correct: checks[0], wrong } : null;
}

const check: FamilyDef = {
  id: "rx.check",
  category: "reaction",
  label: "Check recognition",
  skill: "See which move gives check",
  classify: (p) => {
    if (b5(p) !== 1) return null;
    const g = new Chess(p.fen);
    return checkSet(g) ? ((crowd(p.fen) <= 12 ? 1 : 2) as Level) : null;
  },
  build: ({ key, level, puzzle }) => {
    if (!puzzle) return null;
    const game = new Chess(puzzle.fen);
    const s = checkSet(game);
    if (!s) return null;
    const set = makeChoiceSet(s.correct.san, s.wrong.slice(0, 6).map((m) => m.san), `rx.check:${key}`);
    if (!set) return null;
    return {
      ...base("rx.check", "Check recognition", "See which move gives check", key, level, puzzle.fen, game.turn()),
      prompt: `${sideWord(game.turn())} to move. Exactly one of these moves gives check — which?`,
      choices: set.choices,
      correctIndex: set.correctIndex,
      explanation: {
        correct: `Correct — ${s.correct.san} is the only move that attacks the king this turn.`,
        incorrect: `${s.correct.san} is the only checking move here. Checks first: look for any piece that can attack the enemy king's square along a line or by a jump.`,
      },
    } satisfies ChoiceExercise;
  },
};

// -- rx.hanging: win the loose piece --------------------------------------------
function hangingMoves(fen: string) {
  const facts = hangingFacts(fen);
  if (!facts) return null;
  const game = new Chess(fen);
  const caps = game.moves({ verbose: true }).filter((m) => m.to === facts.hanging && m.captured);
  if (!caps.length) return null;
  const correct = [...caps].sort((a, b) => valueOf(a.piece) - valueOf(b.piece) || a.san.localeCompare(b.san))[0];
  const wrong = game
    .moves({ verbose: true })
    .filter((m) => m.to !== facts.hanging)
    .sort((a, b) => (b.captured ? valueOf(b.captured) + 10 : 0) - (a.captured ? valueOf(a.captured) + 10 : 0) || a.san.localeCompare(b.san));
  return wrong.length >= 3 ? { correct, wrong, facts } : null;
}

const hanging: FamilyDef = {
  id: "rx.hanging",
  category: "reaction",
  label: "Hanging piece",
  skill: "Take the piece that nobody is protecting",
  signature: "loose-piece",
  classify: (p) => {
    if (b5(p) !== 2 || !hangingMoves(p.fen)) return null;
    const n = crowd(p.fen);
    return (n <= 12 ? 1 : n <= 20 ? 2 : 3) as Level;
  },
  build: ({ key, level, puzzle }) => {
    if (!puzzle) return null;
    const h = hangingMoves(puzzle.fen);
    if (!h) return null;
    const game = new Chess(puzzle.fen);
    const set = makeChoiceSet(h.correct.san, seededPick(h.wrong.slice(0, 8), 3, `rx.hanging:${key}`).map((m) => m.san), `rx.hanging:${key}`);
    if (!set) return null;
    const target = boardMap(game).get(h.facts.hanging)!;
    return {
      ...base("rx.hanging", "Hanging piece", "Take the piece that nobody is protecting", key, level, puzzle.fen, game.turn()),
      prompt: `${sideWord(game.turn())} to move. Which move wins the undefended piece?`,
      choices: set.choices,
      correctIndex: set.correctIndex,
      explanation: {
        correct: `Correct — ${h.correct.san} takes the ${PIECE_WORD[target.type]} on ${h.facts.hanging}, which nothing defended.`,
        incorrect: `${h.correct.san} wins the ${PIECE_WORD[target.type]} on ${h.facts.hanging}: it was attacked and had no defender. Always ask "is anything hanging?" before anything else.`,
      },
    } satisfies ChoiceExercise;
  },
};

// -- rx.threat: which of your pieces is under attack? ------------------------------
function threatFacts(fen: string) {
  const game = new Chess(fen);
  if (game.inCheck()) return null;
  const mover = game.turn();
  const enemy = mover === "w" ? "b" : "w";
  const board = boardMap(game);
  const mine = [...board.entries()].filter(([, p]) => p.color === mover && p.type !== "k");
  const attacked = mine.filter(([sq]) => attackersOf(board, sq, enemy).length > 0);
  const calm = mine.filter(([sq]) => attackersOf(board, sq, enemy).length === 0);
  if (attacked.length !== 1 || calm.length < 3) return null;
  return { attacked: attacked[0], calm, mover, enemy, attackers: attackersOf(board, attacked[0][0], enemy), board };
}

const threat: FamilyDef = {
  id: "rx.threat",
  category: "reaction",
  label: "Threat recognition",
  skill: "Notice which of your pieces is being attacked",
  classify: (p) => {
    if (b5(p) !== 3 || !threatFacts(p.fen)) return null;
    return (Math.max(2, Math.min(4, ratingToLevel(p.rating))) as Level);
  },
  build: ({ key, level, puzzle }) => {
    if (!puzzle) return null;
    const t = threatFacts(puzzle.fen);
    if (!t) return null;
    const label = ([sq, p]: [string, { type: keyof typeof PIECE_WORD }]) => `${capitalise(PIECE_WORD[p.type])} on ${sq}`;
    const set = makeChoiceSet(label(t.attacked as never), seededPick(t.calm, 3, `rx.threat:${key}`).map((c) => label(c as never)), `rx.threat:${key}`);
    if (!set) return null;
    const attacker = t.board.get(t.attackers[0])!;
    return {
      ...base("rx.threat", "Threat recognition", "Notice which of your pieces is being attacked", key, level, puzzle.fen, t.mover),
      prompt: `${sideWord(t.mover)} to move. Exactly one of ${sideWord(t.mover)}'s pieces is under attack. Which?`,
      choices: set.choices,
      correctIndex: set.correctIndex,
      explanation: {
        correct: `Correct — the ${label(t.attacked as never).toLowerCase()} is attacked by the ${PIECE_WORD[attacker.type]} on ${t.attackers[0]}. Checking the opponent's last move for new threats is the first thing strong players do.`,
        incorrect: `The ${label(t.attacked as never).toLowerCase()} is the piece under attack (by the ${PIECE_WORD[attacker.type]} on ${t.attackers[0]}). Before you plan anything, ask what the opponent's last move threatens.`,
      },
    } satisfies ChoiceExercise;
  },
};

// -- rx.pattern: name the tactic, fast ---------------------------------------------
const patternName = PATTERN_FAMILIES.find((f) => f.id === "pat.name")!;
const pattern: FamilyDef = {
  id: "rx.pattern",
  category: "reaction",
  label: "Pattern flash",
  skill: "Name the tactical idea quickly",
  signature: "name-motif",
  classify: (p) => (b5(p) === 4 ? classifyIgnoringBucket(p) : null),
  build: ({ key, level, puzzle }) => {
    if (!puzzle) return null;
    const e = patternName.build({ key, level, puzzle });
    if (!e || e.kind !== "choice") return null;
    return {
      ...e,
      id: exerciseId("rx.pattern", key),
      category: "reaction",
      family: "rx.pattern",
      familyLabel: "Pattern flash",
      skill: "Name the tactical idea quickly",
    } satisfies ChoiceExercise;
  },
};

function classifyIgnoringBucket(p: Parameters<NonNullable<FamilyDef["classify"]>>[0]): Level | null {
  const m = primaryMotif(p);
  if (!m || !MOTIF_TEACHING[m] || /Mate$/.test(m)) return null;
  const min: Record<string, Level> = {
    fork: 1, pin: 1, hangingPiece: 1, skewer: 2, discoveredAttack: 2, trappedPiece: 2, doubleCheck: 2,
    discoveredCheck: 3, deflection: 3, attraction: 3, capturingDefender: 3,
    xRayAttack: 4, interference: 4, clearance: 4, quietMove: 4, intermezzo: 4, zugzwang: 5,
  };
  if (!min[m]) return null;
  return Math.min(5, Math.max(min[m], ratingToLevel(p.rating))) as Level;
}

export const REACTION_FAMILIES: FamilyDef[] = [flash, check, hanging, threat, pattern];

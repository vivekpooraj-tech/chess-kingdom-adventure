import { Chess, type Color, type Square } from "chess.js";
import { fnv1a } from "../../exerciseIds";
import { ratingToLevel, type Level } from "../../curriculum";
import { PIECE_NAME } from "@/lib/chessMind/pieceNames";
import { boardMap, exchangeNet, materialBalance, materialOf, pieceCount, valueOf, type BoardMap } from "../geometry";
import { makeChoiceSet, seededPick } from "../rng";
import { buildContext, lineText, playerMaterialDelta, sideWord } from "../puzzleContext";
import { exerciseId, type FamilyDef } from "./types";

/**
 * CHESS MATHEMATICS — material awareness and tactical arithmetic: counting a
 * position, following captures, judging an exchange, comparing alternatives.
 * Standard values only (P1 N3 B3 R5 Q9). Every number is computed from the real
 * board; exchange values use exhaustive search over legal recaptures.
 */

const q4 = (p: { id: string }) => parseInt(fnv1a(p.id), 36) % 4;

const ORDER: Array<"q" | "r" | "b" | "n" | "p"> = ["q", "r", "b", "n", "p"];
const SYMBOL: Record<string, string> = { q: "Q", r: "R", b: "B", n: "N", p: "P" };

function summary(board: BoardMap, color: Color): string {
  const parts: string[] = [];
  for (const t of ORDER) {
    let n = 0;
    for (const p of board.values()) if (p.color === color && p.type === t) n++;
    if (n) parts.push(n > 1 ? `${n}${SYMBOL[t]}` : SYMBOL[t]);
  }
  return parts.length ? parts.join("+") : "king only";
}

function balanceText(b: number): string {
  return b === 0 ? "Equal" : b > 0 ? `White +${b}` : `Black +${-b}`;
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

function balanceChoices(correct: number, seed: string) {
  const near = new Set<number>();
  for (const d of [-3, -2, -1, 1, 2, 3, 4]) near.add(correct + d);
  near.add(-correct);
  const texts = [...near].filter((n) => n !== correct && Math.abs(n) <= 40).map(balanceText);
  return makeChoiceSet(balanceText(correct), texts, seed);
}

function numberChoices(correct: number, seed: string, min = -12, max = 14) {
  const near: number[] = [];
  for (const d of [-3, -2, -1, 1, 2, 3, 4, -4]) near.push(correct + d);
  return makeChoiceSet(
    signed(correct),
    near.filter((n) => n >= min && n <= max && n !== correct).map(signed),
    seed
  );
}

// -- math.basics: piece values, taught on a board that shows the pieces --------
/**
 * RULE: when a question names pieces, the board shows those pieces. A piece-value
 * question about a rook next to a board holding only two kings teaches nothing.
 * Each exercise therefore uses a small, legal position — both kings plus exactly
 * the pieces the question refers to, standing on their natural starting squares —
 * and the prompt says what is on the board and where.
 *
 *   value:<piece>    one White piece is on the board; "how many points is it worth?"
 *   compare:<a><b>   a White <a> and a Black <b> are on the board; "which is worth more?"
 *
 * Every position is checked with chess.js (legal FEN, neither king in check) when
 * the exercise is built; a position that fails is never served.
 */
type BasicPiece = "p" | "n" | "b" | "r" | "q";
const WHITE_HOME: Record<BasicPiece, string> = { p: "b2", n: "b1", b: "c1", r: "a1", q: "d1" };
const BLACK_HOME: Record<BasicPiece, string> = { p: "b7", n: "b8", b: "c8", r: "a8", q: "d8" };

function placementFor(white: Array<[BasicPiece, string]>, black: Array<[BasicPiece, string]>): string {
  const grid: string[][] = Array.from({ length: 8 }, () => Array(8).fill(""));
  const put = (sq: string, ch: string) => {
    grid[8 - parseInt(sq[1], 10)][sq.charCodeAt(0) - 97] = ch;
  };
  put("e1", "K");
  put("e8", "k");
  for (const [t, sq] of white) put(sq, t.toUpperCase());
  for (const [t, sq] of black) put(sq, t);
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

/** A legal position or null: loads in chess.js, one king each, nobody in check. */
function legalBasicsFen(white: Array<[BasicPiece, string]>, black: Array<[BasicPiece, string]>): string | null {
  const fen = `${placementFor(white, black)} w - - 0 1`;
  try {
    const g = new Chess(fen);
    if (g.isCheck() || g.isAttacked("e8", "w")) return null;
    const all = [...boardMap(g).values()];
    if (all.filter((x) => x.type === "k").length !== 2) return null;
    return fen;
  } catch {
    return null;
  }
}

const PIECE_TYPES: BasicPiece[] = ["p", "n", "b", "r", "q"];
const COMPARE_PAIRS = ["pn", "bn", "rb", "qr", "rp", "qb", "nr"];
const BASIC_KEYS: { key: string; level: Level }[] = [
  ...PIECE_TYPES.map((t) => ({ key: `value:${t}`, level: 1 as Level })),
  ...COMPARE_PAIRS.map((k) => ({ key: `compare:${k}`, level: 1 as Level })),
];

const basics: FamilyDef = {
  id: "math.basics",
  category: "mathematics",
  label: "Piece values",
  skill: "Know what each piece is worth",
  statics: () => BASIC_KEYS,
  build: ({ key, level }) => {
    const [kind, arg] = key.split(":");
    const base = {
      id: exerciseId("math.basics", key),
      category: "mathematics" as const,
      family: "math.basics",
      familyLabel: "Piece values",
      level,
      skill: "Know what each piece is worth",
      orientation: "w" as const,
    };
    if (kind === "value") {
      const t = arg as BasicPiece;
      if (!PIECE_TYPES.includes(t)) return null;
      const fen = legalBasicsFen([[t, WHITE_HOME[t]]], []);
      if (!fen) return null;
      const v = valueOf(t);
      const name = PIECE_NAME[t].toLowerCase();
      const set = makeChoiceSet(String(v), ["1", "2", "3", "4", "5", "6", "9", "10"], `math.basics:${key}`);
      if (!set) return null;
      return {
        ...base,
        kind: "choice",
        fen,
        highlight: [WHITE_HOME[t]],
        prompt: `The board shows a White ${name} on ${WHITE_HOME[t]}. In standard chess points, how much is a ${name} worth?`,
        choices: set.choices,
        correctIndex: set.correctIndex,
        explanation: {
          correct: `Correct — a ${name} is worth ${v}. Pawn 1, knight 3, bishop 3, rook 5, queen 9: the king has no value because it can never be traded.`,
          incorrect: `A ${name} is worth ${v}. Pawn 1, knight 3, bishop 3, rook 5, queen 9 — knowing these tells you whether a trade is good.`,
        },
      } as const;
    }
    if (kind !== "compare" || arg.length !== 2) return null;
    const [a, b] = arg.split("") as [BasicPiece, BasicPiece];
    if (!PIECE_TYPES.includes(a) || !PIECE_TYPES.includes(b) || a === b) return null;
    const fen = legalBasicsFen([[a, WHITE_HOME[a]]], [[b, BLACK_HOME[b]]]);
    if (!fen) return null;
    const nameA = PIECE_NAME[a].toLowerCase();
    const nameB = PIECE_NAME[b].toLowerCase();
    const va = valueOf(a);
    const vb = valueOf(b);
    const SAME = "They are worth the same";
    const answer = va === vb ? SAME : va > vb ? `The ${nameA}` : `The ${nameB}`;
    const set = makeChoiceSet(answer, [`The ${nameA}`, `The ${nameB}`, SAME].filter((c) => c !== answer), `math.basics:${key}`, 3);
    if (!set) return null;
    return {
      ...base,
      kind: "choice",
      fen,
      highlight: [WHITE_HOME[a], BLACK_HOME[b]],
      prompt: `The board shows a White ${nameA} (${WHITE_HOME[a]}) and a Black ${nameB} (${BLACK_HOME[b]}). Which is worth more material?`,
      choices: set.choices,
      correctIndex: set.correctIndex,
      explanation: {
        correct:
          va === vb
            ? `Correct — a ${nameA} and a ${nameB} are both worth ${va}, so they are worth the same.`
            : `Correct — the ${va > vb ? nameA : nameB} (${Math.max(va, vb)}) is worth more than the ${va > vb ? nameB : nameA} (${Math.min(va, vb)}).`,
        incorrect:
          va === vb
            ? `A ${nameA} and a ${nameB} are both worth ${va}, so they are worth the same. Position can make one stronger in a game, but in material points they are equal.`
            : `The ${va > vb ? nameA : nameB} is worth ${Math.max(va, vb)} and the ${va > vb ? nameB : nameA} is worth ${Math.min(va, vb)}, so the ${va > vb ? nameA : nameB} is worth more. Position can change a piece's real strength, but material points follow these values.`,
      },
    } as const;
  },
};

// -- math.diff: count a real position -------------------------------------------
/**
 * "Count the material" is only worth asking when counting actually exercises the
 * piece values. A position of rook + pawns against rook + pawns, or any mirror
 * image, is arithmetic on a single number. So eligibility and level come from the
 * COMPOSITION of the position, not just how many pieces are on the board:
 *
 *   Foundation    small position, a minor piece or queen present, not a mirror image.
 *   Developing    unequal material across at least three different piece types.
 *   Intermediate  several pieces each side, asymmetric armies (different piece mixes).
 *
 * Captures, exchanges, promotions and tactical sequences are Advanced and Master,
 * served by the other Mathematics families (follow the captures, judge the
 * exchange, tactical arithmetic).
 */
type Counts = Record<"p" | "n" | "b" | "r" | "q", number>;
export interface MaterialProfile {
  w: Counts;
  b: Counts;
  wPoints: number;
  bPoints: number;
  balance: number;
  /** Piece types present anywhere on the board (kings excluded). */
  types: Array<keyof Counts>;
  pieces: number;
  nonPawnTotal: number;
  mirror: boolean;
  /** How many piece types the two armies hold in different quantities. */
  typesDiffering: number;
}

export function materialProfile(fen: string): MaterialProfile {
  const w: Counts = { p: 0, n: 0, b: 0, r: 0, q: 0 };
  const b: Counts = { p: 0, n: 0, b: 0, r: 0, q: 0 };
  for (const ch of fen.split(" ")[0]) {
    if (/[pnbrq]/.test(ch)) b[ch as keyof Counts]++;
    else if (/[PNBRQ]/.test(ch)) w[ch.toLowerCase() as keyof Counts]++;
  }
  const keys: Array<keyof Counts> = ["p", "n", "b", "r", "q"];
  const points = (c: Counts) => keys.reduce((a, k) => a + valueOf(k) * c[k], 0);
  const types = keys.filter((k) => w[k] + b[k] > 0);
  const typesDiffering = keys.filter((k) => w[k] !== b[k]).length;
  const nonPawn = (c: Counts) => c.n + c.b + c.r + c.q;
  return {
    w,
    b,
    wPoints: points(w),
    bPoints: points(b),
    balance: points(w) - points(b),
    types,
    pieces: keys.reduce((a, k) => a + w[k] + b[k], 0),
    nonPawnTotal: nonPawn(w) + nonPawn(b),
    mirror: typesDiffering === 0,
    typesDiffering,
  };
}

/** The level a position deserves for "count the material", or null if it is too shallow. */
export function countLevel(m: MaterialProfile): Level | null {
  const onlyPawnsAndRooks = m.types.every((t) => t === "p" || t === "r");
  if (m.mirror || onlyPawnsAndRooks) return null;
  const hasMinorOrQueen = m.types.some((t) => t === "n" || t === "b" || t === "q");
  const eachSideNonPawn = (c: Counts) => c.n + c.b + c.r + c.q;

  // Foundation: small, varied, not a mirror image (checked first: small positions stay simple).
  if (m.pieces >= 4 && m.pieces <= 11 && m.nonPawnTotal >= 2 && m.nonPawnTotal <= 5 && hasMinorOrQueen) return 1;
  // Developing: unequal material over at least three different piece types.
  if (m.balance !== 0 && m.types.length >= 3 && m.nonPawnTotal >= 3 && m.nonPawnTotal <= 6 && m.pieces <= 17) return 2;
  // Intermediate: several pieces each side and genuinely different armies.
  if (m.pieces >= 12 && eachSideNonPawn(m.w) >= 2 && eachSideNonPawn(m.b) >= 2 && m.types.length >= 3 && hasMinorOrQueen && m.typesDiffering >= 2) return 3;
  return null;
}

/** Piece values for exactly the piece types visible on this board, e.g. "N3 R5 P1". */
function valueLegend(types: Array<keyof Counts>): string {
  return (["q", "r", "b", "n", "p"] as const)
    .filter((t) => types.includes(t))
    .map((t) => `${SYMBOL[t]}${valueOf(t)}`)
    .join(" ");
}

const diff: FamilyDef = {
  id: "math.diff",
  category: "mathematics",
  label: "Count the material",
  skill: "Count both armies and find who is ahead",
  classify: (p) => (q4(p) === 0 ? countLevel(materialProfile(p.fen)) : null),
  build: ({ key, level, puzzle }) => {
    if (!puzzle) return null;
    const m = materialProfile(puzzle.fen);
    if (countLevel(m) !== level) return null;
    const game = new Chess(puzzle.fen);
    const board = boardMap(game);
    const set = balanceChoices(m.balance, `math.diff:${key}`);
    if (!set) return null;
    return {
      kind: "choice",
      id: exerciseId("math.diff", key),
      category: "mathematics",
      family: "math.diff",
      familyLabel: "Count the material",
      level,
      skill: "Count both armies and find who is ahead",
      orientation: game.turn(),
      fen: puzzle.fen,
      // Only the values that appear on the board are listed, so the prompt never
      // mentions a piece the learner cannot see.
      prompt: `Count the material (${valueLegend(m.types)}; kings excluded). Which side is ahead, and by how many points — or is it equal?`,
      choices: set.choices,
      correctIndex: set.correctIndex,
      explanation: {
        correct: `Correct. White has ${summary(board, "w")} = ${m.wPoints} points; Black has ${summary(board, "b")} = ${m.bPoints} points. Result: ${balanceText(m.balance)}.`,
        incorrect: `White has ${summary(board, "w")} = ${m.wPoints} points and Black has ${summary(board, "b")} = ${m.bPoints} points, so it is ${balanceText(m.balance)}. Count each side separately, then subtract.`,
      },
    };
  },
};

// -- math.sequence: follow captures ---------------------------------------------
function capturePlies(ctx: ReturnType<typeof buildContext>): number {
  if (!ctx) return 0;
  let last = 0;
  ctx.moves.forEach((m, i) => {
    if (m.captured) last = i + 1;
  });
  return last;
}

const sequence: FamilyDef = {
  id: "math.sequence",
  category: "mathematics",
  label: "Follow the captures",
  skill: "Track material through a sequence of captures",
  classify: (p) => {
    if (q4(p) !== 1 || p.solution.length !== 3) return null;
    const ctx = buildContext(p);
    const plies = capturePlies(ctx);
    if (!ctx || plies < 2) return null;
    const captures = ctx.moves.slice(0, plies).filter((m) => m.captured).length;
    const promo = ctx.moves.slice(0, plies).some((m) => m.promotion);
    // Advanced: several captures or a promotion. Otherwise a simple two-capture
    // sequence: Developing for easier positions, Intermediate for harder ones.
    if (captures >= 3 || promo) return 4;
    return (ratingToLevel(p.rating) <= 2 ? 2 : 3) as Level;
  },
  build: ({ key, level, puzzle }) => {
    const ctx = puzzle && buildContext(puzzle);
    if (!ctx) return null;
    const plies = capturePlies(ctx);
    if (plies < 2) return null;
    const start = materialBalance(boardMap(new Chess(ctx.fens[0])));
    const end = materialBalance(boardMap(new Chess(ctx.fens[plies])));
    const set = balanceChoices(end, `math.sequence:${key}`);
    if (!set) return null;
    const startText = balanceText(start);
    return {
      kind: "choice",
      id: exerciseId("math.sequence", key),
      category: "mathematics",
      family: "math.sequence",
      familyLabel: "Follow the captures",
      level,
      skill: "Track material through a sequence of captures",
      orientation: ctx.player,
      fen: ctx.fens[0],
      prompt: `Material is ${startText} now. After ${lineText(ctx, plies)}, what is the material balance?`,
      choices: set.choices,
      correctIndex: set.correctIndex,
      explanation: {
        correct: `Correct — it starts at ${startText} and the captures in ${lineText(ctx, plies)} take it to ${balanceText(end)}.`,
        incorrect: `Start from ${startText} and apply each capture in order: ${lineText(ctx, plies)}. The result is ${balanceText(end)}. Update the count after every capture, not just at the end.`,
      },
    };
  },
};

// -- math.exchange: judge a single exchange -------------------------------------
function captureChains(fen: string): { from: Square; to: Square; san: string; net: number; recapture: boolean }[] {
  const game = new Chess(fen);
  if (game.inCheck()) return [];
  const out: { from: Square; to: Square; san: string; net: number; recapture: boolean }[] = [];
  for (const m of game.moves({ verbose: true })) {
    if (!m.captured || m.promotion) continue;
    const net = exchangeNet(fen, m.from, m.to);
    if (net === null) continue;
    const g2 = new Chess(fen);
    g2.move(m);
    const recapture = g2.moves({ verbose: true }).some((x) => x.to === m.to && x.captured);
    out.push({ from: m.from, to: m.to, san: m.san, net, recapture });
  }
  return out;
}

const exchange: FamilyDef = {
  id: "math.exchange",
  category: "mathematics",
  label: "Judge the exchange",
  skill: "Work out the true result of a trade on one square",
  classify: (p) => {
    if (q4(p) !== 2) return null;
    const contested = captureChains(p.fen).filter((c) => c.recapture);
    return contested.length ? ((Math.max(3, Math.min(4, ratingToLevel(p.rating)))) as Level) : null;
  },
  build: ({ key, level, puzzle }) => {
    if (!puzzle) return null;
    const contested = captureChains(puzzle.fen).filter((c) => c.recapture);
    if (!contested.length) return null;
    // Deterministic pick: the contested capture with the most informative (largest) swing.
    const pick = [...contested].sort((a, b) => Math.abs(b.net) - Math.abs(a.net) || a.san.localeCompare(b.san))[0];
    const set = numberChoices(pick.net, `math.exchange:${key}`);
    if (!set) return null;
    const game = new Chess(puzzle.fen);
    const mover = game.turn();
    return {
      kind: "choice",
      id: exerciseId("math.exchange", key),
      category: "mathematics",
      family: "math.exchange",
      familyLabel: "Judge the exchange",
      level,
      skill: "Work out the true result of a trade on one square",
      orientation: mover,
      fen: puzzle.fen,
      highlight: [pick.from, pick.to],
      prompt: `${sideWord(mover)} plays ${pick.san}. If both sides keep capturing on ${pick.to} only while it helps them, what is ${sideWord(mover)}'s net material result?`,
      choices: set.choices,
      correctIndex: set.correctIndex,
      explanation: {
        correct: `Correct — the exchange on ${pick.to} nets ${signed(pick.net)} for ${sideWord(mover)}. Count what you win, subtract what each recapture takes back, and stop when continuing no longer helps.`,
        incorrect: `The exchange on ${pick.to} nets ${signed(pick.net)} for ${sideWord(mover)}. Add the first capture, subtract the best recapture, add your next capture, and so on — each side stops capturing when it would lose material.`,
      },
    };
  },
};

// -- math.best: compare alternatives --------------------------------------------
const best: FamilyDef = {
  id: "math.best",
  category: "mathematics",
  label: "Which capture wins most?",
  skill: "Compare capture options by their real material result",
  classify: (p) => {
    if (q4(p) !== 3) return null;
    const caps = captureChains(p.fen);
    if (caps.length < 3) return null;
    const sorted = [...caps].sort((a, b) => b.net - a.net);
    if (sorted[0].net < 1 || sorted[0].net === sorted[1].net) return null;
    return Math.max(4, ratingToLevel(p.rating)) as Level;
  },
  build: ({ key, level, puzzle }) => {
    if (!puzzle) return null;
    const caps = captureChains(puzzle.fen);
    const sorted = [...caps].sort((a, b) => b.net - a.net || a.san.localeCompare(b.san));
    if (sorted.length < 3 || sorted[0].net < 1 || sorted[0].net === sorted[1].net) return null;
    const top = sorted[0];
    const others = seededPick(sorted.slice(1), 3, `math.best:${key}`);
    const set = makeChoiceSet(top.san, others.map((o) => o.san), `math.best:${key}`);
    if (!set) return null;
    const mover = new Chess(puzzle.fen).turn();
    const results = sorted.filter((c) => set.choices.includes(c.san)).map((c) => `${c.san} ${signed(c.net)}`).join(", ");
    return {
      kind: "choice",
      id: exerciseId("math.best", key),
      category: "mathematics",
      family: "math.best",
      familyLabel: "Which capture wins most?",
      level,
      skill: "Compare capture options by their real material result",
      orientation: mover,
      fen: puzzle.fen,
      prompt: `${sideWord(mover)} to move. Which capture wins the most material once the recaptures are counted?`,
      choices: set.choices,
      correctIndex: set.correctIndex,
      explanation: {
        correct: `Correct — ${top.san} nets ${signed(top.net)}. Net results of the options: ${results}.`,
        incorrect: `${top.san} wins the most (${signed(top.net)}). Net results of the options: ${results}. The biggest piece to capture is not always the best — count the recaptures.`,
      },
    };
  },
};

// -- math.tactic: material outcome of a forced line -----------------------------
const tactic: FamilyDef = {
  id: "math.tactic",
  category: "mathematics",
  label: "Tactical arithmetic",
  skill: "Calculate the material outcome of a forced line",
  classify: (p) => {
    if (q4(p) !== 1 || p.solution.length !== 5) return null;
    const ctx = buildContext(p);
    if (!ctx) return null;
    const captures = ctx.moves.filter((m) => m.captured).length;
    if (captures < 2) return null;
    // Master: several captures, or a promotion inside the line. Advanced: a shorter tactical line.
    return (captures >= 3 || ctx.moves.some((m) => m.promotion) ? 5 : 4) as Level;
  },
  build: ({ key, level, puzzle }) => {
    const ctx = puzzle && buildContext(puzzle);
    if (!ctx) return null;
    const delta = playerMaterialDelta(ctx);
    if (!ctx.moves.some((m) => m.captured) || ctx.moves.filter((m) => m.captured).length < 2) return null;
    const set = numberChoices(delta, `math.tactic:${key}`);
    if (!set) return null;
    return {
      kind: "choice",
      id: exerciseId("math.tactic", key),
      category: "mathematics",
      family: "math.tactic",
      familyLabel: "Tactical arithmetic",
      level,
      skill: "Calculate the material outcome of a forced line",
      orientation: ctx.player,
      fen: ctx.fens[0],
      prompt: `${sideWord(ctx.player)} plays ${lineText(ctx)}. How many points of material has ${sideWord(ctx.player)} gained (+) or lost (-) at the end?`,
      choices: set.choices,
      correctIndex: set.correctIndex,
      explanation: {
        correct: `Correct — ${signed(delta)} for ${sideWord(ctx.player)}. Follow the line ${lineText(ctx)} and update the material after every capture.`,
        incorrect: `The outcome is ${signed(delta)} for ${sideWord(ctx.player)} after ${lineText(ctx)}. Keep a running total: add what ${sideWord(ctx.player)} captures, subtract what the opponent captures.`,
      },
    };
  },
};

export const MATHEMATICS_FAMILIES: FamilyDef[] = [basics, diff, sequence, exchange, best, tactic];

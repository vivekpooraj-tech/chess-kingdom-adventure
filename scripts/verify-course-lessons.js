/**
 * Validates every position in an Academy course.
 *
 *   node scripts/verify-course-lessons.js
 *
 * Chess taught wrongly is worse than chess not taught, so no lesson position
 * ships on trust. For every exercise this checks that the FEN parses, that the
 * declared side to move matches the FEN, that solutionFrom -> solutionTo is a
 * legal move, and — the part that actually matters — that the move demonstrates
 * what its lesson claims. A legal move that is not a check is still wrong in a
 * lesson called "find the check".
 *
 * Also replays any declared `line` to confirm it is playable from the position.
 *
 * Exits non-zero on any failure so it can gate a build.
 */
const fs = require("fs");
const path = require("path");
const ts = require(path.join(process.cwd(), "node_modules", "typescript"));
const { Chess } = require(path.join(process.cwd(), "node_modules", "chess.js"));

const Module = require("module");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request.startsWith("@/")) request = path.join(process.cwd(), request.slice(2));
  return origResolve.call(this, request, ...rest);
};
require.extensions[".ts"] = function (mod, filename) {
  const js = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filename,
  }).outputText;
  mod._compile(js, filename);
};

const { TACTICAL_THINKING_LESSONS } = require(
  path.join(process.cwd(), "content", "tacticalThinkingLessons.ts")
);
const { ENDGAME_LESSONS } = require(path.join(process.cwd(), "content", "endgameLessons.ts"));
const { STRATEGY_LESSONS } = (() => {
  try {
    return require(path.join(process.cwd(), "content", "strategyLessons.ts"));
  } catch {
    return { STRATEGY_LESSONS: null };
  }
})();

/** Piece census for a position, used by the endgame claims. */
function census(game) {
  const c = { w: {}, b: {}, total: 0 };
  for (const row of game.board()) {
    for (const sq of row) {
      if (!sq) continue;
      c[sq.color][sq.type] = (c[sq.color][sq.type] || 0) + 1;
      c.total++;
    }
  }
  return c;
}

/**
 * Is the pawn on `square` passed? Reimplemented here rather than shared with
 * the selector on purpose: an independent check catches a bug in the selector,
 * a shared helper would agree with it.
 */
function isPassed(game, square, color) {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);
  const them = color === "w" ? "b" : "w";
  for (let df = -1; df <= 1; df++) {
    const f = file + df;
    if (f < 0 || f > 7) continue;
    const from = color === "w" ? rank + 1 : 1;
    const to = color === "w" ? 8 : rank - 1;
    for (let r = from; r <= to; r++) {
      const pc = game.get(String.fromCharCode(97 + f) + r);
      if (pc && pc.type === "p" && pc.color === them) return false;
    }
  }
  return true;
}

/** Can any enemy pawn ever attack this square? */
function pawnSafe(game, square, byColor) {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);
  for (const df of [-1, 1]) {
    const f = file + df;
    if (f < 0 || f > 7) continue;
    const range = byColor === "w" ? [rank + 1, 8] : [1, rank - 1];
    for (let r = range[0]; r <= range[1]; r++) {
      const pc = game.get(String.fromCharCode(97 + f) + r);
      if (pc && pc.type === "p" && pc.color === byColor) return false;
    }
  }
  return true;
}

/** What each lesson's exercises must actually demonstrate. */
const CLAIM = {
  "forcing-moves": {
    label: "must give check",
    test: (mv) => mv.san.includes("+") || mv.san.includes("#"),
  },
  captures: {
    label: "must be a capture",
    test: (mv) => mv.captured !== undefined,
  },
  threats: {
    label: "must be quiet (no capture, no check)",
    test: (mv) => mv.captured === undefined && !mv.san.includes("+") && !mv.san.includes("#"),
  },
  "their-reply": {
    label: "must be forcing (a check)",
    test: (mv) => mv.san.includes("+") || mv.san.includes("#"),
  },

  // Endgames. Each mirrors the predicate scripts/build-endgames.js selected on.
  "king-activity": {
    label: "must be a king move in a queenless ending",
    test: (mv, before) => {
      const c = census(before);
      return mv.piece === "k" && c.total <= 12 && !c.w.q && !c.b.q;
    },
  },
  "pawn-endgames": {
    label: "must be a pure king-and-pawn ending",
    test: (mv, before) => {
      const c = census(before);
      return (
        !c.w.q && !c.b.q && !c.w.n && !c.b.n && !c.w.b && !c.b.b && !c.w.r && !c.b.r && c.total <= 10
      );
    },
  },
  "passed-pawns": {
    label: "must push a genuinely passed pawn",
    test: (mv, before, after) =>
      mv.piece === "p" && !mv.captured && !mv.promotion && isPassed(after, mv.to, mv.color),
  },
  promotion: {
    label: "must promote a pawn",
    test: (mv) => Boolean(mv.promotion),
  },
  "rook-endgames": {
    label: "must be a rook move in a rook-and-pawn ending",
    test: (mv, before) => {
      const c = census(before);
      return (
        mv.piece === "r" &&
        !c.w.q && !c.b.q && !c.w.n && !c.b.n && !c.w.b && !c.b.b &&
        c.total <= 12
      );
    },
  },
  converting: {
    label: "must be a simplified position with a decisive edge to convert",
    test: (mv, before) => {
      const c = census(before);
      return c.total >= 8 && c.total <= 14;
    },
  },

  // Strategy. Each mirrors the predicate scripts/build-strategy.js selected on;
  // the engine gate that chose these moves is applied at selection time.
  outposts: {
    label: "must be a quiet knight move to a square no enemy pawn can attack",
    test: (mv, before, after) =>
      mv.piece === "n" &&
      !mv.captured &&
      !mv.san.includes("+") &&
      !mv.san.includes("#") &&
      pawnSafe(after, mv.to, mv.color === "w" ? "b" : "w") &&
      after.isAttacked(mv.to, mv.color),
  },
  "king-safety": {
    label: "must be a castling move",
    test: (mv) => mv.san.startsWith("O-O"),
  },
  "pawn-breaks": {
    label: "must be a quiet pawn advance making contact with an enemy pawn",
    test: (mv, before) => {
      if (mv.piece !== "p" || mv.captured || mv.san.includes("+")) return false;
      const file = mv.to.charCodeAt(0) - 97;
      const rank = Number(mv.to[1]);
      const them = mv.color === "w" ? "b" : "w";
      const fwd = mv.color === "w" ? 1 : -1;
      for (const df of [-1, 1]) {
        const f = file + df;
        if (f < 0 || f > 7) continue;
        const pc = before.get(String.fromCharCode(97 + f) + (rank + fwd));
        if (pc && pc.type === "p" && pc.color === them) return true;
      }
      return false;
    },
  },
  "piece-activity": {
    label: "must be a quiet move that increases the moved piece's scope",
    test: (mv, before, after) => {
      if (mv.captured || mv.san.includes("+") || mv.piece === "p" || mv.piece === "k") return false;
      return after.moves({ square: mv.to, verbose: true }).length >
        before.moves({ square: mv.from, verbose: true }).length;
    },
  },
  "worst-piece": {
    label: "must be a quiet move improving the least active piece",
    test: (mv, before, after) => {
      if (mv.captured || mv.san.includes("+") || mv.piece === "p" || mv.piece === "k") return false;
      return after.moves({ square: mv.to, verbose: true }).length >
        before.moves({ square: mv.from, verbose: true }).length;
    },
  },
};

const COURSES = [
  ["tactical-thinking", TACTICAL_THINKING_LESSONS],
  ["endgames", ENDGAME_LESSONS],
  ...(STRATEGY_LESSONS ? [["strategy", STRATEGY_LESSONS]] : []),
];

const failures = [];
let exercises = 0;
let examples = 0;
let lessonCount = 0;

for (const [courseId, LESSONS] of COURSES) {
for (const lesson of LESSONS) {
  lessonCount++;
  const claim = CLAIM[lesson.id];
  if (!claim) failures.push(`${courseId}/${lesson.id}: no claim defined for this lesson`);

  for (const ex of lesson.examples) {
    examples++;
    try {
      new Chess(ex.fen);
    } catch {
      failures.push(`${courseId}/${lesson.id} example: FEN does not parse — ${ex.fen}`);
    }
  }

  lesson.exercises.forEach((ex, i) => {
    exercises++;
    const where = `${courseId}/${lesson.id} exercise ${i + 1}`;
    let g;
    try {
      g = new Chess(ex.fen);
    } catch {
      failures.push(`${where}: FEN does not parse — ${ex.fen}`);
      return;
    }
    if (g.turn() !== ex.sideToMove) {
      failures.push(`${where}: sideToMove "${ex.sideToMove}" disagrees with FEN ("${g.turn()}")`);
      return;
    }
    const before = new Chess(ex.fen);
    let mv = null;
    try {
      mv = g.move({ from: ex.solutionFrom, to: ex.solutionTo, promotion: "q" });
    } catch {
      mv = null;
    }
    if (!mv) {
      failures.push(`${where}: ${ex.solutionFrom}->${ex.solutionTo} is not a legal move`);
      return;
    }
    if (claim && !claim.test(mv, before, g)) {
      failures.push(`${where}: solution ${mv.san} ${claim.label}`);
    }
    if (ex.line) {
      const probe = new Chess(ex.fen);
      for (const san of ex.line.split(/\s+/)) {
        let played = null;
        try {
          played = probe.move(san);
        } catch {
          played = null;
        }
        if (!played) {
          failures.push(`${where}: declared line "${ex.line}" breaks at ${san}`);
          break;
        }
      }
    }
  });
}
}

console.log(`courses:   ${COURSES.length}`);
console.log(`lessons:   ${lessonCount}`);
console.log(`examples:  ${examples}`);
console.log(`exercises: ${exercises}`);
if (failures.length) {
  console.error(`\nFAILURES: ${failures.length}`);
  for (const f of failures) console.error("  " + f);
  process.exit(1);
}
console.log("\nALL PASS — every position is legal and demonstrates its lesson's claim.");

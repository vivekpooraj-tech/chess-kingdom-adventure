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
};

const failures = [];
let exercises = 0;
let examples = 0;

for (const lesson of TACTICAL_THINKING_LESSONS) {
  const claim = CLAIM[lesson.id];
  if (!claim) failures.push(`${lesson.id}: no claim defined for this lesson`);

  for (const ex of lesson.examples) {
    examples++;
    try {
      new Chess(ex.fen);
    } catch {
      failures.push(`${lesson.id} example: FEN does not parse — ${ex.fen}`);
    }
  }

  lesson.exercises.forEach((ex, i) => {
    exercises++;
    const where = `${lesson.id} exercise ${i + 1}`;
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
    if (claim && !claim.test(mv)) {
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

console.log(`lessons:   ${TACTICAL_THINKING_LESSONS.length}`);
console.log(`examples:  ${examples}`);
console.log(`exercises: ${exercises}`);
if (failures.length) {
  console.error(`\nFAILURES: ${failures.length}`);
  for (const f of failures) console.error("  " + f);
  process.exit(1);
}
console.log("\nALL PASS — every position is legal and demonstrates its lesson's claim.");

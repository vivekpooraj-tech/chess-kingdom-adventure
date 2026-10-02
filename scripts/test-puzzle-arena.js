/**
 * Presentation helpers for world-specific Puzzle chrome.
 *   node scripts/test-puzzle-arena.js
 */
const fs = require("fs");
const path = require("path");
const ts = require(path.join(process.cwd(), "node_modules", "typescript"));
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

const A = require(path.join(process.cwd(), "lib", "puzzles", "puzzleArena.ts"));

let pass = 0;
const failures = [];
const check = (n, c) => (c ? pass++ : failures.push(n));

check("enchanted title is quest", A.puzzleArenaTitle("enchanted", "x") === "Puzzle Quest");
check("atelier title is lab", A.puzzleArenaTitle("atelier", "x") === "Tactical Lab");
check("classic title is study", A.puzzleArenaTitle("classic", "x") === "Chess Study");

check("accuracy empty is dash", A.sessionAccuracyLabel(0, 0) === "—");
check("accuracy is first-try rate", A.sessionAccuracyLabel(4, 3) === "75%");
check("accuracy never exceeds 100", A.sessionAccuracyLabel(2, 9) === "100%");

check("stars empty while playing", A.starsFromAttempt("playing", 0) === 0);
check("stars 3 on first-try solve", A.starsFromAttempt("correct", 0) === 3);
check("stars 2 after one miss", A.starsFromAttempt("correct", 1) === 2);
check("stars 0 on miss", A.starsFromAttempt("incorrect", 2) === 0);

const rail0 = A.masteryRailState(0);
check("0 solves is beginner current", rail0[0].status === "current" && rail0[3].status === "locked");
const rail40 = A.masteryRailState(40);
check("40 solves is advanced", rail40.find((s) => s.id === "advanced").status === "current");
const rail101 = A.masteryRailState(101);
check("101 solves is mastery", rail101[3].status === "current" && rail101[0].status === "completed");

const chambers = A.puzzleChambers(0);
check("five chambers from real levels", chambers.length === 5 && chambers[0].status === "current");

console.log(`\n=== PUZZLE ARENA: ${pass} passed, ${failures.length} failed ===`);
if (failures.length) {
  for (const f of failures) console.log("FAIL:", f);
  process.exit(1);
}

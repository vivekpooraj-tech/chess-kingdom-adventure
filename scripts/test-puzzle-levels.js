/**
 * Tests for lib/puzzles/puzzleLevels.ts — the Puzzle Tower's leveling data.
 *
 *   node scripts/test-puzzle-levels.js
 *
 * Pure logic only — no database, no fixtures. The property that matters
 * most is the boundary behaviour: every threshold the WOW brief called out
 * by hand (0, 1, 10, 11, 30, 31, 60, 61, 100, 101) must land on exactly the
 * level its range implies, with no off-by-one drift in either direction.
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

const L = require(path.join(process.cwd(), "lib", "puzzles", "puzzleLevels.ts"));

let pass = 0;
const failures = [];
const check = (n, c) => (c ? pass++ : failures.push(n));

// --- 1. Every named boundary lands on the level its own range promises ---
{
  const expected = [
    [0, "easy"],
    [1, "easy"],
    [10, "easy"],
    [11, "medium"],
    [30, "medium"],
    [31, "hard"],
    [60, "hard"],
    [61, "expert"],
    [100, "expert"],
    [101, "master"],
  ];
  for (const [count, id] of expected) {
    check(`solvedCount ${count} -> ${id}`, L.currentPuzzleLevel(count).id === id);
  }
}

// --- 2. Levels are contiguous and ordered, no gaps and no overlaps -------
{
  const levels = L.PUZZLE_LEVELS;
  check("five levels, in order", levels.length === 5);
  check("first level starts at 0", levels[0].min === 0);
  check("last level (Master) has no ceiling", levels[levels.length - 1].max === null);
  for (let i = 0; i < levels.length - 1; i++) {
    check(
      `${levels[i].id} -> ${levels[i + 1].id} is contiguous (no gap, no overlap)`,
      levels[i].max !== null && levels[i + 1].min === levels[i].max + 1
    );
  }
}

// --- 3. Extreme / defensive inputs never throw and never go negative -----
{
  check("negative solved count clamps to Easy", L.currentPuzzleLevel(-5).id === "easy");
  check("a huge solved count still resolves (Master)", L.currentPuzzleLevel(1_000_000).id === "master");
}

// --- 4. levelStatus agrees with currentPuzzleLevel at every boundary -----
{
  for (const count of [0, 1, 10, 11, 30, 31, 60, 61, 100, 101]) {
    const current = L.currentPuzzleLevel(count);
    for (const level of L.PUZZLE_LEVELS) {
      const status = L.levelStatus(level, count);
      if (level.id === current.id) {
        check(`levelStatus: ${level.id} is "current" at ${count} solved`, status === "current");
      } else if (level.min < current.min) {
        check(`levelStatus: ${level.id} is "completed" at ${count} solved`, status === "completed");
      } else {
        check(`levelStatus: ${level.id} is "locked" at ${count} solved`, status === "locked");
      }
    }
  }
}

// --- 5. puzzlesUntilLevel: exact remaining count, floors at 0 ------------
{
  check("9 to go from 1 solved to Medium (min 11)", L.puzzlesUntilLevel(L.PUZZLE_LEVELS[1], 1) === 10);
  check("0 to go once already past a level's min", L.puzzlesUntilLevel(L.PUZZLE_LEVELS[0], 5) === 0);
  check("never negative once the level is behind you", L.puzzlesUntilLevel(L.PUZZLE_LEVELS[0], 500) === 0);
  check(
    "exactly 1 more puzzle needed one below a threshold",
    L.puzzlesUntilLevel(L.PUZZLE_LEVELS[1], 10) === 1
  );
}

// --- 6. nextPuzzleLevel: null only once Master is reached ----------------
{
  check("Easy's next level is Medium", L.nextPuzzleLevel(0).id === "medium");
  check("Expert's next level is Master", L.nextPuzzleLevel(61).id === "master");
  check("Master has no next level", L.nextPuzzleLevel(101) === null);
  check("Master still has no next level far beyond it", L.nextPuzzleLevel(5000) === null);
}

// --- 7. Gauge caps at 100 regardless of how far past Master ---------------
{
  check("gauge under 100 passes through unchanged", L.puzzleGaugeProgress(42).solved === 42);
  check("gauge caps at 100 past Master", L.puzzleGaugeProgress(250).solved === 100);
  check("gauge never negative", L.puzzleGaugeProgress(-10).solved === 0);
}

// --- 8. Motivational copy: deterministic, varied, never throws ----------
{
  const a = L.motivationalLine(4);
  const b = L.motivationalLine(4);
  check("same solved count always yields the same line (no Math.random/Date)", a === b);
  const seen = new Set();
  for (let i = 0; i < 20; i++) seen.add(L.motivationalLine(i));
  check("the line varies across different solved counts, not fixed to one string", seen.size > 1);
}

// --- 9. Every level carries the copy the Tower actually renders ----------
{
  for (const level of L.PUZZLE_LEVELS) {
    check(`${level.id} has an icon`, typeof level.icon === "string" && level.icon.length > 0);
    check(`${level.id} has a tagline`, typeof level.tagline === "string" && level.tagline.length > 0);
    check(`${level.id} has an Ollie line`, typeof level.ollieLine === "string" && level.ollieLine.length > 0);
    check(`${level.id} has an achievement title`, typeof level.achievement === "string" && level.achievement.length > 0);
  }
  // Achievements are meant to be distinct badges, not one label reused five times.
  check(
    "every level's achievement title is unique",
    new Set(L.PUZZLE_LEVELS.map((l) => l.achievement)).size === L.PUZZLE_LEVELS.length
  );
}

console.log(`\n=== PUZZLE LEVELS: ${pass} passed, ${failures.length} failed ===`);
if (failures.length) {
  for (const f of failures) console.log("FAIL:", f);
  process.exit(1);
}

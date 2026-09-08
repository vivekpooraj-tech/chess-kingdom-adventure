/**
 * Tests for lib/puzzles/puzzleStats.ts — puzzle history, streak and
 * personal-best arithmetic (Priority 4: personal history, personal best,
 * puzzle streak).
 *
 *   node scripts/test-puzzle-stats.js
 *
 * All of this reads from puzzle_library_solves, a table that already
 * existed before this feature — no migration was added. The two personal
 * bests (bestDayCount, longestFirstTryStreak) are both real counts over
 * real rows, explainable in one sentence, never a synthesized score.
 *
 * The property that matters most for the streak: it must match
 * getChessMindStreak's exact rule (today or yesterday keeps it alive,
 * anything older resets to 0) — the app must not have two different ideas
 * of what a "streak" means depending on which feature you're looking at.
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

const S = require(path.join(process.cwd(), "lib", "puzzles", "puzzleStats.ts"));

let pass = 0;
const failures = [];
const check = (n, c) => (c ? pass++ : failures.push(n));

const solve = (id, day, firstTry, source = "trainer") => ({
  puzzleId: id,
  solvedAt: `${day}T12:00:00.000Z`,
  firstTry,
  source,
});

// --- 1. Empty / degenerate input ------------------------------------------
{
  const empty = S.computePuzzleStats([], "2024-06-10");
  check("no history means zero everything", empty.totalSolved === 0);
  check("no history means no streak", empty.currentStreakDays === 0);
  check("no history means no best day", empty.bestDayCount === 0);
  check("no history means no first-try streak", empty.longestFirstTryStreak === 0);

  let threw = false;
  try {
    S.computePuzzleStats(null, "2024-06-10");
  } catch {
    threw = true;
  }
  check("null history does not throw", threw === false);

  check("junk records are dropped, not counted", S.computePuzzleStats([{}, { solvedAt: "not a date" }, null], "2024-06-10").totalSolved === 0);
}

// --- 2. Total solved, real counts -----------------------------------------
{
  const records = [solve("a", "2024-06-01", true), solve("b", "2024-06-02", false), solve("c", "2024-06-02", true)];
  const stats = S.computePuzzleStats(records, "2024-06-10");
  check("total solved counts every record", stats.totalSolved === 3);
  check("best day is the day with the most solves", stats.bestDayCount === 2);
}

// --- 3. Streak: matches getChessMindStreak's exact rule -------------------
{
  check("today alone is a 1-day streak", S.streakFromDates(["2024-06-10"], "2024-06-10") === 1);
  check("yesterday alone still counts (grace day)", S.streakFromDates(["2024-06-09"], "2024-06-10") === 1);
  check("two days ago with nothing more recent resets to 0", S.streakFromDates(["2024-06-08"], "2024-06-10") === 0);
  check("no dates at all is 0", S.streakFromDates([], "2024-06-10") === 0);

  const consecutive = ["2024-06-10", "2024-06-09", "2024-06-08", "2024-06-07"];
  check("four consecutive days is a streak of 4", S.streakFromDates(consecutive, "2024-06-10") === 4);

  const gap = ["2024-06-10", "2024-06-09", "2024-06-05"];
  check("a gap stops the streak count at the gap", S.streakFromDates(gap, "2024-06-10") === 2);

  const dupes = ["2024-06-10", "2024-06-10", "2024-06-09"];
  check("duplicate dates on the same day don't inflate the streak", S.streakFromDates(dupes, "2024-06-10") === 2);

  const outOfOrder = ["2024-06-08", "2024-06-10", "2024-06-09"];
  check("unsorted input is sorted correctly", S.streakFromDates(outOfOrder, "2024-06-10") === 3);
}

// --- 4. First-try streak is about SOLVE ORDER, not calendar order --------
{
  // Same calendar day, but three separate solves in order: first-try,
  // first-try, not-first-try. The run breaks at the third.
  const sameDay = [
    { puzzleId: "a", solvedAt: "2024-06-10T09:00:00.000Z", firstTry: true },
    { puzzleId: "b", solvedAt: "2024-06-10T10:00:00.000Z", firstTry: true },
    { puzzleId: "c", solvedAt: "2024-06-10T11:00:00.000Z", firstTry: false },
    { puzzleId: "d", solvedAt: "2024-06-10T12:00:00.000Z", firstTry: true },
  ];
  const stats = S.computePuzzleStats(sameDay, "2024-06-10");
  check("the longest first-try run is 2, not 4", stats.longestFirstTryStreak === 2);

  // Records handed in out of chronological order must still be sorted
  // before the run is computed.
  const shuffled = [sameDay[3], sameDay[0], sameDay[2], sameDay[1]];
  check("first-try streak is correct regardless of input order", S.computePuzzleStats(shuffled, "2024-06-10").longestFirstTryStreak === 2);

  const allMiss = [solve("a", "2024-06-10", false), solve("b", "2024-06-10", false)];
  check("all misses means a 0 first-try streak", S.computePuzzleStats(allMiss, "2024-06-10").longestFirstTryStreak === 0);

  const allFirstTry = [solve("a", "2024-06-08", true), solve("b", "2024-06-09", true), solve("c", "2024-06-10", true)];
  check("every solve first-try gives a streak equal to the count", S.computePuzzleStats(allFirstTry, "2024-06-10").longestFirstTryStreak === 3);
}

// --- 5. Recent solves -------------------------------------------------------
{
  const records = [solve("a", "2024-06-01", true), solve("b", "2024-06-05", false), solve("c", "2024-06-03", true)];
  const recent = S.recentSolves(records, 2);
  check("recent solves are capped at the limit", recent.length === 2);
  check("recent solves are newest first", recent[0].puzzleId === "b" && recent[1].puzzleId === "c");
  check("a limit larger than the history returns everything", S.recentSolves(records, 100).length === 3);
  check("a zero limit returns nothing", S.recentSolves(records, 0).length === 0);
  check("undefined/malformed records are dropped", S.recentSolves([null, { solvedAt: "bad" }, ...records]).length === 3);
}

// --- 6. Wiring --------------------------------------------------------------
{
  const read = (p) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
  const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  const queries = read("lib/supabase/queries.ts");
  check("getPuzzleSolveHistory exists", /export async function getPuzzleSolveHistory/.test(queries));
  check("solve history reads the real table", /from\("puzzle_library_solves"\)/.test(queries.slice(queries.indexOf("getPuzzleSolveHistory"))));
  check("solve history is capped, not unbounded", /\.limit\(limit\)/.test(queries.slice(queries.indexOf("getPuzzleSolveHistory"))));

  const page = strip(read("app/(tabs)/puzzles/tactics/themes/page.tsx"));
  check("the themes page reads real solve history", /getPuzzleSolveHistory\(/.test(page));
  check("the themes page computes stats, never hardcodes them", /computePuzzleStats\(/.test(page));
  check("the themes page renders the progress panel", /<PuzzleProgressPanel/.test(page));

  const panel = strip(read("components/puzzles/PuzzleProgressPanel.tsx"));
  check("the panel renders nothing with no history", /if \(stats\.totalSolved === 0\) return null;/.test(panel));
  check("the panel never fabricates a metric not in PuzzleStats", !/Math\.random/.test(panel));

  const labels = strip(read("lib/puzzles/solveLabels.server.ts"));
  check("solve labels never invent a theme for an unknown id", /return null/.test(labels));
  check("solve labels use the id prefix to pick the right library", /startsWith\("lc-"\)/.test(labels));
}

console.log(`\n=== PUZZLE STATS: ${pass} passed, ${failures.length} failed ===`);
if (failures.length) {
  console.error("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
  process.exitCode = 1;
}

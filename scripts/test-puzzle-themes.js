/**
 * Tests for lib/puzzles/tacticsProgress.ts — the Puzzle Theme Browser's
 * counting layer (Phase E1).
 *
 *   node scripts/test-puzzle-themes.js
 *
 * Imports the real module and the real TACTICS_SKILLS list, and cross-checks
 * both against the actual 5,000-puzzle library on disk — so this fails if a
 * skill the library uses is ever missing from the runtime list, which is
 * exactly the failure mode that would make a theme silently vanish from the
 * browser instead of just showing 0/0.
 *
 * The property that matters most: progress can never be inflated. A solved
 * id that belongs to the MATE library (a different puzzle set sharing the
 * same solves table) must not be counted as a tactics solve, and a solved
 * count can never exceed a theme's real total.
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

const TP = require(path.join(process.cwd(), "lib", "puzzles", "tacticsProgress.ts"));
const { TACTICS_SKILLS, TACTICS_TIERS } = require(path.join(process.cwd(), "lib", "puzzles", "tacticsTypes.ts"));

let pass = 0;
const failures = [];
const check = (n, c) => (c ? pass++ : failures.push(n));

const puzzle = (id, skill, tier) => ({ id, skill, tier, fen: "", sideToMove: "w", solution: [], solutionSan: [], rating: 1000, themes: [], lichessId: id, gameUrl: null });

// --- 1. Basic counting ----------------------------------------------------
{
  const library = [
    puzzle("lc-1", "forks", "beginner"),
    puzzle("lc-2", "forks", "beginner"),
    puzzle("lc-3", "forks", "advanced"),
    puzzle("lc-4", "pins", "intermediate"),
  ];

  const none = TP.themeProgress(library, []);
  check("every configured skill is represented", none.length === TACTICS_SKILLS.length);
  const forks = none.find((p) => p.skill === "forks");
  check("forks total is correct", forks.total === 3);
  check("nothing solved means 0", forks.solved === 0);
  check("0 solved is 0 percent", forks.percentComplete === 0);

  const skewers = none.find((p) => p.skill === "skewers");
  check("a skill with zero library puzzles still appears", skewers !== undefined);
  check("that skill correctly shows 0 total", skewers.total === 0);
  check("0 total is 0 percent, not NaN or Infinity", skewers.percentComplete === 0);

  const oneSolved = TP.themeProgress(library, ["lc-1"]);
  const forksOne = oneSolved.find((p) => p.skill === "forks");
  check("one real solve counts once", forksOne.solved === 1);
  check("percent reflects the real fraction", forksOne.percentComplete === Math.round((1 / 3) * 100));

  const allSolved = TP.themeProgress(library, ["lc-1", "lc-2", "lc-3"]);
  const forksAll = allSolved.find((p) => p.skill === "forks");
  check("all solved reaches 100%", forksAll.percentComplete === 100);
  check("solved never exceeds total", forksAll.solved === forksAll.total);
}

// --- 2. Never inflated by ids that don't belong to this library ----------
{
  const library = [puzzle("lc-1", "forks", "beginner")];

  // Ids from the MATE library (content/puzzles.ts) share the same solves
  // table but must never count toward a tactics theme.
  const withMateIds = TP.themeProgress(library, ["m1-backrank-rook", "m2-two-rooks-a", "lc-1"]);
  const forks = withMateIds.find((p) => p.skill === "forks");
  check("only the real tactics id counts", forks.solved === 1);

  // Duplicate ids in the solved list (should not happen, but must not double count).
  const dupes = TP.themeProgress(library, ["lc-1", "lc-1", "lc-1"]);
  check("a Set-backed lookup never double counts", dupes.find((p) => p.skill === "forks").solved === 1);

  // Junk input must not throw and must not fabricate progress.
  let threw = false;
  let junkResult;
  try {
    junkResult = TP.themeProgress(library, null);
  } catch {
    threw = true;
  }
  check("null solved ids does not throw", threw === false);
  check("null solved ids yields zero progress", junkResult.every((p) => p.solved === 0));

  threw = false;
  try {
    TP.themeProgress(null, []);
  } catch {
    threw = true;
  }
  check("null library does not throw", threw === false);
  check("null library yields every skill at zero total", TP.themeProgress(null, []).every((p) => p.total === 0));
}

// --- 3. Per-tier breakdown is real ----------------------------------------
{
  const library = [
    puzzle("lc-1", "forks", "beginner"),
    puzzle("lc-2", "forks", "advanced"),
  ];
  const progress = TP.themeProgress(library, ["lc-1"]);
  const forks = progress.find((p) => p.skill === "forks");
  check("beginner tier total is correct", forks.byTier.beginner.total === 1);
  check("beginner tier solved is correct", forks.byTier.beginner.solved === 1);
  check("advanced tier total is correct", forks.byTier.advanced.total === 1);
  check("advanced tier solved stays at zero", forks.byTier.advanced.solved === 0);
  check("intermediate tier with no puzzles is still present", forks.byTier.intermediate.total === 0);
  check("every tier is represented", TACTICS_TIERS.every((t) => t in forks.byTier));
}

// --- 4. Aggregate helpers --------------------------------------------------
{
  const library = [
    puzzle("lc-1", "forks", "beginner"),
    puzzle("lc-2", "pins", "beginner"),
    puzzle("lc-3", "pins", "intermediate"),
  ];
  const progress = TP.themeProgress(library, ["lc-1", "lc-2"]);
  check("totalThemesSolved sums correctly", TP.totalThemesSolved(progress) === 2);
  check("startedThemeCount counts themes with at least one solve", TP.startedThemeCount(progress) === 2);

  const nothingSolved = TP.themeProgress(library, []);
  check("totalThemesSolved of nothing is 0", TP.totalThemesSolved(nothingSolved) === 0);
  check("startedThemeCount of nothing is 0", TP.startedThemeCount(nothingSolved) === 0);
}

// --- 5. Cross-checked against the real 5,000-puzzle library --------------
{
  const libraryPath = path.join(process.cwd(), "data", "puzzles", "tactics-library.json");
  check("the real tactics library file exists", fs.existsSync(libraryPath));

  if (fs.existsSync(libraryPath)) {
    const real = JSON.parse(fs.readFileSync(libraryPath, "utf8"));
    check("the real library is substantial", real.length >= 1000);

    const usedSkills = new Set(real.map((p) => p.skill));
    const known = new Set(TACTICS_SKILLS);
    const unmapped = [...usedSkills].filter((s) => !known.has(s));
    check(
      `every skill in the real library is in TACTICS_SKILLS (unmapped: ${unmapped.join(", ") || "none"})`,
      unmapped.length === 0
    );

    const progress = TP.themeProgress(real, []);
    const sumOfTotals = progress.reduce((sum, p) => sum + p.total, 0);
    check("theme totals account for the whole real library", sumOfTotals === real.length);
    check("no theme total is negative or fabricated", progress.every((p) => p.total >= 0));

    // Every id in the real library must be unique, or a "solved" match could
    // silently attribute one child's solve to the wrong puzzle's theme.
    const ids = real.map((p) => p.id);
    check("every real puzzle id is unique", new Set(ids).size === ids.length);
    check("every real puzzle id is namespaced lc-", ids.every((id) => id.startsWith("lc-")));
  }
}

// --- 6. Wiring -------------------------------------------------------------
{
  const read = (p) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
  const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  const page = strip(read("app/(tabs)/puzzles/tactics/themes/page.tsx"));
  const trainer = strip(read("components/puzzles/TacticsTrainer.tsx"));

  check("the themes page is authed", /getSessionUser/.test(page) && /redirect\("\/sign-in"\)/.test(page));
  check("the themes page reads the real solved ids", /getSolvedPuzzleIds\(/.test(page));
  check("the themes page reads the real library", /getTacticsLibrary\(/.test(page));
  check("the themes page computes progress, never hardcodes it", /themeProgress\(/.test(page));
  check("empty themes are not clickable", /pointer-events-none/.test(page));
  check("empty themes are marked aria-disabled", /aria-disabled=\{empty\}/.test(page));
  check("progress bars are labelled", /role="progressbar"/.test(page) && /aria-label/.test(page));
  check("theme links route through the existing tactics trainer", /\/puzzles\/tactics\?skill=/.test(page));

  check("the trainer links to the theme browser", /\/puzzles\/tactics\/themes/.test(trainer));
}

console.log(`\n=== PUZZLE THEMES: ${pass} passed, ${failures.length} failed ===`);
if (failures.length) {
  console.error("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
  process.exitCode = 1;
}

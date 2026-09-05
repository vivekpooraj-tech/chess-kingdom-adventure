/**
 * Guard: no puzzle dataset may reach the browser.
 *
 *   node scripts/check-puzzle-bundle.js         (run after `npm run build`)
 *
 * Both puzzle pools are deliberately server-only — the 1,000-puzzle mate pool
 * (content/puzzles.ts, ~192KB of source) and the 5,000-puzzle tactics library
 * (data/puzzles/tactics-library.json, ~1.7MB). Keeping them out of the client
 * is an architectural invariant, not a one-off measurement, and it is easy to
 * break by accident: a single `import` that drops the `type` keyword, or a new
 * client component importing a `.server` module, silently puts the whole
 * dataset back into First Load JS. Nothing in the type system catches that.
 *
 * So this asserts it against the actual build output.
 *
 * The mate pool IS legitimately allowed in some chunks: /free-play and
 * /online/[gameId] pull it through PostGameAnalysis -> SkillPracticeSet ->
 * lib/training/recommendation.ts to build skill-practice positions. What must
 * never happen is the pool appearing in a PUZZLE route's first load, which is
 * the case this script exists to prevent.
 *
 * Exits non-zero on violation so it can gate CI.
 */
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const MANIFEST = path.join(ROOT, ".next", "app-build-manifest.json");
const STATIC_DIR = path.join(ROOT, ".next", "static");

if (!fs.existsSync(MANIFEST)) {
  console.error("No .next/app-build-manifest.json — run `npm run build` first.");
  process.exit(1);
}

// Distinctive strings that only appear if the dataset itself was bundled.
const MATE_MARKER = "m1-backrank-rook"; // first id in content/puzzles.ts
const TACTICS_MARKER = (() => {
  try {
    const lib = JSON.parse(
      fs.readFileSync(path.join(ROOT, "data", "puzzles", "tactics-library.json"), "utf8")
    );
    return lib[0]?.lichessId ?? null;
  } catch {
    return null;
  }
})();

/** Routes whose first load must contain no dataset at all. */
const PUZZLE_ROUTES = [/\/puzzles\/page$/, /\/puzzles\/tactics\/page$/];

const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const cache = new Map();
function chunkText(rel) {
  if (cache.has(rel)) return cache.get(rel);
  let text = "";
  try {
    text = fs.readFileSync(path.join(ROOT, ".next", rel), "utf8");
  } catch {
    /* non-JS asset */
  }
  cache.set(rel, text);
  return text;
}

const violations = [];

for (const [route, files] of Object.entries(manifest.pages)) {
  if (!PUZZLE_ROUTES.some((re) => re.test(route))) continue;
  for (const f of files) {
    const text = chunkText(f);
    if (text.includes(MATE_MARKER)) {
      violations.push(`${route}: mate pool found in first-load chunk ${f}`);
    }
    if (TACTICS_MARKER && text.includes(TACTICS_MARKER)) {
      violations.push(`${route}: tactics library found in first-load chunk ${f}`);
    }
  }
}

// The tactics library must not appear in ANY client chunk, on any route —
// it is read with `fs` and should never be reachable by the bundler at all.
if (TACTICS_MARKER && fs.existsSync(STATIC_DIR)) {
  const stack = [STATIC_DIR];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name.endsWith(".js")) {
        if (fs.readFileSync(full, "utf8").includes(TACTICS_MARKER)) {
          violations.push(`tactics library found in client chunk ${path.relative(ROOT, full)}`);
        }
      }
    }
  }
}

const checkedRoutes = Object.keys(manifest.pages).filter((r) =>
  PUZZLE_ROUTES.some((re) => re.test(r))
);
console.log("puzzle routes checked:", checkedRoutes.length ? checkedRoutes.join(", ") : "(none found)");
console.log("tactics marker:", TACTICS_MARKER ?? "(library missing — skipped)");

if (violations.length) {
  console.error(`\nBUNDLE VIOLATION (${violations.length}):`);
  for (const v of violations) console.error("  " + v);
  console.error("\nA puzzle dataset reached the browser. See PUZZLE_LIBRARY.md.");
  process.exit(1);
}
console.log("\nOK — no puzzle dataset in any puzzle route's first load, and the");
console.log("tactics library is absent from every client chunk.");

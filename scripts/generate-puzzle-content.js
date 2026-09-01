// Phase 12A - deterministic code generator for the launch library.
//
//   node scripts/generate-puzzle-content.js            # emit just the new block
//   node scripts/generate-puzzle-content.js --full     # also emit a full proposed content/puzzles.ts
//
// Input : scripts/puzzle-launch-final.json  (the curated ~961 new puzzles)
// Output: scripts/puzzle-launch-content-block.txt        (paste-ready array entries)
//         scripts/puzzle-content.proposed.txt  (with --full; for diffing only)
//
// - IDs are stable: `lichess-<sourceId>` (unique, deterministic, provenance-bearing).
// - `level` is copied verbatim from the JSON (computed by the pipeline via the
//   scripts/compute-puzzle-levels.js formula) - never hand-typed.
// - Object literals emit ONLY the ChessPuzzle fields (id/fen/sideToMove/mateIn/
//   theme/level); rating / popularity / sourceId go in a trailing comment.
// - Output is sorted (mateIn, level, id) so re-running is byte-identical.
// - NEVER writes content/puzzles.ts and NEVER touches Supabase.

const fs = require("fs");
const path = require("path");

const IN = path.join(__dirname, "puzzle-launch-final.json");
const OUT_BLOCK = path.join(__dirname, "puzzle-launch-content-block.txt");
const OUT_FULL = path.join(__dirname, "puzzle-content.proposed.txt");
const PUZZLES_TS = path.join(__dirname, "..", "content", "puzzles.ts");

const rows = JSON.parse(fs.readFileSync(IN, "utf8"));

// basic shape guard - the generator must never emit something --pool would reject
for (const r of rows) {
  if (!/^lichess-[A-Za-z0-9_-]+$/.test(r.id)) throw new Error(`bad id: ${r.id}`);
  if (!r.fen || !["w", "b"].includes(r.sideToMove)) throw new Error(`bad fen/side: ${r.id}`);
  if (![1, 2, 3].includes(r.mateIn)) throw new Error(`bad mateIn: ${r.id}`);
  if (!Number.isInteger(r.level) || r.level < 1 || r.level > 6) throw new Error(`bad level: ${r.id}`);
  if (typeof r.theme !== "string" || !r.theme.trim()) throw new Error(`bad theme: ${r.id}`);
}

rows.sort((a, b) => a.mateIn - b.mateIn || a.level - b.level || a.id.localeCompare(b.id));

// column widths for aligned output, matching the hand-written entries' style
const wId = Math.max(...rows.map((r) => r.id.length)) + 2;      // + quotes
const wFen = Math.max(...rows.map((r) => r.fen.length)) + 2;

function entry(r) {
  const id = `"${r.id}"`.padEnd(wId);
  const fen = `"${r.fen}"`.padEnd(wFen);
  const prov = `// lichess ${r.sourceId} · r${r.sourceRating ?? "?"} · pop${r.sourcePopularity ?? "?"}`;
  return `  { id: ${id}, fen: ${fen}, sideToMove: "${r.sideToMove}", mateIn: ${r.mateIn}, theme: ${JSON.stringify(r.theme).padEnd(24)}, level: ${r.level} }, ${prov}`;
}

const header = [
  "",
  "  // ---------------------------------------------------------------------------",
  `  // Phase 12 launch library - ${rows.length} puzzles imported from the Lichess open`,
  "  // puzzle database (https://database.lichess.org, CC0). Every one passed the",
  "  // strict forced-mate check in scripts/verify-puzzles.js (mate forced at exactly",
  "  // the declared depth against every defence - stricter than Lichess itself),",
  "  // was de-duplicated by position AND by tactical idea, and curated for rating,",
  "  // clarity, piece count and theme balance (see scripts/puzzle-launch-final-review.md).",
  "  // `level` is computed by scripts/compute-puzzle-levels.js, not hand-assigned.",
  "  // Lichess id / rating / popularity kept inline for provenance.",
  "  // ---------------------------------------------------------------------------",
].join("\n");

const block = header + "\n" + rows.map(entry).join("\n") + "\n";
fs.writeFileSync(OUT_BLOCK, block);
console.log(`wrote ${OUT_BLOCK}  (${rows.length} entries)`);

if (process.argv.includes("--full")) {
  const cur = fs.readFileSync(PUZZLES_TS, "utf8");
  const marker = "\n];\n";
  const at = cur.indexOf(marker);
  if (at === -1) throw new Error("could not find array close in content/puzzles.ts");
  const proposed = cur.slice(0, at) + "\n" + block + "];\n" + cur.slice(at + marker.length);
  fs.writeFileSync(OUT_FULL, proposed);
  console.log(`wrote ${OUT_FULL}  (full proposed file - for diffing only, NOT applied)`);
}

// quick self-check: the block parses as an array when wrapped
try {
  const wrapped = "[" + block.replace(/\/\/[^\n]*/g, "") + "]";
  // eslint-disable-next-line no-eval
  const parsed = eval(wrapped);
  const ids = new Set(parsed.map((p) => p.id));
  console.log(`self-check: ${parsed.length} objects parse, ${ids.size} unique ids, levels ${[...new Set(parsed.map((p) => p.level))].sort().join("/")}`);
  if (ids.size !== parsed.length) throw new Error("duplicate ids in generated block");
} catch (e) {
  console.error("SELF-CHECK FAILED:", e.message);
  process.exit(1);
}

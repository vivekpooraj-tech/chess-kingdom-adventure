// Phase 14B - deterministic generator for the Daily Challenge metadata seed.
//
//   node scripts/generate-daily-challenge-seed.js          # (re)write the migration
//   node scripts/generate-daily-challenge-seed.js --check  # fail if the on-disk migration is stale
//
// Input : content/puzzles.ts   (the validated 1,000-puzzle library - READ ONLY)
// Output: supabase/migrations/0028_daily_challenge_full_library.sql
//
// The Daily Challenge selection RPC (get_daily_challenge, 0025) picks from
// public.daily_challenge_puzzles, which holds METADATA ONLY - puzzle_id,
// level, mate_in, theme - never the FEN (the client already has full puzzle
// content via content/puzzles.ts; see 0025's header). This script mirrors
// all 1,000 library ids into that table the exact same way 0025 seeded the
// original 24, so Daily Challenge's candidate pool becomes the whole library
// without touching the library, the history table, the FK, RLS, or the RPCs.
//
// Deterministic: rows are sorted (mate_in, level, puzzle_id) and re-running
// produces a byte-identical file. NEVER writes content/puzzles.ts, NEVER
// touches Supabase.

const fs = require("fs");
const path = require("path");

const PUZZLES_TS = path.join(__dirname, "..", "content", "puzzles.ts");
const OUT_SQL = path.join(__dirname, "..", "supabase", "migrations", "0028_daily_challenge_full_library.sql");

// ---- read the library literal (same eval-the-array trick the sibling
// generators use; no ts-node dependency) ----
const src = fs.readFileSync(PUZZLES_TS, "utf8");
const match = src.match(/export const PUZZLES: ChessPuzzle\[\] = (\[[\s\S]*?\n\]);/);
if (!match) throw new Error("Could not locate PUZZLES array in content/puzzles.ts");
// eslint-disable-next-line no-eval
const PUZZLES = eval(match[1].replace(/\/\/[^\n]*/g, ""));

// ---- validate ----
const errors = [];
if (PUZZLES.length !== 1000) errors.push(`expected 1000 puzzles, found ${PUZZLES.length}`);
const seenIds = new Set();
for (const p of PUZZLES) {
  if (typeof p.id !== "string" || !p.id.trim()) errors.push(`bad id: ${JSON.stringify(p.id)}`);
  if (seenIds.has(p.id)) errors.push(`duplicate id: ${p.id}`);
  seenIds.add(p.id);
  if (!Number.isInteger(p.level) || p.level < 1 || p.level > 6) errors.push(`${p.id}: bad level ${JSON.stringify(p.level)}`);
  if (![1, 2, 3].includes(p.mateIn)) errors.push(`${p.id}: bad mateIn ${JSON.stringify(p.mateIn)}`);
  if (typeof p.theme !== "string" || !p.theme.trim()) errors.push(`${p.id}: bad theme ${JSON.stringify(p.theme)}`);
}
// the 24 puzzle ids 0025 originally seeded must all still exist
const ORIGINAL_24 = [
  "m1-backrank-rook", "m1-backrank-queen", "m1-corner-queen-a", "m1-corner-queen-b",
  "m1-smothered-knight", "m1-king-rook-ladder", "m1-ladder-mid-a", "m1-corner-rook-a",
  "m1-corner-rook-b", "m1-knight-rook-a", "m1-two-rooks-adjacent", "m2-two-rooks-a",
  "m2-two-rooks-b", "m2-queen-king-a", "m2-queen-king-b", "m2-two-rooks-mirror",
  "m2-queen-king-mirror", "m3-queen-net-a", "m3-queen-net-b", "m3-queen-net-c",
  "m3-rook-box-a", "m3-rook-box-b", "m3-rook-box-c", "m3-queen-short-side",
];
for (const id of ORIGINAL_24) {
  if (!seenIds.has(id)) errors.push(`original Daily Challenge id missing from library: ${id}`);
}
if (errors.length) {
  console.error("VALIDATION FAILED:\n" + errors.map((e) => "  - " + e).join("\n"));
  process.exit(1);
}

// ---- build the SQL ----
const rows = PUZZLES
  .map((p) => ({ id: p.id, level: p.level, mate_in: p.mateIn, theme: p.theme }))
  .sort((a, b) => a.mate_in - b.mate_in || a.level - b.level || a.id.localeCompare(b.id));

const sqlLit = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const valueLines = rows
  .map((r) => `  (${sqlLit(r.id)}, ${r.level}, ${r.mate_in}, ${sqlLit(r.theme)})`)
  .join(",\n");

const md = { 1: 0, 2: 0, 3: 0 };
const lv = {};
for (const r of rows) { md[r.mate_in]++; lv[r.level] = (lv[r.level] || 0) + 1; }

const sql = `-- Phase 14B: expand the Daily Challenge candidate pool from the original
-- 24 puzzles to the full validated 1,000-puzzle library.
--
-- get_daily_challenge() (migration 0025) selects today's puzzle for a child
-- from public.daily_challenge_puzzles, a METADATA-ONLY mirror of the puzzle
-- library: puzzle_id / level / mate_in / theme -- never FEN. The client
-- already has full puzzle content (FEN + move/checkmate validation) via
-- content/puzzles.ts + lib/chess-engine/puzzleValidation.ts, unchanged.
--
-- This migration is the SAME kind of hand-kept-in-sync seed 0025 used for
-- the first 24 rows, just regenerated for all 1,000 by
-- scripts/generate-daily-challenge-seed.js from content/puzzles.ts (run
-- \`node scripts/generate-daily-challenge-seed.js --check\` in CI to catch
-- drift). \`level\` is the literal output of scripts/compute-puzzle-levels.js
-- as recorded in content/puzzles.ts; \`theme\` and \`mate_in\` are copied
-- verbatim. Rows are sorted (mate_in, level, puzzle_id).
--
-- Deliberately NOT changed by this migration:
--   * daily_challenge_history (schema, data, and its FK to
--     daily_challenge_puzzles.puzzle_id) -- every id 0025 seeded is a subset
--     of the 1,000, so all existing history rows stay valid;
--   * RLS on either table;
--   * get_daily_challenge() / record_daily_challenge_result() -- the RPC
--     logic is unchanged, it simply now has 1,000 candidates instead of 24;
--   * no new tables, no dropped rows (a plain additive upsert -- pruning
--     rows not in the library is intentionally skipped: the FK has no
--     ON DELETE clause, so deleting a puzzle_id referenced by history would
--     fail, and no such row exists to justify the risk).
--
-- Composition of the 1,000: mate-in-1 ${md[1]}, mate-in-2 ${md[2]}, mate-in-3 ${md[3]};
-- level 1 ${lv[1] || 0}, level 2 ${lv[2] || 0}, level 3 ${lv[3] || 0}, level 4 ${lv[4] || 0}, level 5 ${lv[5] || 0}, level 6 ${lv[6] || 0}.

insert into public.daily_challenge_puzzles (puzzle_id, level, mate_in, theme) values
${valueLines}
on conflict (puzzle_id) do update
  set level = excluded.level, mate_in = excluded.mate_in, theme = excluded.theme;
`;

if (process.argv.includes("--check")) {
  const onDisk = fs.existsSync(OUT_SQL) ? fs.readFileSync(OUT_SQL, "utf8") : "";
  if (onDisk === sql) {
    console.log(`OK: ${path.relative(process.cwd(), OUT_SQL)} is up to date (${rows.length} rows).`);
    process.exit(0);
  }
  console.error(`STALE: ${path.relative(process.cwd(), OUT_SQL)} does not match content/puzzles.ts. Re-run without --check.`);
  process.exit(1);
}

fs.writeFileSync(OUT_SQL, sql);
console.log(`wrote ${path.relative(process.cwd(), OUT_SQL)}`);
console.log(`  rows: ${rows.length}`);
console.log(`  mate_in: 1=${md[1]} 2=${md[2]} 3=${md[3]}`);
console.log(`  level:   ${Object.entries(lv).sort().map(([k, v]) => `${k}=${v}`).join(" ")}`);
console.log(`  original 24 Daily Challenge ids: all present`);
console.log(`  themes with apostrophes escaped: ${[...new Set(rows.map((r) => r.theme))].filter((t) => t.includes("'")).length}`);

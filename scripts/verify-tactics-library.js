/**
 * Full-library validation for data/puzzles/tactics-library.json.
 *
 *   node scripts/verify-tactics-library.js
 *
 * Re-checks EVERY puzzle with chess.js, independently of the builder that
 * produced them — the builder could have a bug, so this deliberately does not
 * share code with it. Exits non-zero on any failure so it can gate a build.
 *
 * Checks per puzzle:
 *   - id is unique and namespaced `lc-`
 *   - FEN parses, has exactly one king per side, and the side NOT to move is
 *     not already in check (an impossible position)
 *   - `sideToMove` matches the FEN's actual turn
 *   - every solution move is legal, in sequence
 *   - solutionSan has the same length as solution and matches move-for-move
 *   - a puzzle claiming the `mate` theme really does end in checkmate
 *   - skill and tier are from the known sets, and rating sits in its tier band
 */
const fs = require("fs");
const path = require("path");
const { Chess } = require(path.join(process.cwd(), "node_modules", "chess.js"));

const LIB = path.join(process.cwd(), "data", "puzzles", "tactics-library.json");
const SKILLS = new Set([
  "forks", "pins", "skewers", "discovered_attacks", "piece_safety",
  "king_safety", "tactical_awareness", "calculation", "endgame", "checks",
]);
const TIER_BANDS = { beginner: [500, 1200], intermediate: [1200, 1700], advanced: [1700, 2200] };

const lib = JSON.parse(fs.readFileSync(LIB, "utf8"));
const failures = [];
const ids = new Set();
const dist = {};

function fail(id, why) {
  failures.push(`${id}: ${why}`);
}

for (const p of lib) {
  if (!p.id || !p.id.startsWith("lc-")) fail(p.id ?? "(no id)", "id missing or not namespaced");
  if (ids.has(p.id)) fail(p.id, "duplicate id");
  ids.add(p.id);

  if (!SKILLS.has(p.skill)) fail(p.id, `unknown skill ${p.skill}`);
  const band = TIER_BANDS[p.tier];
  if (!band) fail(p.id, `unknown tier ${p.tier}`);
  else if (!(p.rating >= band[0] && p.rating < band[1])) {
    fail(p.id, `rating ${p.rating} outside ${p.tier} band ${band[0]}-${band[1]}`);
  }

  let game;
  try {
    game = new Chess(p.fen);
  } catch {
    fail(p.id, "FEN does not parse");
    continue;
  }

  const board = game.board().flat().filter(Boolean);
  const wk = board.filter((x) => x.type === "k" && x.color === "w").length;
  const bk = board.filter((x) => x.type === "k" && x.color === "b").length;
  if (wk !== 1 || bk !== 1) fail(p.id, `king count w=${wk} b=${bk}`);

  const flipped = p.fen.replace(/ (w|b) /, (_, c) => ` ${c === "w" ? "b" : "w"} `);
  try {
    if (new Chess(flipped).isCheck()) fail(p.id, "side not to move is already in check");
  } catch {
    /* unflippable FEN is acceptable */
  }

  if (game.turn() !== p.sideToMove) fail(p.id, "sideToMove disagrees with FEN");

  if (!Array.isArray(p.solution) || p.solution.length === 0) {
    fail(p.id, "empty solution");
    continue;
  }
  if (!Array.isArray(p.solutionSan) || p.solutionSan.length !== p.solution.length) {
    fail(p.id, "solutionSan length mismatch");
  }

  let legal = true;
  for (let i = 0; i < p.solution.length; i++) {
    const u = p.solution[i];
    let mv = null;
    try {
      mv = game.move({
        from: u.slice(0, 2),
        to: u.slice(2, 4),
        promotion: u.length > 4 ? u[4] : undefined,
      });
    } catch {
      mv = null;
    }
    if (!mv) {
      fail(p.id, `illegal solution move #${i + 1} (${u})`);
      legal = false;
      break;
    }
    if (p.solutionSan[i] && mv.san !== p.solutionSan[i]) {
      fail(p.id, `SAN mismatch at #${i + 1}: ${mv.san} vs ${p.solutionSan[i]}`);
    }
  }
  if (!legal) continue;

  if (Array.isArray(p.themes) && p.themes.includes("mate") && !game.isCheckmate()) {
    fail(p.id, "claims the mate theme but the line does not end in checkmate");
  }

  const k = `${p.skill}/${p.tier}`;
  dist[k] = (dist[k] || 0) + 1;
}

console.log(`puzzles checked: ${lib.length.toLocaleString()}`);
console.log(`unique ids:      ${ids.size.toLocaleString()}`);
console.log(`buckets:         ${Object.keys(dist).length}`);
const counts = Object.values(dist);
console.log(`per-bucket:      min ${Math.min(...counts)}  max ${Math.max(...counts)}`);
if (failures.length) {
  console.error(`\nFAILURES: ${failures.length}`);
  for (const f of failures.slice(0, 40)) console.error("  " + f);
  process.exit(1);
}
console.log("\nALL PASS — every puzzle is legal, playable and correctly labelled.");

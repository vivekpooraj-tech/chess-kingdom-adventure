// Phase 11 - turn the pre-filtered Lichess CSV (scripts/prefilter-lichess.py
// output) into a ranked, de-duplicated, strictly-validated candidate pool for
// the launch library.
//
//   node scripts/build-launch-library.js <prefiltered.csv> \
//       [--out scripts/puzzle-launch-candidates.json] \
//       [--review scripts/puzzle-launch-review.md] [--workers N]
//
// Pipeline:
//   1. convert each row with scripts/import-puzzles.js (FEN after Moves[0], SAN key move)
//   2. STRICT forced-mate validation with scripts/verify-puzzles.js `verify()`
//      (Lichess "correct" is not enough - the key move must force mate at the
//      exact declared depth against EVERY defence)
//   3. drop exact + normalised-position duplicates, near-duplicates (same
//      piece multiset around the same king square + same key move), and any
//      collision with the shipped 39
//   4. Chess Mind level via the scripts/compute-puzzle-levels.js formula
//   5. a practical 0-100 quality score, then a diversity-capped selection
//
// Heavy work is sharded across worker threads. Writes only the two output
// files - never content/puzzles.ts.

const fs = require("fs");
const path = require("path");
const os = require("os");
const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");
const { Chess } = require("chess.js");
const { verify, isSoundMateInNFirstMove } = require("./verify-puzzles.js");
const { convertLichessRecord, splitCsvLine } = require("./import-puzzles.js");

// ---------- shared helpers ----------

function positionKey(fen) {
  return String(fen).trim().split(/\s+/).slice(0, 4).join(" ");
}
function pieceCount(fen) {
  return fen.split(" ")[0].replace(/[^a-zA-Z]/g, "").length;
}
function pieceSig(fen) {
  return fen.split(" ")[0].replace(/[^a-zA-Z]/g, "").split("").sort().join("");
}
function kingSquares(fen) {
  const g = new Chess(fen);
  const k = {};
  g.board().forEach((row, r) => row.forEach((c, f) => { if (c && c.type === "k") k[c.color] = "abcdefgh"[f] + (8 - r); }));
  return `${k.w || "?"}${k.b || "?"}`;
}
// "near-duplicate" bucket: same material, both kings on the same squares, same
// key move - almost certainly the same idea on a shuffled board.
function nearKey(fen, firstMove) {
  return `${pieceSig(fen)}|${kingSquares(fen)}|${firstMove.replace(/[+#]/g, "")}`;
}

function computeLevel(fen, mateIn) {
  const g = new Chess(fen);
  let candidates, sound;
  if (mateIn === 1) {
    candidates = g.moves({ verbose: true }).filter((m) => /[+#]/.test(m.san)).map((m) => m.san);
    sound = candidates.filter((san) => { const t = new Chess(fen); t.move(san); return t.isCheckmate(); });
  } else {
    candidates = g.moves();
    sound = candidates.filter((san) => isSoundMateInNFirstMove(fen, san, mateIn));
  }
  const precisionRatio = candidates.length ? sound.length / candidates.length : 1;
  let avgReplies = 0;
  if (mateIn >= 2 && sound.length) {
    const after = new Chess(fen); after.move(sound[0]);
    const replies = after.moves();
    if (mateIn === 2) avgReplies = replies.length;
    else {
      let total = replies.length, samples = 1;
      for (const r of replies) {
        const ar = new Chess(after.fen()); ar.move(r);
        const s2 = ar.moves().find((m) => isSoundMateInNFirstMove(ar.fen(), m, mateIn - 1));
        if (s2) { const a2 = new Chess(ar.fen()); a2.move(s2); total += a2.moves().length; samples++; }
      }
      avgReplies = total / samples;
    }
  }
  const harder = mateIn === 1 ? precisionRatio <= 0.34 : avgReplies >= 2;
  return { level: (mateIn - 1) * 2 + 1 + (harder ? 1 : 0), precisionRatio: +precisionRatio.toFixed(2), avgReplies: +avgReplies.toFixed(1) };
}

function qualityScore(c, meta) {
  const pc = c.pieceCount;
  let s = 0;
  if (pc >= 4 && pc <= 14) s += 22;
  else if (pc <= 18) s += 12;
  else if (pc <= 20) s += 5;
  else s += 0;
  if (pc < 4) s += 14;
  if (pc >= 21) s -= 10;

  const r = c.sourceRating || 1200;
  if (r >= 500 && r <= 1400) s += 20;
  else if (r <= 1800) s += 12;
  else if (r < 500) s += 14;
  else s += 3;
  if (r > 1850) s -= 6;

  const pop = meta.pop || 70;
  s += Math.max(0, Math.min(15, ((pop - 70) / 30) * 15));
  s += Math.min(5, Math.log10(Math.max(1, meta.nbplays || 1)));

  if (c.theme && !/^Checkmate in [123]$/.test(c.theme)) s += 4; // small nudge; diversity is handled in selection
  if (/[+#]/.test(c.firstMove)) s += 6;                          // forcing key move
  if (meta.motifs && meta.motifs.length) s += Math.min(6, meta.motifs.length * 2);

  return Math.round(s);
}

// ---------- worker: validate a slice ----------

if (!isMainThread) {
  const { rows, header } = workerData;
  const MOTIFS = ["sacrifice", "deflection", "attraction", "discoveredAttack", "clearance", "pin", "interference", "quietMove", "advancedPawn", "promotion", "doubleCheck", "xRayAttack", "skewer", "fork", "defensiveMove"];
  const out = [];
  let rejected = 0;
  let done = 0;
  for (const cols of rows) {
    if (++done % 100 === 0) parentPort.postMessage({ progress: 100 });
    const rec = {};
    header.forEach((h, i) => (rec[h] = cols[i]));
    let conv;
    try { conv = convertLichessRecord(rec); } catch (e) { conv = { skip: true, reason: "convert threw " + e.message }; }
    if (conv.skip) { rejected++; continue; }
    const cand = conv.candidate;
    const errs = verify(cand);
    if (errs.length) { rejected++; continue; }
    const lvl = computeLevel(cand.fen, cand.mateIn);
    const themes = (rec.Themes || "").split(/\s+/);
    out.push({
      ...cand,
      pieceCount: pieceCount(cand.fen),
      level: lvl.level,
      precisionRatio: lvl.precisionRatio,
      avgReplies: lvl.avgReplies,
      posKey: positionKey(cand.fen),
      nearKey: nearKey(cand.fen, cand.firstMove),
      _meta: { pop: +rec.Popularity || 0, nbplays: +rec.NbPlays || 0, motifs: MOTIFS.filter((m) => themes.includes(m)) },
    });
  }
  parentPort.postMessage({ out, rejected });
  return;
}

// ---------- main ----------

async function main() {
  const args = process.argv.slice(2);
  const argVal = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
  const src = args[0];
  const outPath = argVal("--out") || path.join(__dirname, "puzzle-launch-candidates.json");
  const reviewPath = argVal("--review") || path.join(__dirname, "puzzle-launch-review.md");
  const nWorkers = Number(argVal("--workers")) || Math.max(2, os.cpus().length - 1);

  // Resume mode: skip the ~1h validation and re-run only dedup/score/select
  // from a previously written puzzle-launch-validated-pool.json.
  const fromPool = argVal("--from-pool");
  if (fromPool) {
    const deduped = JSON.parse(fs.readFileSync(fromPool, "utf8"));
    for (const c of deduped) { c._meta = { pop: c.popularity || 0, nbplays: 0, motifs: c.motifs || [] }; c.posKey = positionKey(c.fen); }
    console.log(`resume from validated pool: ${deduped.length}`);
    return finishFromDeduped(deduped, { prefiltered: "(resume)", strictValid: deduped.length, rejected: 0, dupExact: 0, dupNear: 0, dupShipped: 0 }, outPath, reviewPath);
  }

  if (!src || !fs.existsSync(src)) { console.error("prefiltered CSV not found:", src); process.exit(2); }

  const lines = fs.readFileSync(src, "utf8").split(/\r?\n/).filter((l) => l.trim() !== "");
  const header = splitCsvLine(lines[0]);
  const rows = lines.slice(1).map(splitCsvLine);
  console.log(`prefiltered rows: ${rows.length}, workers: ${nWorkers}`);

  // shard
  const shards = Array.from({ length: nWorkers }, () => []);
  rows.forEach((r, i) => shards[i % nWorkers].push(r));

  let progressDone = 0;
  const total = rows.length;
  const tick = setInterval(() => process.stdout.write(`  validated ~${progressDone}/${total}\r`), 5000);
  const results = await Promise.all(shards.map((rows) => new Promise((res, rej) => {
    const w = new Worker(__filename, { workerData: { rows, header } });
    w.on("message", (m) => {
      if (m && m.progress) { progressDone += m.progress; return; }
      res(m); w.terminate();
    });
    w.on("error", rej);
  })));
  clearInterval(tick);
  console.log(`  validated ${total}/${total}          `);

  let valid = results.flatMap((r) => r.out);
  const rejected = results.reduce((a, r) => a + r.rejected, 0);
  console.log(`strict-valid: ${valid.length}, rejected: ${rejected}`);

  // ---- dedup ----
  const shipped = loadShipped();
  const shippedPos = new Set(shipped.map((p) => positionKey(p.fen)));
  const shippedId = new Set(shipped.map((p) => p.id));
  const seenPos = new Set();
  const seenNear = new Set();
  let dupExact = 0, dupNear = 0, dupShipped = 0;
  valid.sort((a, b) => (b._meta.pop || 0) - (a._meta.pop || 0)); // keep the more-played of a dup pair
  const deduped = [];
  for (const c of valid) {
    if (shippedPos.has(c.posKey) || shippedId.has(c.id)) { dupShipped++; continue; }
    if (seenPos.has(c.posKey)) { dupExact++; continue; }
    if (seenNear.has(c.nearKey)) { dupNear++; continue; }
    seenPos.add(c.posKey); seenNear.add(c.nearKey);
    deduped.push(c);
  }
  console.log(`after dedup: ${deduped.length} (exact ${dupExact}, near ${dupNear}, vs shipped ${dupShipped})`);
  return finishFromDeduped(deduped, { prefiltered: rows.length, strictValid: valid.length, rejected, dupExact, dupNear, dupShipped }, outPath, reviewPath);
}

async function finishFromDeduped(deduped, stats, outPath, reviewPath) {
  // ---- score ----
  for (const c of deduped) c.score = qualityScore(c, c._meta);
  deduped.sort((a, b) => b.score - a.score);

  // Persist the FULL validated + de-duped pool (gitignored) so the selection
  // below can be re-tuned later without re-running the 50-minute validation.
  fs.writeFileSync(
    path.join(__dirname, "puzzle-launch-validated-pool.json"),
    JSON.stringify(deduped.map(cleanCandidate), null, 0) + "\n"
  );

  // ---- balanced selection to ~1400 ----
  // A beginner library is mostly *plain* mates (queen+rook, back-rank, simple
  // king boxes); named patterns are a garnish, not the substance. So: aim
  // each depth ~58% generic, and cap every single named pattern low.
  const TARGET = { 1: 350, 2: 620, 3: 430 };
  const GENERIC_MIN = { 1: 200, 2: 360, 3: 250 };   // at least this many "Checkmate in N"
  const NAMED_CAP = { 1: 26, 2: 34, 3: 26 };        // per named pattern, per depth
  // Rarely-taught curios - keep a handful for flavour, no more.
  const EXOTIC = new Set(["Balestra Mate", "Blind Swine Mate", "Morphys Mate", "Swallowstail Mate", "Triangle Mate", "Dovetail Mate"]);
  const EXOTIC_CAP = { 1: 8, 2: 10, 3: 8 };
  const isGeneric = (c) => /^Checkmate in [123]$/.test(c.theme);

  const picked = [];
  const countBy = { mate: { 1: 0, 2: 0, 3: 0 }, generic: { 1: 0, 2: 0, 3: 0 }, theme: {} };
  function tryPick(c, { genericPhase = false } = {}) {
    const m = c.mateIn;
    if (countBy.mate[m] >= TARGET[m]) return false;
    if (genericPhase && !isGeneric(c)) return false;
    if (!genericPhase && isGeneric(c) && countBy.generic[m] >= TARGET[m] - GENERIC_MIN[m]) {
      // non-generic quota is what's left; don't let generic overshoot in this phase
    }
    if (!isGeneric(c)) {
      const cap = EXOTIC.has(c.theme) ? EXOTIC_CAP[m] : NAMED_CAP[m];
      const tk = m + "|" + c.theme;
      if ((countBy.theme[tk] || 0) >= cap) return false;
      countBy.theme[tk] = (countBy.theme[tk] || 0) + 1;
    } else {
      countBy.generic[m]++;
    }
    picked.push(c); countBy.mate[m]++;
    return true;
  }
  // phase 1: guarantee the generic floor (highest-scored generic first)
  for (const c of deduped) { if (countBy.generic[c.mateIn] < GENERIC_MIN[c.mateIn]) tryPick(c, { genericPhase: true }); }
  // phase 2: fill the rest by score, named patterns capped
  for (const c of deduped) { if (!picked.includes(c)) tryPick(c); }
  // phase 3: top-up any short depth with whatever's left (caps relaxed)
  for (const c of deduped) {
    if (picked.includes(c)) continue;
    if (countBy.mate[c.mateIn] >= TARGET[c.mateIn]) continue;
    picked.push(c); countBy.mate[c.mateIn]++;
  }
  console.log("generic count by depth:", countBy.generic);

  const finalCands = picked.map(cleanCandidate);
  fs.writeFileSync(outPath, JSON.stringify(finalCands, null, 2) + "\n");

  writeReview(reviewPath, {
    prefiltered: stats.prefiltered,
    strictValid: stats.strictValid,
    rejected: stats.rejected,
    dupExact: stats.dupExact, dupNear: stats.dupNear, dupShipped: stats.dupShipped,
    deduped: deduped.length,
    picked,
    outPath, reviewPath,
  });

  console.log(`\nwrote ${finalCands.length} candidates -> ${outPath}`);
  console.log(`wrote review -> ${reviewPath}`);
  console.log("mate mix:", countBy.mate);
}

function cleanCandidate(c) {
  return {
    id: c.id, fen: c.fen, sideToMove: c.sideToMove, mateIn: c.mateIn,
    theme: c.theme, firstMove: c.firstMove, level: c.level,
    pieceCount: c.pieceCount, score: c.score,
    source: "lichess", sourceId: c.sourceId, sourceRating: c.sourceRating,
    popularity: c._meta.pop, motifs: c._meta.motifs,
  };
}

function loadShipped() {
  const s = fs.readFileSync(path.join(__dirname, "..", "content", "puzzles.ts"), "utf8");
  const m = s.match(/export const PUZZLES: ChessPuzzle\[\] = (\[[\s\S]*?\n\]);/);
  // eslint-disable-next-line no-eval
  return eval(m[1]);
}

function dist(arr, keyFn, buckets) {
  const d = {};
  for (const x of arr) { const k = keyFn(x); d[k] = (d[k] || 0) + 1; }
  return d;
}

function writeReview(p, ctx) {
  const P = ctx.picked;
  const byMate = (n) => P.filter((c) => c.mateIn === n);
  const themeDist = {};
  for (const c of P) { const k = `m${c.mateIn} ${c.theme}`; themeDist[k] = (themeDist[k] || 0) + 1; }
  const levelDist = dist(P, (c) => c.level);
  const pcBuckets = { "3-6": 0, "7-12": 0, "13-20": 0, "21+": 0 };
  for (const c of P) {
    if (c.pieceCount <= 6) pcBuckets["3-6"]++;
    else if (c.pieceCount <= 12) pcBuckets["7-12"]++;
    else if (c.pieceCount <= 20) pcBuckets["13-20"]++;
    else pcBuckets["21+"]++;
  }
  const ratingBuckets = { "<500": 0, "500-899": 0, "900-1299": 0, "1300-1699": 0, "1700-2000": 0 };
  for (const c of P) {
    const r = c.sourceRating || 0;
    if (r < 500) ratingBuckets["<500"]++;
    else if (r < 900) ratingBuckets["500-899"]++;
    else if (r < 1300) ratingBuckets["900-1299"]++;
    else if (r < 1700) ratingBuckets["1300-1699"]++;
    else ratingBuckets["1700-2000"]++;
  }
  const popBuckets = { "70-79": 0, "80-89": 0, "90-99": 0, "100": 0 };
  for (const c of P) {
    const v = c._meta.pop;
    if (v >= 100) popBuckets["100"]++;
    else if (v >= 90) popBuckets["90-99"]++;
    else if (v >= 80) popBuckets["80-89"]++;
    else popBuckets["70-79"]++;
  }

  let md = "# Phase 11 - launch library candidate pool\n\n";
  md += "Source: Lichess open puzzle DB (CC0), streamed from the compressed .zst (never fully decompressed / never in Git).\n\n";
  md += "| stage | count |\n|---|---|\n";
  md += `| pre-filtered rows (cheap filters + stratified sampling) | ${ctx.prefiltered} |\n`;
  md += `| strict forced-mate validation passed | ${ctx.strictValid} |\n`;
  md += `| strict validation rejected | ${ctx.rejected} |\n`;
  md += `| exact-position duplicates removed | ${ctx.dupExact} |\n`;
  md += `| near-duplicate positions removed | ${ctx.dupNear} |\n`;
  md += `| collided with shipped 39 | ${ctx.dupShipped} |\n`;
  md += `| unique validated candidates | ${ctx.deduped} |\n`;
  md += `| **selected into candidate pool** | **${P.length}** |\n\n`;

  md += `## Selected by mate depth\n\n- mate-in-1: ${byMate(1).length}\n- mate-in-2: ${byMate(2).length}\n- mate-in-3: ${byMate(3).length}\n\n`;

  md += "## Recommended 1,000-puzzle composition\n\n";
  md += "| depth | recommended | available in pool |\n|---|---|---|\n";
  md += `| mate-in-1 | 250 | ${byMate(1).length} |\n| mate-in-2 | 450 | ${byMate(2).length} |\n| mate-in-3 | 300 | ${byMate(3).length} |\n\n`;
  md += "Take the top-scored N per depth from the candidate JSON (it is pre-sorted by score within the diversity caps).\n\n";

  md += "## Theme distribution (selected)\n\n| theme | count |\n|---|---|\n";
  for (const [k, v] of Object.entries(themeDist).sort((a, b) => b[1] - a[1])) md += `| ${k} | ${v} |\n`;

  md += "\n## Level distribution (compute-puzzle-levels.js formula)\n\n| level | count |\n|---|---|\n";
  for (const [k, v] of Object.entries(levelDist).sort()) md += `| ${k} | ${v} |\n`;

  md += "\n## Piece-count distribution\n\n| bucket | count |\n|---|---|\n";
  for (const [k, v] of Object.entries(pcBuckets)) md += `| ${k} | ${v} |\n`;

  md += "\n## Rating distribution (Lichess)\n\n| bucket | count |\n|---|---|\n";
  for (const [k, v] of Object.entries(ratingBuckets)) md += `| ${k} | ${v} |\n`;

  md += "\n## Popularity distribution (Lichess)\n\n| bucket | count |\n|---|---|\n";
  for (const [k, v] of Object.entries(popBuckets)) md += `| ${k} | ${v} |\n`;

  md += "\n## Notes / quality concerns\n\n";
  md += "- Strict validation is far harsher than Lichess: a large share of Lichess mate-in-3 puzzles are not a *forced* mate against every defence and were rejected here.\n";
  md += "- `level` only ever resolves to 1-2 (m1), 3-4 (m2), 5-6 (m3) - the existing formula never maps a mate-in-3 to level 4. Preserved as-is.\n";
  md += "- Candidates carry `source`/`sourceId`/`sourceRating`/`popularity`/`motifs` for review & provenance; these are NOT part of the ChessPuzzle shape and must be dropped (keep id/fen/sideToMove/mateIn/theme/level) at ingestion.\n";
  md += "- Nothing here is ingested. content/puzzles.ts, Supabase, Daily Challenge and runtime code are untouched.\n";

  fs.writeFileSync(p, md);
}

main().catch((e) => { console.error(e); process.exit(1); });

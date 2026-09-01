// Phase 12A - curate the launch library from the already-validated pool.
//
//   node scripts/curate-launch-library.js
//
// Input : scripts/puzzle-launch-validated-pool.json  (4,137 strictly-valid, de-duped)
//         content/puzzles.ts                          (the 39 shipped, kept as-is)
// Output: scripts/puzzle-launch-final.json            (~961 proposed NEW puzzles)
//         scripts/puzzle-launch-final-review.md       (human review report)
//
// No chess re-validation (the pool is already strictly validated). No network.
// Deterministic: every tie is broken by id, so re-running gives the same set.
// Never touches content/puzzles.ts or Supabase.

const fs = require("fs");
const path = require("path");
const { Chess } = require("chess.js");

const POOL_PATH = path.join(__dirname, "puzzle-launch-validated-pool.json");
const OUT_JSON = path.join(__dirname, "puzzle-launch-final.json");
const OUT_MD = path.join(__dirname, "puzzle-launch-final-review.md");

const pool = JSON.parse(fs.readFileSync(POOL_PATH, "utf8"));
const shippedSrc = fs.readFileSync(path.join(__dirname, "..", "content", "puzzles.ts"), "utf8");
// eslint-disable-next-line no-eval
const SHIPPED = eval(shippedSrc.match(/export const PUZZLES: ChessPuzzle\[\] = (\[[\s\S]*?\n\]);/)[1]);

// ---------- helpers ----------
const isGeneric = (t) => /^Checkmate in [123]$/.test(t);
const posKey = (fen) => fen.trim().split(/\s+/).slice(0, 4).join(" ");
const pieceSig = (fen) => fen.split(" ")[0].replace(/[^a-zA-Z]/g, "").split("").sort().join("");

function kingSquares(fen) {
  const g = new Chess(fen);
  const k = {};
  g.board().forEach((row, r) => row.forEach((c, f) => { if (c && c.type === "k") k[c.color] = "abcdefgh"[f] + (8 - r); }));
  return { w: k.w, b: k.b };
}
function edgeClass(sq) {
  if (!sq) return "?";
  const f = sq[0], r = sq[1];
  const corner = (f === "a" || f === "h") && (r === "1" || r === "8");
  const edge = f === "a" || f === "h" || r === "1" || r === "8";
  return corner ? "corner" : edge ? "edge" : "centre";
}
// A "same idea" fingerprint: material + which side/where the defending king is +
// what kind of move delivers the blow. Two candidates sharing this are almost
// certainly the same lesson on a shuffled board.
function ideaKey(c) {
  const ks = kingSquares(c.fen);
  const defKing = c.sideToMove === "w" ? ks.b : ks.w;
  const mv = c.firstMove;
  const pieceLetter = /^[KQRBN]/.test(mv) ? mv[0] : "P";
  const kind = pieceLetter + (/x/.test(mv) ? "x" : "") + (/#/.test(mv) ? "#" : /\+/.test(mv) ? "+" : "");
  return [c.mateIn, pieceSig(c.fen), defKing, edgeClass(defKing), kind].join("|");
}

// ---------- curation score ----------
function curationScore(c) {
  let s = c.score; // pipeline quality score (already blends pieces/rating/pop/etc.)
  // beginner-friendliness nudges on top:
  const r = c.sourceRating || 1200;
  if (r <= 900) s += 8; else if (r <= 1200) s += 4; else if (r > 1600) s -= 4;
  const pop = c.popularity || 0;
  if (pop >= 98) s += 4; else if (pop < 85) s -= 3;
  // piece count appropriate for depth
  const pc = c.pieceCount;
  if (c.mateIn === 1 && pc <= 10) s += 5;
  if (c.mateIn === 2 && pc <= 12) s += 4;
  if (c.mateIn === 3 && pc <= 9) s += 3;
  if (pc >= 17) s -= 6;
  // a plain, checking first move reads clearly for a learner
  if (/[+#]/.test(c.firstMove)) s += 3;
  return s;
}

// ---------- de-duplicate-feel clustering ----------
for (const c of pool) { c._idea = ideaKey(c); c._cur = curationScore(c); }
const clusters = new Map();
for (const c of pool) {
  if (!clusters.has(c._idea)) clusters.set(c._idea, []);
  clusters.get(c._idea).push(c);
}
const clusterReport = [];
const declustered = [];
for (const [key, members] of clusters) {
  members.sort((a, b) => b._cur - a._cur || a.id.localeCompare(b.id));
  declustered.push(members[0]);
  if (members.length > 1) {
    clusterReport.push({ key, n: members.length, kept: members[0].id, rejected: members.slice(1).map((m) => m.id) });
  }
}
const clusterDupRemoved = pool.length - declustered.length;

// ---------- shortlist (~1,150) ----------
declustered.sort((a, b) => b._cur - a._cur || a.id.localeCompare(b.id));
// keep a generous head per depth for the final selection to draw from
const shortlist = [];
const slBy = { 1: 0, 2: 0, 3: 0 };
const SL_CAP = { 1: 470, 2: 500, 3: 260 };
for (const c of declustered) {
  if (slBy[c.mateIn] >= SL_CAP[c.mateIn]) continue;
  shortlist.push(c); slBy[c.mateIn]++;
}

// ---------- final selection (~961 new) ----------
const shippedThemes = {};
for (const p of SHIPPED) shippedThemes[p.theme] = (shippedThemes[p.theme] || 0) + 1;

const TARGET_NEW = { 1: 362, 2: 409, 3: 190 };            // final ~1000 incl. the 39
const LEVEL_TARGET_NEW = { 1: 197, 2: 170, 3: 365, 4: 49, 5: 175, 6: 5 };
const NAMED_CAP_FINAL = 46;                                // ~5% of 1000 minus what the 39 already carry
const EXOTIC = new Set(["Balestra Mate", "Blind Swine Mate", "Morphys Mate", "Triangle Mate", "Bodens Mate", "Boden's Mate"]);
const EXOTIC_CAP = 6;
// ensure a beginner visual tier: this many NEW m1 puzzles must be <= 8 pieces
const M1_SPARSE_MIN = 90;

const picked = [];
const cnt = { mate: { 1: 0, 2: 0, 3: 0 }, level: {}, theme: {}, m1sparse: 0 };
function fits(c) {
  const m = c.mateIn;
  if (cnt.mate[m] >= TARGET_NEW[m]) return false;
  if ((cnt.level[c.level] || 0) >= LEVEL_TARGET_NEW[c.level]) return false;
  if (!isGeneric(c.theme)) {
    const cap = EXOTIC.has(c.theme) ? EXOTIC_CAP : NAMED_CAP_FINAL;
    if ((cnt.theme[c.theme] || 0) >= cap) return false;
  }
  return true;
}
function commit(c) {
  picked.push(c);
  cnt.mate[c.mateIn]++;
  cnt.level[c.level] = (cnt.level[c.level] || 0) + 1;
  if (!isGeneric(c.theme)) cnt.theme[c.theme] = (cnt.theme[c.theme] || 0) + 1;
  if (c.mateIn === 1 && c.pieceCount <= 8) cnt.m1sparse++;
}
// phase A: guarantee the sparse m1 beginner tier
for (const c of shortlist) {
  if (cnt.m1sparse >= M1_SPARSE_MIN) break;
  if (c.mateIn === 1 && c.pieceCount <= 8 && fits(c)) commit(c);
}
// phase B: fill to target by curation score, respecting level + theme caps
for (const c of shortlist) {
  if (picked.includes(c)) continue;
  if (fits(c)) commit(c);
}
// phase C: top up any depth still short, relaxing the LEVEL cap (keep theme cap)
for (const c of shortlist) {
  if (picked.includes(c)) continue;
  const m = c.mateIn;
  if (cnt.mate[m] >= TARGET_NEW[m]) continue;
  if (!isGeneric(c.theme) && (cnt.theme[c.theme] || 0) >= (EXOTIC.has(c.theme) ? EXOTIC_CAP : NAMED_CAP_FINAL)) continue;
  commit(c);
}
// phase D: last-resort top up from the full declustered set (still no dup ideas)
if (picked.length < 955) {
  for (const c of declustered) {
    if (picked.includes(c)) continue;
    const m = c.mateIn;
    if (cnt.mate[m] >= TARGET_NEW[m]) continue;
    commit(c);
  }
}

// ---------- sanity: no id / position / shipped collisions ----------
const shippedPos = new Set(SHIPPED.map((p) => posKey(p.fen)));
const shippedId = new Set(SHIPPED.map((p) => p.id));
const seenId = new Set(), seenPos = new Set();
const final = [];
for (const c of picked) {
  if (shippedId.has(c.id) || shippedPos.has(posKey(c.fen))) continue;
  if (seenId.has(c.id) || seenPos.has(posKey(c.fen))) continue;
  seenId.add(c.id); seenPos.add(posKey(c.fen));
  final.push(c);
}

// ---------- write final.json ----------
const finalOut = final
  .sort((a, b) => a.mateIn - b.mateIn || a.level - b.level || a.id.localeCompare(b.id))
  .map((c) => ({
    id: c.id,
    fen: c.fen,
    sideToMove: c.sideToMove,
    mateIn: c.mateIn,
    firstMove: c.firstMove,
    theme: c.theme,
    level: c.level,
    source: "lichess",
    sourceId: c.sourceId,
    sourceRating: c.sourceRating,
    sourcePopularity: c.popularity,
  }));
fs.writeFileSync(OUT_JSON, JSON.stringify(finalOut, null, 2) + "\n");

// ---------- targeted manual-review set (50-100) ----------
const reviewFlags = [];
for (const c of final) {
  const reasons = [];
  if (c.mateIn === 3 && (c._cur < 66 || c.pieceCount >= 9)) reasons.push("borderline mate-in-3");
  if (c.pieceCount >= 16) reasons.push("high piece count");
  if (EXOTIC.has(c.theme)) reasons.push("rare named pattern");
  if ((c.sourceRating || 0) >= 1550) reasons.push("rating >= 1550");
  if ((c.popularity || 0) < 85) reasons.push("popularity < 85");
  if (reasons.length) reviewFlags.push({ id: c.id, mateIn: c.mateIn, level: c.level, pieces: c.pieceCount, rating: c.sourceRating, pop: c.popularity, theme: c.theme, fen: c.fen, firstMove: c.firstMove, reasons });
}
// cap the review list at ~90 - hardest / most-uncertain first
reviewFlags.sort((a, b) => b.reasons.length - a.reasons.length || (a.mateIn === 3 ? -1 : 1));
const reviewSet = reviewFlags.slice(0, 90);

// ---------- Daily Challenge future subset (~430) ----------
// Favour a satisfying once-a-day idea: moderate difficulty, checking key move,
// clear board, spread across levels. Selected SEPARATELY from launch order.
const dailyPref = final
  .filter((c) => /[+#]/.test(c.firstMove) && c.pieceCount <= 14 && (c.sourceRating || 0) >= 650 && (c.sourceRating || 0) <= 1500 && (c.popularity || 0) >= 90)
  .sort((a, b) => b._cur - a._cur || a.id.localeCompare(b.id));
const dailyByLevel = { 1: 60, 2: 70, 3: 150, 4: 40, 5: 100, 6: 5 };
const daily = [];
const dcnt = {};
for (const c of dailyPref) {
  if ((dcnt[c.level] || 0) >= (dailyByLevel[c.level] || 0)) continue;
  daily.push(c.id); dcnt[c.level] = (dcnt[c.level] || 0) + 1;
}

// ---------- review markdown ----------
const g = (arr, f) => arr.reduce((a, x) => { const k = f(x); a[k] = (a[k] || 0) + 1; return a; }, {});
const pcBand = (p) => p <= 8 ? "3-8" : p <= 12 ? "9-12" : p <= 16 ? "13-16" : "17+";
const ratingBand = (r) => !r ? "?" : r < 700 ? "<700" : r < 1000 ? "700-999" : r < 1300 ? "1000-1299" : r < 1600 ? "1300-1599" : "1600+";
const tier = (c) => (c.mateIn === 1 && (c.level <= 1 || c.pieceCount <= 12)) ? "beginner"
  : (c.mateIn === 3 || c.level >= 5 || c.pieceCount >= 17) ? "advanced" : "intermediate";

const combined = [...SHIPPED.map((p) => ({ ...p, pieceCount: p.fen.split(" ")[0].replace(/[^a-zA-Z]/g, "").length, sourceRating: null, popularity: null, _origin: "hand" })), ...final.map((c) => ({ ...c, _origin: "lichess" }))];

let md = "# Phase 12A - launch library final candidate set\n\n";
md += "Curated deterministically from `scripts/puzzle-launch-validated-pool.json` (4,137 strictly-validated, de-duped). ";
md += "No chess re-validation, no network. The 39 hand-crafted puzzles are untouched.\n\n";
md += "**Confidence labels:** every entry is TECHNICALLY VALID (strict forced-mate check already passed). ";
md += "Selection & ordering are CURATED BY HEURISTIC (rating / popularity / piece-count / theme-diversity / idea-clustering). ";
md += "The ~90 flagged below REQUIRE HUMAN REVIEW.\n\n";

md += "## 1-3. Totals\n\n";
md += `| | count |\n|---|---|\n| existing hand-crafted (kept) | ${SHIPPED.length} |\n| new selected (this file) | ${final.length} |\n| **launch library total** | **${SHIPPED.length + final.length}** |\n\n`;

md += "## 4. Mate distribution\n\n| depth | existing | new | total | target total |\n|---|---|---|---|---|\n";
for (const m of [1, 2, 3]) {
  const e = SHIPPED.filter((p) => p.mateIn === m).length;
  const n = final.filter((c) => c.mateIn === m).length;
  md += `| mate-in-${m} | ${e} | ${n} | ${e + n} | ~${{ 1: 380, 2: 420, 3: 200 }[m]} |\n`;
}

md += "\n## 5. Level distribution\n\n| level | existing | new | total | target total |\n|---|---|---|---|---|\n";
for (const l of [1, 2, 3, 4, 5, 6]) {
  const e = SHIPPED.filter((p) => p.level === l).length;
  const n = final.filter((c) => c.level === l).length;
  md += `| ${l} | ${e} | ${n} | ${e + n} | ~${{ 1: 210, 2: 175, 3: 375, 4: 50, 5: 185, 6: 5 }[l]} |\n`;
}

md += "\n## 6. Theme distribution (final total library)\n\n| theme | count | % of library |\n|---|---|---|\n";
const themeDist = g(combined, (c) => c.theme);
for (const [t, v] of Object.entries(themeDist).sort((a, b) => b[1] - a[1])) {
  md += `| ${t} | ${v} | ${(v / combined.length * 100).toFixed(1)}% |\n`;
}
const topNamed = Object.entries(themeDist).filter(([t]) => !isGeneric(t)).sort((a, b) => b[1] - a[1])[0];
md += `\nLargest single **named** theme: ${topNamed[0]} = ${(topNamed[1] / combined.length * 100).toFixed(1)}% (cap target: <=5%).\n`;

md += "\n## 7. Piece-count distribution\n\n| band | existing | new | total |\n|---|---|---|---|\n";
for (const b of ["3-8", "9-12", "13-16", "17+"]) {
  const e = SHIPPED.filter((p) => pcBand(p.fen.split(" ")[0].replace(/[^a-zA-Z]/g, "").length) === b).length;
  const n = final.filter((c) => pcBand(c.pieceCount) === b).length;
  md += `| ${b} | ${e} | ${n} | ${e + n} |\n`;
}

md += "\n## 8. Source-rating distribution (new puzzles)\n\n| band | count |\n|---|---|\n";
for (const [b, v] of Object.entries(g(final, (c) => ratingBand(c.sourceRating))).sort()) md += `| ${b} | ${v} |\n`;

const tiers = g(combined, tier);
md += "\n## 9-12. Suitability tiers (whole library)\n\n";
md += `- **beginner-suitable:** ${tiers.beginner || 0} (${((tiers.beginner || 0) / combined.length * 100).toFixed(0)}%)\n`;
md += `- **intermediate:** ${tiers.intermediate || 0} (${((tiers.intermediate || 0) / combined.length * 100).toFixed(0)}%)\n`;
md += `- **advanced:** ${tiers.advanced || 0} (${((tiers.advanced || 0) / combined.length * 100).toFixed(0)}%)\n`;
md += `- new m1 puzzles at <=8 pieces (the "first puzzles" visual tier): ${final.filter((c) => c.mateIn === 1 && c.pieceCount <= 8).length}, plus ${SHIPPED.filter((p) => p.fen.split(" ")[0].replace(/[^a-zA-Z]/g, "").length <= 8).length} from the hand-crafted 39\n`;

md += "\n## 13. Duplicate-feel clusters removed\n\n";
md += `Idea fingerprint = mate depth + piece multiset + defending-king square + king-square edge class + first-move type (piece / capture / check-vs-mate).\n\n`;
md += `- clusters with >1 member: **${clusterReport.length}**\n- candidates dropped as same-idea duplicates: **${clusterDupRemoved}**\n- (kept the highest curation-score representative of each)\n\n`;
md += "Largest 15 clusters:\n\n| idea key | candidates | kept | dropped |\n|---|---|---|---|\n";
for (const c of clusterReport.sort((a, b) => b.n - a.n).slice(0, 15)) {
  md += `| \`${c.key}\` | ${c.n} | ${c.kept} | ${c.rejected.slice(0, 4).join(", ")}${c.rejected.length > 4 ? " ..." : ""} |\n`;
}

md += "\n## 14. Remaining questionable groups (still in the set)\n\n";
const stillGeneric = final.filter((c) => isGeneric(c.theme)).length;
md += `- ${stillGeneric} entries carry only the generic "Checkmate in N" label (Lichess did not tag a named pattern). Not a defect - most are ordinary Q/R/K nets - but a curator may want to spot-check and re-label the clearest.\n`;
const bigIdea = {};
for (const c of final) { const k = [c.mateIn, pieceSig(c.fen).length, c.theme].join("|"); bigIdea[k] = (bigIdea[k] || 0) + 1; }
const clumps = Object.entries(bigIdea).filter(([, v]) => v >= 12).sort((a, b) => b[1] - a[1]);
md += `- ${clumps.length} loose material+theme groups have >=12 members (same depth, same material size, same theme). Not identical, but a reviewer should confirm they don't feel samey: ${clumps.slice(0, 8).map(([k, v]) => `${k}=${v}`).join(", ")}\n`;

md += "\n## 15. Exclusions & reasons\n\n";
md += `- ${pool.length - declustered.length} dropped as same-idea duplicates (clustering above).\n`;
md += `- ${declustered.length - shortlist.length} outside the per-depth shortlist caps (lower curation score than the ${shortlist.length} kept).\n`;
md += `- ${shortlist.length - picked.length} in the shortlist but not selected: depth already at target, level band full, or named-theme cap hit.\n`;
md += `- mate-in-3 is supply-limited: only ${pool.filter((c) => c.mateIn === 3).length} valid m3 exist in the whole pool (strict validation rejects ~85% of Lichess m3), so m3 is ${final.filter((c) => c.mateIn === 3).length} rather than a larger share.\n`;

md += "\n## 16. Targeted manual-review set (" + reviewSet.length + " boards)\n\n";
md += "Review THESE, not the whole library. Ordered hardest / least-certain first.\n\n";
md += "| id | m | lvl | pc | rating | pop | theme | firstMove | why |\n|---|---|---|---|---|---|---|---|---|\n";
for (const r of reviewSet) md += `| ${r.id} | ${r.mateIn} | ${r.level} | ${r.pieces} | ${r.rating} | ${r.pop} | ${r.theme} | ${r.firstMove} | ${r.reasons.join("; ")} |\n`;

md += "\n## Daily Challenge future subset (recommendation only - no migration here)\n\n";
md += `Separately selected ${daily.length} of the new puzzles as strong Daily candidates (checking key move, <=14 pieces, rating 650-1500, popularity >=90, spread across levels ${JSON.stringify(dcnt)}). `;
md += `Combine with a hand-pick from the 39 to reach ~430-450. IDs listed in \`puzzle-launch-final.json\` are the source; the Daily list itself is:\n\n`;
md += "```\n" + daily.join("\n") + "\n```\n";

fs.writeFileSync(OUT_MD, md);

// ---------- console summary ----------
console.log("clusters >1:", clusterReport.length, "| same-idea dropped:", clusterDupRemoved);
console.log("declustered:", declustered.length, "| shortlist:", shortlist.length);
console.log("FINAL new:", final.length);
console.log("  mate:", g(final, (c) => c.mateIn));
console.log("  level:", g(final, (c) => c.level));
console.log("  piece band:", g(final, (c) => pcBand(c.pieceCount)));
console.log("  generic/named:", final.filter((c) => isGeneric(c.theme)).length, "/", final.filter((c) => !isGeneric(c.theme)).length);
console.log("  m1 <=8 pieces:", final.filter((c) => c.mateIn === 1 && c.pieceCount <= 8).length);
console.log("  review set:", reviewSet.length, "| daily subset:", daily.length);
console.log("wrote", OUT_JSON);
console.log("wrote", OUT_MD);

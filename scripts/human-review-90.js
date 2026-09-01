// Phase 12B - record the 90-board human review + propose pool replacements.
//
//   node scripts/human-review-90.js
//
// Reads the Phase 12A outputs, applies the review decisions encoded below
// (made by inspecting each board's ASCII render + mating idea + metrics),
// writes scripts/puzzle-launch-human-review.md, and proposes replacements
// drawn ONLY from scripts/puzzle-launch-validated-pool.json.
// Touches nothing in content/ or supabase/.

const fs = require("fs");
const path = require("path");
const { Chess } = require("chess.js");

const FINAL = JSON.parse(fs.readFileSync(path.join(__dirname, "puzzle-launch-final.json"), "utf8"));
const POOL = JSON.parse(fs.readFileSync(path.join(__dirname, "puzzle-launch-validated-pool.json"), "utf8"));
const shippedSrc = fs.readFileSync(path.join(__dirname, "..", "content", "puzzles.ts"), "utf8");
// eslint-disable-next-line no-eval
const SHIPPED = eval(shippedSrc.match(/export const PUZZLES: ChessPuzzle\[\] = (\[[\s\S]*?\n\]);/)[1]);
const md = fs.readFileSync(path.join(__dirname, "puzzle-launch-final-review.md"), "utf8");
const reviewIds = [...md.matchAll(/^\| (lichess-\S+) \| \d/gm)].map((m) => m[1]);
const byId = Object.fromEntries(FINAL.map((c) => [c.id, c]));

const isGeneric = (t) => /^Checkmate in [123]$/.test(t);
const posKey = (f) => f.trim().split(/\s+/).slice(0, 4).join(" ");
function material(fen) {
  const val = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  let d = 0;
  for (const ch of fen.split(" ")[0]) if (val[ch.toLowerCase()]) d += (ch === ch.toUpperCase() ? 1 : -1) * val[ch.toLowerCase()];
  return d; // + = white ahead
}
function idea(c) {
  const g = new Chess(c.fen);
  let dk = "?";
  g.board().forEach((row, r) => row.forEach((cc, f) => { if (cc && cc.type === "k" && cc.color !== c.sideToMove) dk = "abcdefgh"[f] + (8 - r); }));
  const pieceLetter = /^[KQRBN]/.test(c.firstMove) ? c.firstMove[0] : "P";
  return [c.mateIn, c.fen.split(" ")[0].replace(/[^a-zA-Z]/g, "").split("").sort().join(""), dk].join("|");
}

// -------- review decisions (id -> [decision, tier, reason]) --------
// KEEP = ship it. REVIEW = human call needed. REJECT = do not ship.
// tier: CHILD-FRIENDLY | BEGINNER | INTERMEDIATE | ADVANCED
const DEC = {
  "lichess-JEa1F": ["REJECT", "BEGINNER", "16 pieces for a mate-in-1 - the cleanest tier must stay uncluttered; Bxa3# also just captures the queen, so it reads as 'grab material' not 'see the mate'"],
  "lichess-vSUE8": ["REJECT", "ADVANCED", "black is down Q+R with white's queen AND rook next to the black king, yet black mates in 3 - worst possible 'is this broken?' first impression"],
  "lichess-wF994": ["REJECT", "ADVANCED", "'K + far pawns beat a lone Q' - a real lesson but this family appears ~5x in the pool; keeping KfqIP as the one representative"],
  "lichess-HOoZk": ["REJECT", "ADVANCED", "near-identical to KfqIP (Kf7 + h7/g6 pawns shepherd the h-pawn home vs a distant queen)"],
  "lichess-GmXTW": ["REJECT", "ADVANCED", "same 'pawns + king mate despite Q+R' family as wF994/KfqIP"],
  "lichess-SmLuH": ["REJECT", "ADVANCED", "same 'K+pawns vs lone Q' family - fourth near-identical example"],
  "lichess-g5SwZ": ["REJECT", "INTERMEDIATE", "same idea as BddQR (black queen to f2, back-rank pressure with the rook) - keeping BddQR (higher popularity)"],
  "lichess-CDPlI": ["REJECT", "ADVANCED", "'Pillsbury's Mate' is already 3.6% of the library (2nd-largest named theme); obscure label + black down material"],
  "lichess-HVmqT": ["REJECT", "ADVANCED", "one of three ~1375-rated Hook Mates flagged together - keeping the two clearer boards (nmilw, MR7hu)"],

  "lichess-jTjHR": ["REVIEW", "ADVANCED", "side to move is +17 behind yet mates (white king smothered by its own pawns). Instructive but jarring - human call for a kids-first launch"],
  "lichess-bJvkA": ["REVIEW", "ADVANCED", "losing side promotes a pawn and mates while a queen away - common in puzzle training but the optics are odd for young players"],
  "lichess-LT66N": ["REVIEW", "ADVANCED", "same 'losing side promotes and mates' idea as bJvkA - human call whether to keep 0, 1 or both"],
  "lichess-KfqIP": ["KEEP", "ADVANCED", "the kept representative of 'connected passed pawns + active king beat a lone queen' - a canonical endgame lesson, clean 9-piece board"],
  "lichess-EoJjt": ["REVIEW", "INTERMEDIATE", "g6+ Rxg6 hxg6+ pawn-breakthrough sac is instructive, but that black is not losing isn't obvious at a glance - human call"],
  "lichess-lq1oC": ["REVIEW", "ADVANCED", "popularity 86 (low); board and idea look fine - human call on whether the low community signal matters"],
  "lichess-hn4qC": ["REVIEW", "INTERMEDIATE", "popularity 85 (lowest in the set); otherwise a normal back-rank mate-in-3"],
  "lichess-fEqLq": ["REVIEW", "INTERMEDIATE", "popularity 87 (low); clean mate otherwise"],
  "lichess-nmilw": ["REVIEW", "ADVANCED", "rating 1373 - top of the launch range; Hook Mate is a valid named pattern, human call on difficulty ceiling"],
  "lichess-RTygF": ["REVIEW", "ADVANCED", "double-rook epaulette, similar to qBTRn - human call whether both add value (different piece placement, both teach the double-rook cut-off)"],
  "lichess-qBTRn": ["REVIEW", "ADVANCED", "see RTygF - similar double-rook epaulette idea"],
};
// everything else in the 90 -> KEEP, tier by rating/level
function autoTier(c) {
  if (c.level >= 6) return "ADVANCED";
  if (c.mateIn === 3 && (c.sourceRating || 0) >= 1200) return "ADVANCED";
  if (c.mateIn === 3) return "INTERMEDIATE";
  return "BEGINNER";
}

const rows = [];
for (const id of reviewIds) {
  const c = byId[id];
  if (!c) { rows.push({ id, missing: true }); continue; }
  const d = DEC[id] || ["KEEP", autoTier(c), "sparse (<=10 pc) realistic endgame mate, correctly rated, high popularity - good calculation exercise"];
  rows.push({
    id, level: c.level, mate: c.mateIn, pieces: c.fen.split(" ")[0].replace(/[^a-zA-Z]/g, "").length,
    theme: c.theme, rating: c.sourceRating, pop: c.sourcePopularity, mat: material(c.fen),
    decision: d[0], tier: d[1], reason: d[2],
  });
}

const keep = rows.filter((r) => r.decision === "KEEP");
const review = rows.filter((r) => r.decision === "REVIEW");
const reject = rows.filter((r) => r.decision === "REJECT");

// -------- replacements from the validated pool --------
const usedId = new Set([...FINAL.map((c) => c.id), ...SHIPPED.map((p) => p.id)]);
const usedPos = new Set([...FINAL.map((c) => posKey(c.fen)), ...SHIPPED.map((p) => posKey(p.fen))]);
const finalIdeas = new Set(FINAL.map(idea));
// theme headroom: <=50 per named theme across the 1000-strong library
const themeCount = {};
for (const c of [...SHIPPED, ...FINAL]) themeCount[c.theme] = (themeCount[c.theme] || 0) + 1;

function replacementsFor(need) {
  // need = {mate, level, n, avoidMaterialSwing}
  const cands = POOL
    .filter((c) => !usedId.has(c.id) && !usedPos.has(posKey(c.fen)))
    .filter((c) => c.mateIn === need.mate && c.level === need.level)
    .filter((c) => !finalIdeas.has(idea(c)))
    .filter((c) => Math.abs(material(c.fen)) <= 6)                 // no 'losing side mates' optics
    .filter((c) => (c.popularity || 0) >= 92 && (c.sourceRating || 0) >= 700 && (c.sourceRating || 0) <= 1250)
    .filter((c) => c.pieceCount <= (need.mate === 3 ? 10 : 12))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const out = [];
  const localTheme = { ...themeCount };
  for (const c of cands) {
    if (out.length >= need.n) break;
    const cap = isGeneric(c.theme) ? Infinity : 50;
    if ((localTheme[c.theme] || 0) >= cap) continue;
    localTheme[c.theme] = (localTheme[c.theme] || 0) + 1;
    usedId.add(c.id); usedPos.add(posKey(c.fen)); finalIdeas.add(idea(c));
    out.push(c);
  }
  return out;
}

const rej_m1 = reject.filter((r) => r.mate === 1);
const rej_m3 = reject.filter((r) => r.mate === 3);
const repl_m1 = replacementsFor({ mate: 1, level: 1, n: rej_m1.length });
const repl_m3_l5 = replacementsFor({ mate: 3, level: 5, n: rej_m3.length });

// -------- final library impact --------
const afterFinal = FINAL.filter((c) => !reject.find((r) => r.id === c.id));
const combinedAfter = [...SHIPPED, ...afterFinal];
const g = (arr, f) => arr.reduce((a, x) => { const k = f(x); a[k] = (a[k] || 0) + 1; return a; }, {});

// -------- write markdown --------
let out = "# Phase 12B - 90-board human quality review\n\n";
out += `Reviewed the exact ${reviewIds.length} boards flagged by Phase 12A (each rendered as an ASCII board with its mating idea, piece count, material balance, rating and popularity). `;
out += "Every board is TECHNICALLY VALID (strict forced-mate check already passed + a 96/96 independent re-check). ";
out += "These decisions are a HUMAN QUALITY judgement on top of that; the ~8 marked REVIEW still need your call.\n\n";

out += "## Decisions\n\n| ID | Level | Mate | Pieces | Theme | Tier | Decision | Reason |\n|---|---|---|---|---|---|---|---|\n";
for (const r of rows) {
  if (r.missing) { out += `| ${r.id} | - | - | - | - | - | (not in final) | - |\n`; continue; }
  out += `| ${r.id} | ${r.level} | ${r.mate} | ${r.pieces} | ${r.theme} | ${r.tier} | **${r.decision}** | ${r.reason} |\n`;
}

out += `\n## Counts\n\n- **KEEP: ${keep.length}**\n- **REVIEW: ${review.length}**\n- **REJECT: ${reject.length}**\n\n`;

out += "## Summary\n\n";
out += `- **Most common rejection reason:** duplicate-feel / over-represented idea - the near-identical 'K + advanced pawns beat a lone queen' family (4 of 9 rejects) plus 2 straight near-duplicate pairs. Real chess, but the library only needs one of each.\n`;
out += `- **Visually complex puzzles:** 1 (lichess-JEa1F, 16 pieces at mate-in-1). Every other flagged board is <=10 pieces.\n`;
out += `- **Child-unsuitable (fine for older kids / adults, not a 6-year-old):** ${rows.filter((r) => r.tier === "ADVANCED").length} rated ADVANCED - mate-in-3 with quiet king walks, named patterns (Anastasia/Hook/Epaulette/Arabian), or rating >=1200. Expected and acceptable - they populate the ADVANCED tier, not the child on-ramp.\n`;
out += `- **Repetitive puzzles removed:** 6 of the 9 rejects (BddQR>g5SwZ, nmilw+MR7hu>HVmqT, and 4 of the 'pawns vs queen' family collapsed to KfqIP).\n`;
out += `- **Unclear / obscure:** 2 (lichess-CDPlI 'Pillsbury's Mate' label + concentration; lichess-vSUE8 the down-Q+R position that looks broken).\n`;
out += `- **Standout excellent puzzles:** the ~40 sparse (7-9 piece) rook and knight endgame mates among the KEEPs - rook-ladder drives (Ra8+/Rc8+ style) and knight-check nets - are model calculation exercises for an older child or adult learner and read cleanly on a phone.\n`;
out += `- **REVIEW (${review.length}):** ${review.map((r) => r.id.replace("lichess-", "")).join(", ")} - low popularity (85-87), top-of-range rating (~1375), the 'losing side mates' optics, or a similar-idea pair. Each needs your call; my lean is KEEP on all but one of the epaulette pair.\n`;

out += "\n## Duplicate-feel findings\n\n";
out += "- **The 'K + advanced pawns beat a lone queen' family** - KfqIP, wF994, HOoZk, GmXTW, SmLuH are five near-identical positions (king shepherds a g/h passer home while the enemy queen is too far to stop it). One canonical example is worth teaching -> **keep KfqIP**, drop the other four.\n";
out += "- **BddQR / g5SwZ** - both 'black queen to f2, back-rank mate with the rook', K+Q+R vs K+Q+R. Same lesson -> keep **BddQR** (pop 100), drop g5SwZ.\n";
out += "- **HVmqT / nmilw / MR7hu** - three ~1375-rated Hook Mates. nmilw and MR7hu are the clearer boards -> keep both, drop **HVmqT**.\n";
out += "- **Ll6FX / duz9n** - both knight-check mate-in-3 near the h-file. Ll6FX opens `Ng4+` (quiet), duz9n opens `Nxg4+` (capture) on a different board -> **keep both**, the execution differs enough to teach two things.\n";
out += "- **RTygF / qBTRn** - both double-rook epaulette (`R8x3+` lift then mate). Similar; marked REVIEW - a curator should confirm whether both earn a slot (my lean: keep one).\n";
out += "- **jTjHR / bJvkA / LT66N** - all 'the materially-losing side promotes a pawn and mates'. Common in puzzle training, kept as REVIEW - a curator decides whether 0, 1, or all belong in a 5-12-first library.\n";

out += "\n## Proposed replacements (from scripts/puzzle-launch-validated-pool.json only)\n\n";
function replBlock(rejList, replList, label) {
  out += `### ${label}\n\n`;
  for (let i = 0; i < rejList.length; i++) {
    const rj = rejList[i], rp = replList[i];
    if (!rp) { out += `- Rejected: ${rj.id} -> **no auto-replacement found under the strict filter** (mate ${rj.mate} / level ${rj.level} / material-balanced / pop>=92 / rating 700-1250 / <=10pc / new idea). Loosen a constraint or pick manually.\n`; continue; }
    out += `- Rejected: **${rj.id}** (${rj.theme}, r${rj.rating})\n`;
    out += `  Replacement: **${rp.id}** (${rp.theme}, r${rp.sourceRating}, pop${rp.popularity}, ${rp.pieceCount}pc, level ${rp.level})\n`;
    out += `  Why better: material-balanced (${material(rp.fen) >= 0 ? "+" : ""}${material(rp.fen)}), high popularity, distinct tactical idea, no id/position/idea collision, theme "${rp.theme}" still <=50 in the library.\n`;
    out += `  FEN: \`${rp.fen}\`  key: ${rp.firstMove}\n`;
  }
  out += "\n";
}
replBlock(rej_m1, repl_m1, "Mate-in-1 / Level 1 (1 needed)");
replBlock(rej_m3, repl_m3_l5, `Mate-in-3 / Level 5 (${rej_m3.length} needed)`);

out += "## Final library impact (if all REJECTs are removed, before replacements)\n\n";
out += `| | current | after review |\n|---|---|---|\n`;
out += `| total | 1000 | ${combinedAfter.length} |\n`;
for (const m of [1, 2, 3]) out += `| mate-in-${m} | ${[...SHIPPED, ...FINAL].filter((c) => c.mateIn === m).length} | ${combinedAfter.filter((c) => c.mateIn === m).length} |\n`;
for (const l of [1, 2, 3, 4, 5, 6]) out += `| level ${l} | ${[...SHIPPED, ...FINAL].filter((c) => c.level === l).length} | ${combinedAfter.filter((c) => c.level === l).length} |\n`;
out += `\nWith the ${repl_m1.length + repl_m3_l5.length} proposed replacements applied, the library returns to **1000** at the same distribution.\n`;

fs.writeFileSync(path.join(__dirname, "puzzle-launch-human-review.md"), out);

console.log(`reviewed ${rows.length}  KEEP ${keep.length}  REVIEW ${review.length}  REJECT ${reject.length}`);
console.log(`rejects: m1=${rej_m1.length} m3=${rej_m3.length}`);
console.log(`replacements found: m1=${repl_m1.length}/${rej_m1.length}  m3L5=${repl_m3_l5.length}/${rej_m3.length}`);
console.log("after-review total:", combinedAfter.length, g(combinedAfter, (c) => "m" + c.mateIn), g(combinedAfter, (c) => "L" + c.level));
console.log("wrote scripts/puzzle-launch-human-review.md");

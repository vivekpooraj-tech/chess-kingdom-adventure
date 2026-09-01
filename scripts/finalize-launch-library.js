// Phase 12C - apply the Phase 12B rejects + REVIEW resolutions to
// scripts/puzzle-launch-final.json, drawing replacements ONLY from
// scripts/puzzle-launch-validated-pool.json. No re-download, no re-validation
// of the pool (it is already strictly validated). Touches nothing in content/.

const fs = require("fs");
const path = require("path");
const { Chess } = require("chess.js");

const FINAL_PATH = path.join(__dirname, "puzzle-launch-final.json");
const POOL = JSON.parse(fs.readFileSync(path.join(__dirname, "puzzle-launch-validated-pool.json"), "utf8"));
let FINAL = JSON.parse(fs.readFileSync(FINAL_PATH, "utf8"));
const shippedSrc = fs.readFileSync(path.join(__dirname, "..", "content", "puzzles.ts"), "utf8");
// eslint-disable-next-line no-eval
const SHIPPED = eval(shippedSrc.match(/export const PUZZLES: ChessPuzzle\[\] = (\[[\s\S]*?\n\]);/)[1]);

const isGeneric = (t) => /^Checkmate in [123]$/.test(t);
const posKey = (f) => f.trim().split(/\s+/).slice(0, 4).join(" ");
function material(fen) {
  const v = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  let d = 0;
  for (const ch of fen.split(" ")[0]) if (v[ch.toLowerCase()]) d += (ch === ch.toUpperCase() ? 1 : -1) * v[ch.toLowerCase()];
  return d;
}
function idea(c) {
  const g = new Chess(c.fen);
  let dk = "?";
  g.board().forEach((row, r) => row.forEach((cc, f) => { if (cc && cc.type === "k" && cc.color !== c.sideToMove) dk = "abcdefgh"[f] + (8 - r); }));
  return [c.mateIn, c.fen.split(" ")[0].replace(/[^a-zA-Z]/g, "").split("").sort().join(""), dk].join("|");
}

// ---------- REJECT LIST (9 from 12B + 5 from REVIEW resolution) ----------
const REJECTS = {
  // 12B
  "lichess-JEa1F": "16 pieces at mate-in-1; the cleanest tier must stay uncluttered",
  "lichess-vSUE8": "black down Q+R with white's Q+R next to the black king yet mates - reads as broken",
  "lichess-wF994": "'K + far pawns beat a lone Q' - 5x near-identical family; keeping KfqIP",
  "lichess-HOoZk": "near-identical to KfqIP (Kf7 + h7/g6 pawns vs a distant queen)",
  "lichess-GmXTW": "same 'pawns beat a queen' family",
  "lichess-SmLuH": "same 'pawns beat a queen' family - 4th example",
  "lichess-g5SwZ": "same idea as BddQR (black queen to f2 back-rank) - keeping BddQR (pop 100)",
  "lichess-CDPlI": "Pillsbury's Mate already 3.6% of the library; obscure label + black down material",
  "lichess-HVmqT": "3rd of three ~1375-rated Hook Mates flagged together",
  // REVIEW -> REJECT
  "lichess-RTygF": "double-rook epaulette with kings in the centre - qBTRn is the cleaner example of the same idea",
  "lichess-LT66N": "single-passer promotion mate - same execution as bJvkA; keeping jTjHR (smother) + bJvkA (two passers)",
  "lichess-lq1oC": "Hook Mate, popularity 86, no distinct value over the other Hook Mates",
  "lichess-hn4qC": "popularity 85 (lowest in the set); back-rank mate-in-3 already well covered",
  "lichess-nmilw": "Hook Mate rating 1373 - keeping MR7hu as the one hard Hook Mate representative",
};
// REVIEW -> KEEP (recorded for the report)
const REVIEW_KEEP = {
  "lichess-jTjHR": "white king smothered by its own b2/c2 pawns + bishop - a genuinely different idea from the passer-promotion mates",
  "lichess-bJvkA": "two connected passers on the 2nd rank + king mate - distinct execution from jTjHR",
  "lichess-EoJjt": "g6+ Rxg6 hxg6+ pawn-breakthrough sacrifice to open the h-file - instructive, roughly level material",
  "lichess-fEqLq": "Rc1+ then the QUIET Rd8 - teaches that a mate-in-3 need not be all checks; low rating, generic theme",
  "lichess-qBTRn": "double-rook epaulette, the cleaner of the RTygF/qBTRn pair (higher rating + popularity, king nearer the edge)",
};

const rejectIds = new Set(Object.keys(REJECTS));
const removed = FINAL.filter((c) => rejectIds.has(c.id));
FINAL = FINAL.filter((c) => !rejectIds.has(c.id));

// ---------- replacement search ----------
const usedId = new Set([...FINAL.map((c) => c.id), ...SHIPPED.map((p) => p.id)]);
const usedPos = new Set([...FINAL.map((c) => posKey(c.fen)), ...SHIPPED.map((p) => posKey(p.fen))]);
const usedIdea = new Set(FINAL.map(idea));
const themeCount = {};
for (const c of [...SHIPPED, ...FINAL]) themeCount[c.theme] = (themeCount[c.theme] || 0) + 1;
const EXOTIC = new Set(["Balestra Mate", "Blind Swine Mate", "Morphys Mate", "Triangle Mate", "Boden's Mate", "Bodens Mate", "Swallowstail Mate"]);

function pickReplacement({ mate, level, ratingMax = 1300, ratingMin = 750, genericOnly = false, popMin = 92 }) {
  const cands = POOL
    .filter((c) => !usedId.has(c.id) && !usedPos.has(posKey(c.fen)) && !usedIdea.has(idea(c)))
    .filter((c) => c.mateIn === mate && c.level === level)
    .filter((c) => Math.abs(material(c.fen)) <= 5)
    .filter((c) => (c.popularity || 0) >= popMin && (c.sourceRating || 0) >= ratingMin && (c.sourceRating || 0) <= ratingMax)
    .filter((c) => c.pieceCount <= (mate === 3 ? 10 : 10))
    .filter((c) => /[+#]/.test(c.firstMove))                         // a checking key move reads clearly
    .filter((c) => !EXOTIC.has(c.theme))
    .filter((c) => genericOnly ? isGeneric(c.theme) : true)
    .filter((c) => isGeneric(c.theme) || (themeCount[c.theme] || 0) < 44)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const chosen = cands[0];
  if (!chosen) return null;
  usedId.add(chosen.id); usedPos.add(posKey(chosen.fen)); usedIdea.add(idea(chosen));
  themeCount[chosen.theme] = (themeCount[chosen.theme] || 0) + 1;
  return chosen;
}

const pairs = [];
for (const rj of removed) {
  let rp;
  if (rj.id === "lichess-JEa1F") {
    // special: very-clear mate-in-1, rating <= 900
    rp = pickReplacement({ mate: 1, level: 1, ratingMin: 500, ratingMax: 900, genericOnly: false, popMin: 92 })
      || pickReplacement({ mate: 1, level: 1, ratingMin: 500, ratingMax: 1000, genericOnly: false, popMin: 90 });
  } else {
    // all other rejects are mate-in-3 level 5 -> plain net, rating 800-1300
    rp = pickReplacement({ mate: 3, level: 5, ratingMin: 800, ratingMax: 1300, genericOnly: true, popMin: 93 })
      || pickReplacement({ mate: 3, level: 5, ratingMin: 750, ratingMax: 1350, genericOnly: false, popMin: 90 });
  }
  pairs.push({ rj, rp });
  if (rp) FINAL.push(rp);
}

// ---------- normalise the FINAL entries to the stored shape ----------
FINAL = FINAL.map((c) => ({
  id: c.id, fen: c.fen, sideToMove: c.sideToMove, mateIn: c.mateIn, firstMove: c.firstMove,
  theme: c.theme, level: c.level, source: "lichess", sourceId: c.sourceId,
  sourceRating: c.sourceRating, sourcePopularity: c.popularity != null ? c.popularity : c.sourcePopularity,
})).sort((a, b) => a.mateIn - b.mateIn || a.level - b.level || a.id.localeCompare(b.id));

fs.writeFileSync(FINAL_PATH, JSON.stringify(FINAL, null, 2) + "\n");

// ---------- report ----------
const g = (arr, f) => arr.reduce((a, x) => { const k = f(x); a[k] = (a[k] || 0) + 1; return a; }, {});
console.log("=== rejects + replacements ===");
for (const { rj, rp } of pairs) {
  console.log(`REJECT ${rj.id} (${rj.theme} m${rj.mateIn} L${rj.level})`);
  console.log(`  -> ${rp ? `${rp.id} (${rp.theme} m${rp.mateIn} L${rp.level} r${rp.sourceRating} pop${rp.popularity} ${rp.pieceCount}pc)` : "NONE FOUND"}`);
}
console.log("\nfinal.json now:", FINAL.length);
console.log("  mate:", g(FINAL, (c) => "m" + c.mateIn));
console.log("  level:", g(FINAL, (c) => "L" + c.level));
console.log("  unique ids:", new Set(FINAL.map((c) => c.id)).size);
console.log("  unique positions:", new Set(FINAL.map((c) => posKey(c.fen))).size);
console.log("  REVIEW kept:", Object.keys(REVIEW_KEEP).length, "  REVIEW rejected:", 5);
fs.writeFileSync(path.join(__dirname, "puzzle-launch-12c-decisions.json"),
  JSON.stringify({ rejects: REJECTS, reviewKeep: REVIEW_KEEP, replacements: pairs.map((p) => ({ rejected: p.rj.id, replacement: p.rp ? p.rp.id : null })) }, null, 2));

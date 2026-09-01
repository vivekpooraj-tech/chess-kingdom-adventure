// Phase 12C - regenerate the review/distribution report from the FINALISED
// scripts/puzzle-launch-final.json (post rejects + replacements). Pure read;
// no chess compute, no curation, touches nothing in content/.

const fs = require("fs");
const path = require("path");
const { Chess } = require("chess.js");

const FINAL = JSON.parse(fs.readFileSync(path.join(__dirname, "puzzle-launch-final.json"), "utf8"));
const DEC = JSON.parse(fs.readFileSync(path.join(__dirname, "puzzle-launch-12c-decisions.json"), "utf8"));
const shippedSrc = fs.readFileSync(path.join(__dirname, "..", "content", "puzzles.ts"), "utf8");
// eslint-disable-next-line no-eval
const SHIPPED = eval(shippedSrc.match(/export const PUZZLES: ChessPuzzle\[\] = (\[[\s\S]*?\n\]);/)[1]);

const isGeneric = (t) => /^Checkmate in [123]$/.test(t);
const g = (arr, f) => arr.reduce((a, x) => { const k = f(x); a[k] = (a[k] || 0) + 1; return a; }, {});
const pcOf = (p) => (p.pieceCount != null ? p.pieceCount : p.fen.split(" ")[0].replace(/[^a-zA-Z]/g, "").length);
const pcBand = (n) => n <= 8 ? "3-8" : n <= 12 ? "9-12" : n <= 16 ? "13-16" : "17+";
const ratingBand = (r) => !r ? "n/a" : r < 700 ? "<700" : r < 1000 ? "700-999" : r < 1300 ? "1000-1299" : r < 1600 ? "1300-1599" : "1600+";
const tier = (c) => {
  const pc = pcOf(c);
  if (c.mateIn === 1 && (c.level <= 1 || pc <= 8)) return "child-friendly";
  if (c.mateIn === 1) return "beginner";
  if (c.mateIn === 3 || c.level >= 5 || pc >= 17 || (c.sourceRating || 0) >= 1300) return "advanced";
  return "intermediate";
};

const NEW = FINAL.map((c) => ({ ...c, _origin: "lichess" }));
const HAND = SHIPPED.map((p) => ({ ...p, sourceRating: null, sourcePopularity: null, _origin: "hand" }));
const LIB = [...HAND, ...NEW];

let md = "# Phase 12C - FINAL launch library (proposed)\n\n";
md += "This is the finalised set: the 39 hand-crafted puzzles + the 961 curated Lichess puzzles ";
md += "after the Phase 12B rejects, the Phase 12B REVIEW resolutions, and replacement from ";
md += "`scripts/puzzle-launch-validated-pool.json`. `content/puzzles.ts` is NOT yet changed.\n\n";
md += "Confidence: every entry is TECHNICALLY VALID (strict forced-mate check). The 39 are human-authored; ";
md += "the 961 are curated by heuristic; the ~90 highest-risk of them were individually board-reviewed in Phase 12B/12C.\n\n";

md += "## Totals\n\n";
md += `| | count |\n|---|---|\n| hand-crafted (unchanged) | ${HAND.length} |\n| curated Lichess (new) | ${NEW.length} |\n| **launch library** | **${LIB.length}** |\n\n`;

md += "## Mate distribution\n\n| depth | hand | new | total |\n|---|---|---|---|\n";
for (const m of [1, 2, 3]) md += `| mate-in-${m} | ${HAND.filter((c) => c.mateIn === m).length} | ${NEW.filter((c) => c.mateIn === m).length} | ${LIB.filter((c) => c.mateIn === m).length} |\n`;

md += "\n## Level distribution\n\n| level | hand | new | total | target |\n|---|---|---|---|---|\n";
const lt = { 1: "~210", 2: "170-175", 3: "~375", 4: "45-50", 5: "185-192", 6: "small" };
for (const l of [1, 2, 3, 4, 5, 6]) md += `| ${l} | ${HAND.filter((c) => c.level === l).length} | ${NEW.filter((c) => c.level === l).length} | ${LIB.filter((c) => c.level === l).length} | ${lt[l]} |\n`;

md += "\n## Theme distribution (whole library)\n\n| theme | count | % |\n|---|---|---|\n";
const themeDist = g(LIB, (c) => c.theme);
for (const [t, v] of Object.entries(themeDist).sort((a, b) => b[1] - a[1])) md += `| ${t} | ${v} | ${(v / LIB.length * 100).toFixed(1)}% |\n`;
const topNamed = Object.entries(themeDist).filter(([t]) => !isGeneric(t)).sort((a, b) => b[1] - a[1])[0];
md += `\n- generic "Checkmate in N": ${LIB.filter((c) => isGeneric(c.theme)).length} (${(LIB.filter((c) => isGeneric(c.theme)).length / LIB.length * 100).toFixed(0)}%)\n`;
md += `- largest single **named** theme: **${topNamed[0]} - ${(topNamed[1] / LIB.length * 100).toFixed(1)}%** (cap: <=5%)\n`;

md += "\n## Piece-count distribution\n\n| band | hand | new | total |\n|---|---|---|---|\n";
for (const b of ["3-8", "9-12", "13-16", "17+"]) {
  md += `| ${b} | ${HAND.filter((c) => pcBand(pcOf(c)) === b).length} | ${NEW.filter((c) => pcBand(pcOf(c)) === b).length} | ${LIB.filter((c) => pcBand(pcOf(c)) === b).length} |\n`;
}

md += "\n## Source-rating distribution (new puzzles)\n\n| band | count |\n|---|---|\n";
for (const [b, v] of Object.entries(g(NEW, (c) => ratingBand(c.sourceRating))).sort()) md += `| ${b} | ${v} |\n`;

const tiers = g(LIB, tier);
md += "\n## Suitability tiers (whole library)\n\n";
md += `- **child-friendly:** ${tiers["child-friendly"] || 0} (${((tiers["child-friendly"] || 0) / LIB.length * 100).toFixed(0)}%) - clear mate-in-1, small board\n`;
md += `- **beginner:** ${tiers.beginner || 0} (${((tiers.beginner || 0) / LIB.length * 100).toFixed(0)}%)\n`;
md += `- **intermediate:** ${tiers.intermediate || 0} (${((tiers.intermediate || 0) / LIB.length * 100).toFixed(0)}%)\n`;
md += `- **advanced:** ${tiers.advanced || 0} (${((tiers.advanced || 0) / LIB.length * 100).toFixed(0)}%)\n`;

md += "\n## Phase 12B REJECTs (9) + Phase 12B->12C REVIEW rejects (5) and their replacements\n\n";
const replMap = Object.fromEntries(DEC.replacements.map((r) => [r.rejected, r.replacement]));
const newById = Object.fromEntries(NEW.map((c) => [c.id, c]));
md += "| rejected | reason | replaced with | replacement rating / pop / pieces / theme |\n|---|---|---|---|\n";
for (const [rid, reason] of Object.entries(DEC.rejects)) {
  const rp = replMap[rid];
  const rc = rp ? newById[rp] : null;
  md += `| ${rid} | ${reason} | ${rp || "-"} | ${rc ? `r${rc.sourceRating} / pop${rc.sourcePopularity} / ${pcOf(rc)}pc / ${rc.theme}` : "-"} |\n`;
}

md += "\n## Phase 12B REVIEW items - resolutions\n\n";
md += "| id | decision | reason |\n|---|---|---|\n";
for (const [id, reason] of Object.entries(DEC.reviewKeep)) md += `| ${id} | **KEEP** | ${reason} |\n`;
const reviewRejects = {
  "lichess-RTygF": "kept qBTRn instead (cleaner double-rook epaulette, higher rating + popularity)",
  "lichess-LT66N": "kept jTjHR (smother) + bJvkA (two-passer) - LT66N is a third same-execution passer mate",
  "lichess-lq1oC": "Hook Mate, popularity 86, no distinct value over the other Hook Mates in the library",
  "lichess-hn4qC": "popularity 85 (lowest in the flagged set); back-rank mate-in-3 already well covered",
  "lichess-nmilw": "Hook Mate rating 1373 - kept MR7hu as the one hard Hook Mate representative",
};
for (const [id, reason] of Object.entries(reviewRejects)) md += `| ${id} | **REJECT** | ${reason} |\n`;

md += "\n## Special replacement requests\n\n";
md += "- **8SBSy** (proposed in 12B for JEa1F, rating 1133) - NOT used. Replaced with **" + replMap["lichess-JEa1F"] + `** (${newById[replMap["lichess-JEa1F"]].theme}, rating ${newById[replMap["lichess-JEa1F"]].sourceRating}, ${pcOf(newById[replMap["lichess-JEa1F"]])} pieces, checking key move, no named pattern).\n`;
md += "- **KGV1Z** ('Blind Swine Mate', proposed in 12B for wF994) - NOT used. Every mate-in-3 replacement in 12C is a plain \"Checkmate in 3\" net (no obscure named patterns added); wF994 -> **" + replMap["lichess-wF994"] + `** (rating ${newById[replMap["lichess-wF994"]].sourceRating}, ${pcOf(newById[replMap["lichess-wF994"]])} pieces).\n`;

md += "\n## Validation status\n\nSee the run report - structural checks (1000 / 1000 unique ids / 1000 unique positions / first 39 unchanged / legal FENs) pass; strict forced-mate re-check on the 14 replacements + a 15% random sample of the 961.\n";

fs.writeFileSync(path.join(__dirname, "puzzle-launch-final-review.md"), md);
console.log("wrote scripts/puzzle-launch-final-review.md");
console.log("library:", LIB.length, "| mate", g(LIB, (c) => "m" + c.mateIn), "| level", g(LIB, (c) => "L" + c.level));
console.log("piece bands:", g(LIB, (c) => pcBand(pcOf(c))));
console.log("tiers:", g(LIB, tier));
console.log("largest named theme:", topNamed[0], (topNamed[1] / LIB.length * 100).toFixed(1) + "%");

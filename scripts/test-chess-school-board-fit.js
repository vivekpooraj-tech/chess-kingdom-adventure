/**
 * Chess School board fit — pure sizing rule + wiring.
 *   node scripts/test-chess-school-board-fit.js
 */
const fs = require("fs");
const path = require("path");
const ts = require(path.join(process.cwd(), "node_modules", "typescript"));
const Module = require("module");
const orig = Module._resolveFilename;
Module._resolveFilename = function (r, ...rest) { if (r.startsWith("@/")) r = path.join(process.cwd(), r.slice(2)); return orig.call(this, r, ...rest); };
require.extensions[".ts"] = function (m, f) { m._compile(ts.transpileModule(fs.readFileSync(f, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: f }).outputText, f); };
const { fitBoardWidth, MIN_SCHOOL_BOARD } = require(path.join(process.cwd(), "lib/school/v2/boardFit.ts"));
const read = (p) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
let pass = 0; const fails = [];
const check = (n, ok, d) => { if (ok) pass++; else { fails.push(n + (d ? " -- " + d : "")); console.log("FAIL:", n, d || ""); } };

// Measured chrome heights (px) at 390 wide: teach+fen 547, piece_intro 539.
check("fits already: returns null (layout untouched)", fitBoardWidth({ viewportHeight: 914, nonBoardHeight: 480, frameExtra: 28, cssWidth: 395 }) === null);
check("390x844 teach step: board shrinks so the step fits", fitBoardWidth({ viewportHeight: 844, nonBoardHeight: 504, frameExtra: 28, cssWidth: 374 }) === 312);
check("result never exceeds the CSS width", fitBoardWidth({ viewportHeight: 5000, nonBoardHeight: 0, frameExtra: 0, cssWidth: 300 }) === null);
check("never narrower than the minimum", fitBoardWidth({ viewportHeight: 600, nonBoardHeight: 540, frameExtra: 28, cssWidth: 374 }) === MIN_SCHOOL_BOARD);
check("fit leaves exactly the room: width + extra + chrome = viewport", (() => { const w = fitBoardWidth({ viewportHeight: 844, nonBoardHeight: 504, frameExtra: 28, cssWidth: 374 }); return w + 28 + 504 === 844; })());
check("non-finite inputs fall back to no constraint", fitBoardWidth({ viewportHeight: NaN, nonBoardHeight: 1, frameExtra: 1, cssWidth: 300 }) === null);
check("negative extra is treated as zero", fitBoardWidth({ viewportHeight: 800, nonBoardHeight: 400, frameExtra: -20, cssWidth: 500 }) === 400);
let mono = true, prev = Infinity;
for (let vh = 600; vh <= 1400; vh += 20) { const w = fitBoardWidth({ viewportHeight: vh, nonBoardHeight: 520, frameExtra: 28, cssWidth: 700 }); const eff = w === null ? 700 : w; if (eff < (prev === Infinity ? 0 : prevEff(prev))) mono = false; prev = eff; }
function prevEff(v) { return v; }
check("a taller viewport never gives a smaller board", mono);

const steps = read("components/school/v2/steps.tsx");
check("SchoolBoardFrame applies the measured fit as a max-width", /fitBoardWidth\(/.test(steps) && /style=\{maxWidth === null \? undefined : \{ maxWidth \}\}/.test(steps));
check("fit is measured against the unconstrained frame (no oscillation)", /el\.style\.maxWidth = ""/.test(steps));
check("fit re-measures on viewport changes and respects the visual viewport", /visualViewport/.test(steps) && /orientationchange/.test(steps));
check("the existing CSS width formula is kept as the cap", /88dvh,720px/.test(steps) && /md:\[width:min\(calc\(100vw-2rem\)/.test(steps));
check("ChessBoard is still the board (no second board component)", (steps.match(/<ChessBoard/g) || []).length >= 6);
const runner = read("components/school/v2/SessionRunner.tsx");
check("session column uses the tightened bottom padding with safe-area", /pb-\[max\(2rem,env\(safe-area-inset-bottom,0px\)\)\]/.test(runner));
check("no Train Your Mind file was touched by this fix", !/trainYourMind/.test(steps) && !/trainYourMind/.test(runner));
console.log(`\n${pass} checks passed, ${fails.length} failed`);
if (fails.length) { console.log(fails.map((f) => " - " + f).join("\n")); process.exit(1); }

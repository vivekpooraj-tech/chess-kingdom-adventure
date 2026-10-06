/**
 * Chess focus layout: the board is sized from width AND height, then verified against the rendered row.
 *   node scripts/test-chess-focus-fit.js
 */
const fs = require("fs");
const path = require("path");
const ts = require(path.join(process.cwd(), "node_modules", "typescript"));
const Module = require("module");
const orig = Module._resolveFilename;
Module._resolveFilename = function (r, ...rest) { if (r.startsWith("@/")) r = path.join(process.cwd(), r.slice(2)); return orig.call(this, r, ...rest); };
require.extensions[".ts"] = function (m, f) { m._compile(ts.transpileModule(fs.readFileSync(f, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: f }).outputText, f); };
const ROOT = process.cwd();
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");
let pass = 0; const fails = [];
const check = (n, ok, d) => { if (ok) pass++; else { fails.push(n + (d ? " -- " + d : "")); console.log("FAIL:", n, d || ""); } };

const layout = read("components/chess/ChessFocusLayout.tsx");
const calc = require(path.join(ROOT, "lib/chessFocus/computeBoardSize.ts"));

// --- The estimate: never taller than the room, never wider than the column, never below the floor.
check("exports a minimum board size", typeof calc.CHESS_FOCUS_MIN_BOARD === "number" && calc.CHESS_FOCUS_MIN_BOARD >= 200);
check("the layout imports the floor for the guard", /CHESS_FOCUS_MIN_BOARD,/.test(layout));

// --- The guard, structurally.
check("the row and the board column are measured by ref", /ref=\{rowRef\}/.test(layout) && /ref=\{boardColRef\}/.test(layout));
const guard = layout.slice(layout.indexOf("FIT GUARD"));
check("guard only runs side-by-side (stacked scrolls, it is not clipped)", /if \(sideBySide\) \{\s*window\.requestAnimationFrame/.test(guard));
check("guard waits for layout (two animation frames)", /requestAnimationFrame\(\(\) =>\s*window\.requestAnimationFrame/.test(guard));
check("guard compares the real column height to the row's content box", /row\.clientHeight - parseFloat\(rs\.paddingTop\) - parseFloat\(rs\.paddingBottom\)/.test(guard) && /col\.offsetHeight - room/.test(guard));
check("guard has a 1px tolerance (no jitter)", /over > 1/.test(guard));
check("guard only ever reduces the size", /Math\.min\(s, next\) - over/.test(guard));
check("guard never goes below the minimum board", /Math\.max\(CHESS_FOCUS_MIN_BOARD,/.test(guard));

// --- Simulate the guard arithmetic: whatever the chrome, the fitted column never exceeds the room.
function fit(room, chrome, estimate) {
  let size = estimate;
  const col = () => chrome + size; // meta + board
  const over = Math.ceil(col() - room);
  if (over > 1) size = Math.max(calc.CHESS_FOCUS_MIN_BOARD, Math.min(size, estimate) - over);
  return { size, col: chrome + size };
}
for (const [room, chrome, est] of [[868, 110, 790], [868, 110, 758], [600, 110, 600], [500, 140, 480], [720, 110, 700]]) {
  const r = fit(room, chrome, est);
  const floorHit = r.size === calc.CHESS_FOCUS_MIN_BOARD;
  check(`room ${room}, chrome ${chrome}, estimate ${est}: column fits (or the floor was reached)`, r.col <= room + 1 || floorHit, JSON.stringify(r));
  check(`room ${room}, chrome ${chrome}: a correct estimate is left alone`, !(chrome + est <= room + 1) || r.size === est);
}

// --- Atelier panel CSS.
const css = read("app/worlds.css");
check("Atelier arena shell keeps position: fixed (the generic .world-scope > * rule would make it content-high)", css.includes('[data-world="atelier"].world-scope--play > .chess-focus-shell {\n  position: fixed;'));
check("Classic keeps its existing fixed-shell rule", css.includes('[data-world="classic"].world-scope--play > .chess-focus-shell {\n  position: fixed;'));
check("Enchanted is not touched by the shell fix", !css.includes('[data-world="enchanted"].world-scope--play > .chess-focus-shell'));
check("Atelier panel has a real minimum width", css.includes('[data-world="atelier"] .chess-focus-panel {\n  min-width: 272px;'));
check("Atelier coach text wraps", css.includes("overflow-wrap: anywhere") && css.includes('[data-world="atelier"] .chess-focus-panel :is('));
check("Atelier stats strip is clear of the top edge", css.includes('[data-world="atelier"] .chess-focus-row {\n  padding-top: 0.5rem;'));
check("Atelier tactical-lab rules are scoped to the atelier world only", !/^\.chess-focus-panel\s*\{[^}]*min-width: 272px/m.test(css.replace(/\[data-world="atelier"\] \.chess-focus-panel/g, "")));

console.log(`\n${pass} checks passed, ${fails.length} failed`);
if (fails.length) { console.log(fails.map((f) => " - " + f).join("\n")); process.exit(1); }

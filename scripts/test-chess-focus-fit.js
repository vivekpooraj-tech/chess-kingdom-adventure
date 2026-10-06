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
check("guard only ever reduces the applied size", /appliedRef\.current - over/.test(guard));
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

// --- Initial-load stability: the guard must CONVERGE. This models the loop that made the board shake on Atelier:
// the estimate was 8px too tall (the row's extra top padding), the guard corrected it, and the chrome observer
// (whose width follows the board) fired on every correction and put the estimate back.
function simulate(logic, { room = 888, chromeActual = 128, chromeEstimated = 120 } = {}) {
  const next = room - chromeEstimated; // what computeChessFocusBoardSize returns from the measured chrome
  let size = 480, cap = Infinity, runs = 0, changes = 0, events = 0;
  const queue = ["recompute"];
  while (queue.length && events++ < 200) {
    const before = size;
    if (queue.shift() === "recompute") {
      size = logic === "new" ? Math.min(next, cap) : next;
      queue.push("guard");
    } else {
      const over = Math.ceil(chromeActual + size - room);
      if (over > 1 && (logic === "old" || runs < 3)) {
        runs++;
        size = Math.max(calc.CHESS_FOCUS_MIN_BOARD, size - over);
        if (logic === "new") cap = size;
      }
    }
    if (size !== before) {
      changes++;
      // old: the observer fires on any size change of the chrome (its width follows the board); new: height only
      if (logic === "old") queue.push("recompute");
    }
  }
  return { size, changes, settled: queue.length === 0 };
}
const oldRun = simulate("old");
const newRun = simulate("new");
check("model: the old guard never settles (ping-pong between the estimate and the fitted size)", !oldRun.settled && oldRun.changes >= 40, JSON.stringify(oldRun));
check("model: the new guard settles within three changes", newRun.settled && newRun.changes <= 3, JSON.stringify(newRun));
check("model: the settled board fits the room (all 8 ranks)", 128 + newRun.size <= 888 + 1, JSON.stringify(newRun));
const exact = simulate("new", { chromeEstimated: 128 });
check("model: with an exact estimate the guard never has to act (one change from the first render)", exact.settled && exact.changes === 1, JSON.stringify(exact));

// --- The fix, structurally.
check("guard result is remembered and honoured by recompute until the viewport changes", /const target = Math\.min\(next, fitCapRef\.current\);/.test(layout) && /fitCapRef\.current = fitted;/.test(layout) && /fitCapRef\.current = Infinity;/.test(layout));
check("guard is bounded per viewport (MAX_FIT_RUNS)", /const MAX_FIT_RUNS = 3;/.test(layout) && /fitRunsRef\.current < MAX_FIT_RUNS/.test(layout) && /fitRunsRef\.current = 0;/.test(layout));
check("a new viewport / layout mode resets the fit", /const sig = `\$\{metrics\.width\}x\$\{metrics\.height\}\|\$\{sideBySide\}\|\$\{isFullscreen\}`;/.test(layout));
check("the chrome observer ignores width-only changes (its width follows the board)", /: `\$\{Math\.round\(r\.height\)\}`;/.test(layout) && /if \(changed\) recompute\(\);/.test(layout) && !/new ResizeObserver\(recompute\)/.test(layout));
check("the estimate includes the row's own top padding, side-by-side only (stacked sizes unchanged)", /sideBySide && rowRef\.current \? parseFloat\(getComputedStyle\(rowRef\.current\)\.paddingTop\) \|\| 0 : 0/.test(layout) && /shellPadV \+ rowPadTop/.test(layout));
check("the guard no longer writes through a functional setState", !/setBoardSize\(\(s\) =>/.test(layout));

// --- Atelier panel CSS.
const css = read("app/worlds.css");
check("Classic / Enchanted rows get no top padding anywhere, so the padding correction is 0 for them", !/chess-focus-row[^{]*\{[^}]*padding-top/.test(css.replace(/\[data-world="atelier"\] \.chess-focus-row \{[^}]*\}/, "")) && !/chess-focus-row[^{]*\{[^}]*padding-top/.test(read("app/globals.css")));
check("Atelier arena shell keeps position: fixed (the generic .world-scope > * rule would make it content-high)", css.includes('[data-world="atelier"].world-scope--play > .chess-focus-shell {\n  position: fixed;'));
check("Classic keeps its existing fixed-shell rule", css.includes('[data-world="classic"].world-scope--play > .chess-focus-shell {\n  position: fixed;'));
check("Enchanted is not touched by the shell fix", !css.includes('[data-world="enchanted"].world-scope--play > .chess-focus-shell'));
check("Atelier panel has a real minimum width", css.includes('[data-world="atelier"] .chess-focus-panel {\n  min-width: 272px;'));
check("Atelier coach text wraps", css.includes("overflow-wrap: anywhere") && css.includes('[data-world="atelier"] .chess-focus-panel :is('));
check("Atelier stats strip is clear of the top edge", css.includes('[data-world="atelier"] .chess-focus-row {\n  padding-top: 0.5rem;'));
check("Atelier tactical-lab rules are scoped to the atelier world only", !/^\.chess-focus-panel\s*\{[^}]*min-width: 272px/m.test(css.replace(/\[data-world="atelier"\] \.chess-focus-panel/g, "")));

console.log(`\n${pass} checks passed, ${fails.length} failed`);
if (fails.length) { console.log(fails.map((f) => " - " + f).join("\n")); process.exit(1); }

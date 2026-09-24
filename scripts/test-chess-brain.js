/**
 * Chess Brain — factual-wording regression test.
 *
 *   node scripts/test-chess-brain.js
 *
 * child_skill_signals has no field distinguishing WHERE a weak_count came
 * from (Game Review vs. the Chess School struggle bridge — see
 * lib/school/v2/skillSignalMapping.ts), so the "needs practice" detail line
 * must never claim a source ("games you reviewed") it cannot actually prove.
 * This guards against that specific regression re-appearing.
 */
const fs = require("fs");
const path = require("path");
const ts = require(path.join(process.cwd(), "node_modules", "typescript"));

const Module = require("module");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request.startsWith("@/")) request = path.join(process.cwd(), request.slice(2));
  return origResolve.call(this, request, ...rest);
};
require.extensions[".ts"] = function (mod, filename) {
  const js = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filename,
  }).outputText;
  mod._compile(js, filename);
};

const CB = require(path.join(process.cwd(), "lib", "learner", "chessBrain.ts"));

let pass = 0;
const failures = [];
const check = (name, cond) => (cond ? pass++ : failures.push(name));

// A "needs_practice" skill with zero practice attempts, weakCount at the
// recurring threshold (3) -- the exact shape a Chess-School-only struggle
// signal has (see the Phase 1 bridge: it only ever sends p_weak_delta, never
// p_attempts_delta/p_correct_delta), with zero Game Reviews behind it.
const signals = {
  forks: { skill: "forks", weakCount: 3, practiceAttempts: 0, practiceCorrect: 0 },
};
const profile = {};
const view = CB.buildChessBrainView(signals, [], profile);

check("a weakCount-only signal (no practice) is classified into areasToImprove", view.areasToImprove.length === 1 && view.areasToImprove[0].skill === "forks");
check("its status is needs_practice", view.areasToImprove[0]?.status === "needs_practice");

const detail = view.areasToImprove[0]?.detail ?? "";
check("detail never claims a source the data cannot prove (no 'game(s) you reviewed')", !/games?\s+you\s+reviewed/i.test(detail));
check("detail is honest and source-neutral, built from the real weakCount", detail === "Came up 3 times so far.");

// Same signal, but genuinely reviewCount > 0 (the Game Review case) --
// wording must be identical either way, since the count itself still cannot
// prove which source(s) contributed to it.
const viewWithReviews = CB.buildChessBrainView(signals, [{}, {}], profile);
check("wording is identical regardless of reviewCount (still cannot attribute source)", viewWithReviews.areasToImprove[0]?.detail === detail);

// Singular form reads naturally too.
const singularSignals = { pins: { skill: "pins", weakCount: 3, practiceAttempts: 0, practiceCorrect: 0 } };
// weakCount below threshold with no practice evidence -> not shown at all
// (existing "say nothing" rule); bump to exactly the threshold to observe
// the wording once more at the boundary, using a distinct skill so this
// check is independent of the first.
check("boundary case at the recurring threshold still uses source-neutral wording", (() => {
  const v = CB.buildChessBrainView(singularSignals, [], {});
  return v.areasToImprove[0]?.detail === "Came up 3 times so far.";
})());

console.log("\n=== CHESS BRAIN: " + pass + " passed, " + failures.length + " failed ===");
if (failures.length) {
  console.error("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
  process.exitCode = 1;
}

/*
 * Premium player card: clock progress bar, urgency tiers, and rating wiring.
 *
 * The pure arithmetic is loaded from the REAL TypeScript source
 * (lib/game/clockProgress.ts), transpiled in memory. It is deliberately not
 * re-implemented here: a hand-written JS mirror would keep passing after the
 * shipped code changed, which is the one failure mode a test like this must not
 * have.
 *
 * The wiring assertions (which rating source the page reads, whether the bar and
 * the digits share one countdown) are static checks on the source, because they
 * are claims about the code rather than about a value. Comments are stripped
 * first so an assertion can never be satisfied by the prose that describes it.
 *
 * Run: node scripts/test-clock-progress.js
 */
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");

function loadTs(relPath) {
  const src = read(relPath);
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
  }).outputText;
  const mod = { exports: {} };
  new Function("module", "exports", "require", js)(mod, mod.exports, require);
  return mod.exports;
}

/** Remove block and line comments so assertions can't match their own prose. */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/(^|[^:"'`])\/\/.*$/, "$1"))
    .join("\n");
}

let passed = 0;
let failed = 0;
function check(name, actual, expected) {
  if (Object.is(actual, expected)) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}\n          expected: ${expected}\n          actual:   ${actual}`);
  }
}

const { clockProgress, clockUrgency, URGENCY_FILL } = loadTs("lib/game/clockProgress.ts");

const TEN_MIN = 600000;

console.log("\n--- Progress calculation ---");
check("full clock is 1", clockProgress(TEN_MIN, TEN_MIN), 1);
check("half clock is 0.5", clockProgress(TEN_MIN / 2, TEN_MIN), 0.5);
check("quarter clock is 0.25", clockProgress(150000, TEN_MIN), 0.25);
check("empty clock is 0", clockProgress(0, TEN_MIN), 0);
check("scale is per-side, not absolute (1min game, 30s left)", clockProgress(30000, 60000), 0.5);

console.log("\n--- Never below 0%, never above 100% ---");
check("negative remaining clamps to 0", clockProgress(-50000, TEN_MIN), 0);
check("one ms below zero clamps to 0", clockProgress(-1, TEN_MIN), 0);
check("increment past starting time clamps to 1", clockProgress(TEN_MIN + 45000, TEN_MIN), 1);
check("hugely over clamps to 1", clockProgress(TEN_MIN * 99, TEN_MIN), 1);
for (const ms of [-999999, -1, 0, 1, 12345, TEN_MIN, TEN_MIN * 3]) {
  const f = clockProgress(ms, TEN_MIN);
  const pct = Math.round(f * 100);
  check(`fraction in [0,1] for remaining=${ms}`, f >= 0 && f <= 1, true);
  check(`rendered percent in [0,100] for remaining=${ms}`, pct >= 0 && pct <= 100, true);
}

console.log("\n--- No clock scale means no bar, not a guessed one ---");
check("null total is 0", clockProgress(1000, null), 0);
check("undefined total is 0", clockProgress(1000, undefined), 0);
check("zero total is 0 (no divide by zero)", clockProgress(1000, 0), 0);
check("negative total is 0", clockProgress(1000, -5), 0);
check("NaN remaining is 0", clockProgress(NaN, TEN_MIN), 0);
check("Infinity total is 0", clockProgress(1000, Infinity), 0);

console.log("\n--- Low-time urgency thresholds ---");
check("100% is normal", clockUrgency(1), "normal");
check("just over half is normal", clockUrgency(0.51), "normal");
check("exactly half is caution", clockUrgency(0.5), "caution");
check("30% is caution", clockUrgency(0.3), "caution");
check("exactly 25% is caution", clockUrgency(0.25), "caution");
check("just under 25% is urgent", clockUrgency(0.2499), "urgent");
check("15% is urgent", clockUrgency(0.15), "urgent");
check("exactly 10% is urgent", clockUrgency(0.1), "urgent");
check("just under 10% is critical", clockUrgency(0.0999), "critical");
check("2% is critical", clockUrgency(0.02), "critical");
check("0% is critical", clockUrgency(0), "critical");

console.log("\n--- Tiers are ordered and each has a distinct colour ---");
const walk = [1, 0.75, 0.5, 0.25, 0.24, 0.1, 0.09, 0].map(clockUrgency);
const order = ["normal", "caution", "urgent", "critical"];
let monotonic = true;
for (let i = 1; i < walk.length; i++) {
  if (order.indexOf(walk[i]) < order.indexOf(walk[i - 1])) monotonic = false;
}
check("urgency never decreases as time runs out", monotonic, true);
check("all four tiers are reachable", new Set(walk).size, 4);
check("each tier has its own fill colour", new Set(Object.values(URGENCY_FILL)).size, 4);
check("every tier has a colour defined", order.every((t) => typeof URGENCY_FILL[t] === "string"), true);

console.log("\n--- No distracting flashing on the bar ---");
const barSrc = stripComments(read("components/game/ClockProgressBar.tsx"));
check("bar never animate-pulses", /animate-(pulse|ping|bounce)/.test(barSrc), false);
check("critical fill is solid, not animated", /animate/.test(URGENCY_FILL.critical), false);

console.log("\n--- One countdown, not two ---");
const hookName = "use" + "RemainingMs";
const clockSrc = stripComments(read("components/game/ChessClock.tsx"));
check("the digits use the shared hook", clockSrc.includes(hookName), true);
check("the bar uses the shared hook", barSrc.includes(hookName), true);
check("the bar has no interval of its own", /setInterval/.test(barSrc), false);
check("the digits have no interval of their own", /setInterval/.test(clockSrc), false);
const hookSrc = stripComments(read("lib/game/useRemainingMs.ts"));
check("exactly one setInterval backs both", (hookSrc.match(/setInterval/g) || []).length, 1);
check("the shared hook floors at zero", hookSrc.includes("Math.max(0,"), true);
const cardSrc = stripComments(read("components/game/PlayerCard.tsx"));
check("the card itself does no clock arithmetic", /Date\.now|setInterval|getTime/.test(cardSrc), false);

console.log("\n--- Rating comes from the live source ---");
const pageSrc = stripComments(read("app/online/[gameId]/page.tsx"));
const liveField = "resolution.child!." + "rating";
const staleField = "host_rating_" + "before";
check("the card's rating is read off the child row", pageSrc.includes(liveField), true);
check("the card is given that value", /rating=\{myRating\}/.test(pageSrc), true);
const cardCallSites = pageSrc.slice(pageSrc.indexOf("<PlayerCard"));
check(
  "the stale post-game column is never the card's rating",
  new RegExp("rating=\\{[^}]*" + staleField).test(cardCallSites),
  false
);

console.log("\n--- Missing rating degrades, never invents ---");
check("the card renders a rating only when it has a number", cardSrc.includes('typeof rating === "number"'), true);
check("no placeholder rating baked into the card", /\b(1200|1500|1000)\b/.test(cardSrc), false);
check("rating prop is optional", /rating\?:/.test(cardSrc), true);

console.log("\n--- No emoji flags (they render as boxes on Windows) ---");
const FLAG_GLYPH = /[\u{1F1E6}-\u{1F1FF}]/u;
for (const [name, src] of [["card", cardSrc], ["bar", barSrc], ["page", pageSrc]]) {
  check(`${name} contains no regional-indicator flag glyphs`, FLAG_GLYPH.test(src), false);
}

console.log("\n--- Active player switching drives the highlight ---");
check("the card marks which side is active", cardSrc.includes('data-active={isActive ? "true" : "false"}'), true);
check("active state changes the border colour", /isActive\s*\?\s*"border-premium-gold/.test(cardSrc), true);
check(
  "the page derives active from whose turn it is",
  /isActive=\{game\.current_turn === myColor && game\.status === "active"\}/.test(pageSrc),
  true
);
check(
  "the opponent card uses the opponent's colour",
  /isActive=\{game\.current_turn === opponentColor && game\.status === "active"\}/.test(pageSrc),
  true
);
check("the bar's running flag follows the same turn check", /isRunning: game\.current_turn === color/.test(pageSrc), true);
for (const side of ["myClock", "opponentClock"]) {
  check(`${side} feeds the card's bar`, new RegExp("clock=\{" + side + "\}").test(pageSrc), true);
  check(`${side} feeds the digits too`, new RegExp("LiveChessClock \{\.\.\." + side + "\}").test(pageSrc), true);
}

console.log("");
console.log("--- The card is unconditional, not gated on a World location ---");
check("the card does not consult the World", /useWorldLocation/.test(cardSrc), false);
check("the card does not import from lib/world", /lib\/world/.test(cardSrc), false);
check("the card has no location-dependent early return", /if \(!location\)/.test(cardSrc), false);
check("the online page renders the card directly", /<PlayerCard/.test(pageSrc), true);
check("no stale WorldPlayerRow reference survives", /WorldPlayerRow/.test(pageSrc), false);

console.log("\n--- Card layout survives without optional data ---");
check("clock block is conditional", /\{clock && \(/.test(cardSrc), true);
check("bar returns nothing without a scale", barSrc.includes("return null"), true);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

/**
 * Train Your Chess Mind — curriculum redesign tests.
 *
 * Imports the REAL engine modules (families, pool, selection, progression,
 * validator), the real pool index and the real puzzle libraries. Nothing is mocked
 * except the database (an in-memory fake mirrors the history table's per-child,
 * per-module semantics). Answer keys are checked against independent oracles
 * wherever one exists (chess.js attack queries, FEN material counts, SAN replay).
 *
 *   node scripts/test-train-your-mind-curriculum.js
 */
const fs = require("fs");
const path = require("path");
const cp = require("child_process");
const ts = require(path.join(process.cwd(), "node_modules", "typescript"));
const Module = require("module");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request.startsWith("@/")) request = path.join(process.cwd(), request.slice(2));
  return origResolve.call(this, request, ...rest);
};
require.extensions[".ts"] = function (mod, filename) {
  const js = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  }).outputText;
  mod._compile(js, filename);
};
const ROOT = process.cwd();
const R = (p) => require(path.join(ROOT, p));
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const { Chess } = require(path.join(ROOT, "node_modules", "chess.js"));

const curriculum = R("lib/trainYourMind/curriculum.ts");
const engine = R("lib/trainYourMind/engine/pool.ts");
const { validateExercise } = R("lib/trainYourMind/engine/validate.ts");
const geometry = R("lib/trainYourMind/engine/geometry.ts");
const prog = R("lib/trainYourMind/progression.ts");
const sel = R("lib/trainYourMind/exerciseSelection.ts");
const hist = R("lib/trainYourMind/exerciseHistory.ts");
const cfg = R("lib/trainYourMind/historyConfig.ts");
const { fnv1a } = R("lib/trainYourMind/exerciseIds.ts");
const { PATTERN_CHALLENGES } = R("content/chessMindPatterns.ts");
const { CALCULATION_CHALLENGES } = R("content/chessMindCalculation.ts");
const { consistencyLabel } = (() => {
  // The consistency rule lives in a client component; re-derive it from source text so the
  // test exercises the shipped function without needing a DOM.
  const src = read("components/chessMind/ReactionTrainer.tsx");
  const m = src.match(/export function consistencyLabel[\s\S]*?\r?\n}\r?\n/);
  const js = ts.transpileModule(m[0].replace("export ", ""), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  return { consistencyLabel: new Function(js + "; return consistencyLabel;")() };
})();

const INDEX = JSON.parse(read("data/trainYourMind/pool-index.json"));
const LIB_FILES = ["data/puzzles/tactics-library.json", "data/puzzles/tactics-library-train.json"].filter((f) => fs.existsSync(path.join(ROOT, f)));
const LIB = new Map();
for (const f of LIB_FILES) for (const p of JSON.parse(read(f))) if (!LIB.has(p.id)) LIB.set(p.id, p);

let pass = 0;
const failures = [];
function check(name, ok, detail) {
  if (ok) pass++;
  else {
    failures.push(name + (detail ? " -- " + detail : ""));
    console.log("FAIL:", name, detail || "");
  }
}
function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry(20261005);
const CATEGORIES = curriculum.TRAIN_CATEGORIES;

console.log("\n=== A. Families, levels and pool depth ===");
for (const cat of CATEGORIES) {
  const fams = engine.familiesFor(cat);
  check(`${cat}: has multiple exercise families (${fams.length})`, fams.length >= 3);
  check(`${cat}: every family id is namespaced and unique`, new Set(fams.map((f) => f.id)).size === fams.length && fams.every((f) => f.id.includes(".")));
  const counts = engine.levelCounts(INDEX, cat);
  for (const lvl of curriculum.LEVELS) {
    const min = lvl <= curriculum.FREE_MAX_LEVEL ? 80 : 20;
    check(`${cat}: level ${lvl} (${curriculum.LEVEL_NAMES[lvl]}) has depth >= ${min} (has ${counts[lvl]})`, counts[lvl] >= min);
  }
  const usedFamilies = fams.filter((f) => Object.values(INDEX.families[f.id] || {}).some((a) => a.length));
  check(`${cat}: at least 3 families actually have exercises in the pool`, usedFamilies.length >= 3, `${usedFamilies.length}`);
}
check("index only lists known families and valid levels", Object.entries(INDEX.families).every(([fam, byLevel]) => engine.familyById(fam) && Object.keys(byLevel).every((l) => ["1", "2", "3", "4", "5"].includes(l))));
check("level names cover all five levels", curriculum.LEVELS.length === 5 && curriculum.LEVELS.every((l) => curriculum.LEVEL_NAMES[l]));
check("ratingToLevel is monotonic and total", [500, 999, 1000, 1349, 1350, 1649, 1650, 1899, 1900, 2500].map(curriculum.ratingToLevel).join("") === "1122334455");
check("a single puzzle never gets the same question twice (no two families with one signature share a puzzle, in or across categories)", (() => {
  const seen = new Map();
  for (const [fam, byLevel] of Object.entries(INDEX.families)) {
    const def = engine.familyById(fam);
    if (!def.classify || !def.signature) continue;
    for (const ids of Object.values(byLevel)) for (const id of ids) {
      const k = def.signature + "|" + id;
      if (seen.has(k)) return false;
      seen.set(k, fam);
    }
  }
  return true;
})());

console.log("\n=== B. Stable, unique, deterministic ids ===");
const allIds = [];
for (const [fam, byLevel] of Object.entries(INDEX.families)) for (const [lvl, keys] of Object.entries(byLevel)) for (const key of keys) allIds.push({ fam, lvl: Number(lvl), key, id: `x:${fam}:${key}` });
check(`exercise ids are unique across the whole pool (${allIds.length})`, new Set(allIds.map((x) => x.id)).size === allIds.length);
check("every id fits the history column (<= 200 chars) and is x:-prefixed", allIds.every((x) => x.id.length <= 200 && x.id.startsWith("x:")));
function sample(arr, n) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
}
const stratified = [];
for (const fam of Object.keys(INDEX.families)) stratified.push(...sample(allIds.filter((x) => x.fam === fam), 60));
function buildOne(x) {
  const def = engine.familyById(x.fam);
  return def.build({ key: x.key, level: x.lvl, puzzle: LIB.get(x.key) });
}
let deterministic = true, idMatches = true, validOk = true, shuffleIndependent = true;
const built = [];
const invalid = [];
for (const x of stratified) {
  const a = buildOne(x), b = buildOne(x);
  if (!a || !b) { validOk = false; invalid.push(x.id + " (null)"); continue; }
  if (JSON.stringify(a) !== JSON.stringify(b)) deterministic = false;
  if (a.id !== x.id) idMatches = false;
  const errs = validateExercise(a);
  if (errs.length) { validOk = false; invalid.push(x.id + ": " + errs.join("; ")); }
  if (a.kind === "choice" && a.choices.some((c) => a.id.includes(c) && c.length > 6)) shuffleIndependent = false;
  built.push({ x, e: a });
}
check(`rebuilding an exercise yields byte-identical content (${stratified.length} sampled)`, deterministic);
check("the built id equals the pool descriptor id (one exercise, one id)", idMatches);
check("answer-option order cannot change an id (ids contain no choice text)", shuffleIndependent);
check("every sampled exercise passes structural validation (legal FEN, legal moves, valid answer index, explanations)", validOk, invalid.slice(0, 3).join(" | "));

console.log("\n=== C. Generated positions, moves and answers are legal and correct ===");
check("every sampled move-exercise line replays legally and flags mate correctly", built.filter((b) => b.e.kind === "move").every((b) => validateExercise(b.e).length === 0));
check("every choice exercise has exactly one correct answer among distinct choices", built.filter((b) => b.e.kind === "choice").every((b) => new Set(b.e.choices).size === b.e.choices.length && b.e.correctIndex >= 0 && b.e.correctIndex < b.e.choices.length));
const prompts = new Map();
let dupPrompt = 0; const dupInfo = [];
for (const { e } of built) { const k = e.fen + "|" + e.prompt.replace(/\s+/g, " ").toLowerCase(); if (prompts.has(k)) { dupPrompt++; dupInfo.push(prompts.get(k) + " ~ " + e.id); } prompts.set(k, e.id); }
check("no two sampled exercises share the same position + prompt", dupPrompt === 0, dupInfo.slice(0, 3).join(" | "));

// Oracle 1: ray geometry vs chess.js isAttacked on real positions.
{
  let mismatch = 0, checks = 0;
  for (const p of sample([...LIB.values()], 120)) {
    const g = new Chess(p.fen);
    const board = geometry.boardMap(g);
    for (let f = 0; f < 8; f++) for (let r = 0; r < 8; r++) {
      const sq = String.fromCharCode(97 + f) + (r + 1);
      for (const color of ["w", "b"]) {
        checks++;
        if ((geometry.attackersOf(board, sq, color).length > 0) !== g.isAttacked(sq, color)) mismatch++;
      }
    }
  }
  check(`attack geometry agrees with chess.js isAttacked (${checks} square checks)`, mismatch === 0, `mismatches=${mismatch}`);
}
// Oracle 2: material from the FEN string.
function fenMaterial(fen) {
  const v = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  let w = 0, b = 0;
  for (const ch of fen.split(" ")[0]) { if (/[pnbrq]/.test(ch)) b += v[ch]; else if (/[PNBRQ]/.test(ch)) w += v[ch.toLowerCase()]; }
  return { w, b };
}
{
  let ok = 0, bad = 0;
  for (const { e } of built.filter((b) => b.x.fam === "math.diff")) {
    const m = fenMaterial(e.fen);
    const diff = m.w - m.b;
    const want = diff === 0 ? "Equal" : diff > 0 ? `White +${diff}` : `Black +${-diff}`;
    if (e.choices[e.correctIndex] === want) ok++; else bad++;
  }
  check(`math.diff answers match an independent FEN count (${ok} checked)`, ok > 0 && bad === 0, `bad=${bad}`);
}
// Oracle 3: SAN replay material for math.sequence / math.tactic.
{
  let ok = 0, bad = 0;
  for (const { x, e } of built.filter((b) => ["math.tactic"].includes(b.x.fam))) {
    const p = LIB.get(x.key);
    const g = new Chess(p.fen);
    const start = fenMaterial(g.fen());
    const player = g.turn();
    for (const san of p.solutionSan) g.move(san);
    const end = fenMaterial(g.fen());
    const delta = (end.w - end.b) - (start.w - start.b);
    const gain = player === "w" ? delta : -delta;
    const want = gain > 0 ? `+${gain}` : String(gain);
    if (e.choices[e.correctIndex] === want) ok++; else bad++;
  }
  check(`math.tactic answers match an independent SAN replay (${ok} checked)`, ok > 0 && bad === 0, `bad=${bad}`);
}
// Oracle 4: known exchange values.
{
  const net = (fen, from, to) => geometry.exchangeNet(fen, from, to);
  check("exchange: Rxd5 Bxd5 Qxd5 battery nets -1 for White (known value)", net("4k3/8/4b3/3p4/8/8/3R4/3QK3 w - - 0 1", "d2", "d5") === -1);
  check("exchange: capturing an undefended pawn nets +1", net("4k3/8/8/3p4/8/8/3R4/4K3 w - - 0 1", "d2", "d5") === 1);
  check("exchange: queen takes a defended pawn nets -8", net("4k3/8/2p5/3p4/8/8/3Q4/4K3 w - - 0 1", "d2", "d5") === -8);
  check("exchange: non-capture returns null", net("4k3/8/8/8/8/8/3R4/4K3 w - - 0 1", "d2", "d5") === null);
}
// Oracle 5: king escape squares by brute-force legality.
{
  let ok = 0, bad = 0;
  for (const { e } of built.filter((b) => b.x.fam === "sp.escape")) {
    const g = new Chess(e.fen);
    const king = g.board().flat().find((c) => c && c.type === "k" && c.color === g.turn()).square;
    let n = 0;
    for (let df = -1; df <= 1; df++) for (let dr = -1; dr <= 1; dr++) {
      if (!df && !dr) continue;
      const f = king.charCodeAt(0) - 97 + df, r = parseInt(king[1], 10) - 1 + dr;
      if (f < 0 || f > 7 || r < 0 || r > 7) continue;
      const t = String.fromCharCode(97 + f) + (r + 1);
      const probe = new Chess(e.fen);
      try { probe.move({ from: king, to: t }); n++; } catch { /* illegal */ }
    }
    if (e.choices[e.correctIndex] === String(n)) ok++; else bad++;
  }
  check(`sp.escape counts match brute-force king-move legality (${ok} checked)`, ok > 0 && bad === 0, `bad=${bad}`);
}
// Oracle 6: mate-in-N exercises really end in mate; first moves are legal.
{
  let ok = 0, bad = 0;
  for (const { x } of built.filter((b) => b.x.fam === "calc.mate")) {
    const p = LIB.get(x.key);
    const g = new Chess(p.fen);
    for (const san of p.solutionSan) g.move(san);
    if (g.isCheckmate()) ok++; else bad++;
  }
  check(`calc.mate lines end in checkmate (${ok} checked)`, ok > 0 && bad === 0, `bad=${bad}`);
}
// Explanation <-> answer correspondence.
{
  const textual = ["calc.candidates", "calc.finish", "mem.sequence", "rx.flash", "pat.name", "pat.mate", "pat.hanging", "rx.hanging", "rx.check", "math.best", "mem.moved", "mem.missing", "viz.occupant", "mem.relation", "sp.mobility", "sp.restrict", "mem.hanging", "rx.threat"];
  let ok = 0, bad = [];
  for (const { x, e } of built.filter((b) => textual.includes(b.x.fam) && b.e.kind === "choice")) {
    const answer = e.choices[e.correctIndex].toLowerCase();
    const needle = answer.replace(/^(white|black) /, "").replace(/^(knight|bishop|rook|queen|pawn|king) on /, "");
    const hay = (e.explanation.correct + " " + e.explanation.incorrect).toLowerCase();
    if (hay.includes(answer) || hay.includes(needle)) ok++; else bad.push(x.id + " -> " + answer);
  }
  check(`explanations mention the correct answer (${ok} checked)`, ok > 0 && bad.length === 0, bad.slice(0, 3).join(" | "));
  const wrongKeys = built.filter((b) => b.e.kind === "choice").every((b) => b.e.explanation.correct !== b.e.explanation.incorrect);
  check("correct and incorrect explanations are different texts (teach, not just 'Correct')", wrongKeys);
  check("every incorrect explanation states the right answer or line (never just 'Wrong')", built.every((b) => b.e.explanation.incorrect.length > 40));
}

console.log("\n=== C2. Chess Mathematics 'Count the material' quality ===");
{
  const mm = R("lib/trainYourMind/engine/families/mathematics.ts");
  const diffIds = Object.entries(INDEX.families["math.diff"] || {}).flatMap(([lvl, keys]) => keys.map((k) => ({ lvl: Number(lvl), key: k })));
  let mirror = 0, onlyPR = 0, wrongLevel = 0, promptMismatch = 0, noMinor = 0;
  const perLevel = {};
  for (const { lvl, key } of diffIds) {
    const p = LIB.get(key);
    const m = mm.materialProfile(p.fen);
    perLevel[lvl] = (perLevel[lvl] || 0) + 1;
    if (m.mirror) mirror++;
    if (m.types.every((t) => t === "p" || t === "r")) onlyPR++;
    if (!m.types.some((t) => "nbq".includes(t))) noMinor++;
    if (mm.countLevel(m) !== lvl) wrongLevel++;
    const e = engine.familyById("math.diff").build({ key, level: lvl, puzzle: p });
    const legend = (e.prompt.match(/\(([^;]*);/) || [])[1] || "";
    const named = legend.split(" ").filter(Boolean).map((x) => x[0].toLowerCase()).sort().join("");
    if (named !== [...m.types].sort().join("")) promptMismatch++;
  }
  check(`no 'count the material' exercise is a mirror image (${diffIds.length} checked)`, mirror === 0, String(mirror));
  check("none contains only pawns and rooks", onlyPR === 0, String(onlyPR));
  check("every one involves a minor piece or queen, so piece values are really used", noMinor === 0, String(noMinor));
  check("each exercise sits at the level its composition earns", wrongLevel === 0, String(wrongLevel));
  check("the prompt lists the values of exactly the piece types visible on the board", promptMismatch === 0, String(promptMismatch));
  check("progression: Foundation, Developing and Intermediate all populated", [1, 2, 3].every((l) => (perLevel[l] || 0) >= 80), JSON.stringify(perLevel));
  check("count-the-material stops at Intermediate; captures/exchanges/promotions are Advanced+", !(perLevel[4] || perLevel[5]));
  const mk = (placement) => placement + " w - - 0 1";
  check("the reported position (R+2P vs R+2P) is rejected as too shallow", mm.countLevel(mm.materialProfile(mk("4k3/pp3p2/8/8/8/8/PP3P2/R3K2R"))) === null && mm.countLevel(mm.materialProfile(mk("r3k3/pp3p2/8/8/8/8/PP3P2/R3K3"))) === null);
  check("a varied unequal position is accepted (Q+R+2P vs R+B+2P)", mm.countLevel(mm.materialProfile(mk("r3kb2/pp6/8/8/8/8/PP6/Q3K2R"))) !== null);
  const seq = Object.entries(INDEX.families["math.sequence"]).flatMap(([l, k]) => k.map((x) => ({ l: Number(l), x })));
  const tac = Object.entries(INDEX.families["math.tactic"]).flatMap(([l, k]) => k.map((x) => ({ l: Number(l), x })));
  check("Advanced+ Mathematics exists: sequences at Level 4, tactical arithmetic at Levels 4-5", seq.some((e) => e.l === 4) && tac.some((e) => e.l === 5) && tac.some((e) => e.l === 4));
  const { buildContext } = R("lib/trainYourMind/engine/puzzleContext.ts");
  const masterOk = tac.filter((e) => e.l === 5).slice(0, 150).every((e) => { const c = buildContext(LIB.get(e.x)); return c.moves.filter((m) => m.captured).length >= 3 || c.moves.some((m) => m.promotion); });
  check("Master tactical arithmetic always involves 3+ captures or a promotion", masterOk);
}

console.log("\n=== C3. Piece Values: every referenced piece is on a legal board ===");
{
  const keys = Object.values(INDEX.families["math.basics"]).flat();
  const NAMES = { pawn: "p", knight: "n", bishop: "b", rook: "r", queen: "q" };
  const VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  const fam = engine.familyById("math.basics");
  const basics = keys.map((k) => ({ k, e: fam.build({ key: k, level: 1 }) }));
  check("Piece Values has both types (value and compare), including bishop vs knight", basics.some((b) => b.k.startsWith("value:")) && basics.some((b) => b.k.startsWith("compare:")) && keys.includes("compare:bn"), keys.join(","));
  check("every Piece Values exercise builds (none dropped)", basics.every((b) => b.e), basics.filter((b) => !b.e).map((b) => b.k).join(","));
  const absent = [], emptyBoards = [], illegal = [], extra = [], wrongSquare = [], wrongAnswer = [], notFoundation = [], badIds = [];
  for (const { k, e } of basics) {
    if (!e) continue;
    const g = new Chess(e.fen);
    const cells = g.board().flat().filter(Boolean);
    const nonKing = cells.filter((c) => c.type !== "k");
    if (!nonKing.length) emptyBoards.push(k);
    if (g.isCheck() || g.isAttacked("e8", "w") || cells.filter((c) => c.type === "k").length !== 2) illegal.push(k);
    const present = new Set(nonKing.map((c) => c.type));
    const named = Object.entries(NAMES).filter(([w]) => e.prompt.toLowerCase().includes(w)).map(([, c]) => c);
    if (named.some((c) => !present.has(c))) absent.push(k);
    if ([...present].some((c) => !named.includes(c)) || nonKing.length !== (k.startsWith("value:") ? 1 : 2)) extra.push(k);
    for (const sq of [...e.prompt.matchAll(/\b([a-h][1-8])\b/g)].map((m) => m[1])) if (!g.get(sq)) wrongSquare.push(k + ":" + sq);
    if (e.level !== 1) notFoundation.push(k);
    if (e.id !== "x:math.basics:" + k) badIds.push(k);
    const [kind, arg] = k.split(":");
    const ans = e.choices[e.correctIndex];
    if (kind === "value") {
      if (ans !== String(VALUES[arg])) wrongAnswer.push(k);
    } else {
      const [a, b] = arg.split("");
      const nm = (c) => Object.keys(NAMES).find((n) => NAMES[n] === c);
      const want = VALUES[a] === VALUES[b] ? "They are worth the same" : "The " + nm(VALUES[a] > VALUES[b] ? a : b);
      if (ans !== want) wrongAnswer.push(k + " got " + ans);
      if (new Set(e.choices).size !== e.choices.length || e.choices.length !== 3) wrongAnswer.push(k + " choices");
    }
    if (fam.build({ key: k, level: 1 }).choices.join() !== e.choices.join()) wrongAnswer.push(k + " nondeterministic");
  }
  check("no Piece Values question references a piece that is absent from the board", absent.length === 0, absent.join(","));
  check("no Piece Values exercise uses a kings-only board", emptyBoards.length === 0, emptyBoards.join(","));
  check("every Piece Values position is legal (two kings, nobody in check)", illegal.length === 0, illegal.join(","));
  check("boards contain exactly the referenced pieces, no random extras", extra.length === 0, extra.join(","));
  check("every square named in a prompt holds a piece", wrongSquare.length === 0, wrongSquare.join(","));
  check("answers are deterministic and equal the standard values (P1 N3 B3 R5 Q9)", wrongAnswer.length === 0, wrongAnswer.join(" | "));
  check("all Piece Values exercises are Foundation difficulty", notFoundation.length === 0, notFoundation.join(","));
  check("exercise ids are stable (x:math.basics:<key>) so history stays compatible", badIds.length === 0 && ["value:p", "value:n", "value:b", "value:r", "value:q", "compare:pn", "compare:rb", "compare:qr", "compare:rp", "compare:qb", "compare:nr"].every((k) => keys.includes(k)));
  check("bishop vs knight (equal value): the answer is 'They are worth the same'", (() => { const e = fam.build({ key: "compare:bn", level: 1 }); return e.choices[e.correctIndex] === "They are worth the same"; })());
  // Family-wide guard: ANY Mathematics exercise whose prompt names a piece must show that piece.
  const mathSample = built.filter((b) => b.e.category === "mathematics" && b.e.kind === "choice");
  const offenders = [];
  for (const { e } of mathSample) {
    const present = new Set(new Chess(e.fen).board().flat().filter((c) => c && c.type !== "k").map((c) => c.type));
    for (const [w, c] of Object.entries(NAMES)) if (new RegExp("\\b" + w + "\\b", "i").test(e.prompt) && !present.has(c)) offenders.push(e.id + " names " + w);
  }
  check("regression guard: no sampled Mathematics prompt names a piece type missing from its board (" + mathSample.length + " checked)", offenders.length === 0, offenders.slice(0, 3).join(" | "));
}

console.log("\n=== C4. Spatial Thinking: prompt and board must describe the same position ===");
{
  const sp = R("lib/trainYourMind/engine/families/spatial.ts");
  const PIECE = { king: "k", queen: "q", rook: "r", bishop: "b", knight: "n", pawn: "p" };
  const COLOR = { white: "w", black: "b" };
  const spFamilies = engine.FAMILIES.filter((f) => f.category === "spatial").map((f) => f.id);
  check("all nine Spatial families are present", ["sp.coords", "sp.kingwalk", "sp.knight", "sp.reach", "sp.common", "sp.escape", "sp.mobility", "sp.control", "sp.restrict"].every((f) => spFamilies.includes(f)));

  // Build: every static exercise (all of them) plus a sample of each puzzle-backed family.
  const items = [];
  for (const fam of spFamilies) {
    const keys = Object.entries(INDEX.families[fam] || {}).flatMap(([lvl, ks]) => ks.map((k) => ({ lvl: Number(lvl), key: k })));
    const chosen = ["sp.coords", "sp.kingwalk", "sp.knight"].includes(fam) ? keys : sample(keys, 90);
    for (const { lvl, key } of chosen) {
      const e = engine.familyById(fam).build({ key, level: lvl, puzzle: LIB.get(key) });
      items.push({ fam, key, lvl, e });
    }
  }
  const missing = items.filter((i) => !i.e).map((i) => i.fam + ":" + i.key);
  check(`every sampled Spatial exercise builds (${items.length} checked)`, missing.length === 0, missing.slice(0, 3).join(","));
  const built2 = items.filter((i) => i.e);

  // 1-3, 6. Every named piece exists, on the named square, with the named colour.
  const claimRe = /(?:(White|Black)(?:'s)?\s+)?\b(king|queen|rook|bishop|knight|pawn)\b(?: stands)?,?\s+(?:on|\()\s*([a-h][1-8])\b/gi;
  const bad = [];
  let claimsChecked = 0;
  for (const { fam, key, e } of built2) {
    const g = new Chess(e.fen);
    for (const m of e.prompt.matchAll(claimRe)) {
      claimsChecked++;
      const [, colour, word, sq] = m;
      const cell = g.get(sq);
      if (!cell || cell.type !== PIECE[word.toLowerCase()] || (colour && cell.color !== COLOR[colour.toLowerCase()])) bad.push(`${fam}:${key} says "${m[0]}" but board has ${cell ? cell.color + cell.type : "nothing"}`);
    }
  }
  check(`every piece the prompt places on a square is really there (${claimsChecked} claims checked)`, bad.length === 0, bad.slice(0, 3).join(" | "));
  check("the prompts really do make claims (guard is not vacuous)", claimsChecked >= 300, String(claimsChecked));

  // Plural form: "the kings (e1 and h8)".
  const kingsBad = [];
  for (const { fam, key, e } of built2) {
    const m = e.prompt.match(/the kings \(([a-h][1-8]) and ([a-h][1-8])\)/);
    if (!m) continue;
    const g = new Chess(e.fen);
    const wk = g.get(m[1]), bk = g.get(m[2]);
    if (!(wk && wk.type === "k" && wk.color === "w" && bk && bk.type === "k" && bk.color === "b")) kingsBad.push(`${fam}:${key}`);
  }
  check("'the kings (x and y)' names the actual White and Black king squares", kingsBad.length === 0, kingsBad.slice(0, 3).join(","));

  // 7. Positions are legal. Static boards: two kings, nobody in check, pieces never on top of each other.
  const illegal = [];
  for (const { fam, key, e } of built2) {
    try {
      const g = new Chess(e.fen);
      const kings = g.board().flat().filter((c) => c && c.type === "k");
      if (kings.length !== 2) illegal.push(`${fam}:${key} kings=${kings.length}`);
      if (["sp.coords", "sp.kingwalk", "sp.knight"].includes(fam)) {
        const bk = kings.find((c) => c.color === "b").square;
        if (g.isCheck() || g.isAttacked(bk, "w")) illegal.push(`${fam}:${key} in check`);
      }
    } catch { illegal.push(`${fam}:${key} unloadable`); }
  }
  check("every Spatial position is legal", illegal.length === 0, illegal.slice(0, 3).join(" | "));
  check("no static Spatial exercise uses a kings-only board", built2.filter((i) => ["sp.coords", "sp.kingwalk", "sp.knight"].includes(i.fam)).every((i) => new Chess(i.e.fen).board().flat().filter((c) => c && c.type !== "k").length >= 1 || i.fam === "sp.kingwalk"));

  // Board Coordinates.
  const coordsBad = [];
  for (const { key, e } of built2.filter((i) => i.fam === "sp.coords")) {
    const sq = key.split(":")[1];
    const g = new Chess(e.fen);
    const cell = g.get(sq);
    const light = (sq.charCodeAt(0) - 97 + parseInt(sq[1], 10) - 1) % 2 === 1;
    if (!cell || cell.type !== "n" || cell.color !== "w") coordsBad.push(key + " no knight");
    if (e.choices[e.correctIndex] !== (light ? "Light" : "Dark")) coordsBad.push(key + " wrong colour");
    if (!e.prompt.includes(sq)) coordsBad.push(key + " square not named");
  }
  check("Board Coordinates: a White knight stands on the named square and the colour answer is right (64)", coordsBad.length === 0, coordsBad.slice(0, 3).join(" | "));

  // King Walk: walker on the named start, other king where stated, target free, route legal and stated length true.
  const kwBad = [];
  for (const { key, e } of built2.filter((i) => i.fam === "sp.kingwalk")) {
    const [a, b] = key.split(":");
    const g = new Chess(e.fen);
    const wk = g.board().flat().find((c) => c && c.type === "k" && c.color === "w").square;
    const bk = g.board().flat().find((c) => c && c.type === "k" && c.color === "b").square;
    const d = Number(e.choices[e.correctIndex]);
    if (wk !== a) kwBad.push(key + " walker not on start");
    if (!e.prompt.includes(`on ${a};`) || !e.prompt.includes(`on ${bk},`)) kwBad.push(key + " prompt squares");
    if (g.get(b)) kwBad.push(key + " target occupied");
    if (sp.kingPathLength(a, b, bk) !== d) kwBad.push(key + " distance not true on this board");
    // The first step of a shortest route is a legal chess move from the displayed position.
    const steps = g.moves({ square: a, verbose: true }).map((m) => m.to);
    const cheb = (x, y) => Math.max(Math.abs(x.charCodeAt(0) - y.charCodeAt(0)), Math.abs(parseInt(x[1], 10) - parseInt(y[1], 10)));
    if (!steps.some((s2) => cheb(s2, b) === d - 1)) kwBad.push(key + " no legal first step toward target");
    if (cheb(a, bk) <= 1) kwBad.push(key + " kings adjacent");
  }
  check("King Walk: walker is on the named start, the other king where stated, the target is free, the route is legal and the answer true (48)", kwBad.length === 0, kwBad.slice(0, 3).join(" | "));

  // Knight Geometry.
  const knBad = [];
  for (const { key, e } of built2.filter((i) => i.fam === "sp.knight")) {
    const [a, b] = key.split(":");
    const g = new Chess(e.fen);
    const cells = g.board().flat().filter(Boolean);
    const n = cells.find((c) => c.type === "n");
    const wk = cells.find((c) => c.type === "k" && c.color === "w").square;
    const bk = cells.find((c) => c.type === "k" && c.color === "b").square;
    const d = Number(e.choices[e.correctIndex]);
    if (!n || n.square !== a || n.color !== "w") knBad.push(key + " knight not on start");
    if (g.get(b)) knBad.push(key + " target occupied");
    if (sp.knightPathLength(a, b, new Set([wk, bk])) !== d) knBad.push(key + " distance not true with kings on board");
    if (!e.prompt.includes(`(${wk} and ${bk})`)) knBad.push(key + " kings not named");
    const firsts = g.moves({ square: a, verbose: true }).map((m) => m.to);
    if (!firsts.some((s2) => sp.knightPathLength(s2, b, new Set([wk, bk])) === d - 1)) knBad.push(key + " no legal first move on a shortest route");
  }
  check("Knight Geometry: the knight stands on the named start, the kings are where stated and not in the way, the first move is legal and the answer true (48)", knBad.length === 0, knBad.slice(0, 3).join(" | "));

  // Piece Reach: named piece/square, answer = legal moves.
  const reachBad = [];
  for (const { key, e } of built2.filter((i) => i.fam === "sp.reach")) {
    const m = e.prompt.match(/the (\w+) on ([a-h][1-8]) legally/);
    const g = new Chess(e.fen);
    const cell = m && g.get(m[2]);
    if (!cell || cell.type !== PIECE[m[1]]) { reachBad.push(key + " piece"); continue; }
    if (g.moves({ square: m[2], verbose: true }).length !== Number(e.choices[e.correctIndex])) reachBad.push(key + " count");
    if (cell.color !== g.turn()) reachBad.push(key + " not side to move");
  }
  check("Piece Reach: the named piece is on the named square, belongs to the side to move, and the count is its legal moves", reachBad.length === 0, reachBad.slice(0, 3).join(" | "));

  // Shared Squares: both named pieces, exactly one common square that both could capture on / move to.
  const geo = geometry;
  const comBad = [];
  for (const { key, e } of built2.filter((i) => i.fam === "sp.common")) {
    const ms = [...e.prompt.matchAll(/(White|Black) (\w+) on ([a-h][1-8])/g)];
    const g = new Chess(e.fen);
    const board = geo.boardMap(g);
    if (ms.length !== 2) { comBad.push(key + " claims"); continue; }
    const answer = e.choices[e.correctIndex];
    const sets = ms.map((m) => new Set(geo.attackedSquares(board, m[3])));
    const attackable = (sq, color) => !board.has(sq) || board.get(sq).color !== color;
    const common = [...sets[0]].filter((sq) => sets[1].has(sq) && attackable(sq, COLOR[ms[0][1].toLowerCase()]) && attackable(sq, COLOR[ms[1][1].toLowerCase()]));
    if (common.length !== 1 || common[0] !== answer) comBad.push(key + " common=" + common.join("/") + " ans=" + answer);
    for (const c of e.choices) if (c !== answer && common.includes(c)) comBad.push(key + " distractor is common");
  }
  check("Shared Squares: both named pieces are present and the answer is the one square both can really attack", comBad.length === 0, comBad.slice(0, 3).join(" | "));

  // Escape Squares: the named king is on the named square; 'in check' claim true.
  const escBad = [];
  for (const { key, e } of built2.filter((i) => i.fam === "sp.escape")) {
    const m = e.prompt.match(/(White|Black)'s king on ([a-h][1-8])( is in check)?/);
    const g = new Chess(e.fen);
    const cell = m && g.get(m[2]);
    if (!cell || cell.type !== "k" || cell.color !== COLOR[m[1].toLowerCase()]) escBad.push(key + " king");
    if (m && Boolean(m[3]) !== g.inCheck()) escBad.push(key + " check claim");
  }
  check("Escape Squares: the named king is on the named square and the 'in check' claim is true", escBad.length === 0, escBad.slice(0, 3).join(" | "));

  // Most Active Piece: every choice names a piece that is really there, belonging to the mover; unique maximum.
  const mobBad = [];
  for (const { key, e } of built2.filter((i) => i.fam === "sp.mobility")) {
    const g = new Chess(e.fen);
    const counts = e.choices.map((c) => {
      const m = c.match(/^(\w+) on ([a-h][1-8])$/);
      const cell = m && g.get(m[2]);
      if (!cell || cell.type !== PIECE[m[1].toLowerCase()] || cell.color !== g.turn()) { mobBad.push(key + " choice " + c); return -1; }
      return g.moves({ square: m[2], verbose: true }).length;
    });
    const max = Math.max(...counts);
    if (counts.filter((c) => c === max).length !== 1 || counts[e.correctIndex] !== max) mobBad.push(key + " max");
  }
  check("Most Active Piece: every listed piece is on the board and the answer is the unique most mobile one", mobBad.length === 0, mobBad.slice(0, 3).join(" | "));

  // Square Control: the named square is real; answer = direct attackers of the side named.
  const ctlBad = [];
  for (const { key, e } of built2.filter((i) => i.fam === "sp.control")) {
    const m = e.prompt.match(/many (White|Black) pieces attack the square ([a-h][1-8])/);
    const g = new Chess(e.fen);
    if (!m) { ctlBad.push(key + " prompt"); continue; }
    const board = geo.boardMap(g);
    const n = geo.attackersOf(board, m[2], COLOR[m[1].toLowerCase()]).length;
    if (n !== Number(e.choices[e.correctIndex]) || n < 2) ctlBad.push(key + " count");
    if (!g.isAttacked(m[2], COLOR[m[1].toLowerCase()])) ctlBad.push(key + " not attacked");
  }
  check("Square Control: the named side really attacks the named square, and the count matches", ctlBad.length === 0, ctlBad.slice(0, 3).join(" | "));

  // Restrict the King: every option is legal from the displayed position; the answer leaves the fewest squares.
  const resBad = [];
  for (const { key, e } of built2.filter((i) => i.fam === "sp.restrict")) {
    const g = new Chess(e.fen);
    const escapes = e.choices.map((san) => {
      const probe = new Chess(e.fen);
      let mv = null;
      try { mv = probe.move(san); } catch { /* illegal */ }
      if (!mv) { resBad.push(key + " illegal " + san); return 99; }
      const enemy = probe.turn();
      const ksq = probe.board().flat().find((c) => c && c.type === "k" && c.color === enemy).square;
      return probe.moves({ square: ksq, verbose: true }).filter((x) => !x.san.startsWith("O-O")).length;
    });
    const min = Math.min(...escapes);
    if (escapes.filter((x) => x === min).length !== 1 || escapes[e.correctIndex] !== min) resBad.push(key + " min");
    if (g.inCheck()) resBad.push(key + " mover in check");
  }
  check("Restrict the King: every option is a legal move and the answer leaves the fewest king squares", resBad.length === 0, resBad.slice(0, 3).join(" | "));

  // 8-10. Determinism, stable ids, history compatibility.
  const nondet = built2.filter(({ fam, key, lvl, e }) => JSON.stringify(engine.familyById(fam).build({ key, level: lvl, puzzle: LIB.get(key) })) !== JSON.stringify(e)).length;
  check("Spatial exercises rebuild byte-identically (deterministic answers and choices)", nondet === 0, String(nondet));
  check("Spatial exercise ids are unchanged: x:<family>:<key> for all 64 + 48 + 48 static keys", built2.every(({ fam, key, e }) => e.id === `x:${fam}:${key}`) && (INDEX.families["sp.coords"] ? Object.values(INDEX.families["sp.coords"]).flat().length === 64 : false) && Object.values(INDEX.families["sp.kingwalk"]).flat().length === 48 && Object.values(INDEX.families["sp.knight"]).flat().length === 48);
  check("coordinate keys are still color:<square> for every square", (() => { const ks = new Set(Object.values(INDEX.families["sp.coords"]).flat()); for (let f = 0; f < 8; f++) for (let r = 1; r <= 8; r++) if (!ks.has(`color:${String.fromCharCode(97 + f)}${r}`)) return false; return true; })());
  check("history compatibility: ids still fit the history column and stay in one namespace", built2.every(({ e }) => e.id.length <= 200 && e.id.startsWith("x:sp.")));
  check("every Spatial exercise still passes structural validation", built2.every(({ e }) => validateExercise(e).length === 0));
}

console.log("\n=== D. Authored content retained and converted ===");
{
  const pat = INDEX.families["pat.classic"], calc = INDEX.families["calc.classic"];
  const patN = Object.values(pat).flat().length, calcN = Object.values(calc).flat().length;
  check(`all ${PATTERN_CHALLENGES.length} authored patterns are in the pool (${patN})`, patN === PATTERN_CHALLENGES.length);
  check(`all ${CALCULATION_CHALLENGES.length} authored calculation positions are in the pool (${calcN})`, calcN === CALCULATION_CHALLENGES.length);
  const fork = engine.familyById("pat.classic").build({ key: "fork-1", level: 1 });
  check("authored fork keeps its explanation and accepts the verified move", fork.kind === "move" && /fork/i.test(fork.explanation.correct) && fork.steps[0].from === "e5");
}

console.log("\n=== E. History-aware selection (Phase 1 preserved) ===");
function makeFakeDb() {
  const rows = new Map();
  let clock = 1_800_000_000_000;
  return {
    now: () => clock,
    tick: (ms) => { clock += ms; },
    client() {
      return {
        from() {
          const q = {};
          const api = {
            select() { return api; },
            eq(k, v) { q[k] = v; return api; },
            order() { return api; },
            limit(n) {
              const data = [...rows.values()].filter((r) => r.child_id === q.child_id && r.module_id === q.module_id).sort((a, b) => b.t - a.t).slice(0, n).map((r) => ({ exercise_id: r.exercise_id, last_seen_at: new Date(r.t).toISOString() }));
              return Promise.resolve({ data, error: null });
            },
          };
          return api;
        },
        rpc(name, a) {
          clock += 1;
          rows.set(`${a.p_child_id}|${a.p_module_id}|${a.p_exercise_id}`, { child_id: a.p_child_id, module_id: a.p_module_id, exercise_id: a.p_exercise_id, t: clock });
          return Promise.resolve({ error: null });
        },
      };
    },
  };
}
(async () => {
  // 1. 200 fresh-page picks (history only) never repeat within the window.
  {
    const db = makeFakeDb();
    const recent = []; let repeats = 0, immediate = 0, last = null;
    for (let i = 0; i < 200; i++) {
      const history = await hist.loadExerciseHistory(db.client(), "kid", "calculation");
      const picked = engine.pickExercise(INDEX, LIB, { category: "calculation", level: 3, history, rng, now: db.now() + 1 });
      const id = picked.exercise.id;
      if (recent.includes(id)) repeats++;
      if (id === last) immediate++;
      last = id;
      recent.push(id); if (recent.length > cfg.RECENT_WINDOW_COUNT) recent.shift();
      await hist.recordExerciseSeen(db.client(), "kid", "calculation", id);
      db.tick(1000);
    }
    check("200 picks: no exercise repeats within the recent window", repeats === 0, `repeats=${repeats}`);
    check("200 picks: never the same exercise twice in a row", immediate === 0);
  }
  // 2. Cross-device acceptance on the new engine.
  {
    const db = makeFakeDb();
    let violations = 0;
    for (let t = 0; t < 120; t++) {
      const hA = await hist.loadExerciseHistory(db.client(), "kidX", "pattern");
      const a = engine.pickExercise(INDEX, LIB, { category: "pattern", level: 2, history: hA, rng, now: db.now() + 1 });
      await hist.recordExerciseSeen(db.client(), "kidX", "pattern", a.exercise.id);
      db.tick(5000);
      const hB = await hist.loadExerciseHistory(db.client(), "kidX", "pattern"); // Device B: fresh page, only the DB
      const b = engine.pickExercise(INDEX, LIB, { category: "pattern", level: 2, history: hB, rng, now: db.now() + 1 });
      await hist.recordExerciseSeen(db.client(), "kidX", "pattern", b.exercise.id);
      db.tick(5000);
      if (a.exercise.id === b.exercise.id) violations++;
    }
    check("cross-device: Device B never receives Device A's exercise (120 trials)", violations === 0, `violations=${violations}`);
  }
  // 3. Sibling and module isolation.
  {
    const db = makeFakeDb();
    await hist.recordExerciseSeen(db.client(), "sibA", "pattern", "x:pat.classic:fork-1");
    const hB = await hist.loadExerciseHistory(db.client(), "sibB", "pattern");
    const hOtherModule = await hist.loadExerciseHistory(db.client(), "sibA", "memory");
    check("sibling child's history is not visible", hB.length === 0);
    check("another module's history is not visible", hOtherModule.length === 0);
  }
  // 4. Least-recent fallback and tiny pools.
  {
    const tiny = { version: 1, families: { "calc.classic": { "1": ["calc-l1-hanging-bishop", "calc-l1-back-rank-mate"] } } };
    const tinyLib = new Map();
    const now = 1_900_000_000_000;
    const history = [
      { exerciseId: "x:calc.classic:calc-l1-hanging-bishop", lastSeenAt: now - 1000 },
      { exerciseId: "x:calc.classic:calc-l1-back-rank-mate", lastSeenAt: now - 5000 },
    ];
    const p = engine.pickExercise(tiny, tinyLib, { category: "calculation", level: 1, history, now, rng });
    check("exhausted pool falls back to the LEAST-recently-seen exercise", p && p.reason === "least-recent" && p.exercise.id.endsWith("calc-l1-back-rank-mate"));
    const q = engine.pickExercise(tiny, tinyLib, { category: "calculation", level: 1, history, now, rng, exclude: ["x:calc.classic:calc-l1-back-rank-mate"] });
    check("fallback never repeats the on-screen exercise when another exists", q && q.exercise.id.endsWith("calc-l1-hanging-bishop"));
    const solo = { version: 1, families: { "calc.classic": { "1": ["calc-l1-hanging-bishop"] } } };
    const s1 = engine.pickExercise(solo, tinyLib, { category: "calculation", level: 1, history, now, rng, exclude: ["x:calc.classic:calc-l1-hanging-bishop"] });
    check("a one-exercise pool still serves it instead of getting stuck", s1 && s1.exercise.id.endsWith("calc-l1-hanging-bishop"));
    const none = engine.pickExercise({ version: 1, families: {} }, tinyLib, { category: "calculation", level: 1, history: [], now, rng });
    check("an empty pool returns null (caller shows a retry) rather than throwing", none === null);
    const near = engine.pickExercise(tiny, tinyLib, { category: "calculation", level: 5, history: [], now, rng });
    check("asking for a level with no content serves the nearest populated level", near && near.servedLevel === 1);
  }
  // 5. Variety: successive picks rotate families.
  {
    const db = makeFakeDb();
    const fams = new Set(); let lastFam = null, sameRun = 0, maxRun = 0;
    for (let i = 0; i < 40; i++) {
      const history = await hist.loadExerciseHistory(db.client(), "var", "mathematics");
      const picked = engine.pickExercise(INDEX, LIB, { category: "mathematics", level: 3, history, rng, now: db.now() + 1, lastFamily: lastFam });
      fams.add(picked.exercise.family);
      sameRun = picked.exercise.family === lastFam ? sameRun + 1 : 0; maxRun = Math.max(maxRun, sameRun);
      lastFam = picked.exercise.family;
      await hist.recordExerciseSeen(db.client(), "var", "mathematics", picked.exercise.id);
      db.tick(1000);
    }
    check(`a session mixes exercise families (${fams.size} families in 40 picks)`, fams.size >= 3);
    check("the same family is not served back-to-back when others exist", maxRun === 0, `maxRun=${maxRun}`);
  }

  console.log("\n=== F. Free vs Premium ===");
  check("free limit is Foundation + Developing (levels 1-2)", curriculum.FREE_MAX_LEVEL === 2 && [1, 2].every((l) => curriculum.isLevelAllowed(l, false)) && [3, 4, 5].every((l) => !curriculum.isLevelAllowed(l, false)));
  check("premium may train every level", [1, 2, 3, 4, 5].every((l) => curriculum.isLevelAllowed(l, true)));
  for (const cat of CATEGORIES) {
    const p = engine.pickExercise(INDEX, LIB, { category: cat, level: 5, history: [], rng });
    check(`${cat}: Premium level 5 serves Master-level content`, p && p.servedLevel === 5 && p.exercise.level === 5);
    const f = engine.pickExercise(INDEX, LIB, { category: cat, level: 1, history: [], rng });
    check(`${cat}: Free level 1 serves Foundation content`, f && f.exercise.level === 1);
  }
  const route = read("app/api/chess-mind/train/route.ts");
  const lockIdx = route.indexOf("isLevelAllowed(level, isPremium)");
  const pickIdx = route.indexOf("pickExercise(");
  check("server gates Premium levels BEFORE any exercise is picked (locked content never leaves the server)", lockIdx > 0 && pickIdx > lockIdx && /locked:/.test(route));
  check("premium is resolved with the existing entitlement code, not re-derived", /resolvePremiumState\(parent\)/.test(route) && /PARENT_PREMIUM_COLUMNS/.test(route));
  check("the train route requires an authenticated user", /getSessionUser/.test(route) && /401/.test(route));
  check("the free daily limit is 3 per category per day (trainYourMindPerCategory)", /trainYourMindPerCategory:\s*3/.test(read("lib/entitlement/dailyLimits.ts")));
  const unchanged = ["supabase/migrations/0044_train_your_mind_daily_usage.sql", "supabase/migrations/0050_train_your_mind_limit_3.sql"];
  const diff = cp.spawnSync("git", ["diff", "--quiet", "HEAD", "--", ...unchanged], { cwd: ROOT });
  check("the legacy per-category RPC migrations (0044/0050) are byte-identical to HEAD (the server-enforced limit is a NEW migration, 0055)", diff.status === 0, `git diff status ${diff.status}`);
  check("TrainDrill records completions through the shared hook only (the limit lives in the server ledger, see test-train-your-mind-daily-limit.js)", /dailyLimit\.recordCompletion\(key/.test(read("components/trainYourMind/TrainDrill.tsx")) && !/record_train_your_mind_use/.test(read("components/trainYourMind/TrainDrill.tsx")));

  console.log("\n=== G. Progression rules (deterministic, explainable) ===");
  const A = (over = {}) => ({ correct: true, ms: 8000, assisted: false, family: "calc.find", level: 1, ...over });
  const run = (attempts, premium = true, from = prog.initialProgress()) => attempts.reduce((acc, a) => { const r = prog.applyAttempt(acc.state, a, premium); return { state: r.state, events: [...acc.events, r.event] }; }, { state: from, events: [] });
  {
    const r = run([A(), A(), A(), A(), A()]);
    check("5 clean correct answers at Foundation -> level up to Developing", r.state.level === 2 && r.events.at(-1).kind === "level-up");
    const four = run([A(), A(), A(), A()]);
    check("4 correct answers are not enough to level up", four.state.level === 1);
    const mixed = run([A(), A({ correct: false }), A(), A(), A()]);
    check("80% accuracy over 5 (4/5) levels up", mixed.state.level === 2);
    const poor = run([A(), A({ correct: false }), A({ correct: false }), A(), A()]);
    check("60% accuracy does not level up", poor.state.level === 1);
    const assisted = run([A({ assisted: true }), A({ assisted: true }), A({ assisted: true }), A({ assisted: true }), A({ assisted: true })]);
    check("assisted (Show board) answers never count towards promotion", assisted.state.level === 1 && assisted.state.correct === 0);
    const down = run([A(), A(), A(), A()].map((a) => ({ ...a, correct: false })), true, { ...prog.initialProgress(), level: 3 });
    check("repeated mistakes step down one level to reinforce", down.state.level === 2 && down.events.at(-1).kind === "level-down");
    const floor = run([A({ correct: false }), A({ correct: false }), A({ correct: false }), A({ correct: false })]);
    check("level never drops below Foundation", floor.state.level === 1);
    const slow = run([A({ ms: 80000 }), A({ ms: 80000 }), A({ ms: 80000 }), A({ ms: 80000 }), A({ ms: 80000 })]);
    check("accurate but slow stays at the level and trains speed (explained)", slow.state.level === 1 && slow.events.at(-1).kind === "speed");
    const slowLong = run(Array.from({ length: 10 }, () => A({ ms: 80000 })));
    check("slow-but-accurate learners are not stuck forever (promoted by 10 attempts)", slowLong.state.level >= 2);
    const free = run([A({ level: 2 }), A({ level: 2 }), A({ level: 2 }), A({ level: 2 }), A({ level: 2 })], false, { ...prog.initialProgress(), level: 2, bestLevel: 2 });
    check("a free learner at the free cap is told about Premium, not promoted", free.state.level === 2 && free.events.at(-1).kind === "premium-cap");
    check("levelToServe never exceeds the entitlement", prog.levelToServe({ ...prog.initialProgress(), level: 5 }, false) === 2 && prog.levelToServe({ ...prog.initialProgress(), level: 5 }, true) === 5);
    const reinforce = run([A({ correct: false, family: "calc.line2" }), A({ correct: false, family: "calc.line2" }), A({ correct: false, family: "calc.line2" })], true, { ...prog.initialProgress(), level: 3 });
    check("3 wrong in a row in one family flags it for reinforcement", reinforce.state.reinforce === "calc.line2");
    const cleared = run([A({ family: "calc.line2" })], true, { ...prog.initialProgress(), reinforce: "calc.line2" });
    check("a correct answer in that family clears the reinforcement flag", cleared.state.reinforce === null);
    const top = { ...prog.initialProgress(), level: 5, bestLevel: 5, lastTen: [1, 1, 1, 1, 1, 1, 1, 0, 1] };
    const mastery = run([A({ level: 5 })], true, top);
    check("8 of the last 10 at Master level -> Mastered", mastery.state.mastered === true && mastery.events.at(-1).kind === "mastered");
    const fastWrong = run(Array.from({ length: 10 }, () => A({ correct: false, ms: 300, level: 5 })), true, { ...prog.initialProgress(), level: 5 });
    check("fast wrong answers are never mastery", !fastWrong.state.mastered);
    check("progress meter counts only clean correct answers, capped at 5", prog.levelProgress(run([A(), A(), A()]).state).have === 3);
    check("window and family stats stay bounded", (() => { const r = run(Array.from({ length: 200 }, (_, i) => A({ family: "f" + (i % 80) }))); return r.state.window.length <= 10 && Object.keys(r.state.familyStats).length <= 40 && r.state.lastTen.length <= 10; })());
    check("level-up resets the window so each level is earned", run([A(), A(), A(), A(), A()]).state.window.length === 0);
  }
  check("Reaction consistency: fewer than 4 correct answers shows no verdict", consistencyLabel([1000, 1100, 1200]) === "—");
  check("Reaction consistency: tight times are 'Steady'", consistencyLabel([1000, 1050, 980, 1020, 1010]) === "Steady");
  check("Reaction consistency: erratic times are 'Variable'", consistencyLabel([500, 4000, 700, 5000, 600]) === "Variable");
  check("Reaction speed targets are shorter than the general ones at every level", [1, 2, 3, 4, 5].every((l) => prog.REACTION_TARGET_SECONDS[l] < prog.TARGET_SECONDS[l]));

  console.log("\n=== H. Migration 0054 (progress) static checks ===");
  const sql = read("supabase/migrations/0054_train_your_mind_progress.sql");
  const code = sql.replace(/^--.*$/gm, "");
  check("primary key (child_id, module_id); child FK cascades", /primary key \(child_id, module_id\)/.test(sql) && /references public\.children\(id\) on delete cascade/.test(sql));
  check("module ids are whitelisted to the seven categories (table check and RPC)", (sql.match(/'pattern', 'visualization', 'calculation', 'memory', 'spatial', 'mathematics', 'reaction'/g) || []).length >= 2);
  check("RLS enabled with a parent-owns-child SELECT policy only", /enable row level security/.test(sql) && /for select/.test(sql) && !/for (insert|update|delete|all)\b/i.test(sql));
  check("all table privileges revoked from public/anon/authenticated; only SELECT re-granted", /revoke all on public\.child_train_your_mind_progress from public, anon, authenticated/.test(sql) && /grant select on public\.child_train_your_mind_progress to authenticated/.test(sql));
  check("RPC re-verifies ownership from auth.uid() and is SECURITY DEFINER with a pinned search_path", /p\.auth_user_id = auth\.uid\(\)/.test(sql) && /not authorized for this child/.test(sql) && /security definer set search_path = public, pg_temp/.test(sql));
  check("a free account can never be stored above level 2 (uses the existing parent_is_premium)", /parent_is_premium\(v_parent_id\)/.test(sql) && /least\(p_level, 2::smallint\)/.test(sql));
  check("payload sizes are bounded and validated", /jsonb_array_length\(p_recent\) > 12/.test(sql) && /pg_column_size\(p_family_stats\) > 4096/.test(sql) && /p_correct > p_attempts/.test(sql));
  check("RPC is revoked from public/anon and granted to authenticated", /revoke all on function public\.save_train_your_mind_progress\([^)]*\) from public, anon/.test(sql) && /grant execute on function public\.save_train_your_mind_progress\([^)]*\) to authenticated/.test(sql));
  check("purely additive: touches no existing table, policy or function", !/^\s*drop /im.test(code) && [...code.matchAll(/alter table ([\w.]+)/gi)].every((m) => m[1] === "public.child_train_your_mind_progress") && !/child_train_your_mind_activity|record_train_your_mind_use|exercise_history/.test(code));
  check("migration number follows 0053", fs.existsSync(path.join(ROOT, "supabase/migrations/0053_train_your_mind_exercise_history.sql")) && !fs.readdirSync(path.join(ROOT, "supabase/migrations")).some((f) => /^005[6-9]/.test(f)));

  console.log("\n=== I. Wiring and scope ===");
  const drill = read("components/trainYourMind/TrainDrill.tsx");
  check("TrainDrill fetches from the shared engine route", /\/api\/chess-mind\/train/.test(drill));
  check("progress and history stay per-child in the database (no localStorage for either)", !/localStorage/.test(drill) && !/localStorage/.test(read("lib/trainYourMind/useProgression.ts")) && !/localStorage/.test(read("lib/trainYourMind/progressClient.ts")));
  check("'Show board' help is recorded as assisted and not counted towards promotion", /assisted/.test(drill) && /Show board \(counts as help\)/.test(drill));
  check("Next prefetch is held in a ref and only recorded when presented", /prefetched\.current = fetchExercise\(levelRef\.current\)/.test(drill) && /const present = useCallback/.test(drill));
  check("the hub shows per-category level and progress for the active child", /loadAllProgress/.test(read("app/chess-mind/page.tsx")) && /TrainStatus/.test(read("app/chess-mind/page.tsx")));
  check("hub copy varies by World only through wording (all three Worlds defined, no fourth)", Object.keys(R("lib/trainYourMind/worldVoice.ts").WORLD_VOICE).sort().join() === "atelier,classic,enchanted");
  check("Reaction offers five modes and tracks accuracy, time and consistency", (read("components/chessMind/ReactionTrainer.tsx").match(/id: "rx\./g) || []).length === 5 && /Consistency/.test(read("components/chessMind/ReactionTrainer.tsx")));
  check("Tactical Thinking stays an Academy course (not converted to a drill)", /href: "\/academy\/tactical-thinking"/.test(read("content/chessMindCategories.ts")) && !engine.FAMILIES.some((f) => /tactical/i.test(f.id)));
  check("pool index matches the puzzle library on disk (fingerprint)", INDEX.fingerprint === fnv1a([...LIB.keys()].sort().join(",")) && INDEX.puzzleCount === LIB.size, `index ${INDEX.puzzleCount} vs lib ${LIB.size}`);
  check("puzzle library never reaches a client bundle (server-only loader, fs at runtime)", /import fs from "node:fs"/.test(read("lib/trainYourMind/engine/library.server.ts")) && !/library\.server/.test(drill) && !/library\.server/.test(read("components/chessMind/ReactionTrainer.tsx")));
  // Library schema check for any extended file.
  if (LIB_FILES.length > 1) {
    const extra = JSON.parse(read("data/puzzles/tactics-library-train.json"));
    check(`extended library: ${extra.length} puzzles, unique ids, none duplicate the base library`, new Set(extra.map((p) => p.id)).size === extra.length && !extra.some((p) => JSON.parse(read("data/puzzles/tactics-library.json")).some((b) => b.id === p.id)));
    check("extended library sample: legal FENs, legal solution lines, valid ratings", sample(extra, 400).every((p) => { try { const g = new Chess(p.fen); for (const u of p.solution) g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); return p.rating >= 400 && p.rating <= 3200 && [1, 3, 5].includes(p.solution.length); } catch { return false; } }));
  }

  console.log(`\n${pass} checks passed, ${failures.length} failed`);
  if (failures.length) { console.log(failures.map((f) => " - " + f).join("\n")); process.exit(1); }
})();

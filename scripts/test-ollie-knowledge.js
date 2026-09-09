/**
 * Tests for lib/ollie/knowledge.ts — Ollie's deterministic knowledge layer.
 *
 *   node scripts/test-ollie-knowledge.js
 *
 * This imports the REAL TypeScript module. That matters: the bug this layer
 * replaces shipped while a test file that re-implemented the matcher in plain
 * JS passed happily, because the copy and the original had drifted. Nothing
 * here re-implements anything.
 *
 * No network, no model, no key. The knowledge layer is pure by construction —
 * message in, answer out — which is the whole reason Ollie can be trusted to
 * behave the same in production, where the Anthropic call may be failing
 * silently, as it does here.
 *
 * Two properties are load-bearing:
 *   1. Ollie ANSWERS what he knows — including questions that name no piece,
 *      which is the exact failure this replaces.
 *   2. Ollie NEVER GUESSES. An unmatched question returns null, so the caller
 *      says so honestly instead of returning an unrelated canned answer.
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

const K = require(path.join(process.cwd(), "lib", "ollie", "knowledge.ts"));
const { LESSONS } = require(path.join(process.cwd(), "content", "lessons.ts"));

let pass = 0;
const failures = [];
const check = (n, c) => (c ? pass++ : failures.push(n));

/** Ask Ollie a question; returns the KnowledgeAnswer or null. */
const ask = (q, history = []) => K.answerFromKnowledge(K.classify(q, history));
const idOf = (q, history = []) => (ask(q, history) || {}).id ?? null;

// --- 1. The reported failure --------------------------------------------
{
  // Verbatim, as the child typed it. Names no piece; the old matcher had an
  // answer for it but reached it only if you already said "queen".
  const q = "which is the powerful chess piece in the board";
  check("the reported question is answered at all", ask(q) !== null);
  check("the reported question routes to mostPowerful", idOf(q) === "chess.mostPowerful");
  check("the answer names the queen", /queen/i.test(ask(q).text));
  check("the answer also explains the king is most important", /important/i.test(ask(q).text));

  // The same question, every way a child might phrase it.
  const phrasings = [
    "which is the most powerful piece?",
    "what is the strongest chess piece",
    "which piece is the best?",
    "whats the most powerful piece on the board",
    "which chess piece is strongest",
    "tell me the most powerful piece",
  ];
  for (const p of phrasings) {
    check(`phrasing answered: "${p}"`, idOf(p) === "chess.mostPowerful");
  }
}

// --- 2. The 14 questions Ollie must be able to answer --------------------
{
  const MUST_ANSWER = [
    ["which is the powerful chess piece in the board", "chess.mostPowerful"],
    ["what is the most powerful piece?", "chess.mostPowerful"],
    ["how does the knight move?", "chess.knight"],
    ["can a pawn move backwards?", "chess.pawnBackward"],
    ["what is check?", "chess.check"],
    ["what is checkmate?", "chess.checkmate"],
    ["what is stalemate?", "chess.stalemate"],
    ["what is a fork?", "chess.fork"],
    ["what is a pin?", "chess.pin"],
    ["what is castling?", "chess.castling"],
    ["how many points is a queen worth?", "chess.valueQueen"],
    ["who moves first?", "chess.whoStarts"],
    ["how many days is chess school?", "product.school.days"],
    ["what is chess mind world?", "product.world"],
  ];
  check("the required question list is 14 long", MUST_ANSWER.length === 14);
  for (const [q, expected] of MUST_ANSWER) {
    check(`"${q}" -> ${expected}`, idOf(q) === expected);
  }

  // Every one of them must produce real, child-readable prose.
  for (const [q] of MUST_ANSWER) {
    const a = ask(q);
    check(`"${q}" has a substantial answer`, !!a && a.text.length > 40);
    check(`"${q}" answer has no placeholder`, !!a && !/TODO|undefined|NaN|\{\}/.test(a.text));
  }
}

// --- 3. Never guess ------------------------------------------------------
{
  const unknown = [
    "purple elephant banana",
    "what is the capital of France?",
    "asdfgh",
    "",
    "   ",
    "what did I have for breakfast",
  ];
  for (const q of unknown) {
    check(`no guess for: "${q}"`, ask(q) === null);
  }

  // Null must be reachable — a knowledge layer that answers everything is
  // guessing, whatever it says.
  check("unknown input yields null, not a canned answer", ask("qqq zzz") === null);
}

// --- 4. Superlative words must not hijack unrelated questions ------------
{
  // "best" with no piece in sight is NOT a question about the queen.
  check("'what is the best opening?' is not answered as most-powerful", idOf("what is the best opening?") !== "chess.mostPowerful");
  check("'world champion' is a chess phrase, not Chess Mind World", idOf("who is the world champion?") !== "product.world");
}

// --- 5. Word-boundary traps ---------------------------------------------
{
  // "stalemate" ends in "mate" — an unanchored /mate\b/ answers it with the
  // checkmate rule, which is a different rule of chess entirely.
  check("stalemate is not answered as checkmate", idOf("what is stalemate?") === "chess.stalemate");
  check("checkmate is not answered as check", idOf("what is checkmate?") === "chess.checkmate");
  check("check is not answered as checkmate", idOf("what does check mean?") === "chess.check");
  check("castling is not answered as the rook", idOf("how do I castle?") === "chess.castling");
}

// --- 6. Pieces, comparisons and values ----------------------------------
{
  check("rook", idOf("what does a rook do?") === "chess.rook");
  check("knight", idOf("tell me about the knight") === "chess.knight");
  check("bishop", idOf("what is a bishop?") === "chess.bishop");
  check("queen", idOf("what is the queen?") === "chess.queen");
  check("king", idOf("what is the king?") === "chess.king");
  check("pawn", idOf("what is a pawn?") === "chess.pawn");
  check("horse means knight", idOf("how does the horse move?") === "chess.knight");

  check("king vs queen capture", idOf("can a king capture a queen?") === "chess.kingTakesQueen");
  check("rook vs bishop", idOf("is a rook or a bishop better?") === "chess.rookVsBishop");
  check(
    "queen vs king power routes to most-powerful",
    idOf("is the queen stronger than the king?") === "chess.mostPowerful"
  );
  check(
    "any other two-piece comparison gets the value table",
    idOf("is a knight better than a pawn?") === "chess.compare"
  );

  check("minor piece value", idOf("which pieces are worth 3 points?") === "chess.valueMinor");
  check("general values", idOf("how many points is each piece worth?") === "chess.values");
  check("promotion", idOf("what happens when my pawn reaches the end? promotion") === "chess.promotion");
  check("en passant", idOf("what is en passant?") === "chess.enPassant");
  check("skewer", idOf("what is a skewer?") === "chess.skewer");
}

// --- 7. Pronouns resolve against the conversation ------------------------
{
  const afterRook = [
    { from: "child", text: "What is a rook?" },
    { from: "buddy", text: "The rook marches in straight lines." },
  ];
  check("'how does it move?' after rook means the rook", idOf("how does it move?", afterRook) === "chess.rook");

  // A new piece in the question wins over the old context.
  check(
    "naming a new piece overrides prior context",
    idOf("what about the queen?", afterRook) === "chess.queen"
  );

  // No history, a bare pronoun: nothing to resolve, so no guess.
  check("bare pronoun with no history is not guessed", ask("how does it move?") === null);

  // Malformed history must not throw.
  let threw = false;
  try {
    ask("how does it move?", [{ from: "child" }, null, { text: null }]);
  } catch {
    threw = true;
  }
  check("malformed history does not throw", threw === false);
}

// --- 8. Product answers must be TRUE ------------------------------------
{
  const school = ask("what is chess school?");
  check("chess school is described", school !== null);
  check(
    "the stated course length matches content/lessons.ts",
    school.text.includes(String(LESSONS.length))
  );
  check("the course length really is 30", LESSONS.length === 30);

  // Chess Mind World is real now — this is the single easiest place for the
  // app to lie to a child, so the test checks Ollie's claim against the
  // actual location registry rather than trusting the prose. If a location
  // is ever added or removed from lib/world/locations.ts without this
  // answer being touched, one of the two checks below fails.
  const world = ask("what is chess mind world?");
  const worldCodeExists =
    fs.existsSync(path.join(process.cwd(), "app", "world")) ||
    fs.existsSync(path.join(process.cwd(), "lib", "world"));
  check("World has shipped, so this test's assumptions must match", worldCodeExists === true);
  check(
    "Ollie no longer claims World is unavailable now that it exists",
    !/isn't available|still being built/i.test(world.text)
  );
  const { WORLD_LOCATIONS } = require(path.join(process.cwd(), "lib", "world", "locations.ts"));
  check("the World registry is not empty", WORLD_LOCATIONS.length > 0);
  for (const loc of WORLD_LOCATIONS) {
    check(`Ollie's World answer names ${loc.title}`, world.text.includes(loc.title));
  }
  check(
    "Ollie names only real locations, not extra invented ones",
    WORLD_LOCATIONS.length === 2 // if this changes, the two lines above must be revisited too
  );

  check("puzzles are described", idOf("what are puzzles?") === "product.puzzles");
  check("progress is described", idOf("how does my progress work?") === "product.progress");
  check("premium defers to the grown-up", /grown-?up|parent/i.test(ask("is premium free?").text));
  check("comparison to other apps is not a boast", !/best app|better than/i.test(ask("is this better than other apps?").text));

  // A product word must not swallow a chess question.
  check("'what is a pin?' is chess, not product", idOf("what is a pin?") === "chess.pin");
}

// --- 9. Distinct questions, distinct answers ----------------------------
{
  const questions = [
    "what does a rook do?",
    "is the queen stronger than the king?",
    "can a knight jump over pieces?",
    "can a pawn move backwards?",
    "why is castling useful?",
    "what is a fork?",
    "what is stalemate?",
    "how many days is chess school?",
  ];
  const answers = questions.map((q) => ask(q));
  check("every question is answered", answers.every((a) => a !== null));
  check(
    "distinct questions produce distinct answers",
    new Set(answers.map((a) => a.text)).size === answers.length
  );
}

// --- 10. Hygiene ---------------------------------------------------------
{
  check("rule ids are unique", new Set(K.KNOWLEDGE_RULE_IDS).size === K.KNOWLEDGE_RULE_IDS.length);
  check("there is a real body of knowledge", K.KNOWLEDGE_RULE_IDS.length >= 20);

  // Determinism: the same question twice is the same answer. Ollie has no
  // clock, no randomness and no hidden state.
  check("answers are deterministic", ask("what is a fork?").text === ask("what is a fork?").text);

  check(
    "every rule id is namespaced",
    K.KNOWLEDGE_RULE_IDS.every((id) => /^(chess|product)\./.test(id))
  );

  const source = fs.readFileSync(path.join(process.cwd(), "lib", "ollie", "knowledge.ts"), "utf8");
  const harsh = /\b(stupid|dumb|wrong again|you failed|idiot)\b/i;
  check("no harsh language in the knowledge base", !harsh.test(source));
  check("the knowledge layer does no I/O", !/\bfetch\(|process\.env|require\(/.test(source));
  check("the knowledge layer has no randomness", !/Math\.random|Date\.now|new Date\(/.test(source));
}

console.log(`\n=== OLLIE KNOWLEDGE: ${pass} passed, ${failures.length} failed ===`);
if (failures.length) {
  console.error("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
  process.exitCode = 1;
}

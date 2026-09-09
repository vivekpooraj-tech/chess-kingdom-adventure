/**
 * Tests for lib/ollie/localFallback.ts — the reply Ollie gives when the real
 * model is unavailable.
 *
 *   node scripts/test-ollie-fallback-logic.js
 *
 * WHAT CHANGED HERE, AND WHY IT MATTERS.
 *
 * This file used to contain a hand-written plain-JS COPY of the matcher and
 * test that. The copy passed while the real module shipped a bug that made
 * Ollie answer "Owl hoot! I'm not sure about that one yet" to "which is the
 * powerful chess piece in the board" — a question it had the answer to. A test
 * that mirrors the code under test can only ever prove the mirror works.
 *
 * So this now imports the REAL module. No mirror, no re-implementation.
 *
 * lib/ollie/aiProvider.ts falls through to this path whenever the Anthropic
 * call returns null — missing key, non-OK response, or a thrown error, all
 * indistinguishable — so in a deployment without a key, this IS Ollie. It has
 * to be good, and it has to be honest about its limits.
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

const F = require(path.join(process.cwd(), "lib", "ollie", "localFallback.ts"));
const { localFallbackReply, FALLBACK_LADDER, isFallbackLine } = F;

let pass = 0;
const failures = [];
const check = (n, c) => (c ? pass++ : failures.push(n));

const buddy = (text) => ({ from: "buddy", text });
const child = (text) => ({ from: "child", text });

// --- 1. The regression, end to end --------------------------------------
{
  const reply = localFallbackReply("which is the powerful chess piece in the board", []);
  check("the reported question is NOT the not-sure reply", !isFallbackLine(reply));
  check("the reported question gets the queen answer", /queen/i.test(reply));
  check(
    "the old 'Owl hoot! I'm not sure about that one yet' string is gone",
    !/not sure about that one yet/i.test(reply)
  );

  // And it is gone from the module's CODE, not just from this one path. The
  // comments still quote the old string to explain what went wrong, which is
  // worth keeping — so strip comments before asserting, rather than asserting
  // something that would force the explanation out.
  const source = fs.readFileSync(path.join(process.cwd(), "lib", "ollie", "localFallback.ts"), "utf8");
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  check("no code path can still return the old dead-end reply", !/not sure about that one yet/.test(code));
  check("the ladder does not contain it either", FALLBACK_LADDER.every((l) => !/not sure about that one yet/.test(l)));
}

// --- 2. Real questions get real answers ---------------------------------
{
  const questions = [
    "What does a rook do?",
    "How does a knight move?",
    "What is a bishop?",
    "What is castling?",
    "What is checkmate?",
    "What is stalemate?",
    "How many points is a queen worth?",
    "Can a king capture a queen?",
    "What is a fork?",
    "Can a pawn move backwards?",
    "Who moves first?",
    "How many days is Chess School?",
  ];
  const answers = questions.map((q) => localFallbackReply(q, []));

  for (let i = 0; i < questions.length; i++) {
    check(`answered: "${questions[i]}"`, !isFallbackLine(answers[i]));
  }
  check("every answer is substantial", answers.every((a) => a.length > 40));
  check(
    "distinct questions produce distinct answers",
    new Set(answers).size === answers.length
  );
}

// --- 3. Context carries across turns ------------------------------------
{
  const afterRook = [child("What is a rook?"), buddy("The rook marches in straight lines.")];
  check(
    "'How does it move?' after rook still talks about the rook",
    /rook|straight lines/i.test(localFallbackReply("How does it move?", afterRook))
  );
  check(
    "naming a new piece switches topic",
    /queen/i.test(localFallbackReply("What about the queen?", afterRook))
  );
}

// --- 4. Never guess ------------------------------------------------------
{
  check(
    "nonsense gets an honest miss, not a canned piece answer",
    isFallbackLine(localFallbackReply("purple elephant banana", []))
  );
  check("empty input gets an honest miss", isFallbackLine(localFallbackReply("", [])));
  check(
    "an unrelated question gets an honest miss",
    isFallbackLine(localFallbackReply("what is the capital of France?", []))
  );

  // Every rung must actually admit it doesn't know — an "honest miss" that
  // reads like an answer is worse than the dead end it replaced.
  const admits = /don't know|outside my nest|not one I know/i;
  check("every rung admits ignorance", FALLBACK_LADDER.every((line) => admits.test(line)));
  check("no rung invents a chess fact", FALLBACK_LADDER.every((line) => !/is worth|always moves/i.test(line)));
}

// --- 5. The honest miss never repeats itself ----------------------------
{
  // Three unknown questions in a row: three different replies, each offering a
  // different way forward. The old behaviour repeated one sentence forever.
  const history = [];
  const said = [];
  for (let i = 0; i < 3; i++) {
    const q = `unknowable question number ${i} zzz`;
    const reply = localFallbackReply(q, history);
    said.push(reply);
    history.push(child(q), buddy(reply));
  }
  check("three misses give three replies", said.length === 3);
  check("the three misses are all different", new Set(said).size === 3);
  check("they follow the ladder in order", said.every((s, i) => s === FALLBACK_LADDER[i]));

  // Past the end of the ladder it settles rather than inventing more.
  const more = localFallbackReply("still unknowable zzz", history);
  check("beyond the ladder it settles on the last rung", more === FALLBACK_LADDER[FALLBACK_LADDER.length - 1]);
  check("the last rung points at a person", /teacher|grown-?up/i.test(more));

  // The ladder counts Ollie's OWN misses only. A child echoing the text back,
  // or a long chat with real answers in it, must not advance it.
  const notMisses = [
    child(FALLBACK_LADDER[0]),
    buddy("The rook marches in straight lines."),
    child("thanks!"),
  ];
  check(
    "only Ollie's own misses advance the ladder",
    localFallbackReply("unknowable zzz", notMisses) === FALLBACK_LADDER[0]
  );
}

// --- 6. Robustness -------------------------------------------------------
{
  const survives = (label, fn) => {
    let threw = false;
    try {
      fn();
    } catch {
      threw = true;
    }
    check(label, threw === false);
  };

  survives("missing history argument", () => localFallbackReply("what is a rook?"));
  survives("null history", () => localFallbackReply("what is a rook?", null));
  survives("malformed turns", () => localFallbackReply("how does it move?", [null, {}, { text: null }]));
  survives("very long input", () => localFallbackReply("rook ".repeat(5000), []));

  check("a reply is always a non-empty string", typeof localFallbackReply("", []) === "string");
  check("output never leaks internals", !/undefined|NaN|\[object/.test(localFallbackReply("zzz unknown", [])));
}

console.log(`\n=== OLLIE LOCAL FALLBACK: ${pass} passed, ${failures.length} failed ===`);
if (failures.length) {
  console.error("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
  process.exitCode = 1;
}

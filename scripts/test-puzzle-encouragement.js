/**
 * Tests for lib/puzzles/encouragement.ts.
 *
 *   node scripts/test-puzzle-encouragement.js
 *
 * Pure logic only — no database, no fixtures.
 *
 * The property that matters most here is negative: across EVERY reachable
 * combination of inputs, no string this module can produce may contain
 * discouraging language. A child who misses a puzzle five times must never be
 * told they were wrong, and a future copy edit must not be able to slip that
 * back in unnoticed — so the check below enumerates the input space rather
 * than spot-checking a few strings.
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

const E = require(path.join(process.cwd(), "lib", "puzzles", "encouragement.ts"));

let pass = 0;
const failures = [];
const check = (n, c) => (c ? pass++ : failures.push(n));

// --- 1. Nothing discouraging, anywhere in the input space ----------------
{
  const hints = [null, undefined, "", "   ", "Back-Rank Mate", "Fork", "Smothered Mate"];
  const all = [];

  for (const neutralTone of [true, false]) {
    for (let attempt = -3; attempt <= 12; attempt++) {
      for (const hint of hints) {
        all.push(E.encourageAfterMiss({ attempt, neutralTone, hint }));
      }
    }
    for (const firstTry of [true, false]) {
      for (const streak of [-1, 0, 1, 2, 3, 25]) {
        all.push(E.celebrateSolve({ firstTry, streak, neutralTone }));
      }
    }
    for (let remaining = -2; remaining <= 5; remaining++) {
      all.push(E.progressNudge(remaining, neutralTone));
    }
  }

  check(`enumerated the input space (${all.length} strings)`, all.length > 200);
  const harsh = all.filter((s) => E.DISCOURAGING_PATTERN.test(s));
  check("no produced string is discouraging", harsh.length === 0);
  if (harsh.length) failures.push(`  offending: ${JSON.stringify(harsh.slice(0, 5))}`);

  check("every string is non-empty", all.every((s) => typeof s === "string" && s.trim().length > 0));
  check("no string SHOUTS", all.every((s) => s !== s.toUpperCase() || s.length < 3));
  check("no exclamation pile-ups", all.every((s) => (s.match(/!/g) || []).length <= 1));
}

// --- 2. The miss ladder gets more helpful, never sterner ----------------
{
  const warm = (attempt, hint = "Back-Rank Mate") =>
    E.encourageAfterMiss({ attempt, neutralTone: false, hint });

  check("first miss acknowledges the try", /interesting/i.test(warm(1)));
  check("second miss suggests another idea", /almost|another idea/i.test(warm(2)));
  check("third miss names the stored theme", /back-rank/i.test(warm(3)));
  check("later misses keep naming the theme", /back-rank/i.test(warm(9)));

  check("the ladder actually changes across attempts",
    new Set([warm(1), warm(2), warm(3)]).size === 3);

  // Without a hint it must still be useful and must not invent a direction.
  const noHint = warm(3, null);
  check("no hint -> generic but useful guidance", /check/i.test(noHint));
  check("no hint -> does not fabricate a theme name", !/back-rank|fork|pin/i.test(noHint));

  // A blank/whitespace hint is treated as no hint, not interpolated raw.
  check("blank hint is treated as absent", warm(3, "   ") === noHint);
  check("empty hint is treated as absent", warm(3, "") === noHint);
}

// --- 3. Registers differ and both stay kind ------------------------------
{
  const warm = E.encourageAfterMiss({ attempt: 1, neutralTone: false, hint: "Fork" });
  const neutral = E.encourageAfterMiss({ attempt: 1, neutralTone: true, hint: "Fork" });
  check("child and adult miss copy differ", warm !== neutral);
  check("adult copy is not childish", !/!/.test(neutral));
  check("child copy is warm", /interesting|almost|keep going/i.test(warm));

  const warmSolve = E.celebrateSolve({ firstTry: true, streak: 0, neutralTone: false });
  const neutralSolve = E.celebrateSolve({ firstTry: true, streak: 0, neutralTone: true });
  check("child and adult solve copy differ", warmSolve !== neutralSolve);
}

// --- 4. Solving after several misses is still celebrated -----------------
{
  const late = E.celebrateSolve({ firstTry: false, streak: 0, neutralTone: false });
  check("a late solve is still positive", /got it|nice/i.test(late));
  check("a late solve is not diminished", !E.DISCOURAGING_PATTERN.test(late));
  check("a late solve does not mention the misses", !/attempt|tries|try\b/i.test(late));

  const firstTry = E.celebrateSolve({ firstTry: true, streak: 0, neutralTone: false });
  check("first-try solve differs from late solve", firstTry !== late);

  const streaked = E.celebrateSolve({ firstTry: true, streak: 4, neutralTone: false });
  check("a streak is named when earned", /4 in a row/.test(streaked));
  const noStreak = E.celebrateSolve({ firstTry: true, streak: 1, neutralTone: false });
  check("a streak of 1 is not announced", !/in a row/.test(noStreak));
  check("a streak is never claimed after a miss",
    !/in a row/.test(E.celebrateSolve({ firstTry: false, streak: 9, neutralTone: false })));
}

// --- 5. Determinism ------------------------------------------------------
{
  const a = E.encourageAfterMiss({ attempt: 2, neutralTone: false, hint: "Pin" });
  const b = E.encourageAfterMiss({ attempt: 2, neutralTone: false, hint: "Pin" });
  check("miss copy is deterministic", a === b);

  const c = E.celebrateSolve({ firstTry: true, streak: 3, neutralTone: true });
  const d = E.celebrateSolve({ firstTry: true, streak: 3, neutralTone: true });
  check("solve copy is deterministic", c === d);

  const runs = new Set();
  for (let i = 0; i < 30; i++) runs.add(E.encourageAfterMiss({ attempt: 5, neutralTone: false, hint: "Fork" }));
  check("30 identical calls give one result", runs.size === 1);
}

// --- 6. Degenerate inputs ------------------------------------------------
{
  check("attempt 0 behaves as the first miss",
    E.encourageAfterMiss({ attempt: 0, neutralTone: false, hint: null }) ===
      E.encourageAfterMiss({ attempt: 1, neutralTone: false, hint: null }));
  check("negative attempt behaves as the first miss",
    E.encourageAfterMiss({ attempt: -7, neutralTone: false, hint: null }) ===
      E.encourageAfterMiss({ attempt: 1, neutralTone: false, hint: null }));
  check("NaN attempt does not crash or leak NaN",
    !/NaN/.test(E.encourageAfterMiss({ attempt: NaN, neutralTone: false, hint: null })));
  check("fractional attempt floors",
    E.encourageAfterMiss({ attempt: 2.9, neutralTone: false, hint: "Fork" }) ===
      E.encourageAfterMiss({ attempt: 2, neutralTone: false, hint: "Fork" }));

  check("NaN streak does not leak",
    !/NaN/.test(E.celebrateSolve({ firstTry: true, streak: NaN, neutralTone: false })));
  check("negative streak does not leak",
    !/-1/.test(E.celebrateSolve({ firstTry: true, streak: -1, neutralTone: false })));

  check("progressNudge floors to at least one move",
    E.progressNudge(0, true) === E.progressNudge(1, true));
  check("progressNudge singular vs plural differ", E.progressNudge(1, false) !== E.progressNudge(3, false));
  check("progressNudge names the count", /3/.test(E.progressNudge(3, false)));
}

// --- 7. No fabricated analysis ------------------------------------------
{
  // The module must never imply it knows WHY a move works — there is no
  // engine behind it. Nothing it emits may read as an explanation.
  const claims = /because|the reason|this works|the point is|analysis says|engine|best move is/i;
  const all = [];
  for (const neutralTone of [true, false]) {
    for (let a = 1; a <= 6; a++) {
      all.push(E.encourageAfterMiss({ attempt: a, neutralTone, hint: "Back-Rank Mate" }));
      all.push(E.encourageAfterMiss({ attempt: a, neutralTone, hint: null }));
    }
    all.push(E.celebrateSolve({ firstTry: true, streak: 2, neutralTone }));
    all.push(E.celebrateSolve({ firstTry: false, streak: 0, neutralTone }));
  }
  check("never claims to explain why a move works", all.every((s) => !claims.test(s)));

  // The only domain noun it may introduce is the hint it was handed.
  const withFork = E.encourageAfterMiss({ attempt: 4, neutralTone: false, hint: "Fork" });
  check("only the supplied hint is named", /fork/i.test(withFork) && !/pin|skewer|back-rank/i.test(withFork));
}

// --- 8. Both puzzle surfaces actually use the module ---------------------
{
  const mate = fs.readFileSync(path.join(process.cwd(), "app", "(tabs)", "puzzles", "page.tsx"), "utf8");
  const tactics = fs.readFileSync(
    path.join(process.cwd(), "components", "puzzles", "TacticsTrainer.tsx"),
    "utf8"
  );

  check("mate trainer imports the module", /from "@\/lib\/puzzles\/encouragement"/.test(mate));
  check("tactics trainer imports the module", /from "@\/lib\/puzzles\/encouragement"/.test(tactics));
  check("mate trainer uses encourageAfterMiss", /encourageAfterMiss\(/.test(mate));
  check("tactics trainer uses encourageAfterMiss", /encourageAfterMiss\(/.test(tactics));
  check("mate trainer uses celebrateSolve", /celebrateSolve\(/.test(mate));
  check("tactics trainer uses celebrateSolve", /celebrateSolve\(/.test(tactics));

  // The old hard-coded strings must be gone from both surfaces.
  check("mate trainer no longer hard-codes its miss line", !/isn&apos;t mate\. Take another look/.test(mate));
  check("tactics trainer no longer hard-codes its miss line",
    !/Not the move this position needs/.test(tactics));

  // Tone must be derived, not assumed.
  check("mate trainer derives tone", /prefersNeutralHomeTone\(/.test(mate));
  check("tactics trainer derives tone", /prefersNeutralHomeTone\(/.test(tactics));
}

console.log(`\n=== PUZZLE ENCOURAGEMENT: ${pass} passed, ${failures.length} failed ===`);
if (failures.length) {
  console.error("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
  process.exitCode = 1;
}

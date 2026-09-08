/**
 * Tests for lib/auth/postAuthDestination.ts and the parent-gate wiring.
 *
 *   node scripts/test-post-auth-destination.js
 *
 * Pure logic only — the child resolution is a parameter, so every routing rule
 * is exercised without a database.
 *
 * The bug being locked down: every sign-in path lands on /parent-gate, and the
 * gate rendered its arithmetic challenge BEFORE working out where the user
 * belonged. A parent who finished setup long ago had to solve "6 + 4 = ?" on
 * every single sign-in, forever, because the gate stores nothing. The rule
 * asserted here is that the challenge is required ONLY when an /onboarding/*
 * screen lies ahead.
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

const D = require(path.join(process.cwd(), "lib", "auth", "postAuthDestination.ts"));

let pass = 0;
const failures = [];
const check = (n, c) => (c ? pass++ : failures.push(n));

const child = (over = {}) => ({
  experience_level: "knows_basics",
  avatar_id: "avatar-1",
  buddy_id: "buddy-1",
  ...over,
});
const res = (c, needsSelection = false) => ({ needsSelection, child: c });

// --- 1. The reported bug: a returning, fully set-up user ------------------
{
  const d = D.postAuthDestination(res(child()));
  check("onboarded user goes to the dashboard", d.href === "/kingdom-map");
  check("onboarded user is NOT gated", d.requiresParentGate === false);
  check("isOnboardingComplete agrees", D.isOnboardingComplete(res(child())) === true);
}

// --- 2. Genuine onboarding still gets the gate ----------------------------
{
  const noExp = D.postAuthDestination(res(child({ experience_level: null })));
  check("missing experience level -> experience onboarding", noExp.href === "/onboarding/experience");
  check("missing experience level IS gated", noExp.requiresParentGate === true);

  const noAvatar = D.postAuthDestination(res(child({ avatar_id: null })));
  check("missing avatar -> avatar onboarding", noAvatar.href === "/onboarding/avatar");
  check("missing avatar IS gated", noAvatar.requiresParentGate === true);

  const noBuddy = D.postAuthDestination(res(child({ buddy_id: null })));
  check("missing buddy -> avatar onboarding", noBuddy.href === "/onboarding/avatar");
  check("missing buddy IS gated", noBuddy.requiresParentGate === true);

  const brandNew = D.postAuthDestination(
    res(child({ experience_level: null, avatar_id: null, buddy_id: null }))
  );
  check("a brand-new child starts at experience", brandNew.href === "/onboarding/experience");
  check("a brand-new child IS gated", brandNew.requiresParentGate === true);
}

// --- 3. Only /onboarding/* is ever gated ----------------------------------
{
  const cases = [
    res(child()),
    res(child({ experience_level: null })),
    res(child({ avatar_id: null })),
    res(child({ buddy_id: null })),
    res(null, true),
    res(null, false),
    res(child(), true),
  ];
  for (const r of cases) {
    const d = D.postAuthDestination(r);
    check(
      `gated iff onboarding (${d.href})`,
      d.requiresParentGate === d.href.startsWith("/onboarding/")
    );
  }
}

// --- 4. Multiple children / selection -------------------------------------
{
  const d = D.postAuthDestination(res(child(), true));
  check("needsSelection -> choose-child", d.href === "/choose-child");
  check("choose-child is NOT gated", d.requiresParentGate === false);
  check(
    "needsSelection wins over an incomplete child",
    D.postAuthDestination(res(child({ avatar_id: null }), true)).href === "/choose-child"
  );
}

// --- 5. Safe fallback when the profile is temporarily missing -------------
{
  const d = D.postAuthDestination(res(null));
  check("null child -> choose-child, not the dashboard", d.href === "/choose-child");
  check("null child is not gated", d.requiresParentGate === false);
  check("null child never lands on onboarding", !d.href.startsWith("/onboarding/"));
  // Sending them to the dashboard with no profile would strand them; re-running
  // onboarding would repeat setup they may already have done.
  check("null child is not sent to the dashboard", d.href !== "/kingdom-map");
}

// --- 6. Degenerate field values -------------------------------------------
{
  const empties = ["", null, undefined];
  for (const v of empties) {
    check(
      `empty experience_level (${JSON.stringify(v)}) -> onboarding`,
      D.postAuthDestination(res(child({ experience_level: v }))).href === "/onboarding/experience"
    );
    check(
      `empty avatar_id (${JSON.stringify(v)}) -> onboarding`,
      D.postAuthDestination(res(child({ avatar_id: v }))).href === "/onboarding/avatar"
    );
  }
}

// --- 7. Determinism / no loops --------------------------------------------
{
  const r = res(child());
  const a = JSON.stringify(D.postAuthDestination(r));
  const b = JSON.stringify(D.postAuthDestination(r));
  check("destination is deterministic", a === b);

  // Every destination must be a real route, and never the gate itself —
  // routing back to /parent-gate is precisely the loop being removed.
  const all = [
    res(child()),
    res(child({ experience_level: null })),
    res(child({ avatar_id: null })),
    res(null, true),
    res(null),
  ].map((x) => D.postAuthDestination(x).href);
  check("no destination is /parent-gate", all.every((h) => h !== "/parent-gate"));
  check("no destination is /sign-in", all.every((h) => h !== "/sign-in"));
  check("every destination is an absolute path", all.every((h) => h.startsWith("/")));
}

// --- 8. Agreement with the dashboard's own guards -------------------------
{
  // app/(tabs)/kingdom-map/page.tsx re-checks the same conditions server-side.
  // If the two disagree, a user is redirected back and forth forever, so the
  // ORDER and the thresholds have to match.
  const km = fs.readFileSync(
    path.join(process.cwd(), "app", "(tabs)", "kingdom-map", "page.tsx"),
    "utf8"
  );
  const order = [];
  if (/needsSelection\)\s*redirect\("\/choose-child"\)/.test(km)) order.push("choose-child");
  if (/!child\.experience_level\)\s*redirect\("\/onboarding\/experience"\)/.test(km))
    order.push("experience");
  if (/!child\.avatar_id \|\| !child\.buddy_id\)\s*redirect\("\/onboarding\/avatar"\)/.test(km))
    order.push("avatar");
  check(
    "kingdom-map guards are in the same order as postAuthDestination",
    JSON.stringify(order) === JSON.stringify(["choose-child", "experience", "avatar"])
  );

  // Each of those states must route to the SAME place from both sides.
  check(
    "choose-child agrees",
    D.postAuthDestination(res(child(), true)).href === "/choose-child"
  );
  check(
    "experience agrees",
    D.postAuthDestination(res(child({ experience_level: null }))).href === "/onboarding/experience"
  );
  check(
    "avatar agrees",
    D.postAuthDestination(res(child({ buddy_id: null }))).href === "/onboarding/avatar"
  );
}

// --- 9. The parent-gate page actually uses this ---------------------------
{
  const gate = fs.readFileSync(
    path.join(process.cwd(), "app", "parent-gate", "page.tsx"),
    "utf8"
  );

  check("gate imports the shared rule", /postAuthDestination/.test(gate));
  check("gate has a pre-challenge decide phase", /"deciding"/.test(gate));
  check(
    "an explicit next starts at the challenge",
    /next \? "challenge" : "deciding"/.test(gate)
  );
  check("gate no longer hard-codes its own routing ladder",
    !/child\.experience_level\)\s*\{?\s*router\.push\("\/onboarding\/experience"\)/.test(gate));
  check("the deciding phase renders no challenge", /phase === "deciding"/.test(gate));
  check("the challenge markup still exists for onboarding", /One quick check for a grown-up/.test(gate));

  // Failure paths must leave a way out rather than a permanent spinner.
  const decidingFallbacks = (gate.match(/setPhase\("challenge"\)/g) || []).length;
  check("failures fall back to a retryable challenge", decidingFallbacks >= 2);
  check("network errors still do not sign the user out", /network-error/.test(gate));
  check("unauthenticated still goes to sign-in", /router\.push\("\/sign-in"\)/.test(gate));

  // The /parent-dashboard use must be untouched: an explicit next always asks.
  check("an explicit next still routes onward after the challenge", /if \(next\) \{/.test(gate));
}

console.log(`\n=== POST-AUTH DESTINATION: ${pass} passed, ${failures.length} failed ===`);
if (failures.length) {
  console.error("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
  process.exitCode = 1;
}

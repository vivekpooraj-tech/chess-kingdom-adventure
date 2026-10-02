/**
 * Tests for lib/entitlement/* and content/ollie/voice.ts — the Phase 1
 * deliverables of CHESS_MIND_IMPLEMENTATION_PLAN.md.
 *
 *   node scripts/test-entitlement.js
 *
 * Pure logic only — no database. The property that matters most: this
 * layer must never disagree with the two systems it composes
 * (resolvePremiumState, resolveSchoolAccess), since it re-derives nothing
 * and is explicitly forbidden from becoming a second source of truth.
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

const E = require(path.join(process.cwd(), "lib", "entitlement", "index.ts"));
const DL = require(path.join(process.cwd(), "lib", "entitlement", "dailyLimits.ts"));
const Premium = require(path.join(process.cwd(), "lib", "premium", "entitlement.ts"));
const School = require(path.join(process.cwd(), "lib", "school", "v2", "access.ts"));
const Voice = require(path.join(process.cwd(), "content", "ollie", "voice.ts"));
const Capabilities = require(path.join(process.cwd(), "lib", "premium", "capabilities.ts"));

let pass = 0;
const failures = [];
const check = (n, c) => (c ? pass++ : failures.push(n));

// --- 1. resolveCapabilities never disagrees with the systems it composes -
{
  const freeParent = { premium_status: "free", premium_expires_at: null };
  const premiumParent = { premium_status: "premium", premium_expires_at: null };
  const expiredParent = {
    premium_status: "premium",
    premium_expires_at: new Date(Date.now() - 86_400_000).toISOString(),
  };
  const schoolRow = { expires_at: null, revoked_at: null };
  const revokedSchoolRow = { expires_at: null, revoked_at: new Date().toISOString() };

  for (const [label, parentRow, schoolRowArg] of [
    ["free/no school", freeParent, null],
    ["free/with school", freeParent, schoolRow],
    ["free/revoked school", freeParent, revokedSchoolRow],
    ["premium/no school", premiumParent, null],
    ["premium/with school", premiumParent, schoolRow],
    ["expired premium/no school", expiredParent, null],
    ["expired premium/with school", expiredParent, schoolRow],
  ]) {
    const caps = E.resolveCapabilities(parentRow, schoolRowArg);
    const expectedPremium = Premium.resolvePremiumState(parentRow).isPremium;
    const expectedSchool = School.resolveSchoolAccess(parentRow, schoolRowArg);
    check(`${label}: isPremium matches resolvePremiumState`, caps.isPremium === expectedPremium);
    check(
      `${label}: chessSchool.hasFullAccess matches resolveSchoolAccess`,
      caps.chessSchool.hasFullAccess === expectedSchool.hasFullAccess
    );
    check(`${label}: chessSchool.source matches resolveSchoolAccess`, caps.chessSchool.source === expectedSchool.source);
  }
}

// --- 2. Tier derivation is exactly free < school < premium, never other ---
{
  const free = E.resolveCapabilities({ premium_status: "free" }, null);
  const school = E.resolveCapabilities({ premium_status: "free" }, { expires_at: null, revoked_at: null });
  const premium = E.resolveCapabilities({ premium_status: "premium", premium_expires_at: null }, null);
  const premiumWithSchoolToo = E.resolveCapabilities(
    { premium_status: "premium", premium_expires_at: null },
    { expires_at: null, revoked_at: null }
  );
  check("no entitlement -> tier free", free.tier === "free");
  check("school purchase only -> tier school", school.tier === "school");
  check("premium only -> tier premium", premium.tier === "premium");
  check("premium takes priority over school when both present -> tier premium", premiumWithSchoolToo.tier === "premium");
}

// --- 3. Puzzle/Train Your Mind daily limits: free gets the registry value,
// premium is always unlimited, Chess School alone does NOT lift them -----
{
  const free = E.resolveCapabilities({ premium_status: "free" }, null);
  const school = E.resolveCapabilities({ premium_status: "free" }, { expires_at: null, revoked_at: null });
  const premium = E.resolveCapabilities({ premium_status: "premium", premium_expires_at: null }, null);

  check("free puzzles limit is the registry value", free.puzzles.dailyLimit === DL.DAILY_LIMITS.puzzles);
  check(
    "school-only account still has the free puzzles limit (School and Premium are independent)",
    school.puzzles.dailyLimit === DL.DAILY_LIMITS.puzzles
  );
  check("premium puzzles limit is unlimited (null)", premium.puzzles.dailyLimit === null);

  check(
    "free trainYourMind limit is the registry value",
    free.trainYourMind.dailyLimitPerCategory === DL.DAILY_LIMITS.trainYourMindPerCategory
  );
  check(
    "school-only account still has the free trainYourMind limit",
    school.trainYourMind.dailyLimitPerCategory === DL.DAILY_LIMITS.trainYourMindPerCategory
  );
  check("premium trainYourMind limit is unlimited (null)", premium.trainYourMind.dailyLimitPerCategory === null);
}

// --- 3b. ONE source of truth for the puzzle limit: lib/entitlement must
// consume lib/premium/capabilities.ts's FREE_LIMITS, never redefine it. This
// is the exact regression this check exists to catch: if a future edit
// hardcodes DAILY_LIMITS.puzzles back to a bare number, this fails even
// though the value might still happen to match today. ---------------------
{
  check(
    "DAILY_LIMITS.puzzles === FREE_LIMITS.trainerPuzzlesPerDay (single source of truth, not a second copy)",
    DL.DAILY_LIMITS.puzzles === Capabilities.FREE_LIMITS.trainerPuzzlesPerDay
  );
  // A value-equality check alone would still pass if someone quietly
  // reintroduced a hardcoded `puzzles: 3` that merely happens to match
  // today — this reads the actual source to confirm the value is DERIVED
  // from capabilities.ts, not coincidentally equal to it.
  const dailyLimitsSrc = fs.readFileSync(
    path.join(process.cwd(), "lib", "entitlement", "dailyLimits.ts"),
    "utf8"
  );
  check(
    "dailyLimits.ts's puzzles field is a reference to FREE_LIMITS.trainerPuzzlesPerDay, not a numeric literal",
    /puzzles:\s*FREE_LIMITS\.trainerPuzzlesPerDay/.test(dailyLimitsSrc)
  );
  check(
    "dailyLimits.ts imports FREE_LIMITS from lib/premium/capabilities, the existing source",
    /import\s*\{\s*FREE_LIMITS\s*\}\s*from\s*["']@\/lib\/premium\/capabilities["']/.test(dailyLimitsSrc)
  );
}

// --- 4. dailyLimits boundary behaviour, exhaustively at every real edge --
{
  const limit = 3;
  check("0 used, limit 3: not reached", DL.isDailyLimitReached(0, limit) === false);
  check("2 used, limit 3: not reached", DL.isDailyLimitReached(2, limit) === false);
  check("3 used, limit 3: reached", DL.isDailyLimitReached(3, limit) === true);
  check("4 used, limit 3 (over, defensively): reached", DL.isDailyLimitReached(4, limit) === true);
  check("any used, null limit (premium): never reached", DL.isDailyLimitReached(999, null) === false);

  check("remainingToday(0,3) === 3", DL.remainingToday(0, limit) === 3);
  check("remainingToday(2,3) === 1", DL.remainingToday(2, limit) === 1);
  check("remainingToday(3,3) === 0", DL.remainingToday(3, limit) === 0);
  check("remainingToday(5,3) floors at 0, never negative", DL.remainingToday(5, limit) === 0);
  check("remainingToday(anything, null) === null (unlimited)", DL.remainingToday(7, null) === null);

  check("dailyLimitFor returns the registry value for free", DL.dailyLimitFor("puzzles", false) === DL.DAILY_LIMITS.puzzles);
  check("dailyLimitFor returns null for premium regardless of key", DL.dailyLimitFor("puzzles", true) === null);
}

// --- 5. Ollie voice spec: complete, distinct, and self-consistent --------
{
  const contexts = ["school", "world", "trainYourMind"];
  for (const ctx of contexts) {
    const v = Voice.OLLIE_VOICE[ctx];
    check(`${ctx} has a role`, typeof v.role === "string" && v.role.length > 0);
    check(`${ctx} has a register`, typeof v.register === "string" && v.register.length > 0);
    check(`${ctx} has a job`, typeof v.job === "string" && v.job.length > 0);
    check(`${ctx} has an example line`, typeof v.example === "string" && v.example.length > 0);
    check(`${ctx} declares a delivery mechanism`, v.delivery === "scripted" || v.delivery === "ai-chat");
    check(`${ctx}'s own example does not violate the voice`, !Voice.violatesOllieVoice(v.example));
  }
  check(
    "the three roles are distinct (Teacher/Guide/Coach, not reused)",
    new Set(contexts.map((c) => Voice.OLLIE_VOICE[c].role)).size === 3
  );
  check("School stays scripted (explicit design guarantee, unchanged)", Voice.OLLIE_VOICE.school.delivery === "scripted");
  check("World stays ai-chat (unchanged)", Voice.OLLIE_VOICE.world.delivery === "ai-chat");
  check("core identity names Ollie", Voice.OLLIE_IDENTITY.name === "Ollie");
  check("core traits is a non-empty list", Voice.OLLIE_IDENTITY.coreTraits.length > 0);
}

// --- 6. violatesOllieVoice actually catches the disallowed language ------
{
  check('"You failed this puzzle" is flagged', Voice.violatesOllieVoice("You failed this puzzle."));
  check('"That\'s wrong, try again" is flagged', Voice.violatesOllieVoice("That's wrong, try again."));
  check('a warm retry line is NOT flagged', !Voice.violatesOllieVoice("Let's try another idea!"));
  check('a celebration line is NOT flagged', !Voice.violatesOllieVoice("Great thinking — you spotted it!"));
}

console.log(`\n=== ENTITLEMENT LAYER + OLLIE VOICE: ${pass} passed, ${failures.length} failed ===`);
if (failures.length) {
  for (const f of failures) console.log("FAIL:", f);
  process.exit(1);
}

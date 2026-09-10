/**
 * Tests for Parent Lock / Chess Time — lib/parentLock/*
 *
 *   node scripts/test-parent-lock.js
 */
const fs = require("fs");
const path = require("path");
const { webcrypto } = require("crypto");
globalThis.crypto = webcrypto;

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

const types = require(path.join(process.cwd(), "lib", "parentLock", "types.ts"));
const chessTime = require(path.join(process.cwd(), "lib", "parentLock", "chessTime.ts"));
const parentPin = require(path.join(process.cwd(), "lib", "parentLock", "parentPin.ts"));
const parentPinCrypto = require(path.join(process.cwd(), "lib", "parentLock", "parentPinCrypto.ts"));
const activities = require(path.join(process.cwd(), "lib", "parentLock", "activities.ts"));
const routeGuard = require(path.join(process.cwd(), "lib", "parentLock", "routeGuard.ts"));
const platform = require(path.join(process.cwd(), "lib", "parentLock", "platformCapabilities.ts"));
const navFilter = require(path.join(process.cwd(), "lib", "parentLock", "navFilter.ts"));
const sessionLock = require(path.join(process.cwd(), "lib", "parentLock", "sessionLock.ts"));

let pass = 0;
const failures = [];
const check = (n, c) => (c ? pass++ : failures.push(n));

async function run() {
  // --- types exist ---
  check("ChessTimeActivityId type module loads", !!types.DEFAULT_CHESS_TIME_ACTIVITIES);
  check("duration presets exist", types.CHESS_TIME_DURATION_PRESETS.length >= 5);

  // --- session start / duration ---
  {
    const t0 = 1_000_000;
    const session = chessTime.createChessTimeSession({
      durationMinutes: 45,
      allowedActivities: ["puzzles", "play"],
      nowMs: t0,
    });
    check("session starts active", session.active === true);
    check("duration clamped to 45", session.durationMinutes === 45);
    check("endsAt correct", chessTime.getEndsAtMs(session) === t0 + 45 * 60_000);
  }

  // --- timer from timestamps ---
  {
    const t0 = 0;
    const session = chessTime.createChessTimeSession({
      durationMinutes: 10,
      allowedActivities: ["puzzles"],
      nowMs: t0,
    });
    const mid = chessTime.getChessTimeRemaining(session, 5 * 60_000);
    check("half time remaining", mid.remainingMs === 5 * 60_000);
    check("not expired mid-session", mid.expired === false);
    const end = chessTime.getChessTimeRemaining(session, 10 * 60_000);
    check("expired at end", end.expired === true);
    check("format mm:ss", chessTime.formatChessTimeRemaining(125) === "2:05");
  }

  // --- allowed activities ---
  {
    check("puzzles route allowed", activities.isActivityAllowed("/puzzles", ["puzzles"]));
    check("play route allowed", activities.isActivityAllowed("/free-play", ["play"]));
    check("more blocked without activity", !activities.isActivityAllowed("/more", ["puzzles"]));
    check("chess-time always allowed", activities.isActivityAllowed("/chess-time", []));
    check("sign-in always allowed", activities.isActivityAllowed("/sign-in", []));
  }

  // --- legacy PIN (migration path) ---
  {
    const legacy = parentPin.hashLegacyParentPin("1234");
    check("legacy hash prefix", parentPin.isLegacyParentPinHash(legacy));
    check("legacy verifies", parentPin.verifyLegacyParentPin("1234", legacy));
    check("legacy rejects wrong pin", !parentPin.verifyLegacyParentPin("9999", legacy));
    check("modern hash not legacy", !parentPin.isLegacyParentPinHash("pbkdf2-v1$120000$abc$def"));
  }

  // --- Web Crypto PIN ---
  {
    const hash = await parentPinCrypto.hashParentPin("5678");
    check("modern hash scheme", parentPinCrypto.isModernParentPinHash(hash));
    check("modern verifies", (await parentPinCrypto.verifyParentPin("5678", hash)).ok);
    check("modern rejects wrong", !(await parentPinCrypto.verifyParentPin("0000", hash)).ok);
    check("reject short pin format", !parentPin.validatePinFormat("123"));
    let hashShortRejected = false;
    try {
      await parentPinCrypto.hashParentPin("123");
    } catch {
      hashShortRejected = true;
    }
    check("hash rejects short pin", hashShortRejected);
    const legacy = parentPin.hashLegacyParentPin("4321");
    const migrated = await parentPinCrypto.verifyParentPin("4321", legacy);
    check("legacy migrates on verify", migrated.ok && !!migrated.upgradedHash);
    check(
      "upgraded hash is modern",
      parentPinCrypto.isModernParentPinHash(migrated.upgradedHash)
    );
    check(
      "upgraded verifies",
      (await parentPinCrypto.verifyParentPin("4321", migrated.upgradedHash)).ok
    );
  }

  // --- rate limiting ---
  {
    let attempts = { failures: 0, lockedUntil: null };
    for (let i = 0; i < 5; i++) attempts = parentPin.recordPinFailure(attempts, 1000);
    check("lockout after 5 fails", parentPin.isPinLockedOut(attempts, 1000));
  }

  // --- expired session route guard ---
  {
    const session = chessTime.createChessTimeSession({
      durationMinutes: 30,
      allowedActivities: ["puzzles"],
      nowMs: Date.now() - 31 * 60_000,
    });
    check(
      "expired blocks /puzzles",
      routeGuard.shouldRedirectToChessTimeHub({ pathname: "/puzzles", session })
    );
    check(
      "expired allows /chess-time hub",
      !routeGuard.shouldRedirectToChessTimeHub({ pathname: "/chess-time", session })
    );
    check(
      "expired still blocks /more",
      routeGuard.shouldRedirectToChessTimeHub({ pathname: "/more", session })
    );
  }

  // --- active session route guard ---
  {
    const session = chessTime.createChessTimeSession({
      durationMinutes: 30,
      allowedActivities: ["puzzles"],
      nowMs: Date.now(),
    });
    check("redirect disallowed /more", routeGuard.shouldRedirectToChessTimeHub({ pathname: "/more", session }));
    check("allow /puzzles", !routeGuard.shouldRedirectToChessTimeHub({ pathname: "/puzzles", session }));
    check(
      "allow parent dashboard",
      !routeGuard.shouldRedirectToChessTimeHub({ pathname: "/parent-dashboard", session })
    );
  }

  // --- expired navigation state ---
  {
    const active = chessTime.createChessTimeSession({
      durationMinutes: 10,
      allowedActivities: ["puzzles", "play"],
      nowMs: Date.now(),
    });
    const expired = chessTime.createChessTimeSession({
      durationMinutes: 10,
      allowedActivities: ["puzzles", "play"],
      nowMs: Date.now() - 11 * 60_000,
    });
    check("active is locked", sessionLock.isChessTimeLocked(active));
    check("expired is still locked", sessionLock.isChessTimeLocked(expired));
    check(
      "hide nav when expired locked",
      sessionLock.shouldHideAppNavDuringLock(expired, true)
    );
    check(
      "show filtered nav when active",
      !sessionLock.shouldHideAppNavDuringLock(active, false)
    );
    check("nav activities null when expired", sessionLock.chessTimeNavActivities(expired, true) === null);
    check(
      "nav activities set when active",
      sessionLock.chessTimeNavActivities(active, false)?.includes("puzzles")
    );
    const mockItems = [
      { label: "Home", href: "/kingdom-map" },
      { label: "Puzzles", href: "/puzzles" },
      { label: "More", href: "/more" },
    ];
    const filteredActive = navFilter.filterNavItemsForChessTime(mockItems, ["puzzles"]);
    check("active filter keeps puzzles", filteredActive.some((i) => i.href === "/puzzles"));
    const filteredExpired = navFilter.filterNavItemsForChessTime(
      mockItems,
      sessionLock.chessTimeNavActivities(expired, true)
    );
    check("expired nav filter returns full list when null activities", filteredExpired.length === 3);
    check(
      "expired hide flag overrides showing tabs",
      sessionLock.shouldHideAppNavDuringLock(expired, true)
    );
  }

  // --- no redirect loop on hub ---
  {
    const expired = chessTime.createChessTimeSession({
      durationMinutes: 5,
      allowedActivities: ["puzzles"],
      nowMs: Date.now() - 6 * 60_000,
    });
    check(
      "expired hub stable",
      !routeGuard.shouldRedirectToChessTimeHub({ pathname: "/chess-time", session: expired })
    );
  }

  // --- platform honesty ---
  {
    const caps = platform.buildParentLockCapabilities({ platform: "android" });
    check("android guidance true", caps.supportsScreenPinningGuidance === true);
    check("no fake kiosk", caps.supportsTrueKioskMode === false);
    const ios = platform.buildParentLockCapabilities({ platform: "ios" });
    check("ios no android pinning", ios.supportsScreenPinningGuidance === false);
  }

  // --- nav filter active lock ---
  {
    const mockItems = [
      { label: "Home", href: "/kingdom-map" },
      { label: "Puzzles", href: "/puzzles" },
      { label: "Play", href: "/play" },
      { label: "Learn", href: "/learn" },
      { label: "More", href: "/more" },
    ];
    const filtered = navFilter.filterNavItemsForChessTime(mockItems, ["puzzles"]);
    check("hides more during chess time", !filtered.some((i) => i.href === "/more"));
    check("keeps puzzles tab", filtered.some((i) => i.href === "/puzzles"));
  }

  // --- Chess School V2 files untouched ---
  {
    const protectedPaths = [
      "content/school",
      "lib/school/v2",
      "components/school/v2",
      "supabase/migrations/0043_chess_school_v2.sql",
    ];
    for (const p of protectedPaths) {
      check(`protected path still present: ${p}`, fs.existsSync(path.join(process.cwd(), p)));
    }
  }

  // --- parent dashboard navigation ---
  {
    const dashPath = path.join(process.cwd(), "app", "parent-dashboard", "page.tsx");
    const dash = fs.readFileSync(dashPath, "utf8");
    check(
      "dashboard links Parent Lock via parent gate",
      dash.includes('href="/parent-gate?next=/parent-dashboard/parent-lock"')
    );
    check("dashboard shows Parent Lock label", dash.includes("Parent Lock"));
    check("dashboard shows Chess Time subtitle", /Chess Time/.test(dash));
    check(
      "dashboard Parent Controls above progress sections",
      dash.indexOf("Parent Controls") !== -1 &&
        dash.indexOf("Parent Controls") < dash.indexOf("Learning Progress")
    );
    check(
      "parent-lock setup page exists",
      fs.existsSync(path.join(process.cwd(), "app", "parent-dashboard", "parent-lock", "page.tsx"))
    );
  }

  console.log(`\n=== PARENT LOCK: ${pass} passed, ${failures.length} failed ===`);
  if (failures.length) {
    failures.forEach((f) => console.log("  FAIL:", f));
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

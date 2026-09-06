/**
 * Tests for lib/screenTime/session.ts.
 *
 *   node scripts/test-screen-time.js
 *
 * Pure logic only — no database, so this creates no fixtures and cannot leak
 * anything. The browser wiring (visibility listeners, localStorage, the
 * interval) is verified by hand against the running app; what is tested here is
 * every rule that decides how much time a child is charged.
 *
 * The bugs these lock down were all real:
 *   - partial minutes discarded at every navigation, so moving between screens
 *     every 30 seconds accrued nothing at all
 *   - a limit of 0 treated as "unlimited" rather than "no time today"
 *   - yesterday's remainder charged to today after midnight
 *   - three open tabs billing three minutes a minute
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

const S = require(path.join(process.cwd(), "lib", "screenTime", "session.ts"));

let pass = 0;
const failures = [];
const check = (n, c) => (c ? pass++ : failures.push(n));

// A fixed Monday and Saturday in local time.
const MON = new Date(2026, 8, 7, 10, 0, 0);
const SAT = new Date(2026, 8, 5, 10, 0, 0);
const SUN = new Date(2026, 8, 6, 10, 0, 0);

// ---- weekday / weekend selection ----
{
  const limits = { weekdayMinutes: 60, weekendMinutes: 120 };
  check("Monday is a weekday", S.isWeekend(MON) === false);
  check("Saturday is a weekend", S.isWeekend(SAT) === true);
  check("Sunday is a weekend", S.isWeekend(SUN) === true);
  check("weekday picks the weekday limit", S.pickLimit(MON, limits) === 60);
  check("weekend picks the weekend limit", S.pickLimit(SAT, limits) === 120);
  check("sunday picks the weekend limit", S.pickLimit(SUN, limits) === 120);
}

// ---- date key uses the device's local day, not UTC ----
{
  // 23:30 local on the 7th is still the 7th, even though UTC may have rolled.
  const lateLocal = new Date(2026, 8, 7, 23, 30, 0);
  check("late-evening local time stays on the same local day", S.dateKey(lateLocal) === "2026-09-07");
  const earlyLocal = new Date(2026, 8, 8, 0, 15, 0);
  check("just after local midnight is the next day", S.dateKey(earlyLocal) === "2026-09-08");
  check("months and days are zero padded", S.dateKey(new Date(2026, 0, 3)) === "2026-01-03");
}

// ---- blocking ----
{
  check("under the limit is not blocked", S.isBlocked(30, 60) === false);
  check("exactly at the limit is blocked", S.isBlocked(60, 60) === true);
  check("over the limit is blocked", S.isBlocked(61, 60) === true);
  // The parent slider goes down to 0, so 0 is a real choice meaning "no chess
  // today". An earlier version treated it as no-enforcement, turning the
  // strictest setting into the most permissive one.
  check("a limit of 0 blocks immediately", S.isBlocked(0, 0) === true);
  check("a limit that has not loaded never blocks", S.isBlocked(999, null) === false);
}

// ---- accumulation: partial time is never lost ----
{
  const today = S.dateKey(MON);
  let acc = { remainderMs: 0, date: today };

  // Six 5-second ticks = 30s. Nothing committed yet, but nothing lost either.
  for (let i = 0; i < 6; i++) {
    const r = S.accumulate(acc, 5_000, MON);
    acc = r.accumulator;
    check(`tick ${i + 1} commits no whole minute yet`, r.minutesToCommit === 0);
  }
  check("30 seconds is retained as a remainder", acc.remainderMs === 30_000);

  // This is the exploit that used to work: navigating before the minute
  // elapsed discarded the partial time. The remainder survives instead.
  const afterNav = S.accumulate(acc, 30_000, MON);
  check("crossing a minute commits exactly one", afterNav.minutesToCommit === 1);
  check("remainder resets after committing", afterNav.accumulator.remainderMs === 0);
}

// ---- accumulation: multiple minutes at once ----
{
  const r = S.accumulate({ remainderMs: 0, date: S.dateKey(MON) }, 125_000, MON);
  // 125s exceeds the plausibility cap, so it is discarded rather than charged.
  check("an implausibly large jump is not charged", r.minutesToCommit === 0);

  const ok = S.accumulate({ remainderMs: 50_000, date: S.dateKey(MON) }, 70_000, MON);
  check("a plausible delta plus remainder commits two minutes", ok.minutesToCommit === 2);
  check("the leftover is kept", ok.accumulator.remainderMs === 0);
}

// ---- sleep / resume must not be billed ----
{
  const eightHours = 8 * 60 * 60 * 1000;
  const r = S.accumulate({ remainderMs: 0, date: S.dateKey(MON) }, eightHours, MON);
  check("an overnight jump charges nothing", r.minutesToCommit === 0);
  check("negative deltas charge nothing", S.accumulate({ remainderMs: 0, date: S.dateKey(MON) }, -5000, MON).minutesToCommit === 0);
}

// ---- midnight rollover ----
{
  const yesterday = { remainderMs: 45_000, date: "2026-09-06" };
  const r = S.accumulate(yesterday, 5_000, MON);
  check("a new day is detected", r.dayRolled === true);
  check("yesterday's remainder is not charged to today", r.accumulator.remainderMs === 0);
  check("the accumulator adopts the new date", r.accumulator.date === "2026-09-07");
  check("no minutes are committed on the rollover tick", r.minutesToCommit === 0);
}

// ---- multi-tab leader election ----
{
  const now = 1_000_000;
  check("with no leader, a tab may claim", S.shouldClaimLeadership(null, "tab-a", now) === true);
  check(
    "the existing leader keeps accruing",
    S.shouldClaimLeadership({ id: "tab-a", ts: now - 1000 }, "tab-a", now) === true
  );
  // The whole point: a second tab must NOT accrue at the same time.
  check(
    "a second tab does not accrue while the leader is fresh",
    S.shouldClaimLeadership({ id: "tab-a", ts: now - 1000 }, "tab-b", now) === false
  );
  check(
    "a stale leader is taken over (crashed tab)",
    S.shouldClaimLeadership({ id: "tab-a", ts: now - 60_000 }, "tab-b", now) === true
  );
  check(
    "the staleness boundary is respected",
    S.shouldClaimLeadership({ id: "tab-a", ts: now - (S.LEADER_STALE_MS - 1) }, "tab-b", now) === false
  );

  check("malformed leader state is ignored", S.parseLeader("not json") === null);
  check("missing leader state is ignored", S.parseLeader(null) === null);
  check("a partial record is rejected", S.parseLeader('{"id":"x"}') === null);
  const good = S.parseLeader('{"id":"x","ts":5}');
  check("a valid record parses", good && good.id === "x" && good.ts === 5);
}

// ---- three tabs, one minute ----
{
  // Simulate three tabs ticking together for a minute; only the leader folds
  // time in, so exactly one minute is billed rather than three.
  const now = 2_000_000;
  const leader = { id: "tab-1", ts: now };
  const tabs = ["tab-1", "tab-2", "tab-3"];
  let committed = 0;
  for (const id of tabs) {
    if (!S.shouldClaimLeadership(leader, id, now)) continue;
    const r = S.accumulate({ remainderMs: 55_000, date: S.dateKey(MON) }, 5_000, MON);
    committed += r.minutesToCommit;
  }
  check("three open tabs bill one minute, not three", committed === 1);
}

console.log(`\n=== SCREEN TIME: ${pass} passed, ${failures.length} failed ===`);
if (failures.length) {
  console.error("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
  process.exitCode = 1;
}

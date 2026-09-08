/**
 * Tests for lib/quests/dailyQuests.ts and the safety properties of
 * lib/quests/questQueries.ts.
 *
 *   node scripts/test-daily-quests.js
 *
 * Pure logic only — no database, so this creates no fixtures and cannot leak
 * anything. That is possible at all because Daily Quests are DERIVED rather
 * than stored: generation is a pure function of (childId, date, level) and
 * progress is a pure function of counts, so everything except the counting
 * itself can be proven here.
 *
 * What this file CANNOT prove, and does not claim to:
 *   - that RLS actually stops parent A reading child B's counts. That is
 *     enforced by the per-table policies in the migrations and needs a live
 *     database to exercise. The structural half of it — that this feature adds
 *     no write path and every read is child-scoped — IS checked below, by
 *     source inspection, because that part is decidable without credentials.
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

const Q = require(path.join(process.cwd(), "lib", "quests", "dailyQuests.ts"));
const QQ = require(path.join(process.cwd(), "lib", "quests", "questQueries.ts"));

let pass = 0;
const failures = [];
const check = (n, c) => (c ? pass++ : failures.push(n));

const CHILD = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const DATE = "2026-09-08";
const NEXT_DATE = "2026-09-09";

const full = { puzzlesSolved: 0, gamesPlayed: 0, learningCompleted: 0 };
const build = (over = {}, opts = {}) =>
  Q.selectDailyQuests({
    childId: opts.childId ?? CHILD,
    date: opts.date ?? DATE,
    experienceLevel: opts.experienceLevel ?? "knows_basics",
    ageBand: opts.ageBand ?? "tween",
    activity: { ...full, ...over },
  });

// --- 1. Generation --------------------------------------------------------
{
  const set = build();
  check("generates exactly three quests", set.quests.length === 3);
  check(
    "generates one quest of each kind",
    ["puzzle", "play", "learn"].every((k) => set.quests.some((q) => q.kind === k))
  );
  check("never exceeds the 3-quest healthy cap", set.quests.length <= 3);
  check("every quest has a target of at least 1", set.quests.every((q) => q.target >= 1));
  check(
    "targets stay small (nothing above 4 — no grinding)",
    set.quests.every((q) => q.target <= 4)
  );
  check("date is echoed on the set", set.date === DATE);
  check("nothing is complete at zero activity", set.completedCount === 0 && !set.allComplete);
}

// --- 2. Determinism / idempotency ----------------------------------------
{
  const a = build({ puzzlesSolved: 1 });
  const b = build({ puzzlesSolved: 1 });
  check("generation is idempotent for identical input", JSON.stringify(a) === JSON.stringify(b));

  // Re-deriving many times must never drift — this is the property that
  // replaces "don't insert a duplicate quest row" in a stored design.
  const runs = new Set();
  for (let i = 0; i < 50; i++) runs.add(JSON.stringify(build({ puzzlesSolved: 2 })));
  check("50 re-derivations produce exactly one distinct result", runs.size === 1);

  check(
    "quest order is stable (puzzle, play, learn)",
    build().quests.map((q) => q.kind).join(",") === "puzzle,play,learn"
  );

  const seedA = Q.questSeed(`${CHILD}:${DATE}`);
  const seedB = Q.questSeed(`${CHILD}:${DATE}`);
  check("seed is deterministic", seedA === seedB && Number.isInteger(seedA));
  check("seed is a non-negative 32-bit value", seedA >= 0 && seedA <= 0xffffffff);
}

// --- 3. No duplicates -----------------------------------------------------
{
  const set = build();
  const ids = set.quests.map((q) => q.id);
  const kinds = set.quests.map((q) => q.kind);
  check("quest ids are unique", new Set(ids).size === ids.length);
  check("quest kinds are unique — no doubled-up objective", new Set(kinds).size === kinds.length);
  check("ids are date-scoped", ids.every((id) => id.startsWith(`${DATE}:`)));
}

// --- 4. Date rollover -----------------------------------------------------
{
  const today = build({ puzzlesSolved: 3 });
  const tomorrow = build({ puzzlesSolved: 3 }, { date: NEXT_DATE });
  check("a new date produces new quest ids", today.quests[0].id !== tomorrow.quests[0].id);
  check(
    "tomorrow's ids carry tomorrow's date",
    tomorrow.quests.every((q) => q.id.startsWith(`${NEXT_DATE}:`))
  );
  check(
    "targets do not escalate day over day (no treadmill)",
    JSON.stringify(today.quests.map((q) => q.target)) ===
      JSON.stringify(tomorrow.quests.map((q) => q.target))
  );
  // Yesterday going unfinished must cost nothing today: same targets, and a
  // fresh zero-progress set once the counts reset with the new day.
  const fresh = build({}, { date: NEXT_DATE });
  check("an unfinished yesterday does not penalise today", fresh.completedCount === 0 &&
    fresh.quests.every((q) => q.progress === 0));
}

// --- 5. Progress calculation ---------------------------------------------
{
  const set = build({ puzzlesSolved: 1, gamesPlayed: 0, learningCompleted: 0 });
  const puzzle = set.quests.find((q) => q.kind === "puzzle");
  check("partial progress is reported exactly", puzzle.progress === 1);
  check("partial progress is not complete", puzzle.complete === false);
  check("raw progress is preserved alongside capped progress", puzzle.rawProgress === 1);

  const neg = build({ puzzlesSolved: -5 }).quests.find((q) => q.kind === "puzzle");
  check("negative counts clamp to zero", neg.progress === 0 && neg.rawProgress === 0);

  const frac = build({ puzzlesSolved: 2.7 }).quests.find((q) => q.kind === "puzzle");
  check("fractional counts floor", frac.rawProgress === 2);

  const nan = build({ puzzlesSolved: NaN });
  check("NaN source is dropped, not shown as 0", !nan.quests.some((q) => q.kind === "puzzle"));
}

// --- 6. Completion --------------------------------------------------------
{
  const set = build({ puzzlesSolved: 3, gamesPlayed: 1, learningCompleted: 1 });
  check("all three complete at target", set.completedCount === 3);
  check("allComplete is set", set.allComplete === true);
  check("each quest reports complete", set.quests.every((q) => q.complete));
  check(
    "progress equals target when complete",
    set.quests.every((q) => q.progress === q.target)
  );

  const one = build({ gamesPlayed: 1 });
  check("a single completion counts once", one.completedCount === 1);
  check("partial completion is not allComplete", one.allComplete === false);
}

// --- 7. Over-completion ---------------------------------------------------
{
  const over = build({ puzzlesSolved: 99, gamesPlayed: 42, learningCompleted: 17 });
  check(
    "progress never exceeds target",
    over.quests.every((q) => q.progress <= q.target)
  );
  check(
    "completedCount never exceeds quest count",
    over.completedCount === over.quests.length && over.completedCount === 3
  );
  check(
    "raw counts are still preserved honestly",
    over.quests.find((q) => q.kind === "puzzle").rawProgress === 99
  );
  // Repeated activity must not manufacture extra completions or extra quests.
  const again = build({ puzzlesSolved: 100, gamesPlayed: 43, learningCompleted: 18 });
  check("more activity does not create more quests", again.quests.length === 3);
  check("more activity does not raise completedCount", again.completedCount === 3);
}

// --- 8. Authorization boundaries (structural, source-inspected) -----------
{
  const src = fs.readFileSync(path.join(process.cwd(), "lib", "quests", "questQueries.ts"), "utf8");

  check("quest queries contain no insert", !/\.insert\s*\(/.test(src));
  check("quest queries contain no update", !/\.update\s*\(/.test(src));
  check("quest queries contain no delete", !/\.delete\s*\(/.test(src));
  check("quest queries contain no upsert", !/\.upsert\s*\(/.test(src));
  check("quest queries invoke no RPC / SECURITY DEFINER function", !/\.rpc\s*\(/.test(src));
  check("quest queries never use the service role", !/SERVICE_ROLE|service_role/.test(src));

  // Every .from(...) must be paired with a child_id filter — the read side of
  // the parent/child boundary. (RLS is the actual enforcement; this asserts we
  // never even ask for another child's rows.)
  const froms = src.match(/\.from\(/g) || [];
  const childEq = src.match(/\.eq\("child_id", childId\)/g) || [];
  check("every quest read is child-scoped", froms.length > 0 && froms.length === childEq.length);

  // Only the four audited activity tables may be read.
  const tables = [...src.matchAll(/\.from\("([a-z_]+)"\)/g)].map((m) => m[1]);
  const allowed = new Set([
    "puzzle_library_solves",
    "child_game_reviews",
    "child_lesson_progress",
    "child_academy_progress",
  ]);
  check("quest reads touch only audited activity tables", tables.every((t) => allowed.has(t)));
  check("quest reads do not touch free_game_usage (premium-blind source)",
    !tables.includes("free_game_usage"));
}

// --- 9. Child isolation ---------------------------------------------------
{
  const mine = build({ puzzlesSolved: 3 });
  const theirs = build({ puzzlesSolved: 0 }, { childId: OTHER });
  check(
    "one child's progress never appears in another's set",
    mine.completedCount === 1 && theirs.completedCount === 0
  );
  check(
    "the derivation seed is child-scoped",
    Q.questSeed(`${CHILD}:${DATE}`) !== Q.questSeed(`${OTHER}:${DATE}`)
  );
  // Ids are per-day, not per-child, so they must never be used as a global key
  // across children — assert they are at least stable within a child+day.
  check("ids are stable for the same child and day", build().quests[0].id === build().quests[0].id);
}

// --- 10. Daily Challenge regression --------------------------------------
{
  const qq = fs.readFileSync(path.join(process.cwd(), "lib", "quests", "questQueries.ts"), "utf8");
  const dq = fs.readFileSync(path.join(process.cwd(), "lib", "quests", "dailyQuests.ts"), "utf8");

  check(
    "quests never write to daily_challenge_history",
    !/daily_challenge_history/.test(qq.replace(/\/\*[\s\S]*?\*\//g, ""))
  );
  check(
    "quests do not call the daily challenge RPC",
    !/get_daily_challenge/.test(qq) && !/get_daily_challenge/.test(dq)
  );

  // The Daily Challenge card must still be present on Home — quests are an
  // addition beside it, not a replacement for it.
  const home = fs.readFileSync(
    path.join(process.cwd(), "app", "(tabs)", "kingdom-map", "page.tsx"),
    "utf8"
  );
  check("Home still imports DailyChallengeCard", /DailyChallengeCard/.test(home));
  check("Home still renders <DailyChallengeCard", /<DailyChallengeCard/.test(home));
  check("Home renders the new quests card", /<DailyQuestsCard/.test(home));
  check("Home still renders HeroJourneyCard (Continue Your Journey)", /<HeroJourneyCard/.test(home));

  // The dedupe rationale: counting daily_challenge_history on top of
  // puzzle_library_solves would double-count the Daily Challenge each day.
  const puzzleTables = [...qq.matchAll(/\.from\("([a-z_]+)"\)/g)].map((m) => m[1]);
  check(
    "the puzzle count reads exactly one solve table",
    puzzleTables.filter((t) => t === "puzzle_library_solves").length === 1
  );
}

// --- 11. Healthy-engagement guarantees ------------------------------------
{
  const warm = build({}, { experienceLevel: "new", ageBand: "young" });
  const neutral = build({}, { experienceLevel: "plays_regularly", ageBand: "adult" });

  check("beginner gets a gentler puzzle target",
    warm.quests.find((q) => q.kind === "puzzle").target <
      neutral.quests.find((q) => q.kind === "puzzle").target);

  const warmTitles = warm.quests.map((q) => q.title).join(" ");
  const neutralTitles = neutral.quests.map((q) => q.title).join(" ");
  check("child and adult copy differ", warmTitles !== neutralTitles);

  const harsh = /fail|failed|lost|lose|don't|do not miss|streak (?:lost|broken)|hurry|last chance/i;
  check("no punishing language in child copy", !harsh.test(warmTitles));
  check("no punishing language in adult copy", !harsh.test(neutralTitles));

  const lines = [
    Q.questSummaryLine(build(), false),
    Q.questSummaryLine(build({ gamesPlayed: 1 }), false),
    Q.questSummaryLine(build({ puzzlesSolved: 3, gamesPlayed: 1, learningCompleted: 1 }), false),
    Q.questSummaryLine(build(), true),
    Q.questSummaryLine(build({ gamesPlayed: 1 }), true),
    Q.questSummaryLine(build({ puzzlesSolved: 3, gamesPlayed: 1, learningCompleted: 1 }), true),
  ];
  check("no summary line scolds", lines.every((l) => !harsh.test(l)));
  check("all-complete line is celebratory, not a nudge to keep going",
    /done/i.test(Q.questSummaryLine(build({ puzzlesSolved: 3, gamesPlayed: 1, learningCompleted: 1 }), true)));
  check("empty set yields an empty summary", Q.questSummaryLine({ quests: [], completedCount: 0, allComplete: false, date: DATE }, false) === "");

  // No randomness anywhere: the same inputs always give the same words.
  const t1 = build().quests.map((q) => q.title).join("|");
  const t2 = build().quests.map((q) => q.title).join("|");
  check("copy selection is deterministic, never random", t1 === t2);
}

// --- 12. Unreadable sources are omitted, never shown as zero --------------
{
  const noPuzzles = build({ puzzlesSolved: null });
  check("a null source drops its quest", noPuzzles.quests.length === 2);
  check("a null source drops the right quest", !noPuzzles.quests.some((q) => q.kind === "puzzle"));
  check(
    "remaining quests still work",
    noPuzzles.quests.map((q) => q.kind).join(",") === "play,learn"
  );

  const allNull = Q.selectDailyQuests({
    childId: CHILD,
    date: DATE,
    experienceLevel: "new",
    ageBand: "young",
    activity: { puzzlesSolved: null, gamesPlayed: null, learningCompleted: null },
  });
  check("all sources null yields no quests", allNull.quests.length === 0);
  check("an empty set is not 'all complete'", allNull.allComplete === false);
}

// --- 13. Local day bounds (rollover correctness at the query layer) -------
{
  const { start, next } = QQ.localDayBounds(new Date(2026, 8, 8, 13, 45, 0));
  const s = new Date(start);
  const n = new Date(next);
  check("day starts at local midnight", s.getHours() === 0 && s.getMinutes() === 0 && s.getSeconds() === 0);
  check("day start is the same local calendar day", s.getDate() === 8 && s.getMonth() === 8);
  check("next bound is the following local day", n.getDate() === 9 && n.getMonth() === 8);
  check("bounds are a half-open 24h-ish window", n.getTime() > s.getTime());

  // Month and year boundaries must not wrap incorrectly.
  const dec = QQ.localDayBounds(new Date(2026, 11, 31, 23, 30, 0));
  const decNext = new Date(dec.next);
  check("year rollover lands on Jan 1", decNext.getFullYear() === 2027 && decNext.getMonth() === 0 && decNext.getDate() === 1);

  const monthEnd = QQ.localDayBounds(new Date(2026, 8, 30, 12, 0, 0));
  const monthNext = new Date(monthEnd.next);
  check("month rollover lands on the 1st", monthNext.getMonth() === 9 && monthNext.getDate() === 1);

  // A late-evening timestamp must belong to today, not tomorrow — the bug a
  // UTC-based bound would introduce for anyone east of Greenwich.
  const late = new Date(2026, 8, 8, 23, 59, 0);
  const b = QQ.localDayBounds(late);
  check("late-evening local time still falls inside today's window",
    late.getTime() >= new Date(b.start).getTime() && late.getTime() < new Date(b.next).getTime());
}

console.log(`\n=== DAILY QUESTS: ${pass} passed, ${failures.length} failed ===`);
if (failures.length) {
  console.error("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
  process.exitCode = 1;
}

/**
 * Tests for lib/school/chessSchool.ts.
 *
 *   node scripts/test-chess-school.js
 *
 * Pure logic only — progress is a parameter, so every rule is exercised
 * without a database.
 *
 * The property that matters most: Chess School must NEVER overstate how far
 * a learner has got. Duplicate completion rows, day numbers outside the
 * course, and a current_day past the end all have to be absorbed without
 * inflating the count — an honest "12 of 30" is the entire point of the
 * feature, and a wrong one is worse than the bare number it replaced.
 *
 * Also asserted here: the course length is READ from content/lessons.ts
 * rather than hardcoded, so the label cannot drift from the real lessons.
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

const S = require(path.join(process.cwd(), "lib", "school", "chessSchool.ts"));
const { LESSONS } = require(path.join(process.cwd(), "content", "lessons.ts"));

let pass = 0;
const failures = [];
const check = (n, c) => (c ? pass++ : failures.push(n));

const days = (n) => Array.from({ length: n }, (_, i) => i + 1);
const prog = (currentDay, completedDays, totalDays) =>
  S.chessSchoolProgress({ currentDay, completedDays, totalDays });

// --- 1. The course is the real lesson list -------------------------------
{
  check("TOTAL_DAYS comes from content/lessons.ts", S.TOTAL_DAYS === LESSONS.length);
  check("the course is 30 days", S.TOTAL_DAYS === 30);
  check("course is named Chess School", S.COURSE_NAME === "Chess School");
  check("course title is the 30-day promise", /30 Days/.test(S.COURSE_TITLE));

  // Every day 1..30 must exist exactly once, or "Day 12 of 30" is a lie.
  const nums = LESSONS.map((l) => l.dayNumber).sort((a, b) => a - b);
  check("lesson days are exactly 1..30", JSON.stringify(nums) === JSON.stringify(days(30)));
  check("no duplicate day numbers", new Set(nums).size === nums.length);
}

// --- 2. Ordinary progress -------------------------------------------------
{
  const p = prog(12, days(11), 30);
  check("current day preserved", p.currentDay === 12);
  check("completed count is real", p.completedCount === 11);
  check("percent is rounded honestly", p.percentComplete === Math.round((11 / 30) * 100));
  check("days remaining", p.daysRemaining === 19);
  check("not complete", p.isComplete === false);
  check("not 'not started'", p.isNotStarted === false);
  check("label reads Day 12 of 30", S.dayOfLabel(12, 30) === "Day 12 of 30");
  check("continue href points at the lesson", S.continueHref(p) === "/lesson/12");
}

// --- 3. Never overstate ---------------------------------------------------
{
  // Duplicate completion rows must not inflate.
  const dupes = prog(5, [1, 1, 2, 2, 2, 3, 3], 30);
  check("duplicate rows count once", dupes.completedCount === 3);

  // Days outside the course must not count.
  const oob = prog(5, [1, 2, 31, 99, 0, -4], 30);
  check("out-of-range days are ignored", oob.completedCount === 2);

  // Non-numeric junk must not count or crash.
  const junk = prog(5, [1, NaN, Infinity, 2], 30);
  check("non-finite days are ignored", junk.completedCount === 2);

  // Fractional day numbers floor rather than double-count.
  check("fractional days floor", prog(5, [1.9, 1.2], 30).completedCount === 1);

  const over = prog(5, days(50), 30);
  check("completed can never exceed total", over.completedCount === 30);
  check("percent never exceeds 100", over.percentComplete === 100);
  check("days remaining never goes negative", over.daysRemaining === 0);
}

// --- 4. Current day clamping ---------------------------------------------
{
  check("current day past the end clamps", prog(99, [], 30).currentDay === 30);
  check("current day 0 clamps up", prog(0, [], 30).currentDay === 1);
  check("negative current day clamps up", prog(-5, [], 30).currentDay === 1);
  check("NaN current day falls back to 1", prog(NaN, [], 30).currentDay === 1);
  check("continue href is always a real day", S.continueHref(prog(99, [], 30)) === "/lesson/30");
}

// --- 5. Start and finish states ------------------------------------------
{
  const fresh = prog(1, [], 30);
  check("a new learner is 'not started'", fresh.isNotStarted === true);
  check("a new learner is at 0%", fresh.percentComplete === 0);
  check("a new learner's action is Start Day 1", S.continueLabel(fresh) === "Start Day 1 →");

  const done = prog(30, days(30), 30);
  check("all 30 days is complete", done.isComplete === true);
  check("complete is 100%", done.percentComplete === 100);
  check("complete has 0 remaining", done.daysRemaining === 0);
  check("complete offers a review action", /Review/.test(S.continueLabel(done)));

  // 29 of 30 must NOT read as complete — the finish line has to be real.
  const nearly = prog(30, days(29), 30);
  check("29 of 30 is not complete", nearly.isComplete === false);
  check("29 of 30 has 1 remaining", nearly.daysRemaining === 1);
}

// --- 6. Copy: honest, two registers, never nagging ------------------------
{
  const states = [prog(1, [], 30), prog(12, days(11), 30), prog(30, days(30), 30)];
  const lines = [];
  for (const p of states) for (const neutral of [true, false]) lines.push(S.schoolSummary(p, neutral));

  check("every state produces a line", lines.every((l) => l.length > 0));
  const harsh = /\b(fail|failed|behind|late|only|just|lazy|missed)\b/i;
  check("no summary scolds or shames", lines.every((l) => !harsh.test(l)));
  check("no summary leaks NaN", lines.every((l) => !/NaN|undefined/.test(l)));

  check(
    "child and adult copy differ",
    S.schoolSummary(states[1], true) !== S.schoolSummary(states[1], false)
  );
  check("mid-course copy states the real count", /11/.test(S.schoolSummary(states[1], true)));
  check("complete copy celebrates", /complete|finished/i.test(S.schoolSummary(states[2], true)));

  // Deterministic — same inputs, same words.
  check(
    "summary is deterministic",
    S.schoolSummary(states[1], false) === S.schoolSummary(states[1], false)
  );

  // An empty course says nothing rather than "0 of 0".
  check("empty course yields no summary", S.schoolSummary(prog(1, [], 0), false) === "");
  check("empty course is not 'complete'", prog(1, [], 0).isComplete === false);
  check("empty course percent is 0, not NaN", prog(1, [], 0).percentComplete === 0);
}

// --- 7. Wiring ------------------------------------------------------------
{
  const read = (p) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
  const home = read("app/(tabs)/kingdom-map/page.tsx");
  const card = read("components/school/ChessSchoolCard.tsx");
  const header = read("components/lesson/LessonHeader.tsx");
  const lesson = read("app/lesson/[dayId]/page.tsx");
  const learn = read("app/(tabs)/learn/page.tsx");

  check("Home renders the Chess School card", /<ChessSchoolCard/.test(home));
  check("the card is fed real current_day", /currentDay=\{child\.current_day\}/.test(home));
  check("the card is fed real completedDays", /completedDays=\{completedDays\}/.test(home));
  check("the card computes, never hardcodes", /chessSchoolProgress\(/.test(card));
  check("no hardcoded progress fraction in the card", !/\b\d+\s*\/\s*30\b/.test(card));

  check("the lesson header can show 'of N'", /courseTotalDays/.test(header));
  check("the lesson page passes the real total", /courseTotalDays=\{TOTAL_DAYS\}/.test(lesson));
  // The shared header must stay import-free of the lesson dataset, or
  // CourseIndex's bundle grows for nothing.
  check("header does not import the course module", !/lib\/school\/chessSchool/.test(header));
  check("header does not import lessons", !/content\/lessons/.test(header));

  check("Learn uses Chess School naming", /COURSE_NAME|COURSE_TITLE/.test(learn));
  check("Learn shows no fabricated progress", !/\b\d+\s*\/\s*30\b/.test(learn));
  check("Learn stays a static server page", !/lib\/supabase\/server/.test(learn));

  // The existing journey must still be there — this is a reframe, not a
  // replacement.
  check("the 30-day journey still renders", /<KingdomMapCards/.test(home));
  check("existing progress semantics untouched", /completedDays=\{completedDays\}/.test(home));
}

console.log(`\n=== CHESS SCHOOL: ${pass} passed, ${failures.length} failed ===`);
if (failures.length) {
  console.error("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
  process.exitCode = 1;
}

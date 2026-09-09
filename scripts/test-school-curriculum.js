/**
 * Tests for lib/school/curriculum.ts — the five-stage view of Chess School.
 *
 *   node scripts/test-school-curriculum.js
 *
 * Imports the real modules, including content/lessons.ts, so the curriculum
 * is checked against the lessons that actually ship rather than a fixture.
 *
 * The property that matters: the stage view must DESCRIBE the course, never
 * invent it. Every day belongs to exactly one stage, every stage's days are
 * real days, and every skill tag in the lesson content is accounted for — a
 * new lesson with an unmapped tag fails here rather than silently landing in
 * "Learn the Board" and mis-describing the course to a parent.
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

const C = require(path.join(process.cwd(), "lib", "school", "curriculum.ts"));
const S = require(path.join(process.cwd(), "lib", "school", "chessSchool.ts"));
const { LESSONS } = require(path.join(process.cwd(), "content", "lessons.ts"));
const { KINGDOM_ZONES } = require(path.join(process.cwd(), "content", "kingdomZones.ts"));

let pass = 0;
const failures = [];
const check = (n, c) => (c ? pass++ : failures.push(n));

const days = (n) => Array.from({ length: n }, (_, i) => i + 1);
const journey = (currentDay, completedDays) => C.courseJourney({ currentDay, completedDays });

// --- 1. The stage map covers the real lesson content ---------------------
{
  const usedTags = new Set();
  for (const lesson of LESSONS) for (const tag of lesson.skillTags) usedTags.add(tag);

  const known = new Set(C.KNOWN_SKILL_TAGS);
  const unmapped = [...usedTags].filter((t) => !known.has(t));
  check(`every lesson skill tag is mapped to a stage (unmapped: ${unmapped.join(", ") || "none"})`, unmapped.length === 0);

  const stale = C.KNOWN_SKILL_TAGS.filter((t) => !usedTags.has(t));
  check(`no stale tags in the map (stale: ${stale.join(", ") || "none"})`, stale.length === 0);

  // Overrides must point at days that exist, or they are silent no-ops.
  const real = new Set(LESSONS.map((l) => l.dayNumber));
  check("every stage override names a real day", C.STAGE_OVERRIDE_DAYS.every((d) => real.has(d)));
  check("overrides are the exception, not the rule", C.STAGE_OVERRIDE_DAYS.length <= LESSONS.length / 4);
}

// --- 2. Every day is classified exactly once -----------------------------
{
  const stages = journey(1, []);
  const seen = [];
  for (const stage of stages) seen.push(...stage.days);
  const sorted = [...seen].sort((a, b) => a - b);

  check("the journey covers every lesson day", sorted.length === LESSONS.length);
  check("no day appears in two stages", new Set(seen).size === seen.length);
  check(
    "the days are exactly the lesson days",
    JSON.stringify(sorted) === JSON.stringify(LESSONS.map((l) => l.dayNumber).sort((a, b) => a - b))
  );
  check("no stage is empty", stages.every((s) => s.days.length > 0));

  const order = stages.map((s) => s.id);
  const canonical = C.CURRICULUM_STAGES.map((s) => s.id).filter((id) => order.includes(id));
  check("stage order follows CURRICULUM_STAGES", JSON.stringify(order) === JSON.stringify(canonical));
}

// --- 3. The classification is defensible ---------------------------------
{
  // Day 1 teaches the pawn. If this ever reads as anything but foundations,
  // the classifier is broken in the most visible possible way.
  check("Day 1 is foundations", C.stageForDay(1) === "foundations");
  // Day 7 is tagged knight_movement AND fork_pattern — the fork is the lesson.
  check("Day 7 (fork academy) is tactics, not foundations", C.stageForDay(7) === "tactics");
  check("Day 11 (opening gambit) is strategy", C.stageForDay(11) === "strategy");
  check("Day 15 (promotion) is endgames", C.stageForDay(15) === "endgames");
  check("the last day is the final challenge", C.stageForDay(LESSONS.length) === "final");
  check("only one day is the final challenge", journey(1, []).find((s) => s.id === "final").days.length === 1);

  // A day that does not exist must not throw or claim a stage it can't have.
  check("an unknown day does not throw", typeof C.stageForDay(999) === "string");

  // Foundations must come first in practice, not just in the list: the
  // earliest foundations day must precede the earliest endgames day.
  const stages = journey(1, []);
  const first = (id) => stages.find((s) => s.id === id)?.days[0];
  check("foundations start before tactics", first("foundations") < first("tactics"));
  check("tactics start before endgames", first("tactics") < first("endgames"));
}

// --- 4. Per-stage progress is real ---------------------------------------
{
  const none = journey(1, []);
  check("nothing completed means 0 everywhere", none.every((s) => s.completedCount === 0));
  check("nothing completed means 0%", none.every((s) => s.percentComplete === 0));
  check("no stage is complete at the start", none.every((s) => s.isComplete === false));
  check("every stage offers a next day at the start", none.every((s) => s.nextDay !== null));

  const all = journey(30, days(LESSONS.length));
  check("everything completed means every stage complete", all.every((s) => s.isComplete));
  check("everything completed means 100%", all.every((s) => s.percentComplete === 100));
  check("a complete stage has no next day", all.every((s) => s.nextDay === null));

  // Partial: complete the first three days only.
  const partial = journey(4, [1, 2, 3]);
  const foundations = partial.find((s) => s.id === "foundations");
  check("partial progress counts only completed days", foundations.completedCount === 3);
  check("the next day is the first unfinished one", foundations.nextDay === 4);
  check("later stages stay at zero", partial.filter((s) => s.id !== "foundations").every((s) => s.completedCount === 0));

  // Duplicates and junk must not inflate — same rule as the course card.
  const dupes = journey(4, [1, 1, 1, 2, 2, NaN, Infinity, 3.7]);
  const f2 = dupes.find((s) => s.id === "foundations");
  check("duplicate completions count once", f2.completedCount === 3);
  check("percent never exceeds 100", dupes.every((s) => s.percentComplete <= 100));

  // Out-of-range days can't create progress in a stage they don't belong to.
  const oob = journey(1, [999, -3, 0]);
  check("out-of-range completions count for nothing", oob.every((s) => s.completedCount === 0));

  // isCurrent marks exactly the stage holding current_day.
  const cur = journey(12, []);
  check("exactly one stage is current", cur.filter((s) => s.isCurrent).length === 1);
  check("day 12 is current in the strategy stage", cur.find((s) => s.isCurrent).id === "strategy");
}

// --- 5. Skills learned come from completed days only ---------------------
{
  check("no days completed, no skills claimed", C.skillsLearned([]).length === 0);
  check("junk completions claim no skills", C.skillsLearned([NaN, 999, -1]).length === 0);

  const day1 = C.skillsLearned([1]);
  check("day 1 yields its own skills", day1.length > 0);
  check("day 1 skills are pawn skills", day1.every((s) => /pawn/i.test(s)));
  check("day 1 does not claim endgames", !day1.some((s) => /endgame/i.test(s)));

  const all = C.skillsLearned(days(LESSONS.length));
  check("the full course yields many skills", all.length >= 15);
  check("skills are deduplicated", new Set(all).size === all.length);
  check("no skill label is blank", all.every((s) => s.trim().length > 0));
  // Order is course order, so the first skill learned is a day 1 skill.
  check("skills are listed in course order", all[0] === day1[0]);

  // Completing only the last day must NOT retroactively claim earlier skills.
  const lastOnly = C.skillsLearned([LESSONS.length]);
  check("finishing day 30 alone does not claim day 1's skills", lastOnly.length < all.length);
}

// --- 6. Chess School's resume day (A7) -----------------------------------
{
  const p = (currentDay, completedDays) => S.chessSchoolProgress({ currentDay, completedDays });

  check("resume is current_day when it is unfinished", p(12, [1, 2, 3]).resumeDay === 12);
  // current_day pointing at a finished day must not send the learner backwards.
  check("resume skips a current_day already completed", p(3, [1, 2, 3]).resumeDay === 4);
  check("resume finds the earliest gap", p(5, [1, 2, 3, 4, 5]).resumeDay === 6);
  check("a gap earlier than current_day is offered", p(4, [1, 2, 4]).resumeDay === 3);
  check("a fresh learner resumes at day 1", p(1, []).resumeDay === 1);
  check("resume is always a real day", p(99, []).resumeDay >= 1 && p(99, []).resumeDay <= S.TOTAL_DAYS);
  check(
    "a complete course still resumes somewhere real",
    p(30, days(S.TOTAL_DAYS)).resumeDay >= 1 && p(30, days(S.TOTAL_DAYS)).resumeDay <= S.TOTAL_DAYS
  );
  check("continue href uses the resume day", S.continueHref(p(3, [1, 2, 3])) === "/lesson/4");
  check("continue label names the resume day", /Day 4 of/.test(S.continueLabel(p(3, [1, 2, 3]))));
}

// --- 7. The stage view does not replace the zones ------------------------
{
  // Kingdom zones still own free-lesson gating; this must not have changed.
  check("the six kingdom zones are untouched", KINGDOM_ZONES.length === 6);
  const src = fs.readFileSync(path.join(process.cwd(), "lib", "school", "curriculum.ts"), "utf8");
  check("the curriculum module does not gate access", !/isDayFree|freeLessonCount|premium/i.test(src));
  check("the curriculum module stores nothing", !/supabase|insert|update\(/i.test(src));
  check("the curriculum module is pure", !/Math\.random|Date\.now|new Date\(/.test(src));
}

// --- 8. Wiring -----------------------------------------------------------
{
  const read = (p) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
  const page = read("app/chess-school/page.tsx");
  const journeyCmp = read("components/school/CourseJourney.tsx");
  const grad = read("components/school/GraduationPanel.tsx");
  const card = read("components/school/ChessSchoolCard.tsx");
  const learn = read("app/(tabs)/learn/page.tsx");

  check("the course page exists and is authed", /getSessionUser/.test(page) && /redirect\("\/sign-in"\)/.test(page));
  check("the course page reads real completions", /getCompletedDays/.test(page));
  check("the course page computes progress", /chessSchoolProgress\(/.test(page));
  check("the course page hardcodes no fraction", !/\b\d+\s*\/\s*30\b/.test(page));
  check("the course page renders the journey", /<CourseJourney/.test(page));

  check("graduation is gated on real completion", /progress\.isComplete && \(?\s*<GraduationPanel/.test(page.replace(/\n\s*/g, " ")));
  check("graduation lists real skills", /skillsLearned\(/.test(grad));
  // Comments stripped first: the file explains WHY there is no certificate,
  // and that explanation is worth keeping.
  const gradCode = grad.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  check("graduation ships no certificate or share button", !/certificate|download|share/i.test(gradCode));

  check("the journey component computes stages", /courseJourney\(/.test(journeyCmp));
  check("the journey component hardcodes no counts", !/\b\d+\s*\/\s*\d+\s*days\b/.test(journeyCmp));
  check("stage progress bars are labelled", /role="progressbar"/.test(journeyCmp) && /aria-label/.test(journeyCmp));

  check("Home's card links to the course page", /href="\/chess-school"/.test(card));
  check("Learn links to the course page", /href="\/chess-school"/.test(learn));
  check("Learn still shows no fabricated progress", !/\b\d+\s*\/\s*30\b/.test(learn));
}

console.log(`\n=== SCHOOL CURRICULUM: ${pass} passed, ${failures.length} failed ===`);
if (failures.length) {
  console.error("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
  process.exitCode = 1;
}

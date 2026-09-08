/**
 * Tests for lib/learner/learningPath.ts.
 *
 *   node scripts/test-learning-path.js
 *
 * Pure logic only — no database, no fixtures. The completed-id set is an
 * input, so every progression rule can be exercised directly.
 *
 * The rules that matter: the path never overstates progress, exactly one
 * stage is ever "current", and that marker only ever moves forward.
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

const P = require(path.join(process.cwd(), "lib", "learner", "learningPath.ts"));

let pass = 0;
const failures = [];
const check = (n, c) => (c ? pass++ : failures.push(n));

const IDS = {
  "tactical-thinking": ["t1", "t2", "t3"],
  strategy: ["s1", "s2"],
  endgames: ["e1", "e2"],
};
const done = (...keys) => new Set(keys);

// --- 1. Empty / degenerate ------------------------------------------------
{
  const empty = P.buildLearningPath(new Set(), {});
  check("no lesson ids -> no stages", empty.stages.length === 0);
  check("no lesson ids -> zero totals", empty.totalLessons === 0 && empty.completedLessons === 0);
  check("no lesson ids -> percent 0, not NaN", empty.percent === 0);
  check("no lesson ids -> not allComplete", empty.allComplete === false);
  check("no lesson ids -> no current course", empty.currentCourseId === null);
  check("no lesson ids -> empty summary", P.pathSummary(empty) === "");

  // A course present but with zero known lessons must be dropped, not shown 0/0.
  const zero = P.buildLearningPath(new Set(), { strategy: [] });
  check("a course with no lessons is dropped", zero.stages.length === 0);
}

// --- 2. Fresh learner -----------------------------------------------------
{
  const p = P.buildLearningPath(new Set(), IDS);
  check("all three stages appear", p.stages.length === 3);
  check("totals sum across courses", p.totalLessons === 7);
  check("nothing completed", p.completedLessons === 0 && p.percent === 0);
  check("first stage is current", p.stages[0].state === "current");
  check("currentCourseId is the first stage", p.currentCourseId === "tactical-thinking");
  check("later stages are upcoming",
    p.stages[1].state === "upcoming" && p.stages[2].state === "upcoming");
  check("summary states what lies ahead", /7 lessons ahead/.test(P.pathSummary(p)));
}

// --- 3. Partial progress --------------------------------------------------
{
  const p = P.buildLearningPath(done("tactical-thinking:t1", "tactical-thinking:t2"), IDS);
  check("partial completion counted", p.completedLessons === 2);
  check("per-stage count is right", p.stages[0].completed === 2 && p.stages[0].total === 3);
  check("an unfinished first stage stays current", p.stages[0].state === "current");
  check("percent is rounded honestly", p.percent === Math.round((2 / 7) * 100));
  check("summary counts completed", /2 of 7 lessons complete/.test(P.pathSummary(p)));
}

// --- 4. The current marker moves forward ---------------------------------
{
  const afterFirst = P.buildLearningPath(
    done("tactical-thinking:t1", "tactical-thinking:t2", "tactical-thinking:t3"),
    IDS
  );
  check("a finished stage reads complete", afterFirst.stages[0].state === "complete");
  check("the marker advances to stage 2", afterFirst.stages[1].state === "current");
  check("currentCourseId advances", afterFirst.currentCourseId === "strategy");
  check("stage 3 still upcoming", afterFirst.stages[2].state === "upcoming");

  // Exactly one current stage, at every reachable completion level.
  const keys = ["tactical-thinking:t1","tactical-thinking:t2","tactical-thinking:t3","strategy:s1","strategy:s2","endgames:e1","endgames:e2"];
  for (let i = 0; i <= keys.length; i++) {
    const p = P.buildLearningPath(new Set(keys.slice(0, i)), IDS);
    const currents = p.stages.filter((s) => s.state === "current").length;
    check(`exactly one current stage at ${i} lessons done`, currents === (i === keys.length ? 0 : 1));
  }
}

// --- 5. Out-of-order completion ------------------------------------------
{
  // Finishing a LATER course first must not mark an earlier unfinished one
  // complete, and must not move the marker past unfinished work.
  const p = P.buildLearningPath(done("endgames:e1", "endgames:e2"), IDS);
  check("later course reads complete", p.stages[2].state === "complete");
  check("earlier unfinished course is still current", p.stages[0].state === "current");
  check("currentCourseId stays on the earliest gap", p.currentCourseId === "tactical-thinking");
  check("middle stage is upcoming, not current", p.stages[1].state === "upcoming");
  check("completed total still correct", p.completedLessons === 2);
}

// --- 6. Fully complete ----------------------------------------------------
{
  const all = done(
    "tactical-thinking:t1","tactical-thinking:t2","tactical-thinking:t3",
    "strategy:s1","strategy:s2","endgames:e1","endgames:e2"
  );
  const p = P.buildLearningPath(all, IDS);
  check("everything complete", p.allComplete === true);
  check("percent is 100", p.percent === 100);
  check("no stage is current when done", p.stages.every((s) => s.state === "complete"));
  check("currentCourseId is null when done", p.currentCourseId === null);
  check("summary celebrates completion", /All 7 lessons complete/.test(P.pathSummary(p)));
}

// --- 7. No overstatement --------------------------------------------------
{
  // Ids for lessons that aren't in the course, and other courses' ids, must
  // never inflate a count.
  const noisy = done(
    "tactical-thinking:t1",
    "tactical-thinking:does-not-exist",
    "strategy:t1",              // right lesson id, wrong course
    "openings:o1",              // a course that is not a path stage
    "t1"                        // unprefixed
  );
  const p = P.buildLearningPath(noisy, IDS);
  check("only genuine course:lesson matches count", p.completedLessons === 1);
  check("unknown lesson ids do not inflate", p.stages[0].completed === 1);
  check("cross-course ids do not inflate", p.stages[1].completed === 0);
  check("percent never exceeds 100", p.percent <= 100);
  check(
    "completed never exceeds total in any stage",
    p.stages.every((s) => s.completed <= s.total)
  );
}

// --- 8. Scope honesty -----------------------------------------------------
{
  const src = fs.readFileSync(path.join(process.cwd(), "lib", "learner", "learningPath.ts"), "utf8");
  const ids = P.LEARNING_PATH_STAGES.map((s) => s.courseId);

  check("only course-tracked sections are stages",
    JSON.stringify(ids) === JSON.stringify(["tactical-thinking", "strategy", "endgames"]));
  check("untracked sections are not stages",
    !ids.includes("fundamentals") && !ids.includes("origins") && !ids.includes("openings"));
  check("every stage has a real href", P.LEARNING_PATH_STAGES.every((s) => s.href.startsWith("/academy/")));
  check("every stage has a blurb", P.LEARNING_PATH_STAGES.every((s) => s.blurb.trim().length > 0));
  check("the module does no I/O", !/fetch\(|supabase|createClient/.test(src));

  // Order is fixed, not personalized — rebuilding must not reshuffle.
  const a = P.buildLearningPath(new Set(), IDS).stages.map((s) => s.courseId).join(",");
  const b = P.buildLearningPath(done("strategy:s1"), IDS).stages.map((s) => s.courseId).join(",");
  check("stage order is stable regardless of progress", a === b);
}

// --- 9. Wiring ------------------------------------------------------------
{
  const learn = fs.readFileSync(
    path.join(process.cwd(), "app", "(tabs)", "learn", "page.tsx"),
    "utf8"
  );
  check("Learn renders the path panel", /<LearningPathPanel/.test(learn));
  check("Learn still renders NextLessonCard", /<NextLessonCard/.test(learn));
  check("Learn still renders CourseStatusChip", /<CourseStatusChip/.test(learn));
  check("Learn is still a static server page (no supabase import)",
    !/lib\/supabase\/server/.test(learn));
  check("Learn still has no 'use client'", !/^"use client"/m.test(learn));

  // One shared request: neither island may fetch the progress endpoint itself.
  const chip = fs.readFileSync(
    path.join(process.cwd(), "components", "learner", "CourseStatusChip.tsx"),
    "utf8"
  );
  const panel = fs.readFileSync(
    path.join(process.cwd(), "components", "learner", "LearningPathPanel.tsx"),
    "utf8"
  );
  check("status chip does not fetch directly", !/fetch\(/.test(chip));
  check("path panel does not fetch directly", !/fetch\(/.test(panel));
  check("both use the shared loader",
    /loadCompletedLessonIds/.test(chip) && /loadCompletedLessonIds/.test(panel));

  const shared = fs.readFileSync(
    path.join(process.cwd(), "lib", "learner", "academyProgressClient.ts"),
    "utf8"
  );
  check("the shared loader fetches exactly once", (shared.match(/fetch\(/g) || []).length === 1);
  check("the shared loader memoises the promise", /inflight/.test(shared));
  check("a failed read resolves to an empty set", /catch\(\(\) => new Set/.test(shared));
}

console.log(`\n=== LEARNING PATH: ${pass} passed, ${failures.length} failed ===`);
if (failures.length) {
  console.error("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
  process.exitCode = 1;
}

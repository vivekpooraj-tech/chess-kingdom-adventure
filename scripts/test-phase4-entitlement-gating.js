/**
 * Phase 4 — Train Your Mind limits, Learn gating, Game Review tiers, Parent
 * Mode tiers.
 *
 *   node scripts/test-phase4-entitlement-gating.js
 *
 * Pure-logic and content-boundary checks run for real; the two React-only
 * surfaces (Game Review, Parent Dashboard) are covered by wiring assertions
 * on their source, the same pattern scripts/test-chess-school.js's "Wiring"
 * section already uses in this repo — there is no DOM test harness here to
 * render them.
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

let pass = 0;
const failures = [];
const check = (n, c) => (c ? pass++ : failures.push(n));
const read = (p) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

// --- A. Train Your Mind daily limits ---------------------------------------
{
  const { DAILY_LIMITS, dailyLimitFor, isDailyLimitReached, remainingToday } = require(
    path.join(process.cwd(), "lib", "entitlement", "index.ts")
  );

  // The limit: 3 completed exercises PER CATEGORY, per child, per day (the eight Train Your Mind
  // categories are counted independently; enforced server-side by migration 0055).
  const KEY = "trainYourMindPerCategory";
  check("free limit is 3 per category per day", DAILY_LIMITS[KEY] === 3);
  check("premium has no limit", dailyLimitFor(KEY, true) === null);
  check("free has the real limit", dailyLimitFor(KEY, false) === 3);

  const limit = dailyLimitFor(KEY, false);
  check("0 uses: not reached", isDailyLimitReached(0, limit) === false);
  check("1 use: not reached", isDailyLimitReached(1, limit) === false);
  check("2 uses: not reached", isDailyLimitReached(2, limit) === false);
  check("3 uses: reached (the 3rd completion fills the limit)", isDailyLimitReached(3, limit) === true);
  check("4th attempt: still reached", isDailyLimitReached(4, limit) === true);
  check("premium never reached regardless of count", isDailyLimitReached(999, dailyLimitFor(KEY, true)) === false);
  check("remaining at 0 uses is 3", remainingToday(0, limit) === 3);
  check("remaining at 1 use is 2", remainingToday(1, limit) === 2);
  check("remaining at 3 uses is 0, not negative", remainingToday(3, limit) === 0);
  check("remaining at 4 uses clamps at 0", remainingToday(4, limit) === 0);
  check("remaining is null for premium (unlimited)", remainingToday(5, dailyLimitFor(KEY, true)) === null);

  // Wiring: every Train Your Mind surface goes through the ONE shared engine/hook — never a
  // second hardcoded limit, never a per-page counter.
  const drill = read("components/trainYourMind/TrainDrill.tsx");
  const wrapperPages = ["calculation", "mathematics", "memory", "pattern", "spatial", "visualization"];
  for (const name of wrapperPages) {
    const src = read("app/chess-mind/" + name + "/page.tsx");
    check("app/chess-mind/" + name + "/page.tsx is a thin wrapper around the shared TrainDrill", /<TrainDrill/.test(src) && !/dailyLimit/.test(src));
  }
  check("TrainDrill uses the shared daily-limit hook and records a completion", drill.includes("useTrainYourMindDailyLimit(") && drill.includes("recordCompletion(key"));
  const reaction = read("components/chessMind/ReactionTrainer.tsx");
  check("ReactionTrainer uses the shared daily-limit hook and records a completion", reaction.includes("useTrainYourMindDailyLimit(") && reaction.includes('recordCompletion(key'));
  for (const f of ["components/trainYourMind/TrainDrill.tsx", "components/chessMind/ReactionTrainer.tsx", "components/academy/CourseLessonRunner.tsx"]) {
    check(f + " has no second hardcoded daily limit", !/dailyLimitPerCategory\s*[:=]\s*\d|LIMIT\s*=\s*[23]\b/.test(read(f)));
  }
  check("Tactical Thinking records completions against its own 3-per-day limit", read("components/academy/CourseLessonRunner.tsx").includes('recordTrainYourMindCompletion(createClient(), childId, "tactical"'));

  const hookSrc = read("lib/trainYourMind/useDailyLimit.ts");
  check("the hook consumes the Phase 1 entitlement layer, not a private constant", hookSrc.includes('from "@/lib/entitlement"'));
}

// --- B. Learn gating --------------------------------------------------------
{
  const { TACTICS_LESSONS } = require(path.join(process.cwd(), "content", "tacticsLessons.ts"));
  const freeTactics = TACTICS_LESSONS.filter((l) => l.free).map((l) => l.order).sort((a, b) => a - b);
  check("Tactics: exactly orders 1-5 are free", JSON.stringify(freeTactics) === JSON.stringify([1, 2, 3, 4, 5]));
  check("Tactics 6 is locked", TACTICS_LESSONS.find((l) => l.order === 6).free === false);
  check("Tactics has 21 total lessons (unchanged content)", TACTICS_LESSONS.length === 21);

  const { OPENINGS, isOpeningFree, OPENINGS_FREE_LIMIT } = require(
    path.join(process.cwd(), "content", "openings.ts")
  );
  check("openings free limit is 4", OPENINGS_FREE_LIMIT === 4);
  check("opening 1-4 are free", [0, 1, 2, 3].every((i) => isOpeningFree(OPENINGS[i].id)));
  check("opening 5 is locked", OPENINGS.length > 4 && !isOpeningFree(OPENINGS[4].id));
  check("openings has more than 4 total (a real course, not trivially all-free)", OPENINGS.length > 4);

  const { isLessonFree, getCourse } = require(path.join(process.cwd(), "lib", "academy", "courses.server.ts"));
  check("endgames free limit is 2", isLessonFree("endgames", 1) && isLessonFree("endgames", 2));
  check("endgame lesson 3 is locked", !isLessonFree("endgames", 3));
  const endgames = getCourse("endgames");
  check("endgames has more than 2 lessons total", endgames.lessons.length > 2);
  check("strategy has no free limit (stays FULL)", isLessonFree("strategy", 999));
  check("tactical-thinking has no free limit (stays FULL)", isLessonFree("tactical-thinking", 999));

  // Server-side enforcement: a locked lesson must never leave the API route
  // as real content, only a preview.
  const apiRoute = read("app/api/academy/lesson/route.ts");
  check("the lesson API checks isLessonFree before returning content", /isLessonFree\(/.test(apiRoute));
  check("a locked lesson's response omits the real lesson", /lesson: null,[\s\S]{0,220}locked: true/.test(apiRoute));
  check("a locked response carries only a preview, not full content", /lockedPreview/.test(apiRoute));

  const runner = read("components/academy/CourseLessonRunner.tsx");
  check("the runner renders a value-forward locked panel, not bare 'Premium Required'", /What you(&apos;|')ll learn/.test(runner));
  check("the runner never renders the literal string 'Premium Required'", !/Premium Required/i.test(runner));

  const openingDetail = read("app/academy/openings/[openingId]/page.tsx");
  check("the opening detail page checks isOpeningFree", /isOpeningFree\(/.test(openingDetail));
  check("locked opening view is value-forward, not bare 'Premium Required'", /What you(&apos;|')ll learn/.test(openingDetail));
  check("opening detail never renders the literal string 'Premium Required'", !/Premium Required/i.test(openingDetail));
}

// --- C. Game Review tier presentation ---------------------------------------
{
  const src = read("components/game/analysis/PostGameAnalysis.tsx");
  check("reads Premium status via the shared hook, not a new resolver", /usePremium\(\)/.test(src));
  check("Best Moment card renders unconditionally (free)", /<BiggestMomentCard/.test(src) && !/isPremium &&[\s\S]{0,40}<BiggestMomentCard/.test(src));
  check("One Important Lesson is shown to free users", /!isPremium[\s\S]{0,320}One Important Lesson/.test(src));
  check("full accuracy is Premium-only on the summary card", /accuracy=\{isPremium \? accuracyScore : undefined\}/.test(src));
  check("the mistake-by-mistake breakdown is Premium-gated", /isPremium && mode === "analysis"/.test(src));
  check("replay-with-analysis-markers is Premium-gated", /isPremium && mode === "replay"/.test(src));
  check("free users see a value-forward upsell, not bare 'Premium Required'", /Unlock the Full Review/.test(src));
  check("never renders the literal string 'Premium Required'", !/Premium Required/i.test(src));
  check("no analysis engine import changed (still the same analyzeGame)", /analyzeGame,/.test(src));
  check("Practice Next stays available regardless of tier", !/isPremium &&[\s\S]{0,60}startPractice\(biggestMoment/.test(src));

  // Overnight V1 audit fix: BiggestMomentCard was leaking two Premium
  // deliverables (exact accuracy %, best-move alternative text) to Free via
  // client rendering the server gate can't see, since the client already
  // computed both via Stockfish. Verifies the fix without re-testing the
  // frozen server gate.
  check("PostGameAnalysis passes the canonical isPremium into BiggestMomentCard", /<BiggestMomentCard[\s\S]{0,300}isPremium=\{isPremium\}/.test(src));

  const bmc = read("components/game/analysis/BiggestMomentCard.tsx");
  check("BiggestMomentCard accepts an isPremium prop", /isPremium:\s*boolean/.test(bmc));
  check("no-mistake branch shows the exact accuracy number ONLY when Premium", /isPremium \? \(\s*<>\s*You played at/.test(bmc));
  check("no-mistake branch's Free copy has no raw percentage token", (() => {
    const freeBranchMatch = bmc.match(/\) : \(\s*<>([\s\S]{0,200}?)<\/>\s*\)/);
    return !!freeBranchMatch && !/\{accuracy\}%/.test(freeBranchMatch[1]);
  })());
  check("best-move alternative caption requires isPremium", /isPremium && mistake\.bestMove \? ` · one strong option was/.test(bmc));
  check("best-move alternative is never shown unconditionally", !/\{mistake\.bestMove \? ` · one strong option was/.test(bmc));
  check("Best Moment's core teaching fields (skill/what-to-notice/practice) are not gated by isPremium", (() => {
    // The skill block, "What to notice", and the Practice button must all
    // render outside of any `isPremium &&` guard.
    const skillBlockGated = /isPremium &&[\s\S]{0,80}Skill<\/p>/.test(bmc);
    const noticeGated = /isPremium &&[\s\S]{0,80}What to notice/.test(bmc);
    const practiceGated = /isPremium &&[\s\S]{0,80}Practice \{skill\.name\}/.test(bmc);
    return !skillBlockGated && !noticeGated && !practiceGated;
  })());
  check("BiggestMomentCard passes isPremium through to MistakeReviewStepper", /<MistakeReviewStepper[\s\S]{0,200}isPremium=\{isPremium\}/.test(bmc));

  // Launch-day QA fix: MistakeReviewStepper's "Show Better Move" / "Show me
  // the move" reveal is the same best-move-alternative deliverable the
  // caption above gates — it was reachable one tap away from BiggestMomentCard
  // ("See the position") even after that fix, since the stepper never
  // received isPremium. "Try it yourself" (attempting a move) stays
  // available to every tier — only the answer-reveal is gated.
  const stepper = read("components/game/analysis/MistakeReviewStepper.tsx");
  check("MistakeReviewStepper accepts an isPremium prop", /isPremium:\s*boolean/.test(stepper));
  check("MistakeReviewStepper's initial 'Show Better Move' button requires isPremium", /isPremium && \(\s*<Button tone="premium" variant="ghost" onClick=\{\(\) => setShowBetterMove\(true\)\}>\s*Show Better Move/.test(stepper));
  check("MistakeReviewStepper's post-attempt 'Show me the move' hint requires isPremium", /isPremium && attemptCount >= ATTEMPTS_BEFORE_HINT/.test(stepper));
  check("MistakeReviewStepper's reveal block itself requires isPremium (defense in depth)", /\{isPremium && mistake\.bestMove && showBetterMove && \(/.test(stepper));
  check("'Try it yourself' (attempting a move) is NOT gated by isPremium — stays free", !/isPremium &&[\s\S]{0,60}Try it yourself/.test(stepper));

  const mistakeCard = read("components/game/analysis/MistakeCard.tsx");
  check("MistakeCard (Premium-only 'All Mistakes' carousel) passes isPremium to the stepper", /<MistakeReviewStepper[\s\S]{0,220}isPremium\s*\/>/.test(mistakeCard));
}

// --- D. Parent Mode tier presentation ---------------------------------------
{
  const src = read("app/parent-dashboard/page.tsx");
  check("basic child profile card is never gated", !/premiumState\.isPremium[\s\S]{0,120}avatar\?\.emoji/.test(src));
  check("weekly activity counts stay free (basic progress)", /weeklySnapshot &&[\s\S]{0,40}<SecondaryCard/.test(src) && !/premiumState\.isPremium &&[\s\S]{0,40}weeklySnapshot/.test(src));
  check("achievements stay free", /<h2 className=\{TEXT\.heading\}>Achievements<\/h2>/.test(src));
  check("game insights (ChildLearningInsight) are Premium-gated", /premiumState\.isPremium \?[\s\S]{0,40}<ChildLearningInsight/.test(src));
  check("personalized next-step recommendation is Premium-gated", /premiumState\.isPremium \?[\s\S]{0,160}Suggested Next Step/.test(src));
  check("basic strengths (Strong column) show for everyone", /<SkillColumn title="Strong"/.test(src) && !/premiumState\.isPremium &&[\s\S]{0,60}title="Strong"/.test(src));
  check("detailed strengths/weaknesses (Developing + Needs practice) are Premium-gated", /premiumState\.isPremium \? \([\s\S]{0,120}title="Developing"/.test(src));
  check("Parent Lock entry point is untouched by this phase (no isPremium gate added to it)", (() => {
    const idx = src.indexOf("Parent Lock");
    const around = src.slice(Math.max(0, idx - 400), idx + 200);
    return !/premiumState\.isPremium/.test(around);
  })());
  check("free teaser is value-forward, never bare 'Premium Required'", /ParentPremiumTeaser/.test(src));
  check("never renders the literal string 'Premium Required'", !/Premium Required/i.test(src));
}

// --- E. Launch-day QA fix: /upgrade route existed as a link target in 7 ----
// places but had no page.tsx (every "Unlock/Get Premium" CTA 404'd) --------
{
  check("app/upgrade/page.tsx now exists", fs.existsSync(path.join(process.cwd(), "app", "upgrade", "page.tsx")));
  const upgradePage = read("app/upgrade/page.tsx");
  check("/upgrade renders the canonical PremiumCta (real UpgradeButton/checkout, nothing new)", /<PremiumCta/.test(upgradePage) && /from "@\/components\/premium\/PremiumCta"/.test(upgradePage));
  check("/upgrade is not registered as a primary-nav tab route (bare, like its sibling /upgrade/success)", !/"\/upgrade"/.test(read("components/nav/navConfig.tsx")));
  for (const [file, pattern] of [
    ["app/academy/openings/[openingId]/page.tsx", /href="\/upgrade"/],
    ["app/parent-dashboard/page.tsx", /href="\/upgrade"/],
    ["components/academy/CourseLessonRunner.tsx", /href="\/upgrade"/],
    ["components/game/analysis/PostGameAnalysis.tsx", /href="\/upgrade"/],
    ["components/school/v2/UnlockSchoolButton.tsx", /href="\/upgrade"/],
    ["components/trainYourMind/DailyLimitCard.tsx", /href="\/upgrade"/],
  ]) {
    check(`${file} still links to /upgrade (now a real route)`, pattern.test(read(file)));
  }
}

console.log(`\n=== PHASE 4 ENTITLEMENT/GATING: ${pass} passed, ${failures.length} failed ===`);
if (failures.length) {
  console.error("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
  process.exitCode = 1;
}

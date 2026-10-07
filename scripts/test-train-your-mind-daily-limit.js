/**
 * Train Your Chess Mind — free daily limit.
 *
 * FREE    = at most 3 completed exercises PER CATEGORY, per child, per calendar day. The eight
 *           categories (Pattern, Visualization, Calculation, Memory, Spatial, Mathematics,
 *           Reaction, Tactical Thinking) are counted INDEPENDENTLY: each has its own 3.
 * PREMIUM = unlimited.
 *
 * What this suite can and cannot prove — read this before trusting a green run:
 *  - The authoritative rule is SQL (supabase/migrations/0055_train_your_mind_global_daily_limit.sql).
 *    That migration is NOT applied anywhere yet, so the SQL cannot be executed. The scenario matrix
 *    below drives lib/trainYourMind/dailyLimitRules.ts — the same rule written line-for-line as a
 *    reference model — and then pins the SQL to that model with structural assertions (the literal 3,
 *    the per-module scoping, the >= comparison, the advisory lock, the duplicate-key path, the date
 *    clamp, the module list, privileges). scripts/test-train-your-mind-daily-limit-db.js runs the
 *    same matrix against the real functions and is meant to be run right after the migration is
 *    approved and applied.
 *  - Route / UI enforcement points are checked statically against the source.
 *
 *   node scripts/test-train-your-mind-daily-limit.js
 */
const fs = require("fs");
const path = require("path");
const cp = require("child_process");
const ts = require(path.join(process.cwd(), "node_modules", "typescript"));
const Module = require("module");
const orig = Module._resolveFilename;
Module._resolveFilename = function (r, ...rest) { if (r.startsWith("@/")) r = path.join(process.cwd(), r.slice(2)); return orig.call(this, r, ...rest); };
require.extensions[".ts"] = function (m, f) { m._compile(ts.transpileModule(fs.readFileSync(f, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }, fileName: f }).outputText, f); };
const ROOT = process.cwd();
const R = (p) => require(path.join(ROOT, p));
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const rules = R("lib/trainYourMind/dailyLimitRules.ts");
const limits = R("lib/entitlement/dailyLimits.ts");
let pass = 0; const fails = [];
const check = (n, ok, d) => { if (ok) pass++; else { fails.push(n + (d ? " -- " + d : "")); console.log("FAIL:", n, d || ""); } };

const NOW = new Date("2026-10-05T12:00:00Z");
const TODAY = "2026-10-05";
const TOMORROW = "2026-10-06";
const MODS = rules.TRAIN_MODULES;
let seq = 0;
const key = () => "k" + String(++seq).padStart(10, "0");

/** A tiny "world": one shared server ledger, many devices/sessions. Nothing client-side is shared. */
function world() {
  const rows = [];
  const api = {
    rows,
    now: NOW,
    complete(child, module, opts = {}) {
      return rules.recordCompletion(rows, { childId: child, module, key: opts.key ?? key(), requestedDate: opts.date ?? TODAY, isPremium: !!opts.premium, nowUtc: opts.now ?? api.now });
    },
    usage(child, module, opts = {}) { return rules.getUsage(rows, { childId: child, module, requestedDate: opts.date ?? TODAY, isPremium: !!opts.premium, nowUtc: opts.now ?? api.now }); },
    /** Serving an exercise (or prefetching one, or opening a page) only READS the count. */
    serve(child, module, opts = {}) { return rules.mayServe(!!opts.premium, api.usage(child, module, opts).usedToday); },
  };
  return api;
}

console.log("\n=== A. The product rule: 3 per category, eight independent categories ===");
check("DAILY_LIMITS.trainYourMindPerCategory is 3", limits.DAILY_LIMITS.trainYourMindPerCategory === 3);
check("there is no second, per-day / global limit key", !("trainYourMindPerDay" in limits.DAILY_LIMITS));
check("the rules module uses that same constant", rules.FREE_DAILY_COMPLETIONS === limits.DAILY_LIMITS.trainYourMindPerCategory);
check("all eight categories are tracked, including Tactical Thinking", MODS.length === 8 && ["pattern", "visualization", "calculation", "memory", "spatial", "mathematics", "reaction", "tactical"].every((m) => MODS.includes(m)));

console.log("\n=== B. Each category: 0/3 -> 1/3 -> 2/3 -> 3/3 -> 4th rejected ===");
for (const m of MODS) {
  const w = world();
  const u0 = w.usage("kid", m);
  const r1 = w.complete("kid", m), r2 = w.complete("kid", m), r3 = w.complete("kid", m), r4 = w.complete("kid", m);
  check(`${m}: starts at 0/3, completions go 1/3, 2/3, 3/3, and the 4th is rejected`,
    u0.usedToday === 0 && u0.remaining === 3 && u0.limit === 3 && !u0.reached &&
    r1.allowed && r1.usedToday === 1 && r1.remaining === 2 &&
    r2.allowed && r2.usedToday === 2 && r2.remaining === 1 &&
    r3.allowed && r3.usedToday === 3 && r3.remaining === 0 &&
    !r4.allowed && r4.usedToday === 3 && r4.remaining === 0, JSON.stringify([r1, r2, r3, r4]));
  check(`${m}: at 3/3 nothing more is SERVED in ${m}, and the rejected completion was not recorded`, w.usage("kid", m).reached && !w.serve("kid", m) && w.rows.length === 3);
}

console.log("\n=== C. The categories are independent (each keeps its own 3) ===");
{
  const w = world();
  for (let i = 0; i < 3; i++) w.complete("kid", "pattern");
  check("3/3 in Pattern does NOT lock the other seven categories", MODS.filter((m) => m !== "pattern").every((m) => w.serve("kid", m) && w.usage("kid", m).usedToday === 0));
  check("Pattern itself is locked", !w.serve("kid", "pattern"));
  const total = MODS.reduce((n, m) => n + [0, 1, 2, 3, 4].filter(() => w.complete("kid", m).allowed).length, 0);
  check("a free child can complete 3 in EACH category: 3 more in each of the other seven (21) + 0 more in Pattern", total === 21, String(total));
  const w2 = world();
  let all = 0;
  for (let round = 0; round < 4; round++) for (const m of MODS) if (w2.complete("kid", m).allowed) all++;
  check("8 categories x 3 = 24 completions in total, never 3 in total and never more than 3 in one", all === 24 && MODS.every((m) => w2.usage("kid", m).usedToday === 3), String(all));
}

console.log("\n=== D. Switching categories cannot bypass a category's limit ===");
for (const order of [
  ["pattern", "calculation", "pattern", "tactical", "pattern", "pattern"],
  ["tactical", "pattern", "tactical", "memory", "tactical", "tactical"],
  ["reaction", "spatial", "reaction", "reaction", "mathematics", "reaction"],
]) {
  const w = world();
  const results = order.map((m) => ({ m, r: w.complete("kid", m) }));
  const byCat = {};
  for (const { m, r } of results) byCat[m] = (byCat[m] || 0) + (r.allowed ? 1 : 0);
  check(`${order.join(" -> ")}: no category ever exceeds 3`, Object.values(byCat).every((n) => n <= 3) && MODS.every((m) => w.usage("kid", m).usedToday <= 3), JSON.stringify(byCat));
}
{
  const w = world();
  w.complete("kid", "pattern"); w.complete("kid", "calculation"); w.complete("kid", "pattern"); w.complete("kid", "tactical"); w.complete("kid", "pattern");
  check("Pattern -> Calculation -> Pattern -> Tactical -> Pattern: Pattern is now 3/3, Calculation 1/3, Tactical 1/3", w.usage("kid", "pattern").reached && w.usage("kid", "calculation").usedToday === 1 && w.usage("kid", "tactical").usedToday === 1);
  check("…and a 4th Pattern is rejected while Calculation and Tactical still work", !w.complete("kid", "pattern").allowed && w.complete("kid", "calculation").allowed && w.complete("kid", "tactical").allowed);
}

console.log("\n=== E. Tactical Thinking (the QA-observed bypass) ===");
{
  const w = world();
  let n = 0;
  for (let i = 0; i < 12; i++) if (w.complete("kid", "tactical").allowed) n++;
  check("12 Tactical Thinking exercises in a row: only 3 are allowed (QA saw 10+ before)", n === 3, String(n));
  check("Tactical at 3/3 leaves every other category open", MODS.filter((m) => m !== "tactical").every((m) => w.serve("kid", m)));
  const w2 = world();
  for (let i = 0; i < 3; i++) w2.complete("kid", "pattern");
  check("Tactical has its own 3 even after Pattern is used up", [1, 2, 3].every(() => w2.complete("kid", "tactical").allowed) && !w2.complete("kid", "tactical").allowed);
  const lesson = read("app/api/academy/lesson/route.ts");
  const runner = read("components/academy/CourseLessonRunner.tsx");
  check("the Tactical Thinking lesson route reads the Tactical usage server-side BEFORE it returns any lesson", /courseId === TRAIN_YOUR_MIND_COURSE/.test(lesson) && /readServeGate\(/.test(lesson) && /"tactical"/.test(lesson) && lesson.indexOf("readServeGate(") < lesson.lastIndexOf("return NextResponse.json("));
  check("only the Tactical Thinking course is gated (other Academy courses unaffected)", /const TRAIN_YOUR_MIND_COURSE = "tactical-thinking"/.test(lesson) && !/trainYourMind/.test(read("components/academy/CourseIndex.tsx")));
  check("the lesson route skips the check for Premium", /if \(!resolvePremiumState\(parentRow\)\.isPremium\)/.test(lesson));
  check("a free child over the limit gets NO lesson content (lesson: null + dailyLimit)", /lesson: null,[\s\S]{0,200}dailyLimit: \{ used: gate\.used, limit: gate\.limit \}/.test(lesson));
  check("the runner records each Tactical practice exercise as one 'tactical' completion", /sharesDailyLimit = courseId === "tactical-thinking"/.test(runner) && /recordTrainYourMindCompletion\(createClient\(\), childId, "tactical", key, exerciseId\)/.test(runner));
  check("the Tactical completion key is per exercise, so retries and duplicate moves count once", /completionKeys\.current\[index\] \?\?= newCompletionKey\(\)/.test(runner));
  check("the runner shows the limit state, never serving the next exercise, once 3/3", /limitReached \? \(\s*<DailyLimitNotice categoryLabel="Tactical Thinking" \/>/.test(runner) && /data\?\.dailyLimit \|\| limitRefused/.test(runner));
}

console.log("\n=== F. Persistence: refresh, new browser, another device ===");
{
  const w = world();
  for (let i = 0; i < 3; i++) w.complete("kid", "reaction");
  for (const device of ["refreshed tab", "new browser session", "second phone", "tablet"]) {
    check(`${device} still sees Reaction at 3/3 and cannot complete a 4th`, w.usage("kid", "reaction").usedToday === 3 && !w.complete("kid", "reaction").allowed);
  }
  const strip = (f) => code(f).split("\n").filter((l) => !/BEST_KEY/.test(l)).join("\n");
  const src = ["lib/trainYourMind/dailyUsage.ts", "lib/trainYourMind/useDailyLimit.ts", "lib/trainYourMind/dailyLimitServer.ts", "components/trainYourMind/TrainDrill.tsx", "components/chessMind/ReactionTrainer.tsx"].map(strip).join("\n");
  check("no localStorage / sessionStorage / cookie counter anywhere in the limit path (Reaction's personal-best time is a display convenience, not a counter)", !/localStorage|sessionStorage|document\.cookie/.test(src));
}

console.log("\n=== G. Prefetch / loading / duplicates ===");
{
  const w = world();
  w.complete("kid", "pattern");
  for (let i = 0; i < 25; i++) w.serve("kid", "pattern");
  check("serving, loading and prefetching never consume a slot", w.usage("kid", "pattern").usedToday === 1);
  const k = key();
  const a = w.complete("kid", "calculation", { key: k });
  const b = w.complete("kid", "calculation", { key: k });
  const c = w.complete("kid", "calculation", { key: k });
  check("the same completion sent three times consumes exactly ONE slot", a.allowed && !a.duplicate && b.allowed && b.duplicate && c.duplicate && w.usage("kid", "calculation").usedToday === 1);
  check("a duplicate request never trips the limit even at 3/3", (() => { const w2 = world(); const kk = key(); w2.complete("kid", "pattern"); w2.complete("kid", "pattern"); w2.complete("kid", "pattern", { key: kk }); const again = w2.complete("kid", "pattern", { key: kk }); return again.allowed && again.duplicate && w2.usage("kid", "pattern").usedToday === 3; })());
  const drill = read("components/trainYourMind/TrainDrill.tsx");
  const react = read("components/chessMind/ReactionTrainer.tsx");
  check("TrainDrill mints ONE completion key per presented exercise", /completionKey\.current = newCompletionKey\(\)/.test(drill));
  check("Reaction mints ONE completion key per presented exercise", /completionKey\.current = newCompletionKey\(\)/.test(react));
  check("nothing is prefetched at the last free slot (a 4th exercise is never loaded in the background)", /remaining \?\? 0\) <= 0\) return;/.test(drill) && /remaining \?\? 0\) <= 0\) return;/.test(react));
  check("the completion is recorded when the exercise is ANSWERED, not when it is loaded", /function finish\(/.test(drill) && drill.indexOf("recordCompletion(key") > drill.indexOf("function finish(") && !/recordCompletion/.test(drill.slice(drill.indexOf("const present = useCallback"), drill.indexOf("// First exercise"))));
  check("a WRONG answer also completes the exercise (otherwise wrong answers would be unlimited)", !/if \(correct\)[^{]*\{[^}]*recordCompletion/.test(drill));
}

console.log("\n=== H. Siblings, days and Premium ===");
{
  const w = world();
  for (const m of ["pattern", "pattern", "pattern"]) w.complete("kid-a", m);
  check("a sibling is limited independently (kid-b still has all 3 in Pattern)", w.usage("kid-b", "pattern").usedToday === 0 && [1, 2, 3].every(() => w.complete("kid-b", "pattern").allowed));
  check("the first child's Pattern stays locked while the sibling plays", !w.complete("kid-a", "pattern").allowed);

  const next = new Date("2026-10-06T12:00:00Z");
  check("a new day resets every category (same mechanism as the rest of the app: the local calendar date)", (() => { const w2 = world(); for (const m of ["pattern", "tactical"]) for (let i = 0; i < 3; i++) w2.complete("kid", m); return !w2.complete("kid", "pattern").allowed && w2.complete("kid", "pattern", { date: TOMORROW, now: next }).allowed && w2.complete("kid", "tactical", { date: TOMORROW, now: next }).allowed && w2.usage("kid", "pattern", { date: TOMORROW, now: next }).usedToday === 1; })());

  const w3 = world();
  for (let i = 0; i < 3; i++) w3.complete("kid", "pattern");
  check("requesting a FAR-future date is clamped to UTC-tomorrow (cannot open arbitrary buckets)", rules.effectiveDate(w3.rows, "kid", "2030-01-01", NOW) === TOMORROW);
  check("requesting an old date cannot reopen yesterday's quota (clamped to the latest day used)", rules.effectiveDate(w3.rows, "kid", "2020-01-01", NOW) === TODAY && !w3.complete("kid", "pattern", { date: "2020-01-01" }).allowed);
  check("known, bounded limitation: a forward date shift opens the NEXT day's bucket early", w3.complete("kid", "pattern", { date: TOMORROW }).allowed);
  check("…but the shift is one-way: going back to today is clamped to that later bucket, so alternating dates mints nothing", (() => { for (let i = 0; i < 2; i++) w3.complete("kid", "pattern", { date: TOMORROW }); return !w3.complete("kid", "pattern", { date: TODAY }).allowed && !w3.complete("kid", "pattern", { date: TOMORROW }).allowed; })());

  const wp = world();
  for (let i = 0; i < 3; i++) wp.complete("kid", "pattern"); // consumed while free
  const prem = [];
  for (let i = 0; i < 20; i++) prem.push(wp.complete("kid", MODS[i % 8], { premium: true }));
  check("a Premium child is unlimited in every category (20 more after the free slots were used)", prem.every((r) => r.allowed) && prem.every((r) => r.remaining === null));
  check("Premium is never reported as 'reached', even with many completions recorded", MODS.every((m) => !wp.usage("kid", m, { premium: true }).reached && wp.usage("kid", m, { premium: true }).limit === null));
  check("Premium is always allowed to be served an exercise", MODS.every((m) => wp.serve("kid", m, { premium: true })));
  check("a fresh Premium child is not blocked by the free counter", MODS.every((m) => Array.from({ length: 10 }, () => world().complete("kid", m, { premium: true })).every((r) => r.allowed)));
  check("an expired-Premium (now free) child is limited again from the ledger's real per-category count", !wp.complete("kid", "pattern").allowed);
  check("invalid modules and keys are refused", (() => { let a = false, b = false; try { world().complete("kid", "nonsense"); } catch { a = true; } try { world().complete("kid", "pattern", { key: "x" }); } catch { b = true; } return a && b; })());
  check("parseClientDate accepts real dates and rejects junk", rules.parseClientDate("2026-10-05") === "2026-10-05" && rules.parseClientDate("2026-13-40") === null && rules.parseClientDate("tomorrow") === null && rules.parseClientDate(null) === null);
}

console.log("\n=== I. Server-side enforcement points (static) ===");
{
  const route = read("app/api/chess-mind/train/route.ts");
  const premiumIdx = route.indexOf("resolvePremiumState(parent).isPremium");
  const gateIdx = route.indexOf("readServeGate(");
  const lockIdx = route.indexOf("isLevelAllowed(level, isPremium)");
  const pickIdx = route.indexOf("pickExercise(");
  check("the train route resolves Premium, THEN reads the category's usage, THEN the level lock, THEN picks an exercise", premiumIdx > 0 && gateIdx > premiumIdx && lockIdx > gateIdx && pickIdx > lockIdx);
  check("the train route only checks the limit for FREE accounts", /if \(!isPremium\) \{\s*const gate = await readServeGate/.test(route));
  check("the train route checks the usage of the category being requested", /readServeGate\(supabase, resolution\.child\.id, category, url\.searchParams\.get\("d"\)\)/.test(route));
  check("a free child at the limit receives NO exercise: { exercise: null, dailyLimit }", /gate && !gate\.allowed\) return none\(\{ exercise: null, dailyLimit/.test(route));
  const server = code("lib/trainYourMind/dailyLimitServer.ts");
  check("the gate reads the count from the database RPC under the caller's session and picks the requested module's row", /get_train_your_mind_usage/.test(server) && /r\.module_id === module/.test(server));
  check("the count is never taken from a request parameter (only the client's DATE is)", !/searchParams\.get\("used"\)|searchParams\.get\("count"\)/.test(route));
  check("both serve routes pass the client's local date to the gate", /url\.searchParams\.get\("d"\)/.test(route) && /url\.searchParams\.get\("d"\)/.test(read("app/api/academy/lesson/route.ts")));
  check("the client sends its local calendar date on every serve request", /d: localDateString\(\)/.test(read("components/trainYourMind/TrainDrill.tsx")) && /d: localDateString\(\)/.test(read("components/chessMind/ReactionTrainer.tsx")) && /localDateString\(\)\)\}/.test(read("components/academy/CourseLessonRunner.tsx")));
  check("the completion RPC call passes the same local date", /p_activity_date: localDateString\(\)/.test(read("lib/trainYourMind/dailyUsage.ts")));
  check("fail-open only on an unreachable RPC (null), never on a normal 'limit reached' answer", /return null;/.test(read("lib/trainYourMind/dailyLimitServer.ts")) && /if \(gate && !gate\.allowed\)/.test(route));

  const sql = read("supabase/migrations/0055_train_your_mind_global_daily_limit.sql");
  const sqlCode = sql.replace(/^--.*$/gm, "");
  check("SQL: the free limit literal is 3 and uses >= (matches DAILY_LIMITS.trainYourMindPerCategory)", /v_used >= 3/.test(sqlCode) && (sqlCode.match(/3 - (v_used|coalesce\(u\.n, 0\))/g) || []).length >= 3 && limits.DAILY_LIMITS.trainYourMindPerCategory === 3);
  check("SQL: the count is PER CATEGORY — the completion RPC counts only the requested module", /where c\.child_id = p_child_id and c\.activity_date = v_date and c\.module_id = p_module_id/.test(sqlCode));
  check("SQL: the usage RPC returns one row per category (all eight), grouped by module", /group by c\.module_id/.test(sqlCode) && /unnest\(array\['pattern', 'visualization', 'calculation', 'memory', 'spatial', 'mathematics', 'reaction', 'tactical'\]\)/.test(sqlCode));
  check("SQL: the module list equals the app's TRAIN_MODULES (incl. 'tactical')", (() => { const m = sqlCode.match(/in \(('pattern'[^)]*)\)/); if (!m) return false; const list = m[1].split(",").map((x) => x.trim().replace(/'/g, "")); return list.length === MODS.length && MODS.every((x) => list.includes(x)); })());
  check("SQL: one row per completion; the key is the primary key with the child (idempotent, date-independent)", /primary key \(child_id, completion_key\)/.test(sqlCode));
  check("SQL: duplicate keys return duplicate=true and consume nothing", /return query select true, true, v_used/.test(sqlCode));
  check("SQL: a per-child advisory lock serialises concurrent completions (two devices cannot both slip under the cap)", /pg_advisory_xact_lock\(hashtextextended\('tym:' \|\| p_child_id::text, 0\)\)/.test(sqlCode));
  check("SQL: free completions beyond 3 are refused without inserting", /if not v_is_premium and v_used >= 3 then\s*return query select false, false, v_used, 0, false;\s*return;/.test(sqlCode));
  check("SQL: Premium is decided by the existing parent_is_premium(), not re-derived", /parent_is_premium\(v_parent_id\)/.test(sqlCode) && !/premium_status\s*=\s*'premium'/.test(sqlCode));
  check("SQL: ownership comes from auth.uid() (a caller cannot read or write another family's child)", (sqlCode.match(/p\.auth_user_id = auth\.uid\(\)/g) || []).length >= 3 && (sqlCode.match(/not authorized for this child/g) || []).length === 2);
  check("SQL: the day bucket is clamped (>= latest day used, >= UTC-yesterday, <= UTC-tomorrow)", /greatest\(/.test(sqlCode) && /::date - 1/.test(sqlCode) && /::date \+ 1/.test(sqlCode) && /max\(c\.activity_date\)/.test(sqlCode));
  check("SQL: RLS select-only for the parent; all table privileges revoked and only SELECT re-granted", /enable row level security/.test(sqlCode) && !/for (insert|update|delete|all)\b/i.test(sqlCode) && /revoke all on public\.child_train_your_mind_completions from public, anon, authenticated/.test(sqlCode) && /grant select on public\.child_train_your_mind_completions to authenticated/.test(sqlCode));
  check("SQL: both RPCs are SECURITY DEFINER with a pinned search_path and granted only to authenticated", (sqlCode.match(/security definer set search_path = public, pg_temp/g) || []).length === 2 && /revoke all on function public\.record_train_your_mind_completion\([^)]*\) from public, anon/.test(sqlCode) && /grant execute on function public\.get_train_your_mind_usage\(uuid, date\) to authenticated/.test(sqlCode));
  check("SQL: purely additive — no drop/alter of any existing object", !/^\s*drop /im.test(sqlCode) && [...sqlCode.matchAll(/alter table ([\w.]+)/gi)].every((m) => m[1] === "public.child_train_your_mind_completions"));
  check("0044/0050 (old per-category RPC) are byte-identical to HEAD and 0053/0054 are untouched by this change", cp.spawnSync("git", ["diff", "--quiet", "HEAD", "--", "supabase/migrations/0044_train_your_mind_daily_usage.sql", "supabase/migrations/0050_train_your_mind_limit_3.sql"], { cwd: ROOT }).status === 0 && !/completions/.test(read("supabase/migrations/0054_train_your_mind_progress.sql")) && !/completions/.test(read("supabase/migrations/0053_train_your_mind_exercise_history.sql")));
  check("migration number follows 0054", fs.existsSync(path.join(ROOT, "supabase/migrations/0054_train_your_mind_progress.sql")) && !fs.readdirSync(path.join(ROOT, "supabase/migrations")).some((f) => /^005[6-9]/.test(f)));
}

console.log("\n=== J. UI behaviour at 3/3 in a category ===");
{
  const card = read("components/trainYourMind/DailyLimitCard.tsx");
  const drill = read("components/trainYourMind/TrainDrill.tsx");
  const react = read("components/chessMind/ReactionTrainer.tsx");
  // The hub: the page (data) plus TrainBody (the per-world presentation of the same values).
  const hub = read("app/chess-mind/page.tsx") + read("components/trainYourMind/TrainBody.tsx");
  // The card is a .tsx component; evaluate just its two message builders from source.
  const FREE_DAILY_COMPLETIONS = rules.FREE_DAILY_COMPLETIONS;
  const titleSrc = card.match(/export const limitTitle = ([^\n]*);/)[1];
  const bodySrc = card.match(/export const limitBody = \(categoryLabel: string\) =>\s*([^\n]*);/)[1];
  const dl = { limitTitle: eval(titleSrc.replace(": string", "")), limitBody: eval("(categoryLabel) => " + bodySrc) };
  check("the limit message names the category: Today's free <category> training is complete.", /Today's free \$\{categoryLabel\} training is complete\./.test(card));
  check("the body says to come back tomorrow for 3 more <category> exercises or unlock Premium for unlimited training", /Come back tomorrow for \$\{FREE_DAILY_COMPLETIONS\} more \$\{categoryLabel\} exercises, or unlock Premium for unlimited Train Your Mind training\./.test(card) && rules.FREE_DAILY_COMPLETIONS === 3);
  check("the 3rd exercise keeps its result and explanation (the full-screen limit is NOT shown while an answered exercise is on screen)", /dailyLimit\.reached && phase !== "answered"/.test(drill) && /status !== "correct" && status !== "wrong"/.test(react));
  check("after the 3rd exercise a limit notice replaces the Next button (the 4th never starts)", /dailyLimit\.reached \? \(\s*<DailyLimitNotice categoryLabel=\{title\} \/>/.test(drill) && /dailyLimit\.reached \? \(\s*<DailyLimitNotice categoryLabel="Reaction" \/>/.test(react));
  check("opening a category at 3/3 shows the limit state instead of serving an exercise", /phase === "limit"/.test(drill) && /resp\?\.dailyLimit/.test(drill) && /resp\?\.dailyLimit/.test(react) && /setLimitState\(true\)/.test(react));
  check("the server refusing a completion also switches to the limit state", /setRefused\(true\)/.test(drill) && /setLimitState\(true\)/.test(react));
  check("the hook is per category: it reads and records for the module it is given", /useTrainYourMindDailyLimit\(childId: string \| null, moduleId: TrainModule\)/.test(read("lib/trainYourMind/useDailyLimit.ts")) && /useTrainYourMindDailyLimit\(child\.childId, category\)/.test(drill) && /useTrainYourMindDailyLimit\(child\.childId, "reaction"\)/.test(react));
  check("the hub shows 'n / 3 today' on EVERY category row, including Tactical Thinking, from the server's counts", /usage: p\.usage\?\.\[cat\.id as TrainModule\] \?\? null/.test(hub) && /<UsageLine usage=\{usage\}/.test(hub) && /getTrainYourMindUsageAll/.test(hub) && /\/ \{usage\.limit\} today/.test(hub));
  check("the hub states the rule: 3 exercises per category, every day", /Free training: 3 exercises per category, every day\./.test(hub));
  check("the per-page indicator reads 'N / 3 today' and hides for Premium and before the first completion", /\/ \{limit\} today/.test(read("components/trainYourMind/DailyUsageIndicator.tsx")) && /isPremium \|\| limit === null/.test(read("components/trainYourMind/DailyUsageIndicator.tsx")));
  check("no database/RPC details appear in any learner-facing text", !/rpc|supabase|migration|advisory/i.test(card.replace(/import[^\n]*\n/g, "")));
  check("the limit text is generated per category label (each category gets its own message)", dl.limitTitle("Calculation") === "Today's free Calculation training is complete." && dl.limitBody("Memory").includes("3 more Memory exercises") && dl.limitTitle("Tactical Thinking").includes("Tactical Thinking"));
  check("Premium is unaffected in the UI: the limit state requires a FREE, server-confirmed 3/3", /isDailyLimitReached\(usedToday, limit\)/.test(code("lib/trainYourMind/useDailyLimit.ts")) && /dailyLimitFor\("trainYourMindPerCategory", isPremium\)/.test(code("lib/trainYourMind/useDailyLimit.ts")));
}

console.log("\n=== K. Scope guard ===");
{
  check("Phase 1 exercise history is untouched (still recorded when an exercise is PRESENTED)", /recordExerciseSeen\(createClient\(\), child\.childId, category, ex\.id\)/.test(read("components/trainYourMind/TrainDrill.tsx")) && /recordExerciseSeen\(createClient\(\), child\.childId, "reaction", next\.id\)/.test(read("components/chessMind/ReactionTrainer.tsx")));
  check("pricing, Stripe and entitlement files are untouched by this change", cp.spawnSync("git", ["diff", "--quiet", "HEAD", "--", "lib/premium", "app/api/stripe", "lib/entitlement/index.ts", "lib/school"], { cwd: ROOT }).status === 0);
  check("progression is untouched", fs.existsSync(path.join(ROOT, "lib/trainYourMind/progression.ts")) && !/dailyLimit|recordCompletion/.test(read("lib/trainYourMind/progression.ts")));
}

console.log(`\n${pass} checks passed, ${fails.length} failed`);
if (fails.length) { console.log(fails.map((f) => " - " + f).join("\n")); process.exit(1); }

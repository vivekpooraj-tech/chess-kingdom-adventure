/**
 * Master Training Atelier — Training Academy (/learn): a presentation branch over the SAME data, with
 * Enchanted Kingdom and Classic Pro left as they were.
 *   node scripts/test-atelier-learn.js
 */
const fs = require("fs");
const path = require("path");
const ts = require(path.join(process.cwd(), "node_modules", "typescript"));
const Module = require("module");
const orig = Module._resolveFilename;
Module._resolveFilename = function (r, ...rest) { if (r.startsWith("@/")) r = path.join(process.cwd(), r.slice(2)); return orig.call(this, r, ...rest); };
require.extensions[".ts"] = function (m, f) { m._compile(ts.transpileModule(fs.readFileSync(f, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: f }).outputText, f); };
const ROOT = process.cwd();
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");
let pass = 0; const fails = [];
const check = (n, ok, d) => { if (ok) pass++; else { fails.push(n + (d ? " -- " + d : "")); console.log("FAIL:", n, d || ""); } };

const page = read("app/(tabs)/learn/page.tsx");
const branch = read("components/layout/AtelierBranch.tsx");
const learn = read("components/learn/atelier/AtelierLearn.tsx");
const prog = read("components/learn/atelier/AtelierProgramme.tsx");
const next = read("components/learner/NextLessonCard.tsx");
const chip = read("components/learner/CourseStatusChip.tsx");
const css = read("app/worlds.css");
const ta = css.slice(css.indexOf('html[data-mode="kids"] .world-branch--ta-atelier'));

// --- Architecture: one page, a presentation branch, shared data.
check("Learn mounts the Atelier layout through AtelierBranch", /<AtelierBranch atelier=\{<AtelierLearn lessonIdsByCourse=\{courseLessonIds\} \/>\}>/.test(page));
check("the shared page content is the branch's children (Enchanted / Classic keep it)", /<AtelierBranch atelier=\{[^\n]*\}>[\s\S]*?<div>\s*<h1 className=\{TEXT\.display\}>Learn<\/h1>/.test(page) && /<\/AtelierBranch>/.test(page));
check("shared islands are still on the shared page", ["<NextLessonCard />", "<LearningPathPanel", "<ForParentsEntry />", "<CourseStatusChip"].every((s) => page.includes(s)));
check("the shared page still resolves lesson ids with getCourse (no content leaves the server)", /getCourse\(id\)/.test(page) && /course\.lessons\.map\(\(l\) => l\.id\)/.test(page));
check("the Learn page is NOT wrapped in WorldScope (other worlds are not repainted)", !/WorldScope/.test(page));
check("section list lives in one module read by both presentations", /from "@\/content\/learnIndex"/.test(page) && /from "@\/content\/learnIndex"/.test(learn) && !/const LEARN_CHESS = \[/.test(page));

const idx = require(path.join(ROOT, "content/learnIndex.ts"));
check("the six Academy sections and their routes are unchanged", JSON.stringify(idx.LEARN_CHESS.map((i) => [i.id, i.href])) === JSON.stringify([
  ["fundamentals", "/academy/fundamentals"], ["origins", "/academy/origins"], ["tactics", "/academy/tactics"],
  ["openings", "/academy/openings"], ["strategy", "/academy/strategy"], ["endgames", "/academy/endgames"]]));
check("only the course-tracked sections carry a courseId", idx.LEARN_CHESS.filter((i) => i.courseId).map((i) => i.id).join() === "strategy,endgames");

// --- The branch.
const worlds = require(path.join(ROOT, "lib/world/worlds.ts"));
check("branch reads the mode through worldFromMode (adult is Atelier)", /worldFromMode\(document\.documentElement\.getAttribute\("data-mode"\)\) === "atelier"/.test(branch) && worlds.worldFromMode("adult") === "atelier" && worlds.worldFromMode("kids") === "enchanted" && worlds.worldFromMode(null) === "classic");
check("both trees are server-rendered, then the wrong one is dropped", /isAtelier === true \? null : children/.test(branch) && /isAtelier === false \? null : atelier/.test(branch));
check("pre-paint CSS hides the Atelier tree outside adult mode and the shared tree in adult mode",
  /html\[data-mode="kids"\] \.world-branch--ta-atelier,\nhtml:not\(\[data-mode="kids"\]\):not\(\[data-mode="adult"\]\) \.world-branch--ta-atelier,\nhtml\[data-mode="adult"\] \.world-branch--ta-rest \{\n  display: none;/.test(css));
check("Atelier islands only fetch while the Atelier tree is the visible one", /useAtelierBranchActive\(\)/.test(prog) && /if \(!active\) return;/.test(prog) && /if \(!active\) return;/.test(next));
check("default context is active, so the shared page's islands are unchanged", /createContext\(true\)/.test(branch));

// --- Shared components: variants are additive.
check("NextLessonCard keeps its default markup and rule", /variant = "default"/.test(next) && /rounded-premiumCard border border-premium-gold\/25 bg-premium-navy p-5/.test(next) && /Recommended for you/.test(next));
check("Atelier variant is the same recommendation (same endpoint, same copy)", (next.match(/fetch\("\/api\/learn\/next-lesson"\)/g) || []).length === 1 && /has come up in \{rec\.weakCount\} of your reviewed games/.test(next));
check("concurrent mounts share ONE in-flight request, and it is dropped when it settles (nothing cached)", /if \(!inflight\) \{/.test(next) && /inflight\.then\(clear, clear\)/.test(next) && /inflight = null;/.test(next) && /loadNextLesson\(\)\.then/.test(next));
check("NextLessonCard still renders nothing without a real recommendation", /if \(!rec\) return null;/.test(next));
check("CourseStatusChip keeps its label rules and default styling", /done === 0 \? "Start" : done >= total \? "Mastered"/.test(chip) && /border-premium-gold\/50 text-premium-gold bg-premium-gold\/10/.test(chip));

// --- Honest data: nothing invented.
const lp = require(path.join(ROOT, "lib/learner/learningPath.ts"));
const lessons = { "tactical-thinking": ["a", "b", "c", "d"], strategy: ["a", "b", "c", "d", "e"], endgames: ["a", "b", "c", "d", "e", "f"] };
const none = lp.buildLearningPath(new Set(), lessons);
check("programme starts at Tactical Thinking, stage 'current', with real totals", none.currentCourseId === "tactical-thinking" && none.totalLessons === 15 && none.completedLessons === 0);
const some = lp.buildLearningPath(new Set(["tactical-thinking:a", "endgames:a"]), lessons);
check("programme counts only completed lessons", some.completedLessons === 2 && some.stages.find((s) => s.courseId === "endgames").completed === 1);
check("programme reads the shared learning path and shared request", /buildLearningPath\(completed, lessonIdsByCourse\)/.test(prog) && /loadCompletedLessonIds\(\)/.test(prog) && /LEARNING_PATH_STAGES/.test(prog));
check("with no data the programme shows order only (no numbers, neutral CTA)", /\? "Open programme"/.test(prog) && /\{currentStage \? \(/.test(prog) && /\{path && path\.stages\[i\] \? \(/.test(prog) && /\{path \? <p className="ta-programme__total">/.test(prog));
check("no hard-coded progress figures in the Atelier components", !/\b\d+ of \d+|\d+%|\b\d+ \/ \d+/.test((learn + prog).replace(/30 sessions with Ollie/g, "")));
check("every curriculum row comes from existing content (no invented courses)", /item\("fundamentals"\)/.test(learn) && /item\("tactics"\)/.test(learn) && /item\("strategy"\), item\("endgames"\)/.test(learn) && /item\("openings"\)/.test(learn) && /CHESS_MIND_CATEGORIES/.test(learn));
check("Tactical Thinking is listed once (curriculum), the other Chess Mind categories in performance training", /c\.id !== "tactical"/.test(learn));
check("For Parents entry is the shared age-aware component", /<ForParentsEntry \/>/.test(learn));
check("no emoji in the Atelier presentation (not childish)", !/\p{Extended_Pictographic}/u.test(learn + prog));

// --- Visual system.
check("uses the approved palette", ["--ta-graphite: 17 16 15", "--ta-surface: 25 23 22", "--ta-plum: 41 21 34", "--ta-oxblood: 90 31 45", "--ta-chart: 199 240 0", "--ta-ivory: 244 239 230", "--ta-stone: 184 176 165", "--ta-copper: 184 115 74"].every((v) => ta.includes(v)));
check("no blue / navy / cyan / sapphire in the Academy CSS", !/(blue|navy|cyan|sapphire|azure|indigo)/i.test(ta.replace(/--cm-navy[a-z-]*:/g, "").replace(/\/\*[\s\S]*?\*\//g, "")), (ta.match(/.*(blue|navy|cyan|sapphire).*/i) || [""])[0]);
check("the page surface is graphite, not the shared navy", /html\[data-mode="adult"\] main:has\(\.ta\) \{\n  background-color: rgb\(17 16 15\);/.test(css));
check("chartreuse marks progress only (meter, current stage, completed)", (ta.match(/--ta-chart\)/g) || []).length <= 8 && /\.ta-meter > i \{[^}]*--ta-chart/.test(ta));
check("touch targets: rows 56px, CTA 48px, index links 44px", /\.ta-row \{[^}]*min-height: 56px/.test(ta) && /\.ta-cta \{[^}]*min-height: 48px/.test(ta) && /\.ta-index a \{[^}]*min-height: 44px/.test(ta));
check("long text wraps (titles break anywhere)", (ta.match(/overflow-wrap: anywhere/g) || []).length >= 4);
check("mobile is a single column; two columns only from 48rem / 70rem", /\.ta-lead \{[^}]*grid-template-columns: minmax\(0, 1fr\)/.test(ta) && /@media \(min-width: 70rem\) \{\n  \.ta-lead:has\(\.ta-next\)/.test(ta) && /@media \(min-width: 48rem\)/.test(ta));
check("phone clears the fixed utility pill", /html\[data-layout="phone"\] \.ta-mast \{\n  margin-top: 2\.5rem;/.test(ta));
check("Academy CSS is scoped to .ta (nothing leaks to other worlds)", !/^\.(ta)?[a-z-]*\s*\{/m.test("") && ta.split("\n").filter((l) => /^[.\[h]/.test(l) && /\{$/.test(l)).every((l) => /\.ta|world-branch--ta|main:has\(\.ta\)/.test(l)));

console.log(`\n${pass} checks passed, ${fails.length} failed`);
if (fails.length) { console.log(fails.map((f) => " - " + f).join("\n")); process.exit(1); }

/**
 * Regression test: the History of Chess video is reachable from Home in every world, under one name everywhere.
 *   node scripts/test-home-history-entry.js
 *
 * Static: no database, no browser, no network. It loads the REAL content modules (transpiled) and reads the three Home layouts as text.
 *
 * Why it exists: a new account whose experience level is knows_basics / plays_regularly skips the automatic /welcome introduction, and Home used
 * to have no link to the video; the Learn and Academy lists also called it "Chess Origins", so nobody searching for "History of Chess" found it.
 *
 *   A. one name and one route: Learn, Academy, Discover and the Home entry all say "History of Chess" and open /academy/origins
 *   B. each of the three Home layouts (Enchanted Kingdom, Classic Pro, Master Atelier) renders exactly one entry, from the shared Discover entry,
 *      in the right place, with no hard-coded copy and no gating (subscription, age, experience)
 *   C. what must NOT change: the video lesson itself, the automatic first-run intro and its skip rule, the Learn / Academy routes
 *
 * The rendered result (visible, clickable, 44px target, no overflow, the video really plays) is checked in a browser by the
 * scratch checks described in the change report; this file keeps the wiring from regressing.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
let pass = 0;
const fails = [];
const check = (n, ok, d) => { if (ok) { pass++; console.log("  ok   " + n); } else { fails.push(n); console.log("  FAIL " + n + (d !== undefined ? " -- " + d : "")); } };

// ---- load the real content modules (they import nothing, so no stubs)
const ts = require(path.join(ROOT, "node_modules", "typescript"));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "home-history-"));
const load = (src) => {
  const out = path.join(tmp, src.replace(/[\\/]/g, "_").replace(/\.ts$/, ".js"));
  fs.writeFileSync(out, ts.transpileModule(read(src), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText);
  return require(out);
};
const { LEARN_CHESS } = load("content/learnIndex.ts");
const { ACADEMY_CATEGORIES } = load("content/academyIndex.ts");
const { DISCOVER_SECTIONS } = load("content/discoverIndex.ts");
const { HISTORY_OF_CHESS } = load("content/academyVideos.ts");

const ROUTE = "/academy/origins";
const NAME = "History of Chess";

console.log("== A. one name, one route, everywhere");
const learn = LEARN_CHESS.filter((i) => i.href === ROUTE);
const academy = ACADEMY_CATEGORIES.filter((i) => i.href === ROUTE);
const discover = DISCOVER_SECTIONS.filter((i) => i.href === ROUTE);
check("Learn has exactly one entry for the video page, titled \"History of Chess\"", learn.length === 1 && learn[0].title === NAME, JSON.stringify(learn.map((i) => i.title)));
check("Academy has exactly one entry for the video page, titled \"History of Chess\"", academy.length === 1 && academy[0].title === NAME, JSON.stringify(academy.map((i) => i.title)));
check("Discover has exactly one entry for the video page, titled \"History of Chess\"", discover.length === 1 && discover[0].title === NAME && discover[0].id === "history", JSON.stringify(discover.map((i) => i.title)));
check("the old name \"Chess Origins\" is not used as a title in Learn, Academy or Discover", ![...LEARN_CHESS, ...ACADEMY_CATEGORIES, ...DISCOVER_SECTIONS].some((i) => /chess origins/i.test(i.title)));
check("the Discover entry is a real, available link (not 'coming soon')", discover[0] && !discover[0].soon && discover[0].href === ROUTE);
check("the browser test expects the new title and no longer the old one", /"History of Chess"/.test(read("scripts/test-academy-browser.js").match(/const TITLES = \[[^\]]*\]/)[0]) && !/Chess Origins/.test(read("scripts/test-academy-browser.js").match(/const TITLES = \[[^\]]*\]/)[0]));

console.log("\n== B. the three Home layouts");
const FILES = [
  { world: "Enchanted Kingdom", file: "app/(tabs)/home/page.tsx", before: 'href="/chess-mind"', after: "kingdomBonuses.length > 0", widget: /<DestinationCard\s+href=\{HISTORY_ENTRY\.href\}/ },
  { world: "Classic Pro", file: "components/home/classic/ClassicHome.tsx", before: 'href="/chess-mind"', after: "<ForParentsLink", widget: /<Link href=\{HISTORY_ENTRY\.href\} className="ch-card ch-row">/ },
  { world: "Master Atelier", file: "components/home/atelier/AtelierHome.tsx", before: 'className="at-lab__grid"', after: 'className="at-grid at-grid--bottom', widget: /<Link\s+href=\{HISTORY_ENTRY\.href\}/ },
];
const LOOKUP = 'DISCOVER_SECTIONS.find((s) => s.id === "history" && s.href && !s.soon)';
const found = DISCOVER_SECTIONS.find((s) => s.id === "history" && s.href && !s.soon);
check("the shared lookup used by all three layouts finds the real Discover entry (title, description and route)", !!found && found.title === NAME && found.href === ROUTE && /ancient India/.test(found.description));
for (const f of FILES) {
  const src = read(f.file);
  const tag = f.world;
  const guard = "{HISTORY_ENTRY?.href &&";
  const at = src.indexOf(guard);
  const block = (/\{HISTORY_ENTRY\?\.href && \(([\s\S]*?)\n\s*\)\}/.exec(src) || [])[1] || "";
  check(`${tag}: reads the entry from the shared Discover list (imports DISCOVER_SECTIONS and uses the one lookup)`, /import \{ DISCOVER_SECTIONS \} from "@\/content\/discoverIndex";/.test(src) && src.split(LOOKUP).length === 2);
  check(`${tag}: renders exactly one entry, only when the entry exists`, src.split(guard).length === 2 && at > 0);
  check(`${tag}: it links to the entry's route and shows the entry's title and description`, f.widget.test(block) && /HISTORY_ENTRY\.title/.test(block) && /HISTORY_ENTRY\.description/.test(block), block.slice(0, 120));
  check(`${tag}: no hard-coded copy or route that could drift from the Discover list`, !/>\s*History of Chess\s*</.test(src) && !/title="History of Chess"/.test(src) && !/ancient India/.test(src) && !/["']\/academy\/origins["']/.test(src));
  check(`${tag}: not gated by subscription, age or experience (the block mentions none of them)`, !/isPremium|premium|ageBand|ageAudience|experience|neutralTone/i.test(block));
  const ib = src.indexOf(f.before), ia = src.indexOf(f.after);
  check(`${tag}: sits right after the existing destination and before the next section`, ib > -1 && ia > -1 && ib < at && at < ia, `${ib} < ${at} < ${ia}`);
}
const page = read("app/(tabs)/home/page.tsx");
check("Enchanted Kingdom: lives in the shared 'other' branch, so Classic Pro and Atelier get theirs only from their own components", page.indexOf("other={") > -1 && page.indexOf("other={") < page.indexOf("{HISTORY_ENTRY?.href &&") && /import \{ ChessMindIcon, DiscoverIcon \} from "@\/components\/nav\/icons";/.test(page) && /icon=\{DiscoverIcon\}/.test(page));
const css = read("app/worlds.css");
check("Atelier: the compact-row styles exist (row layout, copy column, label that never wraps)", /\.at-lab__card--story\s*\{[^}]*flex-direction:\s*row/.test(css) && /\.at-lab__story-copy\s*\{[^}]*flex-direction:\s*column/.test(css) && /\.at-lab__card--story \.at-lab__go\s*\{[^}]*white-space:\s*nowrap/.test(css));
check("Classic Pro uses its existing row styles (no new CSS needed)", /\.ch-row\s*\{/.test(css) && /\.ch-row__title\s*\{/.test(css));

console.log("\n== C. what must not change");
const origins = read("app/academy/origins/page.tsx");
check("the video page still uses the existing player and keeps its timeline and quiz", /import \{ HistoryVideo \} from "@\/components\/academy\/HistoryVideo";/.test(origins) && /<HistoryVideo/.test(origins) && /ready for the quiz/.test(origins) && /Start the Quiz/.test(origins));
check("the lesson content is the same video: id history-of-chess, title \"The History of Chess\", portrait clip in the academy-media bucket with its poster", HISTORY_OF_CHESS.id === "history-of-chess" && HISTORY_OF_CHESS.title === "The History of Chess" && /\/academy-media\/history-of-chess\/hero\.mp4$/.test(HISTORY_OF_CHESS.videoUrl || "") && /\/academy-media\/history-of-chess\/hero-poster\.jpg$/.test(HISTORY_OF_CHESS.posterUrl || "") && HISTORY_OF_CHESS.orientation === "portrait");
check("the video page is the one Learn, Academy and Discover open (routes unchanged)", learn[0].href === ROUTE && academy[0].href === ROUTE && fs.existsSync(path.join(ROOT, "app/academy/origins/page.tsx")));
const welcome = read("app/welcome/page.tsx");
check("the automatic first-run intro still plays this same video, once, for every new learner (no experience-based skip; the full journey is scripts/test-onboarding-journey.js)", /HISTORY_OF_CHESS/.test(welcome) && !/shouldSkipWelcome/.test(welcome) && /getAcademyProgress\(supabase, child\.id, content\.id\)/.test(welcome));
const nav = read("components/nav/navConfig.tsx");
check("the Watch tab is untouched: still a real link in the primary navigation", /label:\s*"Watch",\s*href:\s*"\/watch"/.test(nav) && !/label:\s*"Watch"[^}]*disabled/.test(nav));

try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
console.log(`\n=== HOME HISTORY ENTRY (static): ${pass} passed, ${fails.length} failed ===`);
fails.forEach((f) => console.log(" - " + f));
process.exit(fails.length ? 1 : 0);

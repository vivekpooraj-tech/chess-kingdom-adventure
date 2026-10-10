/**
 * Regression test: the COMPLETE new-user journey, for every experience level and age band.
 *
 *   sign-up -> experience -> avatar -> buddy -> board -> pieces -> opening video -> /welcome (Begin -> History of Chess video) -> outro -> /home
 *
 * Every new learner sees the History of Chess introduction once, whatever they answered on the experience screen. (From 2026-09-02, commit b671539, the
 * "I know the basics" and "I already play regularly" answers skipped /welcome entirely, so those learners went from the opening video straight into the
 * app. That skip is gone; this test fails if it ever comes back.)
 *   node scripts/test-onboarding-journey.js
 *
 * No database, no browser, no network. It runs the REAL page code: app/onboarding/opening/page.tsx and app/welcome/page.tsx are transpiled and executed
 * against a tiny fake React (hooks, effects, re-render) and a fake data layer; the other onboarding steps are checked for the route they hand off to, and
 * the pure routing rule (lib/auth/postAuthDestination.ts) is used as is.
 *
 * It does NOT cover how the videos play (scripts/test-welcome-video.js, scripts/test-history-video.js) or whether a given browser allows sound.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
let pass = 0;
const fails = [];
const check = (n, ok, d) => { if (ok) { pass++; console.log("  ok   " + n); } else { fails.push(n); console.log("  FAIL " + n + (d !== undefined ? " -- " + d : "")); } };

const ts = require(path.join(ROOT, "node_modules", "typescript"));
const transpile = (rel) => ts.transpileModule(read(rel), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;

// ---- a minimal React: hooks by call order, effects with dependency checks, re-render, plain-object element tree --------------------------------------
let hooksNow = null;
const fakeReact = { useState: (...a) => hooksNow.useState(...a), useRef: (...a) => hooksNow.useRef(...a), useCallback: (...a) => hooksNow.useCallback(...a), useEffect: (...a) => hooksNow.useEffect(...a) };
const jsxRuntime = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: "Fragment" };
const tick = () => new Promise((r) => setImmediate(r));
function mount(Component) {
  const slots = [];
  let pending = [];
  let i = 0;
  const hooks = {
    useState: (init) => { const k = i++; if (!(k in slots)) slots[k] = typeof init === "function" ? init() : init; return [slots[k], (v) => { slots[k] = typeof v === "function" ? v(slots[k]) : v; }]; },
    useRef: (init) => { const k = i++; if (!(k in slots)) slots[k] = { current: init }; return slots[k]; },
    useCallback: (fn) => { i++; return fn; },
    useEffect: (fn, deps) => { const k = i++; const prev = slots[k]; const same = prev && deps && prev.deps && deps.length === prev.deps.length && deps.every((d, x) => Object.is(d, prev.deps[x])); if (!same) { slots[k] = { deps }; pending.push(fn); } },
  };
  const render = () => { i = 0; hooksNow = hooks; return Component({}); };
  // run effects, let their async work finish, re-render, until nothing new is scheduled
  const flush = async () => { for (let n = 0; n < 12; n++) { render(); const batch = pending; pending = []; for (const fn of batch) fn(); await tick(); await tick(); if (!batch.length) break; } return render(); };
  return { render, flush };
}
const walk = (n, f) => { if (!n || typeof n !== "object") return; if (Array.isArray(n)) { n.forEach((x) => walk(x, f)); return; } if (n.type) f(n); walk(n.props && n.props.children, f); };
const textOf = (n) => (n == null || typeof n === "boolean" ? "" : typeof n === "string" || typeof n === "number" ? String(n) : Array.isArray(n) ? n.map(textOf).join("") : textOf(n.props && n.props.children));
const find = (tree, pred) => { let hit = null; walk(tree, (n) => { if (!hit && pred(n)) hit = n; }); return hit; };
const button = (tree, re) => find(tree, (n) => n.type === "Button" && re.test(textOf(n)));

// ---- a module loader: real repo modules are transpiled and run; everything that touches React Router / Supabase / UI is a mock ---------------------------
const world = { user: { id: "user-1" }, resolution: null, progress: null, marked: [], completed: [], calls: [] };
const router = { push: (h) => world.calls.push(["push", h]), replace: (h) => world.calls.push(["replace", h]) };
const stub = (name) => name;
const mocks = {
  react: fakeReact,
  "react/jsx-runtime": jsxRuntime,
  "next/navigation": { useRouter: () => router },
  "framer-motion": { motion: new Proxy({}, { get: (_, k) => "motion." + String(k) }), AnimatePresence: "AnimatePresence" },
  "@/lib/supabase/client": { createClient: () => ({}), getVerifiedUser: async () => world.user },
  "@/lib/supabase/queries": {
    resolveActiveChild: async () => world.resolution,
    markOpeningVideoSeen: async (_s, id) => { world.marked.push(id); },
    getAcademyProgress: async () => world.progress,
    saveAcademyVideoProgress: async () => {},
    completeAcademyContent: async (_s, id, content, score) => { world.completed.push([id, content, score]); },
  },
  "@/lib/childSession": { getActiveChildIdClient: () => "child-1" },
  "@/components/screen-time/ScreenTimeGate": { ScreenTimeGate: "ScreenTimeGate" },
  "@/components/ui/Button": { Button: "Button", IconButton: "IconButton" },
  "@/components/branding/Logo": { Logo: "Logo" },
  "@/components/nav/icons": new Proxy({}, { get: (_, k) => stub(String(k)) }),
  "@/lib/designSystem": { TEXT: new Proxy({}, { get: () => "t" }) },
  "@/lib/brand": { BRAND: { name: "Chess Mind" } },
};
const cache = {};
const resolveAt = (id) => { const base = path.join(ROOT, id.slice(2)); for (const ext of [".ts", ".tsx", "/index.ts", "/index.tsx"]) if (fs.existsSync(base + ext)) return path.relative(ROOT, base + ext).replace(/\\/g, "/"); return null; };
const req = (id) => { if (id in mocks) return mocks[id]; if (id.startsWith("@/")) { const rel = resolveAt(id); if (!rel) throw new Error("cannot resolve " + id); return load(rel); } throw new Error("unmocked module: " + id); };
function load(rel) { if (cache[rel]) return cache[rel].exports; const m = { exports: {} }; cache[rel] = m; new Function("exports", "require", "module", transpile(rel))(m.exports, req, m); return m.exports; }

const LEVELS = [null, "new", "knows_basics", "plays_regularly"];
const BANDS = [null, "young", "tween", "teen", "adult"];
const childOf = (level, band, seenOpening) => ({ id: "child-1", display_name: "x", experience_level: level, age_band: band, avatar_id: "a", buddy_id: "b", has_seen_opening_video: seenOpening });
const setWorld = ({ level, band, seenOpening = false, progress = null, user = { id: "user-1" }, needsSelection = false, noChild = false }) => {
  world.user = user; world.progress = progress; world.marked = []; world.completed = []; world.calls = [];
  world.resolution = { needsSelection, child: noChild ? null : childOf(level, band, seenOpening) };
};
const label = (level, band) => `${level === null ? "no answer yet" : level} / ${band === null ? "no age" : band}`;

(async () => {
  const Opening = load("app/onboarding/opening/page.tsx").default;
  const Welcome = load("app/welcome/page.tsx").default;
  const { HISTORY_OF_CHESS } = load("content/academyVideos.ts");
  const { OPENING_VIDEO_URL } = load("content/openingVideo.ts");
  const { postAuthDestination } = load("lib/auth/postAuthDestination.ts");

  // ===========================================================================================================================================================
  console.log("== A. opening video -> /welcome, for every experience level and age band");
  let okSeen = 0, okEnd = 0, okErr = 0, total = 0, bad = [];
  for (const level of LEVELS) for (const band of BANDS) {
    total++;
    // returning to the opening step after it was already seen: straight to /welcome (never a second opening video)
    setWorld({ level, band, seenOpening: true }); let p = mount(Opening); let tree = await p.flush();
    const seenOk = world.calls.length === 1 && world.calls[0][0] === "replace" && world.calls[0][1] === "/welcome" && !find(tree, (n) => n.type === "video");
    // first time: the video plays; when it ends the child is marked seen once and sent to /welcome (a second `ended` changes nothing)
    setWorld({ level, band, seenOpening: false }); p = mount(Opening); tree = await p.flush();
    const video = find(tree, (n) => n.type === "video");
    const before = world.calls.length;
    if (video) { video.props.onEnded(); video.props.onEnded(); await tick(); await tick(); }
    const endOk = !!video && video.props.src === OPENING_VIDEO_URL && before === 0 && world.marked.length === 1 && world.marked[0] === "child-1" && world.calls.length === 1 && world.calls[0][0] === "replace" && world.calls[0][1] === "/welcome";
    // the opening video cannot load: nobody is stuck, they still go to /welcome
    setWorld({ level, band, seenOpening: false }); p = mount(Opening); tree = await p.flush();
    const v2 = find(tree, (n) => n.type === "video"); if (v2) v2.props.onError(); await p.flush();
    const errOk = !!v2 && world.calls.length === 1 && world.calls[0][1] === "/welcome";
    if (seenOk) okSeen++; if (endOk) okEnd++; if (errOk) okErr++;
    if (!(seenOk && endOk && errOk)) bad.push(label(level, band) + ` [seen:${seenOk} ended:${endOk} error:${errOk}] -> ${JSON.stringify(world.calls)}`);
  }
  check(`already-seen opening: all ${total} level/age combinations go straight to /welcome, with no second opening video`, okSeen === total, bad.slice(0, 3).join(" | "));
  check(`opening video ends: all ${total} combinations are marked seen exactly once and sent to /welcome (a second 'ended' does nothing)`, okEnd === total, bad.slice(0, 3).join(" | "));
  check(`opening video fails to load: all ${total} combinations still reach /welcome, nobody is stuck`, okErr === total, bad.slice(0, 3).join(" | "));
  for (const level of ["knows_basics", "plays_regularly"]) {
    setWorld({ level, band: "tween", seenOpening: true }); const p = mount(Opening); await p.flush();
    check(`"${level}" (the answer that used to skip the History intro) now goes to /welcome, NOT /home`, world.calls.length === 1 && world.calls[0][1] === "/welcome", JSON.stringify(world.calls));
  }
  setWorld({ level: "new", band: "young", user: null }); let q = mount(Opening); await q.flush();
  check("not signed in: the opening step sends the visitor to sign-in", JSON.stringify(world.calls) === JSON.stringify([["replace", "/sign-in"]]), JSON.stringify(world.calls));
  setWorld({ level: "new", band: "young", needsSelection: true }); q = mount(Opening); await q.flush();
  check("several children and none chosen: the opening step sends the visitor to choose one", JSON.stringify(world.calls) === JSON.stringify([["replace", "/choose-child"]]), JSON.stringify(world.calls));

  // ===========================================================================================================================================================
  console.log("\n== B. /welcome: Begin -> History of Chess video -> outro -> Home, for every experience level and age band");
  let okBegin = 0, okRun = 0, okSeen2 = 0; bad = [];
  for (const level of LEVELS) for (const band of BANDS) {
    // a learner who has not seen it: no redirect, a Begin button; Begin shows the History of Chess video; when it ends: outro, Enter -> /home
    setWorld({ level, band }); let p = mount(Welcome); let tree = await p.flush();
    const begin = button(tree, /Begin/);
    const noRedirect = world.calls.length === 0;
    if (begin) begin.props.onClick();
    tree = await p.flush();
    const video = find(tree, (n) => n.type === "video");
    const isHistory = !!video && video.props.src === HISTORY_OF_CHESS.videoUrl && video.props.poster === HISTORY_OF_CHESS.posterUrl;
    if (video) video.props.onEnded();
    tree = await p.flush();
    const enter = button(tree, /Enter/);
    if (enter) enter.props.onClick();
    await tick();
    const runOk = noRedirect && !!begin && isHistory && !!enter && world.calls.length === 1 && world.calls[0][0] === "push" && world.calls[0][1] === "/home" && world.completed.length === 1 && world.completed[0][1] === "history-of-chess";
    // a learner who has already seen it (any progress row): never shown twice, straight to /home
    setWorld({ level, band, progress: { status: "in_progress" } }); p = mount(Welcome); tree = await p.flush();
    const seenOk = world.calls.length === 1 && world.calls[0][0] === "replace" && world.calls[0][1] === "/home" && !button(tree, /Begin/);
    if (!!begin && noRedirect) okBegin++; if (runOk) okRun++; if (seenOk) okSeen2++;
    if (!(runOk && seenOk)) bad.push(label(level, band) + ` [begin:${!!begin} noRedirect:${noRedirect} historyVideo:${isHistory} enter:${!!enter} run:${runOk} seenGuard:${seenOk}] -> ${JSON.stringify(world.calls)}`);
  }
  check(`first time: all ${total} level/age combinations see the Begin button with no redirect`, okBegin === total, bad.slice(0, 3).join(" | "));
  check(`Begin shows the History of Chess video (hero.mp4 and its poster); when it ends the outro's Enter goes to /home and the intro is recorded once: all ${total}`, okRun === total, bad.slice(0, 3).join(" | "));
  check(`never shown twice: with any existing History of Chess progress row all ${total} combinations go straight to /home`, okSeen2 === total, bad.slice(0, 3).join(" | "));
  for (const level of ["knows_basics", "plays_regularly"]) {
    setWorld({ level, band: "adult" }); const p = mount(Welcome); const tree = await p.flush();
    check(`"${level}" on /welcome: stays on the intro (Begin shown), is not bounced to /home`, !!button(tree, /Begin/) && world.calls.length === 0, JSON.stringify(world.calls));
  }
  setWorld({ level: "new", band: "young", user: null }); let w = mount(Welcome); await w.flush();
  check("not signed in: /welcome sends the visitor to sign-in", JSON.stringify(world.calls) === JSON.stringify([["push", "/sign-in"]]), JSON.stringify(world.calls));
  setWorld({ level: "new", band: "young", needsSelection: true }); w = mount(Welcome); await w.flush();
  check("several children and none chosen: /welcome sends the visitor to choose one", JSON.stringify(world.calls) === JSON.stringify([["push", "/choose-child"]]), JSON.stringify(world.calls));

  // ===========================================================================================================================================================
  console.log("\n== C. the whole journey, hop by hop, derived from the real code");
  const hop = {
    "/onboarding/experience": (/updateChildExperienceProfile\([^)]*\);[\s\S]*?router\.push\("([^"]+)"\)/.exec(read("app/onboarding/experience/page.tsx")) || [])[1],
    "/onboarding/avatar": (/router\.push\("(\/onboarding\/[a-z]+)"\)/.exec(read("app/onboarding/avatar/page.tsx")) || [])[1],
    "/onboarding/buddy": (/router\.push\("(\/onboarding\/[a-z]+)"\)/.exec(read("app/onboarding/buddy/page.tsx")) || [])[1],
    "/onboarding/board": (/redirectTo="([^"]+)"/.exec(read("app/onboarding/board/page.tsx")) || [])[1],
    "/onboarding/pieces": (/return "(\/onboarding\/opening)"/.exec(read("app/onboarding/pieces/page.tsx")) || [])[1],
  };
  check("each onboarding step hands off to the next one: experience -> avatar -> buddy -> board -> pieces -> opening", JSON.stringify(hop) === JSON.stringify({ "/onboarding/experience": "/onboarding/avatar", "/onboarding/avatar": "/onboarding/buddy", "/onboarding/buddy": "/onboarding/board", "/onboarding/board": "/onboarding/pieces", "/onboarding/pieces": "/onboarding/opening" }), JSON.stringify(hop));
  const EXPECTED = ["/onboarding/experience", "/onboarding/avatar", "/onboarding/buddy", "/onboarding/board", "/onboarding/pieces", "/onboarding/opening", "/welcome", "/home"];
  let journeys = 0, firstBad = "";
  for (const level of ["new", "knows_basics", "plays_regularly"]) for (const band of ["young", "tween", "teen", "adult"]) {
    // the entry: a brand-new child (no answers yet) is sent to the experience screen; then the saved answers do not change the path
    const entry = postAuthDestination({ needsSelection: false, child: { experience_level: null, avatar_id: null, buddy_id: null } }).href;
    const route = [entry];
    while (hop[route[route.length - 1]]) route.push(hop[route[route.length - 1]]);
    // opening video (first time), then /welcome with Begin, video, outro
    setWorld({ level, band, seenOpening: false }); let po = mount(Opening); let t = await po.flush(); const ov = find(t, (n) => n.type === "video"); if (ov) { ov.props.onEnded(); await tick(); await tick(); }
    if (world.calls.length) route.push(world.calls[0][1]);
    setWorld({ level, band }); let pw = mount(Welcome); t = await pw.flush(); const b = button(t, /Begin/); if (b) b.props.onClick(); t = await pw.flush(); const v = find(t, (n) => n.type === "video"); if (v) v.props.onEnded(); t = await pw.flush(); const e = button(t, /Enter/); if (e) e.props.onClick(); await tick();
    if (world.calls.length) route.push(world.calls[world.calls.length - 1][1]);
    if (JSON.stringify(route) === JSON.stringify(EXPECTED)) journeys++; else if (!firstBad) firstBad = `${label(level, band)}: ${route.join(" > ")}`;
  }
  check("12 complete journeys (3 experience answers x 4 age bands) all follow the same route and pass through the opening video AND the History of Chess intro: experience > avatar > buddy > board > pieces > opening > welcome > home", journeys === 12, firstBad);
  check("a child with no answers goes to the experience screen; with answers but no companion, to the avatar screen; fully set up, to Home (existing entry rules unchanged)",
    postAuthDestination({ needsSelection: false, child: { experience_level: null, avatar_id: null, buddy_id: null } }).href === "/onboarding/experience" &&
    postAuthDestination({ needsSelection: false, child: { experience_level: "knows_basics", avatar_id: null, buddy_id: null } }).href === "/onboarding/avatar" &&
    postAuthDestination({ needsSelection: false, child: { experience_level: "plays_regularly", avatar_id: "a", buddy_id: "b" } }).href === "/home");

  // ===========================================================================================================================================================
  console.log("\n== D. guards: the skip cannot come back unnoticed, and the earlier video fixes are intact");
  const scan = (dir) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((d) => d.isDirectory() ? (d.name === "node_modules" || d.name === ".next" ? [] : scan(path.join(dir, d.name))) : /\.(ts|tsx)$/.test(d.name) ? [path.join(dir, d.name)] : []);
  const offenders = ["app", "lib", "components"].flatMap(scan).filter((f) => /shouldSkipWelcome/.test(read(f)));
  check("no code decides to skip the intro from the experience answer (nothing in app/, lib/ or components/ mentions shouldSkipWelcome)", offenders.length === 0, offenders.join(", "));
  const exp = load("lib/learner/experienceLevel.ts");
  check("the experience answer still exists and still drives everything else (3 choices; neutral Home tone for regular players and adults)", exp.EXPERIENCE_LEVEL_OPTIONS.length === 3 && exp.prefersNeutralHomeTone("plays_regularly", "teen") === true && exp.prefersNeutralHomeTone("new", "young") === false && typeof exp.shouldSkipWelcome === "undefined");
  const opening = read("app/onboarding/opening/page.tsx"), welcome = read("app/welcome/page.tsx"), lesson = read("components/academy/HistoryVideo.tsx");
  check("the opening video still plays once per child (the seen flag is read before showing it, and written when it ends)", /has_seen_opening_video/.test(opening) && /markOpeningVideoSeen\(createClient\(\), childId\)/.test(opening));
  check("the video-player fixes are intact: /welcome uses the sound-first helper and the 20-second Skip clock, the lesson player uses the sound-first helper and never assigns .muted itself", /startWithAudioFirst/.test(welcome) && /createPlaybackClock/.test(welcome) && /startWithAudioFirst/.test(lesson) && !/\.muted\s*=[^=]/.test(lesson.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1")));
  const { DISCOVER_SECTIONS } = load("content/discoverIndex.ts");
  const hist = DISCOVER_SECTIONS.find((s) => s.id === "history");
  check("after the journey the same video stays reachable from the app: the Home / Learn / Discover entry still opens the lesson player", !!hist && hist.href === "/academy/origins" && /HistoryVideo/.test(read("app/academy/origins/page.tsx")));

  console.log(`\n=== ONBOARDING JOURNEY (opening video -> Begin -> History of Chess video -> Home): ${pass} passed, ${fails.length} failed ===`);
  fails.forEach((f) => console.log(" - " + f));
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.log("HARNESS ERROR", (e && e.stack) || e); process.exit(2); });

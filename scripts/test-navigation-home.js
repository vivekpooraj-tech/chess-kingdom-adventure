/**
 * Navigation / URL cleanup regression checks (static — no browser, no network, no database).
 *
 *   /home is the one canonical Home; /kingdom-map only redirects; back buttons name the screen they
 *   actually go to; "For Parents" is a real, readable, large entry that still points at the existing
 *   Parent Gate; the shared Avatar fills its circle.
 *
 *   node scripts/test-navigation-home.js
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const exists = (p) => fs.existsSync(path.join(ROOT, p));
let pass = 0; const fails = [];
const check = (name, ok, detail) => { if (ok) { pass++; console.log("  ok  " + name); } else { fails.push(name + (detail ? " -- " + detail : "")); console.log("FAIL " + name + (detail ? " -- " + detail : "")); } };

function walk(dir, out = []) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, e.name);
    if (e.isDirectory()) walk(rel, out);
    else if (/\.(tsx?|css)$/.test(e.name)) out.push(rel);
  }
  return out;
}
const SRC = [...walk("app"), ...walk("components"), ...walk("lib")];
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

console.log("\n=== A. One canonical Home ===");
check("the Home page lives at app/(tabs)/home/page.tsx", exists("app/(tabs)/home/page.tsx"));
check("there is no second Home page left at app/(tabs)/kingdom-map", !exists("app/(tabs)/kingdom-map/page.tsx"));
const cfg = read("next.config.mjs");
check("/kingdom-map redirects to /home (server-side, next.config redirects)", /source:\s*"\/kingdom-map"[^}]*destination:\s*"\/home"/.test(cfg));
check("old sub-routes keep working (customize -> /profile/customize, journey -> /home/journey)", /kingdom-map\/customize"[^}]*"\/profile\/customize"/.test(cfg) && /kingdom-map\/journey"[^}]*"\/home\/journey"/.test(cfg));
check("the customize screen lives under Profile", exists("app/profile/customize/page.tsx"));
const nav = read("components/nav/navConfig.tsx");
check("the Home tab points at /home", /label: "Home",\s*href: "\/home"/.test(nav));
const offenders = SRC.filter((f) => /["'`]\/?[^"'`\s]*kingdom-map[^"'`]*["'`]/.test(strip(read(f))));
check("no source file generates a /kingdom-map URL (legacy: the Stripe cancel_url only, which redirects)", offenders.every((f) => f === "app/api/stripe/checkout/route.ts"), offenders.join(", "));
check("post-auth destination is /home", /export const DASHBOARD = "\/home"/.test(read("lib/auth/postAuthDestination.ts")));

console.log("\n=== B. No legacy product naming in visible text ===");
const BANNED = [/Chess Kingdom Adventure/, /Back to the Kingdom/, /Back to Kingdom/, /Kingdom Home/, /Back to Adventure/, /Adventure Map/, /Back to Chess Mind/, /Back to the classroom/, /Back to the Academy/, /Back to the course/];
const visible = SRC.filter((f) => /\.tsx?$/.test(f) && !f.startsWith("lib/navigation/"));
const hits = [];
for (const f of visible) { const s = strip(read(f)); for (const re of BANNED) if (re.test(s)) hits.push(f + ": " + re); }
check("no 'Chess Kingdom Adventure' / 'Back to the Kingdom (Map)' / 'Adventure Map' / old Chess Mind-Academy-classroom back labels", hits.length === 0, hits.join("; "));
check("no visible 'Kingdom Map' text", !visible.some((f) => /Kingdom Map/.test(strip(read(f)))));
check("the legacy Journey page title no longer says Chess Kingdom", !/Chess Kingdom/.test(read("app/chess-school/legacy/page.tsx").replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((l) => /title:/.test(l)).join("\n")));
check("world names still exist (Enchanted Kingdom is a world, not the product name)", /Enchanted Kingdom/.test(read("lib/mode/modes.ts")));

console.log("\n=== C. Back buttons: label and destination agree ===");
const dest = read("lib/navigation/destinations.ts");
const D = {};
for (const m of dest.matchAll(/(\w+): \{ href: "([^"]+)", label: "([^"]+)" \}/g)) D[m[1]] = { href: m[2], label: m[3] };
check("destinations are defined (Home, Play, Puzzles, Learn, Chess School, Train Your Mind, Profile)", ["HOME", "PLAY", "PUZZLES", "LEARN", "CHESS_SCHOOL", "TRAIN_YOUR_MIND", "PROFILE"].every((k) => D[k]));
check("canonical hrefs", D.HOME.href === "/home" && D.PLAY.href === "/play" && D.PUZZLES.href === "/puzzles" && D.LEARN.href === "/learn" && D.PROFILE.href === "/profile" && D.TRAIN_YOUR_MIND.href === "/chess-mind" && D.CHESS_SCHOOL.href === "/chess-school");
let pairs = 0; const wrong = [];
for (const f of SRC.filter((x) => x.endsWith(".tsx"))) {
  const s = read(f);
  for (const m of s.matchAll(/href="(\/[^"]*)"[^>]*>\s*(?:<Button[^>]*>)?\s*(?:←\s*)?\{backLabel\("(\w+)"\)\}/g)) {
    pairs++;
    const target = D[m[2]];
    // The Chess School destination is reached via its classroom (the redirect target of /chess-school).
    const ok = target && (m[1] === target.href || (m[2] === "CHESS_SCHOOL" && m[1] === "/chess-school/classroom"));
    if (!ok) wrong.push(`${f}: href=${m[1]} label=${m[2]}`);
  }
}
check(`every Link built from backLabel() goes where its label says (${pairs} checked)`, pairs >= 15 && wrong.length === 0, wrong.join("; "));
const rawBack = [];
for (const f of SRC.filter((x) => x.endsWith(".tsx"))) for (const m of strip(read(f)).matchAll(/href="([^"]+)"[^>]*>\s*(?:<Button[^>]*>)?\s*(?:←\s*)?Back to ([A-Z][A-Za-z ]+?)(?: →)?\s*</g)) rawBack.push({ f, href: m[1], label: m[2].trim() });
const byLabel = { Home: "/home", Play: "/play", Puzzles: "/puzzles", Learn: "/learn", Profile: "/profile", Academy: "/academy", "Train Your Mind": "/chess-mind", "Chess School": "/chess-school" };
const badRaw = rawBack.filter((b) => byLabel[b.label] && b.href !== byLabel[b.label]).map((b) => `${b.f}: ${b.label} -> ${b.href}`);
check(`hard-coded 'Back to X' links also match their destination (${rawBack.length} checked)`, badRaw.length === 0, badRaw.join("; "));
const play = read("app/online/[gameId]/page.tsx");
check("Online game: back goes to Play, labelled Back to Play (tournament games go back to the tournament)", /: "\/play"/.test(play) && /backLabel\("PLAY"\)/.test(play) && !/"\/home"/.test(play));
check("Matchmaking and Free Play go back to Play", /href="\/play"[^>]*>\s*\{backLabel\("PLAY"\)\}/.test(read("app/matchmaking/page.tsx")) && /href="\/play"[^>]*>\s*\{backLabel\("PLAY"\)\}/.test(read("app/free-play/page.tsx")));
check("Chess School screens say Back to Chess School", /backLabel\("CHESS_SCHOOL"\)/.test(read("components/school/v2/CertificateView.tsx")) && /backLabel\("CHESS_SCHOOL"\)/.test(read("components/school/v2/SessionRunner.tsx")));
check("Train Your Mind drills / limit card / Reaction say Back to Train Your Mind", ["components/trainYourMind/TrainDrill.tsx", "components/trainYourMind/DailyLimitCard.tsx", "components/chessMind/ReactionTrainer.tsx"].every((f) => /backLabel\("TRAIN_YOUR_MIND"\)/.test(read(f))));
check("Train Your Mind hub and Learn pages go back to Learn", /href="\/learn"[^>]*>\s*\{backLabel\("LEARN"\)\}/.test(read("app/chess-mind/page.tsx")) && /href="\/learn"[^>]*>\s*\{backLabel\("LEARN"\)\}/.test(read("app/academy/page.tsx")));
check("course index goes back to Learn, except Tactical Thinking which goes back to Train Your Mind", /courseParent\(summary\.id\)/.test(read("components/academy/CourseIndex.tsx")) && /courseId === "tactical-thinking" \? "TRAIN_YOUR_MIND" : "LEARN"/.test(dest));
check("lesson runner names its course", /Back to \{data\?\.courseTitle/.test(read("components/academy/CourseLessonRunner.tsx")));
check("post-game analysis takes the label from the caller (no hard-coded Chess Mind)", /backLabel\?: string/.test(read("components/game/analysis/PostGameAnalysis.tsx")) && /backLabel=/.test(play) && /backLabel="Back to Free Play"/.test(read("app/free-play/page.tsx")));
check("Customize goes back to Profile", /router\.push\(destinationHref\("PROFILE"\)\)/.test(read("app/profile/customize/page.tsx")));
const top = read("components/nav/AppTopBar.tsx");
check("top bar titles: Home, Play, Puzzles, Learn, Train Your Mind", ["Home", "Play", "Puzzles", "Learn", "Train Your Mind"].every((t) => top.includes(`"${t}"`)) && /\["\/home", "Home"\]/.test(top));

console.log("\n=== D. For Parents is a real, readable entry ===");
const fp = read("components/nav/ForParentsLink.tsx");
check("it still links to the existing Parent Gate (/parent-gate?next=/parent-dashboard)", /PARENT_GATE_HREF = "\/parent-gate\?next=\/parent-dashboard"/.test(fp));
check("touch target is at least 48px (52px)", /min-h-\[52px\]/.test(fp));
check("label is 16px (text-base), supporting line 13px", /text-base font-semibold[^"]*"[^>]*>\s*For Parents/.test(fp.replace(/\r?\n/g, " ")) && /text-\[13px\]/.test(fp));
check("not underlined metadata, and not the old muted ivory/65", !/underline/.test(fp) && !/text-premium-ivory\/(5|6)\d/.test(fp));
const ivory = (fp.match(/text-premium-ivory(?:\/(\d+))?/g) || []).map((c) => Number((c.split("/")[1]) || 100));
check("every text colour is at least 80% ivory on the midnight panel (contrast >= 9:1)", ivory.length >= 2 && Math.min(...ivory) >= 80, String(ivory));
check("it has a visible border, an icon and an arrow", /border-premium-gold\/35/.test(fp) && /ShieldIcon/.test(fp) && /ChevronRightIcon/.test(fp));
check("supporting text reads 'Parent controls & settings'", /Parent controls &amp; settings/.test(fp));
for (const [f, label] of [["app/(tabs)/home/page.tsx", "Home (Enchanted Kingdom + Master Training Atelier)"], ["components/home/classic/ClassicHome.tsx", "Classic Pro Home"], ["app/(tabs)/learn/page.tsx", "Learn"], ["app/profile/page.tsx", "Profile"]]) {
  check(`${label} renders the shared For Parents entry`, /<ForParents(Link|Entry)/.test(read(f)));
}
check("the old tiny text-link versions are gone from Home", !/parent-gate\?next=\/parent-dashboard"[^>]*>\s*For Parents/.test(read("app/(tabs)/home/page.tsx")) && !/ch-parents">\s*For Parents/.test(read("components/home/classic/ClassicHome.tsx")));
check("More keeps its For Parents row", /href="\/parent-gate\?next=\/parent-dashboard"/.test(read("app/(tabs)/more/page.tsx")));
const css = read("app/worlds.css");
const cp = css.match(/\.ch-parents \{[^}]*\}/)[0];
check("Classic variant: >=52px high, bordered, no longer a small underlined link", /min-height:\s*52px/.test(cp) && /border:/.test(cp) && /text-decoration:\s*none/.test(cp) && /\.ch-parents__title \{[^}]*font-size:\s*1rem/.test(css));
let gateChanged = "";
try { gateChanged = execSync("git diff --name-only -- app/parent-gate lib/parentLock lib/parent middleware.ts", { cwd: ROOT }).toString().trim(); } catch (e) {}
check("Parent Gate / parent-lock security files are untouched (middleware.ts differs only by the dev auto-signin landing path)", !/app\/parent-gate|lib\/parentLock\/(?!navFilter)|lib\/parent\//.test(gateChanged), gateChanged);

console.log("\n=== D2. Age-aware parent experience (single source: children.age_band) ===");
const xl = read("lib/learner/experienceLevel.ts");
check("one age source: AgeBand young/tween/teen/adult in experienceLevel.ts; no new age classifier file", /AgeBand = "young" \| "tween" \| "teen" \| "adult"/.test(xl) && !exists("lib/learner/ageAudience.ts") && !exists("lib/age.ts"));
const aud = new Function(xl.match(/export function ageAudience[\s\S]*?\n\}/)[0].replace("export function", "function").replace(/\(ageBand: [^)]*\): AgeAudience/, "(ageBand)") + "; return ageAudience;")();
check("under 18 (young / tween / teen) -> minor", ["young", "tween", "teen"].every((b) => aud(b) === "minor"));
check("18+ -> adult", aud("adult") === "adult");
check("missing / unknown age is NOT assumed adult", aud(null) === "unknown" && aud(undefined) === "unknown" && aud("bogus") === "unknown");
check("For Parents is hidden only for adults (unknown keeps the safe existing behaviour)", /ageAudience\(ageBand\) === "adult"\) return null/.test(fp));
check("Home / Profile pass the child's age_band to ForParentsLink", /<ForParentsLink ageBand=\{child\.age_band\}/.test(read("app/(tabs)/home/page.tsx")) && /<ForParentsLink ageBand=\{child\.age_band\}/.test(read("app/profile/page.tsx")));
const entry = read("components/nav/ForParentsEntry.tsx");
check("Learn (static server page) resolves it client-side, hides for adults, keeps the entry on failure", /ForParentsEntry/.test(read("app/(tabs)/learn/page.tsx")) && /age_band \?\? null/.test(entry) && /catch[\s\S]*ageBand = null/.test(entry) && /ForParentsLink/.test(entry));
const ch = read("components/home/classic/ClassicHome.tsx");
check("Classic Premium CTA: 18+ gets 'Get Premium' -> /upgrade; minors and unknown keep 'Ask a parent' -> Parent Gate", /ageAudience\(ageBand\) === "adult" \? \([\s\S]*?href="\/upgrade"[\s\S]*?Get Premium[\s\S]*?\) : \([\s\S]*?href="\/parent-gate\?next=\/upgrade"[\s\S]*?Ask a parent/.test(ch));
check("Home passes age_band into ClassicHome", /ageBand=\{child\.age_band \?\? null\}/.test(read("app/(tabs)/home/page.tsx")));
check("canonical metadataBase is https://www.chessmind.club", /metadataBase: new URL\("https:\/\/www\.chessmind\.club"\)/.test(read("app/layout.tsx")));

console.log("\n=== E. Avatar is large enough to recognise ===");
const av = read("components/ui/Avatar.tsx");
const px = Object.fromEntries([...av.match(/SIZE_PX[^=]*=\s*\{([^}]*)\}/)[1].matchAll(/(\w+):\s*(\d+)/g)].map((m) => [m[1], Number(m[2])]));
const tx = Object.fromEntries([...av.match(/TEXT_CLASS[^=]*=\s*\{([^}]*)\}/)[1].matchAll(/(\w+):\s*"text-\[(\d+)px\]"/g)].map((m) => [m[1], Number(m[2])]));
check("the glyph fills at least 55% of the circle at every size (it was ~43%)", ["xs", "sm", "md", "lg"].every((k) => tx[k] / px[k] >= 0.55), JSON.stringify({ px, tx }));
const strip2 = read("components/home/HomeProfileStrip.tsx"), hdr = read("components/home/HomeHeader.tsx");
check("the Home profile strip uses the shared Avatar at 56px (was a hand-rolled 40px disc)", /<Avatar\s+size="md"/.test(strip2) && px.md === 56 && !/h-10 w-10/.test(strip2));
check("the Profile header uses the shared Avatar at 72px (was 56px)", /<Avatar\s+size="lg"/.test(hdr) && px.lg === 72);
check("the strip is still a single link to /profile with a >=48px target", /href="\/profile"/.test(strip2) && /min-h-\[48px\]/.test(strip2));
check("Classic Pro avatar is 4rem with a ~2.15rem glyph (was 3rem / 1.45rem)", /\.ch-player__avatar \{[^}]*width:\s*4rem[^}]*font-size:\s*2\.15rem/.test(css.replace(/\r?\n/g, " ")));
check("fallback avatar still renders (emoji fallback and default gradient)", /avatar\?\.emoji \?\? "🧑"/.test(strip2) && /avatar\?\.emoji \?\? "♔"/.test(read("components/home/classic/ClassicHome.tsx")));

console.log("\n=== F. Puzzle child pages and the lesson screen have a named way back ===");
check("Puzzles destination is /puzzles, Lessons destination is the lesson list /home/journey", D.PUZZLES.href === "/puzzles" && D.LESSONS && D.LESSONS.href === "/home/journey" && D.LESSONS.label === "Lessons");
const trainer = read("components/puzzles/TacticsTrainer.tsx");
const focus = read("components/chess/ChessFocusLayout.tsx");
check("/puzzles/tactics: the focus layout's exit reads 'Back to Puzzles' and goes to /puzzles (world preserved)", /exitLabel=\{backLabel\("PUZZLES"\)\}/.test(trainer) && /router\.push\([^)]*`\/puzzles\?world=\$\{world\}`[^)]*"\/puzzles"/.test(trainer));
check("ChessFocusLayout: exitLabel is optional, falls back to the plain 'Exit', and the button stays 44px", /exitLabel\?: string/.test(focus) && /aria-label=\{exitLabel \?\? "Exit"\}/.test(focus) && /min-h-\[44px\]/.test(focus));
check("other ChessFocusLayout screens are unchanged (only TacticsTrainer passes exitLabel)", SRC.filter((f) => f.endsWith(".tsx") && /exitLabel=/.test(read(f))).join() === "components/puzzles/TacticsTrainer.tsx");
const themes = read("app/(tabs)/puzzles/tactics/themes/page.tsx");
check("/puzzles/tactics/themes: a visible 'Back to Puzzles' link to /puzzles, 44px tall", /href=\{destinationHref\("PUZZLES"\)\}[\s\S]*?min-h-\[44px\][\s\S]*?\{backLabel\("PUZZLES"\)\}/.test(themes));
const lh = read("components/lesson/LessonHeader.tsx");
check("lesson screen: visible 'Back to Lessons' link replaces the 32px icon-only Exit lesson", /\{backLabel\("LESSONS"\)\}/.test(lh) && !/Exit lesson/.test(lh.replace(/\/\*[\s\S]*?\*\//g, "")) && !/w-8 h-8/.test(lh));
check("lesson back link: aria-label, >=44x44 target, default exit is the lesson list (not Home, not a hard-coded /lesson)", /aria-label=\{backLabel\("LESSONS"\)\}/.test(lh) && /min-h-\[44px\] min-w-\[44px\]/.test(lh) && /exitHref = destinationHref\("LESSONS"\)/.test(lh));
check("lesson exitHref prop is still overridable (existing exit behaviour preserved)", /exitHref\?: string/.test(lh));
check("no generic 'Back' / legacy wording in the new controls", !/Back to Kingdom|Chess Kingdom/.test(lh + themes + focus) && !/>\s*Back\s*</.test(lh + themes));
const lessonPage = read("app/lesson/[dayId]/page.tsx");
check("the lesson page still renders LessonHeader and still finishes to Home as before", /<LessonHeader/.test(lessonPage) && /router\.push\("\/home"\)/.test(lessonPage));
check("the lesson list page exists at the destination", exists("app/(tabs)/home/journey/page.tsx"));
const journey = read("app/(tabs)/home/journey/page.tsx");
check("lesson list heading reads 'Lessons' (matches 'Back to Lessons'); no 'Kingdom Story Map' heading; route unchanged", /<h1[^>]*>Lessons \{currentZone\.emoji\}<\/h1>/.test(journey) && !/<h1[^>]*>[^<]*Kingdom Story Map/.test(journey) && D.LESSONS.href === "/home/journey");
check("lesson page: tighter top padding and gaps (pt-4 pb-8 gap-4) so a board step fits an 844px phone; header link stays 44px", /flex flex-col items-center gap-4 px-6 pt-4 pb-8">\s*<LessonHeader/.test(lessonPage) && /min-h-\[44px\] min-w-\[44px\]/.test(lh));

console.log(`\n=== NAVIGATION:${pass} passed, ${fails.length} failed ===`);
if (fails.length) { console.log(fails.join("\n")); process.exit(1); }

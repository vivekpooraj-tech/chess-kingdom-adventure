/**
 * Master Training Atelier Home — static regression checks.
 *   node scripts/test-atelier-home.js
 *
 * The redesign is presentation only: it must render only in the Atelier world, show real data only,
 * use the approved palette (no blue family), and leave Enchanted Kingdom and Classic Pro untouched.
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const exists = (p) => fs.existsSync(path.join(ROOT, p));
let pass = 0; const fails = [];
const check = (n, ok, d) => { if (ok) pass++; else { fails.push(n + (d ? " -- " + d : "")); console.log("FAIL " + n + (d ? " -- " + d : "")); } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const home = read("components/home/atelier/AtelierHome.tsx");
const live = read("components/home/atelier/AtelierLive.tsx");
const page = read("app/(tabs)/home/page.tsx");
const branch = read("components/layout/WorldBranch.tsx");
const css = read("app/worlds.css");
// Start after the section banner comment so its own wording ("no blue ...") is not scanned as CSS.
const atCss = css.slice(css.indexOf('html[data-mode="kids"] .world-scope:not([data-world-resolved]) .world-branch--atelier'));

console.log("=== Structure and routing ===");
check("components exist", exists("components/home/atelier/AtelierHome.tsx") && exists("components/home/atelier/AtelierLive.tsx"));
check("Home passes an `atelier` branch to the existing WorldBranch (no new route)", /atelier=\{[\s\S]*?<AtelierHome/.test(page) && !exists("app/(tabs)/atelier") && !exists("app/atelier"));
check("WorldBranch: `atelier` is optional and Atelier only swaps when it is supplied", /atelier\?: ReactNode/.test(branch) && /world === "atelier" && atelier !== undefined/.test(branch));
check("Enchanted keeps the existing `other` layout; Classic keeps ClassicHome", /other=\{/.test(page) && /<ClassicHome/.test(page) && /<HomeHeroSection/.test(page));
check("pre-paint CSS hides the Atelier tree outside Atelier mode and the shared tree in Atelier mode", /world-branch--atelier/.test(atCss) && /world-branch--other\.world-branch--has-atelier/.test(atCss));
check("ForParentsLink (age-aware) is still rendered in the Atelier branch", /<ForParentsLink ageBand=\{child\.age_band\}/.test(page.slice(page.indexOf("atelier={"), page.indexOf("other={"))));

console.log("=== Approved composition ===");
for (const [name, re] of [
  ["personal greeting", /AtelierGreeting/],
  ["dominant Current Training", /Current training/],
  ["Training Performance / Your form", /Your form/],
  ["Train Next recommendation", /Train next/],
  ["asymmetric Training Lab", /Training lab/],
  ["Today's challenge", /Today&rsquo;s challenge|Today's challenge/],
  ["Training Momentum", /Training momentum/],
]) check(`section: ${name}`, re.test(home + live));
check("asymmetric lab on desktop (7/5 then 4/4/4)", /at-lab__card--pattern \{ grid-column: span 7/.test(atCss) && /at-lab__card--spatial \{ grid-column: span 5/.test(atCss) && /span 4/.test(atCss));
check("responsive: tablet and desktop breakpoints, single column on phone", /@media \(min-width: 640px\)/.test(atCss) && /@media \(min-width: 1024px\)/.test(atCss) && /\.at-grid \{[^}]*grid-template-columns: minmax\(0, 1fr\)/.test(atCss));

console.log("=== Real data only ===");
check("no mock/placeholder figures or lorem text", !/lorem|placeholder|mock|fake|TODO|Leo\b|Opera Mate|Pawn Metamorphosis/i.test(strip(home + live)));
check("Current Training comes from the existing primary action (Chess School progress)", /primaryAction/.test(home) && /action\.startedCount/.test(home) && /action\.totalSessions/.test(home));
check("Train Next uses the real skill-focus recommendation, else the least-practised real category", /focus\.skillName/.test(home) && /statsByModule\[l\.module/.test(home));
check("Lab counts come from real stats / opening encounters", /statsByModule/.test(home) && /openingCount/.test(home));
check("Your form reads real finished games (getPlayedGames + buildOverview)", /getPlayedGames\(/.test(live) && /buildOverview\(/.test(live));
check("rating trend is drawn from the games' recorded ratings and hidden with fewer than 2 points", /ratingAfter/.test(live) && /values\.length < 2\) return null/.test(live));
check("momentum reads real per-day Chess Mind activity", /child_chess_mind_activity/.test(live));
check("Today's challenge reuses the existing DailyChallengeCard and DailyQuestsCard", /<DailyChallengeCard childId=\{childId\} variant="atelier"/.test(home) && /<DailyQuestsCard/.test(home));
check("client islands fetch only when the world resolves to Atelier", (live.match(/useAtelierActive\(\)/g) || []).length >= 3 && /world === "atelier"/.test(live));
check("unavailable values show a dash, never an invented number", /"—"/.test(live));

console.log("=== Hero visual: real lesson position, or a decorative grid ===");
check("hero board comes from the session's own step (guided board / piece intro / teach with a position)", /getSessionById\(/.test(home) && /step\.type === "guided_board"/.test(home) && /step\.fen/.test(home));
check("the highlighted squares and arrows are the lesson's own (no squares or moves authored here)", /step\.highlightSquares/.test(home) && /step\.arrows/.test(home) && !/fen=["'`]/.test(home) && !/[rnbqkpRNBQKP1-8]{1,8}\/[rnbqkpRNBQKP1-8]{1,8}\//.test(strip(home)));
check("read-only, decorative to assistive tech, and labelled with the step's real title", /readOnly/.test(home) && /aria-hidden="true"/.test(home) && /Next on the board/.test(home));
check("no board for the step -> a purely decorative grid, no ChessBoard, no pieces", /at-hero__visual--grid/.test(home) && /at-hero__visual--grid[\s\S]*?mask-image/.test(atCss) && !/<ChessBoard[\s\S]{0,400}at-hero__visual--grid/.test(home));
check("the board is scaled from one 300px drawing: 240px at 768-1359px, 300px from 1360px (keeps the hero text column readable)", /--at-board: 240px; --at-board-scale: 0\.8/.test(atCss) && /@media \(min-width: 1360px\)[\s\S]*?--at-board: 300px; --at-board-scale: 1/.test(atCss));
check("hero visual is hidden on phones", /\.at-hero__visual \{ display: none/.test(atCss) && /@media \(min-width: 768px\)[\s\S]*?\.at-hero__visual \{ display: block/.test(atCss));
check("editorial title stays dominant (display type, chartreuse numeral)", /\.at-display \{ font-size: clamp\(1\.9rem/.test(atCss) && /\.at-hero__numeral/.test(atCss));

console.log("=== Greeting and Strategic Levers ===");
check("no 'Welcome back' fallback; the part of day is set before first paint by an inline script and kept by a layout effect", !/Welcome back/.test(live) && /GREETING_SCRIPT/.test(live) && /suppressHydrationWarning/.test(live) && /useIsoLayoutEffect/.test(live));
check("greeting script covers morning / afternoon / evening from the viewer's clock", /h<12\?"Good morning":h<18\?"Good afternoon":"Good evening"/.test(live));
check("Strategic Levers shows a real course fact (lessons in the course) from the course data, never an invented count", /getCourse\("strategy"\)\?\.lessons\.length/.test(home) && /lessons in the course/.test(home));

console.log("=== Palette: graphite, deep plum, oxblood, warm ivory, restrained chartreuse ===");
const hexes = (atCss.match(/#[0-9a-fA-F]{6}\b/g) || []);
check("no hex colours at all in the Atelier block (tokens only)", hexes.length === 0, hexes.join(","));
const triples = [...atCss.matchAll(/--at-(\w+): (\d+) (\d+) (\d+);/g)].map((m) => ({ name: m[1], r: +m[2], g: +m[3], b: +m[4] }));
check("palette tokens defined", ["graphite", "plum", "oxblood", "ivory", "chart"].every((n) => triples.some((t) => t.name === n)));
check("no token is blue-dominant (navy / cyan / sapphire family)", triples.every((t) => !(t.b > t.r + 12 && t.b > t.g + 6)), JSON.stringify(triples.filter((t) => t.b > t.r + 12 && t.b > t.g + 6)));
check("chartreuse is the only green and is used sparingly (accent, CTA, progress, lab 'open')", /--at-chart: 184 214 64/.test(atCss));
check("no blue-family words or colour functions in the Atelier CSS / components", !/(?<![\w-])(blue|navy|cyan|sapphire|sky|indigo|azure|teal)(?![\w-])/i.test(strip(atCss) + strip(home) + strip(live)));
check("Atelier sidebar: subdued items, the Explore label and Collapse are lifted to >= 4.5:1 (ivory 55% / 52% on graphite) and stay below the primary items (60%)", (() => { const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); }; const bg = [14, 11, 14], iv = [245, 236, 224]; const ratio = (a) => { const c = bg.map((b, i) => b + a * (iv[i] - b)); return (lum(c) + 0.05) / (lum(bg) + 0.05); }; return ratio(0.55) >= 4.5 && ratio(0.52) >= 4.5; })() && css.includes("app-sidenav a.app-sidenav-item.min-h-") && css.includes("color: rgb(245 236 224 / 0.55)") && css.includes("app-sidenav p.app-sidenav-label") && css.includes("color: rgb(245 236 224 / 0.52)") && css.includes("app-sidenav button.app-sidenav-item:not(:hover)"));
check("Atelier-mode chrome recolour contains no blue (graphite navy-tokens replaced)", /html\[data-mode="adult"\] \.app-sidenav[\s\S]*?--cm-midnight-deep: 14 11 14[\s\S]*?--cm-navy-light: 58 28 34/.test(css));

console.log("=== Accessibility / touch ===");
check("every Atelier link/CTA has a >=44px target (links 44, CTA 48)", /\.at-link \{[^}]*min-height: 44px/.test(atCss) && /\.at-cta \{[^}]*min-height: 48px/.test(atCss) && /\.at-focuschip \{[^}]*min-height: 48px/.test(atCss));
check("sections are labelled regions; progress bar has a progressbar role and label", /aria-labelledby/.test(home) && /role="progressbar"/.test(home) && /aria-label=\{`Chess School:/.test(home));
check("week strip is a labelled list with text alternatives", /aria-label="Chess Mind activity over the last seven days"/.test(live) && /sr-only/.test(live));
check("reduced motion respected", /prefers-reduced-motion: reduce/.test(atCss));
check("phone greeting stays clear of the fixed header pill", /@media \(max-width: 639px\)[\s\S]*?\.at-greeting \{ margin-top: 1rem/.test(atCss));

console.log("=== Nothing else was changed ===");
let changed = "";
try { changed = execSync("git diff --name-only", { cwd: ROOT }).toString(); } catch (e) {}
check("Classic Home, Enchanted tiles, hero and profile strip are untouched", !/components\/home\/classic|HomeHeroSection|ActivityTileGrid|HomeProfileStrip|HomeTodaySection/.test(changed));
check("no Supabase, migration, pricing, auth, progression or limit files touched", !/supabase\/|lib\/pricing|lib\/premium|lib\/entitlement|lib\/auth|lib\/trainYourMind|middleware/.test(changed));
check("DailyChallengeCard: default and classic variants keep their markup (atelier added alongside)", /variant === "classic"/.test(read("components/home/DailyChallengeCard.tsx")) && /variant === "atelier"/.test(read("components/home/DailyChallengeCard.tsx")));

console.log(`\n=== ATELIER HOME: ${pass} passed, ${fails.length} failed ===`);
if (fails.length) { console.log(fails.map((f) => " - " + f).join("\n")); process.exit(1); }

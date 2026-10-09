/**
 * Regression test: Atelier "Training momentum" weekday labels must not cause a React hydration mismatch (#425 / #422).
 *   node scripts/test-atelier-momentum-hydration.js        (no browser, no server, no network, no database)
 *
 * The bug: AtelierMomentum computed its seven weekday letters during render from the clock. The server renders in its own timezone (UTC on
 * Vercel); the browser in the viewer's. Whenever the two calendar dates differ (e.g. 00:00-05:30 in India) the server HTML said "F" where the
 * client's first render said "S", and React threw the server HTML away. Fix: the server HTML and the first client render are identical (seven
 * blank slots) and a layout effect fills in the viewer's local days right after hydration.
 *
 * How it checks: the REAL AtelierLive.tsx is transpiled and rendered with react-dom/server in separate child processes, each with its own TZ
 * and a frozen clock. "Server" = UTC. "First client render" = the same component rendered under the browser's timezone (Asia/Kolkata, a US
 * zone, UTC+14 and a UTC control), at instants where the local date differs from UTC. The HTML must be byte-identical; React hydrates cleanly
 * exactly when the first client render matches the server HTML. The post-mount labels (momentumDays) must be the viewer's LOCAL weekdays.
 * Only data/navigation imports are stubbed; the test fails if the component gains an import it does not know about.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const FILE = "components/home/atelier/AtelierLive.tsx";

// ------------------------------------------------------------------------------------------------------------- child: render once
if (process.argv[2] === "--child") {
  const [, , , tz, iso] = process.argv;
  const FIXED = Date.parse(iso);
  const RealDate = Date;
  global.Date = class extends RealDate { constructor(...a) { if (a.length === 0) super(FIXED); else super(...a); } static now() { return FIXED; } };
  const ts = require(path.join(ROOT, "node_modules", "typescript"));
  const React = require(path.join(ROOT, "node_modules", "react"));
  const { renderToString } = require(path.join(ROOT, "node_modules", "react-dom", "server"));
  const src = fs.readFileSync(path.join(ROOT, FILE), "utf8");
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const stubs = {
    "next/link": { default: (p) => React.createElement("a", { href: p.href }, p.children) },
    "@/lib/supabase/client": { createClient: () => ({}) },
    // identical to lib/supabase/queries.ts localDateString (the parent test asserts the source still matches)
    "@/lib/supabase/queries": { getPlayedGames: async () => [], localDateString: (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` },
    "@/lib/stats/playerStats": { buildOverview: () => ({}), MIN_GAMES_FOR_RATE: 3 },
    "@/lib/world/WorldContext": { useWorld: () => "atelier", useWorldResolved: () => true },
  };
  const req = (id) => {
    if (id === "react" || id === "react/jsx-runtime" || id === "react/jsx-dev-runtime") return require(path.join(ROOT, "node_modules", id));
    if (stubs[id]) return stubs[id];
    throw new Error("UNKNOWN_IMPORT " + id);
  };
  const mod = { exports: {} };
  try {
    new Function("module", "exports", "require", out)(mod, mod.exports, req);
    const html = renderToString(React.createElement(mod.exports.AtelierMomentum, { childId: "c", streak: 3 }));
    const days = mod.exports.momentumDays(FIXED);
    console.log(JSON.stringify({ ok: true, offset: new RealDate(FIXED).getTimezoneOffset(), html, labels: days.map((d) => d.label).join(""), keys: days.map((d) => d.key), today: days.map((d) => d.today) }));
  } catch (e) {
    console.log(JSON.stringify({ ok: false, error: String(e && e.message || e).slice(0, 200) }));
  }
  process.exit(0);
}

// ------------------------------------------------------------------------------------------------------------- parent
let pass = 0; const fails = [];
const check = (name, ok, detail) => { if (ok) { pass++; console.log("  ok  " + name); } else { fails.push(name + (detail ? " -- " + detail : "")); console.log("FAIL " + name + (detail ? " -- " + detail : "")); } };
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const run = (tz, iso) => {
  const r = spawnSync(process.execPath, [__filename, "--child", tz, iso], { env: { ...process.env, TZ: tz }, encoding: "utf8" });
  try { return JSON.parse(r.stdout.trim().split("\n").pop()); } catch { return { ok: false, error: (r.stderr || r.stdout || "no output").slice(0, 200) }; }
};
const LETTER = ["S", "M", "T", "W", "T", "F", "S"];
// Independent expectation: the weekday letters of the seven days ending at `iso`, in the viewer's timezone, via Intl (not via the component).
const expectedLabels = (tz, iso) => {
  const base = Date.parse(iso);
  return Array.from({ length: 7 }, (_, i) => {
    const wd = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: tz }).format(new Date(base - (6 - i) * 86_400_000));
    return LETTER[["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd)];
  }).join("");
};
const localDate = (tz, iso) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
const OFFSET = { UTC: 0, "Asia/Kolkata": -330, "America/Los_Angeles": 420, "Pacific/Kiritimati": -840 };

console.log("\n=== A. The component is what the test thinks it is ===");
const src = read(FILE);
const imports = [...src.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
const known = ["react", "next/link", "@/lib/supabase/client", "@/lib/supabase/queries", "@/lib/stats/playerStats", "@/lib/world/WorldContext"];
check("the component imports only what the test stubs (a new import must be added to the test)", imports.every((i) => known.includes(i)), imports.filter((i) => !known.includes(i)).join(", "));
check("the stubbed localDateString matches lib/supabase/queries.ts", /export function localDateString\(d: Date = new Date\(\)\): string \{\s*const year = d\.getFullYear\(\);\s*const month = String\(d\.getMonth\(\) \+ 1\)\.padStart\(2, "0"\);\s*const day = String\(d\.getDate\(\)\)\.padStart\(2, "0"\);/.test(read("lib/supabase/queries.ts")));
const fn = src.slice(src.indexOf("export function AtelierMomentum"), src.indexOf("\n}\n", src.indexOf("export function AtelierMomentum")) + 3);
check("AtelierMomentum does not silence the mismatch (no suppressHydrationWarning inside it)", fn.length > 200 && !/suppressHydrationWarning/.test(fn));
// The data-fetch effect also reads the clock, but effects never run during server rendering; only the render path matters here.
const renderPath = fn.replace(/useEffect\(\(\) => \{[\s\S]*?\}, \[active, childId\]\);/, "");
check("the local-date days are only computed after mount (in the render path Date.now() appears only behind the mounted guard)", fn.includes("useEffect(") && renderPath.length < fn.length && (renderPath.match(/Date\.now\(\)/g) || []).length === 1 && /mounted \? momentumDays\(Date\.now\(\)\) : null/.test(renderPath));
check("mount is flagged in a LAYOUT effect, so the real days appear before first paint", /useIsoLayoutEffect\(\(\) => \{\s*setMounted\(true\);/.test(fn));

console.log("\n=== B. Server (UTC) HTML vs first client render, where the local date differs from UTC ===");
const SCENARIOS = [
  { name: "India after midnight (UTC date is the previous day)", iso: "2026-10-08T23:00:00Z", clients: ["Asia/Kolkata", "Pacific/Kiritimati", "UTC"] },
  { name: "US Pacific evening (UTC date is the next day)", iso: "2026-10-09T03:00:00Z", clients: ["America/Los_Angeles", "UTC"] },
  { name: "UTC+14 early morning", iso: "2026-10-08T12:00:00Z", clients: ["Pacific/Kiritimati", "UTC"] },
  { name: "daytime control (local date equals UTC date everywhere tested)", iso: "2026-10-08T10:00:00Z", clients: ["Asia/Kolkata", "America/Los_Angeles", "UTC"] },
];
for (const sc of SCENARIOS) {
  const server = run("UTC", sc.iso);
  check(`[${sc.name}] the server render (UTC) ran`, server.ok && server.offset === 0, JSON.stringify(server).slice(0, 160));
  if (!server.ok) continue;
  const labelsInHtml = [...server.html.matchAll(/class="at-week__label">([^<]*)</g)].map((m) => m[1]);
  check(`[${sc.name}] server HTML has seven slots, all blank (no timezone-dependent text), the last one is today`, labelsInHtml.length === 7 && labelsInHtml.every((l) => l === " ") && (server.html.match(/is-today/g) || []).length === 1 && /is-today[^>]*>(?:(?!<li).)*<\/li><\/ol>/.test(server.html));
  for (const tz of sc.clients) {
    const client = run(tz, sc.iso);
    check(`[${sc.name}] browser ${tz}: timezone applied`, client.ok && client.offset === OFFSET[tz], JSON.stringify({ off: client.offset, want: OFFSET[tz], err: client.error }));
    if (!client.ok) continue;
    check(`[${sc.name}] browser ${tz}: first client render HTML is IDENTICAL to the UTC server HTML (no hydration mismatch)`, client.html === server.html);
    check(`[${sc.name}] browser ${tz}: after mount the labels are the viewer's LOCAL weekdays (${expectedLabels(tz, sc.iso)})`, client.labels === expectedLabels(tz, sc.iso), `${client.labels} vs ${expectedLabels(tz, sc.iso)}`);
    check(`[${sc.name}] browser ${tz}: after mount the last day is the viewer's local date (${localDate(tz, sc.iso)}) and only it is "today"`, client.keys[6] === localDate(tz, sc.iso) && client.today.filter(Boolean).length === 1 && client.today[6] === true, `${client.keys[6]} vs ${localDate(tz, sc.iso)}`);
  }
}

console.log("\n=== C. The scenarios really exercise a date difference (the test would catch the old bug) ===");
const ist = run("Asia/Kolkata", "2026-10-08T23:00:00Z"), utc = run("UTC", "2026-10-08T23:00:00Z");
check("at 23:00 UTC the viewer's local weekdays in India DIFFER from UTC's (the old render-time labels would have mismatched)", ist.ok && utc.ok && ist.labels !== utc.labels, `${ist.labels} vs ${utc.labels}`);
const la = run("America/Los_Angeles", "2026-10-09T03:00:00Z"), utc2 = run("UTC", "2026-10-09T03:00:00Z");
check("at 03:00 UTC the viewer's local weekdays in Los Angeles DIFFER from UTC's", la.ok && utc2.ok && la.labels !== utc2.labels, `${la.labels} vs ${utc2.labels}`);
const ist2 = run("Asia/Kolkata", "2026-10-08T10:00:00Z"), utc3 = run("UTC", "2026-10-08T10:00:00Z");
check("control: at 10:00 UTC India and UTC agree (no difference to cause a mismatch)", ist2.ok && utc3.ok && ist2.labels === utc3.labels);

console.log(`\n=== ATELIER MOMENTUM HYDRATION: ${pass} passed, ${fails.length} failed ===`);
if (fails.length) { console.log("FAILURES:"); for (const f of fails) console.log(" - " + f); }
process.exit(fails.length ? 1 : 0);

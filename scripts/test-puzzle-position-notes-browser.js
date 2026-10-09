/**
 * Chess Study (Classic Pro puzzle screen) "Position notes" pills in a real (headless) Chrome:
 *   node scripts/test-puzzle-position-notes-browser.js        (PLAY_BASE=http://localhost:3001 to change the server)
 *
 * The bug: 630 of the 1003 puzzles have the theme text "Checkmate in N", and the Classic panel printed its own "Checkmate in N" pill and then the
 * theme pill, so the same words showed twice. The fix renders the theme pill only when it says something different.
 * It checks, with the real page and real puzzles (loaded with ?id=...&world=classic):
 *   - a puzzle whose theme equals the mate label (mate in 1, 2 and 3): "Checkmate in N" appears EXACTLY once in the Position notes panel;
 *   - a puzzle with a real theme (e.g. Back-Rank Mate): both the mate pill and the theme pill show, and they differ;
 *   - everything else in the panel survives: the "Position notes" heading, "White/Black to move" for the puzzle's side, the instruction line,
 *     the "N of 3 free puzzles left today" count, and the chessboard (64 squares);
 *   - across a sample of EVERY distinct theme in the data no panel ever shows two identical pills.
 * Read-only (dev-test QA session). Needs the dev server, Chrome and the local dev-test account; otherwise SKIPPED (exit 2).
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const ROOT = process.cwd();
const BASE = process.env.PLAY_BASE || "http://localhost:3000";
const CHROME = process.env.CHROME_PATH || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => fs.existsSync(p));
const CHILD = process.env.DEV_TEST_CHILD_ID || "222da12f-1ad4-4ac9-a9a0-6279e05827f6";
const skip = (why) => { console.log(`SKIPPED (not run): ${why}`); process.exit(2); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const l of (fs.existsSync(path.join(ROOT, ".env.local")) ? fs.readFileSync(path.join(ROOT, ".env.local"), "utf8") : "").split("\n")) {
  const t = l.trim(); if (!t || t[0] === "#") continue; const i = t.indexOf("="); if (i < 0) continue;
  let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1);
  const k = t.slice(0, i).trim(); if (!(k in process.env)) process.env[k] = v;
}
if (!CHROME) skip("Chrome not found (set CHROME_PATH)");
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) skip("Supabase env not configured");

// Load the real puzzle data (TypeScript) without a server.
const ts = require(path.join(ROOT, "node_modules", "typescript"));
const m = { exports: {} };
new Function("module", "exports", "require", ts.transpileModule(fs.readFileSync(path.join(ROOT, "content/puzzles.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(m, m.exports, () => ({}));
const PUZZLES = m.exports.PUZZLES;
const OBJECTIVE = {};
for (const x of fs.readFileSync(path.join(ROOT, "app/(tabs)/puzzles/page.tsx"), "utf8").matchAll(/^\s*(\d):\s*"([^"]+)",?$/gm)) OBJECTIVE[x[1]] = x[2];

async function openSession(cookies) {
  for (let i = 0; i < 80; i++) { try { await fetch("http://127.0.0.1:9339/json"); await sleep(250); } catch { break; } }
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "pn-"));
  const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=9339", "--user-data-dir=" + profile, "--no-first-run", "--disable-gpu", "--window-size=390,844", "about:blank"], { stdio: "ignore" });
  let tabs; for (let i = 0; i < 120; i++) { try { tabs = await (await fetch("http://127.0.0.1:9339/json")).json(); if (tabs.some((t) => t.type === "page")) break; } catch {} await sleep(250); }
  const page = tabs && tabs.find((t) => t.type === "page"); if (!page) throw new Error("could not attach to Chrome");
  const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pend = new Map(); const errs = [];
  ws.onmessage = (mm) => { const d = JSON.parse(mm.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } else if (d.method === "Runtime.exceptionThrown") errs.push((d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text).split("\n")[0].slice(0, 140)); };
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  await send("Network.enable"); await send("Runtime.enable"); await send("Page.enable");
  for (const [name, value] of cookies) await send("Network.setCookie", { name, value, url: BASE + "/", path: "/" });
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send("Page.addScriptToEvaluateOnNewDocument", { source: "try{localStorage.setItem('chessmind-mode','classic-pro')}catch(e){}" });
  const ev = async (e) => { const r = (await send("Runtime.evaluate", { expression: e, returnByValue: true })).result; if (!r) return undefined; if (r.exceptionDetails) return "ERR"; return r.result.value; };
  const waitFor = async (e, ms = 30000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(e)) return true; await sleep(250); } return false; };
  return { ev, waitFor, errs, open: async (p) => { await send("Page.navigate", { url: BASE + "/" + p }); await sleep(800); }, close() { ws.close(); chrome.kill(); chrome.unref(); try { fs.rmSync(profile, { recursive: true, force: true }); } catch {} } };
}

(async () => {
  try { await fetch(BASE + "/", { redirect: "manual" }); } catch { skip(`dev server not reachable at ${BASE}`); }
  const { createClient } = require(path.join(ROOT, "node_modules", "@supabase/supabase-js"));
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email: process.env.DEV_TEST_USER_EMAIL || "dev-test@local.chessmind.test", password: process.env.DEV_TEST_USER_PASSWORD || "dev-test-local-only-not-secret" });
  if (error) skip("dev-test account sign-in failed");
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  const cookies = [[`sb-${ref}-auth-token`, "base64-" + Buffer.from(JSON.stringify(data.session)).toString("base64url")], ["cka_active_child", CHILD]];
  let pass = 0; const fails = [];
  const check = (n, ok, d) => { if (ok) { pass++; console.log("  ok  " + n); } else { fails.push(n); console.log("FAIL " + n + (d ? " -- " + d : "")); } };

  const labelOf = (p) => `Checkmate in ${p.mateIn}`;
  console.log(`data: ${PUZZLES.length} puzzles; theme equals the mate label in ${PUZZLES.filter((p) => p.theme === labelOf(p)).length}; real themes in ${PUZZLES.filter((p) => p.theme !== labelOf(p)).length}`);
  const pickBy = (f) => PUZZLES.find(f);
  const cases = [
    ["theme = mate label, mate in 2, Black to move (the reported case)", pickBy((p) => p.mateIn === 2 && p.theme === labelOf(p) && p.sideToMove === "b")],
    ["theme = mate label, mate in 1", pickBy((p) => p.mateIn === 1 && p.theme === labelOf(p))],
    ["theme = mate label, mate in 3", pickBy((p) => p.mateIn === 3 && p.theme === labelOf(p))],
    ["real theme: Back-Rank Mate", pickBy((p) => /back.?rank/i.test(p.theme))],
    ["real theme: Anastasia's Mate", pickBy((p) => /anastasia/i.test(p.theme))],
  ];
  const s = await openSession(cookies);
  const pills = () => s.ev(`(()=>{const panel=document.querySelector('.pz-panel--classic');if(!panel)return null;const row=panel.querySelector('.flex.flex-wrap');const spans=row?[...row.children].map(e=>e.innerText.replace(/\\s+/g,' ').trim()).filter(Boolean):[];return JSON.stringify({text:panel.innerText.replace(/\\s+/g,' '),pills:spans,squares:document.querySelectorAll('[data-square]').length})})()`);
  try {
    for (const [name, p] of cases) {
      if (!p) { check(`case available: ${name}`, false, "no such puzzle in the data"); continue; }
      await s.open(`puzzles?id=${encodeURIComponent(p.id)}&world=classic`);
      let ok = await s.waitFor("(!!document.querySelector('.pz-panel--classic') && document.querySelectorAll('[data-square]').length>=64) || /free puzzles are used up/.test(document.body.innerText)", 40000);
      // A free account that has spent today's 3 puzzles sees the limit screen instead of the puzzle. The Daily Challenge path never hits that limit
      // and renders the same pills, so reload through it (the "N of 3 left" count is then not rendered by design and is not asserted).
      let daily = false;
      if (ok && (await s.ev("/free puzzles are used up/.test(document.body.innerText)"))) {
        daily = true;
        await s.open(`puzzles?id=${encodeURIComponent(p.id)}&world=classic&daily=1`);
        ok = await s.waitFor("!!document.querySelector('.pz-panel--classic') && document.querySelectorAll('[data-square]').length>=64", 40000);
      }
      check(`[${name}] puzzle ${p.id} loads in the Classic layout with its board${daily ? " (via the Daily Challenge path: today's free puzzles are used up)" : ""}`, ok);
      if (!ok) continue;
      await sleep(600);
      const info = JSON.parse(await pills());
      const label = labelOf(p);
      const occurrences = info.text.split(label).length - 1;
      check(`[${name}] "${label}" appears exactly once in the panel`, occurrences === 1, `${occurrences}x: ${JSON.stringify(info.pills)}`);
      check(`[${name}] no two pills are identical`, new Set(info.pills.map((x) => x.toLowerCase())).size === info.pills.length, JSON.stringify(info.pills));
      if (p.theme === label) check(`[${name}] only the mate pill + the side-to-move indicator remain (2 pills)`, info.pills.length === 2 && info.pills[0] === label, JSON.stringify(info.pills));
      else check(`[${name}] both the mate pill AND the real theme pill show`, info.pills.length === 3 && info.pills[0] === label && info.pills[1] === p.theme, JSON.stringify(info.pills));
      check(`[${name}] "Position notes" heading is still there`, /Position notes/i.test(info.text));
      check(`[${name}] "${p.sideToMove === "b" ? "Black" : "White"} to move" is still shown`, new RegExp(`${p.sideToMove === "b" ? "Black" : "White"} to move`, "i").test(info.text), info.text.slice(0, 160));
      check(`[${name}] the instruction line is still shown`, !OBJECTIVE[p.mateIn] || info.text.includes(OBJECTIVE[p.mateIn]) || p.mateIn === 1, `expected: ${OBJECTIVE[p.mateIn]}`);
      if (daily) console.log(`  note [${name}] the "N of 3 free puzzles left today" line is not rendered in Daily Challenge mode (by design), so it is not asserted for this puzzle`);
      else check(`[${name}] the daily puzzle count is still shown ("N of 3 free puzzles left today") or the account is Premium`, /\d of \d free puzzles left today/.test(info.text) || /Solved this session/.test(info.text), info.text.slice(-120));
      check(`[${name}] the chessboard has its 64 squares`, info.squares >= 64, String(info.squares));
    }
    // One of every distinct theme: no panel ever repeats a label.
    const byTheme = new Map(); for (const p of PUZZLES) if (!byTheme.has(p.theme + "|" + (p.theme === labelOf(p) ? p.mateIn : ""))) byTheme.set(p.theme + "|" + (p.theme === labelOf(p) ? p.mateIn : ""), p);
    const sample = [...byTheme.values()];
    let dup = [];
    for (const p of sample) {
      await s.open(`puzzles?id=${encodeURIComponent(p.id)}&world=classic&daily=1`);
      if (!(await s.waitFor("!!document.querySelector('.pz-panel--classic')", 40000))) { dup.push(p.id + " (did not load)"); continue; }
      await sleep(250);
      const info = JSON.parse(await pills());
      if (new Set(info.pills.map((x) => x.toLowerCase())).size !== info.pills.length) dup.push(`${p.id}: ${JSON.stringify(info.pills)}`);
    }
    check(`across one puzzle of every distinct theme (${sample.length} puzzles) no panel shows two identical pills`, dup.length === 0, dup.slice(0, 3).join(" | "));
    check("no JavaScript exceptions", s.errs.length === 0, s.errs.slice(0, 3).join(" | "));
  } finally { s.close(); }
  console.log(`\n=== PUZZLE POSITION NOTES: ${pass} passed, ${fails.length} failed ===`);
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.log("ERROR", e.message); process.exit(2); });

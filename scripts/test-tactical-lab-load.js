/**
 * Tactical Lab initial-load stability, in a real (headless) Chrome.
 *   node scripts/test-tactical-lab-load.js
 *
 * Needs: the dev server on http://localhost:3000, Chrome installed, and the local dev-test account
 * (scripts/dev-seed-test-user.js; override with DEV_TEST_USER_EMAIL / DEV_TEST_USER_PASSWORD).
 * It is NOT part of the offline suites: when any of that is missing it prints SKIPPED and exits 2, so a skip can
 * never be mistaken for a pass.
 *
 * What it catches -- two different problems, each of which reads as "the page shakes":
 *   A) board size oscillation: the board column resizing over and over after first paint (the fit guard and the
 *      chrome observer feeding each other);
 *   B) a PARENT moving: the whole shell (and so the board and panel with it) sliding or jumping, e.g. a shell that
 *      sits inside the padded app content instead of covering the viewport.
 * For each case it records, on every animation frame from before the first script runs, the rects of the board
 * square, the board column, the shell and the side panel, and requires: at most MAX_CHANGES board/column changes
 * (the first layout plus one legitimate resize), the shell never moving at all (it must cover the viewport from
 * its first frame), the panel settling, nothing moving once the page has settled, the board fully inside the
 * viewport (all 8 ranks), the panel inside the viewport, and no page overflow.
 *
 * Cases include browser-zoom / display-scaling geometry (fractional pixel ratios) and the exact window of the
 * recording that exposed the original shake (1456x864 viewport at 100%, 1165x691 CSS px at 125% zoom).
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = process.cwd();
const BASE = process.env.TACTICAL_LAB_BASE || "http://localhost:3000";
const CHROME = process.env.CHROME_PATH || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => fs.existsSync(p));
const MAX_CHANGES = 2;
const SETTLE_BY_MS = 6000; // the logger watches for 9s; nothing may change after this
const CASES = [
  { name: "Atelier desktop 1440x900", w: 1440, h: 900, mode: "adult" },
  { name: "Atelier desktop 1280x900", w: 1280, h: 900, mode: "adult" },
  { name: "Atelier laptop 1366x768", w: 1366, h: 768, mode: "adult" },
  { name: "Atelier short 1100x650", w: 1100, h: 650, mode: "adult" },
  { name: "Atelier recording window 1456x864", w: 1456, h: 864, mode: "adult" },
  { name: "Atelier recording window at 125% zoom 1165x691@1.25", w: 1165, h: 691, dpr: 1.25, mode: "adult" },
  { name: "Atelier 1536x730@1.25", w: 1536, h: 730, dpr: 1.25, mode: "adult" },
  { name: "Atelier 1280x649@1.5", w: 1280, h: 649, dpr: 1.5, mode: "adult" },
  { name: "Atelier /puzzles 1456x864", w: 1456, h: 864, mode: "adult", page: "/puzzles" },
  { name: "Atelier /puzzles 1165x691@1.25", w: 1165, h: 691, dpr: 1.25, mode: "adult", page: "/puzzles" },
  { name: "Atelier /puzzles 1440x900", w: 1440, h: 900, mode: "adult", page: "/puzzles" },
  { name: "Atelier tablet 800x1024", w: 800, h: 1024, mode: "adult", stacked: true },
  { name: "Atelier phone 411x914", w: 411, h: 914, mode: "adult", stacked: true },
  { name: "Atelier phone 390x844", w: 390, h: 844, mode: "adult", stacked: true },
  { name: "Classic desktop 1440x900", w: 1440, h: 900, mode: "classic" },
];

const skip = (why) => { console.log(`SKIPPED (not run): ${why}`); process.exit(2); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const l of (fs.existsSync(path.join(ROOT, ".env.local")) ? fs.readFileSync(path.join(ROOT, ".env.local"), "utf8") : "").split("\n")) {
  const t = l.trim(); if (!t || t[0] === "#") continue; const i = t.indexOf("="); if (i < 0) continue;
  let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1);
  const k = t.slice(0, i).trim(); if (!(k in process.env)) process.env[k] = v;
}
if (!CHROME) skip("Chrome not found (set CHROME_PATH)");
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) skip("Supabase env not configured");

const LOGGER = (mode) => `(()=>{try{ if(${JSON.stringify(mode)}!=='classic') localStorage.setItem('chessmind-mode',${JSON.stringify(mode)}); else localStorage.removeItem('chessmind-mode'); }catch(e){}
window.__log=[];const t0=performance.now();let last='';
const R=e=>{if(!e)return null;const r=e.getBoundingClientRect();return [+r.left.toFixed(1),+r.top.toFixed(1),+r.width.toFixed(1),+r.height.toFixed(1)]};
function sq(col){let best=null;for(const e of col.querySelectorAll('*')){const r=e.getBoundingClientRect();if(r.width>150&&Math.abs(r.width-r.height)<2&&(!best||r.width>best.w))best={w:r.width,e}}return best&&best.e}
function tick(){const col=document.querySelector('.chess-focus-board-col');
 if(col){const shell=document.querySelector('.chess-focus-shell');const panel=document.querySelector('.chess-focus-panel');const b=R(sq(col));
  const f={t:Math.round(performance.now()-t0),board:b,col:R(col),shell:R(shell),panel:R(panel),pos:shell&&getComputedStyle(shell).position};
  const key=JSON.stringify([f.board,f.col,f.shell,f.panel,f.pos]);
  if(key!==last){last=key;window.__log.push(f)}}
 if(performance.now()-t0<9000)requestAnimationFrame(tick)}
requestAnimationFrame(tick)})()`;

async function runCase(c, session) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "tl-"));
  const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=9334", "--user-data-dir=" + profile, "--no-first-run", "--disable-gpu", `--window-size=${c.w},${c.h}`, "about:blank"], { stdio: "ignore" });
  try {
    let tabs;
    for (let i = 0; i < 40; i++) { try { tabs = await (await fetch("http://127.0.0.1:9334/json")).json(); if (tabs.length) break; } catch {} await sleep(250); }
    const page = tabs && tabs.find((t) => t.type === "page");
    if (!page) throw new Error("could not attach to Chrome");
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    let id = 0; const pending = new Map();
    ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
    const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
    await send("Network.enable");
    for (const [name, value] of [[`sb-${session.ref}-auth-token`, session.val], ["cka_active_child", session.child]])
      await send("Network.setCookie", { name, value, url: BASE + "/", path: "/" });
    await send("Emulation.setDeviceMetricsOverride", { width: c.w, height: c.h, deviceScaleFactor: c.dpr || 1, mobile: false });
    await send("Page.enable");
    await send("Page.addScriptToEvaluateOnNewDocument", { source: LOGGER(c.mode) });
    const url = BASE + (c.page || "/puzzles/tactics");
    await send("Page.navigate", { url }); await sleep(Number(process.env.WARM_MS || 12000)); // dev compile
    await send("Page.navigate", { url: "about:blank" }); await sleep(400);
    await send("Page.navigate", { url }); await sleep(10500);
    const r = await send("Runtime.evaluate", { returnByValue: true, expression: "JSON.stringify({vh:innerHeight,vw:innerWidth,docW:document.documentElement.scrollWidth,docH:document.documentElement.scrollHeight,log:window.__log||[]})" });
    ws.close();
    return JSON.parse(r.result.result.value);
  } finally {
    chrome.kill();
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
  }
}

(async () => {
  try { await fetch(BASE + "/", { redirect: "manual" }); } catch { skip(`dev server not reachable at ${BASE}`); }
  const { createClient } = require(path.join(ROOT, "node_modules", "@supabase/supabase-js"));
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.signInWithPassword({
    email: process.env.DEV_TEST_USER_EMAIL || "dev-test@local.chessmind.test",
    password: process.env.DEV_TEST_USER_PASSWORD || "dev-test-local-only-not-secret",
  });
  if (error) skip("dev-test account sign-in failed (run scripts/dev-seed-test-user.js)");
  const session = {
    ref: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0],
    val: "base64-" + Buffer.from(JSON.stringify(data.session)).toString("base64url"),
    child: process.env.DEV_TEST_CHILD_ID || "222da12f-1ad4-4ac9-a9a0-6279e05827f6",
  };

  let pass = 0; const fails = [];
  const check = (n, ok, d) => { if (ok) pass++; else { fails.push(n + (d ? " -- " + d : "")); console.log("FAIL:", n, d || ""); } };
  const distinct = (log, k) => new Set(log.map((f) => JSON.stringify(f[k]))).size;
  const only = process.env.CASE_FILTER;
  for (const c of CASES.filter((x) => !only || x.name.includes(only))) {
    const out = await runCase(c, session);
    const L = out.log;
    const n = L.length;
    const last = L[n - 1];
    const boardChanges = n ? 1 + L.slice(1).filter((f, i) => JSON.stringify([f.board, f.col]) !== JSON.stringify([L[i].board, L[i].col])).length : 0;
    console.log(`${c.name}: ${n} frame change(s), board/column changed ${boardChanges}x, shell ${distinct(L, "shell")} rect(s), panel ${distinct(L, "panel")} rect(s), settled at ${last ? last.t : "?"}ms, board ${last && last.board ? last.board[2] : "?"}px`);
    check(`${c.name}: the board mounted`, n > 0);
    if (!last) continue;
    check(`${c.name}: A) the board column changes at most ${MAX_CHANGES}x (first layout + one resize)`, boardChanges <= MAX_CHANGES, `${boardChanges} changes: ${L.slice(0, 5).map((f) => f.t + "ms board=" + f.board).join(" | ")}`);
    check(`${c.name}: B) the shell never moves (one rect from its first frame)`, distinct(L, "shell") === 1, `${distinct(L, "shell")} rects: ${[...new Set(L.map((f) => JSON.stringify(f.shell)))].slice(0, 4).join(" | ")}`);
    check(`${c.name}: B) the shell covers the viewport at the origin`, !last.shell || (last.shell[0] === 0 && last.shell[1] === 0 && Math.abs(last.shell[2] - out.vw) <= 1 && Math.abs(last.shell[3] - out.vh) <= 1), `shell ${last.shell} in ${out.vw}x${out.vh}`);
    check(`${c.name}: B) the shell is position: fixed`, last.pos === "fixed", `position ${last.pos}`);
    check(`${c.name}: the panel settles (at most 2 positions)`, distinct(L, "panel") <= 2, `${distinct(L, "panel")} rects`);
    check(`${c.name}: nothing moves once settled (last change before ${SETTLE_BY_MS}ms)`, last.t < SETTLE_BY_MS, `last change at ${last.t}ms`);
    check(`${c.name}: the whole board is inside the viewport (all 8 ranks)`, last.board[1] + last.board[3] <= out.vh + 0.5 && last.board[1] >= -0.5, `board ${last.board} in ${out.vw}x${out.vh}`);
    check(`${c.name}: the side panel is inside the viewport`, c.stacked || !last.panel || last.panel[0] + last.panel[2] <= out.vw + 0.5, `panel ${last.panel} in ${out.vw}`);
    check(`${c.name}: no page overflow`, out.docW <= out.vw && out.docH <= out.vh + 1, `doc ${out.docW}x${out.docH} in ${out.vw}x${out.vh}`);
  }
  console.log(`\n${pass} checks passed, ${fails.length} failed`);
  if (fails.length) { console.log(fails.map((f) => " - " + f).join("\n")); process.exit(1); }
  process.exit(0);
})();

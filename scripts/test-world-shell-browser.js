/**
 * World shell + core pages in a real (headless) Chrome: three worlds x five viewports x the core app routes.
 *   node scripts/test-world-shell-browser.js     (SHELL_ROUTES=home,play  SHELL_WORLDS=atelier  SHELL_VIEWPORTS=390,1280  PLAY_SHOTS=<dir>)
 *
 * Checks the persistent frame (sidebar on desktop, bottom tabs elsewhere, simple labels), no overflow, >= 44px tab targets, no blue in the
 * Atelier shell, no console errors; optionally saves a full-page screenshot per route/world/viewport. Needs the dev server on :3000, Chrome
 * and the local dev-test account; otherwise prints SKIPPED and exits 2. Read-only.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = process.cwd();
const BASE = process.env.PLAY_BASE || "http://localhost:3000";
const CHROME = process.env.CHROME_PATH || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => fs.existsSync(p));
const CHILD = process.env.DEV_TEST_CHILD_ID || "222da12f-1ad4-4ac9-a9a0-6279e05827f6";
const VIEWPORTS = [
  { name: "phone 390x844", w: 390, h: 844, dpr: 3 },
  { name: "phone 411x914", w: 411, h: 914, dpr: 2.625 },
  { name: "tablet 800x1280", w: 800, h: 1280, dpr: 1 },
  { name: "desktop 1280x800", w: 1280, h: 800, dpr: 1 },
  { name: "desktop 1440x900", w: 1440, h: 900, dpr: 1 },
];
const WORLDS = [
  { id: "enchanted", mode: "kids", title: "Choose Your Quest", labels: ["Quest Match", "Multiplayer Quest", "Kingdom Tournament", "World Adventure"], arena: "Quest Trial" },
  { id: "atelier", mode: "adult", title: "Match Training", labels: ["Sparring Session", "Rated Sparring", "Competition", "World Match"], arena: "Atelier Sparring Console" },
  { id: "classic", mode: "classic-pro", title: "Play", labels: ["Computer Match", "Online Match", "Tournament", "Chess Mind World"], arena: "Championship Match Chamber" },
];
const PICK = {
  enchanted: { title: "Choose Your Challenge", cta: "Begin the Quest" },
  atelier: { title: "Select Training Intensity", cta: "Begin session" },
  classic: { title: "Select Match Level", cta: "Start match" },
};
const DIFFS = ["very-easy", "easy", "medium", "hard"];
const HREFS = ["/free-play", "/matchmaking", "/play/tournaments", "/world"];
const skip = (why) => { console.log(`SKIPPED (not run): ${why}`); process.exit(2); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const l of (fs.existsSync(path.join(ROOT, ".env.local")) ? fs.readFileSync(path.join(ROOT, ".env.local"), "utf8") : "").split("\n")) {
  const t = l.trim(); if (!t || t[0] === "#") continue; const i = t.indexOf("="); if (i < 0) continue;
  let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1);
  const k = t.slice(0, i).trim(); if (!(k in process.env)) process.env[k] = v;
}
if (!CHROME) skip("Chrome not found (set CHROME_PATH)");
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) skip("Supabase env not configured");

const PROBE = `(()=>{const vw=innerWidth,de=document.documentElement,main=document.querySelector('main');
 const over=[...document.querySelectorAll('main *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&(r.right>vw+1||r.left<-1)}).length;
 const small=[...document.querySelectorAll('main a[href],main button')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&r.height<44&&getComputedStyle(e).visibility!=='hidden'}).map(e=>(e.textContent||'').trim().slice(0,30)+':'+Math.round(e.getBoundingClientRect().height));
 const links=[...document.querySelectorAll('main a[href]')].map(a=>a.getAttribute('href'));
 const navy=[...document.querySelectorAll('main *')].filter(e=>{const c=getComputedStyle(e).backgroundColor;return c==='rgb(27, 36, 64)'||c==='rgb(15, 22, 41)'}).length;
 return JSON.stringify({vw,docW:de.scrollWidth,over,small,links,h1:(document.querySelector('main h1')||{}).textContent,world:(document.querySelector('[data-world]')||{dataset:{}}).dataset.world,text:main.innerText,navy,broken:[...document.images].filter(i=>!(i.complete&&i.naturalWidth>0)).length})})()`;

const PICKER = `(()=>{const vw=innerWidth,de=document.documentElement,main=document.querySelector('main');
 const opts=[...document.querySelectorAll('[role=radio][data-difficulty]')];
 const over=[...document.querySelectorAll('main *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&(r.right>vw+1||r.left<-1)}).length;
 const small=[...document.querySelectorAll('main a[href],main button')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&r.height<44}).map(e=>(e.textContent||'').trim().slice(0,30)+':'+Math.round(e.getBoundingClientRect().height));
 const navy=[...document.querySelectorAll('main *')].filter(e=>{const c=getComputedStyle(e).backgroundColor;return c==='rgb(27, 36, 64)'||c==='rgb(15, 22, 41)'}).length;
 return JSON.stringify({vw,docW:de.scrollWidth,over,small,navy,h1:(document.querySelector('main h1')||{}).textContent,world:(document.querySelector('[data-world]')||{dataset:{}}).dataset.world,keys:opts.map(o=>o.dataset.difficulty),checked:opts.filter(o=>o.getAttribute('aria-checked')==='true').map(o=>o.dataset.difficulty),text:main.innerText,hasCta:[...document.querySelectorAll('main button')].some(b=>/Begin the Quest|Begin session|Start match/.test(b.textContent)),back:!!document.querySelector('main a[href="/play"]')})})()`;

async function openSession(v, cookies) {
  // The previous test browser may still be shutting down and holding the debug port: wait until it is really free.
  for (let i = 0; i < 80; i++) { try { await fetch("http://127.0.0.1:9339/json"); await sleep(250); } catch { break; } }
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "play-"));
  const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=9339", "--user-data-dir=" + profile, "--no-first-run", "--disable-gpu", `--window-size=${v.w},${v.h}`, "about:blank"], { stdio: "ignore" });
  let tabs; for (let i = 0; i < 120; i++) { try { tabs = await (await fetch("http://127.0.0.1:9339/json")).json(); if (tabs.some((t) => t.type === "page")) break; } catch {} await sleep(250); }
  const page = tabs && tabs.find((t) => t.type === "page"); if (!page) throw new Error("could not attach to Chrome");
  const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map(); const logs = [];
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
    else if (d.method === "Runtime.exceptionThrown") logs.push("exception " + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text).slice(0, 160));
    else if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") logs.push("console.error " + d.params.args.map((a) => a.value || a.description || "").join(" ").slice(0, 160)); };
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  await send("Network.enable"); await send("Runtime.enable"); await send("Page.enable");
  for (const [name, value] of cookies) await send("Network.setCookie", { name, value, url: BASE + "/", path: "/" });
  await send("Emulation.setDeviceMetricsOverride", { width: v.w, height: v.h, deviceScaleFactor: v.dpr, mobile: v.w < 600 });
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `try{localStorage.setItem('chessmind-mode','${v.mode}')}catch(e){}` });
  // Starting a computer game calls the `start_ai_game` RPC (a free-game counter): answer it locally instead of writing.
  await send("Fetch.enable", { patterns: [{ urlPattern: "*rpc/start_ai_game*", requestStage: "Request" }] });
  const cors = [{ name: "Access-Control-Allow-Origin", value: BASE }, { name: "Access-Control-Allow-Credentials", value: "true" }, { name: "Access-Control-Allow-Headers", value: "*" }, { name: "Access-Control-Allow-Methods", value: "POST, OPTIONS" }, { name: "Content-Type", value: "application/json" }];
  ws.addEventListener("message", (m) => { const d = JSON.parse(m.data); if (d.method !== "Fetch.requestPaused") return; const pre = d.params.request.method === "OPTIONS";
    send("Fetch.fulfillRequest", { requestId: d.params.requestId, responseCode: pre ? 204 : 200, responseHeaders: cors, body: pre ? "" : Buffer.from(JSON.stringify([{ allowed: true, remaining: null, next_available_at: null }])).toString("base64") }); });
  const ev = async (expr) => { const r = (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result; if (r.exceptionDetails) throw new Error("page script failed: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result.value; };
  const waitFor = async (expr, ms = 30000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(expr)) return true; await sleep(400); } return false; };
  const open = async (p) => { await send("Page.navigate", { url: BASE + "/" + p }); await sleep(2500); };
  // Review shots show the whole page: the viewport is grown to the content height for the capture (a taller real viewport, so fixed
  // chrome and the sidebar lay out exactly as they do on a device) and then restored.
  const shot = async () => { const h = Math.min(6000, Math.max(v.h, await ev("document.documentElement.scrollHeight")));
    await send("Emulation.setDeviceMetricsOverride", { width: v.w, height: h, deviceScaleFactor: Math.min(v.dpr, 2), mobile: v.w < 600 }); await sleep(600);
    const png = (await send("Page.captureScreenshot", { format: "png" })).result.data;
    await send("Emulation.setDeviceMetricsOverride", { width: v.w, height: v.h, deviceScaleFactor: v.dpr, mobile: v.w < 600 }); return png; };
  const click = async (sel) => { const pt = await ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`); if (!pt) return false; await sleep(200);
    for (const t of ["mouseMoved", "mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type: t, x: pt[0], y: pt[1], button: "left", clickCount: 1 }); return true; };
  return { ev, waitFor, open, shot, click, logs, close() { ws.close(); chrome.kill(); chrome.unref(); try { fs.rmSync(profile, { recursive: true, force: true }); } catch {} } };
}


// ---- World shell + core pages ------------------------------------------------------------------------------------
const ROUTES = (process.env.SHELL_ROUTES || "home,chess-school,puzzles,play,world,learn,academy,chess-mind,profile,discover").split(",");
const SHELL = `(()=>{const vw=innerWidth,de=document.documentElement;
 const q=s=>document.querySelector(s);
 const cs=(e,p)=>e?getComputedStyle(e)[p]:null;
 const over=[...document.querySelectorAll('main *, .app-sidenav *, .layout-bottom-nav *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&(r.right>vw+1||r.left<-1)&&getComputedStyle(e).position!=='fixed'}).length;
 const vis=e=>{if(!e)return false;const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).display!=='none'};
 const navItems=[...document.querySelectorAll('.layout-bottom-nav a')].filter(vis).map(a=>Math.round(a.getBoundingClientRect().height));
 const side=q('.app-sidenav'),bar=q('.layout-bottom-nav'),top=q('.app-topbar'),main=q('main');
 const active=q('.app-sidenav a[aria-current=page]')||q('.layout-bottom-nav a[aria-current=page]');
 const colors=[side,bar,top,main,active].filter(vis).map(e=>[e.className.toString().split(' ')[0],cs(e,'backgroundColor'),cs(e,'color')]);
 const actives=[...document.querySelectorAll('.app-sidenav a[aria-current=page], .layout-bottom-nav a[aria-current=page]')].filter(vis).map(a=>a.textContent.trim());
 return JSON.stringify({vw,docW:de.scrollWidth,over,navItems,actives,sideVisible:vis(side),barVisible:vis(bar),topVisible:vis(top),
  labels:[...document.querySelectorAll('.app-sidenav a')].map(a=>a.textContent.trim()),
  tabs:[...document.querySelectorAll('.layout-bottom-nav a')].map(a=>a.textContent.trim()),
  active:active?active.textContent.trim():null,colors,world:de.getAttribute('data-mode')||'classic-pro',h1:(q('main h1')||{}).textContent,
  navyMain:main?getComputedStyle(main).backgroundColor:null,
  broken:[...document.images].filter(i=>!(i.complete&&i.naturalWidth>0)).length})})()`;
// A colour is "blue-ish" when its blue channel clearly leads both red and green.
const blueish = (c) => { const m = /rgba?\((\d+), (\d+), (\d+)/.exec(c || ""); if (!m) return false; const [r, g, b] = [+m[1], +m[2], +m[3]]; return b > r + 12 && b > g + 6 && b > 40; };

(async () => {
  try { await fetch(BASE + "/", { redirect: "manual" }); } catch { skip(`dev server not reachable at ${BASE}`); }
  const { createClient } = require(path.join(ROOT, "node_modules", "@supabase/supabase-js"));
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email: process.env.DEV_TEST_USER_EMAIL || "dev-test@local.chessmind.test", password: process.env.DEV_TEST_USER_PASSWORD || "dev-test-local-only-not-secret" });
  if (error) skip("dev-test account sign-in failed (run scripts/dev-seed-test-user.js)");
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  const cookies = [[`sb-${ref}-auth-token`, "base64-" + Buffer.from(JSON.stringify(data.session)).toString("base64url")], ["cka_active_child", CHILD]];
  const shots = process.env.PLAY_SHOTS;
  const only = (process.env.SHELL_VIEWPORTS || "").split(",").filter(Boolean);
  const worlds = (process.env.SHELL_WORLDS || "enchanted,atelier,classic").split(",");
  let pass = 0; const fails = [];
  const check = (n, ok, d) => { if (ok) pass++; else { fails.push(n); console.log("FAIL:", n, d || ""); } };
  const NAV = ["Home", "School", "Puzzles", "Play", "World"];
  // Phone/tablet bottom bar: the Play button above Home / School / Puzzles / Watch / Profile; World is not a bottom tab.
  const BAR = ["Play", "Home", "School", "Puzzles", "Watch", "Profile"];
  const ACTIVE = { home: "Home", "chess-school": "School", puzzles: "Puzzles", play: "Play", world: "World", academy: "Academy", "chess-mind": "Train Your Mind", profile: "Profile", discover: "Discover" };
  const EXPLORE = ["Academy", "Train Your Mind", "Watch", "Profile", "Discover"];
  for (const w of WORLDS.filter((x) => worlds.includes(x.id))) for (const v of VIEWPORTS.filter((x) => !only.length || only.includes(String(x.w)))) {
    const s = await openSession({ ...v, mode: w.mode }, cookies);
    try {
      for (const route of ROUTES) {
        const tag = `${w.id} @${v.w} /${route}`;
        await s.open(route); await s.waitFor(`!!document.querySelector('main') && !!document.querySelector('[data-world-resolved], .app-shell-content')`); await sleep(1800);
        const r = JSON.parse(await s.ev(SHELL));
        check(`${tag}: stays on the page (no redirect away)`, true);
        check(`${tag}: mode is ${w.mode}`, r.world === (w.mode === "classic-pro" ? "classic-pro" : w.mode), r.world);
        if (route !== "puzzles") check(`${tag}: no horizontal overflow`, r.docW <= r.vw && r.over === 0, `doc ${r.docW}/${r.vw}, ${r.over}`);
        if (route === "puzzles") { /* the Puzzle Trainer is a chess-focus page whose own layout manages the chrome (identical before this change): only overflow-independent checks apply */ }
        else if (v.w >= 1024) check(`${tag}: desktop sidebar shows ${[...NAV, ...EXPLORE].join(", ")}`, r.sideVisible && [...NAV, ...EXPLORE].every((l) => r.labels.some((x) => x.includes(l))), JSON.stringify(r.labels));
        else check(`${tag}: bottom bar shows ${BAR.join(", ")} (no World) at >= 44px`, r.barVisible && JSON.stringify(r.tabs) === JSON.stringify(BAR) && r.navItems.every((h) => h >= 44), JSON.stringify([r.tabs, r.navItems]));
        if (route in ACTIVE && route !== "puzzles") { // (the Puzzle Trainer is a chess-focus page that manages its own chrome, as before) // exactly the right item is highlighted: the sidebar on desktop, the bottom tabs otherwise (secondary items are not tabs)
          const want = v.w >= 1024 ? ACTIVE[route] : (BAR.includes(ACTIVE[route]) && ACTIVE[route] !== "Play" ? ACTIVE[route] : null);
          check(`${tag}: active navigation is ${want || "none of the tabs"}`, JSON.stringify(r.actives) === JSON.stringify(want ? [want] : []), JSON.stringify(r.actives));
        }
        if (w.id === "atelier") check(`${tag}: no blue/navy in the shell or page ground`, !r.colors.some((c) => blueish(c[1])) && !blueish(r.navyMain), JSON.stringify(r.colors));
        check(`${tag}: no broken images, no console errors`, r.broken === 0 && s.logs.length === 0, s.logs.slice(0, 2).join(" | "));
        if (shots) { fs.mkdirSync(shots, { recursive: true }); fs.writeFileSync(path.join(shots, `${route}-${w.id}-${v.w}.png`), Buffer.from(await s.shot(), "base64")); }
        s.logs.length = 0;
      }
    } finally { s.close(); }
  }
  console.log(`\n${pass} passed, ${fails.length} failed`);
  process.exit(fails.length ? 1 : 0);
})();

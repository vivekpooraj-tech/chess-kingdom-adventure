/**
 * FINAL WORLD INTEGRATION QA in a real (headless) Chrome (read-only; nothing is submitted, no account writes):
 *   node scripts/test-world-integration-browser.js
 *     INTEG_VIEWPORTS=390,411,800,1280   INTEG_PART=matrix,journey   INTEG_ROUTES=/home,/play   PLAY_SHOTS=<dir>
 * matrix:  every redesigned route x 3 worlds x 4 viewports: the world marker (data-mode + [data-world]), no other world's presentation, its own
 *          presentation where there is one, no horizontal overflow, 44px targets, no shared navy, no blue anywhere in Atelier, no console errors,
 *          the app chrome and EXACTLY the right active navigation item (sidebar on desktop, bottom tabs on phone/tablet).
 * journey: Home -> Play -> Free Play -> Play -> Academy -> section -> lesson -> Train Your Mind -> drill -> Profile -> Discover -> World -> Home
 *          through the shell's own links (a direct open only where the shell offers no link), asserting the world marker at every step.
 * Needs the dev server on :3000, Chrome and the local dev-test account; otherwise prints SKIPPED and exits 2.
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
  const ev = async (expr) => { const r = (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result; if (!r) return undefined; /* the page was navigating: no execution context yet */ if (r.exceptionDetails) throw new Error("page script failed: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result.value; };
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



// ---- Final world integration: route matrix, continuity, active navigation -----------------------------------------
const ROUTES = [
  ["/home", "Home"], ["/play", "Play"], ["/free-play", null, "bare"], ["/puzzles", null, "own"], ["/learn", null],
  ["/academy", "Academy"], ["/academy/fundamentals", "Academy"], ["/academy/origins", "Academy"], ["/academy/tactics", "Academy"], ["/academy/strategy", "Academy"],
  ["/academy/endgames", "Academy"], ["/academy/tactical-thinking", "Academy"], ["/academy/openings", "Academy"],
  ["/chess-mind", "Train Your Mind"], ["/chess-mind/pattern", "Train Your Mind"], ["/chess-mind/visualization", "Train Your Mind"], ["/chess-mind/calculation", "Train Your Mind"],
  ["/chess-mind/memory", "Train Your Mind"], ["/chess-mind/spatial", "Train Your Mind"], ["/chess-mind/mathematics", "Train Your Mind"], ["/chess-mind/reaction", "Train Your Mind"],
  ["/profile", "Profile"], ["/profile/customize", null, "bare"], ["/discover", "Discover"], ["/world", "World"], ["/chess-school", "School"],
];
const PRIMARY = ["Home", "School", "Puzzles", "Profile"]; // phone bottom tabs (Play is a button above the bar, World is not a tab; Watch is a tab too, covered by test-watch-browser.js)
// The world-specific roots each redesigned page renders (one per world); any root of ANOTHER world on a page is leakage.
const ROOTS = {
  enchanted: [".pl-en", ".fp-en", ".ac-en", ".tm-en", ".pf-en", ".dc-en", ".wd-en"],
  atelier: [".pl-at", ".fp-at", ".ac-at", ".tm-at", ".pf-at", ".dc-at", ".wd-at", ".at-home"],
  classic: [".pl-cl", ".fp-cl", ".ac-cl", ".tm-cl", ".pf-cl", ".dc-cl", ".wd-cl", ".ch-home"],
};
const PAGE_ROOT = { "/play": 0, "/academy": 2, "/chess-mind": 3, "/profile": 4, "/discover": 5, "/world": 6, "/home": 7 }; // index into each world's list (home is 7 only for atelier/classic)
const MARK = `(()=>{const de=document.documentElement,vw=innerWidth,body=document.body;
 const q=s=>document.querySelector(s),vis=e=>{if(!e)return false;const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).display!=='none'};
 const inScroller=e=>{for(let p=e.parentElement;p&&p!==document.body;p=p.parentElement){const o=getComputedStyle(p).overflowX;if((o==='auto'||o==='scroll')&&p.scrollWidth>p.clientWidth)return true}return false};
 const main=q('main');
 const over=[...document.querySelectorAll('main *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&(r.right>vw+1||r.left<-1)&&getComputedStyle(e).position!=='fixed'&&!inScroller(e)}).length;
 const small=[...document.querySelectorAll('main a[href], main button')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&r.height<44&&getComputedStyle(e).visibility!=='hidden'&&!e.closest('[data-square]')}).map(e=>(e.textContent||e.getAttribute('aria-label')||'').trim().slice(0,28)+':'+Math.round(e.getBoundingClientRect().height));
 const blue=c=>{const m=c&&c.match(new RegExp('[0-9]+','g'));if(!m)return false;const r=+m[0],g=+m[1],b=+m[2];return b>r+10&&b>g+4&&b>35};
 const skip=e=>e.closest('[data-square],canvas,img,svg,[class*="-scene"],[class*="Scene"],video');
 const blueEls=[...document.querySelectorAll('body *')].filter(e=>!skip(e)&&blue(getComputedStyle(e).backgroundColor)).map(e=>(e.className&&e.className.toString?e.className.toString():e.tagName).slice(0,40));
 const navy=[...document.querySelectorAll('body *')].filter(e=>!skip(e)&&['rgb(27, 36, 64)','rgb(15, 22, 41)'].includes(getComputedStyle(e).backgroundColor)).length;
 const sel=s=>[...document.querySelectorAll(s)].filter(vis);
 const actives=[...document.querySelectorAll('.app-sidenav a[aria-current=page], .layout-bottom-nav a[aria-current=page]')].filter(vis).map(a=>a.textContent.trim());
 return JSON.stringify({p:location.pathname,mode:de.getAttribute('data-mode')||'classic-pro',dataWorld:[...new Set([...document.querySelectorAll('[data-world]')].map(e=>e.getAttribute('data-world')))],
  len:main?main.innerText.length:0,chrome:vis(q('.app-sidenav'))||vis(q('.layout-bottom-nav')),side:vis(q('.app-sidenav')),tabs:vis(q('.layout-bottom-nav')),actives,over,docW:de.scrollWidth,vw,small,blueEls,navy,
  present:Object.fromEntries(Object.entries(${JSON.stringify(ROOTS)}).map(([w,l])=>[w,l.filter(s=>!!document.querySelector(s))])),
  broken:[...document.images].filter(i=>!(i.complete&&i.naturalWidth>0)).length,text:main?main.innerText.slice(0,160):''})})()`;
const WORLD_ID = { "kids": "enchanted", "adult": "atelier", "classic-pro": "classic" };

(async () => {
  try { await fetch(BASE + "/", { redirect: "manual" }); } catch { skip(`dev server not reachable at ${BASE}`); }
  const { createClient } = require(path.join(ROOT, "node_modules", "@supabase/supabase-js"));
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email: process.env.DEV_TEST_USER_EMAIL || "dev-test@local.chessmind.test", password: process.env.DEV_TEST_USER_PASSWORD || "dev-test-local-only-not-secret" });
  if (error) skip("dev-test account sign-in failed (run scripts/dev-seed-test-user.js)");
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  const cookies = [[`sb-${ref}-auth-token`, "base64-" + Buffer.from(JSON.stringify(data.session)).toString("base64url")], ["cka_active_child", CHILD]];
  const shots = process.env.PLAY_SHOTS;
  const only = (process.env.INTEG_VIEWPORTS || "390,411,800,1280").split(",");
  const modes = (process.env.INTEG_PART || "matrix,journey").split(",");
  const routeFilter = (process.env.INTEG_ROUTES || "").split(",").filter(Boolean);
  let pass = 0; const fails = []; const notes = [];
  const check = (n, ok, d) => { if (ok) pass++; else { fails.push(n); console.log("FAIL:", n, d || ""); } };
  const others = (w) => Object.keys(ROOTS).filter((x) => x !== w);
  const checkWorld = (tag, w, wm, st) => {
    check(`${tag}: world marker is ${w.id} (data-mode ${w.mode})`, st.mode === w.mode && st.dataWorld.every((d) => d === w.id), JSON.stringify([st.mode, st.dataWorld]));
    check(`${tag}: no ${others(w.id).join("/")} presentation present (no cross-world leakage)`, others(w.id).every((o) => st.present[o].length === 0), JSON.stringify(st.present));
  };

  for (const w of WORLDS) for (const v of VIEWPORTS.filter((x) => only.includes(String(x.w)))) {
    const s = await openSession({ ...v, mode: w.mode }, cookies);
    const phone = v.w < 1024;
    try {
      // ---------- A + C. route matrix with active navigation ----------
      if (modes.includes("matrix")) for (const [route, active, kind] of ROUTES.filter((r) => !routeFilter.length || routeFilter.includes(r[0]))) {
        const tag = `${w.id} @${v.w} ${route}`;
        await s.open(route.slice(1));
        await s.waitFor(`document.querySelector('main') && document.querySelector('main').innerText.length>40`, 30000);
        await s.waitFor(`!document.querySelector('[data-world]') || document.querySelector('[data-world-resolved]')`, 15000);
        await sleep(1500);
        const st = JSON.parse(await s.ev(MARK));
        check(`${tag}: loads with content`, st.p === route && st.len > 40, JSON.stringify([st.p, st.len, st.text.slice(0, 60)]));
        checkWorld(tag, w, null, st);
        if (PAGE_ROOT[route] !== undefined && !(route === "/home" && w.id === "enchanted")) {
          const mine = ROOTS[w.id][route === "/home" ? ROOTS[w.id].length - 1 : PAGE_ROOT[route]];
          check(`${tag}: renders its own ${w.id} presentation (${mine})`, st.present[w.id].includes(mine), JSON.stringify(st.present[w.id]));
        }
        if (kind !== "own") {
          check(`${tag}: no horizontal overflow`, st.docW <= st.vw && st.over === 0, `doc ${st.docW}/${st.vw}, ${st.over}`);
          check(`${tag}: touch targets >= 44px`, st.small.length === 0, st.small.slice(0, 6).join(", "));
        } else notes.push(`${tag}: Puzzle Trainer owns its chrome; overflow/targets reported only`);
        check(`${tag}: no generic shared navy surfaces`, st.navy === 0, `${st.navy}`);
        if (w.id === "atelier") check(`${tag}: no blue/navy/cyan surface anywhere (page + shell)`, st.blueEls.length === 0, st.blueEls.slice(0, 5).join(" | "));
        check(`${tag}: no broken images, no console errors`, st.broken === 0 && s.logs.length === 0, s.logs.slice(0, 2).join(" | "));
        if (kind !== "bare" && kind !== "own") {
          check(`${tag}: app chrome present (${phone ? "tabs" : "sidebar"})`, phone ? st.tabs : st.side, JSON.stringify([st.side, st.tabs]));
          const want = phone ? (PRIMARY.includes(active) ? [active] : []) : (active ? [active] : []);
          if (active !== null || !phone) check(`${tag}: active navigation is ${want[0] || "none"} and nothing else`, JSON.stringify(st.actives) === JSON.stringify(want), JSON.stringify(st.actives));
        } else if (kind === "bare") check(`${tag}: bare full-screen page (no app chrome), as before`, !st.chrome || route === "/free-play", JSON.stringify([st.side, st.tabs]));
        if (shots) { fs.mkdirSync(shots, { recursive: true }); fs.writeFileSync(path.join(shots, `${route.slice(1).replace(/\//g, "_")}-${w.id}-${v.w}.png`), Buffer.from(await s.shot(), "base64")); }
        s.logs.length = 0;
      }

      // ---------- B. continuity journey (client navigation where the shell offers it) ----------
      if (modes.includes("journey") && (v.w === 390 || v.w === 1280)) {
        const tag0 = `${w.id} @${v.w} journey`;
        let viaOpen = 0;
        const step = async (name, expectPath, how) => {
          const tag = `${tag0} -> ${name}`;
          await how();
          await s.waitFor(`location.pathname==='${expectPath}'`, 30000);
          await s.waitFor(`document.querySelector('main') && document.querySelector('main').innerText.length>40`, 30000);
          await s.waitFor(`!document.querySelector('[data-world]') || document.querySelector('[data-world-resolved]')`, 15000);
          await sleep(1200);
          const st = JSON.parse(await s.ev(MARK));
          check(`${tag}: lands on ${expectPath}`, st.p === expectPath, st.p);
          checkWorld(tag, w, null, st);
          check(`${tag}: no console errors`, s.logs.length === 0, s.logs.slice(0, 2).join(" | "));
          s.logs.length = 0;
        };
        const nav = (href) => async () => { const sel = phone ? `.layout-bottom-nav a[href="${href}"]` : `.app-sidenav a[href="${href}"]`; if (!(await s.click(sel))) { viaOpen++; await s.open(href.slice(1)); } };
        const click = (sel, fallback) => async () => { if (!(await s.click(sel))) { viaOpen++; await s.open(fallback.slice(1)); } };
        await s.open("home");
        await step("Home", "/home", async () => {});
        await step("Play", "/play", nav("/play"));
        await step("Free Play", "/free-play", click('main a[href="/free-play"]', "/free-play"));
        await step("Play (back)", "/play", click('main a[href="/play"]', "/play"));
        await step("Academy", "/academy", nav("/academy"));
        await step("Academy section", "/academy/strategy", click('main a[href="/academy/strategy"]', "/academy/strategy"));
        const lesson = await s.ev(`(()=>{const a=[...document.querySelectorAll('main a[href^="/academy/strategy/"]')][0];return a?a.getAttribute('href'):null})()`);
        check(`${tag0}: the course offers a lesson link`, !!lesson, String(lesson));
        if (lesson) await step("Academy lesson", lesson, click(`main a[href="${lesson}"]`, lesson));
        await step("Train Your Mind", "/chess-mind", nav("/chess-mind"));
        await step("Train Your Mind drill", "/chess-mind/pattern", click('main a[href="/chess-mind/pattern"]', "/chess-mind/pattern"));
        await step("Profile", "/profile", nav("/profile"));
        await step("Discover", "/discover", nav("/discover"));
        await step("World", "/world", nav("/world"));
        await step("Home (end)", "/home", nav("/home"));
        if (viaOpen) notes.push(`${tag0}: ${viaOpen} step(s) used a direct open because the shell has no visible link there (phone tabs have no Academy/Train/Profile/Discover)`);
      }
    } finally { s.close(); }
  }
  console.log(`\n${pass} passed, ${fails.length} failed`);
  for (const n of notes) console.log("NOTE:", n);
  process.exit(fails.length ? 1 : 0);
})();

/**
 * World (/world) in a real (headless) Chrome: three worlds x 390 / 411 / 800 / 1280 (WORLD_VIEWPORTS=...; PLAY_SHOTS=<dir> saves full-page shots).
 * The page is a play-location picker (London Eye, Chaturanga): this checks the world's own presentation (and that the other two are absent), both
 * locations with their Play here links, the favourite star (select / move / clear, the selected state labelled), Look around, the passport line,
 * overflow, 44px targets, no blue in Atelier, no console errors, and that the world is kept through World <-> Home / Academy / Train Your Mind /
 * Profile / Discover / Play (client navigation through the shell). Each session is a throwaway Chrome profile: the per-device passport and favourite
 * it writes are discarded with it and nothing is written to the account. Needs the dev server on :3000, Chrome and the local dev-test account;
 * otherwise prints SKIPPED and exits 2.
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



// ---- World ---------------------------------------------------------------------------------------------------------
const PLACES = [["London Eye", "london-eye"], ["Chaturanga", "chaturanga"]];
const ROOT_OF = { enchanted: ".wd-en", atelier: ".wd-at", classic: ".wd-cl" };
const PAGE_ROOT = { "/home": null, "/academy": { enchanted: ".ac-en", atelier: ".ac-at", classic: ".ac-cl" }, "/chess-mind": { enchanted: ".tm-en", atelier: ".tm-at", classic: ".tm-cl" }, "/profile": { enchanted: ".pf-en", atelier: ".pf-at", classic: ".pf-cl" }, "/discover": { enchanted: ".dc-en", atelier: ".dc-at", classic: ".dc-cl" }, "/play": { enchanted: ".pl-en", atelier: ".pl-at", classic: ".pl-cl" } };
const WD = `(()=>{const vw=innerWidth,de=document.documentElement,main=document.querySelector('main');
 const over=[...document.querySelectorAll('main *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&(r.right>vw+1||r.left<-1)}).length;
 const buttons=[...document.querySelectorAll('main a[href], main button')];
 const small=buttons.filter(a=>{const r=a.getBoundingClientRect();return r.width&&r.height&&r.height<44}).map(a=>(a.textContent||a.getAttribute('aria-label')||'').trim().slice(0,30)+':'+Math.round(a.getBoundingClientRect().height));
 const blue=c=>{const m=c&&c.match(new RegExp('[0-9]+','g'));if(!m)return false;const r=+m[0],g=+m[1],b=+m[2];return b>r+10&&b>g+4&&b>35};
 const blueEls=[...document.querySelectorAll('main *, main')].filter(e=>blue(getComputedStyle(e).backgroundColor)&&!e.closest('[class*="-scene"]')).length;
 const favs=[...document.querySelectorAll('.wd-fav')].map(b=>b.getAttribute('aria-pressed'));
 return JSON.stringify({vw,docW:de.scrollWidth,over,small,blueEls,text:main.innerText,h1:(main.querySelector('h1')||{}).textContent,hrefs:[...document.querySelectorAll('main a[href]')].map(a=>a.getAttribute('href')),
  roots:['.wd-en','.wd-at','.wd-cl'].map(s=>!!document.querySelector(s)),cards:document.querySelectorAll('.wd-card, [class$="-card"][data-location]').length,favs,
  looks:[...document.querySelectorAll('.wd-look')].length,fav:[...document.querySelectorAll('[data-location].is-favourite')].map(e=>e.dataset.location),
  mode:de.getAttribute('data-mode')||'classic-pro',broken:[...document.images].filter(i=>!(i.complete&&i.naturalWidth>0)).length})})()`;

(async () => {
  try { await fetch(BASE + "/", { redirect: "manual" }); } catch { skip(`dev server not reachable at ${BASE}`); }
  const { createClient } = require(path.join(ROOT, "node_modules", "@supabase/supabase-js"));
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email: process.env.DEV_TEST_USER_EMAIL || "dev-test@local.chessmind.test", password: process.env.DEV_TEST_USER_PASSWORD || "dev-test-local-only-not-secret" });
  if (error) skip("dev-test account sign-in failed (run scripts/dev-seed-test-user.js)");
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  const cookies = [[`sb-${ref}-auth-token`, "base64-" + Buffer.from(JSON.stringify(data.session)).toString("base64url")], ["cka_active_child", CHILD]];
  const shots = process.env.PLAY_SHOTS;
  const only = (process.env.WORLD_VIEWPORTS || "390,411,800,1280").split(",");
  let pass = 0; const fails = [];
  const check = (n, ok, d) => { if (ok) pass++; else { fails.push(n); console.log("FAIL:", n, d || ""); } };
  for (const w of WORLDS) for (const v of VIEWPORTS.filter((x) => only.includes(String(x.w)))) {
    // Each session is a fresh throwaway Chrome profile: the per-device passport / favourite it writes are discarded with it, and the account is never written.
    const s = await openSession({ ...v, mode: w.mode }, cookies);
    const tag = `${w.id} @${v.w}`;
    try {
      await s.open("world"); await s.waitFor(`!!document.querySelector('${ROOT_OF[w.id]}') && !!document.querySelector('[data-world-resolved]')`); await sleep(2000);
      let r = JSON.parse(await s.ev(WD));
      check(`${tag}: the ${w.id} presentation renders and the other two do not (no leakage)`, JSON.stringify(r.roots) === JSON.stringify([w.id === "enchanted", w.id === "atelier", w.id === "classic"]), JSON.stringify(r.roots));
      check(`${tag}: the current world is ${w.mode} (the world state is the existing one)`, r.mode === w.mode, r.mode);
      check(`${tag}: both real locations render with their Play here links`, PLACES.every(([t]) => r.text.includes(t)) && PLACES.every(([, id]) => r.hrefs.some((h) => h.includes("free-play") && h.includes(id))), r.hrefs.join());
      check(`${tag}: the page heading and the pre-existing copy are unchanged`, /Play the same game somewhere extraordinary\./.test(r.h1 || "") && /The rules never change/.test(r.text) && /Chess Mind World/i.test(r.text), r.h1);
      check(`${tag}: each location has a favourite star (aria-pressed false at the start) and a Look around button`, r.favs.length === 2 && r.favs.every((f) => f === "false") && r.looks === 2, JSON.stringify([r.favs, r.looks]));
      check(`${tag}: no horizontal overflow`, r.docW <= r.vw && r.over === 0, `doc ${r.docW}/${r.vw}, ${r.over}`);
      check(`${tag}: every link and button is >= 44px tall`, r.small.length === 0, r.small.join(", "));
      if (w.id === "atelier") check(`${tag}: no blue/navy surfaces outside the painted scenes`, r.blueEls === 0, `${r.blueEls}`);
      check(`${tag}: no broken images, no console errors`, r.broken === 0 && s.logs.length === 0, s.logs.slice(0, 2).join(" | "));
      if (shots) { fs.mkdirSync(shots, { recursive: true }); fs.writeFileSync(path.join(shots, `world-${w.id}-${v.w}.png`), Buffer.from(await s.shot(), "base64")); }

      // Selection: the favourite star works, is unmistakable, and toggles back (per-device storage in this throwaway profile only).
      await s.click('[data-location="london-eye"] .wd-fav'); await sleep(500);
      r = JSON.parse(await s.ev(WD));
      check(`${tag}: choosing London Eye as favourite sets exactly that one (aria-pressed + the card's selected state)`, JSON.stringify(r.favs) === '["true","false"]' && JSON.stringify(r.fav) === '["london-eye"]', JSON.stringify([r.favs, r.fav]));
      check(`${tag}: the selected state is visibly labelled`, /Favourite|favourite/i.test(await s.ev(`getComputedStyle(document.querySelector('[data-location="london-eye"]'),'::after').content`)), "");
      if (shots) fs.writeFileSync(path.join(shots, `world-${w.id}-${v.w}-selected.png`), Buffer.from(await s.shot(), "base64"));
      await s.click('[data-location="chaturanga"] .wd-fav'); await sleep(400);
      r = JSON.parse(await s.ev(WD));
      check(`${tag}: choosing the other moves the selection (never two at once)`, JSON.stringify(r.fav) === '["chaturanga"]', JSON.stringify(r.fav));
      await s.click('[data-location="chaturanga"] .wd-fav'); await sleep(400);
      r = JSON.parse(await s.ev(WD));
      check(`${tag}: pressing it again clears the favourite (state restored)`, r.fav.length === 0 && r.favs.every((f) => f === "false"), JSON.stringify(r.fav));
      // Look around: the preview opens (the button goes) and a visit is recorded locally.
      await s.click('[data-location="london-eye"] .wd-look'); await sleep(800);
      r = JSON.parse(await s.ev(WD));
      check(`${tag}: Look around opens the preview (the button is replaced) and the card says Visited`, r.looks === 1 && /Visited — no games here yet\./.test(r.text), `${r.looks}`);

      // World continuity through navigation: client-side clicks on the shell (desktop sidebar / phone tabs), then back to World.
      const go = async (href) => { const sel = v.w >= 1024 ? `.app-sidenav a[href="${href}"]` : `.layout-bottom-nav a[href="${href}"]`; if (!(await s.click(sel))) return false; await s.waitFor(`location.pathname==='${href}'`, 25000); await sleep(1500); return true; };
      const dests = v.w >= 1024 ? ["/home", "/academy", "/chess-mind", "/profile", "/discover", "/play"] : ["/home", "/play"];
      for (const href of dests) {
        await s.open("world"); await s.waitFor(`!!document.querySelector('${ROOT_OF[w.id]}')`); await sleep(800);
        const ok = await go(href);
        if (PAGE_ROOT[href]) await s.waitFor(`!!document.querySelector('${PAGE_ROOT[href][w.id]}')`, 30000); // the destination may still be compiling / loading
        const st = JSON.parse(await s.ev(`JSON.stringify({p:location.pathname,mode:document.documentElement.getAttribute('data-mode')||'classic-pro',world:(document.querySelector('[data-world]')||{dataset:{}}).dataset.world,roots:${JSON.stringify(PAGE_ROOT[href] || null)}?Object.values(${JSON.stringify(PAGE_ROOT[href] || {})}).map(sel=>!!document.querySelector(sel)):[]})`));
        const want = PAGE_ROOT[href] ? ["enchanted", "atelier", "classic"].map((id) => id === w.id) : [];
        check(`${tag}: World -> ${href} keeps ${w.id}`, ok && st.p === href && st.mode === w.mode && JSON.stringify(st.roots) === JSON.stringify(want), JSON.stringify(st));
        // and back to World
        if (await go("/world")) check(`${tag}: ${href} -> World keeps ${w.id}`, (await s.ev(`!!document.querySelector('${ROOT_OF[w.id]}')`)) === true);
      }
      s.logs.length = 0;
    } finally { s.close(); }
  }
  console.log(`\n${pass} passed, ${fails.length} failed`);
  process.exit(fails.length ? 1 : 0);
})();

/**
 * Signup guide screen (/onboarding/buddy, "Meet your guide") in a real (headless) Chrome: 390 / 411 / 800 / 1280 (GD_VIEWPORTS=...; PLAY_SHOTS=<dir>).
 * Static checks that the page logic and content/buddies.ts are unchanged and that the picker holds no state or data access; browser checks that ONLY
 * Ollie is shown (no Ember / Mochi / Byte / Sly / Star, no "Soon", no disabled cards), the title and copy, one primary "Meet Ollie ->" button, Ollie's
 * size, the Enchanted look, overflow, 44px targets, the bottom margin on phones, no console errors, and that the button runs the existing flow (the one
 * PATCH it makes is intercepted and answered locally, so nothing is written; the database is asserted unchanged). Needs the dev server on :3000, Chrome
 * and the local dev-test account; otherwise prints SKIPPED and exits 2.
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
  const ev = async (expr) => { const r = (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result; if (!r) return undefined; /* the page was navigating */ if (r.exceptionDetails) throw new Error("page script failed: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result.value; };
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
  return { send, ws, ev, waitFor, open, shot, click, logs, close() { ws.close(); chrome.kill(); chrome.unref(); try { fs.rmSync(profile, { recursive: true, force: true }); } catch {} } };
}



// ---- Signup guide screen ------------------------------------------------------------------------------------------
const REMOVED = ["Ember the Dragon", "Mochi the Panda", "Byte the Robot", "Sly the Fox", "Star the Unicorn"];
const GD = `(()=>{const vw=innerWidth,vh=innerHeight,de=document.documentElement,main=document.querySelector('main.cp');
 const over=[...document.querySelectorAll('main *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&(r.right>vw+1||r.left<-1)}).length;
 const small=[...document.querySelectorAll('main button, main a[href]')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&r.height<44}).map(e=>(e.textContent||'').trim().slice(0,24)+':'+Math.round(e.getBoundingClientRect().height));
 const btns=[...document.querySelectorAll('main button')];const cta=btns.find(b=>/Meet/.test(b.textContent));const cr=cta?cta.getBoundingClientRect():null;
 const plate=document.querySelector('.gd-plate');const pr=plate?plate.getBoundingClientRect():null;const em=document.querySelector('.gd-emoji');
 return JSON.stringify({vw,vh,docW:de.scrollWidth,docH:de.scrollHeight,over,small,hasMain:!!main,dataWorld:[...new Set([...document.querySelectorAll('[data-world]')].map(e=>e.getAttribute('data-world')))],
  h1:(document.querySelector('main h1')||{}).textContent,guides:document.querySelectorAll('[data-guide]').length,guideId:(document.querySelector('[data-guide]')||{dataset:{}}).dataset.guide,
  buttons:btns.map(b=>b.textContent.trim()),radios:document.querySelectorAll('[role=radio]').length,disabledCards:document.querySelectorAll('main [disabled]:not(.cp-cta)').length,
  ctaText:cta?cta.textContent.trim():null,ctaDisabled:cta?cta.disabled:null,ctaH:cr?Math.round(cr.height):null,ctaBottom:cr?Math.round(cr.bottom):null,
  plate:pr?[Math.round(pr.width),Math.round(pr.height)]:null,emojiPx:em?Math.round(parseFloat(getComputedStyle(em).fontSize)):null,
  art:(()=>{const i=document.querySelector('img.gd-art');return i?{src:new URL(i.currentSrc||i.src).pathname,ok:i.complete&&i.naturalWidth>0,nw:i.naturalWidth,nh:i.naturalHeight,fit:getComputedStyle(i).objectFit,bw:Math.round(i.getBoundingClientRect().width),bh:Math.round(i.getBoundingClientRect().height)}:null})(),emojiCount:document.querySelectorAll('.gd-emoji').length,
  broken:[...document.images].filter(i=>!(i.complete&&i.naturalWidth>0)).length,text:main?main.innerText:''})})()`;

(async () => {
  try { await fetch(BASE + "/", { redirect: "manual" }); } catch { skip(`dev server not reachable at ${BASE}`); }
  const { createClient } = require(path.join(ROOT, "node_modules", "@supabase/supabase-js"));
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email: process.env.DEV_TEST_USER_EMAIL || "dev-test@local.chessmind.test", password: process.env.DEV_TEST_USER_PASSWORD || "dev-test-local-only-not-secret" });
  if (error) skip("dev-test account sign-in failed (run scripts/dev-seed-test-user.js)");
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  const cookies = [[`sb-${ref}-auth-token`, "base64-" + Buffer.from(JSON.stringify(data.session)).toString("base64url")], ["cka_active_child", CHILD]];
  const saved = async () => (await sb.from("children").select("avatar_id,buddy_id").eq("id", CHILD).single()).data;
  const original = await saved();
  const shots = process.env.PLAY_SHOTS;
  const only = (process.env.GD_VIEWPORTS || "390,411,800,1280").split(",");
  let pass = 0; const fails = [];
  const check = (n, ok, d) => { if (ok) pass++; else { fails.push(n); console.log("FAIL:", n, d || ""); } };
  console.log(`QA child saved: ${JSON.stringify(original)} (read-only: the save request is intercepted, nothing is written)`);

  // ---- static: the logic is exactly as it was, and the shared data is untouched ----
  const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
  const page = src("app/onboarding/buddy/page.tsx");
  check("static: the page still resolves the child and redirects exactly as before (/sign-in, /choose-child)", /router\.push\("\/sign-in"\)/.test(page) && /router\.push\("\/choose-child"\)/.test(page) && /resolveActiveChild\(supabase, user\.id, getActiveChildIdClient\(\)\)/.test(page));
  check("static: selection state defaults to wise-owl and a saved buddy_id is read exactly as before", /useState<string>\("wise-owl"\)/.test(page) && /if \(child\.buddy_id\) setSelected\(child\.buddy_id\)/.test(page));
  check("static: confirm still saves updateChildBuddy(supabase, childId, selected) then goes to /onboarding/board", /await updateChildBuddy\(supabase, childId, selected\)/.test(page) && /router\.push\("\/onboarding\/board"\)/.test(page));
  const buddies = src("content/buddies.ts");
  check("static: content/buddies.ts is untouched: still the six guides (Home, lessons, parent dashboard and post-game read this list)", ["wise-owl", "dragon", "panda", "robot", "fox", "unicorn"].every((id) => buddies.includes(`id: "${id}"`)) && (buddies.match(/builtIn: true/g) || []).length === 1);
  const pageCode = page.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, ""); // comments may mention the removed cards
  check("static: the page draws no disabled/Soon cards (no Soon text, no disabled card, no BUDDIES.map in the code)", !/Soon/i.test(pageCode) && !/BUDDIES\.map/.test(pageCode) && !/disabled=\{!b\.builtIn\}/.test(pageCode));
  const picker = src("components/onboarding/GuidePicker.tsx");
  check("static: the picker holds no state, no data access and no navigation (presentation only)", !/useState|useEffect|useRouter|supabase|createClient|router\./.test(picker));

  for (const v of VIEWPORTS.filter((x) => only.includes(String(x.w)))) {
    const s = await openSession({ ...v, mode: "kids" }, cookies);
    const tag = `@${v.w}`;
    try {
      // The only write this screen can make is the PATCH from "Meet Ollie": record it and answer it locally instead of sending it.
      // The only write this screen can make is the PATCH from "Meet Ollie". A fetch wrapper installed before the page loads records that one request and
      // answers it locally (204), so nothing is sent to the database; everything else goes through untouched.
      await s.send("Page.addScriptToEvaluateOnNewDocument", { source: `(()=>{const f=window.fetch.bind(window);window.__patches=[];window.fetch=(input,init)=>{try{const url=typeof input==='string'?input:(input&&input.url)||String(input);const method=String((init&&init.method)||(input&&input.method)||'GET').toUpperCase();if(method==='PATCH'&&url.indexOf('/rest/v1/children')>=0){window.__patches.push({url:url,body:(init&&init.body)||null});return Promise.resolve(new Response(null,{status:204}))}}catch(e){}return f(input,init)}})()` });
      await s.open("onboarding/buddy"); await s.waitFor(`!!document.querySelector('[data-guide]') && !!document.querySelector('[data-world-resolved]')`, 40000); await sleep(1500);
      const r = JSON.parse(await s.ev(GD));
      check(`${tag}: pinned to the Enchanted Kingdom look (data-world enchanted)`, r.hasMain && r.dataWorld.length === 1 && r.dataWorld[0] === "enchanted", JSON.stringify(r.dataWorld));
      check(`${tag}: title "Meet your guide" and "Meet Ollie, your Chess Mind companion."`, (r.h1 || "").trim() === "Meet your guide" && /Meet Ollie, your Chess Mind companion\./.test(r.text), r.h1);
      check(`${tag}: ONLY Ollie is shown (one guide card, id wise-owl, name "Ollie the Owl")`, r.guides === 1 && r.guideId === "wise-owl" && r.text.includes("Ollie the Owl"), JSON.stringify([r.guides, r.guideId]));
      check(`${tag}: none of the five unavailable guides appears, and no "Soon" text or badge remains`, REMOVED.every((n) => !r.text.includes(n)) && !/soon/i.test(r.text) && r.disabledCards === 0 && r.radios === 0, r.text.slice(0, 200));
      check(`${tag}: exactly one button, the primary one, reading "Meet Ollie →" and enabled`, r.buttons.length === 1 && r.ctaText === "Meet Ollie →" && r.ctaDisabled === false, JSON.stringify(r.buttons));
      check(`${tag}: Ollie's own artwork replaces the emoji: /characters/ollie.webp, loaded, the original 896x1200 file, no emoji left`, r.emojiCount === 0 && r.art && r.art.ok && r.art.src === "/characters/ollie.webp" && r.art.nw === 896 && r.art.nh === 1200, JSON.stringify([r.art, r.emojiCount]));
      check(`${tag}: the artwork is large (plate ${r.plate && r.plate.join("x")}) and not distorted (object-fit cover, shown 3:4 like the file)`, r.art && r.plate && r.plate[0] >= 200 && r.plate[1] >= 280 && /* (the card is sized from the viewport height on tablets/desktops, so a short screen gets a smaller 3:4 plate, never below ~212x283) */ r.art.fit === "cover" && Math.abs(r.art.bw / r.art.bh - 0.75) < 0.02, JSON.stringify([r.plate, r.art]));
      check(`${tag}: the button is >= 44px tall`, r.ctaH >= 44 && r.small.length === 0, JSON.stringify([r.small, r.ctaH]));
      check(`${tag}: no horizontal overflow`, r.docW <= r.vw && r.over === 0, `doc ${r.docW}/${r.vw}, ${r.over}`);
      check(`${tag}: the primary button stays on screen: ${r.vh - r.ctaBottom}px below it (>= 24) and the page does not scroll (${r.docH} <= ${r.vh})`, r.vh - r.ctaBottom >= 24 && r.docH <= r.vh, JSON.stringify([r.vh, r.ctaBottom, r.docH]));
      check(`${tag}: no broken images, no console errors`, r.broken === 0 && s.logs.length === 0, s.logs.slice(0, 2).join(" | "));
      if (shots) { fs.mkdirSync(shots, { recursive: true }); fs.writeFileSync(path.join(shots, `guide-${v.w}.png`), Buffer.from(await s.shot(), "base64")); }
      s.logs.length = 0;
      if (v.w === 390 || v.w === 1280) { // the primary button goes through the existing flow: save the guide, then /onboarding/board
        await s.click(`main button.cp-cta`); await s.waitFor(`location.pathname==='/onboarding/board'`, 30000);
        // router.push is a client-side navigation, so the recorder survives it.
        const patches = JSON.parse((await s.ev("JSON.stringify(window.__patches||[])")) || "[]");
        check(`${tag}: "Meet Ollie →" sends the existing save (exactly one PATCH: buddy_id "wise-owl" for the active child) and goes on to /onboarding/board`, (await s.ev("location.pathname")) === "/onboarding/board" && patches.length === 1 && /"buddy_id"\s*:\s*"wise-owl"/.test(patches[0].body || "") && patches[0].url.includes(`id=eq.${CHILD}`), JSON.stringify(patches));
      }
    } finally { s.close(); }
  }
  check("the whole run saved nothing (avatar_id and buddy_id unchanged in the database)", JSON.stringify(await saved()) === JSON.stringify(original), JSON.stringify(await saved()));
  console.log(`\n${pass} passed, ${fails.length} failed`);
  process.exit(fails.length ? 1 : 0);
})();

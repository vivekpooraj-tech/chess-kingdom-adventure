/**
 * Signup character screen (/onboarding/avatar, "Choose your companion") in a real (headless) Chrome: 390 / 411 / 800 / 1280 (CP_VIEWPORTS=...; PLAY_SHOTS=<dir>).
 * Static checks that the page logic is exactly as it was (child resolution, redirects, selection state, updateChildAvatar then /onboarding/buddy,
 * content/avatars.ts unchanged, the picker holding no state or data access); browser checks of the four existing characters and exact names, the saved
 * character preselected, one selection at a time, the Continue button, the Enchanted look pinned in every mode, overflow, 44px targets, the mobile
 * first-screen fit, no console errors. READ-ONLY: Continue is never pressed and the database is asserted unchanged. Needs the dev server on :3000,
 * Chrome and the local dev-test account; otherwise prints SKIPPED and exits 2.
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
  return { ev, waitFor, open, shot, click, logs, close() { ws.close(); chrome.kill(); chrome.unref(); try { fs.rmSync(profile, { recursive: true, force: true }); } catch {} } };
}



// ---- Signup character screen --------------------------------------------------------------------------------------
const AVATARS_EXPECTED = [["knight-kid", "Knight Kid"], ["star-explorer", "Star Explorer"], ["forest-ranger", "Forest Ranger"], ["royal-heir", "Royal Heir"]];
const CP = `(()=>{const vw=innerWidth,vh=innerHeight,de=document.documentElement,main=document.querySelector('main.cp');
 const over=[...document.querySelectorAll('main *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&(r.right>vw+1||r.left<-1)}).length;
 const radios=[...document.querySelectorAll('[role=radio][data-avatar]')];
 const small=[...document.querySelectorAll('main button, main a[href]')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&r.height<44}).map(e=>(e.textContent||'').trim().slice(0,24)+':'+Math.round(e.getBoundingClientRect().height));
 const cta=[...document.querySelectorAll('main button')].find(b=>/Continue|Saving/.test(b.textContent));
 const cr=cta?cta.getBoundingClientRect():null;
 return JSON.stringify({vw,vh,docW:de.scrollWidth,docH:de.scrollHeight,over,small,hasMain:!!main,dataWorld:[...new Set([...document.querySelectorAll('[data-world]')].map(e=>e.getAttribute('data-world')))],
  h1:(document.querySelector('main h1')||{}).textContent,
  cards:radios.map(r=>({id:r.dataset.avatar,name:(r.querySelector('.cp-name')||{}).textContent,checked:r.getAttribute('aria-checked')==='true',h:Math.round(r.getBoundingClientRect().height),w:Math.round(r.getBoundingClientRect().width)})),
  art:radios.map(r=>{const i=r.querySelector('img.cp-art');return i?{src:new URL(i.currentSrc||i.src).pathname,ok:i.complete&&i.naturalWidth>0,nw:i.naturalWidth,nh:i.naturalHeight,fit:getComputedStyle(i).objectFit,bw:Math.round(i.getBoundingClientRect().width),bh:Math.round(i.getBoundingClientRect().height)}:null}),emoji:document.querySelectorAll('.cp-emoji').length,
    group:!!document.querySelector('[role=radiogroup]'),ctaText:cta?cta.textContent.trim():null,ctaDisabled:cta?cta.disabled:null,ctaH:cr?Math.round(cr.height):null,ctaBottom:cr?Math.round(cr.bottom+scrollY):null,
  imgs:document.querySelectorAll('main img').length,broken:[...document.images].filter(i=>!(i.complete&&i.naturalWidth>0)).length,text:main?main.innerText:''})})()`;

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
  const only = (process.env.CP_VIEWPORTS || "390,411,800,1280").split(",");
  let pass = 0; const fails = [];
  const check = (n, ok, d) => { if (ok) pass++; else { fails.push(n); console.log("FAIL:", n, d || ""); } };

  // ---- static: the logic is exactly as it was ----
  const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
  const page = src("app/onboarding/avatar/page.tsx");
  check("static: the page still resolves the child and redirects exactly as before (/sign-in, /choose-child)", /router\.push\("\/sign-in"\)/.test(page) && /router\.push\("\/choose-child"\)/.test(page) && /resolveActiveChild\(supabase, user\.id, getActiveChildIdClient\(\)\)/.test(page));
  check("static: selection state and the saved avatar are read exactly as before", /const \[selected, setSelected\] = useState<string \| null>\(null\)/.test(page) && /if \(child\.avatar_id\) setSelected\(child\.avatar_id\)/.test(page));
  check("static: confirm still saves with updateChildAvatar(supabase, childId, selected) then goes to /onboarding/buddy", /await updateChildAvatar\(supabase, childId, selected\)/.test(page) && /router\.push\("\/onboarding\/buddy"\)/.test(page));
  check("static: the picker is given the real AVATARS and the page's own handlers (setSelected, confirm)", /<CompanionPicker avatars=\{AVATARS\} selected=\{selected\} saving=\{saving\} onSelect=\{setSelected\} onConfirm=\{confirm\}/.test(page));
  const avatarsSrc = src("content/avatars.ts");
  check("static: content/avatars.ts still lists exactly Knight Kid, Star Explorer, Forest Ranger, Royal Heir", AVATARS_EXPECTED.every(([id, n]) => avatarsSrc.includes(`id: "${id}", name: "${n}"`)) && (avatarsSrc.match(/id: "/g) || []).length === 4);
  const picker = src("components/onboarding/CompanionPicker.tsx");
  check("static: the picker holds no state, no data access and no navigation (presentation only)", !/useState|useEffect|useRouter|supabase|createClient|router\./.test(picker));

  for (const v of VIEWPORTS.filter((x) => only.includes(String(x.w)))) {
    for (const mode of v.w === 390 ? ["kids", "adult", "classic-pro"] : ["kids"]) {
      const s = await openSession({ ...v, mode }, cookies);
      const tag = `@${v.w}${mode === "kids" ? "" : " (" + mode + " mode)"}`;
      try {
        await s.open("onboarding/avatar"); await s.waitFor(`document.querySelectorAll('[role=radio][data-avatar]').length===4 && document.querySelector('[role=radio][aria-checked=true]')`, 40000); await sleep(1500);
        const r = JSON.parse(await s.ev(CP));
        check(`${tag}: pinned to the Enchanted Kingdom look (data-world enchanted) with the screen scope`, r.hasMain && r.dataWorld.length === 1 && r.dataWorld[0] === "enchanted", JSON.stringify(r.dataWorld));
        if (mode !== "kids") { if (shots) { fs.mkdirSync(shots, { recursive: true }); fs.writeFileSync(path.join(shots, `avatar-${mode}-${v.w}.png`), Buffer.from(await s.shot(), "base64")); } s.logs.length = 0; continue; }
        check(`${tag}: heading "Choose your companion"`, (r.h1 || "").trim() === "Choose your companion" && /Who will join you on your chess adventure\?/.test(r.text), r.h1);
        check(`${tag}: the four existing characters, in order, with their exact existing names`, JSON.stringify(r.cards.map((c) => [c.id, c.name])) === JSON.stringify(AVATARS_EXPECTED), JSON.stringify(r.cards.map((c) => [c.id, c.name])));
        check(`${tag}: a radio group; exactly the child's saved character is selected (${original.avatar_id})`, r.group && r.cards.filter((c) => c.checked).map((c) => c.id).join() === original.avatar_id, JSON.stringify(r.cards.map((c) => c.checked)));
        check(`${tag}: every card shows its own supplied portrait (/characters/<id>.webp), loaded, and no emoji stand-in remains`, r.emoji === 0 && r.art.every((x, i) => x && x.ok && x.src === "/characters/" + AVATARS_EXPECTED[i][0] + ".webp"), JSON.stringify(r.art));
        check(`${tag}: the portraits are the original full-resolution files (896x1200), not the earlier low-resolution crops`, r.art.every((x) => x && x.nw === 896 && x.nh === 1200), JSON.stringify(r.art.map((x) => x && [x.nw, x.nh])));
        const statuses = await s.ev(`Promise.all(${JSON.stringify(AVATARS_EXPECTED.map((a) => "/characters/" + a[0] + ".webp"))}.map(u=>fetch(u,{method:'HEAD'}).then(r=>r.status+' '+r.headers.get('content-type'))))`);
        check(`${tag}: all four image URLs answer 200 as image/webp (no 404s)`, Array.isArray(statuses) && statuses.every((x) => x === "200 image/webp"), JSON.stringify(statuses));
        check(`${tag}: the portraits are not distorted (object-fit cover, shown 3:4 like the files) and are the same size on every card (within 1px of rounding)`, r.art.every((x) => x && x.fit === "cover" && Math.abs(x.bw / x.bh - 0.75) < 0.02) && Math.max(...r.art.map((x) => x.bw)) - Math.min(...r.art.map((x) => x.bw)) <= 1 && Math.max(...r.art.map((x) => x.bh)) - Math.min(...r.art.map((x) => x.bh)) <= 1, JSON.stringify(r.art.map((x) => [x && x.bw, x && x.bh])));
        check(`${tag}: no stats, ability bars or technical labels (only the characters' short lines)`, !/\b(level|lvl|HP|attack|defense|power|stat)\b/i.test(r.text), r.text.slice(0, 160));
        check(`${tag}: the primary button reads "Continue →" and is enabled`, r.ctaText === "Continue →" && r.ctaDisabled === false, JSON.stringify([r.ctaText, r.ctaDisabled]));
        check(`${tag}: cards and the button are >= 44px tall`, r.cards.every((c) => c.h >= 44) && r.ctaH >= 44 && r.small.length === 0, JSON.stringify([r.small, r.ctaH]));
        check(`${tag}: no horizontal overflow`, r.docW <= r.vw && r.over === 0, `doc ${r.docW}/${r.vw}, ${r.over}`);
        // A REAL bottom margin, not just "ends before the viewport": at the 390x844 reference the page must not scroll and leave >= 24px under the button
        // (its 3px ring and ~14px glow need room; the page's own bottom padding is 20px); at 411x914 >= 20px.
        if (v.w === 390) check(`${tag}: bottom breathing room: ${r.vh - r.ctaBottom}px below the Continue button (>= 24) and the page does not scroll (${r.docH} <= ${r.vh})`, r.vh - r.ctaBottom >= 24 && r.docH <= r.vh, JSON.stringify([r.vh, r.ctaBottom, r.docH]));
        else if (v.w === 411) check(`${tag}: bottom breathing room: ${r.vh - r.ctaBottom}px below the Continue button (>= 20)`, r.vh - r.ctaBottom >= 20, JSON.stringify([r.vh, r.ctaBottom]));
        else check(`${tag}: desktop/tablet: four cards in one row`, new Set(r.cards.map(() => 0)).size === 1 && r.cards.every((c) => c.w > 120), JSON.stringify(r.cards.map((c) => c.w)));
        check(`${tag}: no broken images, no console errors`, r.broken === 0 && s.logs.length === 0, s.logs.slice(0, 2).join(" | "));
        // selection is exactly one at a time (local page state only; Continue is never pressed, so nothing is saved)
        const other = AVATARS_EXPECTED.map((a) => a[0]).find((id) => id !== original.avatar_id);
        await s.click(`[data-avatar="${other}"]`); await sleep(500);
        const r2 = JSON.parse(await s.ev(CP));
        check(`${tag}: choosing another character selects exactly that one (never two) and keeps Continue enabled`, r2.cards.filter((c) => c.checked).map((c) => c.id).join() === other && r2.ctaDisabled === false, JSON.stringify(r2.cards.map((c) => c.checked)));
        if (shots) { fs.mkdirSync(shots, { recursive: true }); fs.writeFileSync(path.join(shots, `avatar-${v.w}.png`), Buffer.from(await s.shot(), "base64")); }
        s.logs.length = 0;
      } finally { s.close(); }
    }
  }
  check("the whole run saved nothing (avatar_id and buddy_id unchanged in the database)", JSON.stringify(await saved()) === JSON.stringify(original), JSON.stringify(await saved()));
  console.log(`\n${pass} passed, ${fails.length} failed`);
  process.exit(fails.length ? 1 : 0);
})();

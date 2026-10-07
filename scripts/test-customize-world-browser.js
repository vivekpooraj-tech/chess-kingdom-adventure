/**
 * Profile Customize (/profile/customize) in a real (headless) Chrome: three worlds x 390 / 411 / 800 / 1280 (CUSTOMIZE_VIEWPORTS=...; PLAY_SHOTS=<dir>).
 * READ-ONLY: nothing is selected or saved (asserted against the database at the end). Checks the world presentation, exactly the five boards and four
 * piece sets, the selected cards being the EFFECTIVE ids, the selected frame in the world's colour, overflow, 44px targets, no shared navy, no blue in
 * Atelier, no console errors, and Profile -> Customize -> Profile (via Back to Profile and via Done) keeping the world. Needs the dev server on :3000,
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



// ---- Profile Customize ---------------------------------------------------------------------------------------------
const BOARDS = ["standard-green", "tournament-green", "slate", "walnut-ivory", "wood-classic"];
const PIECES = ["wikimedia-classic", "neostaunton-hand", "wood-classic", "royal-legends"];
const PF_ROOT = { enchanted: ".pf-en", atelier: ".pf-at", classic: ".pf-cl" };
const CZ = `(()=>{const vw=innerWidth,de=document.documentElement,main=document.querySelector('main.cz');
 const skip=e=>e.closest('[data-square],img,svg,canvas');
 const over=[...document.querySelectorAll('main *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&(r.right>vw+1||r.left<-1)}).length;
 const small=[...document.querySelectorAll('main button, main a[href]')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&r.height<44&&!e.closest('[data-square]')}).map(e=>(e.getAttribute('aria-label')||e.textContent||'').trim().slice(0,28)+':'+Math.round(e.getBoundingClientRect().height));
 const blue=c=>{const m=c&&c.match(new RegExp('[0-9]+','g'));if(!m)return false;const r=+m[0],g=+m[1],b=+m[2];return b>r+10&&b>g+4&&b>35};
 const blueEls=[...document.querySelectorAll('body *')].filter(e=>!skip(e)&&(blue(getComputedStyle(e).backgroundColor)||(blue(getComputedStyle(e).borderTopColor)&&getComputedStyle(e).borderTopWidth!=='0px'))).map(e=>(e.className&&e.className.toString?e.className.toString():e.tagName).slice(0,40));
 const navy=[...document.querySelectorAll('body *')].filter(e=>!skip(e)&&['rgb(27, 36, 64)','rgb(15, 22, 41)'].includes(getComputedStyle(e).backgroundColor)).length;
 const sel=a=>[...document.querySelectorAll(a)].filter(c=>c.dataset.selected==='true').map(c=>c.dataset.boardCard||c.dataset.pieceCard);
 return JSON.stringify({vw,docW:de.scrollWidth,over,small,blueEls,navy,hasCz:!!main,dataWorld:[...new Set([...document.querySelectorAll('[data-world]')].map(e=>e.getAttribute('data-world')))],
  boards:[...document.querySelectorAll('[data-board-card]')].map(c=>c.dataset.boardCard),pieces:[...document.querySelectorAll('[data-piece-card]')].map(c=>c.dataset.pieceCard),
  selBoard:sel('[data-board-card]'),selPiece:sel('[data-piece-card]'),pressed:[...document.querySelectorAll('[data-board-card] > button[aria-pressed=true], [data-piece-card] > button[aria-pressed=true]')].length,
  broken:[...document.images].filter(i=>!(i.complete&&i.naturalWidth>0)).length,
  selFrame:(()=>{const c=document.querySelector('[data-board-card][data-selected=true]');return c?getComputedStyle(c).borderTopColor:null})(),
  coveredCards:[...document.querySelectorAll('[data-board-card],[data-piece-card]')].filter(c=>{const b=c.querySelector(':scope > button');const cs=getComputedStyle(b);return cs.backgroundImage!=='none'||!/rgba\(.*, 0\)|transparent/.test(cs.backgroundColor)}).length,
  textHidden:[...document.querySelectorAll('[data-board-card],[data-piece-card]')].filter(c=>{const t=c.querySelector('p');t.scrollIntoView({block:'center'});const r=t.getBoundingClientRect();const e=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return !(e===t||t.contains(e)||(e&&e.tagName==='BUTTON'&&e.parentElement===c&&getComputedStyle(e).backgroundImage==='none'))}).length,
  text:main?main.innerText:''})})()`;

(async () => {
  try { await fetch(BASE + "/", { redirect: "manual" }); } catch { skip(`dev server not reachable at ${BASE}`); }
  const { createClient } = require(path.join(ROOT, "node_modules", "@supabase/supabase-js"));
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email: process.env.DEV_TEST_USER_EMAIL || "dev-test@local.chessmind.test", password: process.env.DEV_TEST_USER_PASSWORD || "dev-test-local-only-not-secret" });
  if (error) skip("dev-test account sign-in failed (run scripts/dev-seed-test-user.js)");
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  const cookies = [[`sb-${ref}-auth-token`, "base64-" + Buffer.from(JSON.stringify(data.session)).toString("base64url")], ["cka_active_child", CHILD]];
  const saved = async () => (await sb.from("children").select("board_skin_id,piece_set_id").eq("id", CHILD).single()).data;
  const original = await saved();
  const effBoard = BOARDS.includes(original.board_skin_id) ? original.board_skin_id : "standard-green";
  const effPiece = PIECES.includes(original.piece_set_id) ? original.piece_set_id : "wikimedia-classic";
  const shots = process.env.PLAY_SHOTS;
  const only = (process.env.CUSTOMIZE_VIEWPORTS || "390,411,800,1280").split(",");
  let pass = 0; const fails = [];
  const check = (n, ok, d) => { if (ok) pass++; else { fails.push(n); console.log("FAIL:", n, d || ""); } };
  console.log(`QA child saved: ${JSON.stringify(original)} -> effective ${effBoard} / ${effPiece} (read-only: nothing is selected or saved)`);
  for (const w of WORLDS) for (const v of VIEWPORTS.filter((x) => only.includes(String(x.w)))) {
    const s = await openSession({ ...v, mode: w.mode }, cookies);
    const tag = `${w.id} @${v.w}`;
    try {
      await s.open("profile/customize"); await s.waitFor(`document.querySelectorAll('[data-board-card]').length>=1`, 40000); await sleep(2000);
      const r = JSON.parse(await s.ev(CZ));
      check(`${tag}: the page is in the ${w.id} world (data-world), with the world presentation scope`, r.hasCz && r.dataWorld.length === 1 && r.dataWorld[0] === w.id, JSON.stringify(r.dataWorld));
      check(`${tag}: exactly the five boards and four piece sets, in order (no removed option returns)`, JSON.stringify(r.boards) === JSON.stringify(BOARDS) && JSON.stringify(r.pieces) === JSON.stringify(PIECES), JSON.stringify([r.boards, r.pieces]));
      check(`${tag}: the selected cards are the EFFECTIVE ids (one board, one piece set; aria-pressed agrees)`, JSON.stringify(r.selBoard) === JSON.stringify([effBoard]) && JSON.stringify(r.selPiece) === JSON.stringify([effPiece]) && r.pressed === 2, JSON.stringify([r.selBoard, r.selPiece, r.pressed]));
      check(`${tag}: heading and controls are present (title, Board style, Piece style, Done, Back to Profile)`, /Customize Your Chessboard/.test(r.text) && /Board style/i.test(r.text) && /Piece style/i.test(r.text) && /Done/.test(r.text) && /Back to Profile/.test(r.text), r.text.slice(0, 80));
      check(`${tag}: no card is covered by an opaque overlay (the overlay button is transparent) and every card's title is visible`, r.coveredCards === 0 && r.textHidden === 0, JSON.stringify([r.coveredCards, r.textHidden]));
      check(`${tag}: no horizontal overflow`, r.docW <= r.vw && r.over === 0, `doc ${r.docW}/${r.vw}, ${r.over}`);
      check(`${tag}: every control is >= 44px tall`, r.small.length === 0, r.small.slice(0, 6).join(", "));
      check(`${tag}: no generic shared navy surfaces`, r.navy === 0, `${r.navy}`);
      if (w.id === "atelier") check(`${tag}: no blue/navy/cyan anywhere`, r.blueEls.length === 0, r.blueEls.slice(0, 5).join(" | "));
      const expectFrame = { enchanted: "rgb(240, 193, 75)", atelier: "rgb(199, 240, 0)", classic: "rgb(38, 166, 110)" }[w.id];
      check(`${tag}: the selected card frame is the ${w.id} selected colour`, r.selFrame === expectFrame, `${r.selFrame} vs ${expectFrame}`);
      check(`${tag}: no broken images, no console errors`, r.broken === 0 && s.logs.length === 0, s.logs.slice(0, 2).join(" | "));
      if (shots) { fs.mkdirSync(shots, { recursive: true }); fs.writeFileSync(path.join(shots, `customize-${w.id}-${v.w}.png`), Buffer.from(await s.shot(), "base64")); }
      s.logs.length = 0;
      if (v.w === 390 || v.w === 1280) { // Profile -> Customize -> Profile keeps the world (navigation only; nothing is changed)
        for (const how of ["Back to Profile", "Done"]) {
          await s.open("profile"); await s.waitFor(`!!document.querySelector('${PF_ROOT[w.id]}')`, 40000); await sleep(800);
          await s.click(`main a[href="/profile/customize"]`); await s.waitFor(`location.pathname==='/profile/customize' && document.querySelectorAll('[data-board-card]').length>=1`, 40000); await sleep(1200);
          const mid = JSON.parse(await s.ev(CZ));
          await s.click(how === "Done" ? `main.cz > button:last-of-type` : `main.cz button`); await s.waitFor(`location.pathname==='/profile'`, 30000);
          await s.waitFor(`!!document.querySelector('${PF_ROOT[w.id]}')`, 40000);
          const b = JSON.parse(await s.ev(`JSON.stringify({p:location.pathname,mode:document.documentElement.getAttribute('data-mode')||'classic-pro',world:[...new Set([...document.querySelectorAll('[data-world]')].map(e=>e.getAttribute('data-world')))],own:!!document.querySelector('${PF_ROOT[w.id]}')})`));
          check(`${tag}: Profile -> Customize -> Profile (${how}) keeps ${w.id}`, mid.dataWorld[0] === w.id && b.p === "/profile" && b.mode === w.mode && b.own && b.world.every((x) => x === w.id), JSON.stringify([mid.dataWorld, b]));
        }
      }
    } finally { s.close(); }
  }
  check("the whole run wrote nothing to the saved preference", JSON.stringify(await saved()) === JSON.stringify(original), JSON.stringify(await saved()));
  console.log(`\n${pass} passed, ${fails.length} failed`);
  process.exit(fails.length ? 1 : 0);
})();

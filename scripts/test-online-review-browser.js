/**
 * Multiplayer: no free-game limit + move review, in a real (headless) Chrome: 390 / 411 / 800 / 1280 (OR_VIEWPORTS=...; PLAY_SHOTS=<dir>).
 * A real two-player game cannot be created without writing to the shared database, so the online page is rendered against a locally faked game row (12 plies of
 * a real opening line) by a fetch wrapper installed before the page loads; EVERY database/API write is recorded and answered locally (nothing is sent), and the
 * dev-test child is asserted unchanged at the end. Checks: no "free games remaining" / paywall text on matchmaking or the game page; Prev / Next / Return to Live
 * square-by-square against chess.js at every reviewed position; moves disabled while reviewing (no write), enabled again at live (control); controls >= 44px and on
 * screen; overflow; console errors. Needs the dev server on :3000, Chrome and the local dev-test account; otherwise prints SKIPPED and exits 2.
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



// ---- Multiplayer: move review + no free-game limit ---------------------------------------------------------------
const { Chess } = require(path.join(ROOT, "node_modules", "chess.js"));
const GAME_ID = "00000000-0000-4000-8000-0000000000aa";
const SAN = ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "c3", "Nf6", "d4", "exd4", "cxd4", "Bb4+"]; // 12 plies, a real opening line
const expectedBoard = (ply) => { const c = new Chess(); for (let i = 0; i < ply; i++) c.move(SAN[i]); const m = {}; for (const row of c.board()) for (const sq of row) if (sq) m[sq.square] = (sq.color === "w" ? "light " : "dark ") + sq.type; return m; };
const fenAt = (ply) => { const c = new Chess(); for (let i = 0; i < ply; i++) c.move(SAN[i]); return c.fen(); };
const NOW = new Date().toISOString();
const rowFor = (child) => ({ id: GAME_ID, host_child_id: child, guest_child_id: "11111111-1111-4111-8111-111111111111", host_color: "w", fen: fenAt(SAN.length), status: "active", winner: null, host_reaction: null, guest_reaction: null,
  match_type: "invite", tournament_id: null, round_number: null, tournament_pairing_id: null, moves: SAN, time_control: null, initial_time_ms: null, increment_ms: 0, white_time_ms: null, black_time_ms: null,
  last_move_at: NOW, current_turn: SAN.length % 2 === 0 ? "w" : "b", started_at: NOW, host_ready_at: NOW, guest_ready_at: NOW, rating_applied: false,
  host_rating_before: null, host_rating_after: null, guest_rating_before: null, guest_rating_after: null, created_at: NOW });
// A fetch wrapper installed before the page loads: the game row is answered locally (so no real game is needed) and EVERY write to the database or the
// app's API is recorded and answered locally (nothing is sent). Auth refreshes and all reads pass through untouched. No backslashes: it lives in a template.
const injected = (row) => "(function(){var f=window.fetch.bind(window);window.__writes=[];var ROW=" + JSON.stringify(row) + ";" +
  "window.fetch=function(input,init){try{var url=typeof input==='string'?input:(input&&input.url)||String(input);var method=String((init&&init.method)||(input&&input.method)||'GET').toUpperCase();" +
  "var isSb=url.indexOf('.supabase.co/')>=0;var p=url.split('?')[0];" +
  "if(isSb&&method==='GET'&&url.indexOf('/rest/v1/online_games')>=0){var h=(init&&init.headers)||{};var acc='';try{acc=(h.get?h.get('Accept'):(h['Accept']||h['accept']))||''}catch(e){}var single=String(acc).indexOf('vnd.pgrst.object')>=0;return Promise.resolve(new Response(JSON.stringify(single?ROW:[ROW]),{status:200,headers:{'Content-Type':'application/json'}}))}" +
  "if(((isSb&&url.indexOf('/auth/v1/')<0)||url.indexOf('/api/')>=0)&&method!=='GET'&&method!=='HEAD'&&method!=='OPTIONS'){window.__writes.push({method:method,url:p});return Promise.resolve(new Response('[]',{status:200,headers:{'Content-Type':'application/json'}}))}" +
  "}catch(e){}return f(input,init)}})()";

const READ = `(()=>{const vw=innerWidth,vh=innerHeight,de=document.documentElement,q=s=>[...document.querySelectorAll(s)];
 const board={};q('[data-square]').forEach(sq=>{const i=sq.querySelector('img');if(i)board[sq.dataset.square]=i.alt});
 const groups=q('[role=group][aria-label="Move history"]');const group=groups.find(g=>g.getBoundingClientRect().width>0)||null;const visibleGroups=groups.filter(g=>g.getBoundingClientRect().width>0).length;const side=(document.querySelector('[data-side]')||{dataset:{}}).dataset.side;const btns=group?[...group.querySelectorAll('button')]:[];
 const rect=e=>{const r=e.getBoundingClientRect();return {top:Math.round(r.top),bottom:Math.round(r.bottom),h:Math.round(r.height),w:Math.round(r.width),left:Math.round(r.left),right:Math.round(r.right)}};
 const over=q('main *').filter(e=>{const r=e.getBoundingClientRect();return r.width&&(r.right>vw+1||r.left<-1)&&getComputedStyle(e).position!=='fixed'}).length;
 const sqs=q('[data-square]');const first=sqs[0],last=sqs[sqs.length-1];
 const live=group?[...group.querySelectorAll('span')].find(s=>/^Live$/.test(s.textContent.trim())):null;
 return JSON.stringify({vw,vh,docW:de.scrollWidth,docH:de.scrollHeight,over,board,squares:sqs.length,
  hasGroup:!!group,visibleGroups,side,labels:btns.map(b=>b.textContent.trim()),disabled:btns.map(b=>b.disabled),btnH:btns.map(b=>Math.round(b.getBoundingClientRect().height)),
  group:group?rect(group):null,liveLabel:!!live,boardRect:sqs.length?{w:Math.round(last.getBoundingClientRect().right-first.getBoundingClientRect().left),top:Math.round(first.getBoundingClientRect().top)}:null,
  text:document.body.innerText,sr:(group&&group.querySelector('[aria-live]')||{}).textContent||''})})()`;
const sameBoard = (a, b) => { const ka = Object.keys(a), kb = Object.keys(b); return ka.length === kb.length && ka.every((k) => a[k] === b[k]); };
const MATCH = `JSON.stringify({text:document.body.innerText,h1:(document.querySelector('main h1')||{}).textContent,buttons:[...document.querySelectorAll('main button')].map(b=>b.textContent.trim()),docW:document.documentElement.scrollWidth,vw:innerWidth})`;

(async () => {
  try { await fetch(BASE + "/", { redirect: "manual" }); } catch { skip(`dev server not reachable at ${BASE}`); }
  const { createClient } = require(path.join(ROOT, "node_modules", "@supabase/supabase-js"));
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email: process.env.DEV_TEST_USER_EMAIL || "dev-test@local.chessmind.test", password: process.env.DEV_TEST_USER_PASSWORD || "dev-test-local-only-not-secret" });
  if (error) skip("dev-test account sign-in failed (run scripts/dev-seed-test-user.js)");
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  const cookies = [[`sb-${ref}-auth-token`, "base64-" + Buffer.from(JSON.stringify(data.session)).toString("base64url")], ["cka_active_child", CHILD]];
  const snap = async () => (await sb.from("children").select("avatar_id,buddy_id,rating").eq("id", CHILD).single()).data;
  const original = await snap();
  const shots = process.env.PLAY_SHOTS; const only = (process.env.OR_VIEWPORTS || "390,411,800,1280").split(",");
  let pass = 0; const fails = [];
  const check = (n, ok, d) => { if (ok) pass++; else { fails.push(n); console.log("FAIL:", n, d || ""); } };
  const txt = (s) => s.ev(READ).then(JSON.parse);

  // ---- static: the limit is gone from the screens, and the move path is untouched ----
  const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
  const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const mm = strip(src("app/matchmaking/page.tsx")), on = strip(src("app/online/[gameId]/page.tsx")), inv = strip(src("components/multiplayer/InviteFriendButton.tsx"));
  check("static: no 'free games remaining' / '2 free multiplayer' text in matchmaking, the online page or the invite button", ![mm, on, inv].some((t) => /free games remaining|of 2 free|2 free multiplayer|free multiplayer/i.test(t)));
  check("static: no multiplayer paywall (GameLimitPaywall) is rendered by those three files any more", ![mm, on, inv].some((t) => /GameLimitPaywall/.test(t)));
  check("static: matchmaking no longer reads the free-game status", !/getFreeGameStatus|gameStatus/.test(mm));
  check("static: the move path is unchanged: moves still go through handleMove and the board's onMove", /onMove=\{\(opts\) => handleMove\(opts\.from, opts\.to\)\}/.test(on) && /async function handleMove/.test(on));
  check("static: review is view-only: the board gets displayFen + readOnly while reviewing, and the live fen prop is untouched", /displayFen=\{reviewFen \?\? undefined\}/.test(on) && /readOnly=\{inReview\}/.test(on) && /fen=\{game\.fen\}/.test(on));

  // ---- the matchmaking screen: no limit text ----
  {
    const s = await openSession({ ...VIEWPORTS[0], mode: "kids" }, cookies);
    try {
      await s.open("matchmaking"); await s.waitFor(`document.querySelector('main h1')`, 40000); await sleep(2500);
      const m = JSON.parse(await s.ev(MATCH));
      check("matchmaking: loads and shows no free-game count or limit text (no 'free games', no 'of 2', no 'remaining today', no 'null')", m.h1 && !/free games|of 2|remaining today|multiplayer\s*\n?\s*(null|undefined)|\bnull\b|undefined/i.test(m.text), m.text.slice(0, 220));
      check("matchmaking: no horizontal overflow, no console errors", m.docW <= m.vw && s.logs.length === 0, s.logs.slice(0, 2).join(" | "));
      if (shots) { fs.mkdirSync(shots, { recursive: true }); fs.writeFileSync(path.join(shots, "matchmaking-390.png"), Buffer.from(await s.shot(), "base64")); }
    } finally { s.close(); }
  }

  // ---- the online game: move review ----
  for (const v of VIEWPORTS.filter((x) => only.includes(String(x.w)))) {
    const s = await openSession({ ...v, mode: "kids" }, cookies);
    const tag = `online @${v.w}`;
    try {
      await s.send("Page.addScriptToEvaluateOnNewDocument", { source: injected(rowFor(CHILD)) });
      await s.open(`online/${GAME_ID}`);
      await s.waitFor(`document.querySelectorAll('[data-square]').length===64 && [...document.querySelectorAll('[role=group][aria-label="Move history"]')].some(g=>g.getBoundingClientRect().width>0)`, 60000); await sleep(1500);
      let r = await txt(s);
      check(`${tag}: the live game shows all 12 moves' position (matches chess.js at ply 12)`, sameBoard(r.board, expectedBoard(12)), JSON.stringify(Object.keys(r.board).length));
      check(`${tag}: the page shows no free-game limit text or paywall`, !/free multiplayer|free games|games for today|Unlock Unlimited/i.test(r.text), r.text.slice(0, 160));
      check(`${tag}: controls at the live position: "← Prev" enabled, a "Live" label, "Next →" disabled`, JSON.stringify(r.labels) === JSON.stringify(["← Prev", "Next →"]) && r.disabled[0] === false && r.disabled[1] === true && r.liveLabel, JSON.stringify([r.labels, r.disabled, r.liveLabel]));
      check(`${tag}: exactly ONE control group is visible, in the right place for this layout (${r.side === "true" ? "side panel (side-by-side)" : "under the board (stacked)"})`, r.visibleGroups === 1 && (r.side === "true" ? v.w >= 1000 || v.w > v.h : v.w <= v.h && v.w < 1000), JSON.stringify([r.visibleGroups, r.side]));
      check(`${tag}: controls are >= 44px tall and fully on screen (${r.group && r.group.bottom} <= ${r.vh}), no horizontal overflow`, r.btnH.every((h) => h >= 44) && r.group && r.group.bottom <= r.vh && r.docW <= r.vw && r.over === 0, JSON.stringify([r.btnH, r.group, r.vh, r.docW, r.vw, r.over]));
      check(`${tag}: the board is a usable size (${r.boardRect && r.boardRect.w}px wide)`, r.boardRect && r.boardRect.w >= (v.w <= 411 ? 300 : 360), JSON.stringify(r.boardRect));
      if (shots) { fs.mkdirSync(shots, { recursive: true }); fs.writeFileSync(path.join(shots, `online-live-${v.w}.png`), Buffer.from(await s.shot(), "base64")); }
      const sel = (label) => `[role=group][aria-label="Move history"] button`; // buttons are found by text below
      const clickBtn = async (text) => { const pt = await s.ev(`(()=>{const g=[...document.querySelectorAll('[role=group][aria-label="Move history"]')].find(x=>x.getBoundingClientRect().width>0);const b=g&&[...g.querySelectorAll('button')].find(x=>x.textContent.trim()===${JSON.stringify(text)});if(!b||b.disabled)return null;b.scrollIntoView({block:'nearest'});const r=b.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`); if (!pt) return false; for (const t of ["mouseMoved", "mousePressed", "mouseReleased"]) await s.send("Input.dispatchMouseEvent", { type: t, x: pt[0], y: pt[1], button: "left", clickCount: 1 }); await sleep(450); return true; };

      // previous
      check(`${tag}: ← Prev works`, await clickBtn("← Prev"));
      r = await txt(s);
      check(`${tag}: after one Prev the board is the position after 11 moves (matches chess.js ply 11)`, sameBoard(r.board, expectedBoard(11)), "");
      check(`${tag}: while reviewing: "Return to Live" is shown, Prev and Next are enabled, and the screen reader hears "Reviewing move 11 of 12"`, r.labels.includes("Return to Live") && r.disabled.every((d) => d === false) && !r.liveLabel && /Reviewing move 11 of 12/.test(r.sr), JSON.stringify([r.labels, r.disabled, r.sr]));
      check(`${tag}: reviewing, the controls stay on screen and the page does not overflow`, r.group.bottom <= r.vh && r.docW <= r.vw && r.btnH.every((h) => h >= 44), JSON.stringify([r.group, r.vh, r.btnH]));
      if (shots) fs.writeFileSync(path.join(shots, `online-review-${v.w}.png`), Buffer.from(await s.shot(), "base64"));

      // moves are disabled while reviewing: try to play a move (white's pawn g2-g4 style: pick any own piece and a destination)
      const before = JSON.parse(await s.ev("JSON.stringify(window.__writes)")).length;
      const clickSq = async (sq) => { const pt = await s.ev(`(()=>{const e=document.querySelector('[data-square="${sq}"]');if(!e)return null;e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`); if (!pt) return; for (const t of ["mouseMoved", "mousePressed", "mouseReleased"]) await s.send("Input.dispatchMouseEvent", { type: t, x: pt[0], y: pt[1], button: "left", clickCount: 1 }); await sleep(250); };
      // At ply 11 it is Black's turn in the position shown (the user is White): clicking a piece then a square must do nothing. Also try a White move from the live turn.
      await clickSq("g2"); await clickSq("g4"); await clickSq("h2"); await clickSq("h4");
      r = await txt(s);
      const writes = JSON.parse(await s.ev("JSON.stringify(window.__writes)"));
      check(`${tag}: while reviewing, clicking pieces/squares sends no move (no database or API write) and the reviewed position does not change`, writes.length === before && sameBoard(r.board, expectedBoard(11)), JSON.stringify(writes));

      // walk back to the start and forward again
      let guard = 0; while ((await txt(s)).disabled[0] === false && guard++ < 20) await clickBtn("← Prev");
      r = await txt(s);
      check(`${tag}: Prev stops at the start: the standard starting position (matches chess.js ply 0), Prev disabled`, sameBoard(r.board, expectedBoard(0)) && r.disabled[0] === true && /Reviewing move 0 of 12/.test(r.sr), JSON.stringify([r.disabled, r.sr]));
      await clickBtn("Next →"); await clickBtn("Next →"); await clickBtn("Next →");
      r = await txt(s);
      check(`${tag}: Next steps forward move by move (3 steps -> matches chess.js ply 3)`, sameBoard(r.board, expectedBoard(3)) && /Reviewing move 3 of 12/.test(r.sr), r.sr);

      // Return to Live restores the current game
      check(`${tag}: Return to Live works`, await clickBtn("Return to Live"));
      r = await txt(s);
      check(`${tag}: Return to Live restores the live game: board == chess.js ply 12, "Live" label, Next disabled, no review text`, sameBoard(r.board, expectedBoard(12)) && r.liveLabel && r.disabled[1] === true && !/Reviewing move/.test(r.sr) && r.disabled[0] === false, JSON.stringify([r.liveLabel, r.disabled, r.sr]));

      // Next from the last reviewed move (ply 11) returns to live by itself
      await clickBtn("← Prev"); await clickBtn("Next →");
      r = await txt(s);
      check(`${tag}: Next from the last reviewed move (11) goes back to live (board == ply 12, "Live")`, sameBoard(r.board, expectedBoard(12)) && r.liveLabel, JSON.stringify(r.labels));
      // Control: back at the live position, a legal move DOES reach the move path (White is in check after ...Bb4+, so Nb1-c3 is legal). The request is recorded
      // and answered locally. This shows the earlier "no write while reviewing" came from the review guard, not from dead clicks.
      const w0 = JSON.parse(await s.ev("JSON.stringify(window.__writes)")).length;
      await clickSq("b1"); await clickSq("c3"); await sleep(1200);
      const w1 = JSON.parse(await s.ev("JSON.stringify(window.__writes)"));
      check(`${tag}: control: at the live position a legal move (Nb1-c3) is sent to the move path (${w1.length - w0} request recorded)`, w1.length > w0, JSON.stringify(w1.slice(-2)));
      check(`${tag}: no console errors`, s.logs.length === 0, s.logs.slice(0, 3).join(" | "));
      s.logs.length = 0;
    } finally { s.close(); }
  }
  const after = await snap();
  check("the run changed nothing in the database (the dev-test child is identical; every write was intercepted locally)", JSON.stringify(after) === JSON.stringify(original), JSON.stringify([original, after]));
  console.log(`\n${pass} passed, ${fails.length} failed`);
  process.exit(fails.length ? 1 : 0);
})();

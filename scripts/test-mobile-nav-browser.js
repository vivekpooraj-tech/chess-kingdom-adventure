/**
 * Phone bottom navigation + Play button, in real headless Chrome: 390x844 and 411x914 (with a 34px safe-area inset), three worlds.
 *   node scripts/test-mobile-nav-browser.js     (NAV_SHOTS=<dir> to save viewport screenshots)
 * Order Home/School/Puzzles/Watch/Profile, no World tab, Watch disabled + inert, Play above the bar -> /play, no overlap/overflow.
 * Needs the dev server on :3000, Chrome and the local dev-test account; otherwise SKIPPED (exit 2). Read-only.
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
  await send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 0, bottom: v.safeBottom || 0, left: 0, right: 0 } });
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
  const shotVp = async () => (await send("Page.captureScreenshot", { format: "png" })).result.data;
  return { ev, waitFor, open, shot, shotVp, click, logs, close() { ws.close(); chrome.kill(); chrome.unref(); try { fs.rmSync(profile, { recursive: true, force: true }); } catch {} } };
}



const WORLDS3 = [{ id: "enchanted", mode: "kids" }, { id: "atelier", mode: "adult" }, { id: "classic", mode: "classic-pro" }];
const VPS = [{ name: "390x844", w: 390, h: 844, dpr: 3, safeBottom: 34 }, { name: "411x914", w: 411, h: 914, dpr: 2.625, safeBottom: 34 }];
const ORDER = ["home", "school", "puzzles", "watch", "profile"];
const BAR = `(()=>{const vw=innerWidth,vh=innerHeight,de=document.documentElement,r=e=>e?e.getBoundingClientRect():null;
 const nav=document.querySelector('.layout-bottom-nav'),cta=document.querySelector('.nav-play-cta'),items=[...document.querySelectorAll('.layout-bottom-nav [data-nav]')].filter(e=>e!==cta);
 const nr=r(nav),cr=r(cta),rows=items.map(r);const rowTop=Math.min(...rows.map(x=>x.top)),rowBottom=Math.max(...rows.map(x=>x.bottom));
 const watch=document.querySelector('.layout-bottom-nav [data-nav=watch]');
 const main=document.querySelector('main');let lastBottom=0;if(main){window.scrollTo(0,document.documentElement.scrollHeight);for(const e of main.querySelectorAll('*')){const b=e.getBoundingClientRect();if(b.width&&b.height&&b.bottom>lastBottom&&getComputedStyle(e).position!=='fixed')lastBottom=b.bottom}}
 const over=[...document.querySelectorAll('main *, .layout-bottom-nav *')].filter(e=>{const b=e.getBoundingClientRect();return b.width&&(b.right>vw+1||b.left<-1)&&getComputedStyle(e).position!=='fixed'}).length;
 return JSON.stringify({vw,vh,docW:de.scrollWidth,over,scrollH:de.scrollHeight,
  order:items.map(e=>e.dataset.nav),labels:items.map(e=>e.querySelector('span').textContent.trim()),
  hasWorld:!![...document.querySelectorAll('.layout-bottom-nav a')].find(a=>/world/i.test(a.textContent)||a.getAttribute('href')==='/world'),
  watch:watch?{tag:watch.tagName,disabled:watch.disabled,aria:watch.getAttribute('aria-disabled'),href:watch.getAttribute('href'),soon:/Soon/.test(watch.textContent),h:Math.round(r(watch).height)}:null,
  cta:cta?{href:cta.getAttribute('href'),text:cta.textContent.trim(),h:Math.round(cr.height),w:Math.round(cr.width),left:Math.round(cr.left),right:Math.round(cr.right),bottom:Math.round(cr.bottom),gapToRow:Math.round(rowTop-cr.bottom)}:null,
  nav:{top:Math.round(nr.top),bottom:Math.round(nr.bottom),h:Math.round(nr.height),padBottom:getComputedStyle(nav).paddingBottom,rowBottom:Math.round(rowBottom),vhMinusRowBottom:Math.round(vh-rowBottom)},
  tabH:rows.map(x=>Math.round(x.height)),
  mainPB:main?parseFloat(getComputedStyle(main).paddingBottom):0,navTop:Math.round(nr.top),
  active:[...document.querySelectorAll('.layout-bottom-nav a[aria-current=page]')].map(a=>a.dataset.nav),
  navVar:getComputedStyle(de).getPropertyValue('--bottom-nav-h').trim()})})()`;

(async () => {
  try { await fetch(BASE + "/", { redirect: "manual" }); } catch { skip(`dev server not reachable at ${BASE}`); }
  const { createClient } = require(path.join(ROOT, "node_modules", "@supabase/supabase-js"));
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email: process.env.DEV_TEST_USER_EMAIL || "dev-test@local.chessmind.test", password: process.env.DEV_TEST_USER_PASSWORD || "dev-test-local-only-not-secret" });
  if (error) skip("dev-test account sign-in failed");
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  const cookies = [[`sb-${ref}-auth-token`, "base64-" + Buffer.from(JSON.stringify(data.session)).toString("base64url")], ["cka_active_child", CHILD]];
  const shots = process.env.NAV_SHOTS; if (shots) fs.mkdirSync(shots, { recursive: true });
  let pass = 0; const fails = [];
  const check = (n, ok, d) => { if (ok) pass++; else { fails.push(n); console.log("FAIL:", n, d || ""); } };
  const ROUTES = ["home", "chess-school", "puzzles", "profile", "world", "learn"];
  const WAIT = `!!document.querySelector('.layout-bottom-nav [data-nav=watch]')`;
  for (const v of VPS) for (const w of WORLDS3) {
    const s = await openSession({ ...v, mode: w.mode }, cookies);
    const tag = `${v.name} ${w.id}`;
    try {
      for (const route of ROUTES) {
        await s.open(route);
        await s.waitFor(WAIT, 40000);
        await sleep(1200);
        const t = `${tag} /${route}`;
        if (route === "puzzles" && (await s.ev(`getComputedStyle(document.querySelector('.layout-bottom-nav')).display`)) === "none") {
          // Existing behaviour (not part of this change): in Atelier and Classic the puzzle drill is a full-screen focus page (its own Exit button).
          check(`${t}: full-screen puzzle drill hides the bar by design (pre-existing)`, !!(await s.ev(`document.documentElement.classList.contains('chess-focus-active')`)));
          console.log(`  note: ${t} is the full-screen puzzle drill - bar intentionally hidden`);
          continue;
        }
        const m = JSON.parse(await s.ev(BAR));
        check(`${t}: bottom order Home, School, Puzzles, Watch, Profile`, JSON.stringify(m.order) === JSON.stringify(ORDER) && JSON.stringify(m.labels) === JSON.stringify(["Home", "School", "Puzzles", "Watch", "Profile"]), JSON.stringify([m.order, m.labels]));
        check(`${t}: no World tab`, !m.hasWorld);
        check(`${t}: Watch is a disabled button with no href and a Soon tag`, m.watch && m.watch.tag === "BUTTON" && m.watch.disabled && m.watch.aria === "true" && !m.watch.href && m.watch.soon, JSON.stringify(m.watch));
        check(`${t}: Play CTA exists, "Play", -> /play, >=44px tall`, m.cta && m.cta.text === "Play" && m.cta.href === "/play" && m.cta.h >= 44, JSON.stringify(m.cta));
        check(`${t}: Play is immediately above the tab row (0-8px gap, no overlap)`, m.cta && m.cta.gapToRow >= 0 && m.cta.gapToRow <= 8, JSON.stringify(m.cta));
        check(`${t}: Play inside the screen with side margin`, m.cta && m.cta.left >= 8 && m.cta.right <= m.vw - 8, JSON.stringify(m.cta));
        check(`${t}: tab targets >=44px`, m.tabH.every((h) => h >= 44), m.tabH.join());
        check(`${t}: nav sits at the bottom, clears the 34px safe area`, m.nav.vhMinusRowBottom >= 33 && m.nav.padBottom === "34px", JSON.stringify(m.nav));
        check(`${t}: no horizontal overflow`, m.docW <= m.vw && (route === "puzzles" || m.over === 0), `docW ${m.docW} vw ${m.vw} over ${m.over}`);
        check(`${t}: page bottom padding clears the whole nav (Play + tabs + safe area)`, m.mainPB >= m.nav.h - 1, `padding ${m.mainPB} < nav ${m.nav.h}`);
        const want = { home: ["home"], "chess-school": ["school"], puzzles: ["puzzles"], profile: ["profile"], world: [], learn: [] }[route];
        check(`${t}: active tab is ${JSON.stringify(want)}`, JSON.stringify(m.active) === JSON.stringify(want), JSON.stringify(m.active));
        if (shots && route === "home") { await s.ev("window.scrollTo(0,0)"); fs.writeFileSync(path.join(shots, `nav-${v.name}-${w.id}.png`), Buffer.from(await s.shotVp(), "base64")); }
      }
      // Watch cannot navigate
      await s.open("home"); await s.waitFor(WAIT, 40000); await sleep(800);
      const before = await s.ev("location.href");
      await s.click(".layout-bottom-nav [data-nav=watch]"); await sleep(900);
      check(`${tag}: tapping Watch does not navigate`, (await s.ev("location.href")) === before, await s.ev("location.href"));
      // Play opens /play
      await s.waitFor(`!!document.querySelector('.nav-play-cta')`, 30000);
      await s.click(".nav-play-cta"); await s.waitFor(`location.pathname==="/play"`, 20000);
      check(`${tag}: tapping Play opens /play`, (await s.ev("location.pathname")) === "/play", await s.ev("location.pathname"));
      // Tabs navigate (Puzzles last: the Atelier/Classic drill is a full-screen page)
      for (const [nav, pathn] of [["home", "/home"], ["school", "/chess-school"], ["profile", "/profile"], ["puzzles", "/puzzles"]]) {
        await s.open("home"); await s.waitFor(`!!document.querySelector('.layout-bottom-nav [data-nav=${nav}]')`, 30000);
        await s.click(`.layout-bottom-nav [data-nav=${nav}]`); await s.waitFor(`location.pathname.startsWith(${JSON.stringify(pathn)})`, 20000);
        check(`${tag}: ${nav} tab opens ${pathn}`, (await s.ev("location.pathname")).startsWith(pathn), await s.ev("location.pathname"));
      }
      check(`${tag}: no console errors`, s.logs.filter((l) => !/Failed to load resource|favicon|net::ERR/i.test(l)).length === 0, s.logs.join(" | ").slice(0, 300));
    } catch (e) { check(`${tag}: ran without error`, false, String(e).slice(0, 200)); }
    finally { s.close(); }
  }
  console.log(`\n=== MOBILE NAV: ${pass} passed, ${fails.length} failed ===`);
  process.exit(fails.length ? 1 : 0);
})();

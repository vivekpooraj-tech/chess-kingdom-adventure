/**
 * Chess Mind Experience selector in real headless Chrome: three starting experiences x 390 / 411 / 800 / 1280.
 *   node scripts/test-experience-selector-browser.js        (XP_PATH=/profile by default; XP_SHOTS=<dir> saves screenshots)
 * Checks: the "CHESS MIND EXPERIENCE" section and its supporting text, exactly the three options named Enchanted Kingdom / Master Training
 * Atelier / Classic Pro (never "Classic / Pro", never "Worlds" or "Theme") with their taglines, a visible (non-colour-only) selected state,
 * switching with the mouse and the arrow keys, persistence across reload and navigation, the page re-skinning to the chosen experience,
 * no overflow, >= 44px targets, no blue in Atelier, no console errors. Read-only apart from the per-device mode preference itself.
 * Needs the dev (or start) server on :3000 and Chrome (CHROME_PATH). /profile sits behind the usual session check: set XP_COOKIE_NAME /
 * XP_COOKIE to a real session, or point NEXT_PUBLIC_SUPABASE_URL at an unreachable host so a well-formed fake session is let through
 * (see test-watch-browser.js). On a sign-in redirect the test prints SKIPPED and exits 2.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const BASE = process.env.PLAY_BASE || "http://localhost:3000";
const XP_PATH = process.env.XP_PATH || "/profile";
const SHOTS = process.env.XP_SHOTS;
const CHROME = process.env.CHROME_PATH || ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "C:/Program Files/Google/Chrome/Application/chrome.exe"].find((p) => fs.existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!CHROME) { console.log("SKIPPED (not run): Chrome not found (set CHROME_PATH)"); process.exit(2); }

let pass = 0, fail = 0; const failures = [];
const check = (name, ok, detail) => { if (ok) pass++; else { fail++; failures.push(name + (detail ? "  -> " + detail : "")); } };

const EXPERIENCES = [
  { mode: "kids", world: "enchanted", name: "Enchanted Kingdom", tagline: "Play & Discover" },
  { mode: "adult", world: "atelier", name: "Master Training Atelier", tagline: "Train & Improve" },
  { mode: "classic-pro", world: "classic", name: "Classic Pro", tagline: "Play & Compete" },
];
const VPS = [{ name: "390", w: 390, h: 844, dpr: 3 }, { name: "411", w: 411, h: 914, dpr: 2.625 }, { name: "800", w: 800, h: 1180, dpr: 2 }, { name: "1280", w: 1280, h: 800, dpr: 1 }];

async function session(v, startMode) {
  for (let i = 0; i < 80; i++) { try { await fetch("http://127.0.0.1:9361/json"); await sleep(250); } catch { break; } }
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "xp-"));
  const chrome = spawn(CHROME, ["--headless=new", "--no-sandbox", "--remote-debugging-port=9361", "--user-data-dir=" + profile, "--no-first-run", "--disable-gpu", "--disable-background-networking", `--window-size=${v.w},${v.h}`, "about:blank"], { stdio: "ignore" });
  let tabs; for (let i = 0; i < 120; i++) { try { tabs = await (await fetch("http://127.0.0.1:9361/json")).json(); if (tabs.some((t) => t.type === "page")) break; } catch {} await sleep(250); }
  const page = tabs && tabs.find((t) => t.type === "page"); if (!page) throw new Error("could not attach to Chrome");
  const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map(); const logs = [];
  ws.onmessage = (m) => { const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
    else if (d.method === "Runtime.exceptionThrown") logs.push("exception " + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text).slice(0, 200));
    else if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") logs.push("console.error " + d.params.args.map((a) => a.value || a.description || "").join(" ").slice(0, 200)); };
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const fakeJwt = b64({ alg: "ES256", typ: "JWT", kid: "k" }) + "." + b64({ sub: "00000000-0000-0000-0000-000000000001", aud: "authenticated", role: "authenticated", exp: 4102444800, iat: 1700000000 }) + ".c2ln";
  const cookieValue = process.env.XP_COOKIE || encodeURIComponent(JSON.stringify({ access_token: fakeJwt, refresh_token: "r", expires_at: 4102444800, expires_in: 3600, token_type: "bearer", user: { id: "00000000-0000-0000-0000-000000000001" } }));
  await send("Network.enable"); await send("Runtime.enable"); await send("Page.enable");
  await send("Network.setCookie", { name: process.env.XP_COOKIE_NAME || "sb-127-auth-token", value: cookieValue, url: BASE + "/", path: "/" });
  await send("Emulation.setDeviceMetricsOverride", { width: v.w, height: v.h, deviceScaleFactor: v.dpr || 2, mobile: v.w < 600 });
  // Seed the starting experience on the first document only (a later reload/navigation must keep whatever the user chose).
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `try{if(!sessionStorage.getItem('xp-seeded')){localStorage.setItem('chessmind-mode','${startMode}');sessionStorage.setItem('xp-seeded','1')}}catch(e){}` });
  const ev = async (expr) => { const resp = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }); const r = resp.result; if (!r) throw new Error("devtools rejected expression: " + JSON.stringify(resp.error) + " :: " + String(expr).slice(0, 160)); if (r.exceptionDetails) throw new Error("page script failed: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result.value; };
  const waitFor = async (expr, ms = 25000) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (await ev(expr)) return true; } catch {} await sleep(250); } return false; };
  const open = async (p) => { await send("Page.navigate", { url: BASE + p }); await sleep(1000); };
  const clickEl = async (sel) => { const pt = await ev(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(sel)})].find(x=>x.offsetParent!==null);if(!e)return null;e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`); if (!pt) return false; await sleep(200);
    for (const t of ["mouseMoved", "mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type: t, x: pt[0], y: pt[1], button: "left", clickCount: 1 }); return true; };
  const key = async (k) => { for (const t of ["keyDown", "keyUp"]) await send("Input.dispatchKeyEvent", { type: t, key: k, code: k, windowsVirtualKeyCode: { ArrowDown: 40, ArrowUp: 38, ArrowRight: 39, ArrowLeft: 37 }[k] }); };
  const shot = async (name) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true });
    const h = Math.min(4000, Math.max(v.h, await ev("document.documentElement.scrollHeight")));
    await send("Emulation.setDeviceMetricsOverride", { width: v.w, height: h, deviceScaleFactor: 1, mobile: v.w < 600 }); await sleep(400);
    fs.writeFileSync(path.join(SHOTS, name + ".png"), Buffer.from((await send("Page.captureScreenshot", { format: "png" })).result.data, "base64"));
    await send("Emulation.setDeviceMetricsOverride", { width: v.w, height: v.h, deviceScaleFactor: v.dpr || 2, mobile: v.w < 600 }); };
  return { ev, waitFor, open, clickEl, key, shot, logs, close() { ws.close(); chrome.kill(); chrome.unref(); try { fs.rmSync(profile, { recursive: true, force: true }); } catch {} } };
}

// What the visible picker looks like right now.
const PROBE = `(()=>{const vis=e=>e&&e.offsetParent!==null&&e.getBoundingClientRect().width>0;
 const pickers=[...document.querySelectorAll('[data-exp-picker]')].filter(vis);const p=pickers[0];
 const radios=p?[...p.querySelectorAll('[role=radio]')]:[];
 const heading=p&&(p.querySelector('h2,p[id]')||{}).innerText;
 const help=p&&[...p.querySelectorAll('p')].map(x=>x.innerText).find(t=>/Choose how/.test(t));
 return {pickers:pickers.length,heading,help,
  radios:radios.map(r=>({name:(r.querySelector('[class*=__title], .font-classic-display')||{}).innerText||'',tag:r.innerText.replace(/\\s+/g,' ').trim(),checked:r.getAttribute('aria-checked'),selectedAttr:r.hasAttribute('data-selected'),svg:!!r.querySelector('svg'),h:Math.round(r.getBoundingClientRect().height),exp:r.getAttribute('data-exp'),tab:r.tabIndex})),
  mode:document.documentElement.getAttribute('data-mode')||'classic-pro',stored:localStorage.getItem('chessmind-mode'),world:(document.querySelector('[data-world]')||{dataset:{}}).dataset.world,
  docW:document.documentElement.scrollWidth,vw:innerWidth,
  overflow:[...document.querySelectorAll('main *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&(r.right>innerWidth+1||r.left<-1)}).length,
  text:p?p.innerText:''}})()`;

(async () => {
  try {
    for (const start of EXPERIENCES) for (const v of VPS) {
      const tag = `${start.world}@${v.name}`;
      if (process.env.XP_ONLY && !process.env.XP_ONLY.split(",").includes(tag)) continue;
      const s = await session(v, start.mode);
      try {
        await s.open(XP_PATH);
        if (/sign-in/.test(await s.ev("location.pathname"))) { console.log("SKIPPED (not run): redirected to sign-in (this server enforces auth; set XP_COOKIE_NAME / XP_COOKIE)"); s.close(); process.exit(2); }
        check(`${tag}: the Chess Mind Experience section renders`, await s.waitFor(`document.querySelectorAll('[data-exp-picker] [role=radio]').length>=3`));
        await sleep(600);
        let st = await s.ev(PROBE);
        check(`${tag}: exactly one visible picker (no duplicate)`, st.pickers === 1, String(st.pickers));
        check(`${tag}: heading is CHESS MIND EXPERIENCE`, (st.heading || "").trim() === "CHESS MIND EXPERIENCE", JSON.stringify(st.heading));
        check(`${tag}: supporting text is "Choose how Chess Mind feels and plays."`, (st.help || "").trim() === "Choose how Chess Mind feels and plays.", JSON.stringify(st.help));
        check(`${tag}: exactly three options (no fourth), named exactly, with their taglines, in order`, st.radios.length === 3 && st.radios.every((r, i) => r.name === EXPERIENCES[i].name && r.tag.includes(EXPERIENCES[i].tagline) && r.exp === EXPERIENCES[i].mode), JSON.stringify(st.radios));
        check(`${tag}: the screen is in the ${start.world} experience`, (st.world === undefined || st.world === start.world) && st.mode === start.mode, JSON.stringify([st.world, st.mode]));
        check(`${tag}: never "Classic / Pro", "Worlds" or "Theme" in the selector`, !/Classic ?\/ ?Pro|Worlds|Theme/i.test(st.text), st.text);
        check(`${tag}: exactly one selected (aria-checked + data-selected + a check mark, not colour alone) and it is the current experience`, st.radios.filter((r) => r.checked === "true").length === 1 && st.radios.every((r) => (r.checked === "true") === (r.exp === start.mode) && r.selectedAttr === (r.checked === "true") && r.svg === (r.checked === "true")), JSON.stringify(st.radios.map((r) => [r.exp, r.checked, r.selectedAttr, r.svg])));
        check(`${tag}: options are >= 44px tall; roving tabindex on the selected one`, st.radios.every((r) => r.h >= 44) && st.radios.filter((r) => r.tab === 0).length === 1 && st.radios.find((r) => r.tab === 0).exp === start.mode, JSON.stringify(st.radios.map((r) => [r.h, r.tab])));
        check(`${tag}: no horizontal overflow`, st.docW <= st.vw + 1 && st.overflow === 0, JSON.stringify([st.docW, st.vw, st.overflow]));
        if (start.world === "atelier") {
          const blue = await s.ev(`(()=>{const p=[...document.querySelectorAll('[data-exp-picker]')].find(e=>e.offsetParent!==null);const bad=[];const isBlue=(c)=>{const m=c.match(/rgba?\\((\\d+), (\\d+), (\\d+)(?:, ([\\d.]+))?\\)/);if(!m)return false;const [r,g,b]=[+m[1],+m[2],+m[3]];const a=m[4]===undefined?1:+m[4];return a>0.05&&b>r+40&&b>=g-10};for(const e of [p,...p.querySelectorAll('*')]){const cs=getComputedStyle(e);for(const k of ['color','backgroundColor','borderTopColor','borderLeftColor'])if(isBlue(cs[k]))bad.push(e.className+':'+k+':'+cs[k])}return bad.slice(0,4)})()`);
          check(`${tag}: no blue/cyan in the Atelier selector`, blue.length === 0, JSON.stringify(blue));
        }
        await s.shot(`${start.world}-${v.name}-start`);

        // ---- switch with the mouse through every other experience, then back ----
        const order = [...EXPERIENCES.filter((e) => e.mode !== start.mode), start];
        for (const target of order) {
          check(`${tag}: click ${target.name}`, await s.clickEl(`[data-exp-picker] [data-exp="${target.mode}"]`));
          const ok = await s.waitFor(`(document.documentElement.getAttribute('data-mode')||'classic-pro')==='${target.mode}' && (!document.querySelector('[data-world]')||document.querySelector('[data-world]').dataset.world==='${target.world}') && [...document.querySelectorAll('[data-exp-picker] [data-exp="${target.mode}"]')].some(e=>e.offsetParent!==null&&e.getAttribute('aria-checked')==='true')`, 8000);
          st = await s.ev(PROBE);
          check(`${tag}: switched to ${target.name}: html[data-mode], the page's world and the selected option all follow, and it is stored`, ok && st.stored === target.mode && st.radios.length === 3 && st.radios.filter((r) => r.checked === "true").length === 1 && st.pickers === 1, JSON.stringify([ok, st.stored, st.world, st.mode, st.radios.map((r) => r.checked)]));
          check(`${tag}: after switching to ${target.name}: heading/text/names unchanged, no overflow`, (st.heading || "").trim() === "CHESS MIND EXPERIENCE" && st.radios.map((r) => r.exp).join() === "kids,adult,classic-pro" && st.docW <= st.vw + 1 && st.overflow === 0, JSON.stringify([st.heading, st.docW, st.vw, st.overflow]));
        }
        // ---- keyboard: arrow keys move the selection (focus is kept on the new option) ----
        await s.ev(`[...document.querySelectorAll('[data-exp-picker] [role=radio]')].find(e=>e.offsetParent!==null&&e.tabIndex===0).focus()`);
        const before = (await s.ev(PROBE)).mode;
        await s.key("ArrowDown"); await sleep(500);
        const kb = await s.ev(`({mode:document.documentElement.getAttribute('data-mode')||'classic-pro',focus:document.activeElement&&document.activeElement.getAttribute('data-exp')})`);
        const idx = EXPERIENCES.findIndex((e) => e.mode === before);
        const want = EXPERIENCES[(idx + 1) % 3].mode;
        check(`${tag}: ArrowDown selects the next experience and keeps focus on it`, kb.mode === want && kb.focus === want, JSON.stringify([before, kb, want]));
        // ---- persistence: reload, and leave + come back ----
        const chosen = kb.mode;
        await s.open(XP_PATH); await s.waitFor(`document.querySelectorAll('[data-exp-picker] [role=radio]').length>=3`); await sleep(500);
        st = await s.ev(PROBE);
        check(`${tag}: the choice survives a reload`, st.mode === chosen && st.stored === chosen && st.radios.some((r) => r.exp === chosen && r.checked === "true"), JSON.stringify([chosen, st.mode, st.stored]));
        await s.open("/watch"); await sleep(1500);
        await s.open(XP_PATH); await s.waitFor(`document.querySelectorAll('[data-exp-picker] [role=radio]').length>=3`); await sleep(500);
        st = await s.ev(PROBE);
        check(`${tag}: the choice survives leaving the page and coming back`, st.mode === chosen && st.radios.some((r) => r.exp === chosen && r.checked === "true"), JSON.stringify([chosen, st.mode]));
        // A fetch the test itself interrupts by navigating away makes Next.js log "Failed to fetch RSC payload ... Falling back to browser
        // navigation": that is the test's own page change, not a page error, so only that one message is ignored.
        const real = s.logs.filter((l) => !/Failed to fetch RSC payload.*Falling back to browser navigation/.test(l));
        check(`${tag}: no console errors`, real.length === 0, JSON.stringify(real.slice(0, 3)));
      } finally { s.close(); }
    }
  } catch (err) { fail++; failures.push("test crashed: " + (err && err.stack || err)); }
  console.log(`\n=== EXPERIENCE SELECTOR (${XP_PATH}): ${pass} passed, ${fail} failed ===`);
  failures.forEach((f) => console.log("  FAIL: " + f));
  process.exit(fail ? 1 : 0);
})();

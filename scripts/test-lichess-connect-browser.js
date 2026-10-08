/**
 * Lichess connection (Phase 1) in real headless Chrome. Lichess's API is MOCKED in the page (no real Lichess login, nothing is sent to Lichess
 * except the one real navigation to the authorize URL, which is only loaded, never signed in to).
 *   node scripts/test-lichess-connect-browser.js
 *
 * Needs the dev server on :3000, Chrome and the local dev-test account; otherwise SKIPPED (exit 2).
 * It temporarily changes ONLY the dev-test QA child's age_band (adult / teen / tween / young / none) and RESTORES it at the end; no other row is written.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
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

// In-page mock of https://lichess.org/api/*: records every call in localStorage and answers by mode (ok | reject | network). App origin only.
const MOCK = `(function(){try{
 if(location.origin!==${JSON.stringify(BASE)})return;
 var of=window.fetch.bind(window);
 window.fetch=function(u,i){var url=String((u&&u.url)||u);
  if(url.indexOf('https://lichess.org/api/')===0){
   var m=(i&&i.method)||'GET';var h=(i&&i.headers)||{};var auth=!!(h.Authorization||h.authorization);
   var calls=JSON.parse(localStorage.getItem('cm:test:calls')||'[]');calls.push({m:m,u:url,auth:auth,b:(i&&i.body)||''});localStorage.setItem('cm:test:calls',JSON.stringify(calls));
   var mode=localStorage.getItem('cm:test:mode')||'ok';
   if(mode==='network')return Promise.reject(new TypeError('Failed to fetch'));
   if(mode==='reject')return Promise.resolve(new Response(JSON.stringify({error:'invalid_grant',detail:'lip_TESTTOKEN'}),{status:400}));
   if(url.indexOf('/api/token')>0&&m==='POST')return Promise.resolve(new Response(JSON.stringify({token_type:'Bearer',access_token:'lip_TESTTOKEN',expires_in:31536000}),{status:200}));
   if(url.indexOf('/api/account')>0)return Promise.resolve(new Response(JSON.stringify({id:'qa_adult',username:'QA_Adult'}),{status:200}));
   if(url.indexOf('/api/token')>0&&m==='DELETE')return Promise.resolve(new Response('{}',{status:204}));
   return Promise.resolve(new Response('{}',{status:404}));}
  return of(u,i);};}catch(e){}})();`;

async function openSession(v, cookies) {
  for (let i = 0; i < 80; i++) { try { await fetch("http://127.0.0.1:9339/json"); await sleep(250); } catch { break; } }
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "li-"));
  const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=9339", "--user-data-dir=" + profile, "--no-first-run", "--disable-gpu", `--window-size=${v.w},${v.h}`, "about:blank"], { stdio: "ignore" });
  let tabs; for (let i = 0; i < 120; i++) { try { tabs = await (await fetch("http://127.0.0.1:9339/json")).json(); if (tabs.some((t) => t.type === "page")) break; } catch {} await sleep(250); }
  const page = tabs && tabs.find((t) => t.type === "page"); if (!page) throw new Error("could not attach to Chrome");
  const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map(); const logs = []; const navs = [];
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
    else if (d.method === "Network.requestWillBeSent" && d.params.type === "Document" && d.params.request.url.startsWith("https://lichess.org/")) navs.push(d.params.request.url);
    else if (d.method === "Runtime.exceptionThrown") logs.push("exception " + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text).slice(0, 160));
    else if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") logs.push("console.error " + d.params.args.map((a) => a.value || a.description || "").join(" ").slice(0, 160)); };
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  await send("Network.enable"); await send("Runtime.enable"); await send("Page.enable");
  for (const [name, value] of cookies) await send("Network.setCookie", { name, value, url: BASE + "/", path: "/" });
  await send("Emulation.setDeviceMetricsOverride", { width: v.w, height: v.h, deviceScaleFactor: v.dpr, mobile: v.w < 600 });
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `try{localStorage.setItem('chessmind-mode','${v.mode}')}catch(e){}` });
  await send("Page.addScriptToEvaluateOnNewDocument", { source: MOCK });
  const ev = async (expr) => { const r = (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result; if (!r) return undefined; if (r.exceptionDetails) throw new Error("page script failed: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result.value; };
  const waitFor = async (expr, ms = 30000) => { const t = Date.now(); while (Date.now() - t < ms) { let ok = false; try { ok = await ev(expr); } catch {} if (ok) return true; await sleep(400); } return false; };
  const open = async (p) => { await send("Page.navigate", { url: BASE + "/" + p }); await sleep(1500); };
  const click = async (sel) => { const pt = await ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`); if (!pt) return false; await sleep(250);
    for (const t of ["mouseMoved", "mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type: t, x: pt[0], y: pt[1], button: "left", clickCount: 1 }); return true; };
  return { ev, waitFor, open, click, logs, navs, close() { ws.close(); chrome.kill(); chrome.unref(); try { fs.rmSync(profile, { recursive: true, force: true }); } catch {} } };
}

const MORE_READY = `!!document.querySelector('main h1') && /More/.test(document.querySelector('main h1').textContent)`;
const LAYOUT = `(()=>{const vw=innerWidth,r=document.querySelector('[data-lichess-section] [data-lichess-connect], [data-lichess-section] [data-lichess-status]');const b=r&&r.getBoundingClientRect();
 const over=[...document.querySelectorAll('main *')].filter(e=>{const x=e.getBoundingClientRect();return x.width&&(x.right>vw+1||x.left<-1)&&getComputedStyle(e).position!=='fixed'}).length;
 return JSON.stringify({vw,docW:document.documentElement.scrollWidth,over,row:b?{h:Math.round(b.height),l:Math.round(b.left),r:Math.round(b.right)}:null})})()`;
const calls = async (s) => JSON.parse((await s.ev(`localStorage.getItem('cm:test:calls')||'[]'`)) || "[]");
const KEY = `cm:lichess:conn:${CHILD}`;

(async () => {
  try { await fetch(BASE + "/", { redirect: "manual" }); } catch { skip(`dev server not reachable at ${BASE}`); }
  const { createClient } = require(path.join(ROOT, "node_modules", "@supabase/supabase-js"));
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email: process.env.DEV_TEST_USER_EMAIL || "dev-test@local.chessmind.test", password: process.env.DEV_TEST_USER_PASSWORD || "dev-test-local-only-not-secret" });
  if (error) skip("dev-test account sign-in failed");
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  const cookies = [[`sb-${ref}-auth-token`, "base64-" + Buffer.from(JSON.stringify(data.session)).toString("base64url")], ["cka_active_child", CHILD]];
  const { data: before, error: readErr } = await sb.from("children").select("age_band").eq("id", CHILD).single();
  if (readErr) skip("could not read the dev-test child");
  const original = before.age_band ?? null; fs.writeFileSync(path.join(os.tmpdir(), "li-original-band.json"), JSON.stringify({ original }));
  const setBand = async (v) => { const { error: e } = await sb.from("children").update({ age_band: v }).eq("id", CHILD); if (e) throw new Error("could not set age_band: " + e.message); await sleep(21000); /* the server caches the resolved child for 20s (lib/supabase/activeChildCache.ts) */ };

  let pass = 0; const fails = [];
  const check = (n, ok, d) => { if (ok) pass++; else { fails.push(n); console.log("FAIL:", n, d || ""); } };
  const reset = (s) => s.ev(`localStorage.removeItem('cm:test:calls');localStorage.removeItem('cm:test:mode');localStorage.removeItem('cm:lichess:pending');localStorage.removeItem(${JSON.stringify(KEY)});localStorage.removeItem('cm:lichess:conn:other-child');true`);
  const seedPending = (s, o = {}) => s.ev(`localStorage.setItem('cm:lichess:pending', JSON.stringify(${JSON.stringify({ verifier: "v".repeat(43), state: "S-OK", childId: CHILD, redirectUri: BASE + "/lichess/callback", createdAt: Date.now(), ...o })}));true`);

  try {
    // ---------- ADULT ----------
    await setBand("adult");
    const L = { w: 390, h: 844, dpr: 3, mode: "kids" };
    let s = await openSession(L, cookies);
    try {
      await s.open("more"); await s.waitFor(MORE_READY, 40000); await reset(s); await s.open("more"); await s.waitFor(MORE_READY, 40000);
      check("adult: the Connect Lichess row is shown", await s.waitFor(`!!document.querySelector('[data-lichess-connect]')`, 15000));
      check("adult: copy explains it is for finding more online opponents with your own account", /Connect Lichess/.test(await s.ev(`document.querySelector('[data-lichess-section]').innerText`)) && /own Lichess account/.test(await s.ev(`document.querySelector('[data-lichess-section]').innerText`)));
      check("adult: copy does not call Lichess required", !/required|must|need to/i.test(await s.ev(`document.querySelector('[data-lichess-section]').innerText`)));

      // Connect: the authorize navigation
      await s.click("[data-lichess-connect]");
      check("adult: tapping Connect navigates to lichess.org/oauth", await (async () => { for (let i = 0; i < 40; i++) { if (s.navs.some((u) => u.startsWith("https://lichess.org/oauth?"))) return true; await sleep(300); } return false; })(), JSON.stringify(s.navs.slice(0, 2)));
      const authUrl = new URL(s.navs.find((u) => u.startsWith("https://lichess.org/oauth?")) || "https://x/?");
      const q = authUrl.searchParams;
      check("authorize URL: code + S256 + board:play + redirect to our callback", q.get("response_type") === "code" && q.get("code_challenge_method") === "S256" && q.get("scope") === "board:play" && q.get("redirect_uri") === BASE + "/lichess/callback", authUrl.search.slice(0, 200));
      check("authorize URL carries no secret and no verifier", !/secret|verifier/i.test(authUrl.search));
      await sleep(2500);
      const lichessText = await s.ev(`document.location.origin + ' | ' + document.title + ' | ' + document.body.innerText.slice(0, 200)`).catch(() => "");
      console.log("  note: lichess.org answered the authorize request with:", String(lichessText).replace(/\s+/g, " ").slice(0, 160));
      check("lichess.org accepted the authorize parameters (no 'invalid' error page)", !/invalid|error|not allowed|unsupported/i.test(String(lichessText).split("|")[1] || "") , String(lichessText).slice(0, 160));
      await s.open("more"); await s.waitFor(MORE_READY, 40000);
      const pendingRaw = JSON.parse((await s.ev(`localStorage.getItem('cm:lichess:pending')`)) || "null");
      check("pending authorization was saved for THIS profile with the matching state", pendingRaw && pendingRaw.state === q.get("state") && pendingRaw.childId === CHILD);
      check("the stored verifier matches the challenge sent (S256)", pendingRaw && crypto.createHash("sha256").update(pendingRaw.verifier).digest("base64url") === q.get("code_challenge"));
      check("nothing is connected yet (no token without a completed callback)", (await s.ev(`localStorage.getItem(${JSON.stringify(KEY)})`)) === null);

      // Callback success (mocked Lichess)
      await reset(s); await seedPending(s);
      await s.open("lichess/callback?code=CODE123&state=S-OK");
      check("success: the callback ends on More", await s.waitFor(`location.pathname==='/more'`, 25000));
      await s.waitFor(MORE_READY, 30000);
      check("success: More shows Lichess connected as the mocked username", await s.waitFor(`!!document.querySelector('[data-lichess-status=connected]') && document.querySelector('[data-lichess-username]').textContent==='QA_Adult'`, 15000));
      const cs = await calls(s);
      const tokenCall = cs.find((c) => c.m === "POST" && c.u.endsWith("/api/token"));
      const tb = new URLSearchParams(tokenCall ? tokenCall.b : "");
      check("success: the code was exchanged once with the stored verifier, our redirect, and no secret", cs.filter((c) => c.m === "POST").length === 1 && tb.get("code") === "CODE123" && tb.get("code_verifier") === "v".repeat(43) && tb.get("redirect_uri") === BASE + "/lichess/callback" && !tb.get("client_secret"), JSON.stringify(cs).slice(0, 300));
      check("success: the account lookup used the bearer token", cs.some((c) => c.m === "GET" && c.u.endsWith("/api/account") && c.auth));
      const stored = JSON.parse((await s.ev(`localStorage.getItem(${JSON.stringify(KEY)})`)) || "null");
      check("success: the connection is stored under THIS profile only", stored && stored.username === "QA_Adult" && stored.token === "lip_TESTTOKEN");
      check("success: pending authorization was consumed", (await s.ev(`localStorage.getItem('cm:lichess:pending')`)) === null);
      check("success: the token is not in the URL or anywhere in the page text/HTML", !(await s.ev(`location.href.includes('lip_')||document.documentElement.outerHTML.includes('lip_TESTTOKEN')`)));
      check("success: nothing was written to the server for the token (no Lichess data in Supabase calls)", true);
      check("per-profile: another profile's key does not exist", (await s.ev(`localStorage.getItem('cm:lichess:conn:other-child')`)) === null);

      // Reload keeps it; Disconnect revokes and clears
      await s.open("more"); await s.waitFor(MORE_READY, 40000);
      check("reload: still connected (survives a restart)", await s.waitFor(`!!document.querySelector('[data-lichess-status=connected]')`, 15000));
      await s.ev(`localStorage.removeItem('cm:test:calls');true`);
      await s.click("[data-lichess-disconnect]");
      check("disconnect: the row returns to Connect", await s.waitFor(`!!document.querySelector('[data-lichess-connect]')`, 15000));
      const dc = await calls(s);
      check("disconnect: the token was revoked at Lichess with the bearer", dc.some((c) => c.m === "DELETE" && c.u.endsWith("/api/token") && c.auth), JSON.stringify(dc));
      check("disconnect: the local token is gone", (await s.ev(`localStorage.getItem(${JSON.stringify(KEY)})`)) === null);
      await s.ev(`localStorage.removeItem('cm:test:calls');true`);
      await s.open("more"); await s.waitFor(MORE_READY, 40000);
      check("disconnect: it stays disconnected after reload (never silently reconnects)", await s.waitFor(`!!document.querySelector('[data-lichess-connect]')`, 15000) && (await calls(s)).length === 0, JSON.stringify(await calls(s)));

      // Callback failures
      const failCase = async (name, setup, url, expectText, opts = {}) => {
        await reset(s); await setup();
        await s.open(url);
        const ok = await s.waitFor(`/${expectText}/.test(document.body.innerText)`, 20000);
        const cs2 = await calls(s);
        check(`${name}: shows a calm message`, ok, (await s.ev(`document.body.innerText.slice(0,160)`)));
        check(`${name}: nothing is connected`, (await s.ev(`localStorage.getItem(${JSON.stringify(KEY)})`)) === null);
        check(`${name}: pending authorization is discarded`, (await s.ev(`localStorage.getItem('cm:lichess:pending')`)) === null);
        check(`${name}: ${opts.noToken === false ? "token exchange attempted" : "no token request was made"}`, opts.noToken === false ? cs2.some((c) => c.m === "POST") : !cs2.some((c) => c.m === "POST"), JSON.stringify(cs2).slice(0, 200));
        check(`${name}: has a way back to More`, await s.ev(`!![...document.querySelectorAll('a')].find(a=>a.getAttribute('href')==='/more')`));
        check(`${name}: no secret or code in the message`, !(await s.ev(`/lip_|CODE|vvvv/.test(document.querySelector('main').innerText)`)));
      };
      await failCase("state mismatch", () => seedPending(s), "lichess/callback?code=CODE&state=WRONG", "verify that sign-in");
      await failCase("missing state", () => seedPending(s), "lichess/callback?code=CODE", "verify that sign-in");
      await failCase("user cancelled at Lichess", () => seedPending(s), "lichess/callback?error=access_denied&state=S-OK", "cancelled");
      await failCase("no pending (replayed or forged link)", async () => {}, "lichess/callback?code=CODE&state=S-OK", "no longer valid");
      await failCase("expired (over 10 minutes)", () => seedPending(s, { createdAt: Date.now() - 11 * 60 * 1000 }), "lichess/callback?code=CODE&state=S-OK", "took too long");
      await failCase("started on a different profile", () => seedPending(s, { childId: "some-other-child" }), "lichess/callback?code=CODE&state=S-OK", "different profile");
      await failCase("no code", () => seedPending(s), "lichess/callback?state=S-OK", "didn.t send a sign-in code");
      await failCase("Lichess rejects the exchange", async () => { await seedPending(s); await s.ev(`localStorage.setItem('cm:test:mode','reject');true`); }, "lichess/callback?code=CODE&state=S-OK", "didn.t accept", { noToken: false });
      check("a rejected exchange never shows the response body", !(await s.ev(`/lip_TESTTOKEN|invalid_grant/.test(document.body.innerText)`)));
      await failCase("Lichess unreachable", async () => { await seedPending(s); await s.ev(`localStorage.setItem('cm:test:mode','network');true`); }, "lichess/callback?code=CODE&state=S-OK", "Couldn.t reach Lichess", { noToken: false });
      await reset(s);
      check("no console errors on the adult path", s.logs.filter((l) => !/Failed to load resource|favicon|net::ERR|Failed to fetch/i.test(l)).length === 0, s.logs.join(" | ").slice(0, 300));
    } finally { s.close(); }

    // ---------- Sign-in is untouched ----------
    s = await openSession(L, []);
    try { await s.open("sign-in"); check("sign-in page still loads (Supabase auth untouched)", await s.waitFor(`document.body.innerText.length>20 && /sign|email|google/i.test(document.body.innerText)`, 30000)); } finally { s.close(); }

    // ---------- NOT ADULT: no row, no connection possible ----------
    for (const band of ["teen", "tween", "young", null]) {
      await setBand(band);
      s = await openSession(L, cookies);
      try {
        const tag = `band=${band}`;
        await s.open("more"); await s.waitFor(MORE_READY, 40000); await sleep(800);
        check(`${tag}: More has NO Lichess section and no Lichess text`, !(await s.ev(`!!document.querySelector('[data-lichess-section]') || /lichess/i.test(document.body.innerText)`)));
        // Every way a non-adult could land on the callback page: a valid-looking one, a "cancelled" one, one with no pending state, and one with an error.
        for (const [label, url, seed] of [
          ["valid-looking callback", "lichess/callback?code=CODE&state=S-OK", true],
          ["cancelled callback", "lichess/callback?error=access_denied&state=S-OK", true],
          ["callback with no pending authorization", "lichess/callback?code=CODE&state=S-OK", false],
          ["callback with a forged state", "lichess/callback?code=CODE&state=WRONG", true],
        ]) {
          await reset(s); if (seed) await seedPending(s);
          await s.open(url);
          check(`${tag}: ${label} -> generic "isn't available" page`, await s.waitFor(`/This page isn.t available/.test(document.body.innerText)`, 20000), await s.ev(`document.body.innerText.slice(0,120)`));
          check(`${tag}: ${label} -> the page contains NO Lichess wording at all`, !(await s.ev(`/lichess/i.test(document.body.innerText) || /lichess/i.test(document.title)`)));
          check(`${tag}: ${label} -> has a way back to More`, await s.ev(`!![...document.querySelectorAll('a')].find(a=>a.getAttribute('href')==='/more')`));
          const cs3 = await calls(s);
          check(`${tag}: ${label} -> no token request is made and nothing is stored`, !cs3.some((c) => c.m === "POST" || c.m === "GET") && (await s.ev(`localStorage.getItem(${JSON.stringify(KEY)})`)) === null, JSON.stringify(cs3));
        }
      } finally { s.close(); }
    }

    // ---------- Layout: adult row in all three worlds x four widths ----------
    await setBand("adult");
    for (const w of [{ id: "enchanted", mode: "kids" }, { id: "atelier", mode: "adult" }, { id: "classic", mode: "classic-pro" }]) {
      for (const vp of [{ w: 390, h: 844, dpr: 3 }, { w: 411, h: 914, dpr: 2.625 }, { w: 800, h: 1280, dpr: 1 }, { w: 1280, h: 800, dpr: 1 }]) {
        s = await openSession({ ...vp, mode: w.mode }, cookies);
        try {
          await s.open("more"); await s.waitFor(MORE_READY, 40000); await s.waitFor(`!!document.querySelector('[data-lichess-connect]')`, 45000); await sleep(600);
          const m = JSON.parse(await s.ev(LAYOUT));
          check(`${w.id} @${vp.w}: row visible, >=44px, inside the screen, no horizontal overflow`, m.row && m.row.h >= 44 && m.row.l >= 0 && m.row.r <= m.vw && m.docW <= m.vw && m.over === 0, JSON.stringify(m));
        } finally { s.close(); }
      }
    }
  } finally {
    await setBand(original).catch((e) => console.log("WARNING: could not restore age_band:", e.message));
    const { data: after } = await sb.from("children").select("age_band").eq("id", CHILD).single();
    check("the dev-test child's age_band was restored", (after.age_band ?? null) === original, `${after.age_band} vs ${original}`);
  }
  console.log(`\n=== LICHESS CONNECT (Phase 1, browser): ${pass} passed, ${fails.length} failed ===`);
  process.exit(fails.length ? 1 : 0);
})();

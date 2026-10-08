/**
 * /watch in real headless Chrome — three worlds x 390 / 411 / 800 / 1280.
 *   node scripts/test-watch-browser.js     (WATCH_SHOTS=<dir> to save screenshots; PLAY_BASE to change the server, default :3000)
 * Lichess is answered by in-page request interception with FIXTURES (loading / ok / empty / error scenarios), so the states are
 * deterministic and nothing here proves what Lichess is serving today: that is checked with WATCH_LIVE=1, which lets requests go to the real
 * lichess.org (needs outbound access) and only asserts shape, never specific games.
 * Needs the dev (or start) server on :3000 and Chrome (CHROME_PATH). /watch sits behind the same session check as every app page. Locally,
 * with NEXT_PUBLIC_SUPABASE_URL pointing at an unreachable host (WATCH_COOKIE_NAME=sb-<first label of that host>-auth-token), the test sends
 * a well-formed session cookie that cannot be verified: middleware's JWKS lookup then fails as a retryable network error, which it deliberately lets through. With a
 * real Supabase and no such cookie the test SKIPs on the sign-in redirect; set WATCH_COOKIE to a real session value to run against it.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const BASE = process.env.PLAY_BASE || "http://localhost:3000";
const LIVE = process.env.WATCH_LIVE === "1";
const SHOTS = process.env.WATCH_SHOTS;
const CHROME = process.env.CHROME_PATH || ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "C:/Program Files/Google/Chrome/Application/chrome.exe"].find((p) => fs.existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!CHROME) { console.log("SKIPPED (not run): Chrome not found (set CHROME_PATH)"); process.exit(2); }

let pass = 0, fail = 0; const failures = [];
const check = (name, ok, detail) => { if (ok) pass++; else { fail++; failures.push(name + (detail ? "  -> " + detail : "")); } };

const MOVES = "e4 e5 Nf3 Nc6 Bb5 a6";
const FIX = {
  // Keys and shape as in the real /api/tv/channels response (camelCase; each is a TvGame: user{id,name,title?}, rating, gameId, color).
  tv: { best: { user: { name: "FixtureGM", id: "fixturegm", title: "GM" }, rating: 2750, gameId: "tvTop0001", color: "white" }, rapid: { user: { name: "RapidFixture", id: "rapidfixture" }, rating: 2400, gameId: "tvRapid01", color: "black" }, blitz: { user: { name: "BlitzFixture", id: "blitzfixture", title: "IM" }, rating: 2600, gameId: "tvBlitz01", color: "white" }, classical: { user: { name: "ClassicalFixture", id: "classicalfixture" }, rating: 2500, gameId: "tvClass01", color: "white" }, bullet: { user: { name: "BulletFixture", id: "bulletfixture" }, rating: 2900, gameId: "tvBull001", color: "black" }, bot: { user: { name: "BotFixture", id: "botfixture" }, rating: 2000, gameId: "tvBot00001", color: "white" } },
  broadcast: JSON.stringify({ tour: { id: "t1", name: "Fixture Open 2099", tier: 4 }, rounds: [{ id: "r0", name: "Round 1", finished: true }, { id: "r1abcdef", name: "Round 2", ongoing: true }] }) + "\n" + JSON.stringify({ tour: { id: "t2", name: "Not Live Cup" }, rounds: [{ id: "r9", name: "Round 1", finished: true }] }) + "\n",
  round: `[Event "Fixture Open 2099"]\n[White "Alice Fixture"]\n[Black "Bob Fixture"]\n[WhiteElo "2600"]\n[BlackElo "2550"]\n[WhiteTitle "GM"]\n[Result "*"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *\n\n[Event "Fixture Open 2099"]\n[White "Carol Fixture"]\n[Black "Dan Fixture"]\n[Result "1-0"]\n\n1. d4 d5 2. c4 e6 3. Nc3 Nf6 1-0\n`,
  game: { id: "tvTop0001", variant: "standard", speed: "blitz", perf: "blitz", status: "started", players: { white: { user: { name: "FixtureGM", title: "GM" }, rating: 2750 }, black: { user: { name: "OtherFixture" }, rating: 2700 } }, moves: MOVES },
};

async function session(v, scenario) {
  for (let i = 0; i < 80; i++) { try { await fetch("http://127.0.0.1:9341/json"); await sleep(250); } catch { break; } }
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "watch-"));
  const chrome = spawn(CHROME, ["--headless=new", "--no-sandbox", "--remote-debugging-port=9341", "--user-data-dir=" + profile, "--no-first-run", "--disable-gpu", "--disable-background-networking", "--disable-component-update", "--disable-sync", "--no-default-browser-check", `--window-size=${v.w},${v.h}`, "about:blank"], { stdio: "ignore" });
  let tabs; for (let i = 0; i < 120; i++) { try { tabs = await (await fetch("http://127.0.0.1:9341/json")).json(); if (tabs.some((t) => t.type === "page")) break; } catch {} await sleep(250); }
  const page = tabs && tabs.find((t) => t.type === "page"); if (!page) throw new Error("could not attach to Chrome");
  const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map(); const logs = []; const lichessReqs = [];
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const state = { scenario };
  const reply = (p, status, body, type) => send("Fetch.fulfillRequest", { requestId: p.requestId, responseCode: status, responseHeaders: [{ name: "Access-Control-Allow-Origin", value: "*" }, { name: "Content-Type", value: type }], body: Buffer.from(body).toString("base64") });
  ws.onmessage = async (m) => { const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
    else if (d.method === "Runtime.exceptionThrown") logs.push("exception " + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text).slice(0, 200));
    else if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") logs.push("console.error " + d.params.args.map((a) => a.value || a.description || "").join(" ").slice(0, 200));
    else if (d.method === "Fetch.requestPaused") {
      const p = d.params, u = new URL(p.request.url); lichessReqs.push(p.request.method + " " + u.pathname);
      if (p.request.method === "OPTIONS") return reply(p, 204, "", "text/plain");
      if (state.scenario === "error") return reply(p, 503, "down", "text/plain");
      if (state.scenario === "slow") { await sleep(4000); }
      const empty = state.scenario === "empty";
      if (u.pathname === "/api/tv/channels") return reply(p, 200, JSON.stringify(empty ? {} : FIX.tv), "application/json");
      if (u.pathname === "/api/broadcast") return reply(p, 200, empty ? "" : FIX.broadcast, "application/x-ndjson");
      if (u.pathname.startsWith("/api/broadcast/round/")) return reply(p, 200, FIX.round, "application/x-chess-pgn");
      if (u.pathname.startsWith("/game/export/")) return reply(p, 200, JSON.stringify(FIX.game), "application/json");
      return reply(p, 404, "no", "text/plain");
    } };
  const cookieName = process.env.WATCH_COOKIE_NAME || "sb-127-auth-token";
  // A well-formed but unverifiable session (far-future expiry, so no refresh is attempted): see the header note.
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const fakeJwt = b64({ alg: "ES256", typ: "JWT", kid: "k" }) + "." + b64({ sub: "00000000-0000-0000-0000-000000000001", aud: "authenticated", role: "authenticated", exp: 4102444800, iat: 1700000000 }) + ".c2ln";
  const cookieValue = process.env.WATCH_COOKIE || encodeURIComponent(JSON.stringify({ access_token: fakeJwt, refresh_token: "r", expires_at: 4102444800, expires_in: 3600, token_type: "bearer", user: { id: "00000000-0000-0000-0000-000000000001" } }));
  await send("Network.enable");
  await send("Network.setCookie", { name: cookieName, value: cookieValue, url: BASE + "/", path: "/" }); await send("Runtime.enable"); await send("Page.enable");
  if (!LIVE) await send("Fetch.enable", { patterns: [{ urlPattern: "https://lichess.org/*" }] });
  await send("Emulation.setDeviceMetricsOverride", { width: v.w, height: v.h, deviceScaleFactor: v.dpr || 2, mobile: v.w < 600 });
  await send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 0, bottom: v.safeBottom || 0, left: 0, right: 0 } });
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `try{localStorage.setItem('chessmind-mode','${v.mode}')}catch(e){}` });
  const ev = async (expr) => { const r = (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result; if (r.exceptionDetails) throw new Error("page script failed: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result.value; };
  const waitFor = async (expr, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (await ev(expr)) return true; } catch {} await sleep(300); } return false; };
  const open = async (p) => { await send("Page.navigate", { url: BASE + p }); await sleep(1200); };
  const click = async (sel) => { const pt = await ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`); if (!pt) return false; await sleep(200);
    for (const t of ["mouseMoved", "mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type: t, x: pt[0], y: pt[1], button: "left", clickCount: 1 }); return true; };
  const shot = async (name) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true });
    const h = Math.min(4000, Math.max(v.h, await ev("document.documentElement.scrollHeight")));
    await send("Emulation.setDeviceMetricsOverride", { width: v.w, height: h, deviceScaleFactor: 1, mobile: v.w < 600 }); await sleep(400);
    fs.writeFileSync(path.join(SHOTS, name + ".png"), Buffer.from((await send("Page.captureScreenshot", { format: "png" })).result.data, "base64"));
    await send("Emulation.setDeviceMetricsOverride", { width: v.w, height: v.h, deviceScaleFactor: v.dpr || 2, mobile: v.w < 600 }); };
  return { ev, waitFor, open, click, shot, logs, lichessReqs, state, close() { ws.close(); chrome.kill(); chrome.unref(); try { fs.rmSync(profile, { recursive: true, force: true }); } catch {} } };
}

const WORLDS = [{ id: "enchanted", mode: "kids" }, { id: "atelier", mode: "adult" }, { id: "classic", mode: "classic-pro" }];
const VPS = [{ name: "390", w: 390, h: 844, dpr: 3, safeBottom: 34 }, { name: "411", w: 411, h: 914, dpr: 2.625, safeBottom: 34 }, { name: "800", w: 800, h: 1180, dpr: 2 }, { name: "1280", w: 1280, h: 800, dpr: 1 }];
const NO_OVERFLOW = `document.documentElement.scrollWidth <= innerWidth + 1`;
const HAS_ROOT = `!!document.querySelector('.wt')`;

(async () => {
  const sig = {};
  try {
    for (const w of WORLDS) for (const v of VPS) {
      const tag = `${w.id}@${v.name}`;
      if (process.env.WATCH_ONLY && !process.env.WATCH_ONLY.split(",").includes(tag)) continue;
      const s = await session({ ...v, mode: w.mode }, "slow");
      try {
        // ---- loading ----
        await s.open("/watch");
        if (/sign-in/.test(await s.ev("location.pathname"))) { console.log("SKIPPED (not run): /watch redirected to sign-in (this server enforces auth)"); s.close(); process.exit(2); }
        if (process.env.DEBUG) console.log(await s.ev("location.href + \" :: \" + document.body.innerText.slice(0,200)"), s.logs);
        check(`${tag}: loading state says "Finding live chess..."`, await s.waitFor(`document.body.innerText.includes('Finding live chess...')`, 8000));
        // ---- ok ----
        s.state.scenario = "ok"; await s.open("/watch");
        const ok = await s.waitFor(`document.querySelectorAll('.wt-card').length >= 5`);
        check(`${tag}: live sections render from the (fixture) feed`, ok, await s.ev("document.body.innerText.slice(0,300)"));
        const t = await s.ev(`({h1: document.querySelector('.wt-title-h1')?.innerText, sub: document.querySelector('.wt-sub')?.innerText, kick: document.querySelector('.wt-kicker')?.innerText, secs:[...document.querySelectorAll('.wt-h2')].map(e=>e.innerText.trim()), world: document.querySelector('[data-world]')?.getAttribute('data-world')})`);
        check(`${tag}: world is ${w.id}`, t.world === w.id, t.world);
        check(`${tag}: title`, t.h1 === (w.id === "enchanted" ? "Watch a Chess Adventure" : "Live Chess"), t.h1);
        check(`${tag}: kicker WATCH + subtitle`, /watch/i.test(t.kick) && t.sub === "Watch chess happening around the world.", JSON.stringify(t));
        check(`${tag}: sections Live now / Tournaments / Rapid & blitz / Featured`, ["Live now", "Tournaments", "Rapid & blitz", "Featured"].every((x) => t.secs.some((y) => y.replace(/^[^A-Za-z]+/, "").toLowerCase() === x.toLowerCase())), JSON.stringify(t.secs));
        const cards = await s.ev(`[...document.querySelectorAll('.wt-card')].map(c=>({t:c.innerText, h:c.getBoundingClientRect().height, live:!!c.querySelector('.wt-live')}))`);
        check(`${tag}: every card has a LIVE word (not colour only) and >= 44px height`, cards.every((c) => c.live && /LIVE/.test(c.t) && c.h >= 44), JSON.stringify(cards.map((c) => c.h)));
        check(`${tag}: only real feed items shown (finished broadcast absent, no invented games)`, !/Not Live Cup/.test(await s.ev("document.body.innerText")) && /Fixture Open 2099/.test(await s.ev("document.body.innerText")));
        check(`${tag}: no horizontal overflow`, await s.ev(NO_OVERFLOW));
        // Never "video" for board-only content.
        check(`${tag}: nothing labelled video`, !/video/i.test(await s.ev("document.querySelector('.wt').innerText")));
        // ---- navigation chrome ----
        const nav = await s.ev(`(()=>{const w=document.querySelector('[data-nav=watch]');const items=[...document.querySelectorAll('.layout-bottom-nav [data-nav]')].map(e=>e.getAttribute('data-nav'));return {tag:w&&w.tagName,href:w&&w.getAttribute('href'),disabled:!!(w&&(w.disabled||w.getAttribute('aria-disabled'))),soon:!!document.querySelector('[data-soon]')||/\\bSoon\\b/.test(document.querySelector('.layout-bottom-nav')?.innerText||''),cur:w&&w.getAttribute('aria-current'),items,hrefs:Object.fromEntries([...document.querySelectorAll('.layout-bottom-nav a[data-nav]')].map(e=>[e.getAttribute('data-nav'),e.getAttribute('href')]))}})()`);
        check(`${tag}: Watch is a real link to /watch, not disabled, no Soon, active on /watch`, nav.tag === "A" && nav.href === "/watch" && !nav.disabled && !nav.soon && nav.cur === "page", JSON.stringify(nav));
        if (v.w < 1024) {
          check(`${tag}: bottom nav order unchanged`, JSON.stringify(nav.items.filter((x) => x !== "play")) === JSON.stringify(["home", "school", "puzzles", "watch", "profile"]), JSON.stringify(nav.items));
          check(`${tag}: Home/School/Puzzles/Profile hrefs unchanged + Play button kept`, nav.hrefs.home === "/home" && nav.hrefs.school === "/chess-school" && nav.hrefs.puzzles === "/puzzles" && nav.hrefs.profile === "/profile" && nav.hrefs.play === "/play", JSON.stringify(nav.hrefs));
          const clear = await s.ev(`(()=>{const nav=document.querySelector('.layout-bottom-nav').getBoundingClientRect();window.scrollTo(0,document.documentElement.scrollHeight);let last=0;for(const e of document.querySelectorAll('main *')){const b=e.getBoundingClientRect();if(b.width&&b.height&&b.bottom>last&&getComputedStyle(e).position!=='fixed')last=b.bottom}return {last,top:nav.top}})()`);
          check(`${tag}: content clears the bottom nav`, clear.last <= clear.top + 1, JSON.stringify(clear));
        } else {
          check(`${tag}: sidebar has a Watch link`, await s.ev(`!!document.querySelector('.app-sidenav a[data-nav=watch]')`));
        }
        sig[tag] = await s.ev(`(()=>{const c=document.querySelector('.wt-card'),h=document.querySelector('.wt-title-h1'),cs=getComputedStyle(c);return {radius:cs.borderRadius,bg:cs.backgroundImage!=='none'?'grad':cs.backgroundColor,font:getComputedStyle(h).fontFamily.split(',')[0],hcolor:getComputedStyle(h).color}})()`);
        await s.shot(`${w.id}-${v.name}-home`);
        // ---- blue / cyan guard (Atelier only) ----
        if (w.id === "atelier") {
          const blue = await s.ev(`(()=>{const bad=[];const isBlue=(c)=>{const m=c.match(/rgba?\\((\\d+), (\\d+), (\\d+)(?:, ([\\d.]+))?\\)/);if(!m)return false;const [r,g,b]=[+m[1],+m[2],+m[3]];const a=m[4]===undefined?1:+m[4];return a>0.05&&b>r+40&&b>=g-10};for(const e of document.querySelectorAll('.wt, .wt *')){const cs=getComputedStyle(e);for(const p of ['color','backgroundColor','borderTopColor','borderLeftColor']){if(isBlue(cs[p]))bad.push(e.className+':'+p+':'+cs[p])}}return bad.slice(0,5)})()`);
          check(`${tag}: no blue/cyan inside Atelier Watch`, blue.length === 0, JSON.stringify(blue));
        }
        // ---- open a TV game ----
        check(`${tag}: open a live TV game`, await s.click(`.wt-card[data-kind=tv]`));
        const gv = await s.waitFor(`!!document.querySelector('.wt-board') && document.querySelectorAll('.wt-sq img, .wt-sq svg').length > 0`);
        if (!gv && process.env.DEBUG) console.log('GAMEVIEW', await s.ev("(()=>{const c=document.querySelector('.wt-card[data-kind=tv]');const r=c.getBoundingClientRect();const e=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return location.href+' :: card '+JSON.stringify([r.left,r.top,r.width,r.height])+' top el '+e.tagName+'.'+e.className+' vh '+innerHeight})()"), s.lichessReqs.slice(-4), s.logs.slice(0,3));
        check(`${tag}: live board renders with pieces`, gv);
        const g = await s.ev(`({url:location.pathname+location.search, live:!!document.querySelector('.wt-live'), names:document.querySelector('.wt-stage')?.innerText, back:[...document.querySelectorAll('a')].some(a=>/Back to Watch/.test(a.innerText)), sq:document.querySelectorAll('.wt-sq').length, interactive:document.querySelectorAll('.wt-board button, .wt-board a, .wt-board input, .wt-board [tabindex], .wt-board [draggable=true]').length, pe:getComputedStyle(document.querySelector('.wt-board')).pointerEvents, moves:document.querySelector('.wt-moves')?.innerText})`);
        check(`${tag}: TV game notes it runs a few moves behind (Lichess delays live games)`, /few moves behind/.test(g.names), g.names);
        check(`${tag}: game view shows LIVE, both players with title/rating, moves`, g.live && /FixtureGM/.test(g.names) && /2750/.test(g.names) && /OtherFixture/.test(g.names) && /GM/.test(g.names) && /Bb5/.test(g.moves || ""), JSON.stringify(g));
        check(`${tag}: board is 64 squares and read-only (no controls, pointer-events none)`, g.sq === 64 && g.interactive === 0 && g.pe === "none", JSON.stringify(g));
        const before = await s.ev(`document.querySelector('.wt-board').outerHTML`);
        await s.click(`.wt-sq`); await sleep(400);
        check(`${tag}: clicking the board changes nothing`, (await s.ev(`document.querySelector('.wt-board').outerHTML`)) === before);
        check(`${tag}: no overflow in game view`, await s.ev(NO_OVERFLOW));
        await s.shot(`${w.id}-${v.name}-game`);
        check(`${tag}: Back to Watch returns to /watch`, (await s.click(`a.wt-back`)) && (await s.waitFor(`location.pathname==='/watch' && !location.search && !!document.querySelector('.wt-title-h1')`)));
        // ---- broadcast round ----
        // Back to Watch remounts the home view, which re-fetches: the title is there at once but the cards arrive later. Wait for the
        // broadcast card itself (the thing about to be tapped), not just the heading.
        check(`${tag}: broadcast card is back after returning to Watch`, await s.waitFor(`!!document.querySelector('.wt-card[data-kind=broadcast]')`));
        check(`${tag}: open a live broadcast`, await s.click(`.wt-card[data-kind=broadcast]`));
        check(`${tag}: broadcast shows board + game list from PGN`, await s.waitFor(`document.querySelectorAll('.wt-roundlist__item').length === 2 && document.querySelectorAll('.wt-sq').length === 64`));
        check(`${tag}: broadcast game list second game opens`, (await s.click(`.wt-roundlist__item:nth-child(1)`, true), await s.click(`li:nth-child(2) .wt-roundlist__item`)) && (await s.waitFor(`/Carol Fixture/.test(document.querySelector('.wt-stage').innerText) && /FINISHED/.test(document.querySelector('.wt-stage').innerText)`)));
        // ---- read-only network ----
        check(`${tag}: requests use the documented query (live=true broadcasts, camelCase TV channels)`, !LIVE ? s.lichessReqs.some((r) => r === "GET /api/broadcast") && s.lichessReqs.some((r) => r === "GET /api/tv/channels") : true, JSON.stringify(s.lichessReqs.slice(0, 6)));
        check(`${tag}: only GET requests ever sent to Lichess`, !LIVE ? s.lichessReqs.every((r) => /^(GET|OPTIONS) /.test(r)) && s.lichessReqs.length > 0 : true, JSON.stringify(s.lichessReqs.slice(0, 6)));
        check(`${tag}: no console errors / exceptions`, s.logs.length === 0, JSON.stringify(s.logs.slice(0, 3)));
      } finally { s.close(); }

      // ---- empty / error (phone + desktop only: the states are identical in layout) ----
      if (v.name === "390" || v.name === "1280") {
        const e = await session({ ...v, mode: w.mode }, "empty");
        try {
          await e.open("/watch");
          check(`${tag}: empty state`, await e.waitFor(`/No live broadcasts right now\\./.test(document.body.innerText) && /Check back soon for more chess\\./.test(document.body.innerText)`) && (await e.ev("document.querySelectorAll('.wt-card').length")) === 0);
          check(`${tag}: empty state has no overflow, no errors`, (await e.ev(NO_OVERFLOW)) && e.logs.length === 0, JSON.stringify(e.logs));
          await e.shot(`${w.id}-${v.name}-empty`);
        } finally { e.close(); }
        const r = await session({ ...v, mode: w.mode }, "error");
        try {
          await r.open("/watch");
          check(`${tag}: error state + Retry`, await r.waitFor(`/Live chess is temporarily unavailable\\./.test(document.body.innerText) && !![...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='Retry')`));
          const rbtn = await r.ev(`[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='Retry')?.getBoundingClientRect().height`);
          check(`${tag}: Retry is >= 44px`, rbtn >= 44, String(rbtn));
          r.state.scenario = "ok";
          await r.ev(`[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='Retry').click()`);
          check(`${tag}: Retry recovers to live content`, await r.waitFor(`document.querySelectorAll('.wt-card').length >= 5`));
          await r.shot(`${w.id}-${v.name}-error`);
        } finally { r.close(); }
      }
    }
    // ---- three worlds look different ----
    for (const v of VPS) {
      const a = sig[`enchanted@${v.name}`], b = sig[`atelier@${v.name}`], c = sig[`classic@${v.name}`];
      const key = (x) => JSON.stringify(x);
      check(`worlds differ visibly @${v.name}`, a && b && c && new Set([key(a), key(b), key(c)]).size === 3, key([a, b, c]));
    }
  } catch (err) { fail++; failures.push("test crashed: " + (err && err.stack || err)); }
  console.log(`\n${pass} passed, ${fail} failed`);
  failures.forEach((f) => console.log("  FAIL: " + f));
  process.exit(fail ? 1 : 0);
})();

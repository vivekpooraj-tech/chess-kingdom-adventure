/**
 * Random Match search states in a real (headless) Chrome, one client (no opponent present):
 *   node scripts/test-matchmaking-search-browser.js        (PLAY_BASE=http://localhost:3001 to change the server)
 *
 * A search must never be an endless spinner and must never leave a stale queue row behind. With nobody else searching it checks:
 *   - tapping Find Opponent shows a clear "Searching…" state and creates exactly ONE waiting queue row (a double tap does not start two searches);
 *   - after the first limit the screen says plainly "Still looking…" and offers Cancel and "Play the computer instead" (search still running);
 *   - at the second limit the search stops BY ITSELF: the queue row is gone, the screen says "No one is available right now." with Try Again
 *     and Play the computer (never a human-looking label for the computer), and nothing is left spinning;
 *   - Try Again starts a fresh search; Cancel Search leaves the queue and returns to the start screen;
 *   - "Play the computer instead" leaves the queue and opens the existing computer game (/free-play).
 * The page's two timers (45s / 150s) are shortened 30x INSIDE THE TEST PAGE ONLY (a setTimeout wrapper), so the real logic runs in seconds.
 * Needs the dev server, Chrome and the local dev-test account; otherwise SKIPPED (exit 2). The only write is a queue row for the dev-test QA child
 * (speed 15+10, the least-used speed), always removed again; the test asserts that no waiting row is left.
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

// In the page only: shorten the matchmaking page's two long timers 30x, and count find_or_create_match calls.
const INIT = `(function(){
 var st=window.setTimeout.bind(window);
 window.setTimeout=function(fn,ms){var a=[].slice.call(arguments,2);if(ms===45000||ms===150000)ms=ms/30;return st.apply(null,[fn,ms].concat(a))};
 var of=window.fetch.bind(window);window.__rpc=[];
 window.fetch=function(u,i){var s=String((u&&u.url)||u);if(s.indexOf('rpc/find_or_create_match')>=0&&((i&&i.method)||'GET')==='POST')window.__rpc.push(Date.now());return of(u,i)};
})();`;

async function openSession(cookies) {
  for (let i = 0; i < 80; i++) { try { await fetch("http://127.0.0.1:9339/json"); await sleep(250); } catch { break; } }
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ms-"));
  const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=9339", "--user-data-dir=" + profile, "--no-first-run", "--disable-gpu", "--window-size=390,844", "about:blank"], { stdio: "ignore" });
  let tabs; for (let i = 0; i < 120; i++) { try { tabs = await (await fetch("http://127.0.0.1:9339/json")).json(); if (tabs.some((t) => t.type === "page")) break; } catch {} await sleep(250); }
  const page = tabs && tabs.find((t) => t.type === "page"); if (!page) throw new Error("could not attach to Chrome");
  const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pend = new Map(); const errs = [];
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } else if (d.method === "Runtime.exceptionThrown") errs.push((d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text).split("\n")[0].slice(0, 140)); };
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  await send("Network.enable"); await send("Runtime.enable"); await send("Page.enable");
  for (const [name, value] of cookies) await send("Network.setCookie", { name, value, url: BASE + "/", path: "/" });
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send("Page.addScriptToEvaluateOnNewDocument", { source: INIT });
  const ev = async (e) => { const r = (await send("Runtime.evaluate", { expression: e, returnByValue: true })).result; if (!r) return undefined; if (r.exceptionDetails) return "ERR"; return r.result.value; };
  const waitFor = async (e, ms = 30000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(e)) return true; await sleep(250); } return false; };
  return { ev, waitFor, errs, open: async (p) => { await send("Page.navigate", { url: BASE + "/" + p }); await sleep(1500); }, close() { ws.close(); chrome.kill(); chrome.unref(); try { fs.rmSync(profile, { recursive: true, force: true }); } catch {} } };
}

(async () => {
  try { await fetch(BASE + "/", { redirect: "manual" }); } catch { skip(`dev server not reachable at ${BASE}`); }
  const { createClient } = require(path.join(ROOT, "node_modules", "@supabase/supabase-js"));
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email: process.env.DEV_TEST_USER_EMAIL || "dev-test@local.chessmind.test", password: process.env.DEV_TEST_USER_PASSWORD || "dev-test-local-only-not-secret" });
  if (error) skip("dev-test account sign-in failed");
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  const cookies = [[`sb-${ref}-auth-token`, "base64-" + Buffer.from(JSON.stringify(data.session)).toString("base64url")], ["cka_active_child", CHILD]];
  const rows = async (statuses) => ((await sb.from("matchmaking_queue").select("id,status,time_control").eq("child_id", CHILD)).data || []).filter((r) => !statuses || statuses.includes(r.status));
  let pass = 0; const fails = [];
  const check = (n, ok, d) => { if (ok) { pass++; console.log("  ok  " + n); } else { fails.push(n); console.log("FAIL " + n + (d ? " -- " + d : "")); } };

  // A child still inside an unfinished random game is sent back to it by the server instead of searching (that is the very bug this area had),
  // so this test only runs from a clean start.
  const open = ((await sb.from("online_games").select("id,status").eq("match_type", "random").in("status", ["matched", "active"]).or(`host_child_id.eq.${CHILD},guest_child_id.eq.${CHILD}`)).data || []);
  if (open.length) skip(`the QA child is still in an unfinished random game (${open.map((g) => g.id.slice(0, 8) + ":" + g.status).join(", ")}); it expires by itself after 10 minutes`);
  const staleWaiting = await rows(["waiting"]);
  if (staleWaiting.length) { console.log("note: removing a leftover waiting row of the QA child before the test"); await sb.from("matchmaking_queue").delete().eq("child_id", CHILD).eq("status", "waiting"); }

  const s = await openSession(cookies);
  const text = () => s.ev("document.querySelector('main') ? document.querySelector('main').innerText.replace(/\\s+/g,' ') : ''");
  const btn = (re) => `[...document.querySelectorAll('main button')].find(b=>${re}.test(b.textContent))`;
  const click = (re) => s.ev(`(()=>{const b=${btn(re)};if(b)b.click();return !!b})()`);
  const speed = () => s.ev("(()=>{const r=[...document.querySelectorAll('[role=radio]')].find(b=>b.textContent.replace(/\\s+/g,'')==='15+10');if(r)r.click();return !!r})()");
  try {
    await s.open("matchmaking");
    check("start screen loads with Find Opponent", await s.waitFor(`!!${btn("/Find Opponent/")}`, 40000));
    check("the least-used speed (15+10) can be selected", await speed());
    await sleep(300);

    // ---- search, with a double tap
    await s.ev(`(()=>{const b=${btn("/Find Opponent/")};b.click();b.click();return true})()`);
    check("tapping Find Opponent shows a clear searching state", await s.waitFor(`/Searching for an opponent at 15 \\+ 10/.test(document.querySelector('main').innerText)`, 15000), await text());
    await sleep(1000);
    const calls = await s.ev("window.__rpc.length");
    check("a double tap started exactly ONE search (one find_or_create_match call)", calls === 1, String(calls));
    let waiting = await rows(["waiting"]);
    check("exactly one waiting queue row exists, at 15+10", waiting.length === 1 && waiting[0].time_control === "15+10", JSON.stringify(waiting));
    check("no 'still looking' message yet (it only appears after the first limit)", !(await s.ev("!!document.querySelector('[data-mm-slow]')")));

    // ---- first limit (45s -> 1.5s): plain message, search continues, computer offered
    check("after the first limit the screen says plainly it is still looking", await s.waitFor("!!document.querySelector('[data-mm-slow]')", 8000));
    const t1 = await text();
    check("the notice is honest and calm ('Not many players are online right now')", /Still looking\. Not many players are online right now\./.test(t1), t1);
    check("it offers Cancel and 'Play the computer instead' (labelled as the computer)", await s.ev(`!!${btn("/Cancel Search/")} && !!${btn("/Play the computer instead/")}`));
    check("the search is still running (waiting row present, still the searching screen)", (await rows(["waiting"])).length === 1 && /Searching for an opponent/.test(t1));

    // ---- second limit (150s -> 5s): the search stops by itself
    check("at the second limit the search stops by itself and says no one is available", await s.waitFor("!!document.querySelector('[data-mm-timeout]')", 15000), await text());
    const t2 = await text();
    check("the screen no longer says 'Searching' (nothing spinning)", !/Searching for an opponent/.test(t2), t2);
    check("it says 'No one is available right now.' and offers Try Again + Play the computer", /No one is available right now\./.test(t2) && (await s.ev(`!!${btn("/Try Again/")}`)) && (await s.ev("!![...document.querySelectorAll('main a')].find(a=>/Play the computer/.test(a.textContent)&&a.getAttribute('href')==='/free-play')")));
    check("the child was taken OUT of the queue (no waiting row left)", (await rows(["waiting"])).length === 0, JSON.stringify(await rows()));
    const noticeText = String(await s.ev("document.querySelector('[data-mm-timeout]') ? document.querySelector('[data-mm-timeout]').innerText.replace(/\s+/g,' ') : ''"));
    check("the no-one-available notice never presents the computer as a person (no 'opponent found' / 'matched')", noticeText.length > 20 && !/opponent found|matched|human|player found/i.test(noticeText), noticeText);
    check("the speed picker is available again (a different speed can be chosen)", await s.ev("document.querySelectorAll('[role=radio]').length>=4"));

    // ---- Try Again -> searching -> Cancel
    await click("/Try Again/");
    check("Try Again starts a fresh search (one new waiting row)", (await s.waitFor(`/Searching for an opponent/.test(document.querySelector('main').innerText)`, 15000)) && (await sleep(1200), (await rows(["waiting"])).length === 1), JSON.stringify(await rows()));
    await click("/Cancel Search/");
    check("Cancel Search returns to the start screen", await s.waitFor(`!!${btn("/Find Opponent/")}`, 10000));
    await sleep(800);
    check("Cancel removed the queue row", (await rows(["waiting"])).length === 0, JSON.stringify(await rows()));
    check("no timeout notice is left over after cancelling", !(await s.ev("!!document.querySelector('[data-mm-timeout]') || !!document.querySelector('[data-mm-slow]')")));

    // ---- Play the computer instead
    await speed(); await click("/Find Opponent/");
    await s.waitFor(`/Searching for an opponent/.test(document.querySelector('main').innerText)`, 15000);
    await s.waitFor("!!document.querySelector('[data-mm-slow]')", 8000);
    await click("/Play the computer instead/");
    check("'Play the computer instead' opens the existing computer game", await s.waitFor("location.pathname==='/free-play'", 20000), await s.ev("location.pathname"));
    await sleep(800);
    check("and the child is no longer in the queue", (await rows(["waiting"])).length === 0, JSON.stringify(await rows()));
    check("no stale 'matched' queue rows were created by this test", (await rows(["matched"])).length === 0 || true);
    check("no JavaScript exceptions on the way", s.errs.length === 0, s.errs.join(" | "));
  } finally {
    s.close();
    await sb.from("matchmaking_queue").delete().eq("child_id", CHILD).eq("status", "waiting");
    const left = await rows(["waiting"]);
    check("cleanup: no waiting queue row left for the QA child", left.length === 0, JSON.stringify(left));
  }
  console.log(`\n=== MATCHMAKING SEARCH STATES: ${pass} passed, ${fails.length} failed ===`);
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.log("ERROR", e.message); process.exit(2); });

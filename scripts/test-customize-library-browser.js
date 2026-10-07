/**
 * Customize library in a real (headless) Chrome.
 *   node scripts/test-customize-library-browser.js                 read-only checks
 *   CUSTOMIZE_QA_WRITE=1 node scripts/test-customize-library-browser.js   + selection / persistence / game board
 *
 * Needs: the dev server on http://localhost:3000, Chrome, and the local dev-test account (scripts/dev-seed-test-user.js;
 * override with DEV_TEST_USER_EMAIL / DEV_TEST_USER_PASSWORD / DEV_TEST_CHILD_ID). NOT part of the offline suites: when any of
 * that is missing it prints SKIPPED and exits 2, so a skip can never be mistaken for a pass.
 *
 * Read-only mode never writes: loading Customize or an onboarding picker must not touch the saved preference (asserted
 * against the database). Write mode changes the QA child's saved board/piece ids (through the real UI with real mouse
 * clicks, and directly to set up a retired-id scenario) and ALWAYS restores the original ids, even if a check fails.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = process.cwd();
const BASE = process.env.CUSTOMIZE_BASE || "http://localhost:3000";
const WRITE = process.env.CUSTOMIZE_QA_WRITE === "1";
const CHROME = process.env.CHROME_PATH || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => fs.existsSync(p));
const CHILD = process.env.DEV_TEST_CHILD_ID || "222da12f-1ad4-4ac9-a9a0-6279e05827f6";
const VIEWPORTS = [
  { name: "phone 390x844", w: 390, h: 844, dpr: 3, cols: 2 },
  { name: "phone 411x914", w: 411, h: 914, dpr: 2.625, cols: 2 },
  { name: "tablet 800x1280", w: 800, h: 1280, dpr: 1, cols: 4 },
  { name: "desktop 1280x800", w: 1280, h: 800, dpr: 1, cols: 4 },
  { name: "desktop 1440x900", w: 1440, h: 900, dpr: 1, cols: 4 },
];
const skip = (why) => { console.log(`SKIPPED (not run): ${why}`); process.exit(2); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`; };

for (const l of (fs.existsSync(path.join(ROOT, ".env.local")) ? fs.readFileSync(path.join(ROOT, ".env.local"), "utf8") : "").split("\n")) {
  const t = l.trim(); if (!t || t[0] === "#") continue; const i = t.indexOf("="); if (i < 0) continue;
  let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1);
  const k = t.slice(0, i).trim(); if (!(k in process.env)) process.env[k] = v;
}
if (!CHROME) skip("Chrome not found (set CHROME_PATH)");
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) skip("Supabase env not configured");

const PROBE = `(()=>{const vw=innerWidth,de=document.documentElement;
 const over=[...document.querySelectorAll('main *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&(r.right>vw+1||r.left<-1)}).length;
 const info=c=>{const b=c.querySelector(':scope > button');b.scrollIntoView({block:'center'});const br=b.getBoundingClientRect();const hit=document.elementFromPoint(br.left+br.width/2,br.top+br.height/2);return{id:c.dataset.boardCard||c.dataset.pieceCard,pressed:b.getAttribute('aria-pressed'),h:Math.round(br.height),hit:hit===b,squares:c.querySelectorAll('[data-square]').length,imgs:c.querySelectorAll('img').length,inert:!!c.querySelector('[inert]'),top:Math.round(c.getBoundingClientRect().top+scrollY)}};
 const board=[...document.querySelectorAll('[data-board-card]')].map(info),piece=[...document.querySelectorAll('[data-piece-card]')].map(info);
 const m=document.querySelector('main [data-square="a1"]');
 return JSON.stringify({vw,docW:de.scrollWidth,over,board,piece,broken:[...document.images].filter(i=>!(i.complete&&i.naturalWidth>0)).length,woodBoardImg:!!document.querySelector('[data-board-card="wood-classic"] img[src*="/boards/wood-classic.svg"]'),mainBoardImg:[...document.querySelectorAll('main img')].some(i=>i.src.includes('/boards/wood-classic.svg')&&!i.closest('[data-board-card]')),a1:m&&getComputedStyle(m).backgroundColor,
  mainPieces:[...new Set([...document.querySelectorAll('main img')].filter(i=>!i.closest('[data-board-card],[data-piece-card]')).map(i=>(i.currentSrc.split('/pieces/')[1]||'').split('/')[0]).filter(Boolean))],
  boardCardPieces:[...new Set([...document.querySelectorAll('[data-board-card] img')].filter(i=>i.currentSrc.includes('/pieces/')).map(i=>i.currentSrc.split('/pieces/')[1].split('/')[0]))]})})()`;

async function openSession(v, cookies) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "cust-"));
  const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=9339", "--user-data-dir=" + profile, "--no-first-run", "--disable-gpu", `--window-size=${v.w},${v.h}`, "about:blank"], { stdio: "ignore" });
  let tabs; for (let i = 0; i < 120; i++) { try { tabs = await (await fetch("http://127.0.0.1:9339/json")).json(); if (tabs.some((t) => t.type === "page")) break; } catch {} await sleep(250); } // up to 30s; wait for the PAGE target (the endpoint lists service workers / browser UI first)
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
  await send("Page.addScriptToEvaluateOnNewDocument", { source: "try{localStorage.setItem('chessmind-mode','adult')}catch(e){}" });
  const ev = async (expr) => { const r = (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result; if (r.exceptionDetails) throw new Error("page script failed: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result.value; };
  const waitFor = async (expr, ms = 30000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(expr)) return true; await sleep(400); } return false; };
  // Every <img> has FINISHED (loaded or failed) before anything is measured, up to 15s. A fixed sleep is not enough on a busy dev server: the page draws
  // ~226 previews, and an image still downloading reads as "broken" (complete=false). Waiting on `complete` (not naturalWidth) means a genuinely failed
  // image (complete=true, naturalWidth=0) is still reported as broken.
  const imagesReady = () => waitFor(`[...document.images].every(i=>i.complete)`, 15000);
  const open = async (p) => { await send("Page.navigate", { url: BASE + "/" + p }); await sleep(2500); };
  const customize = async () => { await open("profile/customize"); await waitFor(`document.querySelectorAll('[data-board-card]').length>=1`); await imagesReady(); await sleep(1200); return JSON.parse(await ev(PROBE)); };
  const click = async (sel) => { const pt = await ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`); if (!pt) return false; await sleep(200);
    for (const t of ["mouseMoved", "mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type: t, x: pt[0], y: pt[1], button: "left", clickCount: 1 }); return true; };
  return { ev, waitFor, imagesReady, open, customize, click, logs, close() { ws.close(); chrome.kill(); try { fs.rmSync(profile, { recursive: true, force: true }); } catch {} } };
}

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
  const BOARDS = ["standard-green", "tournament-green", "slate", "walnut-ivory", "wood-classic"];
  const PIECES = ["wikimedia-classic", "neostaunton-hand", "wood-classic", "royal-legends"];
  const effBoard = BOARDS.includes(original.board_skin_id) ? original.board_skin_id : "standard-green";
  const effPiece = PIECES.includes(original.piece_set_id) ? original.piece_set_id : "wikimedia-classic";
  console.log(`QA child saved: ${JSON.stringify(original)} -> effective ${effBoard} / ${effPiece}${WRITE ? "  (write mode: will restore)" : "  (read-only)"}`);

  let pass = 0; const fails = [];
  const check = (n, ok, d) => { if (ok) pass++; else { fails.push(n + (d ? " -- " + d : "")); console.log("FAIL:", n, d || ""); } };
  const sel = (a) => a.filter((x) => x.pressed === "true").map((x) => x.id);

  try {
    for (const v of VIEWPORTS) {
      const s = await openSession(v, cookies);
      try {
        const r = await s.customize();
        const cards = r.board.concat(r.piece);
        check(`${v.name}: 5 board cards and 4 piece cards render (Standard Green and Classic first)`, r.board.length === 5 && r.piece.map((c) => c.id).join() === "wikimedia-classic,neostaunton-hand,wood-classic,royal-legends" && r.board[0].id === "standard-green" && r.piece[0].id === "wikimedia-classic", `${r.board.length}/${r.piece.length} ${r.board[0] && r.board[0].id} ${r.piece[0] && r.piece[0].id}`);
        check(`${v.name}: no horizontal overflow`, r.docW <= r.vw && r.over === 0, `doc ${r.docW} vs ${r.vw}, ${r.over} elements past the edge`);
        check(`${v.name}: ${v.cols} board cards per row (${Math.ceil(5 / v.cols)} rows)`, new Set(r.board.map((c) => c.top)).size === Math.ceil(5 / v.cols), JSON.stringify(r.board.map((c) => c.top)));
        check(`${v.name}: every card is a real preview (64 squares / 8 piece images) and inert`, r.board.every((c) => c.squares === 64 && c.inert) && r.piece.every((c) => c.imgs === 8 && c.inert));
        check(`${v.name}: every card control is >= 44px tall and receives the click`, cards.every((c) => c.h >= 44 && c.hit), JSON.stringify(cards.map((c) => [c.id, c.h, c.hit])));
        check(`${v.name}: the selected cards are the EFFECTIVE ids (one each)`, JSON.stringify(sel(r.board)) === JSON.stringify([effBoard]) && JSON.stringify(sel(r.piece)) === JSON.stringify([effPiece]), `${sel(r.board)} / ${sel(r.piece)}`);
        check(`${v.name}: the restored Wood Classic board card previews its real image`, r.woodBoardImg === true);
        check(`${v.name}: no broken images and no console errors`, r.broken === 0 && s.logs.length === 0, `${r.broken} broken; ${s.logs.slice(0, 2).join(" | ")}`);
      } finally { s.close(); }
    }
    check("loading Customize (5 viewports) wrote nothing to the saved preference", JSON.stringify(await saved()) === JSON.stringify(original), JSON.stringify(await saved()));

    const pickers = async (expectBoard, expectPiece, label) => {
      for (const v of [VIEWPORTS[0], VIEWPORTS[3]]) {
        const s = await openSession(v, cookies);
        try {
          for (const [pg, attr, expect, count] of [["onboarding/board", "data-board-option", expectBoard, 5], ["onboarding/pieces", "data-piece-option", expectPiece, 4]]) {
            await s.open(pg); await s.waitFor(`document.querySelectorAll('[${attr}]').length>=1`); await s.imagesReady(); await sleep(1200);
            const r = JSON.parse(await s.ev(`JSON.stringify({n:document.querySelectorAll('[${attr}]').length,sel:[...document.querySelectorAll('[${attr}][aria-pressed="true"]')].map(e=>e.getAttribute('${attr}')),docW:document.documentElement.scrollWidth,vw:innerWidth,broken:[...document.images].filter(i=>!(i.complete&&i.naturalWidth>0)).length})`));
            check(`${label} ${pg} @${v.w}: ${count} options, selected = ${expect} (the effective id), no overflow, no broken images, no errors`, r.n === count && JSON.stringify(r.sel) === JSON.stringify([expect]) && r.docW <= r.vw && r.broken === 0 && s.logs.length === 0, JSON.stringify(r) + " " + s.logs.slice(0, 2).join("|"));
          }
        } finally { s.close(); }
      }
    };
    await pickers(effBoard, effPiece, "saved ids:");
    check("opening both onboarding pickers wrote nothing to the saved preference", JSON.stringify(await saved()) === JSON.stringify(original), JSON.stringify(await saved()));

    if (WRITE) {
      const s = await openSession({ w: 1280, h: 900, dpr: 1 }, cookies);
      try {
        let r = await s.customize();
        await s.click('[data-board-card="slate"] > button'); await sleep(1500); r = JSON.parse(await s.ev(PROBE));
        check("choosing Slate selects it and the main preview changes at once", JSON.stringify(sel(r.board)) === '["slate"]' && r.a1 === rgb("#5C5F63"), `${sel(r.board)} ${r.a1}`);
        check("... and it is saved", (await saved()).board_skin_id === "slate");
        r = await s.customize();
        check("... and it is still selected after a reload", JSON.stringify(sel(r.board)) === '["slate"]' && r.a1 === rgb("#5C5F63"));
        await s.click('[data-piece-card="neostaunton-hand"] > button'); await sleep(1500); r = JSON.parse(await s.ev(PROBE));
        check("choosing NeoStaunton pieces selects them; the main preview and every board card now draw them", JSON.stringify(sel(r.piece)) === '["neostaunton-hand"]' && JSON.stringify(r.mainPieces) === '["neostaunton-hand"]' && JSON.stringify(r.boardCardPieces) === '["neostaunton-hand"]', JSON.stringify([sel(r.piece), r.mainPieces, r.boardCardPieces]));
        check("... and they are saved", (await saved()).piece_set_id === "neostaunton-hand");
        r = await s.customize();
        check("... and they are still selected after a reload", JSON.stringify(sel(r.piece)) === '["neostaunton-hand"]' && JSON.stringify(sel(r.board)) === '["slate"]');
        await s.open("puzzles/tactics"); await s.waitFor(`document.querySelectorAll('[data-square]').length===64`, 40000); await sleep(1500);
        const g = JSON.parse(await s.ev(`JSON.stringify({a1:getComputedStyle(document.querySelector('[data-square=a1]')).backgroundColor,b1:getComputedStyle(document.querySelector('[data-square=b1]')).backgroundColor,sets:[...new Set([...document.querySelectorAll('[data-square] img')].map(i=>i.src.split('/pieces/')[1].split('/')[0]))]})`));
        check("the real game board shows the chosen board and pieces", g.a1 === rgb("#5C5F63") && g.b1 === rgb("#D2CFC9") && JSON.stringify(g.sets) === '["neostaunton-hand"]', JSON.stringify(g));
        check("no console errors during the write flow", s.logs.length === 0, s.logs.slice(0, 2).join(" | "));
      } finally { s.close(); }

      // Restored art through the real UI: the image-backed Wood Classic board and the Royal Legends raster pieces.
      const r2 = await openSession({ w: 411, h: 914, dpr: 2.625 }, cookies);
      try {
        let r = await r2.customize();
        await r2.click('[data-board-card="wood-classic"] > button'); await sleep(1500);
        await r2.click('[data-piece-card="royal-legends"] > button'); await sleep(1500);
        r = JSON.parse(await r2.ev(PROBE));
        check("restored Wood Classic board + Royal Legends pieces select, and the main preview draws the board image and those pieces", JSON.stringify(sel(r.board)) === '["wood-classic"]' && JSON.stringify(sel(r.piece)) === '["royal-legends"]' && r.mainBoardImg === true && JSON.stringify(r.mainPieces) === '["royal-legends"]' && r.broken === 0, JSON.stringify([sel(r.board), sel(r.piece), r.mainBoardImg, r.mainPieces, r.broken]));
        const sv = await saved();
        check("... and both are saved with their original ids", sv.board_skin_id === "wood-classic" && sv.piece_set_id === "royal-legends", JSON.stringify(sv));
        r = await r2.customize();
        check("... and still selected after a reload; no horizontal overflow", JSON.stringify(sel(r.board)) === '["wood-classic"]' && JSON.stringify(sel(r.piece)) === '["royal-legends"]' && r.docW <= r.vw, `${sel(r.board)} ${sel(r.piece)} doc ${r.docW}/${r.vw}`);
        await r2.open("puzzles/tactics"); await r2.waitFor(`document.querySelectorAll('[data-square]').length===64`, 40000); await sleep(1500);
        const g = JSON.parse(await r2.ev(`JSON.stringify({boardImg:!!document.querySelector('img[src*="/boards/wood-classic.svg"]'),sets:[...new Set([...document.querySelectorAll('[data-square] img')].map(i=>i.src.split('/pieces/')[1].split('/')[0]))],broken:[...document.images].filter(i=>!(i.complete&&i.naturalWidth>0)).length})`));
        check("the real game board shows the image board and the restored pieces, with nothing broken", g.boardImg && JSON.stringify(g.sets) === '["royal-legends"]' && g.broken === 0, JSON.stringify(g));
        check("no console errors in the restored-art flow", r2.logs.length === 0, r2.logs.slice(0, 2).join(" | "));
      } finally { r2.close(); }

      // Retired saved ids — including the three dropped boards — must show the defaults as selected everywhere, writing nothing.
      for (const [boardId, pieceId] of [["sunset-desert", "classic"], ["ocean-ice", "classic"], ["walnut-classic", "classic"], ["classic-forest", "classic"], ["standard-green", "aurelia"], ["standard-green", "atelier"], ["standard-green", "kingdom-characters"]]) {
        await sb.from("children").update({ board_skin_id: boardId, piece_set_id: pieceId }).eq("id", CHILD);
        const retired = await saved();
        const r3 = await openSession({ w: 390, h: 844, dpr: 3 }, cookies);
        try {
          const r = await r3.customize();
          check(`saved '${boardId}' / '${pieceId}': Customize shows Standard Green and Classic as selected, and exactly 5 board / 4 piece cards (no Sunset Desert, Ocean Ice, Walnut Classic, Atelier or Kingdom Characters)`, JSON.stringify(sel(r.board)) === '["standard-green"]' && JSON.stringify(sel(r.piece)) === '["wikimedia-classic"]' && r.board.length === 5 && r.piece.length === 4, `${sel(r.board)} ${sel(r.piece)} ${r.board.length}`);
        } finally { r3.close(); }
        await pickers("standard-green", "wikimedia-classic", `saved '${boardId}':`);
        check(`opening Customize and both pickers with '${boardId}' saved wrote nothing (the saved id is untouched)`, JSON.stringify(await saved()) === JSON.stringify(retired), JSON.stringify(await saved()));
      }
    }
  } finally {
    if (WRITE) {
      await sb.from("children").update({ board_skin_id: original.board_skin_id, piece_set_id: original.piece_set_id }).eq("id", CHILD);
      console.log("restored saved ids:", JSON.stringify(await saved()));
    }
  }
  console.log(`\n${pass} checks passed, ${fails.length} failed`);
  if (fails.length) { console.log(fails.map((f) => " - " + f).join("\n")); process.exit(1); }
  process.exit(0);
})();

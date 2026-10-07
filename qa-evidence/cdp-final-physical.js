const WebSocket = require("ws");
const http = require("http");
const fs = require("fs");
const path = require("path");

const port = Number(process.env.CDP_PORT || 9222);
const tag = process.env.QA_TAG || "device";
const base = process.env.QA_BASE || "http://localhost:3000";
const outDir = path.join(__dirname, "final-physical");
fs.mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function json(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => resolve(JSON.parse(d)));
    }).on("error", reject);
  });
}

async function connect() {
  const pages = await json(`http://127.0.0.1:${port}/json`);
  const page = pages.find((p) => p.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  ws.on("message", (raw) => {
    const m = JSON.parse(raw);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
    }
  });
  await new Promise((r, j) => { ws.on("open", r); ws.on("error", j); });
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id;
    pending.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  return { ws, send };
}

async function ev(send, expression) {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) return { evalError: r.exceptionDetails.exception?.description || r.exceptionDetails.text };
  return r.result.value;
}

async function shot(send, name) {
  const r = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(outDir, `${tag}-${name}.png`), Buffer.from(r.data, "base64"));
}

async function go(send, url, waitMs = 9000) {
  await send("Page.navigate", { url });
  await sleep(waitMs);
}

const COMMON = `
  window.__qaVis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  window.__qaPillHits = () => {
    const pill = document.querySelector('.phone-utility-icons');
    if (!pill || !__qaVis(pill)) return { pill: 'hidden', hits: [] };
    const pr = pill.getBoundingClientRect();
    const hits = [];
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
    while ((n = tw.nextNode())) {
      if (!n.textContent.trim() || pill.contains(n) || /DEV TEST MODE/.test(n.textContent)) continue;
      if (n.parentElement.closest('[aria-hidden=true]')) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      for (const r of rg.getClientRects()) if (r.width && r.right > pr.left && r.left < pr.right && r.bottom > pr.top && r.top < pr.bottom) { hits.push(n.textContent.trim().slice(0, 30)); break; }
    }
    return { pill: [Math.round(pr.left), Math.round(pr.top), Math.round(pr.right), Math.round(pr.bottom)], hits };
  };
  window.__qaSmall = () => [...document.querySelectorAll('main a, main button, .world-cta')]
    .filter(__qaVis)
    .filter((e) => !/^[a-h][1-8]/.test(e.getAttribute('aria-label') || ''))
    .map((e) => ({ t: (e.getAttribute('aria-label') || e.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 40), h: Math.round(e.getBoundingClientRect().height) }));
  window.__qaBase = () => ({
    href: location.pathname + location.search,
    vw: innerWidth, vh: innerHeight,
    layout: document.documentElement.dataset.layout,
    world: document.querySelector('[data-world]')?.getAttribute('data-world') || null,
    worlds: [...new Set([...document.querySelectorAll('[data-world]')].map((e) => e.getAttribute('data-world')))],
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    h1: document.querySelector('h1')?.textContent.trim() || null,
    runtimeError: /Application error|Unhandled Runtime Error|Hydration failed|Something went wrong/i.test(document.body.innerText),
    safeTop: getComputedStyle(document.documentElement).getPropertyValue('--safe-top').trim(),
  });
`;

const PRICE_WATCH = `
  (() => {
    window.__qaLabels = [];
    window.__qaRupeeInCard = false;
    const scan = () => {
      for (const b of document.querySelectorAll('button')) {
        const t = (b.textContent || '').replace(/\\s+/g, ' ').trim();
        if (/Lifetime Access/.test(t) && window.__qaLabels[window.__qaLabels.length - 1] !== t) window.__qaLabels.push(t);
      }
      const card = [...document.querySelectorAll('p')].find((p) => /Session \\d+ is waiting/.test(p.textContent || ''));
      if (card && /\\u20b9/.test(card.parentElement.textContent || '')) window.__qaRupeeInCard = true;
    };
    new MutationObserver(scan).observe(document, { subtree: true, childList: true, characterData: true });
    document.addEventListener('DOMContentLoaded', scan);
  })();
`;

(async () => {
  const { ws, send } = await connect();
  await send("Runtime.enable");
  await send("Page.enable");
  const report = { tag };

  // TEST 1 — Enchanted Puzzles hub + board chamber chips
  await go(send, `${base}/puzzles?world=enchanted`, 10000);
  await ev(send, COMMON);
  report.puzzlesHub = await ev(send, `({ ...__qaBase(), pill: __qaPillHits(), h1Rect: (() => { const r = document.querySelector('h1')?.getBoundingClientRect(); return r ? [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)] : null; })(), solve: __qaSmall().filter((x) => /Solve/.test(x.t)) })`);
  await shot(send, "puzzles-hub");
  const pid = await ev(send, `fetch('/api/puzzles/mate', { cache: 'no-store' }).then((r) => r.json()).then((j) => j.puzzle && j.puzzle.id).catch(() => null)`);
  report.puzzleEnter = pid ? `daily-format deep link id=${pid}` : "no puzzle id";
  if (pid) await go(send, `${base}/puzzles?id=${encodeURIComponent(pid)}&daily=1&world=enchanted`, 11000);
  await ev(send, COMMON);
  report.puzzleBoard = await ev(send, `(() => {
    const chips = [...document.querySelectorAll('.pz-meta--enchanted .pz-path li')].map((li) => ({ t: li.textContent.trim(), clipped: li.scrollWidth > li.clientWidth + 1 || li.scrollHeight > li.clientHeight + 1, w: Math.round(li.getBoundingClientRect().width), h: Math.round(li.getBoundingClientRect().height) }));
    const board = () => { const a = document.querySelector('button[aria-label^="a8"]'), h = document.querySelector('button[aria-label^="h1"]'); if (!a || !h) return null; const ra = a.getBoundingClientRect(), rh = h.getBoundingClientRect(); return { left: Math.round(ra.left), right: Math.round(rh.right), width: Math.round(rh.right - ra.left), bottom: Math.round(rh.bottom) }; };
    const now = board();
    const st = document.createElement('style');
    st.textContent = '.pz-meta--enchanted .pz-path li{white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;display:block!important}';
    document.head.appendChild(st);
    const old = board();
    st.remove();
    const controls = __qaSmall();
    return { ...__qaBase(), pill: __qaPillHits(), chips, boardNow: now, boardWithOldChipStyle: old, controls, smallControls: controls.filter((c) => c.h < 48) };
  })()`);
  await ev(send, `window.scrollTo(0, 0)`);
  await shot(send, "puzzles-board");
  const chipY = await ev(send, `(() => { const el = document.querySelector('.pz-meta--enchanted .pz-path'); if (!el) return null; el.scrollIntoView({ block: 'center' }); return Math.round(el.getBoundingClientRect().top); })()`);
  if (chipY !== null) { await sleep(500); await shot(send, "puzzles-chips"); }

  // TEST 2 — Chess School × 3 worlds, price watcher installed before load
  const watch = await send("Page.addScriptToEvaluateOnNewDocument", { source: PRICE_WATCH });
  report.school = {};
  for (const w of ["enchanted", "atelier", "classic"]) {
    await go(send, `${base}/chess-school/classroom?world=${w}`, 12000);
    await ev(send, COMMON);
    const r = await ev(send, `(() => {
      const card = [...document.querySelectorAll('p')].find((p) => /Session \\d+ is waiting/.test(p.textContent || ''));
      const cta = [...document.querySelectorAll('button')].find((b) => /Lifetime Access/.test(b.textContent || ''));
      const cr = cta && cta.getBoundingClientRect();
      return { ...__qaBase(), kicker: document.querySelector('.world-kicker')?.textContent.trim() || null,
        structure: ['.sch-journey', '.sch-academy', '.sch-study'].filter((s) => document.querySelector(s)),
        pill: __qaPillHits(), labelsSeen: window.__qaLabels, rupeeInCard: window.__qaRupeeInCard,
        cardFound: !!card, ctaH: cr ? Math.round(cr.height) : null, ctaTop: cr ? Math.round(cr.top + scrollY) : null,
        smallControls: __qaSmall().filter((c) => c.h < 44) };
    })()`);
    report.school[w] = r;
    await ev(send, `window.scrollTo(0, 0)`);
    await shot(send, `school-${w}-top`);
    await ev(send, `(() => { const b = [...document.querySelectorAll('button')].find((e) => /Lifetime Access/.test(e.textContent || '')); if (b) b.scrollIntoView({ block: 'center' }); })()`);
    await sleep(600);
    await shot(send, `school-${w}-unlock`);
  }
  await send("Page.removeScriptToEvaluateOnNewDocument", { identifier: watch.identifier });

  fs.writeFileSync(path.join(outDir, `${tag}.json`), JSON.stringify(report, null, 2));
  console.log("written", tag);
  ws.close();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });

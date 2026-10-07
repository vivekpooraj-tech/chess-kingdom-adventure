const WebSocket = require("ws");
const http = require("http");
const fs = require("fs");
const path = require("path");

const port = Number(process.env.CDP_PORT || 9222);
const tag = process.env.QA_TAG || "device";
const base = process.env.QA_BASE || "http://localhost:3000";
const outDir = path.join(__dirname, "release-physical");
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
  const page = pages.find((p) => p.type === "page" && /localhost:3000/.test(p.url))
    || pages.find((p) => p.type === "page");
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

async function go(send, url, waitMs = 8000) {
  await send("Page.navigate", { url });
  await sleep(waitMs);
}

(async () => {
  const { ws, send } = await connect();
  await send("Runtime.enable");
  await send("Page.enable");
  const report = { tag };

  await ev(send, `localStorage.removeItem('chessmind-mode')`);
  await go(send, `${base}/kingdom-map`, 7000);
  report.homeLinks = await ev(send, `(() => [...document.querySelectorAll('a')].map((a) => ({ t: (a.innerText||a.getAttribute('aria-label')||'').replace(/\\s+/g,' ').trim().slice(0,50), href: a.getAttribute('href') })).filter((x) => x.t || x.href))`);
  report.playNow = await ev(send, `(() => {
    const a = [...document.querySelectorAll('a')].find((e) => /play now/i.test(e.innerText || ''));
    if (!a) return { ok: false };
    a.click();
    return { ok: true, href: a.getAttribute('href'), h: Math.round(a.getBoundingClientRect().height) };
  })()`);
  await sleep(8000);
  report.afterPlayNow = { href: await ev(send, `location.pathname + location.search`) };
  await shot(send, "after-play-now");

  await go(send, `${base}/free-play`, 7000);
  await ev(send, `(() => { const b = [...document.querySelectorAll('button,a')].find((e) => /Medium/.test(e.innerText||'')); if (b) b.click(); })()`);
  await sleep(9000);
  report.classicPlay = await ev(send, `(() => {
    const vw = innerWidth, vh = innerHeight;
    const sq = [...document.querySelectorAll('button')].filter((e) => /^[a-h][1-8]/.test(e.getAttribute('aria-label')||''));
    let board = null;
    if (sq.length) {
      let l=1e9,t=1e9,r=-1e9,b=-1e9;
      sq.forEach((s) => { const q = s.getBoundingClientRect(); l=Math.min(l,q.left); t=Math.min(t,q.top); r=Math.max(r,q.right); b=Math.max(b,q.bottom); });
      board = { l:Math.round(l),t:Math.round(t),r:Math.round(r),b:Math.round(b), inside: l>=-1 && r<=vw+1 && t>=-1 && b<=vh+1, n: sq.length };
    }
    const btns = [...document.querySelectorAll('button,a')].filter((e) => e.getBoundingClientRect().height > 0 && !/^[a-h][1-8]/.test(e.getAttribute('aria-label')||'') && !/DEV TEST/.test(e.innerText||'')).map((e) => (e.getAttribute('aria-label')||e.innerText||'').replace(/\\s+/g,' ').trim().slice(0,28) + ':' + Math.round(e.getBoundingClientRect().height));
    return { href: location.pathname, vw, vh, overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth, world: document.querySelector('[data-world]')?.dataset.world, h1: document.querySelector('h1')?.textContent.trim(), board, shell: (() => { const sh = document.querySelector('.chess-focus-shell'); return sh ? getComputedStyle(sh).position + ' h' + Math.round(sh.getBoundingClientRect().height) : null; })(), btns, small: btns.filter((t) => /:\\d+$/.test(t) && Number(t.split(':').pop()) < 48) };
  })()`);
  await shot(send, "classic-play-game");
  report.e2 = await ev(send, `(() => { const el = [...document.querySelectorAll('button')].find((e) => (e.getAttribute('aria-label')||'').startsWith('e2')); if (!el) return {ok:false}; el.click(); return {ok:true}; })()`);
  await sleep(400);
  report.e4 = await ev(send, `(() => { const el = [...document.querySelectorAll('button')].find((e) => (e.getAttribute('aria-label')||'').startsWith('e4')); if (!el) return {ok:false}; el.click(); return {ok:true}; })()`);
  await sleep(3000);
  report.afterMove = await ev(send, `(() => ({ text: document.body.innerText.replace(/\\s+/g,' ').slice(0,700), hasE4: /\\be4\\b/i.test(document.body.innerText), href: location.pathname }) )()`);
  await shot(send, "classic-play-e4");
  report.fullscreen = await ev(send, `(() => { const b = [...document.querySelectorAll('button')].find((e) => /fullscreen/i.test(e.getAttribute('aria-label')||e.innerText||'')); if (!b) return {ok:false}; const h = Math.round(b.getBoundingClientRect().height); b.click(); return {ok:true,h}; })()`);
  await sleep(1500);
  await shot(send, "classic-play-fs");
  report.exit = await ev(send, `(() => { const b = [...document.querySelectorAll('button,a')].find((e) => /^Exit$/i.test((e.innerText||e.getAttribute('aria-label')||'').trim())); if (!b) return {ok:false}; b.click(); return {ok:true}; })()`);
  await sleep(2500);
  report.afterExit = await ev(send, `location.pathname`);

  await go(send, `${base}/kingdom-map`, 6000);
  report.homeScroll = await ev(send, `(() => {
    const hits = {};
    for (const key of ['Command deck','Career ledger','Recent duels','Grandmaster salon','Chess Mind Premium','Play now','Today']) {
      const el = [...document.querySelectorAll('*')].find((e) => e.childElementCount < 8 && new RegExp(key, 'i').test(e.textContent||'') && e.getBoundingClientRect().height > 0);
      hits[key] = !!el;
    }
    window.scrollTo(0, document.body.scrollHeight);
    return { hits, overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth, sh: document.documentElement.scrollHeight };
  })()`);
  await sleep(800);
  await shot(send, "classic-home-bottom");

  report.deck = {};
  for (const [name, href] of [['tactics','/puzzles/tactics'],['play','/play'],['games','/games'],['stats','/stats']]) {
    await go(send, `${base}${href}`, 6000);
    report.deck[name] = await ev(send, `({ href: location.pathname, h1: document.querySelector('h1')?.textContent.trim() || document.title, error: /Oops, something slipped|Unhandled Runtime/.test(document.body.innerText), overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth })`);
    await shot(send, `deck-${name}`);
  }

  report.salon = await ev(send, `(() => {
    location.href = ${JSON.stringify(base + "/kingdom-map")};
    return true;
  })()`);
  await sleep(7000);
  report.salonClick = await ev(send, `(() => {
    const a = [...document.querySelectorAll('a,button')].find((e) => /Ask a parent|Grandmaster salon|Unlock Premium/i.test(e.innerText||''));
    if (!a) return { ok: false, texts: [...document.querySelectorAll('a')].map((e) => (e.innerText||'').trim().slice(0,40)).filter(Boolean).slice(-8) };
    a.click();
    return { ok: true, text: a.innerText.replace(/\\s+/g,' ').trim().slice(0,40), href: a.getAttribute('href') };
  })()`);
  await sleep(4000);
  report.salonAfter = await ev(send, `({ href: location.pathname, h1: document.querySelector('h1')?.textContent.trim() || null, body: document.body.innerText.replace(/\\s+/g,' ').slice(0,300) })`);
  await shot(send, "salon-gate");

  fs.writeFileSync(path.join(outDir, `${tag}-followup.json`), JSON.stringify(report, null, 2));
  console.log("written", `${tag}-followup.json`);
  ws.close();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });

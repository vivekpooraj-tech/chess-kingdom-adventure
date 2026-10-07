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
      res.on("end", () => {
        try { resolve(JSON.parse(d)); } catch (e) { reject(e); }
      });
    }).on("error", reject);
  });
}

async function connect() {
  const pages = await json(`http://127.0.0.1:${port}/json`);
  const page = pages.find((p) => p.type === "page" && /localhost:3000|chessmind/.test(p.url))
    || pages.find((p) => p.type === "page");
  if (!page) throw new Error("NO_PAGE " + JSON.stringify(pages).slice(0, 400));
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
  return { ws, send, pageUrl: page.url };
}

async function ev(send, expression) {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) {
    return { evalError: r.exceptionDetails.exception?.description || r.exceptionDetails.text };
  }
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

const AUDIT = `
(() => {
  const vw = innerWidth, vh = innerHeight;
  const scope = document.querySelector('[data-world]');
  const vis = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
  };
  const off = [];
  document.querySelectorAll('body *').forEach((e) => {
    const r = e.getBoundingClientRect();
    if (r.width && r.right > vw + 2) off.push((typeof e.className === 'string' ? e.className : e.tagName).toString().slice(0, 40));
  });
  const small = [];
  document.querySelectorAll('main a, main button, .world-cta, [data-nav]').forEach((e) => {
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height || !vis(e)) return;
    const label = (e.getAttribute('aria-label') || e.innerText || '').replace(/\\s+/g, ' ').trim();
    if (/^[a-h][1-8]/.test(label) || /DEV TEST/.test(label)) return;
    if (e.closest('[data-square], .cg-wrap, cg-board')) return;
    if (r.height < 48) small.push(label.slice(0, 32) + ':' + Math.round(r.width) + 'x' + Math.round(r.height));
  });
  const sq = document.querySelectorAll('[data-square], button[aria-label^="a8"], button[aria-label^="h1"]');
  let board = null;
  const squares = document.querySelectorAll('button[aria-label*=" — "], button[aria-label^="a8"], [data-square]');
  if (squares.length) {
    let l=1e9,t=1e9,r=-1e9,b=-1e9;
    squares.forEach((s) => { const q = s.getBoundingClientRect(); if (!q.width) return; l=Math.min(l,q.left); t=Math.min(t,q.top); r=Math.max(r,q.right); b=Math.max(b,q.bottom); });
    if (r > 0) board = { l:Math.round(l), t:Math.round(t), r:Math.round(r), b:Math.round(b), inside: l>=-1 && r<=vw+1 && t>=-1 && b<=vh+1 };
  }
  const visCh = Array.from(document.querySelectorAll('[class]')).filter((e) => typeof e.className === 'string' && /(^| )ch-/.test(e.className) && vis(e)).length;
  const ff = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).fontFamily.split(',')[0] : null; };
  const sh = document.querySelector('.chess-focus-shell, .chess-focus-shell--preserve-nav');
  const nav = Array.from(document.querySelectorAll('nav[aria-label="Primary"]')).map((n) => n.getBoundingClientRect()).find((r) => r.height > 0);
  return {
    href: location.pathname + location.search,
    host: location.host,
    vw, vh,
    sw: document.documentElement.scrollWidth,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    mode: document.documentElement.dataset.mode || null,
    world: scope && scope.dataset.world,
    kicker: (document.querySelector('.world-kicker')?.textContent || '').trim() || null,
    h1: (document.querySelector('h1')?.textContent || '').trim() || null,
    titleFont: ff('.world-title') || ff('h1'),
    kickerFont: ff('.world-kicker'),
    gold: scope ? getComputedStyle(scope).getPropertyValue('--cm-gold').trim() : '',
    visibleClassicNodes: visCh,
    board,
    shell: sh ? getComputedStyle(sh).position + ' h' + Math.round(sh.getBoundingClientRect().height) : null,
    nav: nav ? Math.round(nav.top) + '-' + Math.round(nav.bottom) : 'hidden',
    small: small.slice(0, 12),
    off: off.slice(0, 8),
    error: /Oops, something slipped|Unhandled Runtime Error|Application error/i.test(document.body.innerText),
    body: document.body.innerText.replace(/\\s+/g, ' ').slice(0, 500),
  };
})()
`;

async function clickText(send, reSrc) {
  return ev(send, `(() => {
    const re = new RegExp(${JSON.stringify(reSrc)}, 'i');
    const els = [...document.querySelectorAll('a,button')];
    const el = els.find((e) => re.test((e.getAttribute('aria-label') || '') + ' ' + (e.innerText || '')));
    if (!el) return { ok: false, reason: 'not found' };
    el.click();
    return { ok: true, text: (el.innerText || el.getAttribute('aria-label') || '').replace(/\\s+/g,' ').trim().slice(0,40) };
  })()`);
}

async function tapSquare(send, name) {
  return ev(send, `(() => {
    const el = [...document.querySelectorAll('button')].find((e) => (e.getAttribute('aria-label') || '').startsWith(${JSON.stringify(name)}));
    if (!el) return { ok: false };
    el.click();
    const r = el.getBoundingClientRect();
    return { ok: true, box: [Math.round(r.left), Math.round(r.top), Math.round(r.width)] };
  })()`);
}

(async () => {
  const { ws, send, pageUrl } = await connect();
  await send("Runtime.enable");
  await send("Page.enable");
  const report = { tag, pageUrl, startedAt: new Date().toISOString() };

  await ev(send, `localStorage.removeItem('chessmind-mode')`);
  await go(send, `${base}/api/dev/auto-signin?next=%2Fkingdom-map`, 9000);
  report.home = await ev(send, AUDIT);
  await shot(send, "classic-home");
  report.homeHas = {
    playNow: /Play now/i.test(report.home.body || ""),
    commandDeck: /Command deck/i.test(report.home.body || ""),
    challenge: /Today'?s challenge|Daily Challenge|Checkmate/i.test(report.home.body || ""),
    career: /Career ledger/i.test(report.home.body || ""),
    duels: /Recent duels/i.test(report.home.body || ""),
    salon: /Grandmaster salon|Chess Mind Premium/i.test(report.home.body || ""),
    identity: /Classic Pro/i.test(report.home.body || "") || report.home.kicker === "Classic Pro",
    rating: /400/.test(report.home.body || ""),
  };

  const playClick = await clickText(send, "^Play now$");
  report.playNowClick = playClick;
  await sleep(8000);
  report.playLobby = await ev(send, AUDIT);
  await shot(send, "classic-play-lobby");
  const medium = await clickText(send, "Medium");
  report.mediumClick = medium;
  await sleep(9000);
  report.playGame = await ev(send, AUDIT);
  await shot(send, "classic-play-before-move");
  const e2 = await tapSquare(send, "e2");
  await sleep(400);
  const e4 = await tapSquare(send, "e4");
  await sleep(2500);
  report.move = { e2, e4 };
  report.playAfterMove = await ev(send, `(() => {
    const text = document.body.innerText;
    const sheet = [...document.querySelectorAll('li, p, span, td')].map((e) => e.textContent.trim()).filter((t) => /^e4$|^1\\.?\\s*e4/.test(t));
    return { hasE4: /\\be4\\b/i.test(text), sheetHits: sheet.slice(0, 6), clocks: [...document.querySelectorAll('time, .clock, [class*=clock]')].map((e) => e.textContent.trim()).slice(0, 4), opponent: [...document.querySelectorAll('*')].filter((e) => /Opponent/.test(e.textContent || '') && e.children.length === 0).map((e) => e.textContent.trim()).slice(0, 4) };
  })()`);
  await shot(send, "classic-play-after-move");
  report.exitClick = await clickText(send, "^Exit$");
  await sleep(2500);

  await go(send, `${base}/puzzles?id=lichess-iYtIh&daily=1`, 10000);
  report.puzzles = await ev(send, AUDIT);
  await shot(send, "classic-puzzles");
  report.puzzleWrong = await tapSquare(send, "a2");
  await sleep(1500);
  report.puzzleFeedback = await ev(send, `(() => ({ text: document.body.innerText.replace(/\\s+/g,' ').slice(0, 600), wrong: /wrong|try again|not it|keep looking/i.test(document.body.innerText) }) )()`);
  await shot(send, "classic-puzzle-wrong");

  await go(send, `${base}/chess-school/classroom`, 10000);
  report.learn = await ev(send, AUDIT);
  await shot(send, "classic-learn");

  await ev(send, `localStorage.setItem('chessmind-mode','kids')`);
  await go(send, `${base}/kingdom-map`, 8000);
  report.enchantedHome = await ev(send, AUDIT);
  await shot(send, "enchanted-home");
  await go(send, `${base}/free-play`, 7000);
  const encMed = await clickText(send, "Medium");
  await sleep(8000);
  report.enchantedPlay = Object.assign(await ev(send, AUDIT), { medium: encMed });
  await shot(send, "enchanted-play");
  await go(send, `${base}/puzzles?id=lichess-iYtIh&daily=1`, 9000);
  report.enchantedPuzzles = await ev(send, AUDIT);
  await shot(send, "enchanted-puzzles");
  await go(send, `${base}/chess-school/classroom`, 9000);
  report.enchantedLearn = await ev(send, AUDIT);
  await shot(send, "enchanted-learn");

  await ev(send, `localStorage.setItem('chessmind-mode','adult')`);
  await go(send, `${base}/kingdom-map`, 8000);
  report.atelierHome = await ev(send, AUDIT);
  await shot(send, "atelier-home");
  await go(send, `${base}/free-play`, 7000);
  const atMed = await clickText(send, "Medium");
  await sleep(8000);
  report.atelierPlay = Object.assign(await ev(send, AUDIT), { medium: atMed });
  await shot(send, "atelier-play");
  await go(send, `${base}/puzzles?id=lichess-iYtIh&daily=1`, 9000);
  report.atelierPuzzles = await ev(send, AUDIT);
  await shot(send, "atelier-puzzles");
  await go(send, `${base}/chess-school/classroom`, 9000);
  report.atelierLearn = await ev(send, AUDIT);
  await shot(send, "atelier-learn");

  await ev(send, `localStorage.removeItem('chessmind-mode')`);
  await go(send, `${base}/login-welcome`, 4000);
  report.loginWelcome = await ev(send, `(() => {
    const v = document.querySelector('video');
    const play = [...document.querySelectorAll('button')].find((b) => /Play/.test(b.textContent || b.getAttribute('aria-label') || ''));
    const cont = [...document.querySelectorAll('button')].find((b) => /^Continue$/i.test((b.textContent || '').trim()));
    return {
      href: location.pathname,
      videoMuted: v ? v.muted : null,
      videoSrc: v ? (v.currentSrc || v.src || '').slice(-40) : null,
      paused: v ? v.paused : null,
      playVisible: !!(play && play.getBoundingClientRect().height),
      continueVisible: !!(cont && cont.getBoundingClientRect().height),
      playH: play ? Math.round(play.getBoundingClientRect().height) : null,
      continueH: cont ? Math.round(cont.getBoundingClientRect().height) : null,
    };
  })()`);
  await shot(send, "login-welcome");
  await sleep(9000);
  report.loginWelcomeLater = await ev(send, `(() => {
    const v = document.querySelector('video');
    const play = [...document.querySelectorAll('button')].find((b) => /Play the welcome|\\bPlay\\b/.test(b.getAttribute('aria-label') || b.textContent || ''));
    const cont = [...document.querySelectorAll('button')].find((b) => /^Continue$/i.test((b.textContent || '').trim()));
    return {
      href: location.pathname,
      videoMuted: v ? v.muted : null,
      paused: v ? v.paused : null,
      currentTime: v ? v.currentTime : null,
      playVisible: !!(play && play.getBoundingClientRect().height > 0),
      continueVisible: !!(cont && cont.getBoundingClientRect().height > 0),
    };
  })()`);
  await shot(send, "login-welcome-later");

  fs.writeFileSync(path.join(outDir, `${tag}.json`), JSON.stringify(report, null, 2));
  console.log("written", path.join(outDir, `${tag}.json`));
  ws.close();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });

const WebSocket = require("ws");
const http = require("http");
const fs = require("fs");
const path = require("path");
const port = Number(process.env.CDP_PORT || 9223);
const tag = "lenovo2";
const base = "http://localhost:3000";
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
  const page = pages.find((p) => p.type === "page" && /localhost:3000/.test(p.url)) || pages.find((p) => p.type === "page");
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

async function go(send, url) {
  await send("Page.navigate", { url });
  for (let i = 0; i < 20; i++) {
    await sleep(1000);
    const href = await ev(send, "location.pathname + location.search");
    const ready = await ev(send, "document.readyState");
    if (href && typeof href === "string" && href !== "/_error" && ready === "complete") {
      const h1 = await ev(send, "document.querySelector('h1') && document.querySelector('h1').textContent");
      if (ready === "complete") {
        await sleep(2500);
        return href;
      }
    }
  }
  return await ev(send, "location.href");
}

const AUDIT = `(() => {
  const vw = innerWidth, vh = innerHeight;
  const scope = document.querySelector('[data-world]');
  const visCh = [...document.querySelectorAll('[class]')].filter((e) => typeof e.className === 'string' && /(^| )ch-/.test(e.className) && e.getBoundingClientRect().height > 0).length;
  const cols = getComputedStyle(document.querySelector('.ch-grid, .classic-home, main') || document.body).gridTemplateColumns;
  return {
    href: location.pathname + location.search,
    vw, vh,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    world: scope && scope.dataset.world,
    kicker: (document.querySelector('.world-kicker')||{}).textContent && document.querySelector('.world-kicker').textContent.trim(),
    h1: document.querySelector('h1') && document.querySelector('h1').textContent.trim(),
    gold: scope ? getComputedStyle(scope).getPropertyValue('--cm-gold').trim() : '',
    titleFont: (document.querySelector('.world-title, h1') && getComputedStyle(document.querySelector('.world-title, h1')).fontFamily.split(',')[0]) || null,
    visibleClassicNodes: visCh,
    cols,
    body: document.body.innerText.replace(/\\s+/g,' ').slice(0,450),
    error: /Oops, something slipped|Unhandled Runtime/.test(document.body.innerText)
  };
})()`;

(async () => {
  const { ws, send } = await connect();
  await send("Runtime.enable");
  await send("Page.enable");
  const report = {};

  await ev(send, "localStorage.removeItem('chessmind-mode')");
  report.navHome = await go(send, base + "/kingdom-map");
  await ev(send, "window.scrollTo(0,0)");
  report.home = await ev(send, AUDIT);
  await shot(send, "home-top");
  await ev(send, "window.scrollTo(0, document.body.scrollHeight)");
  await sleep(800);
  report.homeBottom = await ev(send, AUDIT);
  await shot(send, "home-bottom");

  report.navPuzzles = await go(send, base + "/puzzles?id=lichess-iYtIh&daily=1");
  report.puzzles = await ev(send, AUDIT);
  await shot(send, "puzzles");

  report.navLearn = await go(send, base + "/chess-school/classroom");
  report.learn = await ev(send, AUDIT);
  await shot(send, "learn");

  await ev(send, "localStorage.setItem('chessmind-mode','kids')");
  report.navEncHome = await go(send, base + "/kingdom-map");
  report.encHome = await ev(send, AUDIT);
  await shot(send, "enc-home");
  report.navEncPlay = await go(send, base + "/free-play");
  await sleep(2000);
  await ev(send, "void([...document.querySelectorAll('button,a')].find((e)=>/Medium/.test(e.innerText||''))?.click())");
  await sleep(8000);
  report.encPlay = await ev(send, AUDIT);
  await shot(send, "enc-play");
  report.navEncPuz = await go(send, base + "/puzzles?id=lichess-iYtIh&daily=1");
  report.encPuz = await ev(send, AUDIT);
  await shot(send, "enc-puz");
  report.navEncLearn = await go(send, base + "/chess-school/classroom");
  report.encLearn = await ev(send, AUDIT);
  await shot(send, "enc-learn");

  await ev(send, "localStorage.setItem('chessmind-mode','adult')");
  report.navAtHome = await go(send, base + "/kingdom-map");
  report.atHome = await ev(send, AUDIT);
  await shot(send, "at-home");
  report.navAtPlay = await go(send, base + "/free-play");
  await sleep(2000);
  await ev(send, "void([...document.querySelectorAll('button,a')].find((e)=>/Medium/.test(e.innerText||''))?.click())");
  await sleep(8000);
  report.atPlay = await ev(send, AUDIT);
  await shot(send, "at-play");
  report.navAtPuz = await go(send, base + "/puzzles?id=lichess-iYtIh&daily=1");
  report.atPuz = await ev(send, AUDIT);
  await shot(send, "at-puz");
  report.navAtLearn = await go(send, base + "/chess-school/classroom");
  report.atLearn = await ev(send, AUDIT);
  await shot(send, "at-learn");

  await ev(send, "localStorage.removeItem('chessmind-mode')");
  fs.writeFileSync(path.join(outDir, "lenovo2.json"), JSON.stringify(report, null, 2));
  console.log("written lenovo2.json");
  ws.close();
})().catch((e) => { console.error(e); process.exit(1); });

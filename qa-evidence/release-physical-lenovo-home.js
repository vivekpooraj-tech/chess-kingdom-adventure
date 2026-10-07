const WebSocket = require("ws");
const http = require("http");
const fs = require("fs");
const path = require("path");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function json(url) {
  return new Promise((res, rej) => {
    http.get(url, (r) => { let d = ""; r.on("data", (c) => (d += c)); r.on("end", () => res(JSON.parse(d))); }).on("error", rej);
  });
}
(async () => {
  const pages = await json("http://127.0.0.1:9223/json");
  const page = pages.find((p) => p.type === "page" && /localhost:3000/.test(p.url));
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
  const ev = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    return r.result && r.result.value;
  };
  const shot = async (name) => {
    const r = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join("qa-evidence/release-physical", name + ".png"), Buffer.from(r.data, "base64"));
  };
  await send("Runtime.enable");
  await send("Page.enable");
  await ev("localStorage.removeItem('chessmind-mode')");
  await send("Page.navigate", { url: "http://localhost:3000/kingdom-map" });
  let found = false;
  for (let i = 0; i < 45; i++) {
    await sleep(1000);
    const t = await ev("document.body && document.body.innerText");
    if (typeof t === "string" && /PLAY NOW|Play now|Classic Pro/i.test(t)) { found = true; break; }
  }
  const audit = await ev(`({
    href: location.pathname,
    vw: innerWidth, vh: innerHeight,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    world: document.querySelector('[data-world]') && document.querySelector('[data-world]').dataset.world,
    h1: document.querySelector('h1') && document.querySelector('h1').textContent,
    body: (document.body.innerText || '').replace(/\\s+/g,' ').slice(0,600),
    hasPlay: /PLAY NOW|Play now/i.test(document.body.innerText),
    hasDeck: /Command deck/i.test(document.body.innerText),
    hasCareer: /Career ledger/i.test(document.body.innerText),
    hasSalon: /Grandmaster salon|Chess Mind Premium/i.test(document.body.innerText),
    hasDuels: /Recent duels/i.test(document.body.innerText)
  })`);
  await shot("lenovo2-home-ready");
  await ev("window.scrollTo(0, document.body.scrollHeight)");
  await sleep(800);
  await shot("lenovo2-home-ready-bottom");
  console.log(JSON.stringify({ found, audit }, null, 2));
  ws.close();
})().catch((e) => { console.error(e); process.exit(1); });

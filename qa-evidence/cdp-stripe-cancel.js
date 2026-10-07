const WebSocket = require("ws");
const http = require("http");
const port = Number(process.env.CDP_PORT || 9224);
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

(async () => {
  const pages = await json(`http://127.0.0.1:${port}/json`);
  const page = pages.find((p) => p.type === "page" && /checkout\.stripe\.com/.test(p.url));
  if (!page) throw new Error("no stripe checkout tab");
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
  const ev = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.value;

  await send("Runtime.enable");
  const t0 = Date.now();
  let before;
  while (Date.now() - t0 < 30000) {
    before = await ev(`(() => {
      const back = [...document.querySelectorAll('a[href]')].find((a) => /\\/chess-school\\/classroom/.test(a.href));
      const body = document.body ? document.body.innerText : '';
      return { url: location.host + location.pathname.slice(0, 30), cancelHref: back ? back.href : null, testMode: /test mode|sandbox/i.test(body), price: (body.match(/[$\\u20b9]\\s?\\d+(\\.\\d\\d)?/) || [null])[0] };
    })()`);
    if (before.cancelHref) break;
    await sleep(1000);
  }
  const out = { stripe: before };
  if (before.cancelHref) {
    await ev(`[...document.querySelectorAll('a[href]')].find((a) => /\\/chess-school\\/classroom/.test(a.href)).click()`);
    await sleep(Number(process.env.QA_AFTER || 15000));
    out.returned = await ev(`({ href: location.href, world: document.querySelector('[data-world]')?.getAttribute('data-world') || null, h1: document.querySelector('h1')?.textContent.trim() || null, kicker: document.querySelector('.world-kicker')?.textContent.trim() || null, overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth, runtimeError: /Application error|Unhandled Runtime Error/i.test(document.body.innerText) })`);
    const shot = await send("Page.captureScreenshot", { format: "png" });
    require("fs").writeFileSync(require("path").join(__dirname, "final-physical", `${process.env.QA_TAG || "dev"}-cancel-${process.env.QA_WORLD || "x"}.png`), Buffer.from(shot.data, "base64"));
  }
  console.log(JSON.stringify(out));
  ws.close();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });

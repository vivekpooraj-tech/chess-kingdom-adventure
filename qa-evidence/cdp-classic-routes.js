const WebSocket = require("ws");
const http = require("http");

const port = Number(process.env.CDP_PORT || 9222);
const urls = (process.env.QA_URLS || "").split(",").filter(Boolean);

function getPages() {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}/json`, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve(JSON.parse(data)));
    }).on("error", reject);
  });
}

function cdp(wsUrl, fn) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map();
    ws.on("open", async () => {
      try {
        resolve(await fn((method, params = {}) => {
          const msgId = ++id;
          return new Promise((res, rej) => {
            pending.set(msgId, { res, rej });
            ws.send(JSON.stringify({ id: msgId, method, params }));
          });
        }));
      } catch (e) {
        reject(e);
      } finally {
        ws.close();
      }
    });
    ws.on("message", (raw) => {
      const msg = JSON.parse(raw);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) rej(new Error(msg.error.message));
        else res(msg.result);
      }
    });
    ws.on("error", reject);
  });
}

async function evalText(send, expr) {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
  return r.result?.value;
}

(async () => {
  const pages = await getPages();
  const page = pages.find((p) => p.type === "page") || pages[0];
  const out = await cdp(page.webSocketDebuggerUrl, async (send) => {
    await send("Runtime.enable");
    await send("Page.enable");
    const results = [];
    for (const url of urls) {
      await send("Page.navigate", { url });
      await new Promise((r) => setTimeout(r, 3500));
      const info = await evalText(send, `({href:location.href,title:document.title,text:(document.body.innerText||'').slice(0,240),ok:!/This page could not be found|Application error/i.test(document.body.innerText||'')})`);
      results.push(info);
    }
    return results;
  });
  console.log(JSON.stringify(out, null, 2));
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });

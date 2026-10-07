const WebSocket = require("ws");
const http = require("http");
const port = Number(process.env.CDP_PORT || 9222);
const expr = process.env.QA_EXPR || "location.href";
const nav = process.env.QA_URL || "";

function getPages() {
  return new Promise((resolve, reject) => {
    http.get("http://127.0.0.1:" + port + "/json", (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve(JSON.parse(data)));
    }).on("error", reject);
  });
}

(async () => {
  const pages = await getPages();
  const page = pages.find((p) => p.type === "page") || pages[0];
  console.log("PAGE", page && page.url, page && page.title);
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  function send(method, params) {
    const msgId = ++id;
    return new Promise((res, rej) => {
      pending.set(msgId, { res, rej });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }
  ws.on("message", (raw) => {
    const msg = JSON.parse(raw);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) rej(new Error(JSON.stringify(msg.error)));
      else res(msg.result);
    }
  });
  await new Promise((r, j) => {
    ws.on("open", r);
    ws.on("error", j);
  });
  await send("Runtime.enable");
  await send("Page.enable");
  if (nav) {
    await send("Page.navigate", { url: nav });
    await new Promise((r) => setTimeout(r, Number(process.env.QA_WAIT || 4000)));
  }
  const emulateW = Number(process.env.QA_EMULATE_W || 0);
  const emulateH = Number(process.env.QA_EMULATE_H || 0);
  if (emulateW && emulateH) {
    await send("Emulation.setDeviceMetricsOverride", {
      width: emulateW,
      height: emulateH,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await new Promise((r) => setTimeout(r, 400));
  }
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  console.log(JSON.stringify(r, null, 2));
  ws.close();
})().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});

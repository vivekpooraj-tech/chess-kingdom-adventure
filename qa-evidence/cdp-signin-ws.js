const WebSocket = require("ws");
const http = require("http");

const email = "rajyam141502@gmail.com";
const password = "QaTest1234";
const port = Number(process.env.CDP_PORT || 9222);

function getPages() {
  return new Promise((resolve, reject) => {
    http
      .get(`http://127.0.0.1:${port}/json`, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve(JSON.parse(data)));
      })
      .on("error", reject);
  });
}

function cdp(wsUrl, fn) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map();
    ws.on("open", async () => {
      try {
        const result = await fn((method, params = {}) => {
          const msgId = ++id;
          return new Promise((res, rej) => {
            pending.set(msgId, { res, rej });
            ws.send(JSON.stringify({ id: msgId, method, params }));
          });
        });
        resolve(result);
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

(async () => {
  const pages = await getPages();
  const page = pages.find((p) => p.type === "page");
  if (!page) throw new Error("NO_PAGE");
  const out = await cdp(page.webSocketDebuggerUrl, async (send) => {
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Page.navigate", { url: "http://localhost:3000/sign-in" });
    await new Promise((r) => setTimeout(r, 3000));
    const submit = await send("Runtime.evaluate", {
      expression: `
        (function() {
          const emailEl = document.querySelector('#email');
          const passwordEl = document.querySelector('#password');
          const btn = document.querySelector('button[type="submit"]');
          if (!emailEl || !passwordEl || !btn) return 'MISSING_ELEMENTS';
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          nativeInputValueSetter.call(emailEl, ${JSON.stringify(email)});
          emailEl.dispatchEvent(new Event('input', { bubbles: true }));
          nativeInputValueSetter.call(passwordEl, ${JSON.stringify(password)});
          passwordEl.dispatchEvent(new Event('input', { bubbles: true }));
          btn.disabled = false;
          btn.click();
          return 'SUBMITTED';
        })()
      `,
      returnByValue: true,
    });
    await new Promise((r) => setTimeout(r, 12000));
    const url = await send("Runtime.evaluate", {
      expression: "window.location.href",
      returnByValue: true,
    });
    const h1 = await send("Runtime.evaluate", {
      expression: "document.querySelector('h1')?.textContent || document.body.innerText.slice(0,200)",
      returnByValue: true,
    });
    return {
      submit: submit.result?.value,
      url: url.result?.value,
      h1: h1.result?.value,
    };
  });
  console.log(JSON.stringify(out, null, 2));
})().catch((err) => {
  console.error("ERR", err.message);
  process.exit(1);
});

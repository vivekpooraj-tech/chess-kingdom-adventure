const WebSocket = require("ws");
const http = require("http");
const fs = require("fs");
const path = require("path");

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

async function evalText(send, expr) {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
  return r.result?.value ?? "";
}

(async () => {
  const pages = await getPages();
  const page = pages.find((p) => p.type === "page");
  if (!page) throw new Error("NO_PAGE");

  const report = await cdp(page.webSocketDebuggerUrl, async (send) => {
    await send("Page.enable");
    await send("Runtime.enable");
    const readyChildId = "556bdac3-568c-45f2-ac64-6f41dbe8910a";
    let url = await evalText(send, "location.href");
    if (!url.includes("/sign-in") && !url.includes("/kingdom-map")) {
      await send("Page.navigate", { url: "http://localhost:3000/sign-in" });
      await new Promise((r) => setTimeout(r, 3000));
    }
    url = await evalText(send, "location.href");
    if (url.includes("/sign-in")) {
      await evalText(
        send,
        `(function(){const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;const e=document.querySelector('#email');const p=document.querySelector('#password');const b=document.querySelector('button[type=submit]');s.call(e,'${email}');e.dispatchEvent(new Event('input',{bubbles:true}));s.call(p,'${password}');p.dispatchEvent(new Event('input',{bubbles:true}));b.disabled=false;b.click();return 'ok';})()`
      );
      await new Promise((r) => setTimeout(r, 10000));
    }
    await evalText(
      send,
      `(function(){
        document.cookie = 'cka_active_child=; path=/; max-age=0; SameSite=Lax';
        document.cookie = 'cka_active_child=${readyChildId}; path=/; max-age=31536000; SameSite=Lax';
        return 'ok';
      })()`
    );
    await send("Page.navigate", { url: "http://localhost:3000/kingdom-map" });
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const ready = await evalText(
        send,
        "document.body.innerText.includes('Chess Mind') || document.body.innerText.includes('What should we do')"
      );
      if (ready === true) break;
    }
    await evalText(send, "window.scrollTo(0, 0)");
    await new Promise((r) => setTimeout(r, 1000));
    url = await evalText(send, "location.href");

    const checks = {};
    const bodyText = await evalText(send, "document.body.innerText");
    checks.url = url;
    checks.hasChessMindTitle = /Chess Mind/i.test(bodyText);
    checks.hasPlay = /\bPlay\b/.test(bodyText);
    checks.hasPuzzles = /\bPuzzles\b/.test(bodyText);
    checks.hasWorld = /\bWorld\b/.test(bodyText);
    checks.hasLearn = /\bLearn\b/.test(bodyText);
    checks.hasToday = /\bTODAY\b/i.test(bodyText);
    checks.screenTimeBlocked = /Today's chess time is complete/i.test(bodyText);
    checks.hasDiscover = /\bDISCOVER\b/i.test(bodyText);
    checks.hasTrainYourMind = /Train Your Mind/i.test(bodyText);
    checks.hasProgress = /Your Progress/i.test(bodyText);
    checks.hasAchievements = /Achievements/i.test(bodyText);
    checks.hasSeeAll = /See all/i.test(bodyText);
    checks.hasForParents = /For Parents/i.test(bodyText);
    checks.hasOllie = /Ollie|owl|🦉/i.test(bodyText);
    checks.hasChessSchool = /Chess School/i.test(bodyText);
    checks.bodySnippet = bodyText.slice(0, 1200);
    checks.scrollHeight = await evalText(send, "document.documentElement.scrollHeight");
    checks.clientHeight = await evalText(send, "document.documentElement.clientHeight");
    checks.scrollWidth = await evalText(send, "document.documentElement.scrollWidth");
    checks.clientWidth = await evalText(send, "document.documentElement.clientWidth");

    // Scroll to bottom and re-check
    await evalText(send, "window.scrollTo(0, document.body.scrollHeight)");
    await new Promise((r) => setTimeout(r, 1500));
    const bottomText = await evalText(send, "document.body.innerText");
    checks.bottomHasForParents = /For Parents/i.test(bottomText);
    checks.bottomHasAchievements = /Achievements/i.test(bottomText);

    return checks;
  });

  const outFile = process.env.QA_REPORT_FILE;
  if (outFile) fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
})().catch((err) => {
  console.error("ERR", err.message);
  process.exit(1);
});

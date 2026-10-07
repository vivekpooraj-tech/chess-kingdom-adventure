const WebSocket = require("ws");
const http = require("http");

const port = Number(process.env.CDP_PORT || 9222);
const target = process.env.QA_URL || "";
const clickText = process.env.QA_CLICK_TEXT || "";
const waitMs = Number(process.env.QA_WAIT || 7000);

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
        resolve(
          await fn((method, params = {}) => {
            const msgId = ++id;
            return new Promise((res, rej) => {
              pending.set(msgId, { res, rej });
              ws.send(JSON.stringify({ id: msgId, method, params }));
            });
          })
        );
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

async function evalText(send, expr, awaitPromise = false) {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || "eval error");
  return r.result?.value;
}

const REPORT = `(() => {
  const q = (s) => !!document.querySelector(s);
  const cta = [...document.querySelectorAll('.world-cta')].find((el) => el.getBoundingClientRect().height > 0);
  const exit = document.querySelector('[aria-label="Exit session"]');
  const body = document.body.innerText || "";
  const ctaAll = [...document.querySelectorAll('.world-cta')].map((el) => {
    const r = el.getBoundingClientRect();
    return { t: (el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 60), h: Math.round(r.height) };
  });
  return {
    href: location.href,
    world: document.querySelector("[data-world]")?.getAttribute("data-world"),
    vw: innerWidth,
    vh: innerHeight,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    h1: document.querySelector("h1")?.textContent || "",
    kicker: (document.querySelector(".world-kicker") || {}).textContent || "",
    journey: q(".sch-journey"),
    path: q(".sch-path"),
    trail: q(".sch-trail"),
    academy: q(".sch-academy"),
    curriculum: q(".sch-curriculum"),
    study: q(".sch-study"),
    sheet: q(".sch-sheet"),
    syllabus: q(".sch-syllabus"),
    diagram: q(".sch-diagram"),
    of30: /of 30 sessions/i.test(body),
    ollie: /🦉|Welcome back|You've got this|Today we learn/.test(body),
    paywall: /Lifetime Access|Session 4 is waiting/.test(body),
    parent: /For parents/.test(body),
    grad: /Graduation Day/.test(body),
    hasNext: /\\bNext\\b/.test(body),
    step: (body.match(/(\\d+) of (\\d+)/) || [])[0] || null,
    ctaH: cta ? Math.round(cta.getBoundingClientRect().height) : null,
    ctaT: cta ? (cta.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 80) : null,
    ctaAll,
    exitH: exit ? Math.round(exit.getBoundingClientRect().height) : null,
    exitHref: exit ? exit.getAttribute("href") : null,
    speech: /Listen|Speak|Voice|Read aloud/i.test(body),
    snippet: body.slice(0, 700)
  };
})()`;

(async () => {
  const pages = await getPages();
  const page = pages.find((p) => p.type === "page") || pages[0];
  if (!page) throw new Error("NO_PAGE");
  const report = await cdp(page.webSocketDebuggerUrl, async (send) => {
    await send("Runtime.enable");
    await send("Page.enable");
    if (target && process.env.QA_NAV !== "0") {
      await send("Page.navigate", { url: target });
      await new Promise((r) => setTimeout(r, waitMs));
    }
    await evalText(
      send,
      `new Promise((resolve) => {
        const start = Date.now();
        const tick = () => {
          const ready = document.querySelector('.sch-home, .sch-session, .world-cta') || /Lifetime Access|Session \\d+/.test(document.body.innerText||'');
          if (ready || Date.now() - start > 14000) resolve(true);
          else setTimeout(tick, 300);
        };
        tick();
      })`,
      true
    );
    if (clickText) {
      const clicked = await evalText(
        send,
        `(function(){
          const want=${JSON.stringify(clickText)};
          const el=[...document.querySelectorAll('a,button')].find(e => (e.textContent||'').replace(/\\s+/g,' ').includes(want));
          if(!el) return 'missing';
          el.click();
          return 'clicked:'+want;
        })()`
      );
      await new Promise((r) => setTimeout(r, Number(process.env.QA_AFTER_CLICK || 2500)));
      const after = await evalText(send, REPORT);
      after._click = clicked;
      return after;
    }
    return evalText(send, REPORT);
  });
  console.log(JSON.stringify(report, null, 2));
})().catch((err) => {
  console.error("ERR", err.message);
  process.exit(1);
});

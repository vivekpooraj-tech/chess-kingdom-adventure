const WebSocket = require("ws");
const http = require("http");

const port = Number(process.env.CDP_PORT || 9222);
const target = process.env.QA_URL || "http://localhost:3000/chess-school/classroom?world=classic";
const clickSel = process.env.QA_CLICK || "";
const clickText = process.env.QA_CLICK_TEXT || "";
const waitMs = Number(process.env.QA_WAIT || 8000);

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

async function evalText(send, expr) {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || "eval error");
  return r.result?.value;
}

(async () => {
  const pages = await getPages();
  const page = pages.find((p) => p.type === "page") || pages[0];
  if (!page) throw new Error("NO_PAGE");

  const report = await cdp(page.webSocketDebuggerUrl, async (send) => {
    await send("Runtime.enable");
    await send("Page.enable");
    if (process.env.QA_NAV !== "0") {
      await send("Page.navigate", { url: target });
      await new Promise((r) => setTimeout(r, waitMs));
    }
    for (let i = 0; i < 20; i++) {
      const ready = await evalText(
        send,
        "!!document.querySelector('[data-world]') || /Syllabus|Chess School|Training Atelier|Session/i.test(document.body.innerText||'')"
      );
      if (ready) break;
      await new Promise((r) => setTimeout(r, 400));
    }
    if (clickSel) {
      await evalText(
        send,
        `(function(){const el=document.querySelector(${JSON.stringify(clickSel)}); if(!el) return 'missing'; el.click(); return 'clicked';})()`
      );
      await new Promise((r) => setTimeout(r, 2200));
    }
    if (clickText) {
      await evalText(
        send,
        `(function(){
          const want=${JSON.stringify(clickText)};
          const el=[...document.querySelectorAll('a,button')].find(e => (e.textContent||'').replace(/\\s+/g,' ').includes(want));
          if(!el) return 'missing';
          el.click();
          return 'clicked';
        })()`
      );
      await new Promise((r) => setTimeout(r, 2200));
    }
    return evalText(
      send,
      `(() => {
        const root = document.querySelector('[data-world]') || document.documentElement;
        const cs = getComputedStyle(root);
        const rgb = (el, prop) => el ? getComputedStyle(el)[prop] : null;
        const cta = document.querySelector('.world-cta');
        const exit = document.querySelector('[aria-label="Exit session"]');
        const board = document.querySelector('[class*="board"], .cg-wrap, chess-board, [aria-label*="board" i]');
        const body = document.body.innerText || '';
        return {
          href: location.href,
          world: root.getAttribute('data-world'),
          vw: innerWidth,
          vh: innerHeight,
          overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          midnight: cs.getPropertyValue('--cm-midnight').trim(),
          forest: cs.getPropertyValue('--world-forest').trim(),
          burgundy: cs.getPropertyValue('--world-burgundy').trim(),
          teal: cs.getPropertyValue('--world-teal').trim(),
          purple: cs.getPropertyValue('--world-purple').trim(),
          crimson: cs.getPropertyValue('--world-crimson').trim(),
          copper: cs.getPropertyValue('--world-copper').trim(),
          gold: cs.getPropertyValue('--cm-gold').trim(),
          cssCount: document.styleSheets.length,
          cssHrefs: [...document.querySelectorAll('link[rel=stylesheet]')].map(l => l.href).slice(0,8),
          kicker: (document.querySelector('.world-kicker')||{}).textContent,
          ctaText: cta ? (cta.textContent||'').replace(/\\s+/g,' ').trim().slice(0,80) : null,
          ctaH: cta ? Math.round(cta.getBoundingClientRect().height) : null,
          ctaBg: cta ? rgb(cta, 'backgroundColor') : null,
          exitH: exit ? Math.round(exit.getBoundingClientRect().height) : null,
          hasBoard: !!board || /a8|Sixty-four|Next/i.test(body),
          hasPaywall: /Session \\d+ is waiting|Lifetime Access/i.test(body),
          hasOllie: /Ollie|🦉/.test(body),
          hasOf30: /of 30 sessions/i.test(body),
          hasSyllabus: /The Syllabus/i.test(body),
          hasChessSchool: /Chess School/i.test(body),
          hasTrainingAtelier: /Training Atelier/i.test(body),
          hasNext: /\\bNext\\b|Got it|Continue/i.test(body),
          snippet: body.slice(0, 900)
        };
      })()`
    );
  });
  console.log(JSON.stringify(report, null, 2));
})().catch((err) => {
  console.error("ERR", err.message);
  process.exit(1);
});

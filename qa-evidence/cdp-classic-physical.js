const WebSocket = require("ws");
const http = require("http");

const port = Number(process.env.CDP_PORT || 9222);
const target = process.env.QA_URL || "http://localhost:3000/kingdom-map?world=classic";
const clickSel = process.env.QA_CLICK || "";
const waitMs = Number(process.env.QA_WAIT || 2500);

function getPages() {
  return new Promise((resolve, reject) => {
    http
      .get(`http://127.0.0.1:${port}/json`, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
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
  const r = await send("Runtime.evaluate", {
    expression: expr,
    returnByValue: true,
    awaitPromise: false,
  });
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.text || "eval error");
  }
  return r.result?.value;
}

(async () => {
  const pages = await getPages();
  const page = pages.find((p) => p.type === "page") || pages[0];
  if (!page) throw new Error("NO_PAGE " + JSON.stringify(pages).slice(0, 400));

  const report = await cdp(page.webSocketDebuggerUrl, async (send) => {
    await send("Runtime.enable");
    await send("Page.enable");
    if (process.env.QA_NAV !== "0") {
      await send("Page.navigate", { url: target });
      await new Promise((r) => setTimeout(r, waitMs));
    }
    for (let i = 0; i < 15; i++) {
      const ready = await evalText(
        send,
        "!!document.querySelector('[data-world]') || document.body.innerText.includes('Chess Mind')"
      );
      if (ready) break;
      await new Promise((r) => setTimeout(r, 400));
    }
    if (clickSel) {
      await evalText(
        send,
        `(function(){const el=document.querySelector(${JSON.stringify(clickSel)}); if(!el) return 'missing'; el.click(); return 'clicked';})()`
      );
      await new Promise((r) => setTimeout(r, 1800));
    }
    return evalText(
      send,
      `(() => {
        const root = document.querySelector('[data-world]') || document.documentElement;
        const cs = getComputedStyle(root);
        const rgb = (el, prop) => el ? getComputedStyle(el)[prop] : null;
        const cta = document.querySelector('.world-cta, a[href*="chess-school"], a[href*="session"]');
        const ctas = [...document.querySelectorAll('a,button')].filter(el => /continue|play chess|study/i.test(el.textContent||''));
        const primary = ctas[0] || document.querySelector('.world-cta');
        const tiles = [...document.querySelectorAll('a')].map(a => ({
          text: (a.textContent||'').replace(/\\s+/g,' ').trim().slice(0,40),
          href: a.getAttribute('href'),
          h: Math.round(a.getBoundingClientRect().height)
        })).filter(t => /Play|Training|Games|Analysis|Syllabus|Continue|Achievements/i.test(t.text));
        const body = (document.body.innerText||'').slice(0,1800);
        return {
          href: location.href,
          world: root.getAttribute('data-world'),
          vw: innerWidth,
          vh: innerHeight,
          dpr: devicePixelRatio,
          clientW: document.documentElement.clientWidth,
          scrollW: document.documentElement.scrollWidth,
          overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          overflowBody: document.body.scrollWidth - document.body.clientWidth,
          midnight: cs.getPropertyValue('--cm-midnight').trim(),
          forest: cs.getPropertyValue('--world-forest').trim(),
          burgundy: cs.getPropertyValue('--world-burgundy').trim(),
          teal: cs.getPropertyValue('--world-teal').trim(),
          purple: cs.getPropertyValue('--world-purple').trim(),
          crimson: cs.getPropertyValue('--world-crimson').trim(),
          copper: cs.getPropertyValue('--world-copper').trim(),
          gold: cs.getPropertyValue('--world-gold').trim(),
          bg: rgb(document.body, 'backgroundColor'),
          rootColor: rgb(root, 'color'),
          ctaH: primary ? Math.round(primary.getBoundingClientRect().height) : null,
          ctaText: primary ? (primary.textContent||'').trim().slice(0,40) : null,
          ctaBg: primary ? rgb(primary, 'backgroundColor') : null,
          ctaHref: primary ? primary.getAttribute('href') : null,
          tiles,
          kickers: [...document.querySelectorAll('.world-kicker, [class*="kicker"]')].map(e => (e.textContent||'').trim()),
          hasClassicPro: /Classic Pro/i.test(body),
          hasEnchanted: /Enchanted/i.test(body),
          hasAtelier: /Atelier/i.test(body),
          hasStudy: /STUDY/i.test(body),
          hasClub: /The Club|Club/i.test(body),
          hasRecord: /Record/i.test(body),
          hasAchievements: /Achievements|Milestone/i.test(body),
          hasPlay: /\\bPlay\\b/.test(body),
          hasTraining: /Training/.test(body),
          hasGames: /Games/.test(body),
          hasAnalysis: /Analysis/.test(body),
          snippet: body
        };
      })()`
    );
  });

  console.log(JSON.stringify(report, null, 2));
})().catch((err) => {
  console.error("ERR", err.message);
  process.exit(1);
});

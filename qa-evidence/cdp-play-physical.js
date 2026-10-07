const WebSocket = require("ws");
const http = require("http");

const port = Number(process.env.CDP_PORT || 9222);
const target = process.env.QA_URL;
const waitMs = Number(process.env.QA_WAIT || 7000);
const clickText = process.env.QA_CLICK_TEXT || "";
const move = process.env.QA_MOVE === "1";

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
  if (r.exceptionDetails) {
    const d = r.exceptionDetails;
    throw new Error(
      (d.exception && d.exception.description) ||
        d.text ||
        JSON.stringify({ line: d.lineNumber, col: d.columnNumber, url: d.url }).slice(0, 500)
    );
  }
  return r.result?.value;
}

(async () => {
  if (!target) throw new Error("QA_URL required");
  const pages = await getPages();
  const page = pages.find((p) => p.type === "page") || pages[0];
  if (!page) throw new Error("NO_PAGE");

  const report = await cdp(page.webSocketDebuggerUrl, async (send) => {
    await send("Runtime.enable");
    await send("Page.enable");
    await send("Page.navigate", { url: target });
    await new Promise((r) => setTimeout(r, waitMs));

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
      await new Promise((r) => setTimeout(r, 4500));
    }

    if (move) {
      await evalText(
        send,
        `(function(){
          function tap(sel){
            const el=document.querySelector(sel);
            if(!el) return false;
            const r=el.getBoundingClientRect();
            const x=r.left+r.width/2, y=r.top+r.height/2;
            for (const type of ['pointerdown','mousedown','pointerup','mouseup','click']) {
              el.dispatchEvent(new PointerEvent(type,{bubbles:true,clientX:x,clientY:y,pointerId:1,pointerType:'touch'}));
            }
            return true;
          }
          const e2=document.querySelector('[data-square="e2"], cg-board square[data-key="e2"], .square-e2');
          const from = e2 || [...document.querySelectorAll('[data-square], [data-key]')].find(n => (n.getAttribute('data-square')||n.getAttribute('data-key'))==='e2');
          const toEl = document.querySelector('[data-square="e4"], [data-key="e4"], .square-e4');
          return { from: !!from, to: !!toEl, html: document.querySelector('cg-board') ? 'cg' : (document.querySelector('.board-outer')?'outer':'none') };
        })()`
      );
    }

    return evalText(
      send,
      `(() => {
        const root = document.querySelector('[data-world]') || document.documentElement;
        const board = document.querySelector('.board-outer, cg-wrap, [class*="board"]');
        const br = board ? board.getBoundingClientRect() : null;
        const exit = document.querySelector('[aria-label="Exit"]');
        const meta = document.querySelector('.play-meta');
        const path = document.querySelector('.play-path');
        const grid = document.querySelector('.play-grid');
        const mast = document.querySelector('.play-masthead');
        const ollie = document.querySelector('.play-ollie');
        const stars = document.querySelector('.play-stars');
        const coach = document.querySelector('.play-panel--atelier');
        const sheet = document.querySelector('.play-panel--classic');
        const quest = document.querySelector('.play-panel--enchanted');
        const overflowX = document.documentElement.scrollWidth - document.documentElement.clientWidth;
        const headerBtn = document.querySelector('.chess-focus-header > button');
        const body = (document.body.innerText||'').replace(/\\s+/g,' ').slice(0,1200);
        const squares = [...document.querySelectorAll('[data-square],[data-key],cg-board piece')].slice(0,4).map(n => n.outerHTML.slice(0,80));
        return {
          href: location.href,
          world: root.getAttribute('data-world'),
          vw: innerWidth,
          vh: innerHeight,
          overflowX,
          hasMeta: !!meta,
          metaClass: meta ? meta.className : null,
          hasPath: !!path,
          hasGrid: !!grid,
          hasMasthead: !!mast,
          hasOllie: !!ollie,
          hasStars: !!stars,
          hasCoach: !!coach,
          hasSheet: !!sheet,
          hasQuest: !!quest,
          hasBoard: !!board,
          boardW: br ? Math.round(br.width) : null,
          boardH: br ? Math.round(br.height) : null,
          boardTop: br ? Math.round(br.top) : null,
          exitH: exit ? Math.round(exit.getBoundingClientRect().height) : null,
          headerBtnH: headerBtn ? Math.round(headerBtn.getBoundingClientRect().height) : null,
          picking: /Very Easy|Easy|Medium|Hard/.test(body) && !board,
          snippet: body,
          squares
        };
      })()`
    );
  });
  console.log(JSON.stringify(report, null, 2));
})().catch((err) => {
  console.error("ERR", err.message);
  process.exit(1);
});

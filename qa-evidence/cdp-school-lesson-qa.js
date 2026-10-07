const WebSocket = require("ws");
const http = require("http");
const fs = require("fs");

const readyChildId = "556bdac3-568c-45f2-ac64-6f41dbe8910a";
const port = Number(process.env.CDP_PORT || 9222);
const base = "http://localhost:3000";

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
  return r.result?.value ?? "";
}

async function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function clickAdvance(send) {
  return await evalText(
    send,
    `(function(){
      const btns = Array.from(document.querySelectorAll('button'));
      const labels = ['Got it', "let's try", 'Continue', 'Next'];
      const btn = btns.find(b => {
        const t = (b.innerText||'').trim();
        return labels.some(l => t.includes(l));
      });
      if (!btn) return 'NO_BUTTON:' + btns.map(b => (b.innerText||'').trim()).slice(0,5).join('|');
      btn.click();
      return 'CLICKED:' + (btn.innerText||'').trim().slice(0,40);
    })()`
  );
}

(async () => {
  const pages = await getPages();
  const page = pages.find((p) => p.type === "page");
  if (!page) throw new Error("NO_PAGE");

  const report = await cdp(page.webSocketDebuggerUrl, async (send) => {
    await send("Page.enable");
    await send("Runtime.enable");
    await evalText(
      send,
      `document.cookie='cka_active_child=${readyChildId}; path=/; max-age=31536000; SameSite=Lax'`
    );
    await send("Page.navigate", { url: `${base}/chess-school/session/s01-welcome` });
    await wait(8000);

    const steps = [];
    for (let i = 0; i < 25; i++) {
      const body = await evalText(send, "document.body.innerText");
      const url = await evalText(send, "location.href");
      const board = await evalText(send, "document.querySelector('[class*=board], [data-board], canvas, svg') ? 'board-present' : 'no-board'");
      const layout = await evalText(
        send,
        `JSON.stringify({w: document.documentElement.clientWidth, h: document.documentElement.clientHeight, dataLayout: document.documentElement.getAttribute('data-layout')})`
      );
      const pieceMatch = ["Pawn", "Rook", "Knight", "Bishop", "Queen", "King"].find((p) => body.includes(p));
      steps.push({ step: i + 1, url, board, layout, pieceMatch: pieceMatch || null, snippet: body.slice(0, 350) });
      const click = await clickAdvance(send);
      if (click.startsWith("NO_BUTTON")) break;
      await wait(2500);
    }

    const finalBody = await evalText(send, "document.body.innerText");
    const pieces = ["Pawn", "Rook", "Knight", "Bishop", "Queen", "King"];
    const allText = steps.map((s) => s.snippet).join("\n") + finalBody;
    return {
      steps,
      pieceMentions: pieces.map((p) => ({ piece: p, found: allText.includes(p) })),
      finalUrl: await evalText(send, "location.href"),
    };
  });

  const outFile = process.env.QA_REPORT_FILE;
  if (outFile) fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
})().catch((err) => {
  console.error("ERR", err.message);
  process.exit(1);
});

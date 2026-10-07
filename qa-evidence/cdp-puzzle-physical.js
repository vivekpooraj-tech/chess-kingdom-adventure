const WebSocket = require("ws");
const http = require("http");
const { Chess } = require("chess.js");

const port = Number(process.env.CDP_PORT || 9222);
const target = process.env.QA_URL;
const waitMs = Number(process.env.QA_WAIT || 8000);
const startPuzzle = process.env.QA_START === "1";
const trySolve = process.env.QA_SOLVE === "1";
const tryWrong = process.env.QA_WRONG === "1";
const clickNext = process.env.QA_NEXT === "1";

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
  const r = await send("Runtime.evaluate", {
    expression: expr,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) {
    const d = r.exceptionDetails;
    throw new Error((d.exception && d.exception.description) || d.text || "eval");
  }
  return r.result?.value;
}

const INSPECT = `(() => {
  const root = document.querySelector("[data-world]") || document.documentElement;
  const board = document.querySelector(".board-outer");
  const br = board ? board.getBoundingClientRect() : null;
  const exit = document.querySelector('[aria-label="Exit"]');
  const body = (document.body.innerText || "").replace(/\\s+/g, " ");
  const squares = [...document.querySelectorAll("[data-square]")].map((el) => ({
    sq: el.getAttribute("data-square"),
    label: el.getAttribute("aria-label") || "",
  }));
  return {
    href: location.href,
    world: root.getAttribute("data-world"),
    vw: innerWidth,
    vh: innerHeight,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    hasTower: /Kingdom Chambers|Puzzle Tower|Puzzle Quest/.test(body) && !board,
    hasGrid: !!document.querySelector(".pz-grid"),
    hasPath: !!document.querySelector(".pz-path"),
    hasMast: !!document.querySelector(".pz-masthead"),
    hasOllie: !!document.querySelector(".pz-ollie"),
    hasStars: !!document.querySelector(".pz-stars"),
    hasCoach: !!document.querySelector(".pz-panel--atelier"),
    hasSheet: !!document.querySelector(".pz-panel--classic"),
    hasBoard: !!board,
    boardW: br ? Math.round(br.width) : null,
    boardH: br ? Math.round(br.height) : null,
    exitH: exit ? Math.round(exit.getBoundingClientRect().height) : null,
    quota: (body.match(/(\\d+) of (\\d+) free puzzles/) || [])[0] || null,
    streak: (body.match(/STREAK \\d+/) || [])[0] || null,
    accuracy: (body.match(/ACCURACY [^ ]+/) || [])[0] || null,
    time: (body.match(/TIME [\\d:—-]+/) || [])[0] || null,
    starsOn: [...document.querySelectorAll(".pz-stars [data-on='true']")].length,
    snippet: body.slice(0, 900),
    squares
  };
})()`;

function fenFromSquares(squares, side) {
  const map = { p: "p", n: "n", b: "b", r: "r", q: "q", k: "k" };
  const files = "abcdefgh";
  const grid = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (const s of squares) {
    const m = /([a-h])([1-8])(?: — (white|black) ([prnbqk]))?/i.exec(s.label);
    if (!m) continue;
    const file = files.indexOf(m[1]);
    const rank = Number(m[2]) - 1;
    if (m[3] && m[4]) {
      const piece = map[m[4].toLowerCase()];
      grid[rank][file] = m[3].toLowerCase() === "white" ? piece.toUpperCase() : piece;
    }
  }
  const ranks = [];
  for (let r = 7; r >= 0; r--) {
    let row = "";
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      if (!grid[r][f]) empty++;
      else {
        if (empty) row += String(empty);
        empty = 0;
        row += grid[r][f];
      }
    }
    if (empty) row += String(empty);
    ranks.push(row);
  }
  return `${ranks.join("/")} ${side} - - 0 1`;
}

function findSoundFirst(fen, depth) {
  const game = new Chess(fen);
  for (const mv of game.moves({ verbose: true })) {
    const after = new Chess(fen);
    after.move(mv);
    if (depth <= 1) {
      if (after.isCheckmate()) return { from: mv.from, to: mv.to, san: mv.san };
      continue;
    }
    const replies = after.moves({ verbose: true });
    if (replies.length === 0) continue;
    let ok = true;
    for (const r of replies) {
      const next = new Chess(after.fen());
      next.move(r);
      if (!findSoundFirst(next.fen(), depth - 1)) {
        ok = false;
        break;
      }
    }
    if (ok) return { from: mv.from, to: mv.to, san: mv.san };
  }
  return null;
}

function findMateInOne(fen) {
  return findSoundFirst(fen, 1);
}

function findNonMate(fen) {
  const game = new Chess(fen);
  for (const mv of game.moves({ verbose: true })) {
    const g = new Chess(fen);
    g.move(mv);
    if (!g.isCheckmate()) return { from: mv.from, to: mv.to, san: mv.san };
  }
  return null;
}

(async () => {
  if (!target) throw new Error("QA_URL required");
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
    for (let i = 0; i < 25; i++) {
      const ready = await evalText(
        send,
        "!!document.querySelector('[data-world], .puzzle-quest-hub, .chess-focus-shell, .pz-meta')"
      );
      if (ready) break;
      await new Promise((r) => setTimeout(r, 400));
    }

    if (startPuzzle) {
      await evalText(
        send,
        `(function(){
          const el=[...document.querySelectorAll("button")].find(b => /Solve a Puzzle/i.test(b.textContent||""));
          if(!el) return "missing";
          el.click();
          return "clicked";
        })()`
      );
      await new Promise((r) => setTimeout(r, 5000));
    }

    const before = await evalText(send, INSPECT);
    const stm = /Black to move/i.test(before.snippet) ? "b" : "w";
    const fen = fenFromSquares(before.squares || [], stm);
    let moveResult = null;

    async function play(from, to) {
      await evalText(
        send,
        `(async () => {
          function tap(sel){
            const el=document.querySelector(sel);
            if(!el) return false;
            const r=el.getBoundingClientRect();
            const x=r.left+r.width/2, y=r.top+r.height/2;
            for (const type of ["pointerdown","mousedown","pointerup","mouseup","click"]) {
              const C = type.startsWith("pointer") ? PointerEvent : MouseEvent;
              el.dispatchEvent(new C(type,{bubbles:true,cancelable:true,clientX:x,clientY:y,pointerId:1,pointerType:"touch",buttons:1}));
            }
            return true;
          }
          tap('[data-square="${from}"]');
          await new Promise(r=>setTimeout(r,350));
          tap('[data-square="${to}"]');
          await new Promise(r=>setTimeout(r,1200));
          return true;
        })()`
      );
    }

    if (tryWrong && before.hasBoard) {
      const wrong = findNonMate(fen);
      if (wrong) {
        await play(wrong.from, wrong.to);
        const afterWrong = await evalText(send, INSPECT);
        await evalText(
          send,
          `(function(){
            const el=[...document.querySelectorAll("button")].find(b => /Try Again/i.test(b.textContent||""));
            if(el) el.click();
            return !!el;
          })()`
        );
        await new Promise((r) => setTimeout(r, 800));
        moveResult = { wrong, afterWrongSnippet: afterWrong.snippet.slice(0, 280), afterWrongQuota: afterWrong.quota };
      }
    }

    if (trySolve && before.hasBoard) {
      const depth = /finish it/i.test(before.snippet)
        ? 1
        : /checkmate in 3/i.test(before.snippet)
          ? 3
          : /checkmate in 2/i.test(before.snippet)
            ? 2
            : 1;
      const mate = findSoundFirst(fen, depth);
      if (mate) {
        await play(mate.from, mate.to);
        const after = await evalText(send, INSPECT);
        moveResult = { ...(moveResult || {}), mate, after };
      } else {
        moveResult = { ...(moveResult || {}), mate: null, reason: "not-mate-in-1" };
      }
    }

    if (clickNext) {
      await evalText(
        send,
        `(function(){
          const el=[...document.querySelectorAll("button")].find(b => /Next drill|Next Position|Continue quest|Next Puzzle/i.test(b.textContent||""));
          if(!el) return "missing";
          el.click();
          return el.textContent.trim();
        })()`
      );
      await new Promise((r) => setTimeout(r, 2500));
    }

    const afterAll = await evalText(send, INSPECT);
    return { before, fen, stm, moveResult, afterAll };
  });

  console.log(JSON.stringify(report, null, 2));
})().catch((err) => {
  console.error("ERR", err.message);
  process.exit(1);
});

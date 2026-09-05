/**
 * Minimal Stockfish driver for build/verification scripts. Node only.
 *
 * Exists because strategic exercises cannot be validated the way tactical ones
 * can. "This move gives check" is decidable with chess.js; "this move is the
 * right plan" is not. Rather than ship strategic claims on the author's say-so,
 * the Strategy and Endgame courses check their positions against the same
 * engine the app already ships (node_modules/stockfish), asserting that the
 * move a lesson teaches is one the engine also rates as best or near-best.
 *
 * Not used at runtime and not imported by any app code — build-time only.
 */
const path = require("path");

async function createEngine() {
  const sf = require(path.join(process.cwd(), "node_modules", "stockfish"));
  const engine = await sf();

  // The npm package builds its Emscripten module internally and exposes no
  // print hook, so engine output arrives on console.log. Intercepting it is the
  // only seam available. Build-time only — nothing in the app does this.
  const listeners = [];
  const realLog = console.log;
  console.log = (...args) => {
    const line = args.length === 1 && typeof args[0] === "string" ? args[0] : args.join(" ");
    if (typeof line === "string" && /^(info|bestmove|uciok|readyok|option |id )/.test(line)) {
      for (const fn of [...listeners]) fn(line);
      return;
    }
    realLog(...args);
  };

  function send(cmd) {
    engine.sendCommand(cmd);
  }

  /**
   * Analyse a position and return the engine's ranked moves.
   * Returns [{ move: "e2e4", cp }] best-first, where cp is from the side to
   * move's point of view (mate scores are mapped to a large centipawn value).
   */
  function analyse(fen, { depth = 12, multipv = 3 } = {}) {
    return new Promise((resolve) => {
      const scores = new Map();
      const onLine = (line) => {
        const mv = /\bmultipv (\d+)\b.*?\bscore (cp|mate) (-?\d+)\b.*?\bpv (\S+)/.exec(line);
        if (mv) {
          const [, rank, kind, raw, first] = mv;
          const cp = kind === "mate" ? (Number(raw) > 0 ? 100000 : -100000) : Number(raw);
          scores.set(Number(rank), { move: first, cp });
        }
        if (line.startsWith("bestmove")) {
          listeners.splice(listeners.indexOf(onLine), 1);
          resolve([...scores.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v));
        }
      };
      listeners.push(onLine);
      send("setoption name MultiPV value " + multipv);
      send("position fen " + fen);
      send("go depth " + depth);
    });
  }

  await new Promise((resolve) => {
    const onReady = (line) => {
      if (line.includes("uciok")) {
        listeners.splice(listeners.indexOf(onReady), 1);
        resolve();
      }
    };
    listeners.push(onReady);
    send("uci");
  });

  return {
    analyse,
    quit: () => {
      console.log = realLog;
      if (engine.terminate) engine.terminate();
    },
  };
}

module.exports = { createEngine };

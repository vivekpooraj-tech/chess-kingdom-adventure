const STOCKFISH_WORKER_URL = "/stockfish/stockfish-18-lite-single.js";

interface PendingMove {
  resolve: (uciMove: string) => void;
  reject: (err: Error) => void;
}

/**
 * Thin wrapper around the Stockfish 18 WASM engine, served locally from
 * /public/stockfish/ (see scripts/copy-stockfish.js) rather than a CDN.
 * jsDelivr — the usual way to load an npm package's files directly in the
 * browser — refuses to serve *any* file from the `stockfish` package
 * because its total unpacked size (~250MB across every WASM variant it
 * ships) exceeds jsDelivr's 150MB-per-package limit. The postinstall script
 * copies just the ~7.3MB we actually need into /public instead, which also
 * means gameplay has no runtime dependency on an external CDN staying up.
 *
 * "lite-single" build: single-threaded (no SharedArrayBuffer / cross-origin
 * isolation headers required — those add real deployment complexity for
 * marginal gain here) and the smaller "lite" NNUE network (faster to load,
 * plenty strong once weakened for a kid-friendly opponent anyway).
 *
 * One singleton instance is reused for the whole page session — spinning up
 * a fresh Worker (and re-loading the WASM) per move would be wasteful.
 */
class StockfishEngine {
  private worker: Worker | null = null;
  private readyPromise: Promise<void> | null = null;
  private pending: PendingMove | null = null;

  private getWorker(): Worker {
    if (this.worker) return this.worker;

    const worker = new Worker(STOCKFISH_WORKER_URL);
    worker.onmessage = (e: MessageEvent<string>) => {
      const line = e.data;
      if (typeof line !== "string") return;
      if (line.startsWith("bestmove")) {
        const uciMove = line.split(" ")[1];
        this.pending?.resolve(uciMove);
        this.pending = null;
      }
    };
    worker.onerror = () => {
      this.pending?.reject(new Error("Stockfish worker failed to load or crashed."));
      this.pending = null;
      // Let a future call retry with a fresh worker instead of staying broken.
      this.worker = null;
      this.readyPromise = null;
    };

    this.worker = worker;
    return worker;
  }

  private init(): Promise<void> {
    if (this.readyPromise) return this.readyPromise;

    const worker = this.getWorker();
    this.readyPromise = new Promise((resolve) => {
      const handleInit = (e: MessageEvent<string>) => {
        if (e.data === "uciok") {
          // Kid-friendly weak play: lowest built-in Skill Level. (Stockfish's
          // UCI_Elo limiter bottoms out around 1320, still far too strong for
          // a beginner, so we rely on Skill Level + a shallow search depth
          // at call time instead.)
          worker.postMessage("setoption name Skill Level value 0");
          worker.postMessage("isready");
        }
        if (e.data === "readyok") {
          worker.removeEventListener("message", handleInit);
          resolve();
        }
      };
      worker.addEventListener("message", handleInit);
      worker.postMessage("uci");
    });

    return this.readyPromise;
  }

  /**
   * Returns the engine's chosen move in UCI notation (e.g. "e7e5" or
   * "e7e8q" for a promotion). `depth` defaults very shallow — combined with
   * Skill Level 0, this produces genuinely beatable, sometimes-blundering
   * play appropriate for a 5-12 year old beginner, not a crushing engine.
   */
  async getBestMove(fen: string, depth = 2): Promise<string> {
    await this.init();
    const worker = this.getWorker();
    return new Promise((resolve, reject) => {
      this.pending = { resolve, reject };
      worker.postMessage(`position fen ${fen}`);
      worker.postMessage(`go depth ${depth}`);
    });
  }
}

export const stockfish = new StockfishEngine();
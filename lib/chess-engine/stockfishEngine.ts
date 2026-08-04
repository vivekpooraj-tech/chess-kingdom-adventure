const STOCKFISH_WORKER_URL = "/stockfish/stockfish-18-lite-single.js";

export type Difficulty = "easy" | "medium" | "hard";

/**
 * Skill Level (0-20, Stockfish's own weakening knob) and search depth per
 * difficulty tier for the Free Play Arena — unlocked after finishing all 30
 * lesson days. "Easy" matches the same weak, sometimes-blundering play used
 * throughout the lesson content (Skill Level 0, depth 2). "Hard" is
 * deliberately capped well below Stockfish's max (20) — even a strong young
 * player shouldn't face a genuinely crushing engine in a kids' app; the goal
 * is "a real challenge," not "always loses."
 */
const DIFFICULTY_SETTINGS: Record<Difficulty, { skillLevel: number; depth: number }> = {
  easy: { skillLevel: 0, depth: 2 },
  medium: { skillLevel: 6, depth: 5 },
  hard: { skillLevel: 12, depth: 8 },
};

export interface EngineResult {
  /** Chosen move in UCI notation, e.g. "e7e5" or "e7e8q" for a promotion. */
  move: string;
  /**
   * Centipawn evaluation from the perspective of whoever's turn it was in
   * the FEN passed in (positive = good for the side to move). A mate score
   * is mapped to a large magnitude (±100000 minus/plus the mate distance)
   * so it still sorts/compares sensibly against centipawn scores.
   */
  evalCp: number;
}

interface PendingRequest {
  resolve: (result: EngineResult) => void;
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
 *
 * Requests are serialized through `queue` — the engine can only search one
 * position at a time, and this app now has two independent call sites that
 * can both want a move/eval around the same moment (ChessBoard's own
 * auto-opponent, and blunder-detection tracking wrapping a puzzle board).
 * Without serialization, two concurrent `go` commands would race on the
 * same worker and corrupt each other's results.
 */
class StockfishEngine {
  private worker: Worker | null = null;
  private readyPromise: Promise<void> | null = null;
  private pending: PendingRequest | null = null;
  private currentSkillLevel: number | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  private getWorker(): Worker {
    if (this.worker) return this.worker;

    const worker = new Worker(STOCKFISH_WORKER_URL);
    let lastScoreCp = 0;

    worker.onmessage = (e: MessageEvent<string>) => {
      const line = e.data;
      if (typeof line !== "string") return;

      const mateMatch = line.match(/score mate (-?\d+)/);
      const cpMatch = line.match(/score cp (-?\d+)/);
      if (mateMatch) {
        const n = parseInt(mateMatch[1], 10);
        lastScoreCp = n > 0 ? 100000 - n : -100000 - n;
      } else if (cpMatch) {
        lastScoreCp = parseInt(cpMatch[1], 10);
      }

      if (line.startsWith("bestmove")) {
        const uciMove = line.split(" ")[1];
        this.pending?.resolve({ move: uciMove, evalCp: lastScoreCp });
        this.pending = null;
        lastScoreCp = 0;
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
          // Start at the weakest setting; getBestMove() adjusts this per
          // difficulty tier before each move via setSkillLevel().
          worker.postMessage("setoption name Skill Level value 0");
          this.currentSkillLevel = 0;
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

  /** Changes engine strength without a full re-init — cheap, can be called before every move. */
  private setSkillLevel(level: number) {
    if (this.currentSkillLevel === level) return;
    this.getWorker().postMessage(`setoption name Skill Level value ${level}`);
    this.currentSkillLevel = level;
  }

  private runSearch(fen: string, skillLevel: number, depth: number): Promise<EngineResult> {
    const worker = this.getWorker();
    this.setSkillLevel(skillLevel);
    return new Promise((resolve, reject) => {
      this.pending = { resolve, reject };
      worker.postMessage(`position fen ${fen}`);
      worker.postMessage(`go depth ${depth}`);
    });
  }

  /** Queues `fn` behind any in-flight engine request, so calls never race on the shared worker. */
  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.queue.then(fn);
    // Swallow errors here so one failed request doesn't wedge the queue for
    // everyone after it — the caller's own awaited promise still rejects.
    this.queue = result.catch(() => undefined);
    return result;
  }

  /**
   * Returns the engine's chosen move (UCI notation) and its evaluation of
   * the position, both at once — one search covers both needs. `difficulty`
   * controls Skill Level + search depth together (DIFFICULTY_SETTINGS
   * above). Defaults to "easy" (the same weak, sometimes-blundering play
   * used throughout the lesson content), so existing callers that don't
   * pass a difficulty keep behaving exactly as before.
   */
  async getBestMove(fen: string, difficulty: Difficulty = "easy"): Promise<EngineResult> {
    return this.enqueue(async () => {
      await this.init();
      const { skillLevel, depth } = DIFFICULTY_SETTINGS[difficulty];
      return this.runSearch(fen, skillLevel, depth);
    });
  }

  /**
   * Evaluates a position without needing (or weakening for) a move choice —
   * always searches at a fixed, fairly strong depth/skill so evaluations
   * used for blunder-detection are consistent regardless of what difficulty
   * tier the child happens to be playing at elsewhere.
   */
  async evaluatePosition(fen: string): Promise<number> {
    return this.enqueue(async () => {
      await this.init();
      const result = await this.runSearch(fen, 10, 8);
      return result.evalCp;
    });
  }
}

export const stockfish = new StockfishEngine();

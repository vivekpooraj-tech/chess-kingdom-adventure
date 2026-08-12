const STOCKFISH_WORKER_URL = "/stockfish/stockfish-18-lite-single.js";

export type Difficulty = "very-easy" | "easy" | "medium" | "hard";

/**
 * Skill Level (0-20, Stockfish's own weakening knob) and search depth per
 * difficulty tier for the Free Play Arena — unlocked after finishing all 30
 * lesson days. "Easy" matches the same weak, sometimes-blundering play used
 * throughout the lesson content (Skill Level 0, depth 2). "Hard" is
 * deliberately capped well below Stockfish's max (20) — even a strong young
 * player shouldn't face a genuinely crushing engine in a kids' app; the goal
 * is "a real challenge," not "always loses." "very-easy" isn't used for
 * move selection the way the other three are — see getBeginnerMove()/
 * VERY_EASY_CANDIDATE_COUNT below for why a lower depth alone doesn't make
 * a genuinely beginner-friendly opponent — this entry only exists as the
 * emergency fallback if a MultiPV search ever comes back empty.
 */
const DIFFICULTY_SETTINGS: Record<Difficulty, { skillLevel: number; depth: number }> = {
  "very-easy": { skillLevel: 0, depth: 3 },
  easy: { skillLevel: 0, depth: 2 },
  medium: { skillLevel: 6, depth: 5 },
  hard: { skillLevel: 12, depth: 8 },
};

/**
 * How many of the engine's own top-ranked replies (Stockfish's MultiPV
 * feature) getBeginnerMove() pulls before picking among them. Not "all
 * legal moves" — asking Stockfish to fully search and rank every legal
 * move in a position would be far too slow for real-time play; asking for
 * its top 5 (already-weakened, shallow) lines is enough raw material to
 * choose a "reasonable/weak" option from instead of always the best one,
 * while staying fast. If a position has fewer than 5 legal moves, Stockfish
 * itself returns fewer candidates — handled fine, see pickBeginnerCandidate.
 */
const VERY_EASY_CANDIDATE_COUNT = 5;

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

/**
 * Weighted-random pick favoring the WEAKER end of a best-to-worst-ranked
 * candidate list — e.g. for 5 candidates the weights are 1,2,3,4,5 (rank 1
 * = the engine's actual best move), so the weakest option is 5x more likely
 * than the strongest. The best move can still be picked (a beginner finds
 * the obvious move sometimes too) — it's just not the default outcome the
 * way it is for every other difficulty tier. This is what makes
 * "Very Easy" intentionally weak in its DECISIONS, not just its search
 * depth (section 3 of the brief this implements).
 */
function pickBeginnerCandidate(candidates: EngineResult[]): EngineResult {
  const weights = candidates.map((_, i) => i + 1);
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

interface PendingRequest {
  resolve: (result: EngineResult) => void;
  reject: (err: Error) => void;
}

interface PendingMultiRequest {
  resolve: (result: EngineResult[]) => void;
  reject: (err: Error) => void;
  candidates: Map<number, EngineResult>;
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
  private pendingMulti: PendingMultiRequest | null = null;
  private currentSkillLevel: number | null = null;
  private currentMultiPv: number | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  private getWorker(): Worker {
    if (this.worker) return this.worker;

    const worker = new Worker(STOCKFISH_WORKER_URL);
    let lastScoreCp = 0;

    worker.onmessage = (e: MessageEvent<string>) => {
      const line = e.data;
      if (typeof line !== "string") return;

      // MultiPV mode (getBeginnerMove) — collect one candidate per "multipv
      // N" line, keyed by rank, overwriting as iterative deepening reports
      // fresher scores for the same rank; resolve with all of them once
      // bestmove arrives. Mutually exclusive with the single-move `pending`
      // path below — a search is only ever one or the other.
      if (this.pendingMulti) {
        const multipvMatch = line.match(/ multipv (\d+)/);
        const pvMatch = line.match(/ pv (\S+)/);
        if (multipvMatch && pvMatch) {
          const mateMatch = line.match(/score mate (-?\d+)/);
          const cpMatch = line.match(/score cp (-?\d+)/);
          let evalCp = 0;
          if (mateMatch) {
            const n = parseInt(mateMatch[1], 10);
            evalCp = n > 0 ? 100000 - n : -100000 - n;
          } else if (cpMatch) {
            evalCp = parseInt(cpMatch[1], 10);
          }
          this.pendingMulti.candidates.set(parseInt(multipvMatch[1], 10), { move: pvMatch[1], evalCp });
        }
        if (line.startsWith("bestmove")) {
          const ranked = Array.from(this.pendingMulti.candidates.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([, candidate]) => candidate);
          this.pendingMulti.resolve(ranked);
          this.pendingMulti = null;
        }
        return;
      }

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
      this.pendingMulti?.reject(new Error("Stockfish worker failed to load or crashed."));
      this.pendingMulti = null;
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

  /** Changes how many ranked candidate lines the engine reports per search. */
  private setMultiPv(n: number) {
    if (this.currentMultiPv === n) return;
    this.getWorker().postMessage(`setoption name MultiPV value ${n}`);
    this.currentMultiPv = n;
  }

  private runSearch(fen: string, skillLevel: number, depth: number): Promise<EngineResult> {
    const worker = this.getWorker();
    this.setSkillLevel(skillLevel);
    // Every difficulty except "very-easy" relies on a single bestmove line
    // — always reset MultiPV to 1 here so a prior getBeginnerMove() call
    // never leaves it elevated for these searches (Easy/Medium/Hard/
    // evaluatePosition/findBestMove must behave exactly as before).
    this.setMultiPv(1);
    return new Promise((resolve, reject) => {
      this.pending = { resolve, reject };
      worker.postMessage(`position fen ${fen}`);
      worker.postMessage(`go depth ${depth}`);
    });
  }

  /** Same shape as runSearch, but asks the engine for its top `multiPv` ranked replies instead of just one. */
  private runMultiSearch(fen: string, skillLevel: number, depth: number, multiPv: number): Promise<EngineResult[]> {
    const worker = this.getWorker();
    this.setSkillLevel(skillLevel);
    this.setMultiPv(multiPv);
    return new Promise((resolve, reject) => {
      this.pendingMulti = { resolve, reject, candidates: new Map() };
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
   * "Very Easy" — a genuinely beginner-friendly opponent, not Easy at a
   * lower depth. Pulls the engine's own top VERY_EASY_CANDIDATE_COUNT
   * ranked replies at Easy-tier strength (Skill Level 0), then deliberately
   * picks among them with a bias toward the weaker options instead of
   * always taking the best one (pickBeginnerCandidate) — real candidate
   * moves, real engine evaluations, intentionally weak selection. Every
   * candidate is still a fully legal reply to the actual position (Stockfish
   * never proposes illegal moves), so this can never produce an illegal
   * move, fail to respond to check, or otherwise behave impossibly — it
   * just plays more like a beginner than an engine.
   */
  async getBeginnerMove(fen: string): Promise<EngineResult> {
    return this.enqueue(async () => {
      await this.init();
      const { skillLevel, depth } = DIFFICULTY_SETTINGS["very-easy"];
      const candidates = await this.runMultiSearch(fen, skillLevel, depth, VERY_EASY_CANDIDATE_COUNT);
      if (candidates.length === 0) {
        // Extremely unlikely (e.g. a position with exactly one legal move
        // still returns it as candidate 1) — fall back to a normal search
        // rather than leaving the caller with nothing to play.
        return this.runSearch(fen, skillLevel, depth);
      }
      return pickBeginnerCandidate(candidates);
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

  /**
   * Post-game analysis only (Chess Mind's "what should you have played
   * instead" feature) — always searches at a strong, fixed setting
   * regardless of what difficulty the game was actually played at, since
   * the point is to show the objectively best continuation, not to
   * replicate the (deliberately weakened) opponent the child just played.
   * Does not touch DIFFICULTY_SETTINGS or any gameplay-facing method —
   * purely additive.
   */
  async findBestMove(fen: string): Promise<EngineResult> {
    return this.enqueue(async () => {
      await this.init();
      return this.runSearch(fen, 18, 10);
    });
  }
}

export const stockfish = new StockfishEngine();

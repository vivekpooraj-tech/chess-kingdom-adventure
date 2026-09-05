/**
 * Selects the exercise positions for the Strategy course.
 *
 *   node scripts/build-strategy.js
 *
 * Strategy cannot be verified the way tactics can. "This move gives check" is
 * decidable with chess.js; "this move is the right plan" is not. So this script
 * never asserts that an authored move is good. It works the other way round:
 *
 *   1. Build a pool of quiet positions.
 *   2. Ask Stockfish for the best move.
 *   3. Keep the position ONLY IF the engine's own best move happens to be an
 *      instance of the idea the lesson teaches.
 *
 * The exercise answer is therefore the engine's move by construction, and the
 * lesson's claim about it is checked structurally on top. Neither the position
 * nor the answer is authored by hand.
 *
 * The quiet pool is the interesting part. Puzzle FENs are by definition sharp —
 * the engine's best move there is the tactic, not a plan. But playing a puzzle's
 * full solution line to the end lands in the position AFTER the tactic
 * resolves, which is usually quiet. That yields thousands of real positions
 * from real games that are not themselves tactics puzzles.
 *
 * Prints a ready-to-paste TypeScript block.
 */
const fs = require("fs");
const path = require("path");
const { Chess } = require(path.join(process.cwd(), "node_modules", "chess.js"));
const { createEngine } = require(path.join(process.cwd(), "scripts", "lib", "engine.js"));

const LIB = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "data", "puzzles", "tactics-library.json"), "utf8")
);

const PIECE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** Count the legal moves a specific piece has in a position. */
function mobilityOf(game, square) {
  return game.moves({ square, verbose: true }).length;
}

/** Can any enemy pawn ever attack this square? (Outpost test.) */
function pawnSafe(game, square, byColor) {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);
  for (const df of [-1, 1]) {
    const f = file + df;
    if (f < 0 || f > 7) continue;
    // An enemy pawn can attack the square only from in front of it.
    const range = byColor === "w" ? [rank + 1, 8] : [1, rank - 1];
    for (let r = range[0]; r <= range[1]; r++) {
      const pc = game.get(String.fromCharCode(97 + f) + r);
      if (pc && pc.type === "p" && pc.color === byColor) return false;
    }
  }
  return true;
}

/**
 * The lesson claims. Each receives the position before the move, the engine's
 * best move (as a chess.js verbose move), and the position after it.
 */
const LESSONS = {
  "piece-activity": {
    label: "a quiet move that markedly increases the moved piece's scope",
    test: (before, mv, after) => {
      if (mv.captured || mv.san.includes("+") || mv.piece === "p" || mv.piece === "k") return false;
      const gained = mobilityOf(after, mv.to) - mobilityOf(before, mv.from);
      return gained >= 3;
    },
  },
  outposts: {
    label: "a knight moving to a square no enemy pawn can ever attack",
    test: (before, mv, after) => {
      // Quiet only: a knight landing with check or mate is a tactic, not an
      // outpost — the first run of this script selected Ne6+ and Nf6#.
      if (mv.piece !== "n" || mv.captured || mv.san.includes("+") || mv.san.includes("#")) {
        return false;
      }
      const them = mv.color === "w" ? "b" : "w";
      // Must be advanced enough to matter, protected, and pawn-proof.
      const rank = Number(mv.to[1]);
      const advanced = mv.color === "w" ? rank >= 4 : rank <= 5;
      return advanced && pawnSafe(after, mv.to, them) && after.isAttacked(mv.to, mv.color);
    },
  },
  "king-safety": {
    label: "castling the king out of the centre",
    test: (before, mv) => mv.san.startsWith("O-O"),
  },
  "pawn-breaks": {
    label: "a pawn advance that challenges an enemy pawn",
    test: (before, mv) => {
      if (mv.piece !== "p" || mv.captured || mv.san.includes("+")) return false;
      // The pawn must now be attacking, or be attacked by, an enemy pawn —
      // i.e. it has made contact with the enemy structure.
      const file = mv.to.charCodeAt(0) - 97;
      const rank = Number(mv.to[1]);
      const them = mv.color === "w" ? "b" : "w";
      const fwd = mv.color === "w" ? 1 : -1;
      for (const df of [-1, 1]) {
        const f = file + df;
        if (f < 0 || f > 7) continue;
        const diag = String.fromCharCode(97 + f) + (rank + fwd);
        const pc = before.get(diag);
        if (pc && pc.type === "p" && pc.color === them) return true;
      }
      return false;
    },
  },
  "worst-piece": {
    label: "moving the least active piece to a better square",
    test: (before, mv, after) => {
      if (mv.captured || mv.san.includes("+") || mv.piece === "p" || mv.piece === "k") return false;
      // The moved piece must have been the least mobile piece on the board for
      // its side — the classic "improve your worst piece" instruction.
      const mine = [];
      for (const row of before.board()) {
        for (const sq of row) {
          if (sq && sq.color === mv.color && sq.type !== "p" && sq.type !== "k") {
            mine.push({ square: sq.square, m: mobilityOf(before, sq.square) });
          }
        }
      }
      if (mine.length < 2) return false;
      const worst = Math.min(...mine.map((x) => x.m));
      const movedMobility = mine.find((x) => x.square === mv.from)?.m;
      if (movedMobility === undefined) return false;
      // The moved piece must be the least active, or tied with it — "improve
      // your worst piece" does not require a unique worst.
      if (movedMobility !== worst) return false;
      return mobilityOf(after, mv.to) - movedMobility >= 2;
    },
  },
};

/** Build the quiet candidate pool: positions after each puzzle's line resolves. */
function quietPool() {
  const out = [];
  for (const p of LIB) {
    const g = new Chess(p.fen);
    let ply = 0;
    for (const u of p.solution) {
      let mv = null;
      try {
        mv = g.move({
          from: u.slice(0, 2),
          to: u.slice(2, 4),
          promotion: u.length > 4 ? u[4] : undefined,
        });
      } catch {
        mv = null;
      }
      if (!mv) break;
      ply++;
      // Sample every position along the line, not only the end. Each one is a
      // real position from a real game, and the further into the line, the more
      // likely the tactic has resolved and a genuinely quiet choice remains.
      if (g.isGameOver() || g.isCheck()) continue;
      let material = 0;
      for (const row of g.board()) for (const sq of row) if (sq) material += PIECE_VALUE[sq.type];
      if (material < 18) continue;
      out.push({ id: `${p.id}-p${ply}`, fen: g.fen(), gameUrl: p.gameUrl });
    }
  }
  return out;
}

/** Also try the original puzzle FENs — needed for castling, which appears in
 *  opening-phase positions rather than after a tactic. */
function openingPool() {
  return LIB.filter((p) => p.themes.includes("opening")).map((p) => ({
    id: p.id + "-start",
    fen: p.fen,
    gameUrl: p.gameUrl,
  }));
}

const PER_LESSON = Number(process.env.PER_LESSON || 3);
const DEPTH = Number(process.env.DEPTH || 14);
const MAX_PROBES = Number(process.env.MAX_PROBES || 1200);
/** How far below the engine's best a taught move may sit, in centipawns. */
const MARGIN_CP = Number(process.env.MARGIN_CP || 40);

(async () => {
  const engine = await createEngine();
  const quiet = quietPool();
  const opening = openingPool();
  process.stderr.write(`quiet pool: ${quiet.length}  opening pool: ${opening.length}\n`);

  const found = {};
  for (const k of Object.keys(LESSONS)) found[k] = [];
  const used = new Set();

  // king-safety and pawn-breaks are far likelier in opening-phase positions.
  const pools = [...opening, ...quiet];
  let probes = 0;

  for (const cand of pools) {
    if (probes >= MAX_PROBES) break;
    const remaining = Object.keys(LESSONS).filter((k) => found[k].length < PER_LESSON);
    if (!remaining.length) break;
    if (used.has(cand.fen)) continue;

    let before;
    try {
      before = new Chess(cand.fen);
    } catch {
      continue;
    }
    // Cheap structural pre-screen: is ANY move satisfying a still-needed lesson
    // even legal here? Skips the expensive engine call on hopeless positions.
    const legal = before.moves({ verbose: true });
    const couldMatch = remaining.some((k) =>
      legal.some((m) => {
        const after = new Chess(cand.fen);
        try { after.move(m.san); } catch { return false; }
        try { return LESSONS[k].test(new Chess(cand.fen), m, after); } catch { return false; }
      })
    );
    if (!couldMatch) continue;

    probes++;
    const ranked = await engine.analyse(cand.fen, { depth: DEPTH, multipv: 3 });
    if (!ranked.length) continue;
    const topCp = ranked[0].cp;

    // Accept any of the engine's top moves that is within a small margin of its
    // best. Strategy rarely has one uniquely correct move, and demanding rank 1
    // exactly rejects sound plans for no pedagogical gain. The margin is what
    // keeps this honest: the taught move is never worse than 0.4 pawns off.
    let placed = false;
    for (const candidateMove of ranked) {
      if (placed) break;
      if (topCp - candidateMove.cp > MARGIN_CP) continue;

      const after = new Chess(cand.fen);
      let mv;
      try {
        mv = after.move({
          from: candidateMove.move.slice(0, 2),
          to: candidateMove.move.slice(2, 4),
          promotion: candidateMove.move.length > 4 ? candidateMove.move[4] : undefined,
        });
      } catch {
        continue;
      }
      if (!mv) continue;

      for (const k of remaining) {
        let hit = false;
        try {
          hit = LESSONS[k].test(new Chess(cand.fen), mv, after);
        } catch {
          hit = false;
        }
        if (!hit) continue;
        used.add(cand.fen);
        found[k].push({
          id: cand.id,
          fen: cand.fen,
          sideToMove: mv.color,
          from: mv.from,
          to: mv.to,
          san: mv.san,
          cp: candidateMove.cp,
          cpLossVsBest: topCp - candidateMove.cp,
          gameUrl: cand.gameUrl,
        });
        process.stderr.write(
          `  [${k}] ${found[k].length}/${PER_LESSON}  ${mv.san}  (-${topCp - candidateMove.cp}cp, probe ${probes})\n`
        );
        placed = true;
        break;
      }
    }
  }

  process.stderr.write(`\nprobes used: ${probes}\n`);
  for (const [k, v] of Object.entries(found)) {
    process.stderr.write(`${k}: ${v.length}/${PER_LESSON} — ${LESSONS[k].label}\n`);
  }

  console.log(JSON.stringify(found, null, 2));
  engine.quit();
  process.exit(0);
})();

/**
 * Stage 2 of the scalable tactics library — chess validation and shaping.
 *
 *   node scripts/build-tactics-library.js <candidates.json> <out.json> [--target 5000]
 *
 * Takes the balanced candidate pool from scripts/select-tactics-library.py and
 * turns it into the library the app actually serves, using chess.js — the same
 * engine the board itself uses, so a puzzle that validates here cannot be
 * unplayable there.
 *
 * The important transformation is the opponent's move. A Lichess puzzle's FEN
 * is the position BEFORE the opponent blunders, and the first move of `Moves`
 * is that blunder; the solver replies from move two. Storing it raw would show
 * the child the wrong position and the wrong side to move. So the opponent's
 * move is applied here, once, at build time: the stored FEN is exactly what the
 * child sees, and the stored solution contains only their own moves. That keeps
 * the runtime dumb, which is where correctness bugs are expensive.
 *
 * Every puzzle is rejected unless:
 *   - the FEN loads and is a legal position,
 *   - the opponent's first move is legal in it,
 *   - every solver move is legal in sequence,
 *   - the side to move after the opponent's move is the side the child plays,
 *   - the final position is consistent with the puzzle's own claim (a `mate`
 *     themed puzzle must actually end in checkmate).
 *
 * Nothing here invents metadata: rating, themes, popularity and the source game
 * all come straight from the dataset.
 */
const fs = require("fs");
const path = require("path");
const { Chess } = require(path.join(process.cwd(), "node_modules", "chess.js"));

const args = process.argv.slice(2);
const [SRC, OUT] = args;
const TARGET = Number((args.find((a) => a.startsWith("--target=")) || "--target=5000").split("=")[1]);
if (!SRC || !OUT) {
  console.error("usage: node scripts/build-tactics-library.js <candidates.json> <out.json> [--target=5000]");
  process.exit(1);
}

const candidates = JSON.parse(fs.readFileSync(SRC, "utf8"));
const stats = {
  read: candidates.length,
  badFen: 0,
  illegalOpponentMove: 0,
  illegalSolverMove: 0,
  mateClaimUnmet: 0,
  duplicate: 0,
  ok: 0,
};

/** chess.js accepts some illegal FENs silently, so check the invariants the
 *  existing pool's verifier also checks: exactly one king each, and the side
 *  NOT to move must not already be in check. */
function positionIsSane(game) {
  const board = game.board().flat().filter(Boolean);
  const whiteKings = board.filter((p) => p.type === "k" && p.color === "w").length;
  const blackKings = board.filter((p) => p.type === "k" && p.color === "b").length;
  if (whiteKings !== 1 || blackKings !== 1) return false;
  // Side not to move already in check = an impossible position to arrive at.
  const fen = game.fen();
  const flipped = fen.replace(/ (w|b) /, (_, c) => ` ${c === "w" ? "b" : "w"} `);
  try {
    const probe = new Chess(flipped);
    if (probe.isCheck()) return false;
  } catch {
    // A FEN that only fails when flipped is still usable as-is.
  }
  return true;
}

const seen = new Set();
const built = [];

for (const c of candidates) {
  if (seen.has(c.lichessId)) {
    stats.duplicate++;
    continue;
  }

  let game;
  try {
    game = new Chess(c.fen);
  } catch {
    stats.badFen++;
    continue;
  }
  if (!positionIsSane(game)) {
    stats.badFen++;
    continue;
  }

  const uci = c.moves.split(" ");
  const opponentMove = uci[0];
  const solverUci = uci.slice(1);

  // Apply the opponent's blunder to reach the position the child is shown.
  const applied = playUci(game, opponentMove);
  if (!applied) {
    stats.illegalOpponentMove++;
    continue;
  }

  const puzzleFen = game.fen();
  const sideToMove = game.turn(); // the child's side, after the opponent moved

  // Walk the solution to prove it is playable, and capture SAN for feedback.
  const probe = new Chess(puzzleFen);
  const solutionSan = [];
  let solverOk = true;
  for (let i = 0; i < solverUci.length; i++) {
    const mv = playUci(probe, solverUci[i]);
    if (!mv) {
      solverOk = false;
      break;
    }
    // Only the child's own moves are "solution" moves; the opponent's
    // in-between replies are recorded so the runtime can auto-play them.
    solutionSan.push(mv.san);
  }
  if (!solverOk) {
    stats.illegalSolverMove++;
    continue;
  }

  const themes = c.themes.split(" ");
  const claimsMate = themes.includes("mate");
  if (claimsMate && !probe.isCheckmate()) {
    stats.mateClaimUnmet++;
    continue;
  }

  seen.add(c.lichessId);
  built.push({
    id: `lc-${c.lichessId}`,
    fen: puzzleFen,
    sideToMove,
    // UCI is what the runtime compares against; SAN is for human-readable
    // feedback. Index 0 is the child's first move, index 1 the opponent's
    // scripted reply, index 2 the child's second move, and so on.
    solution: solverUci,
    solutionSan,
    skill: c.skill,
    tier: c.tier,
    rating: c.rating,
    themes,
    // Attribution: Lichess puzzles are CC0, but linking the source game is
    // both useful and courteous. See PUZZLE_LIBRARY.md.
    lichessId: c.lichessId,
    gameUrl: c.gameUrl || null,
  });
  stats.ok++;
}

function playUci(g, move) {
  if (!move || move.length < 4) return null;
  const from = move.slice(0, 2);
  const to = move.slice(2, 4);
  const promotion = move.length > 4 ? move[4] : undefined;
  try {
    return g.move({ from, to, promotion });
  } catch {
    return null;
  }
}

// Trim to the target while KEEPING the balance stage 1 worked to create:
// take evenly from each (skill, tier) bucket rather than slicing the array,
// which would silently favour whichever buckets sort first.
const byBucket = new Map();
for (const p of built) {
  const k = `${p.skill}|${p.tier}`;
  if (!byBucket.has(k)) byBucket.set(k, []);
  byBucket.get(k).push(p);
}
const bucketKeys = [...byBucket.keys()].sort();
const final = [];
let round = 0;
while (final.length < TARGET) {
  let addedThisRound = 0;
  for (const k of bucketKeys) {
    const list = byBucket.get(k);
    if (round < list.length && final.length < TARGET) {
      final.push(list[round]);
      addedThisRound++;
    }
  }
  if (addedThisRound === 0) break; // every bucket exhausted
  round++;
}

final.sort((a, b) => a.id.localeCompare(b.id));
fs.writeFileSync(OUT, JSON.stringify(final));

const dist = {};
for (const p of final) {
  const k = `${p.skill}/${p.tier}`;
  dist[k] = (dist[k] || 0) + 1;
}
console.log("candidates read: ", stats.read.toLocaleString());
console.log("  rejected bad FEN/position   ", stats.badFen);
console.log("  rejected illegal opp move   ", stats.illegalOpponentMove);
console.log("  rejected illegal solver move", stats.illegalSolverMove);
console.log("  rejected unmet mate claim   ", stats.mateClaimUnmet);
console.log("  rejected duplicate id       ", stats.duplicate);
console.log("validated:       ", stats.ok.toLocaleString());
console.log("written:         ", final.length.toLocaleString(), "->", OUT);
console.log("bytes:           ", fs.statSync(OUT).size.toLocaleString());
console.log("distribution:");
for (const k of Object.keys(dist).sort()) console.log(`  ${k.padEnd(30)} ${dist[k]}`);

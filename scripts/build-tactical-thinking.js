/**
 * Selects the exercise positions for the Tactical Thinking course.
 *
 *   node scripts/build-tactical-thinking.js
 *
 * The curriculum text is authored by hand; the POSITIONS are not. Hand-writing
 * FENs is how wrong chess ends up in a teaching product, so every exercise here
 * is drawn from data/puzzles/tactics-library.json — 5,000 positions already
 * validated move-by-move with chess.js — and then re-checked against the
 * specific thing its lesson claims to teach.
 *
 * Each lesson needs positions where the LESSON'S OWN IDEA is what solves it:
 *   1. Checks      — the solving move must give check
 *   2. Captures    — the solving move must be a capture
 *   3. Threats     — a fork/pin/skewer, where the move creates a threat
 *   4. Their reply — a multi-move line, so the opponent actually answers
 *
 * Prints a ready-to-paste TypeScript block. Re-run it to reselect.
 */
const fs = require("fs");
const path = require("path");
const { Chess } = require(path.join(process.cwd(), "node_modules", "chess.js"));

const LIB = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "data", "puzzles", "tactics-library.json"), "utf8")
);

/** Replay a puzzle and describe its first (the child's) move. */
function firstMove(p) {
  const g = new Chess(p.fen);
  const u = p.solution[0];
  const mv = g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u.length > 4 ? u[4] : undefined });
  if (!mv) return null;
  return { mv, after: g };
}

const seen = new Set();
function pick(n, predicate, pool = LIB) {
  const out = [];
  for (const p of pool) {
    if (out.length >= n) break;
    if (seen.has(p.id)) continue;
    const r = firstMove(p);
    if (!r) continue;
    if (!predicate(p, r.mv, r.after)) continue;
    seen.add(p.id);
    out.push({ p, mv: r.mv });
  }
  return out;
}

// Prefer gentle, short, sparse positions: this is a thinking course, not a
// difficulty test. Beginner tier, few pieces, solvable in one or two ideas.
const gentle = LIB.filter(
  (p) => p.tier === "beginner" && p.solution.length <= 3 && p.fen.split(" ")[0].replace(/[^a-zA-Z]/g, "").length <= 14
);
const shortMulti = LIB.filter((p) => p.tier === "beginner" && p.solution.length === 3);

const lessons = {
  // The move must actually be a check — that is the whole lesson.
  checks: pick(4, (p, mv) => mv.san.includes("+") || mv.san.includes("#"), gentle),
  // The move must actually capture something.
  captures: pick(4, (p, mv) => mv.captured !== undefined && !mv.san.includes("#"), gentle),
  // A quiet move that CREATES a threat: not a capture, not a check, and
  // crucially the opponent's own reply must not simply take the piece that
  // just moved. Without that last condition the filter happily returns
  // deflection sacrifices (Ba3 Qxa3 Nxa3) — real tactics, but the opposite
  // of what "make a threat" teaches, and shipping them under that heading
  // would be teaching wrong chess.
  threats: pick(
    4,
    (p, mv, after) => {
      if (mv.captured !== undefined || mv.san.includes("+")) return false;
      if (!["forks", "pins", "skewers", "discovered_attacks"].includes(p.skill)) return false;
      const replyUci = p.solution[1];
      if (!replyUci) return false;
      // Opponent recaptures on the square we just moved to -> a sacrifice.
      if (replyUci.slice(2, 4) === mv.to) return false;
      // And the move should actually attack something new.
      const attacked = after
        .board()
        .flat()
        .filter((sq) => sq && sq.color !== mv.color)
        .some((sq) => after.isAttacked(sq.square, mv.color));
      return attacked;
    },
    LIB.filter((p) => p.tier !== "advanced" && p.solution.length <= 3)
  ),
  // A genuine opponent reply in the middle of the line, and the child's first
  // move is a CHECK so the reply is forced and predictable. That is the point
  // of the lesson: you can know what they will do. Left loose, this bucket
  // picked up deflection sacrifices, where guessing the reply is the hard part
  // rather than the teachable part.
  reply: pick(4, (p, mv) => p.solution.length === 3 && mv.san.includes("+"), shortMulti),
};

let ok = true;
const out = {};
for (const [key, picks] of Object.entries(lessons)) {
  if (picks.length < 4) {
    console.error(`!! only ${picks.length} positions found for "${key}"`);
    ok = false;
  }
  out[key] = picks.map(({ p, mv }) => ({
    puzzleId: p.id,
    fen: p.fen,
    sideToMove: p.sideToMove,
    solutionFrom: p.solution[0].slice(0, 2),
    solutionTo: p.solution[0].slice(2, 4),
    firstSan: mv.san,
    opponentReply: p.solution[1] ? p.solutionSan[1] : null,
    finalSan: p.solution[2] ? p.solutionSan[2] : null,
    fullLine: p.solutionSan.join(" "),
    skill: p.skill,
    rating: p.rating,
  }));
}

console.log(JSON.stringify(out, null, 2));
if (!ok) process.exit(1);

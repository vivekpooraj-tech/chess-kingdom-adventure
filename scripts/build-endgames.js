/**
 * Selects the exercise positions for the Endgames course.
 *
 *   node scripts/build-endgames.js
 *
 * Unlike Strategy, this needs no engine. Endgame exercises here are drawn from
 * the endgame positions in data/puzzles/tactics-library.json, whose solutions
 * are already forced lines validated move-by-move with chess.js. The work is
 * therefore selection, not authoring: find positions whose OWN verified
 * solution is an instance of the endgame idea a lesson teaches.
 *
 * A lesson about king activity gets positions whose solution is a king move; a
 * lesson about passed pawns gets positions whose solution creates or advances a
 * genuine passer, checked square by square. If a concept has no positions that
 * satisfy it, it does not become a lesson.
 *
 * Prints JSON for the authoring step.
 */
const fs = require("fs");
const path = require("path");
const { Chess } = require(path.join(process.cwd(), "node_modules", "chess.js"));

const LIB = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "data", "puzzles", "tactics-library.json"), "utf8")
);

/** Is the pawn on `square` passed — no enemy pawn ahead on its file or either
 *  neighbouring file? */
function isPassed(game, square, color) {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);
  const them = color === "w" ? "b" : "w";
  for (let df = -1; df <= 1; df++) {
    const f = file + df;
    if (f < 0 || f > 7) continue;
    const from = color === "w" ? rank + 1 : 1;
    const to = color === "w" ? 8 : rank - 1;
    for (let r = from; r <= to; r++) {
      const pc = game.get(String.fromCharCode(97 + f) + r);
      if (pc && pc.type === "p" && pc.color === them) return false;
    }
  }
  return true;
}

function census(game) {
  const c = { w: {}, b: {}, total: 0 };
  for (const row of game.board()) {
    for (const sq of row) {
      if (!sq) continue;
      c[sq.color][sq.type] = (c[sq.color][sq.type] || 0) + 1;
      c.total++;
    }
  }
  return c;
}

/** Replay a puzzle and describe the learner's first move. */
function firstMove(p) {
  const g = new Chess(p.fen);
  const u = p.solution[0];
  let mv;
  try {
    mv = g.move({
      from: u.slice(0, 2),
      to: u.slice(2, 4),
      promotion: u.length > 4 ? u[4] : undefined,
    });
  } catch {
    return null;
  }
  return mv ? { mv, after: g } : null;
}

const LESSONS = {
  "king-activity": {
    label: "the solution is a king move — the king as a fighting piece",
    test: (p, mv, before) => {
      if (mv.piece !== "k") return false;
      const c = census(before);
      // A real endgame, not a middlegame king walk.
      return c.total <= 12 && !c.w.q && !c.b.q;
    },
  },
  "passed-pawns": {
    label: "the solution pushes a pawn that is genuinely passed",
    test: (p, mv, before, after) => {
      if (mv.piece !== "p" || mv.captured || mv.promotion) return false;
      const c = census(before);
      return c.total <= 14 && isPassed(after, mv.to, mv.color);
    },
  },
  promotion: {
    label: "the solution promotes a pawn",
    test: (p, mv) => Boolean(mv.promotion),
  },
  "rook-endgames": {
    label: "a rook endgame whose solution is a rook move",
    test: (p, mv, before) => {
      if (mv.piece !== "r") return false;
      const c = census(before);
      // Rooks and pawns only — the defining shape of a rook endgame.
      const onlyRooksAndPawns =
        !c.w.q && !c.b.q && !c.w.n && !c.b.n && !c.w.b && !c.b.b && (c.w.r || c.b.r);
      return onlyRooksAndPawns && c.total <= 12;
    },
  },
  "pawn-endgames": {
    label: "a pure king-and-pawn endgame",
    test: (p, mv, before) => {
      const c = census(before);
      const onlyPawns =
        !c.w.q && !c.b.q && !c.w.n && !c.b.n && !c.w.b && !c.b.b && !c.w.r && !c.b.r;
      return onlyPawns && c.total <= 10;
    },
  },
  converting: {
    label: "a won endgame where the solution converts the advantage",
    test: (p, mv, before) => {
      if (!p.themes.includes("crushing")) return false;
      const c = census(before);
      return c.total <= 14 && c.total >= 8;
    },
  },
};

const PER_LESSON = Number(process.env.PER_LESSON || 3);

const endgames = LIB.filter(
  (p) => p.themes.includes("endgame") && p.solution.length <= 5 && p.tier !== "advanced"
);

const found = {};
for (const k of Object.keys(LESSONS)) found[k] = [];
const used = new Set();

for (const p of endgames) {
  if (used.has(p.id)) continue;
  const r = firstMove(p);
  if (!r) continue;
  const before = new Chess(p.fen);

  for (const [k, spec] of Object.entries(LESSONS)) {
    if (found[k].length >= PER_LESSON) continue;
    let hit = false;
    try {
      hit = spec.test(p, r.mv, before, r.after);
    } catch {
      hit = false;
    }
    if (!hit) continue;
    used.add(p.id);
    found[k].push({
      id: p.id,
      fen: p.fen,
      sideToMove: p.sideToMove,
      from: r.mv.from,
      to: r.mv.to,
      san: r.mv.san,
      promotion: r.mv.promotion || null,
      solutionSan: p.solutionSan,
      rating: p.rating,
      gameUrl: p.gameUrl,
    });
    break;
  }
}

for (const [k, v] of Object.entries(found)) {
  process.stderr.write(`${k}: ${v.length}/${PER_LESSON} — ${LESSONS[k].label}\n`);
}
console.log(JSON.stringify(found, null, 2));

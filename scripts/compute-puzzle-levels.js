// Computes a 1-6 internal difficulty level for each puzzle from OBJECTIVE,
// chess.js-derived signals rather than a hand-guessed label:
//
//   precisionRatio = (sound first moves) / (candidate moves considered)
//     -- low ratio means most "reasonable" tries fail and only a precise
//     move works; high ratio means many moves work (forgiving/obvious).
//   avgDefenderReplies = average legal-reply count for the defender at each
//     non-final ply along one sound line -- more replies to worry about is
//     objectively harder to calculate through.
//
// mateIn is the primary axis (1 -> levels 1-2, 2 -> levels 3-4, 3 -> levels
// 5-6); the two signals above decide the +0/+1 sub-tier within that pair.
// Run: node scripts/compute-puzzle-levels.js
const { Chess } = require("chess.js");
const { isSoundMateInNFirstMove } = require("./verify-puzzles.js");
const { PUZZLES } = (() => {
  // content/puzzles.ts is TS with a computed level field we're about to add;
  // read the CURRENT source and pull out the literal array via a tiny eval
  // rather than depending on ts-node. Kept intentionally simple/inspectable.
  const src = require("fs").readFileSync(require("path").join(__dirname, "..", "content", "puzzles.ts"), "utf8");
  const match = src.match(/export const PUZZLES: ChessPuzzle\[\] = (\[[\s\S]*?\n\]);/);
  if (!match) throw new Error("Could not locate PUZZLES array in content/puzzles.ts");
  // eslint-disable-next-line no-eval
  const PUZZLES = eval(match[1]);
  return { PUZZLES };
})();

function candidateMoves(fen, mateIn) {
  const game = new Chess(fen);
  if (mateIn === 1) {
    // Candidates a player would actually try: every legal CHECK.
    return game.moves({ verbose: true }).filter((m) => m.san.includes("+") || m.san.includes("#")).map((m) => m.san);
  }
  return game.moves();
}

function avgDefenderRepliesAlongLine(fen, sanFirstMove, mateIn) {
  if (mateIn === 1) return 0;
  const afterMove = new Chess(fen);
  afterMove.move(sanFirstMove);
  const replies = afterMove.moves();
  if (mateIn === 2) return replies.length;
  // mateIn 3: average the defender's reply count at ply 1 with the
  // defender's reply count one ply later, walking ONE sound continuation
  // (the first sound reply found at each branch) -- a representative
  // sample of "how many things the defender could try," not exhaustive.
  let total = replies.length;
  let samples = 1;
  for (const reply of replies) {
    const afterReply = new Chess(afterMove.fen());
    afterReply.move(reply);
    const secondMoves = afterReply.moves();
    const soundSecond = secondMoves.find((m) => isSoundMateInNFirstMove(afterReply.fen(), m, mateIn - 1));
    if (soundSecond) {
      const afterSecond = new Chess(afterReply.fen());
      afterSecond.move(soundSecond);
      total += afterSecond.moves().length;
      samples++;
    }
  }
  return total / samples;
}

const results = [];
for (const p of PUZZLES) {
  const candidates = candidateMoves(p.fen, p.mateIn);
  const game = new Chess(p.fen);
  const sound =
    p.mateIn === 1
      ? game.moves({ verbose: true }).filter((m) => {
          const g2 = new Chess(p.fen);
          g2.move(m.san);
          return g2.isCheckmate();
        }).map((m) => m.san)
      : candidates.filter((m) => isSoundMateInNFirstMove(p.fen, m, p.mateIn));

  const precisionRatio = candidates.length > 0 ? sound.length / candidates.length : 1;
  const avgReplies = sound.length > 0 ? avgDefenderRepliesAlongLine(p.fen, sound[0], p.mateIn) : 0;

  // Tier-aware thresholds, not one global cutoff: "candidates considered"
  // for mateIn 1 is just the checks (small, discriminative denominator --
  // precision genuinely separates "many checks work" from "only one
  // does"). For mateIn 2/3 the candidate pool is EVERY legal move, which
  // is structurally large regardless of the puzzle's real difficulty, so
  // precision saturates low for all of them and stops being discriminative
  // -- avgReplies (how many things the defender can try) is the real
  // signal there instead, calibrated against what this content pool
  // actually produces rather than an arbitrary fixed number.
  let harder;
  if (p.mateIn === 1) {
    harder = precisionRatio <= 0.34;
  } else if (p.mateIn === 2) {
    harder = avgReplies >= 2;
  } else {
    harder = avgReplies >= 2;
  }

  const level = (p.mateIn - 1) * 2 + 1 + (harder ? 1 : 0);
  results.push({ id: p.id, mateIn: p.mateIn, theme: p.theme, precisionRatio: Number(precisionRatio.toFixed(2)), avgReplies: Number(avgReplies.toFixed(1)), level });
}

for (const r of results) {
  console.log(`${r.id.padEnd(24)} mateIn=${r.mateIn}  precision=${r.precisionRatio}  avgReplies=${r.avgReplies}  -> level ${r.level}  (${r.theme})`);
}
console.log(`\nLevel distribution: ${JSON.stringify(
  results.reduce((acc, r) => ((acc[r.level] = (acc[r.level] || 0) + 1), acc), {})
)}`);

module.exports = { results };

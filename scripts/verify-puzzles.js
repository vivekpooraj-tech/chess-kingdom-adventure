// Verifies chess puzzle soundness before it's added to content/puzzles.ts.
// Usage: node scripts/verify-puzzles.js <path-to-candidates.json>
//
// Each candidate: { id, fen, sideToMove, mateIn: 1|2|3, theme, firstMove? }
// firstMove (SAN) is required for mateIn:2/3 candidates — it's how the
// author declares their intended first move, and this script confirms it's
// actually sound: it must force a mate one move shorter against EVERY
// legal reply, not just one hand-picked line, before it ships to kids. It
// also confirms the position doesn't have an EASIER mate than advertised
// (e.g. a "mate in 3" that's secretly a mate in 1). firstMove is
// verification-only — content/puzzles.ts has no stored solution field,
// validation at runtime is algorithmic (see
// lib/chess-engine/puzzleValidation.ts, which this duplicates in plain JS
// so this script has no dependency on a TS runner).
const { Chess } = require("chess.js");

function isSoundMateInNFirstMove(fen, sanMove, n) {
  if (n < 1) return false;
  const afterMove = new Chess(fen);
  const move = afterMove.move(sanMove);
  if (!move) return false;
  if (n === 1) return afterMove.isCheckmate();
  if (afterMove.isGameOver()) return false;
  const replies = afterMove.moves();
  if (replies.length === 0) return false;
  return replies.every((reply) => {
    const afterReply = new Chess(afterMove.fen());
    afterReply.move(reply);
    return hasMateInN(afterReply.fen(), n - 1);
  });
}

function hasMateInN(fen, n) {
  if (n < 1) return false;
  const game = new Chess(fen);
  if (game.isGameOver()) return false;
  return game.moves().some((sanMove) => isSoundMateInNFirstMove(fen, sanMove, n));
}

function exactMateDepth(fen, maxDepth) {
  for (let n = 1; n <= maxDepth; n++) {
    if (hasMateInN(fen, n)) return n;
  }
  return null;
}

function verify(p) {
  const errors = [];
  let game;
  try {
    game = new Chess(p.fen);
  } catch (e) {
    return [`invalid FEN: ${e.message}`];
  }
  if (game.turn() !== p.sideToMove) {
    errors.push(`FEN side-to-move (${game.turn()}) doesn't match declared sideToMove (${p.sideToMove})`);
  }
  if (game.isGameOver()) {
    errors.push("position is already game-over");
  }
  if (![1, 2, 3].includes(p.mateIn)) {
    errors.push(`unsupported mateIn value: ${p.mateIn} (only 1, 2, or 3)`);
    return errors;
  }
  if (p.mateIn >= 2 && !p.firstMove) {
    errors.push(`mateIn:${p.mateIn} candidates need a firstMove (SAN) so this script can verify soundness`);
    return errors;
  }
  const soundAtDeclaredDepth = p.mateIn === 1 ? hasMateInN(p.fen, 1) : isSoundMateInNFirstMove(p.fen, p.firstMove, p.mateIn);
  if (!soundAtDeclaredDepth) {
    errors.push(
      p.mateIn === 1
        ? "no mate-in-1 found in this position"
        : `firstMove "${p.firstMove}" is not a sound mate-in-${p.mateIn} (must force a mate one move shorter against every legal reply)`
    );
  }
  // "No easier immediate mate" — the position's true fastest forced mate
  // must equal the declared depth, not be shorter.
  const depth = exactMateDepth(p.fen, p.mateIn);
  if (depth !== null && depth < p.mateIn) {
    errors.push(`position actually has a faster mate-in-${depth} available — mislabeled as mate-in-${p.mateIn}`);
  }
  return errors;
}

if (require.main === module) {
  const path = process.argv[2];
  if (!path) {
    console.error("Usage: node scripts/verify-puzzles.js <candidates.json>");
    process.exit(2);
  }
  const puzzles = JSON.parse(require("fs").readFileSync(path, "utf8"));
  let failures = 0;
  for (const p of puzzles) {
    const errors = verify(p);
    if (errors.length) {
      failures++;
      console.log(`FAIL ${p.id}:`);
      errors.forEach((e) => console.log("  - " + e));
    } else {
      console.log(`OK   ${p.id} (mate-in-${p.mateIn}, ${p.theme})`);
    }
  }
  console.log(`\n${puzzles.length - failures}/${puzzles.length} passed`);
  process.exit(failures ? 1 : 0);
}

module.exports = { hasMateInN, isSoundMateInNFirstMove, exactMateDepth, verify };

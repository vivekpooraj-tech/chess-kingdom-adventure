// Verifies chess puzzle soundness before it's added to content/puzzles.ts.
// Usage: node scripts/verify-puzzles.js <path-to-candidates.json>
//
// Each candidate: { id, fen, sideToMove, mateIn: 1|2, theme, firstMove? }
// firstMove (SAN) is required for mateIn:2 candidates — it's how the
// author declares their intended first move, and this script confirms
// it's actually sound: it must force mate-in-1 against EVERY legal reply,
// not just one hand-picked line, before it ships to kids. firstMove is
// verification-only — content/puzzles.ts has no stored solution field,
// validation at runtime is algorithmic (see
// lib/chess-engine/puzzleValidation.ts, which this duplicates in plain JS
// so this script has no dependency on a TS runner).
const { Chess } = require("chess.js");

function hasMateIn1(fen) {
  const game = new Chess(fen);
  if (game.isGameOver()) return false;
  return game.moves().some((move) => {
    const g2 = new Chess(fen);
    g2.move(move);
    return g2.isCheckmate();
  });
}

function isSoundMateIn2FirstMove(fen, sanMove) {
  const afterMove = new Chess(fen);
  const move = afterMove.move(sanMove);
  if (!move) return false;
  if (afterMove.isCheckmate()) return false; // that's mate-in-1, not a mate-in-2 first move
  if (afterMove.isGameOver()) return false; // stalemate/draw — not a valid line

  const replies = afterMove.moves();
  if (replies.length === 0) return false;

  return replies.every((reply) => {
    const afterReply = new Chess(afterMove.fen());
    afterReply.move(reply);
    return hasMateIn1(afterReply.fen());
  });
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
  if (p.mateIn === 1) {
    if (!hasMateIn1(p.fen)) errors.push("no mate-in-1 found in this position");
  } else if (p.mateIn === 2) {
    if (!p.firstMove) {
      errors.push("mateIn:2 candidates need a firstMove (SAN) so this script can verify soundness");
    } else if (!isSoundMateIn2FirstMove(p.fen, p.firstMove)) {
      errors.push(`firstMove "${p.firstMove}" is not a sound mate-in-2 (must force mate-in-1 against every legal reply)`);
    }
  } else {
    errors.push(`unsupported mateIn value: ${p.mateIn} (only 1 or 2)`);
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

module.exports = { hasMateIn1, isSoundMateIn2FirstMove, verify };

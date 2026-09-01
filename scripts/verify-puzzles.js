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

/**
 * chess.js loads plenty of chess-ILLEGAL FENs without complaint. The one
 * that bit us: the side NOT to move already in check (e.g. a rook aimed
 * straight down the a-file at a cornered enemy king while it's the
 * rook-owner's turn) — that position can't arise in a real game, and it's
 * confusing on the board. chess.js's own isCheck()/isGameOver() only look
 * at the side TO move, so this has to be checked explicitly.
 */
function legalityErrors(fen) {
  const errs = [];
  const board = fen.split(" ")[0];
  const wk = (board.match(/K/g) || []).length;
  const bk = (board.match(/k/g) || []).length;
  if (wk !== 1) errs.push(`must have exactly one white king (found ${wk})`);
  if (bk !== 1) errs.push(`must have exactly one black king (found ${bk})`);

  let game;
  try {
    game = new Chess(fen);
  } catch (e) {
    errs.push(`chess.js rejected FEN: ${e.message}`);
    return errs;
  }

  // The side NOT to move must not be in check.
  const opp = game.turn() === "w" ? "b" : "w";
  const flipped = fen.replace(/ [wb] /, ` ${opp} `);
  try {
    if (new Chess(flipped).isCheck()) {
      errs.push(`ILLEGAL: side not to move (${opp}) is already in check`);
    }
  } catch {
    /* the flip itself being unloadable is caught above */
  }

  // Kings can never stand on adjacent squares.
  const kings = {};
  game.board().forEach((row, r) =>
    row.forEach((cell, f) => {
      if (cell && cell.type === "k") kings[cell.color] = [f, 8 - r];
    })
  );
  if (kings.w && kings.b) {
    const dx = Math.abs(kings.w[0] - kings.b[0]);
    const dy = Math.abs(kings.w[1] - kings.b[1]);
    if (dx <= 1 && dy <= 1) errs.push(`ILLEGAL: kings on adjacent squares`);
  }
  return errs;
}

function verify(p) {
  const errors = [...legalityErrors(p.fen)];
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

/**
 * Pull the live PUZZLES array out of content/puzzles.ts (the same
 * eval-the-literal trick compute-puzzle-levels.js uses) so the shipped
 * pool can be re-verified, not just new candidates. mateIn:2/3 entries
 * have no stored firstMove, so those are checked for legality + "a forced
 * mate exists at exactly the declared depth" via exactMateDepth rather
 * than firstMove soundness.
 */
function loadShippedPool() {
  const src = require("fs").readFileSync(
    require("path").join(__dirname, "..", "content", "puzzles.ts"),
    "utf8"
  );
  const match = src.match(/export const PUZZLES: ChessPuzzle\[\] = (\[[\s\S]*?\n\]);/);
  if (!match) throw new Error("Could not locate PUZZLES array in content/puzzles.ts");
  // eslint-disable-next-line no-eval
  return eval(match[1]);
}

function verifyShipped(p) {
  const errors = [...legalityErrors(p.fen)];
  let game;
  try {
    game = new Chess(p.fen);
  } catch {
    return errors;
  }
  if (game.turn() !== p.sideToMove) errors.push(`side-to-move ${game.turn()} != declared ${p.sideToMove}`);
  if (game.isGameOver()) errors.push("position is already game-over");
  const depth = exactMateDepth(p.fen, p.mateIn);
  if (depth === null) errors.push(`no forced mate within ${p.mateIn}`);
  else if (depth < p.mateIn) errors.push(`faster mate-in-${depth} available (labeled mate-in-${p.mateIn})`);
  return errors;
}

if (require.main === module) {
  const path = process.argv[2];

  if (path === "--pool") {
    let failures = 0;
    const pool = loadShippedPool();

    // No two puzzles may share a FEN — a duplicate position shows up as
    // "the same puzzle twice" under random selection even with distinct ids.
    const seen = new Map();
    for (const p of pool) {
      if (seen.has(p.fen)) {
        failures++;
        console.log(`FAIL ${p.id}: duplicate FEN, same position as ${seen.get(p.fen)}`);
      } else {
        seen.set(p.fen, p.id);
      }
    }

    for (const p of pool) {
      const errors = verifyShipped(p);
      if (errors.length) {
        failures++;
        console.log(`FAIL ${p.id}:`);
        errors.forEach((e) => console.log("  - " + e));
      } else {
        console.log(`OK   ${p.id} (mate-in-${p.mateIn}, ${p.theme})`);
      }
    }
    console.log(`\n${pool.length - failures}/${pool.length} valid`);
    process.exit(failures ? 1 : 0);
  }

  if (!path) {
    console.error("Usage: node scripts/verify-puzzles.js <candidates.json>   (or --pool to re-verify content/puzzles.ts)");
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

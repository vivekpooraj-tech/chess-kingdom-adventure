/**
 * Server-side move validation, and the attacks it must refuse.
 *
 *   node scripts/test-move-validation.js
 *
 * Pure logic — no database, nothing to leak.
 *
 * submit_online_move enforces ownership, participation, active status, turn and
 * the clock, all correctly. What it never did was look at the chess: p_fen and
 * p_san were written verbatim, so a client could store any position it liked.
 * It also returns early for untimed games BEFORE its own turn check, so those
 * games had no turn enforcement at all.
 *
 * lib/online/moveValidation.ts replaces that trust. The browser now sends only
 * { from, to, promotion }, and every value that reaches the database is
 * generated here from a replay of the authoritative history.
 */
const fs = require("fs");
const path = require("path");
const ts = require(path.join(process.cwd(), "node_modules", "typescript"));

const Module = require("module");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request.startsWith("@/")) request = path.join(process.cwd(), request.slice(2));
  return origResolve.call(this, request, ...rest);
};
require.extensions[".ts"] = function (mod, filename) {
  const js = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filename,
  }).outputText;
  mod._compile(js, filename);
};

const V = require(path.join(process.cwd(), "lib", "online", "moveValidation.ts"));

let pass = 0;
const failures = [];
const check = (n, c, d) => (c ? pass++ : failures.push(d ? `${n} — ${d}` : n));

// ---- legal moves ----
{
  const r = V.validateMove([], { from: "e2", to: "e4" }, "w");
  check("a legal opening move is accepted", r.ok === true);
  check("the server generates the SAN", r.ok && r.san === "e4", r.san);
  check("the server generates the FEN", r.ok && r.fen.startsWith("rnbqkbnr/pppppppp/8/8/4P3/"), r.fen);
  check("turn passes to black", r.ok && r.turn === "b");
  check("ply count advances", r.ok && r.plies === 1);
  check("the game continues", r.ok && r.endsGame === false && r.termination === "ongoing");

  const black = V.validateMove(["e4"], { from: "e7", to: "e5" }, "b");
  check("black replies legally", black.ok === true && black.san === "e5");
}

// ---- ATTACK: illegal moves ----
{
  const r = V.validateMove([], { from: "e2", to: "e5" }, "w");
  check("ATTACK: a pawn cannot jump three squares", r.ok === false && r.reason === "illegal_move");

  const nonsense = V.validateMove([], { from: "e4", to: "e5" }, "w");
  check("ATTACK: moving from an empty square is refused", nonsense.ok === false);

  const throughPiece = V.validateMove([], { from: "a1", to: "a5" }, "w");
  check("ATTACK: a rook cannot move through its own pawn", throughPiece.ok === false);
}

// ---- ATTACK: wrong turn / moving the opponent's pieces ----
{
  const r = V.validateMove([], { from: "e7", to: "e5" }, "w");
  check("ATTACK: white cannot move a black pawn", r.ok === false);

  const outOfTurn = V.validateMove(["e4"], { from: "d2", to: "d4" }, "w");
  check("ATTACK: white cannot move twice in a row",
    outOfTurn.ok === false && outOfTurn.reason === "not_your_turn", outOfTurn.reason);
  check("the refusal names whose turn it is", outOfTurn.ok === false && /b to move/.test(outOfTurn.detail));

  // This is the untimed-game hole in SQL: turn is derived from the position
  // here, so it cannot be skipped whatever the time control.
  const blackTriesFirst = V.validateMove([], { from: "e7", to: "e5" }, "b");
  check("ATTACK: black cannot open the game", blackTriesFirst.ok === false &&
    blackTriesFirst.reason === "not_your_turn");
}

// ---- ATTACK: stale state, double submission, retries ----
{
  const stale = V.validateMove(["e4", "e5"], { from: "g1", to: "f3", expectedPly: 0 }, "w");
  check("ATTACK: a move from a stale board is refused",
    stale.ok === false && stale.reason === "stale_state", stale.reason);
  check("the refusal reports both plies", stale.ok === false && /expected ply 0.*is at 2/.test(stale.detail));

  const fresh = V.validateMove(["e4", "e5"], { from: "g1", to: "f3", expectedPly: 2 }, "w");
  check("a move with the correct ply is accepted", fresh.ok === true);

  // A double-click replays the same intent. The second attempt arrives when the
  // game has advanced, so it is refused as stale.
  const second = V.validateMove(["e4", "e5", "Nf3"], { from: "g1", to: "f3", expectedPly: 2 }, "w");
  check("ATTACK: a double-submitted move is refused as stale", second.ok === false);

  // Without expectedPly it still cannot double-apply: it is no longer white's turn.
  const noPly = V.validateMove(["e4", "e5", "Nf3"], { from: "g1", to: "f3" }, "w");
  check("a repeated move is refused on turn even without a ply hint",
    noPly.ok === false && noPly.reason === "not_your_turn");
}

// ---- ATTACK: corrupt or forged history ----
{
  const forged = V.validateMove(["e4", "Qz9"], { from: "e7", to: "e5" }, "b");
  check("ATTACK: a forged move in the history blocks further play",
    forged.ok === false && forged.reason === "illegal_history", forged.reason);
  check("the corrupt ply is identified", forged.ok === false && /stored move 1/.test(forged.detail));
}

// ---- ATTACK: malformed input ----
{
  for (const bad of [
    {},
    { from: "e2" },
    { from: "zz", to: "e4" },
    { from: "e2", to: "e9" },
    { from: 1, to: 2 },
  ]) {
    const r = V.validateMove([], bad, "w");
    check(`ATTACK: malformed input rejected (${JSON.stringify(bad)})`, r.ok === false);
  }
  const badPromo = V.validateMove([], { from: "e2", to: "e4", promotion: "k" }, "w");
  check("ATTACK: promoting to a king is refused", badPromo.ok === false && badPromo.reason === "malformed");
}

// ---- game endings are detected server-side ----
{
  // Fool's mate: black mates on the fourth ply.
  const mate = V.validateMove(["f3", "e5", "g4"], { from: "d8", to: "h4" }, "b");
  check("checkmate is detected on the move that delivers it", mate.ok === true && mate.termination === "checkmate");
  check("the mating side is the winner", mate.ok && mate.winner === "b", mate.winner);
  check("checkmate ends the game", mate.ok && mate.endsGame === true);
  check("checkmate is not a draw", mate.ok && mate.isDraw === false);
  check("the SAN carries the mate marker", mate.ok && mate.san === "Qh4#", mate.san);

  // Scholar's mate, White delivering.
  const scholars = V.validateMove(
    ["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6"],
    { from: "h5", to: "f7" },
    "w"
  );
  check("scholar's mate is detected", scholars.ok === true && scholars.termination === "checkmate");
  check("white is the winner", scholars.ok && scholars.winner === "w");
}

// ---- stalemate ----
{
  const line = [
    "e3", "a5", "Qh5", "Ra6", "Qxa5", "h5", "Qxc7", "Rah6", "h4", "f6",
    "Qxd7+", "Kf7", "Qxb7", "Qd3", "Qxb8", "Qh7", "Qxc8",
  ];
  const stale = V.validateMove(line, { from: "e8", to: "g6" }, "b"); // Kg6? not the line
  // The real stalemate move is Qe6 by white after Kg6; drive the documented line.
  const withKing = V.validateMove(line, { from: "f7", to: "g6" }, "b");
  check("the stalemate line accepts Kg6", withKing.ok === true, withKing.detail);
  const mateInStale = V.validateMove([...line, "Kg6"], { from: "c8", to: "e6" }, "w");
  check("stalemate is detected", mateInStale.ok === true && mateInStale.termination === "stalemate",
    mateInStale.ok ? mateInStale.termination : mateInStale.detail);
  check("stalemate is a draw with no winner",
    mateInStale.ok && mateInStale.isDraw === true && mateInStale.winner === null);
  check("stalemate ends the game", mateInStale.ok && mateInStale.endsGame === true);
}

// ---- promotion ----
{
  // A real promotion line: white's a-pawn marches and captures on b7, then
  // promotes by taking the a8 rook. (Verified against chess.js directly.)
  const promo = V.validateMove(
    ["a4", "h5", "a5", "h4", "a6", "h3", "axb7", "hxg2"],
    { from: "b7", to: "a8", promotion: "q" },
    "w"
  );
  check("a promotion is accepted", promo.ok === true, promo.ok ? "" : promo.detail);
  check("the promotion SAN is generated server-side", promo.ok && /=Q/.test(promo.san), promo.san);
}

console.log(`\n=== MOVE VALIDATION: ${pass} passed, ${failures.length} failed ===`);
if (failures.length) {
  console.error("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
  process.exitCode = 1;
}

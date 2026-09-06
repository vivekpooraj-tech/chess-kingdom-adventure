/**
 * Authoritative game verification and the attacks it must refuse.
 *
 *   node scripts/test-game-verification.js
 *
 * Pure logic — no database, so nothing to leak.
 *
 * The audit found two client-trusted surfaces: submit_online_move writes the
 * client's FEN and SAN unvalidated, and finish_online_game_by_result took
 * p_winner verbatim (a player declared victory with zero moves and was rated
 * for it). lib/online/verifyGame.ts replaces both with a replay from the
 * starting position. These tests are mostly attacks that must fail.
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

const V = require(path.join(process.cwd(), "lib", "online", "verifyGame.ts"));

let pass = 0;
const failures = [];
const check = (n, c, d) => (c ? pass++ : failures.push(d ? `${n} — ${d}` : n));

// Fool's mate: the fastest possible checkmate, four plies, Black mates.
const FOOLS_MATE = ["f3", "e5", "g4", "Qh4#"];
// Scholar's mate: White mates on move four (seven plies).
const SCHOLARS_MATE = ["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7#"];
// A stalemate line (Black is stalemated).
const STALEMATE = [
  "e3", "a5", "Qh5", "Ra6", "Qxa5", "h5", "Qxc7", "Rah6", "h4", "f6",
  "Qxd7+", "Kf7", "Qxb7", "Qd3", "Qxb8", "Qh7", "Qxc8", "Kg6", "Qe6",
];

// ---- replay and legality ----
{
  const empty = V.verifyGame([]);
  check("an empty game replays legally", empty.legal === true);
  check("an empty game is ongoing", empty.termination === "ongoing");
  check("an empty game has no winner", empty.winner === null);
  check("an empty game has zero plies", empty.plies === 0);
  check("white moves first", empty.turn === "w");

  const opening = V.verifyGame(["e4", "e5", "Nf3"]);
  check("a legal opening replays", opening.legal === true && opening.plies === 3);
  check("a legal opening is still ongoing", opening.termination === "ongoing");
  check("turn alternates correctly", opening.turn === "b");
}

// ---- illegal move streams are rejected ----
{
  const bogus = V.verifyGame(["e4", "e5", "Qz9"]);
  check("a malformed move is rejected", bogus.legal === false);
  check("the offending ply is reported", bogus.illegalAtPly === 2, String(bogus.illegalAtPly));

  const impossible = V.verifyGame(["e4", "e5", "Ke2", "Ke7", "Kd8"]);
  check("an illegal king move is rejected", impossible.legal === false);

  const outOfTurn = V.verifyGame(["e4", "d4"]);
  check("moving the same colour twice is rejected", outOfTurn.legal === false);

  check("garbage input does not throw", V.verifyGame(["", "  ", "!!"]).legal === false);
}

// ---- checkmate detection ----
{
  const fools = V.verifyGame(FOOLS_MATE);
  check("fool's mate replays legally", fools.legal === true);
  check("fool's mate is detected as checkmate", fools.termination === "checkmate");
  check("black wins fool's mate", fools.winner === "b", fools.winner);
  check("fool's mate is four plies", fools.plies === 4);

  const scholars = V.verifyGame(SCHOLARS_MATE);
  check("scholar's mate is detected", scholars.termination === "checkmate");
  check("white wins scholar's mate", scholars.winner === "w", scholars.winner);
  check("a mate is not a draw", scholars.isDraw === false);
}

// ---- draw detection ----
{
  const stale = V.verifyGame(STALEMATE);
  check("the stalemate line replays legally", stale.legal === true, `illegal at ${stale.illegalAtPly}`);
  check("stalemate is detected", stale.termination === "stalemate", stale.termination);
  check("stalemate is a draw with no winner", stale.isDraw === true && stale.winner === null);

  // Bare kings: insufficient material.
  const kings = new (require(path.join(process.cwd(), "node_modules", "chess.js")).Chess)(
    "8/8/8/4k3/8/8/4K3/8 w - - 0 1"
  );
  check("bare kings are insufficient material", kings.isInsufficientMaterial() === true);
}

// ---- ATTACKS: every one of these must be refused ----
{
  const ongoing = V.verifyGame(["e4", "e5"]);

  // 1. Claim victory with zero moves.
  const zero = V.decideCompletion({
    intent: "claim_result",
    verified: V.verifyGame([]),
    requesterColor: "w",
    opponentOfferedDraw: false,
  });
  check("ATTACK: claiming a win with zero moves is refused", zero.allowed === false);
  check("no winner is produced for a zero-move claim", zero.winner === null);

  // 2. Claim victory after four arbitrary (legal but non-mating) moves.
  const four = V.decideCompletion({
    intent: "claim_result",
    verified: V.verifyGame(["e4", "e5", "Nf3", "Nc6"]),
    requesterColor: "w",
    opponentOfferedDraw: false,
  });
  check("ATTACK: claiming a win after four quiet moves is refused", four.allowed === false);

  // 3. Claim victory while the board is ongoing.
  const mid = V.decideCompletion({
    intent: "claim_result",
    verified: ongoing,
    requesterColor: "b",
    opponentOfferedDraw: false,
  });
  check("ATTACK: claiming a win mid-game is refused", mid.allowed === false);
  check("the refusal says the game is in progress", /in progress/.test(mid.reason));

  // 4. Claim the WRONG winner on a real mate. The requester cannot influence
  //    the outcome at all: the winner comes from the position.
  const fools = V.verifyGame(FOOLS_MATE); // Black mates
  const wrongWinner = V.decideCompletion({
    intent: "claim_result",
    verified: fools,
    requesterColor: "w", // the losing side asks
    opponentOfferedDraw: false,
  });
  check("a real mate is accepted regardless of who reports it", wrongWinner.allowed === true);
  check("ATTACK: the loser cannot flip the winner", wrongWinner.winner === "b", wrongWinner.winner);

  // 5. Claim a draw with no offer outstanding.
  const fakeDraw = V.decideCompletion({
    intent: "accept_draw",
    verified: ongoing,
    requesterColor: "w",
    opponentOfferedDraw: false,
  });
  check("ATTACK: accepting a draw nobody offered is refused", fakeDraw.allowed === false);

  // 6. An illegal move stream can never complete, whatever the intent.
  const tampered = V.verifyGame(["e4", "e5", "Qz9"]);
  for (const intent of ["claim_result", "accept_draw"]) {
    const d = V.decideCompletion({
      intent,
      verified: tampered,
      requesterColor: "w",
      opponentOfferedDraw: true,
    });
    check(`ATTACK: ${intent} on a tampered move stream is refused`, d.allowed === false);
  }
}

// ---- resignation is safe by construction ----
{
  const asWhite = V.decideCompletion({
    intent: "resign",
    verified: V.verifyGame(["e4"]),
    requesterColor: "w",
    opponentOfferedDraw: false,
  });
  check("resigning is always allowed", asWhite.allowed === true);
  check("ATTACK: a resigning player cannot win — white resigns, black wins",
    asWhite.winner === "b", asWhite.winner);

  const asBlack = V.decideCompletion({
    intent: "resign",
    verified: V.verifyGame(["e4", "e5"]),
    requesterColor: "b",
    opponentOfferedDraw: false,
  });
  check("black resigning gives white the win", asBlack.winner === "w", asBlack.winner);

  // Resignation on move one is legitimate and must still work.
  const immediate = V.decideCompletion({
    intent: "resign",
    verified: V.verifyGame([]),
    requesterColor: "w",
    opponentOfferedDraw: false,
  });
  check("resigning on move one is allowed", immediate.allowed === true && immediate.winner === "b");

  // A resignation on a tampered stream is still refused — the game is not real.
  const badStream = V.decideCompletion({
    intent: "resign",
    verified: V.verifyGame(["Qz9"]),
    requesterColor: "w",
    opponentOfferedDraw: false,
  });
  check("resignation on an illegal stream is refused", badStream.allowed === false);
}

// ---- legitimate completions ----
{
  const mate = V.decideCompletion({
    intent: "claim_result",
    verified: V.verifyGame(SCHOLARS_MATE),
    requesterColor: "w",
    opponentOfferedDraw: false,
  });
  check("a genuine checkmate completes", mate.allowed === true && mate.winner === "w");
  check("the reason names checkmate", mate.reason === "checkmate");

  const stale = V.decideCompletion({
    intent: "claim_result",
    verified: V.verifyGame(STALEMATE),
    requesterColor: "w",
    opponentOfferedDraw: false,
  });
  check("a genuine stalemate completes as a draw", stale.allowed === true && stale.winner === "draw");

  const agreed = V.decideCompletion({
    intent: "accept_draw",
    verified: V.verifyGame(["e4", "e5"]),
    requesterColor: "b",
    opponentOfferedDraw: true,
  });
  check("a draw with a real offer completes", agreed.allowed === true && agreed.winner === "draw");
}

// ---- colour derivation ----
{
  check("the host takes the host colour", V.colorOf("h", "h", "w") === "w");
  check("the guest takes the other colour", V.colorOf("g", "h", "w") === "b");
  check("a black host gives the guest white", V.colorOf("g", "h", "b") === "w");
}

console.log(`\n=== GAME VERIFICATION: ${pass} passed, ${failures.length} failed ===`);
if (failures.length) {
  console.error("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
  process.exitCode = 1;
}

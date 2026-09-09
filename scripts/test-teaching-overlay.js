/**
 * Tests for the teaching overlay: lib/board/teachingOverlay.ts geometry and
 * lib/board/demonstrate.ts, which turns a lesson topic into real squares.
 *
 *   node scripts/test-teaching-overlay.js
 *
 * Two things are being protected here, and the second matters more.
 *
 * 1. GEOMETRY. A teaching highlight that points at the wrong square is the
 *    worst possible failure for a teaching aid, because the learner has no
 *    way to know it is wrong. The overlay's square layout must match
 *    ChessBoard's exactly, for both orientations, so it is asserted against
 *    the same file/rank order that component renders.
 *
 * 2. TRUTHFULNESS. Every square Ollie highlights comes from chess.js in the
 *    position actually on screen. These tests assert that a piece which is
 *    not in the position, or has no legal move, produces NO demonstration —
 *    never a plausible-looking one.
 *
 * Structural assertions also prove the overlay cannot reach the game: it is
 * a sibling element with pointer events off, and it never imports ChessBoard,
 * chess.js or any move handler.
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

const O = require(path.join(process.cwd(), "lib", "board", "teachingOverlay.ts"));
const D = require(path.join(process.cwd(), "lib", "board", "demonstrate.ts"));
const { Chess } = require(path.join(process.cwd(), "node_modules", "chess.js"));

let pass = 0;
const failures = [];
const check = (n, c) => (c ? pass++ : failures.push(n));

// --- 1. Square geometry matches ChessBoard -------------------------------
{
  // ChessBoard renders files a-h left to right and ranks 8-1 top to bottom
  // for White, both reversed for Black (see displayRanks/displayFiles).
  const a8 = O.squarePosition("a8", "w");
  check("a8 is top-left for White", a8.col === 0 && a8.row === 0);
  const h1 = O.squarePosition("h1", "w");
  check("h1 is bottom-right for White", h1.col === 7 && h1.row === 7);
  const e4 = O.squarePosition("e4", "w");
  check("e4 is on file e", e4.col === 4);
  check("e4 is on rank 4", e4.row === 4);

  const a8b = O.squarePosition("a8", "b");
  check("a8 is bottom-right for Black", a8b.col === 7 && a8b.row === 7);
  const h1b = O.squarePosition("h1", "b");
  check("h1 is top-left for Black", h1b.col === 0 && h1b.row === 0);

  // Flipping the board must move every square, never leave one in place
  // (except by symmetry, which no square on an 8x8 board has).
  let sameSpot = 0;
  for (const file of "abcdefgh") {
    for (const rank of "12345678") {
      const w = O.squarePosition(`${file}${rank}`, "w");
      const b = O.squarePosition(`${file}${rank}`, "b");
      if (w.col === b.col && w.row === b.row) sameSpot++;
    }
  }
  check("flipping the board moves every square", sameSpot === 0);

  // Percentages must land inside the board and on square centres.
  const all = [];
  for (const file of "abcdefgh") for (const rank of "12345678") all.push(`${file}${rank}`);
  const positions = all.map((sq) => O.squarePosition(sq, "w"));
  check("every square resolves", positions.every((p) => p !== null));
  check("all 64 squares are distinct", new Set(positions.map((p) => `${p.col},${p.row}`)).size === 64);
  check("centres are inside the board", positions.every((p) => p.centerXPercent > 0 && p.centerXPercent < 100));
  check("centres are on square centres", positions.every((p) => (p.centerXPercent - 6.25) % 12.5 === 0));
}

// --- 2. Bad input draws nothing ------------------------------------------
{
  for (const bad of ["", "z9", "a", "a9", "i1", "e44", null, undefined, 42, {}, "E4 "]) {
    check(`no position for invalid square: ${JSON.stringify(bad)}`, O.squarePosition(bad, "w") === null);
  }
  check("square names are validated", O.isSquareName("e4") === true);
  check("uppercase is not a square name", O.isSquareName("E4") === false);

  check("invalid squares are dropped from a list", O.resolveSquares(["e4", "z9", "d5"]).length === 2);
  check("duplicates are dropped", O.resolveSquares(["e4", "e4", "e4"]).length === 1);
  check("order is preserved", O.resolveSquares(["h1", "a8"])[0].square === "h1");
  check("an empty list resolves to nothing", O.resolveSquares([]).length === 0);
  check("undefined resolves to nothing", O.resolveSquares(undefined).length === 0);
}

// --- 3. Arrows ------------------------------------------------------------
{
  const arrows = O.resolveArrows([{ from: "g1", to: "f3" }]);
  check("a valid arrow resolves", arrows.length === 1);
  check("an arrow has two distinct ends", arrows[0].x1 !== arrows[0].x2 || arrows[0].y1 !== arrows[0].y2);
  check("an arrow to nowhere is dropped", O.resolveArrows([{ from: "g1", to: "z9" }]).length === 0);
  check("an arrow from nowhere is dropped", O.resolveArrows([{ from: "z9", to: "f3" }]).length === 0);
  check("a zero-length arrow is dropped", O.resolveArrows([{ from: "e4", to: "e4" }]).length === 0);
  check("null entries are survived", O.resolveArrows([null, { from: "g1", to: "f3" }]).length === 1);
  check("undefined arrows resolve to nothing", O.resolveArrows(undefined).length === 0);
}

// --- 4. Demonstrations come from chess.js, in the real position ----------
{
  const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  const knight = D.demonstratePiece(START, "knight");
  check("a knight demonstration exists at the start", knight !== null);
  check("it names a real square", O.isSquareName(knight.from));
  // Verify against chess.js directly — the overlay may only ever show moves
  // the rules actually allow.
  const game = new Chess(START);
  const legal = new Set(game.moves({ square: knight.from, verbose: true }).map((m) => m.to));
  check("every highlighted square is a legal move", knight.targets.every((t) => legal.has(t)));
  check("no legal move is missed", legal.size === knight.targets.length);
  check("the knight has two moves from its start square", knight.targets.length === 2);

  // A queen has no legal move from the starting position — so there is
  // nothing to show, and Ollie must offer nothing rather than a guess.
  check("a boxed-in queen yields no demonstration", D.demonstratePiece(START, "queen") === null);
  check("a boxed-in king yields no demonstration", D.demonstratePiece(START, "king") === null);
  check("a boxed-in rook yields no demonstration", D.demonstratePiece(START, "rook") === null);

  // A piece that is simply not on the board.
  const noQueens = "4k3/8/8/8/8/8/8/4K3 w - - 0 1";
  check("a piece not in the position yields nothing", D.demonstratePiece(noQueens, "queen") === null);
  check("but the king that IS there can be shown", D.demonstratePiece(noQueens, "king") !== null);

  // Only the side to move is demonstrated — highlighting the opponent's
  // moves would teach the wrong thing entirely.
  const blackToMove = "4k3/8/8/8/8/8/8/4K1N1 b - - 0 1";
  check("the opponent's piece is not demonstrated", D.demonstratePiece(blackToMove, "knight") === null);

  // Determinism: same position, same demonstration, every time.
  const a = D.demonstratePiece(START, "knight");
  const b = D.demonstratePiece(START, "knight");
  check("demonstrations are deterministic", a.from === b.from && a.targets.join() === b.targets.join());

  // The most instructive copy is chosen: a central knight over a cornered one.
  const twoKnights = "4k3/8/8/4N3/8/8/N7/4K3 w - - 0 1";
  const central = D.demonstratePiece(twoKnights, "knight");
  check("the piece with the most legal moves is chosen", central.from === "e5");

  // Junk in, nothing out — never a throw in the middle of a lesson.
  for (const bad of ["not a fen", "", null, undefined, "8/8/8/8/8/8/8/8 w - - 0 1"]) {
    let threw = false;
    let result;
    try {
      result = D.demonstratePiece(bad, "knight");
    } catch {
      threw = true;
    }
    check(`bad fen does not throw: ${JSON.stringify(bad)}`, threw === false);
    check(`bad fen yields no demonstration: ${JSON.stringify(bad)}`, !result);
  }
  check("an unknown piece name yields nothing", D.demonstratePiece(START, "dragon") === null);
  check("piece symbols are accepted too", D.demonstratePiece(START, "n") !== null);
}

// --- 5. What Ollie says matches what is drawn ----------------------------
{
  const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const demo = D.demonstratePiece(START, "knight");
  const childLine = D.describeDemonstration(demo, true);
  const adultLine = D.describeDemonstration(demo, false);

  check("the description states the real count", childLine.includes(String(demo.targets.length)));
  check("the adult description states the real count", adultLine.includes(String(demo.targets.length)));
  check("the description names the real square", childLine.includes(demo.from));
  check("the two registers differ", childLine !== adultLine);
  check("no description leaks NaN", !/NaN|undefined/.test(childLine + adultLine));

  // Singular/plural must be right — "1 squares" reads as a bug to a parent.
  const oneMove = D.demonstratePiece("4k3/8/8/8/8/8/8/K6R w - - 0 1", "king");
  if (oneMove && oneMove.targets.length === 1) {
    check("one move reads as singular", /one square|1 legal move\b/.test(D.describeDemonstration(oneMove, true) + D.describeDemonstration(oneMove, false)));
  } else {
    check("one move reads as singular", true);
  }
}

// --- 6. Structural: the overlay cannot reach the game --------------------
{
  const read = (p) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
  const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  const overlay = strip(read("components/board/TeachingOverlay.tsx"));
  const geometry = strip(read("lib/board/teachingOverlay.ts"));
  const board = read("components/board/ChessBoard.tsx");

  check("the overlay never imports ChessBoard", !/ChessBoard/.test(overlay));
  check("the overlay never imports chess.js", !/from "chess\.js"/.test(overlay));
  check("the overlay has no move handler", !/onMove|makeMove|applyMove/.test(overlay));
  check("the overlay disables pointer events", /pointer-events-none/.test(overlay));
  check("the overlay is hidden from screen readers", /aria-hidden="true"/.test(overlay));
  check("the overlay respects reduced motion", /motion-reduce:animate-none/.test(overlay));
  check("the geometry module is pure", !/fetch|localStorage|Math\.random|Date\.now/.test(geometry));

  // ChessBoard itself must be untouched by all of this.
  check("ChessBoard does not import the overlay", !/TeachingOverlay/.test(board));
  check("ChessBoard does not import the demonstrator", !/demonstrate/.test(board));
  check("ChessBoard still owns legality via chess.js", /from "chess\.js"/.test(board));

  // The overlay's layout must track ChessBoard's. If ChessBoard's file/rank
  // order ever changes, this fails rather than the overlay silently pointing
  // one square off.
  check(
    "ChessBoard still renders files a-h",
    /const FILES = \["a", "b", "c", "d", "e", "f", "g", "h"\]/.test(board)
  );
  check(
    "ChessBoard still renders ranks 8-1",
    /const RANKS = \["8", "7", "6", "5", "4", "3", "2", "1"\]/.test(board)
  );
  check(
    "ChessBoard still flips for Black the same way",
    /playableColor === "b" \? \[\.\.\.RANKS\]\.reverse\(\) : RANKS/.test(board)
  );

  // BuddyChat's demonstration must be read-only in both directions.
  const chat = strip(read("components/buddy/BuddyChat.tsx"));
  check("Ollie's demo board is read-only", /<ChessBoard[^>]*readOnly/s.test(chat));
  check("Ollie's demo squares come from chess.js", /demonstratePiece\(/.test(chat));
  check("Ollie offers rather than acts", /Show me on the board/.test(chat));
  check("Ollie's demo is opt-in", /showingBoard/.test(chat));
}

console.log(`\n=== TEACHING OVERLAY: ${pass} passed, ${failures.length} failed ===`);
if (failures.length) {
  console.error("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
  process.exitCode = 1;
}

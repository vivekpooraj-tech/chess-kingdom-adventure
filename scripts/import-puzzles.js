// Convert an externally-sourced puzzle batch into the project's candidate
// format (see scripts/puzzle-candidates.example.json and the header of
// scripts/verify-puzzles.js for the field spec).
//
//   node scripts/import-puzzles.js <source.csv> [options]
//
// Options:
//   --out <path>        where to write the candidate JSON
//                       (default: scripts/puzzle-candidates.imported.json)
//   --limit <n>         stop after converting n candidates (default: 20)
//   --max-rating <n>    skip source puzzles rated above n; 0 disables
//                       (default: 1600 — a coarse beginner cut, NOT a
//                       substitute for human review)
//
// SOURCE FORMAT — the Lichess open puzzle database CSV
// (https://database.lichess.org/#puzzles). One row per puzzle, columns:
//   PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
//   - FEN     : the position BEFORE the opponent's blunder.
//   - Moves   : UCI, space-separated. Moves[0] is the opponent's move that
//               starts the puzzle; Moves[1] is the solver's key move; the
//               rest alternate. The PUZZLE position is FEN after Moves[0].
//   - Themes  : space-separated tags; we only import ones tagged mateIn1/2/3.
//
// This script ONLY writes a candidate file. It never touches
// content/puzzles.ts. Every converted candidate must then pass
//   node scripts/verify-puzzles.js <out>
// AND a human/chess-literate review (tactical value, beginner suitability,
// visual clarity, "does the solution teach something") before anyone pastes
// it into content/puzzles.ts with a level from compute-puzzle-levels.js.

const fs = require("fs");
const path = require("path");
const { Chess } = require("chess.js");

// Lichess mate-theme tag -> human label matching the style already used in
// content/puzzles.ts ("Back-Rank Mate", "Smothered Mate", ...). Anything not
// listed falls back to a title-cased version of the tag, or a generic label.
const MATE_THEME_LABELS = {
  backRankMate: "Back-Rank Mate",
  smotheredMate: "Smothered Mate",
  arabianMate: "Arabian Mate",
  anastasiaMate: "Anastasia's Mate",
  bodenMate: "Boden's Mate",
  hookMate: "Hook Mate",
  doubleBishopMate: "Double Bishop Mate",
  dovetailMate: "Dovetail Mate",
  killBoxMate: "Kill Box Mate",
  vukovicMate: "Vukovic Mate",
  cornerMate: "Corner Mate",
};

function parseArgs(argv) {
  const opts = { out: path.join(__dirname, "puzzle-candidates.imported.json"), limit: 20, maxRating: 1600 };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") opts.out = argv[++i];
    else if (a === "--limit") opts.limit = Number(argv[++i]);
    else if (a === "--max-rating") opts.maxRating = Number(argv[++i]);
    else positional.push(a);
  }
  opts.source = positional[0];
  return opts;
}

// Minimal CSV row splitter — handles double-quoted fields with embedded
// commas. The Lichess columns we read (FEN, Moves) contain spaces but no
// commas, so this is enough without pulling in a CSV dependency.
function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

function uciToMoveObj(uci) {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length > 4 ? uci[4] : undefined };
}

function mateInFromThemes(themes) {
  if (themes.includes("mateIn1")) return 1;
  if (themes.includes("mateIn2")) return 2;
  if (themes.includes("mateIn3")) return 3;
  return null;
}

function themeLabel(themes, mateIn) {
  for (const t of themes) {
    if (MATE_THEME_LABELS[t]) return MATE_THEME_LABELS[t];
  }
  // A named mate pattern tag we don't have a nice label for yet?
  const namedMate = themes.find((t) => /Mate$/.test(t) && t !== "mate");
  if (namedMate) return namedMate.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
  return `Checkmate in ${mateIn}`;
}

/**
 * Convert one Lichess CSV record into a candidate object, or return
 * { skip, reason } if it isn't importable. Pure — no I/O.
 */
function convertLichessRecord(rec) {
  const { PuzzleId, FEN, Moves, Rating, Themes } = rec;
  if (!PuzzleId || !FEN || !Moves) return { skip: true, reason: "missing PuzzleId/FEN/Moves" };

  const themes = (Themes || "").split(/\s+/).filter(Boolean);
  const mateIn = mateInFromThemes(themes);
  if (!mateIn) return { skip: true, reason: "not a mateIn1/2/3 puzzle" };

  const uciMoves = Moves.trim().split(/\s+/);
  if (uciMoves.length < 2) return { skip: true, reason: "solution has no key move" };

  const game = new Chess(FEN);
  if (!game.move(uciToMoveObj(uciMoves[0]))) return { skip: true, reason: "opponent move (Moves[0]) illegal from FEN" };
  const puzzleFen = game.fen();
  const sideToMove = game.turn();

  // Number of solver moves in the line should match the declared mate depth.
  const solverMoves = Math.ceil((uciMoves.length - 1) / 2);
  if (solverMoves !== mateIn) return { skip: true, reason: `line length implies mate-in-${solverMoves}, theme says mate-in-${mateIn}` };

  const keyMove = game.move(uciToMoveObj(uciMoves[1]));
  if (!keyMove) return { skip: true, reason: "solver key move (Moves[1]) illegal" };

  return {
    candidate: {
      id: `lichess-${PuzzleId}`,
      fen: puzzleFen,
      sideToMove,
      mateIn,
      theme: themeLabel(themes, mateIn),
      firstMove: keyMove.san,
      // provenance — ignored by the validator and by the runtime, kept so a
      // reviewer can trace every candidate back to its source.
      source: "lichess",
      sourceId: PuzzleId,
      sourceRating: Rating ? Number(Rating) : undefined,
      sourceUrl: `https://lichess.org/training/${PuzzleId}`,
    },
  };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.source) {
    console.error("Usage: node scripts/import-puzzles.js <source.csv> [--out <path>] [--limit <n>] [--max-rating <n>]");
    process.exit(2);
  }
  if (!fs.existsSync(opts.source)) {
    console.error(`Source file not found: ${opts.source}`);
    process.exit(2);
  }

  const lines = fs.readFileSync(opts.source, "utf8").split(/\r?\n/).filter((l) => l.trim() !== "");
  // A header row is optional; detect it by the well-known first column name.
  let start = 0;
  let header = ["PuzzleId", "FEN", "Moves", "Rating", "RatingDeviation", "Popularity", "NbPlays", "Themes", "GameUrl", "OpeningTags"];
  if (/^PuzzleId,/i.test(lines[0])) { header = splitCsvLine(lines[0]); start = 1; }

  const candidates = [];
  const skipped = [];
  for (let i = start; i < lines.length && candidates.length < opts.limit; i++) {
    const cols = splitCsvLine(lines[i]);
    const rec = {};
    header.forEach((h, idx) => (rec[h] = cols[idx]));

    if (opts.maxRating > 0 && rec.Rating && Number(rec.Rating) > opts.maxRating) {
      skipped.push({ id: rec.PuzzleId, reason: `rating ${rec.Rating} > --max-rating ${opts.maxRating}` });
      continue;
    }

    let result;
    try {
      result = convertLichessRecord(rec);
    } catch (e) {
      result = { skip: true, reason: `conversion error: ${e.message}` };
    }
    if (result.skip) skipped.push({ id: rec.PuzzleId, reason: result.reason });
    else candidates.push(result.candidate);
  }

  fs.writeFileSync(opts.out, JSON.stringify(candidates, null, 2) + "\n");

  console.log(`Converted ${candidates.length} candidate(s) -> ${opts.out}`);
  if (skipped.length) {
    console.log(`Skipped ${skipped.length}:`);
    skipped.forEach((s) => console.log(`  - ${s.id || "(row)"}: ${s.reason}`));
  }
  console.log("");
  console.log("NEXT: validate, then human-review before shipping —");
  console.log(`  node scripts/verify-puzzles.js ${opts.out}`);
  console.log("  (technical pass != production-ready: a reviewer must still judge tactical");
  console.log("   value, beginner suitability, visual clarity, and duplicate-feeling positions.)");
}

if (require.main === module) main();

module.exports = { convertLichessRecord, splitCsvLine, themeLabel, mateInFromThemes };

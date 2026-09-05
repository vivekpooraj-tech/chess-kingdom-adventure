/**
 * Tests for lib/stats/tournamentRecord.ts.
 *
 *   node scripts/test-tournament-record.js
 *
 * Finish positions are derived, not stored, so the ranking rules are the thing
 * worth testing: ties must share a position rather than being broken by
 * arbitrary row order, and a "win" against one opponent must not be counted
 * alongside a win in a real field.
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
const T = require(path.join(process.cwd(), "lib", "stats", "tournamentRecord.ts"));

let pass = 0;
const failures = [];
const check = (n, c) => (c ? pass++ : failures.push(n));

const part = (o) => ({
  tournamentId: o.id ?? "t1",
  tournamentName: o.name ?? "Friday Blitz",
  status: o.status ?? "completed",
  points: o.points,
  allPoints: o.all,
  endedAt: o.endedAt ?? "2026-01-01T00:00:00Z",
});

// ---- competition ranking ----
check("top score is first", T.positionOf(5, [5, 3, 1]) === 1);
check("second score is second", T.positionOf(3, [5, 3, 1]) === 2);
check("ties share the higher position", T.positionOf(3, [5, 3, 3, 1]) === 2);
check("position after a tie skips", T.positionOf(1, [5, 3, 3, 1]) === 4);
check("a tie is reported as shared", T.isShared(3, [5, 3, 3, 1]) === true);
check("a unique score is not shared", T.isShared(5, [5, 3, 3, 1]) === false);
check("everyone tied is first", T.positionOf(2, [2, 2, 2]) === 1);

// ---- record aggregation ----
{
  const r = T.buildTournamentRecord([
    part({ id: "a", points: 5, all: [5, 4, 3, 2] }),        // 1st of 4 - win + podium
    part({ id: "b", points: 3, all: [6, 5, 3, 2, 1] }),     // 3rd of 5 - podium
    part({ id: "c", points: 1, all: [9, 7, 5, 3, 1] }),     // 5th of 5
    part({ id: "d", points: 2, all: [2, 1], }),             // 1st of 2 - too small to count
    part({ id: "e", status: "active", points: 4, all: [4] }),
  ]);
  check("entered counts every participation", r.entered === 5);
  check("only completed events have finishes", r.finished === 4);
  check("a two-player win is not counted as a win", r.wins === 1);
  check("podiums require a field of at least four", r.podiums === 2);
  check("best finish identified", r.best.tournamentId === "a");
}

// ---- best finish prefers the bigger field on equal position ----
{
  const r = T.buildTournamentRecord([
    part({ id: "small", points: 3, all: [3, 2, 1] }),
    part({ id: "big", points: 9, all: [9, 8, 7, 6, 5, 4, 3] }),
  ]);
  check("equal positions: bigger field wins", r.best.tournamentId === "big");
}

// ---- empty and degenerate ----
{
  const empty = T.buildTournamentRecord([]);
  check("no participations -> empty record", empty.entered === 0 && empty.best === null);
  const activeOnly = T.buildTournamentRecord([part({ status: "active", points: 1, all: [1, 2] })]);
  check("an in-progress event has no finish", activeOnly.finished === 0 && activeOnly.best === null);
  const noPoints = T.buildTournamentRecord([part({ points: 0, all: [] })]);
  check("a tournament with no participants is skipped", noPoints.finished === 0);
}

// ---- recent ordering ----
{
  const r = T.buildTournamentRecord([
    part({ id: "old", points: 1, all: [1], endedAt: "2026-01-01T00:00:00Z" }),
    part({ id: "new", points: 1, all: [1], endedAt: "2026-06-01T00:00:00Z" }),
  ]);
  check("recent is newest first", r.recent[0].tournamentId === "new");
}

// ---- description ----
{
  const f = (position, playerCount, shared = false) => ({ position, playerCount, shared });
  check("1st", T.describeFinish(f(1, 8)) === "1st of 8");
  check("2nd", T.describeFinish(f(2, 8)) === "2nd of 8");
  check("3rd", T.describeFinish(f(3, 8)) === "3rd of 8");
  check("4th", T.describeFinish(f(4, 8)) === "4th of 8");
  check("11th is not 11st", T.describeFinish(f(11, 20)) === "11th of 20");
  check("12th is not 12nd", T.describeFinish(f(12, 20)) === "12th of 20");
  check("13th is not 13rd", T.describeFinish(f(13, 20)) === "13th of 20");
  check("21st", T.describeFinish(f(21, 30)) === "21st of 30");
  check("shared positions say so", T.describeFinish(f(3, 8, true)) === "joint 3rd of 8");
}

console.log(`\n=== TOURNAMENT RECORD: ${pass} passed, ${failures.length} failed ===`);
if (failures.length) {
  console.error("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
  process.exit(1);
}

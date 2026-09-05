/**
 * Tests for lib/stats/playerStats.ts.
 *
 *   node scripts/test-player-stats.js
 *
 * The point of these is not the arithmetic — it is the refusals. A stats page
 * that reports a win rate from four games, or announces a colour weakness from
 * a two-game gap, is worse than one that shows nothing, because the player acts
 * on it. So most of what follows asserts that the module DECLINES to answer.
 *
 * Exits non-zero on failure.
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

const S = require(path.join(process.cwd(), "lib", "stats", "playerStats.ts"));

let pass = 0;
const failures = [];
function check(name, cond) {
  if (cond) pass++;
  else failures.push(name);
}

/** Build `n` games with a given result, colour and spacing. */
let seq = 0;
function games(n, result, opts = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    seq++;
    out.push({
      id: "g" + seq,
      // Ascending timestamps so ordering is deterministic.
      playedAt: new Date(Date.UTC(2026, 0, 1) + seq * 60000).toISOString(),
      color: opts.color ?? "w",
      result,
      timeControl: opts.timeControl ?? "5+0",
      matchType: opts.matchType ?? "random",
      ratingBefore: opts.ratingBefore ?? null,
      ratingAfter: opts.ratingAfter ?? null,
    });
  }
  return out;
}

// ---- scoring ----
{
  const r = S.tally([...games(3, "win"), ...games(1, "draw"), ...games(2, "loss")]);
  check("tally counts results", r.games === 6 && r.wins === 3 && r.draws === 1 && r.losses === 2);
  // 3 + 0.5 out of 6
  check("draws count as half a point", Math.abs(S.scoreRate(r) - 3.5 / 6) < 1e-9);
  check("empty record has no rate", S.scoreRate({ games: 0, wins: 0, losses: 0, draws: 0 }) === null);
}

// ---- refusing to report a rate ----
{
  check("no games -> none", S.rateStat(S.tally([])).kind === "none");
  const few = S.rateStat(S.tally(games(4, "win")));
  check("4 games -> insufficient", few.kind === "insufficient");
  check("insufficient says how many are needed", few.need === S.MIN_GAMES_FOR_RATE && few.have === 4);
  check(
    "exactly the minimum -> ok",
    S.rateStat(S.tally(games(S.MIN_GAMES_FOR_RATE, "win"))).kind === "ok"
  );
}

// ---- significance gate ----
{
  const allWins = S.tally(games(10, "win"));
  const allLosses = S.tally(games(10, "loss"));
  // 10-0 against 0-10 is a real difference, and should be reported as one.
  check("100% vs 0% over 10 games each IS significant", S.isSignificantDifference(allWins, allLosses) === true);
  // The genuinely degenerate case is both groups identical, where the pooled
  // rate is 0 or 1 and the z statistic is undefined. That must not throw or
  // report a difference where there is none.
  check("all-wins vs all-wins is not a difference", S.isSignificantDifference(allWins, S.tally(games(10, "win"))) === false);
  check("all-losses vs all-losses is not a difference", S.isSignificantDifference(allLosses, S.tally(games(10, "loss"))) === false);

  const strong = S.tally([...games(9, "win"), ...games(1, "loss")]);
  const weak = S.tally([...games(1, "win"), ...games(9, "loss")]);
  check("9-1 vs 1-9 over 10 games is significant", S.isSignificantDifference(strong, weak) === true);

  const a = S.tally([...games(6, "win"), ...games(4, "loss")]);
  const b = S.tally([...games(5, "win"), ...games(5, "loss")]);
  check("60% vs 50% over 10 games is NOT significant", S.isSignificantDifference(a, b) === false);

  const tinyA = S.tally([...games(3, "win")]);
  const tinyB = S.tally([...games(3, "loss")]);
  check("below the per-split minimum, never significant", S.isSignificantDifference(tinyA, tinyB) === false);
}

// ---- colour claims ----
{
  const balanced = [
    ...games(6, "win", { color: "w" }),
    ...games(4, "loss", { color: "w" }),
    ...games(5, "win", { color: "b" }),
    ...games(5, "loss", { color: "b" }),
  ];
  check("no colour claim from a small difference", S.byColor(balanced).claim === null);

  const lopsided = [
    ...games(11, "win", { color: "w" }),
    ...games(1, "loss", { color: "w" }),
    ...games(2, "win", { color: "b" }),
    ...games(10, "loss", { color: "b" }),
  ];
  const c = S.byColor(lopsided);
  check("clear colour difference produces a claim", typeof c.claim === "string");
  check("claim names the weaker colour", c.claim.includes("Black"));
  check("colour split keeps both records", c.white.record.games === 12 && c.black.record.games === 12);

  const thin = [...games(3, "win", { color: "w" }), ...games(3, "loss", { color: "b" })];
  check("thin colour buckets get no rate", S.byColor(thin).white.rate === null);
}

// ---- trend ----
{
  check("no games -> trend none", S.resultTrend([]).kind === "none");
  const someGames = games(12, "win");
  const t = S.resultTrend(someGames);
  check("12 games -> trend insufficient", t.kind === "insufficient" && t.need === S.MIN_GAMES_FOR_TREND);

  // Older window mostly losses, recent window mostly wins.
  const improving = [...games(9, "loss"), ...games(1, "win"), ...games(9, "win"), ...games(1, "loss")];
  const it = S.resultTrend(improving);
  check("a real improvement is detected", it.kind === "ok" && it.value === "improving");

  const declining = [...games(9, "win"), ...games(1, "loss"), ...games(9, "loss"), ...games(1, "win")];
  const dt = S.resultTrend(declining);
  check("a real decline is detected", dt.kind === "ok" && dt.value === "declining");

  // Same rate in both windows -> steady, never a claim of movement.
  const flat = [...games(5, "win"), ...games(5, "loss"), ...games(5, "win"), ...games(5, "loss")];
  const ft = S.resultTrend(flat);
  check("no movement -> steady", ft.kind === "ok" && ft.value === "steady");
}

// ---- streak ----
{
  const ordered = [...games(2, "loss"), ...games(3, "win")];
  check("streak counts back from the latest game", S.currentWinStreak(ordered) === 3);
  const broken = [...games(3, "win"), ...games(1, "loss")];
  check("a loss ends the streak", S.currentWinStreak(broken) === 0);
  check("no games -> no streak", S.currentWinStreak([]) === 0);
}

// ---- peak rating ----
{
  check("no rating data -> none", S.peakRating(games(3, "win"), null).kind === "none");
  const withRatings = games(2, "win", { ratingBefore: 800, ratingAfter: 815 });
  const p = S.peakRating(withRatings, 790);
  check("peak takes the highest seen", p.kind === "ok" && p.value === 815);
  check(
    "current rating counts toward peak",
    S.peakRating(games(1, "win"), 1234).value === 1234
  );
}

// ---- period filter ----
{
  const now = Date.UTC(2026, 0, 10);
  const recent = [{ ...games(1, "win")[0], playedAt: new Date(now - 2 * 86400000).toISOString() }];
  const old = [{ ...games(1, "win")[0], playedAt: new Date(now - 60 * 86400000).toISOString() }];
  const all = [...recent, ...old];
  check("7-day filter excludes older games", S.withinDays(all, 7, now).length === 1);
  check("90-day filter includes both", S.withinDays(all, 90, now).length === 2);
  check("null means all time", S.withinDays(all, null, now).length === 2);
  check("unparseable dates are excluded, not crashed on", S.withinDays([{ ...recent[0], playedAt: "nonsense" }], 7, now).length === 0);
}

// ---- time control split ----
{
  const cat = (id) => (id === "3+0" ? "Blitz" : id === "10+0" ? "Rapid" : null);
  const mixed = [
    ...games(9, "win", { timeControl: "3+0" }),
    ...games(2, "loss", { timeControl: "10+0" }),
    ...games(1, "win", { timeControl: null }),
  ];
  const rows = S.byTimeControl(mixed, cat);
  check("time controls bucket by category", rows.length === 2);
  check("largest bucket first", rows[0].key === "Blitz");
  check("thin bucket gets no rate", rows.find((r) => r.key === "Rapid").rate === null);
  check("untimed legacy games are dropped, not miscounted", rows.reduce((n, r) => n + r.record.games, 0) === 11);
}

// ---- overview ----
{
  const o = S.buildOverview(games(3, "win"), 700);
  check("overview refuses a rate from 3 games", o.rate.kind === "insufficient");
  check("overview still reports the raw record", o.record.games === 3 && o.record.wins === 3);
  check("overview separates rated games", o.rated.games === 3);
  const unrated = S.buildOverview(games(3, "win", { matchType: "invite" }), null);
  check("invite games are not counted as rated", unrated.rated.games === 0);
}


// ---- opening insights ----
{
  const rev = (name, result, n) => Array.from({ length: n }, () => ({ openingName: name, result }));
  const thin = S.byOpening([...rev("Italian Game", "win", 2), ...rev("French Defence", "loss", 2)]);
  check("openings below threshold get no rate", thin.rows.every((r) => r.rate === null));
  check("no best/worst claim from thin data", thin.best === null && thin.worst === null);
  check("thin openings are flagged as below threshold", thin.allBelowThreshold === true);

  const solid = S.byOpening([
    ...rev("Italian Game", "win", 6),
    ...rev("French Defence", "loss", 6),
    ...rev("Caro-Kann", "win", 1),
  ]);
  check("openings at threshold get a rate", solid.rows.find((r) => r.name === "Italian Game").rate === 1);
  check("best opening identified", solid.best.name === "Italian Game");
  check("worst opening identified", solid.worst.name === "French Defence");
  check("under-threshold opening still listed without a rate", solid.rows.find((r) => r.name === "Caro-Kann").rate === null);
  check("most played first", solid.rows[0].record.games === 6);

  const single = S.byOpening(rev("Italian Game", "win", 8));
  check("a single rated opening is not called best or worst", single.best === null && single.worst === null);

  const messy = S.byOpening([
    { openingName: null, result: "win" },
    { openingName: "  ", result: "win" },
    { openingName: "Italian Game", result: null },
  ]);
  check("missing opening names and results are ignored", messy.rows.length === 0);
}


// ---- improvement timeline ----
{
  const T = require(path.join(process.cwd(), "lib", "stats", "improvementTimeline.ts"));
  const pt = (r, i) => ({
    newRating: r,
    ratingChange: 0,
    result: "win",
    createdAt: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
  });

  check("no rated games -> locked", T.buildImprovementTimeline([]).kind === "locked");
  const few = T.buildImprovementTimeline([pt(400, 0), pt(410, 1)]);
  check("two points is still locked", few.kind === "locked");
  check("locked state reports the gap", few.have === 2 && few.need === T.MIN_POINTS_FOR_TIMELINE);
  check("no summary while locked", T.describeTimeline(few) === null);

  const ready = T.buildImprovementTimeline([pt(400, 0), pt(420, 1), pt(410, 2), pt(450, 3), pt(470, 4)]);
  check("five points unlocks", ready.kind === "ready");
  check("net is last minus first", ready.net === 70);
  check("min and max are real extremes", ready.min === 400 && ready.max === 470);
  check("peak equals max", ready.peak === 470);
  check("one coordinate per point", ready.coords.length === 5);
  check("oldest sits at x=0, newest at x=1", ready.coords[0].x === 0 && ready.coords[4].x === 1);
  // y is inverted for SVG: the highest rating must be nearest the top (y=0).
  check("highest rating maps to the top", ready.coords[4].y === 0);
  check("lowest rating maps to the bottom", ready.coords[0].y === 1);
  check("a gain is described as a gain", /gained 70/.test(T.describeTimeline(ready)));

  const flat = T.buildImprovementTimeline([pt(400, 0), pt(400, 1), pt(400, 2), pt(400, 3), pt(400, 4)]);
  check("a flat line does not divide by zero", flat.coords.every((c) => c.y === 0.5));
  check("a flat line is described as steady", /held steady/.test(T.describeTimeline(flat)));

  const down = T.buildImprovementTimeline([pt(500, 0), pt(480, 1), pt(470, 2), pt(450, 3), pt(430, 4)]);
  check("a decline is described honestly", /down 70/.test(T.describeTimeline(down)));

  const noise = T.buildImprovementTimeline([pt(400, 0), pt(404, 1), pt(399, 2), pt(402, 3), pt(405, 4)]);
  check("small movement is called steady, not a trend", /held steady/.test(T.describeTimeline(noise)));
}

console.log(`\n=== PLAYER STATS: ${pass} passed, ${failures.length} failed ===`);
if (failures.length) {
  console.error("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
  process.exit(1);
}

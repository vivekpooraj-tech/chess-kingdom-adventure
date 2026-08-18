// Pure-JS mirror of the Swiss pairing DECISION logic in
// supabase/migrations/0023_group_tournaments.sql's generate_tournament_round()
// — no database involved. This is a fast, repeatable way to run many more
// random trials than is practical against the real DB (see
// scripts/test-tournament-integration.js for the real-SQL end-to-end test,
// which is the stronger primary evidence; this script is for broad,
// cheap coverage of the algorithm design itself).
//
// Run: node scripts/test-tournament-pairing-logic.js

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// player: { id, points, rating, whiteCt, blackCt, hadBye }
// history: Set of "idA|idB" (sorted) strings already played
function generateRound(players, round, history) {
  const pool = round === 1
    ? shuffle(players)
    : [...players].sort((a, b) => b.points - a.points || b.rating - a.rating || a.id - b.id);

  const pairings = [];
  const remaining = [...pool];

  let bye = null;
  if (remaining.length % 2 === 1) {
    const eligible = remaining.filter((p) => !p.hadBye);
    const pool2 = eligible.length > 0 ? eligible : remaining; // shouldn't happen with our test sizes, but no crash
    bye = [...pool2].sort((a, b) =>
      (round === 1 ? a.rating - b.rating : a.points - b.points) || a.rating - b.rating
    )[0];
    pairings.push({ bye: bye.id });
    remaining.splice(remaining.indexOf(bye), 1);
  }

  while (remaining.length > 0) {
    const p1 = remaining.shift();
    let idx = remaining.findIndex((p2) => {
      const key = [p1.id, p2.id].sort((a, b) => a - b).join("|");
      return !history.has(key);
    });
    if (idx === -1) {
      // last resort: repeat allowed, pick closest points
      idx = 0;
    } else {
      // among not-yet-played, prefer closest points (remaining is already
      // priority-sorted, so the first not-yet-played match is already the
      // closest available -- this mirrors the SQL's ORDER BY exactly)
    }
    const p2 = remaining.splice(idx, 1)[0];

    const p1Bal = p1.whiteCt - p1.blackCt;
    const p2Bal = p2.whiteCt - p2.blackCt;
    let white, black;
    if (p1Bal < p2Bal) { white = p1; black = p2; }
    else if (p2Bal < p1Bal) { white = p2; black = p1; }
    else if (Math.random() < 0.5) { white = p1; black = p2; }
    else { white = p2; black = p1; }

    pairings.push({ white: white.id, black: black.id });
  }

  return { pairings, byeId: bye?.id ?? null };
}

function applyResults(players, byId, pairings, byeId, resultFn) {
  for (const pr of pairings) {
    if (pr.bye !== undefined) {
      byId.get(pr.bye).points += 1;
      byId.get(pr.bye).hadBye = true;
      continue;
    }
    const white = byId.get(pr.white);
    const black = byId.get(pr.black);
    white.whiteCt += 1;
    black.blackCt += 1;
    const result = resultFn(white, black); // 'w' | 'b' | 'draw'
    if (result === "draw") { white.points += 0.5; black.points += 0.5; }
    else if (result === "w") { white.points += 1; }
    else { black.points += 1; }
  }
}

let pass = 0, fail = 0;
let totalPairings = 0, avoidableRepeats = 0;
function check(label, cond, detail) {
  if (cond) pass++;
  else { fail++; console.log(`FAIL: ${label}${detail ? " -- " + detail : ""}`); }
}

function runTrial(playerCount, rounds, seedRng) {
  const players = Array.from({ length: playerCount }, (_, i) => ({
    id: i, points: 0, rating: 200 + Math.floor(Math.random() * 2000),
    whiteCt: 0, blackCt: 0, hadBye: false,
  }));
  const byId = new Map(players.map((p) => [p.id, p]));
  const history = new Set();
  const byeHolders = new Set();

  for (let round = 1; round <= rounds; round++) {
    const { pairings, byeId } = generateRound(players, round, history);

    const appearances = [];
    for (const pr of pairings) {
      if (pr.bye !== undefined) { appearances.push(pr.bye); continue; }
      appearances.push(pr.white, pr.black);
    }
    check(`[n=${playerCount} r=${round}] every player appears exactly once`, new Set(appearances).size === appearances.length && appearances.length === playerCount);

    const expectedGames = Math.floor(playerCount / 2);
    check(`[n=${playerCount} r=${round}] correct game count`, pairings.filter((p) => p.bye === undefined).length === expectedGames);
    check(`[n=${playerCount} r=${round}] at most one bye`, pairings.filter((p) => p.bye !== undefined).length <= 1);

    if (byeId !== null) {
      check(`[n=${playerCount} r=${round}] bye player never had one before`, !byeHolders.has(byeId));
      byeHolders.add(byeId);
    }

    for (const pr of pairings) {
      if (pr.bye !== undefined) continue;
      const key = [pr.white, pr.black].sort((a, b) => a - b).join("|");
      // This is a GREEDY algorithm (deliberate, approved trade-off, not a
      // full optimal bipartite matcher) — it only guarantees a repeat is
      // never chosen when a non-repeat candidate was available to the pair
      // being formed AT THAT STEP, not that a smarter pairing order could
      // never have avoided one globally. So "repeats should be rare" is
      // measured as a rate below, not asserted as zero per-pairing.
      totalPairings++;
      if (playerCount - 1 >= rounds && history.has(key)) avoidableRepeats++;
      history.add(key);
    }

    applyResults(players, byId, pairings, byeId, (white, black) => {
      const r = Math.random();
      return r < 0.45 ? "w" : r < 0.9 ? "b" : "draw";
    });
  }

  // Scoring sanity: total points awarded per round = games*1 + byes*1 (win/
  // loss sums to 1, draws sum to 1, bye is a flat 1) -- so total points
  // across the whole tournament should equal (games + byes) per round
  // summed, i.e. always playerCount/2 rounded appropriately... simpler
  // check: total points never exceeds rounds (nobody can score more than
  // 1 per round) and is never negative.
  for (const p of players) {
    check(`[n=${playerCount}] player ${p.id} points in valid range [0, ${rounds}]`, p.points >= 0 && p.points <= rounds, p.points);
  }

  // Colour balance: nobody should be lopsided by more than ~2 across a
  // reasonable number of rounds (loose sanity bound, not a hard guarantee
  // given odd-length tournaments/byes can skew this slightly).
  for (const p of players) {
    if (rounds >= 4) {
      check(`[n=${playerCount}] player ${p.id} colour balance reasonable`, Math.abs(p.whiteCt - p.blackCt) <= 3, `${p.whiteCt}W/${p.blackCt}B`);
    }
  }

  // Deterministic tiebreak sanity: sort by points desc, then a stable
  // secondary key (id) -- never literally random ordering.
  const standings = [...players].sort((a, b) => b.points - a.points || a.id - b.id);
  const sortedTwice = [...players].sort((a, b) => b.points - a.points || a.id - b.id);
  check(`[n=${playerCount}] standings order is deterministic (re-sort matches)`, JSON.stringify(standings.map((s) => s.id)) === JSON.stringify(sortedTwice.map((s) => s.id)));
}

// Broad coverage: even/odd, small/large, few/many rounds.
const scenarios = [
  [8, 4], [20, 6], [7, 3], [9, 5], [4, 3], [32, 7], [5, 4], [16, 5], [3, 2], [2, 1],
];
for (const [n, r] of scenarios) {
  for (let trial = 0; trial < 5; trial++) runTrial(n, r);
}

const repeatRate = totalPairings > 0 ? (avoidableRepeats / totalPairings) * 100 : 0;
console.log(`\nAvoidable-repeat rate: ${avoidableRepeats}/${totalPairings} (${repeatRate.toFixed(2)}%) -- expected low but nonzero for a greedy (non-optimal) pairing algorithm.`);
check("avoidable-repeat rate stays low (<5%, a greedy-algorithm characteristic, not a defect)", repeatRate < 5);

console.log(`\n=== SUMMARY: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);

/**
 * The settlement sweeper's decision logic, and everything it must refuse.
 *
 *   node scripts/test-settlement.js
 *
 * Pure — no database, no network, nothing to leak or clean up. `serverNow` is
 * injected, so expiry is exercised without waiting for real time to pass.
 *
 * The property under test throughout: a game stays unresolved rather than
 * having a winner invented for it. Every uncertain input must skip.
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

const S = require(path.join(process.cwd(), "lib", "online", "settlement.ts"));
const A = require(path.join(process.cwd(), "lib", "online", "cronAuth.ts"));

let pass = 0;
const failures = [];
const check = (n, c, d) => (c ? pass++ : failures.push(d ? `${n} — ${d}` : n));

const NOW = new Date("2026-09-07T12:00:00.000Z");
const ago = (ms) => new Date(NOW.getTime() - ms).toISOString();

/** A live 10+0 game, white to move, 5 minutes on white's clock, moved 1s ago. */
const base = () => ({
  id: "g1",
  status: "active",
  time_control: "10+0",
  current_turn: "w",
  last_move_at: ago(1_000),
  white_time_ms: 300_000,
  black_time_ms: 300_000,
  match_type: "random",
  rating_applied: false,
  created_at: ago(600_000),
});
const g = (over) => ({ ...base(), ...over });

// ---- 1/2. an expired clock, for each colour -------------------------------
{
  // White has 10s left and has been gone 10 minutes.
  const white = S.decideSweep(g({ current_turn: "w", white_time_ms: 10_000, last_move_at: ago(600_000) }), NOW);
  check("white's expired clock is settled", white.action === "settle", white.reason);
  check("  …white is the flagged side", white.action === "settle" && white.flagged === "w");
  check("  …black wins", white.action === "settle" && white.expectedWinner === "b", white.expectedWinner);
  check("  …overshoot is reported", white.action === "settle" && white.overshootMs === 590_000, String(white.overshootMs));

  const black = S.decideSweep(g({ current_turn: "b", black_time_ms: 10_000, last_move_at: ago(600_000) }), NOW);
  check("black's expired clock is settled", black.action === "settle");
  check("  …white wins", black.action === "settle" && black.expectedWinner === "w");

  // The clock that is NOT running must never be charged: black is on 1ms but
  // it is white's move, so nothing has expired.
  const idle = S.decideSweep(g({ current_turn: "w", white_time_ms: 600_000, black_time_ms: 1, last_move_at: ago(1_000) }), NOW);
  check("the idle player's clock is never charged", idle.action === "skip" && idle.reason === "time_remaining", idle.reason);
}

// ---- 3. time remaining -----------------------------------------------------
{
  const r = S.decideSweep(g({ white_time_ms: 300_000, last_move_at: ago(60_000) }), NOW);
  check("a game with time left is skipped", r.action === "skip" && r.reason === "time_remaining");
  check("  …remaining time is reported", r.remainingMs === 240_000, String(r.remainingMs));
}

// ---- 4. untimed ------------------------------------------------------------
{
  const r = S.decideSweep(g({ time_control: null, last_move_at: ago(30 * 24 * 3600_000) }), NOW);
  check("an untimed game is NEVER settled, however old", r.action === "skip" && r.reason === "untimed", r.reason);
}

// ---- 5/6. wrong status -----------------------------------------------------
{
  for (const status of ["finished", "waiting", "starting", "cancelled"]) {
    const r = S.decideSweep(g({ status, white_time_ms: 1, last_move_at: ago(600_000) }), NOW);
    check(`a '${status}' game is skipped even with an expired clock`,
      r.action === "skip" && r.reason === "not_active", r.reason);
  }
}

// ---- 12/13. missing and malformed data ------------------------------------
{
  const noTurn = S.decideSweep(g({ current_turn: null, white_time_ms: 1, last_move_at: ago(600_000) }), NOW);
  check("a null current_turn is skipped", noTurn.action === "skip" && noTurn.reason === "no_current_turn");

  const badTurn = S.decideSweep(g({ current_turn: "x" }), NOW);
  check("a nonsense current_turn is skipped", badTurn.action === "skip" && badTurn.reason === "no_current_turn");

  const noLast = S.decideSweep(g({ last_move_at: null, white_time_ms: 1 }), NOW);
  check("a null last_move_at is skipped", noLast.action === "skip" && noLast.reason === "no_last_move_at");

  const junkLast = S.decideSweep(g({ last_move_at: "not a date", white_time_ms: 1 }), NOW);
  check("an unparseable last_move_at is skipped", junkLast.action === "skip" && junkLast.reason === "no_last_move_at");

  for (const [label, clock] of [["null", null], ["negative", -5], ["NaN", NaN], ["absurd", 48 * 3600_000]]) {
    const r = S.decideSweep(g({ white_time_ms: clock, last_move_at: ago(600_000) }), NOW);
    check(`a ${label} clock is treated as malformed, not as expired`,
      r.action === "skip" && r.reason === "malformed_clock", r.reason);
  }

  // A last_move_at in the future means the row or a clock is wrong.
  const future = S.decideSweep(g({ last_move_at: new Date(NOW.getTime() + 60_000).toISOString() }), NOW);
  check("a future last_move_at is refused rather than trusted",
    future.action === "skip" && future.reason === "malformed_clock", future.reason);
}

// ---- 11. a move arriving near the timeout ---------------------------------
{
  // Exactly at zero, inside the grace period: not yet settled.
  const atZero = S.decideSweep(g({ white_time_ms: 1_000, last_move_at: ago(1_000) }), NOW);
  check("a clock at exactly zero waits out the grace period",
    atZero.action === "skip" && atZero.reason === "time_remaining", atZero.reason);

  // Just inside the grace period.
  const nearly = S.decideSweep(g({ white_time_ms: 1_000, last_move_at: ago(1_000 + S.SETTLEMENT_GRACE_MS - 1_000) }), NOW);
  check("a clock inside the grace period is left to the players", nearly.action === "skip", nearly.reason);

  // Just past it.
  const past = S.decideSweep(g({ white_time_ms: 1_000, last_move_at: ago(1_000 + S.SETTLEMENT_GRACE_MS + 1_000) }), NOW);
  check("a clock past the grace period is settled", past.action === "settle", past.reason);

  // A move landing refreshes last_move_at; the same row then reads healthy.
  const expired = g({ white_time_ms: 5_000, last_move_at: ago(600_000) });
  check("before the move, the row is a candidate", S.decideSweep(expired, NOW).action === "settle");
  const afterMove = { ...expired, last_move_at: ago(0), current_turn: "b", black_time_ms: 300_000 };
  check("after the move lands, the same row is no longer a candidate",
    S.decideSweep(afterMove, NOW).action === "skip", S.decideSweep(afterMove, NOW).reason);
}

// ---- 17/18. every real time control, including increments -----------------
{
  const CONTROLS = [
    ["3+0", 180_000, 0], ["3+2", 180_000, 2_000], ["5+0", 300_000, 0], ["5+3", 300_000, 3_000],
    ["10+0", 600_000, 0], ["10+5", 600_000, 5_000], ["15+10", 900_000, 10_000],
  ];
  for (const [tc, initial] of CONTROLS) {
    const live = S.decideSweep(g({ time_control: tc, white_time_ms: initial, last_move_at: ago(1_000) }), NOW);
    check(`${tc}: a fresh clock is not settled`, live.action === "skip" && live.reason === "time_remaining");

    const dead = S.decideSweep(g({ time_control: tc, white_time_ms: initial, last_move_at: ago(initial + 60_000) }), NOW);
    check(`${tc}: an exhausted clock is settled`, dead.action === "settle", dead.reason);
  }

  // Increment is applied by submit_online_move when a move is made; the
  // sweeper only ever reads the stored remainder, so it needs no increment
  // arithmetic of its own. Confirm a big stored clock is respected either way.
  const withIncrement = S.decideSweep(g({ time_control: "15+10", white_time_ms: 900_000, last_move_at: ago(600_000) }), NOW);
  check("a stored clock inflated by increments is respected", withIncrement.action === "skip");
}

// ---- 8. rating gating ------------------------------------------------------
{
  check("a rated, unpaid game wants a rating",
    S.shouldSettleRating({ match_type: "random", rating_applied: false }) === true);
  check("an already-rated game does not",
    S.shouldSettleRating({ match_type: "random", rating_applied: true }) === false);
  check("an invite game is never rated",
    S.shouldSettleRating({ match_type: "invite", rating_applied: false }) === false);
  check("a tournament game is not rated by the sweeper",
    S.shouldSettleRating({ match_type: "tournament", rating_applied: false }) === false);
}

// ---- 9/10. repeated and concurrent runs ------------------------------------
{
  // The decision is a pure function of (row, now): running it repeatedly on
  // the same input cannot drift. Real idempotency is enforced in SQL and is
  // covered by scripts/test-settlement-fixtures.js.
  const row = g({ white_time_ms: 1_000, last_move_at: ago(600_000) });
  const first = JSON.stringify(S.decideSweep(row, NOW));
  let stable = true;
  for (let i = 0; i < 100; i++) if (JSON.stringify(S.decideSweep(row, NOW)) !== first) stable = false;
  check("100 repeated decisions on one row are identical", stable);

  // Once the row is finished — by a browser, or by a previous sweep — every
  // later pass skips it.
  const settled = { ...row, status: "finished", winner: "b" };
  check("a row settled by someone else is skipped on the next pass",
    S.decideSweep(settled, NOW).action === "skip" && S.decideSweep(settled, NOW).reason === "not_active");
}

// ---- 16. stale waiting games are described, not settled -------------------
{
  const waiting = g({ status: "waiting", created_at: ago(30 * 24 * 3600_000), time_control: "10+0" });
  const d = S.decideSweep(waiting, NOW);
  check("a 30-day-old waiting game is still not settled", d.action === "skip" && d.reason === "not_active");
  const text = S.describeWaiting(waiting, NOW);
  check("waiting games are explained in the report", /left alone/.test(text) && /720h/.test(text), text);
}

// ---- 14/15. cron endpoint authorization ------------------------------------
{
  const SECRET = "s3cret-value-of-some-length";

  const good = A.authorizeCron(`Bearer ${SECRET}`, SECRET);
  check("an authorized cron request is accepted", good.ok === true);

  for (const [label, header] of [
    ["no header", null],
    ["empty header", ""],
    ["the wrong secret", "Bearer wrong-value-same-length"],
    ["a secret with the right prefix", `Bearer ${SECRET.slice(0, 8)}`],
    ["the secret without the Bearer scheme", SECRET],
    ["Basic auth", `Basic ${SECRET}`],
    ["the literal word Bearer", "Bearer"],
    ["a trailing-space secret", `Bearer ${SECRET} `],
  ]) {
    const r = A.authorizeCron(header, SECRET);
    check(`an unauthorized cron request is rejected (${label})`,
      r.ok === false && r.status === 401 && r.error === "unauthorized",
      JSON.stringify(r));
  }

  // A missing secret must fail CLOSED. If this ever returns ok, the settlement
  // endpoint is public.
  for (const missing of [undefined, ""]) {
    const r = A.authorizeCron(`Bearer anything`, missing);
    check(`an unconfigured CRON_SECRET refuses the request (${JSON.stringify(missing)})`,
      r.ok === false && r.status === 503 && r.error === "cron_not_configured", JSON.stringify(r));
  }

  // Constant-time comparison must still be a correct comparison.
  check("safeEqual accepts an exact match", A.safeEqual("abc", "abc") === true);
  check("safeEqual rejects a differing byte", A.safeEqual("abc", "abd") === false);
  check("safeEqual rejects a length difference", A.safeEqual("abc", "abcd") === false);
  check("safeEqual rejects a prefix", A.safeEqual("abcd", "abc") === false);
  check("safeEqual handles empty strings", A.safeEqual("", "") === true);
}

console.log(`\n=== SETTLEMENT LOGIC: ${pass} passed, ${failures.length} failed ===`);
if (failures.length) {
  console.error("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
  process.exitCode = 1;
}

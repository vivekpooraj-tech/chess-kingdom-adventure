/**
 * The settlement sweeper against a real database.
 *
 *   node scripts/test-settlement-fixtures.js
 *
 * Requires migration 0040 (settle_timeout_as_server). Exits with a clear
 * message, having created nothing, if it is not applied.
 *
 * WHAT THIS TOUCHES
 *
 * Only rows it creates itself: one parent, two children, and a set of games.
 * Every id is recorded at the moment of creation and deleted by explicit id in
 * `finally` — never by name prefix, and never by a WHERE clause that could
 * widen to real rows. This project has leaked 72 test children before, from
 * cleanup that lived outside `finally` and a process.exit() that skipped it;
 * the structure here is the fix for that, and the row counts are checked
 * before and after to prove it.
 *
 * `process.exitCode` is set rather than calling process.exit(), because
 * process.exit() would abandon the cleanup.
 */
const fs = require("fs");

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const SRV = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: SRV, Authorization: `Bearer ${SRV}`, "Content-Type": "application/json" };

let pass = 0;
const failures = [];
const check = (n, c, d) => (c ? (pass++, console.log(`  PASS  ${n}`)) : (failures.push(d ? `${n} — ${d}` : n), console.log(`  FAIL  ${n}  ${d ?? ""}`)));

// Every id created, for guaranteed teardown.
const created = { games: [], children: [], parents: [] };

const api = async (method, path, body) => {
  const r = await fetch(`${BASE}/rest/v1/${path}`, {
    method,
    headers: { ...H, Prefer: method === "POST" ? "return=representation" : "return=minimal" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, text };
};
const rpc = async (fn, args) => {
  const r = await fetch(`${BASE}/rest/v1/rpc/${fn}`, { method: "POST", headers: H, body: JSON.stringify(args) });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, text };
};
const count = async (table) => {
  const r = await fetch(`${BASE}/rest/v1/${table}?select=id`, { headers: { ...H, Prefer: "count=exact", Range: "0-0" } });
  return Number((r.headers.get("content-range") || "/0").split("/")[1]);
};

const ago = (ms) => new Date(Date.now() - ms).toISOString();

/**
 * Create a fixture game in an EXACT clock state.
 *
 * Two statements, deliberately. online_games carries a BEFORE INSERT trigger
 * (set_online_game_clock_defaults, 0017/0021) that unconditionally overwrites
 * white_time_ms, black_time_ms and current_turn := 'w' for any timed game — so
 * an INSERT simply cannot express "black to move with 5s left", or a null
 * clock. Verified directly against the database:
 *
 *   INSERT asking turn=b, w=1, b=2  ->  turn=w, w=600000, b=600000
 *   UPDATE with the same values     ->  turn=b, w=1, b=2
 *
 * There is no BEFORE UPDATE trigger, so the second statement is what actually
 * puts the row into the state under test. Without this, several assertions
 * passed for the wrong reason: the trigger's 600000 default minus 600s elapsed
 * lands on exactly 0, which settles as 'b' and coincidentally matched what some
 * tests expected.
 */
const readGame = async (id) => (await api("GET", `online_games?select=*&id=eq.${id}`)).json?.[0];

async function makeGame(over) {
  const insert = {
    host_child_id: created.children[0],
    guest_child_id: created.children[1],
    host_color: "w",
    status: "active",
    match_type: "invite",
    time_control: "10+0",
  };
  // status/match_type/time_control must be set at INSERT: time_control drives
  // the trigger, and an untimed fixture needs it null from the start.
  for (const k of ["status", "match_type", "time_control", "guest_child_id"]) {
    if (k in over) insert[k] = over[k];
  }

  const r = await api("POST", "online_games", insert);
  if (r.status >= 300 || !r.json?.[0]?.id) throw new Error(`fixture game insert failed: ${r.status} ${r.text.slice(0, 160)}`);
  const id = r.json[0].id;
  created.games.push(id);

  // Now force the clock state past the trigger.
  const patch = {
    increment_ms: 0,
    white_time_ms: 600_000,
    black_time_ms: 600_000,
    current_turn: "w",
    last_move_at: ago(1_000),
    ...over,
  };
  for (const k of ["status", "match_type", "time_control", "guest_child_id"]) delete patch[k];
  // An untimed game must keep null clocks, exactly as the trigger leaves them.
  if (over.time_control === null) {
    patch.white_time_ms = null;
    patch.black_time_ms = null;
    patch.current_turn = null;
    if ("white_time_ms" in over) patch.white_time_ms = over.white_time_ms;
    if ("black_time_ms" in over) patch.black_time_ms = over.black_time_ms;
    if ("current_turn" in over) patch.current_turn = over.current_turn;
  }

  const u = await api("PATCH", `online_games?id=eq.${id}`, patch);
  if (u.status >= 300) throw new Error(`fixture game update failed: ${u.status} ${u.text.slice(0, 160)}`);

  // Prove the row really is in the requested state — a silent trigger or a
  // rejected column would otherwise make the whole assertion meaningless.
  const back = await readGame(id);
  for (const [k, want] of Object.entries(patch)) {
    const got = back[k];
    let same;
    if (want === null) {
      same = got === null;
    } else if (k.endsWith("_at")) {
      // Postgres returns +00:00 where JS emits Z — the same instant, formatted
      // differently. Compare by value, not by spelling.
      same = Date.parse(String(got)) === Date.parse(String(want));
    } else {
      same = String(got) === String(want);
    }
    if (!same) throw new Error(`fixture state not applied: ${k} wanted ${want}, got ${got}`);
  }
  return id;
}
(async () => {
  const before = { games: await count("online_games"), children: await count("children"), parents: await count("parents") };
  console.log(`baseline rows: games=${before.games} children=${before.children} parents=${before.parents}\n`);

  try {
    // Is 0040 applied? Probe with a nil uuid: the function raises 'Game not
    // found' before touching anything.
    const probe = await rpc("settle_timeout_as_server", { p_game_id: "00000000-0000-0000-0000-000000000000" });
    if (probe.status === 404 || probe.json?.code === "PGRST202") {
      console.log("settle_timeout_as_server is NOT applied — apply 0040 first.");
      console.log("Nothing was created.");
      process.exitCode = 2;
      return;
    }
    check("0040 applied: settle_timeout_as_server reachable by service_role", /Game not found/.test(probe.json?.message ?? ""), probe.text.slice(0, 90));

    // ---- fixtures ----------------------------------------------------------
    const p = await api("POST", "parents", { auth_user_id: null, email: `sweeper-fixture-${Date.now()}@invalid.test` });
    if (p.status >= 300 || !p.json?.[0]?.id) throw new Error(`fixture parent failed: ${p.status} ${p.text.slice(0, 200)}`);
    created.parents.push(p.json[0].id);

    for (const name of ["SWEEP_FIXTURE_A", "SWEEP_FIXTURE_B"]) {
      const c = await api("POST", "children", { parent_id: created.parents[0], display_name: name, rating: 800 });
      if (c.status >= 300 || !c.json?.[0]?.id) throw new Error(`fixture child failed: ${c.status} ${c.text.slice(0, 200)}`);
      created.children.push(c.json[0].id);
    }
    console.log(`fixtures: 1 parent, ${created.children.length} children\n`);

    // ---- 1. white's clock expired -----------------------------------------
    console.log("expired clocks");
    {
      const id = await makeGame({ current_turn: "w", white_time_ms: 5_000, last_move_at: ago(600_000) });
      const r = await rpc("settle_timeout_as_server", { p_game_id: id });
      const row = Array.isArray(r.json) ? r.json[0] : null;
      check("white flagged: settled = true", row?.settled === true, r.text.slice(0, 120));
      check("white flagged: black wins", row?.winner === "b", String(row?.winner));
      const g = await readGame(id);
      check("white flagged: row is finished in the database", g.status === "finished" && g.winner === "b");
      check("white flagged: clock floored at 0", Number(g.white_time_ms) === 0, String(g.white_time_ms));
    }

    // ---- 2. black's clock expired -----------------------------------------
    {
      const id = await makeGame({ current_turn: "b", black_time_ms: 5_000, last_move_at: ago(600_000) });
      const r = await rpc("settle_timeout_as_server", { p_game_id: id });
      const row = Array.isArray(r.json) ? r.json[0] : null;
      check("black flagged: white wins", row?.settled === true && row?.winner === "w", String(row?.winner));
    }

    // ---- the idle clock is never charged ----------------------------------
    {
      const id = await makeGame({ current_turn: "w", white_time_ms: 600_000, black_time_ms: 1, last_move_at: ago(60_000) });
      const r = await rpc("settle_timeout_as_server", { p_game_id: id });
      const row = Array.isArray(r.json) ? r.json[0] : null;
      check("the idle player's 1ms clock does not lose the game", row?.settled === false, r.text.slice(0, 120));
      check("  …game is still active", (await readGame(id)).status === "active");
    }

    // ---- 3/4/5/6. everything that must be left alone ----------------------
    console.log("\nleft alone");
    for (const [label, over] of [
      ["a game with time remaining", { white_time_ms: 600_000, last_move_at: ago(1_000) }],
      ["an untimed game, long abandoned", { time_control: null, white_time_ms: null, black_time_ms: null, last_move_at: ago(30 * 24 * 3600_000) }],
      ["a finished game", { status: "finished", winner: "w", white_time_ms: 1, last_move_at: ago(600_000) }],
      ["a waiting game", { status: "waiting", guest_child_id: null, white_time_ms: 1, last_move_at: ago(600_000) }],
      ["a null current_turn", { current_turn: null, white_time_ms: 1, last_move_at: ago(600_000) }],
      ["a null last_move_at", { last_move_at: null, white_time_ms: 1 }],
      // Fails OPEN without an explicit null check: null - elapsed is null,
      // `null > 0` is false, and `null <= 0` is also false, so the row would
      // be finished with white declared the winner on no evidence.
      ["a null white clock", { white_time_ms: null, current_turn: "w", last_move_at: ago(600_000) }],
      ["a null black clock", { black_time_ms: null, current_turn: "b", last_move_at: ago(600_000) }],
    ]) {
      const id = await makeGame(over);
      const snapshot = await readGame(id);
      const r = await rpc("settle_timeout_as_server", { p_game_id: id });
      const row = Array.isArray(r.json) ? r.json[0] : null;
      const after = await readGame(id);
      check(`${label}: not settled`, row?.settled === false, r.text.slice(0, 100));
      check(`${label}: row unchanged`,
        after.status === snapshot.status && after.winner === snapshot.winner,
        `${snapshot.status}/${snapshot.winner} -> ${after.status}/${after.winner}`);
    }

    // ---- 9. repeated runs --------------------------------------------------
    console.log("\nidempotency");
    {
      const id = await makeGame({ current_turn: "w", white_time_ms: 1_000, last_move_at: ago(600_000) });
      const first = await rpc("settle_timeout_as_server", { p_game_id: id });
      check("run 1 settles", (Array.isArray(first.json) ? first.json[0] : null)?.settled === true);
      const afterFirst = await readGame(id);

      let allFalse = true;
      for (let i = 0; i < 100; i++) {
        const r = await rpc("settle_timeout_as_server", { p_game_id: id });
        if ((Array.isArray(r.json) ? r.json[0] : null)?.settled !== false) allFalse = false;
      }
      check("runs 2-101 all report settled = false", allFalse);
      const afterMany = await readGame(id);
      check("the winner never changes after settlement",
        afterMany.winner === afterFirst.winner && afterMany.status === "finished",
        `${afterFirst.winner} -> ${afterMany.winner}`);
      check("the clocks never change after settlement",
        String(afterMany.white_time_ms) === String(afterFirst.white_time_ms) &&
        String(afterMany.black_time_ms) === String(afterFirst.black_time_ms));
    }

    // ---- 10. concurrent sweeps --------------------------------------------
    {
      const id = await makeGame({ current_turn: "b", black_time_ms: 1_000, last_move_at: ago(600_000) });
      const results = await Promise.all(
        Array.from({ length: 8 }, () => rpc("settle_timeout_as_server", { p_game_id: id }))
      );
      const settledCount = results.filter((r) => (Array.isArray(r.json) ? r.json[0] : null)?.settled === true).length;
      check("8 concurrent sweeps settle the game exactly once", settledCount === 1, `settled=${settledCount}`);
      const g = await readGame(id);
      check("  …and the result is coherent", g.status === "finished" && g.winner === "w", `${g.status}/${g.winner}`);
    }

    // ---- 8. rating applied exactly once -----------------------------------
    console.log("\nrating");
    {
      const id = await makeGame({
        match_type: "random", current_turn: "w", white_time_ms: 1_000, last_move_at: ago(600_000),
      });
      const s = await rpc("settle_timeout_as_server", { p_game_id: id });
      check("a rated game settles", (Array.isArray(s.json) ? s.json[0] : null)?.settled === true);

      const historyBefore = await count("rating_history");
      const results = await Promise.all(Array.from({ length: 6 }, () => rpc("apply_match_rating", { p_game_id: id })));
      check("6 concurrent rating calls all return without error",
        results.every((r) => r.status < 300), results.map((r) => r.status).join(","));

      const g = await readGame(id);
      check("rating_applied is set", g.rating_applied === true);
      const historyAfter = await count("rating_history");
      check("exactly 2 rating_history rows were written (one per player)",
        historyAfter - historyBefore === 2, `delta=${historyAfter - historyBefore}`);

      // Another pass must not pay again.
      await rpc("apply_match_rating", { p_game_id: id });
      check("a later rating call adds no further history rows",
        (await count("rating_history")) === historyAfter);
    }

    // ---- 11. a move arriving near the timeout ------------------------------
    console.log("\nrace: move vs sweep");
    {
      // The move lands first: last_move_at is refreshed, so the sweep that
      // follows finds a healthy clock and does nothing.
      const id = await makeGame({ current_turn: "w", white_time_ms: 5_000, last_move_at: ago(600_000) });
      await api("PATCH", `online_games?id=eq.${id}`, {
        current_turn: "b", white_time_ms: 300_000, last_move_at: new Date().toISOString(),
      });
      const r = await rpc("settle_timeout_as_server", { p_game_id: id });
      check("a move that lands first defeats the pending sweep",
        (Array.isArray(r.json) ? r.json[0] : null)?.settled === false, r.text.slice(0, 100));
      check("  …the game is still active", (await readGame(id)).status === "active");
    }
    {
      // The sweep lands first: the game is finished, and the move that follows
      // is rejected by submit_online_move_as_server's own status check.
      const id = await makeGame({ current_turn: "w", white_time_ms: 1_000, last_move_at: ago(600_000) });
      await rpc("settle_timeout_as_server", { p_game_id: id });
      const mv = await rpc("submit_online_move_as_server", {
        p_game_id: id, p_child_id: created.children[0], p_fen: "x", p_san: "e4",
      });
      check("a move arriving after the sweep is rejected",
        /Game is not active/i.test(mv.json?.message ?? ""), mv.text.slice(0, 110));
      const g = await readGame(id);
      check("  …the settled result stands", g.status === "finished" && (g.moves ?? []).length === 0);
    }

  } catch (e) {
    failures.push(`threw: ${e.message}`);
    console.error("\nERROR:", e.message);
  } finally {
    // Guaranteed teardown, by explicit id only. Games first (they reference
    // children), then children, then the parent.
    console.log("\ncleanup");
    let removed = 0;
    for (const id of created.games) {
      await api("DELETE", `rating_history?game_id=eq.${id}`);
      const r = await api("DELETE", `online_games?id=eq.${id}`);
      if (r.status < 300) removed++;
    }
    for (const id of created.children) {
      await api("DELETE", `rating_history?child_id=eq.${id}`);
      await api("DELETE", `children?id=eq.${id}`);
    }
    for (const id of created.parents) await api("DELETE", `parents?id=eq.${id}`);
    console.log(`  deleted ${removed}/${created.games.length} games, ${created.children.length} children, ${created.parents.length} parents`);

    const after = { games: await count("online_games"), children: await count("children"), parents: await count("parents") };
    console.log(`  rows now: games=${after.games} children=${after.children} parents=${after.parents}`);
    const clean = after.games === before.games && after.children === before.children && after.parents === before.parents;
    check("every table is back to its baseline row count",
      clean, `games ${before.games}->${after.games}, children ${before.children}->${after.children}, parents ${before.parents}->${after.parents}`);

    console.log(`\n=== SETTLEMENT FIXTURES: ${pass} passed, ${failures.length} failed ===`);
    if (failures.length) {
      console.error("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
      process.exitCode = 1;
    }
  }
})();

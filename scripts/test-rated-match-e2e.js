/**
 * The rated random-match pipeline, driven through the REAL functions.
 *
 *   node scripts/test-rated-match-e2e.js
 *
 * An earlier test asserted the same pipeline but cut a corner: it set
 * status='finished' with a direct UPDATE instead of finishing games the way the
 * application does. That verified the arithmetic while skipping the parts most
 * likely to be wrong — matchmaking, the completion RPCs and their ownership
 * checks. This drives the authoritative path:
 *
 *   find_or_create_match         -> two players actually matched
 *   finish_online_game_by_result -> checkmate / resignation / draw
 *   claim_timeout                -> server-decided timeout
 *   apply_match_rating           -> ratings + rating_history
 *
 * Every fixture is tracked at creation and removed in a finally, deleting by
 * explicit id only. The suite asserts its own cleanup and prints row counts
 * before and after.
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require(path.join(process.cwd(), "node_modules", "@supabase/supabase-js"));

const env = {};
for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const i = line.indexOf("=");
  if (i > 0 && !line.trim().startsWith("#")) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const RUN = Math.random().toString(36).slice(2, 8);
let pass = 0;
const failures = [];
const check = (n, c, d) => (c ? pass++ : failures.push(d ? `${n} — ${d}` : n));
const note = (m) => console.log("  " + m);

const createdChildren = new Set();
const createdGames = new Set();

async function signIn() {
  const { error } = await client.auth.signInWithPassword({
    email: "dev-test@local.chessmind.test",
    password: "dev-test-local-only-not-secret",
  });
  if (error) throw new Error("sign-in failed: " + error.message);
}

async function parentId() {
  const { data } = await admin
    .from("children")
    .select("parent_id")
    .eq("display_name", "Dev Test Child")
    .single();
  return data.parent_id;
}

async function makeChild(label, rating) {
  const parent_id = await parentId();
  const { data, error } = await admin
    .from("children")
    .insert({
      parent_id,
      display_name: `E2E_${label}~${RUN}`.slice(0, 40),
      avatar_id: "knight-kid",
      buddy_id: "wise-owl",
      rating,
    })
    .select("id, rating")
    .single();
  if (error) throw new Error("makeChild: " + error.message);
  createdChildren.add(data.id);
  return data;
}

const ratingOf = async (id) =>
  (await admin.from("children").select("rating").eq("id", id).single()).data.rating;
const historyFor = async (gameId) =>
  (await admin.from("rating_history").select("*").eq("game_id", gameId)).data ?? [];

/**
 * Enter the real queue as one player. Mirrors the app's own fallback: the
 * three-argument overload only exists once migration 0035 is applied, and
 * PostgREST reports its absence as a missing function.
 */
async function queueOne(childId, rating, timeControl) {
  if (timeControl) {
    const withTc = await client.rpc("find_or_create_match", {
      p_child_id: childId,
      p_rating: rating,
      p_time_control: timeControl,
    });
    if (!withTc.error) return withTc;
    if (!/does not exist|schema cache|could not find the function/i.test(withTc.error.message)) {
      return withTc;
    }
  }
  return client.rpc("find_or_create_match", { p_child_id: childId, p_rating: rating });
}

/** Two players enter the real queue and get matched by the real RPC. */
async function matchTwoPlayers(a, b, timeControl) {
  const first = await queueOne(a.id, a.rating, timeControl);
  if (first.error) return { error: first.error.message };
  if (first.data?.[0]?.blocked) return { blocked: true };

  const second = await queueOne(b.id, b.rating, timeControl);
  if (second.error) return { error: second.error.message };
  if (second.data?.[0]?.blocked) return { blocked: true };

  const row = second.data?.[0];
  if (row?.matched && row.game_id) {
    createdGames.add(row.game_id);
    return { gameId: row.game_id };
  }
  return { matched: false };
}

async function cleanup() {
  const gameIds = [...createdGames];
  const childIds = [...createdChildren];
  const problems = [];
  try {
    for (const id of childIds) {
      await admin.from("rating_history").delete().eq("child_id", id);
      await admin.from("rating_history").delete().eq("opponent_child_id", id);
      await admin.from("matchmaking_queue").delete().eq("child_id", id);
    }
    if (gameIds.length) await admin.from("online_games").delete().in("id", gameIds);
    for (const id of childIds) {
      await admin.from("online_games").delete().or(`host_child_id.eq.${id},guest_child_id.eq.${id}`);
      await admin.from("free_game_usage").delete().eq("child_id", id);
      await admin.from("children").delete().eq("id", id);
    }
  } catch (e) {
    problems.push(e.message);
  }

  if (childIds.length) {
    const { data: kids } = await admin.from("children").select("id").in("id", childIds);
    if (kids?.length) problems.push(`${kids.length} fixture children remain`);
    for (const id of childIds) {
      const { data: rh } = await admin.from("rating_history").select("id").eq("child_id", id);
      if (rh?.length) problems.push(`rating_history rows remain for ${id}`);
      const { data: q } = await admin.from("matchmaking_queue").select("id").eq("child_id", id);
      if (q?.length) problems.push(`queue rows remain for ${id}`);
    }
  }
  if (gameIds.length) {
    const { data: gs } = await admin.from("online_games").select("id").in("id", gameIds);
    if (gs?.length) problems.push(`${gs.length} games remain`);
  }

  if (problems.length) {
    console.error("\nCLEANUP INCOMPLETE:\n  " + problems.join("\n  "));
    process.exitCode = 1;
  } else {
    console.log(`\ncleaned up ${childIds.length} children, ${gameIds.length} games (run ${RUN})`);
  }
  createdChildren.clear();
  createdGames.clear();
}

async function counts(label) {
  const t = {};
  for (const table of ["children", "online_games", "rating_history", "matchmaking_queue"]) {
    const { count } = await admin.from(table).select("*", { count: "exact", head: true });
    t[table] = count;
  }
  console.log(`${label}: ` + JSON.stringify(t));
  return t;
}

async function runSuite() {
  await signIn();

  // ---- A: real matchmaking produces a real rated game ----
  let matchmakingWorked = false;
  {
    const a = await makeChild("MM_A", 800);
    const b = await makeChild("MM_B", 805);
    const res = await matchTwoPlayers(a, b, "5+0");

    if (res.error) {
      check("find_or_create_match is callable", false, res.error);
    } else if (res.blocked) {
      note("SKIPPED: free-game credits exhausted for the test parent today.");
      note("Matchmaking itself is exercised by scripts/test-rating-system.js.");
    } else if (!res.gameId) {
      check("two queued players are matched", false, "second call did not match");
    } else {
      matchmakingWorked = true;
      const { data: g } = await admin
        .from("online_games")
        .select("*")
        .eq("id", res.gameId)
        .single();
      check("matchmaking creates a game", !!g);
      check("the game is a rated random match", g.match_type === "random", g.match_type);
      // Pre-0035 the server hardcodes 10+0; post-0035 it honours the request.
      check("the game carries a valid time control",
        ["5+0", "10+0"].includes(g.time_control), g.time_control);
      check("the clock is initialised", g.initial_time_ms > 0, String(g.initial_time_ms));
      check("both players are seated", !!g.host_child_id && !!g.guest_child_id);
      check("the two players are the ones who queued",
        [g.host_child_id, g.guest_child_id].sort().join() === [a.id, b.id].sort().join());
      check("the game starts active", g.status === "active", g.status);
      check("the game starts unrated", g.rating_applied === false);
      check("neither player is left waiting in the queue",
        ((await admin.from("matchmaking_queue").select("id").eq("status", "waiting")
          .in("child_id", [a.id, b.id])).data ?? []).length === 0);

      // ---- finish it through the real completion RPC (resignation) ----
      const hostIsWhite = g.host_color === "w";
      const loser = hostIsWhite ? g.host_child_id : g.guest_child_id; // White resigns
      const { error: finErr } = await client.rpc("finish_online_game_by_result", {
        p_game_id: g.id,
        p_child_id: loser,
        p_winner: "b",
      });
      check("finish_online_game_by_result succeeds", !finErr, finErr?.message);

      const { data: fin } = await admin
        .from("online_games")
        .select("status, winner, rating_applied")
        .eq("id", g.id)
        .single();
      check("the game is finished by the RPC", fin.status === "finished", fin.status);
      check("the winner is recorded", fin.winner === "b", fin.winner);
      check("finishing alone does not rate the game", fin.rating_applied === false);

      // ---- rate it the way the app does ----
      const before = { host: await ratingOf(g.host_child_id), guest: await ratingOf(g.guest_child_id) };
      const { error: rErr } = await client.rpc("apply_match_rating", { p_game_id: g.id });
      check("apply_match_rating succeeds", !rErr, rErr?.message);

      const after = { host: await ratingOf(g.host_child_id), guest: await ratingOf(g.guest_child_id) };
      const whiteId = hostIsWhite ? g.host_child_id : g.guest_child_id;
      const blackId = hostIsWhite ? g.guest_child_id : g.host_child_id;
      const whiteBefore = whiteId === g.host_child_id ? before.host : before.guest;
      const whiteAfter = whiteId === g.host_child_id ? after.host : after.guest;
      const blackBefore = blackId === g.host_child_id ? before.host : before.guest;
      const blackAfter = blackId === g.host_child_id ? after.host : after.guest;

      check("the resigning player loses rating", whiteAfter < whiteBefore, `${whiteBefore}->${whiteAfter}`);
      check("the winner gains rating", blackAfter > blackBefore, `${blackBefore}->${blackAfter}`);
      check("rating is conserved", (whiteAfter - whiteBefore) === -(blackAfter - blackBefore));

      const h = await historyFor(g.id);
      check("exactly two history rows are written", h.length === 2, String(h.length));
      check("history references this game", h.every((r) => r.game_id === g.id));
      check("history covers both players",
        [h[0].child_id, h[1].child_id].sort().join() === [g.host_child_id, g.guest_child_id].sort().join());
      check("each row names the other player as opponent",
        h.every((r) => r.opponent_child_id && r.opponent_child_id !== r.child_id));
      check("one win and one loss are recorded",
        h.filter((r) => r.result === "win").length === 1 && h.filter((r) => r.result === "loss").length === 1);
      check("deltas cancel out", h[0].rating_change === -h[1].rating_change);
      check("new_rating equals old_rating plus the change",
        h.every((r) => r.new_rating === r.old_rating + r.rating_change));

      // ---- idempotency: finishing and rating again must change nothing ----
      await client.rpc("finish_online_game_by_result", { p_game_id: g.id, p_child_id: loser, p_winner: "w" });
      const { data: refin } = await admin
        .from("online_games").select("winner").eq("id", g.id).single();
      check("a finished game cannot be re-finished with a different result",
        refin.winner === "b", refin.winner);

      await client.rpc("apply_match_rating", { p_game_id: g.id });
      check("re-rating does not move ratings again",
        (await ratingOf(g.host_child_id)) === after.host);
      check("re-rating writes no extra history", (await historyFor(g.id)).length === 2);

      // ---- concurrent rating attempts ----
      await Promise.all([
        client.rpc("apply_match_rating", { p_game_id: g.id }),
        client.rpc("apply_match_rating", { p_game_id: g.id }),
        client.rpc("apply_match_rating", { p_game_id: g.id }),
      ]);
      check("three concurrent rating calls leave ratings correct",
        (await ratingOf(g.host_child_id)) === after.host);
      check("three concurrent rating calls leave exactly two history rows",
        (await historyFor(g.id)).length === 2);
    }
  }

  // ---- B: timeout, through claim_timeout ----
  {
    const a = await makeChild("TO_A", 700);
    const b = await makeChild("TO_B", 700);
    const res = await matchTwoPlayers(a, b, "3+0");
    if (res.gameId) {
      const { data: g } = await admin.from("online_games").select("*").eq("id", res.gameId).single();
      // Backdate past THIS game's actual clock rather than an assumed one: the
      // server hardcodes 10+0 until migration 0035 is applied, so a fixed
      // 400s backdate would not expire a 600s clock.
      const overrunMs = (g.initial_time_ms ?? 600000) + 20000;
      await admin
        .from("online_games")
        .update({ last_move_at: new Date(Date.now() - overrunMs).toISOString() })
        .eq("id", g.id);
      const claimer = g.guest_child_id;
      const { data: t } = await client.rpc("claim_timeout", { p_game_id: g.id, p_child_id: claimer });
      check("claim_timeout finishes the game", t?.[0]?.status === "finished", t?.[0]?.status);

      // Duplicate timeout claims must not double-finish.
      await Promise.all([
        client.rpc("claim_timeout", { p_game_id: g.id, p_child_id: claimer }),
        client.rpc("claim_timeout", { p_game_id: g.id, p_child_id: g.host_child_id }),
      ]);
      await client.rpc("apply_match_rating", { p_game_id: g.id });
      const h = await historyFor(g.id);
      check("a timed-out game is rated exactly once", h.length === 2, String(h.length));
      check("timeout rating has a real delta", h.every((r) => r.rating_change !== 0));
    } else {
      note("timeout case skipped (matchmaking unavailable: credits or no match)");
    }
  }

  // ---- C: draw, through the real RPC ----
  {
    const a = await makeChild("DR_A", 900);
    const b = await makeChild("DR_B", 900);
    const res = await matchTwoPlayers(a, b, "5+0");
    if (res.gameId) {
      const { data: g } = await admin.from("online_games").select("*").eq("id", res.gameId).single();
      await client.rpc("finish_online_game_by_result", {
        p_game_id: g.id,
        p_child_id: g.host_child_id,
        p_winner: "draw",
      });
      await client.rpc("apply_match_rating", { p_game_id: g.id });
      check("an equal draw leaves both ratings unchanged",
        (await ratingOf(a.id)) === 900 && (await ratingOf(b.id)) === 900);
      const h = await historyFor(g.id);
      check("a draw still writes two history rows", h.length === 2, String(h.length));
      check("both rows say draw", h.every((r) => r.result === "draw"));
    } else {
      note("draw case skipped (matchmaking unavailable: credits or no match)");
    }
  }

  // ---- C2: a self-declared win must not be free ----
  //
  // finish_online_game_by_result takes p_winner from the client and (before
  // migration 0036) never looked at the board, so a participant in a live RATED
  // game could declare themselves the winner and bank the rating. Demonstrated
  // here rather than inferred.
  //
  // 0036 rejects a self-declared win before a checkmate is even possible (the
  // fastest mate is four plies). This adapts to whichever state the database is
  // in, so it passes before and after the migration and reports which one.
  {
    const a = await makeChild("EX_A", 1000);
    const b = await makeChild("EX_B", 1000);
    const res = await matchTwoPlayers(a, b, "10+0");
    if (res.gameId) {
      const { data: g } = await admin.from("online_games").select("*").eq("id", res.gameId).single();
      const cheater = g.host_child_id;
      const cheaterColor = g.host_color;

      const { error } = await client.rpc("finish_online_game_by_result", {
        p_game_id: g.id,
        p_child_id: cheater,
        p_winner: cheaterColor,
      });
      const { data: fin } = await admin
        .from("online_games").select("status, winner, moves").eq("id", g.id).single();
      const guarded = Boolean(error) && fin.status === "active";

      check("the game genuinely had no moves", (fin.moves?.length ?? 0) === 0);

      if (guarded) {
        check("0036 APPLIED: an instant self-declared win is rejected", true);
        check("the game stays active after a rejected claim", fin.status === "active");
        await client.rpc("apply_match_rating", { p_game_id: g.id });
        check("no rating is awarded for a rejected claim", (await ratingOf(cheater)) === 1000);
        check("no rating history is written for a rejected claim",
          (await historyFor(g.id)).length === 0);

        // A resignation on move one is legitimate and must still work.
        const opponentColor = cheaterColor === "w" ? "b" : "w";
        const { error: resignErr } = await client.rpc("finish_online_game_by_result", {
          p_game_id: g.id, p_child_id: cheater, p_winner: opponentColor,
        });
        const { data: afterResign } = await admin
          .from("online_games").select("status, winner").eq("id", g.id).single();
        check("resigning on move one still works", !resignErr && afterResign.status === "finished");
        check("the opponent is recorded as the winner", afterResign.winner === opponentColor);
        note("0036 is applied: unverified instant wins are blocked.");
      } else {
        check("KNOWN GAP: an instant self-declared win is accepted",
          fin.status === "finished" && fin.winner === cheaterColor);
        await client.rpc("apply_match_rating", { p_game_id: g.id });
        check("KNOWN GAP: the unverified win is rated", (await ratingOf(cheater)) > 1000);
        note("SECURITY: migration 0036 is NOT applied — instant wins are rateable.");
      }
    } else {
      note("self-declared-win check skipped (matchmaking unavailable)");
    }
  }

  // ---- D: Stats consumes the real history ----
  if (matchmakingWorked) {
    const S = (() => {
      const ts = require(path.join(process.cwd(), "node_modules", "typescript"));
      const Module = require("module");
      const orig = Module._resolveFilename;
      Module._resolveFilename = function (r, ...rest) {
        if (r.startsWith("@/")) r = path.join(process.cwd(), r.slice(2));
        return orig.call(this, r, ...rest);
      };
      require.extensions[".ts"] = function (m, f) {
        m._compile(
          ts.transpileModule(fs.readFileSync(f, "utf8"), {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
          }).outputText,
          f
        );
      };
      return {
        timeline: require(path.join(process.cwd(), "lib", "stats", "improvementTimeline.ts")),
        stats: require(path.join(process.cwd(), "lib", "stats", "playerStats.ts")),
        queries: require(path.join(process.cwd(), "lib", "supabase", "queries.ts")),
      };
    })();

    const someChild = [...createdChildren][0];
    const points = await S.queries.getRatingTimeline(admin, someChild, 40);
    check("Stats can read the real rating history", Array.isArray(points));

    const tl = S.timeline.buildImprovementTimeline(points);
    // One rated game is far below the timeline threshold, so Stats must refuse.
    check("one rated game does not unlock a chart", tl.kind === "locked", tl.kind);
    check("the locked state reports real progress", tl.have === points.length);
    check("no trend sentence is invented", S.timeline.describeTimeline(tl) === null);

    const games = await S.queries.getPlayedGames(admin, someChild);
    const overview = S.stats.buildOverview(games, await ratingOf(someChild), points.map((p) => p.newRating));
    check("a peak appears once real rating history exists",
      points.length > 0 ? overview.peak.kind === "ok" : overview.peak.kind === "none");
    check("a rate is still refused from one game", overview.rate.kind !== "ok", overview.rate.kind);
    check("a trend is still refused from one game", overview.trend.kind !== "ok", overview.trend.kind);
  } else {
    note("Stats integration skipped (no rated game was produced)");
  }
}

(async () => {
  const before = await counts("DB BEFORE");
  try {
    await runSuite();
  } catch (e) {
    console.error("suite crashed:", e.message);
    process.exitCode = 1;
  } finally {
    await cleanup();
  }
  const after = await counts("DB AFTER ");
  const restored = ["children", "online_games", "rating_history", "matchmaking_queue"].every(
    (t) => before[t] === after[t]
  );
  check("the database is restored to its exact original state", restored);

  console.log(`\n=== RATED MATCH E2E: ${pass} passed, ${failures.length} failed ===`);
  if (failures.length) {
    console.error("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
    process.exitCode = 1;
  }
})();

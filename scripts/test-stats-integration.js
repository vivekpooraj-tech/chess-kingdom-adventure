/**
 * Integration tests for the statistics data layer.
 *
 *   node scripts/test-stats-integration.js              run the suite
 *   node scripts/test-stats-integration.js --seed-dev   leave demo games on the
 *                                                       dev test child for UI QA
 *   node scripts/test-stats-integration.js --cleanup    remove those demo games
 *
 * lib/stats/playerStats.ts is unit-tested in isolation; what it cannot check is
 * the mapping from an online_games row to "what happened to THIS child".
 * That mapping involves host/guest, host_color and winner, and getting it
 * backwards would silently swap every player's wins and losses while every
 * unit test still passed. So this exercises it against the real database.
 *
 * Everything it creates, it deletes.
 */
const fs = require("fs");
const path = require("path");
const ts = require(path.join(process.cwd(), "node_modules", "typescript"));
const { createClient } = require(path.join(process.cwd(), "node_modules", "@supabase/supabase-js"));

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

const env = {};
for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const i = line.indexOf("=");
  if (i > 0 && !line.trim().startsWith("#")) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { getPlayedGames } = require(path.join(process.cwd(), "lib", "supabase", "queries.ts"));

const TAG = "stats-itest";
let pass = 0;
const failures = [];
function check(name, cond) {
  if (cond) pass++;
  else failures.push(name);
}

/** Games created by this script, so cleanup never touches anything else. */
const created = [];

async function makeGame({ hostId, guestId, hostColor, winner, timeControl, matchType, when }) {
  const { data, error } = await admin
    .from("online_games")
    .insert({
      host_child_id: hostId,
      guest_child_id: guestId,
      host_color: hostColor,
      status: "finished",
      winner,
      match_type: matchType ?? "random",
      time_control: timeControl ?? "5+0",
      fen: "8/8/8/8/8/8/8/K6k w - - 0 1",
      created_at: when ?? new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error("insert failed: " + error.message);
  created.push(data.id);
  return data.id;
}

async function cleanup(ids) {
  const list = ids ?? created;
  if (!list.length) return;
  await admin.from("online_games").delete().in("id", list);
}

async function findDevChild() {
  const { data } = await admin
    .from("children")
    .select("id, display_name")
    .eq("display_name", "Dev Test Child")
    .limit(1);
  return data && data[0] ? data[0] : null;
}

async function main() {
  const dev = await findDevChild();
  if (!dev) {
    console.error("Dev Test Child not found — run scripts/dev-seed-test-user.js first.");
    process.exitCode = 1;
    return;
  }

  // A second child to act as the opponent.
  const { data: others } = await admin
    .from("children")
    .select("id")
    .neq("id", dev.id)
    .limit(1);
  if (!others || !others.length) {
    console.error("Need a second child row to act as an opponent.");
    process.exitCode = 1;
    return;
  }
  const opponentId = others[0].id;

  if (process.argv.includes("--cleanup")) {
    // Remove anything this script previously left on the dev child.
    const { data } = await admin
      .from("online_games")
      .select("id")
      .eq("fen", "8/8/8/8/8/8/8/K6k w - - 0 1");
    const ids = (data ?? []).map((r) => r.id);
    await cleanup(ids);
    console.log(`removed ${ids.length} demo games`);
    process.exitCode = 0;
    return;
  }

  // ---- A: result and colour mapping, from both sides of the board ----
  {
    // Dev child is HOST with white, and white won -> a win for the dev child.
    await makeGame({ hostId: dev.id, guestId: opponentId, hostColor: "w", winner: "w" });
    // Dev child is HOST with white, black won -> a loss.
    await makeGame({ hostId: dev.id, guestId: opponentId, hostColor: "w", winner: "b" });
    // Dev child is GUEST while host is white, so the dev child had BLACK.
    // Black won -> a win for the dev child. This is the case a naive mapping
    // gets backwards.
    await makeGame({ hostId: opponentId, guestId: dev.id, hostColor: "w", winner: "b" });
    // Dev child is GUEST, host white, white won -> a loss.
    await makeGame({ hostId: opponentId, guestId: dev.id, hostColor: "w", winner: "w" });
    // A draw.
    await makeGame({ hostId: dev.id, guestId: opponentId, hostColor: "b", winner: "draw" });

    const rows = await getPlayedGames(admin, dev.id);
    const mine = rows.filter((r) => created.includes(r.id));
    check("all five games are returned", mine.length === 5);

    const wins = mine.filter((r) => r.result === "win").length;
    const losses = mine.filter((r) => r.result === "loss").length;
    const draws = mine.filter((r) => r.result === "draw").length;
    check("wins counted from both host and guest seats", wins === 2);
    check("losses counted from both host and guest seats", losses === 2);
    check("draws counted", draws === 1);

    // Colour must follow the seat, not the host_color column.
    const asGuestWithBlack = mine.find(
      (r) => r.id === created[2]
    );
    check("guest of a white host is recorded as Black", asGuestWithBlack.color === "b");
    check("that black game is a win", asGuestWithBlack.result === "win");

    const asHostWhite = mine.find((r) => r.id === created[0]);
    check("host with white is recorded as White", asHostWhite.color === "w");
  }

  // ---- B: only finished games count ----
  {
    const { data } = await admin
      .from("online_games")
      .insert({
        host_child_id: dev.id,
        guest_child_id: opponentId,
        host_color: "w",
        status: "active",
        winner: null,
        match_type: "random",
        time_control: "5+0",
        fen: "8/8/8/8/8/8/8/K6k w - - 0 1",
      })
      .select("id")
      .single();
    created.push(data.id);
    const rows = await getPlayedGames(admin, dev.id);
    check("in-progress games are excluded", !rows.some((r) => r.id === data.id));
  }

  // ---- C: another child's games never leak in ----
  {
    const { data } = await admin
      .from("online_games")
      .insert({
        host_child_id: opponentId,
        guest_child_id: opponentId,
        host_color: "w",
        status: "finished",
        winner: "w",
        match_type: "random",
        time_control: "5+0",
        fen: "8/8/8/8/8/8/8/K6k w - - 0 1",
      })
      .select("id")
      .single();
    created.push(data.id);
    const rows = await getPlayedGames(admin, dev.id);
    check("games the child did not play are excluded", !rows.some((r) => r.id === data.id));
  }

  // ---- D: the pure layer agrees with the fetched rows ----
  {
    const S = require(path.join(process.cwd(), "lib", "stats", "playerStats.ts"));
    const rows = (await getPlayedGames(admin, dev.id)).filter((r) => created.includes(r.id));
    const overview = S.buildOverview(rows, 800);
    check("overview total matches fetched rows", overview.record.games === rows.length);
    check(
      "five games is still too few for a rate",
      overview.rate.kind === "insufficient"
    );
    check("trend refuses at this sample size", overview.trend.kind === "insufficient");
  }

  if (process.argv.includes("--seed-dev")) {
    // Leave a larger, realistic set for UI QA instead of cleaning up.
    const now = Date.now();
    // 14 older games at ~36% score, then 14 recent at ~79% — a real improvement
    // the trend test should detect.
    for (let i = 0; i < 14; i++) {
      await makeGame({
        hostId: dev.id,
        guestId: opponentId,
        hostColor: i % 2 === 0 ? "w" : "b",
        winner: i < 5 ? (i % 2 === 0 ? "w" : "b") : i % 2 === 0 ? "b" : "w",
        timeControl: i % 3 === 0 ? "3+0" : "10+0",
        when: new Date(now - (40 - i) * 86400000).toISOString(),
      });
    }
    for (let i = 0; i < 14; i++) {
      await makeGame({
        hostId: dev.id,
        guestId: opponentId,
        hostColor: i % 2 === 0 ? "w" : "b",
        winner: i < 11 ? (i % 2 === 0 ? "w" : "b") : i % 2 === 0 ? "b" : "w",
        timeControl: i % 3 === 0 ? "3+0" : "10+0",
        when: new Date(now - (14 - i) * 86400000).toISOString(),
      });
    }
    console.log(`\nSeeded ${created.length} demo games on Dev Test Child for UI QA.`);
    console.log("Remove them with: node scripts/test-stats-integration.js --cleanup");
  } else {
    await cleanup();
  }

  console.log(`\n=== STATS INTEGRATION: ${pass} passed, ${failures.length} failed ===`);
  if (failures.length) {
    console.error("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
    process.exitCode = 1;
    return;
  }
  process.exitCode = 0;
    return;
}

main().catch(async (e) => {
  await cleanup();
  console.error("crashed:", e.message);
  process.exitCode = 1;
    return;
});

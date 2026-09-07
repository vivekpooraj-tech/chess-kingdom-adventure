// Random Match rating + matchmaking test suite — against the REAL live
// database, using both the service-role key (seeding synthetic queue/game
// state, inspecting tables directly) and a REAL authenticated
// (non-service-role) session for every ownership/security-relevant RPC
// call. Matches the pattern established by this session's other
// scripts/test-*.js suites.
//
// Run: node scripts/test-rating-system.js

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

let pass = 0;
let fail = 0;
const failures = [];
function check(label, condition, detail) {
  if (condition) pass++;
  else {
    fail++;
    failures.push(label + (detail ? " -- " + detail : ""));
    console.log(`FAIL: ${label}${detail ? " -- " + detail : ""}`);
  }
}

let parentIdCache = null;
async function getTestParentId() {
  if (parentIdCache) return parentIdCache;
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw error;
  const user = data.users.find((u) => u.email === "dev-test@local.chessmind.test");
  if (!user) throw new Error("dev-test user not found");
  const { data: parent } = await admin.from("parents").select("id").eq("auth_user_id", user.id).single();
  parentIdCache = parent.id;
  return parent.id;
}

/**
 * Every child this run creates, by id.
 *
 * Tracking happens at the single point of creation (makeChild) rather than at
 * each use site, because the leak this fixes came from cleanup living at the
 * end of ~20 individual test blocks: a failed assertion or an unexpected null
 * skipped the block's cleanup and left its children behind. 72 orphans had
 * accumulated that way, cluttering the child picker.
 *
 * Deletion is by explicit id only — never by name prefix — so a run can only
 * ever remove rows it created itself, even if two runs overlap.
 */
const createdChildIds = new Set();

/** Distinguishes this run's fixtures from a concurrent run's, for humans
 *  reading the table. Deletion never relies on it. */
const RUN_ID = Math.random().toString(36).slice(2, 8);

async function makeChild(label, rating) {
  const parentId = await getTestParentId();
  const row = {
    parent_id: parentId,
    display_name: `${label}~${RUN_ID}`.slice(0, 40),
    avatar_id: "knight-kid",
    buddy_id: "wise-owl",
  };
  if (rating !== undefined) row.rating = rating;
  const { data, error } = await admin.from("children").insert(row).select("id, rating").single();
  if (error) throw new Error("makeChild failed: " + error.message);
  // Track before returning, so a throw later in the caller still leaves the id
  // recorded for the finally block.
  createdChildIds.add(data.id);
  return data;
}

async function getRating(childId) {
  const { data } = await admin.from("children").select("rating").eq("id", childId).single();
  return data.rating;
}

async function cleanupChild(childId) {
  await admin.from("rating_history").delete().or(`child_id.eq.${childId},opponent_child_id.eq.${childId}`);
  await admin.from("matchmaking_queue").delete().eq("child_id", childId);
  await admin.from("online_games").delete().or(`host_child_id.eq.${childId},guest_child_id.eq.${childId}`);
  await admin.from("children").delete().eq("id", childId);
}


/**
 * Remove every fixture THIS RUN created, by explicit id.
 *
 * Runs in a finally, so it executes after a passing run, a failing assertion,
 * an unexpected throw, or an early return alike. Idempotent: cleanupChild
 * deletes by id, so re-deleting a row a test block already removed is a no-op.
 *
 * Deliberately never deletes by name prefix. A prefix delete would reach a
 * concurrent run's rows, and "everything that looks like a fixture" is exactly
 * the kind of broad delete that turns a test-hygiene fix into data loss.
 */
async function cleanupTrackedFixtures() {
  const ids = [...createdChildIds];
  if (ids.length === 0) return;

  const failed = [];
  for (const id of ids) {
    try {
      await cleanupChild(id);
    } catch (e) {
      failed.push(`${id}: ${e.message}`);
    }
  }

  // Prove it rather than assume it: re-read the ids just deleted.
  let remaining = [];
  try {
    const { data } = await admin.from("children").select("id").in("id", ids);
    remaining = data ?? [];
  } catch (e) {
    console.warn("cleanup verification could not run:", e.message);
  }

  if (failed.length || remaining.length) {
    console.error(`
CLEANUP INCOMPLETE: ${remaining.length} of ${ids.length} fixture children still present.`);
    for (const f of failed) console.error("  delete failed - " + f);
    for (const r of remaining) console.error("  still present - " + r.id);
    process.exitCode = 1;
  } else {
    console.log(`cleaned up ${ids.length} fixture children (run ${RUN_ID})`);
  }
  createdChildIds.clear();
}

/**
 * Remove RS_* fixtures left behind by OLDER runs, from before tracking existed.
 *
 * Opt-in only (--sweep-orphans). Unlike the tracked cleanup above, this matches
 * on a name prefix and so could reach another run's in-flight rows. It is a
 * migration aid for historical orphans, not part of a normal run.
 */
async function sweepLegacyOrphans() {
  const parentId = await getTestParentId();
  const { data } = await admin
    .from("children")
    .select("id, display_name")
    .eq("parent_id", parentId);
  const strays = (data ?? []).filter((c) => (c.display_name || "").startsWith("RS_"));
  if (!strays.length) {
    console.log("no legacy RS_* orphans found");
    return;
  }
  console.log(`sweeping ${strays.length} legacy RS_* orphan(s):`);
  for (const c of strays) {
    console.log("  " + c.display_name);
    await cleanupChild(c.id);
  }
}

/** Seed a finished online_games row directly (data seeding, not calling the RPC on someone's behalf). */
async function seedFinishedGame(hostId, guestId, winner, matchType) {
  const { data, error } = await admin
    .from("online_games")
    .insert({
      host_child_id: hostId,
      guest_child_id: guestId,
      host_color: "w",
      status: "finished",
      winner,
      match_type: matchType || "random",
      time_control: "10+0",
    })
    .select("id")
    .single();
  if (error) throw new Error("seedFinishedGame failed: " + error.message);
  return data.id;
}

async function seedQueueRow(childId, rating, secondsAgo, timeControl) {
  const createdAt = new Date(Date.now() - (secondsAgo ?? 0) * 1000).toISOString();
  const row = { child_id: childId, rating, status: "waiting", created_at: createdAt };
  // 0035 made the queue per-speed: find_or_create_match only considers rows
  // whose time_control equals the searcher's. Without this a 5+0 searcher can
  // never find a seeded opponent, because the column defaults to 10+0.
  if (timeControl) row.time_control = timeControl;
  const { error } = await admin.from("matchmaking_queue").insert(row);
  if (error) throw new Error("seedQueueRow failed: " + error.message);
}

async function runSuite() {
  const client = createClient(url, anonKey);
  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email: "dev-test@local.chessmind.test",
    password: "dev-test-local-only-not-secret",
  });
  if (authError) throw new Error("sign-in failed: " + authError.message);

  console.log("\n=== A: new user starts at 400 ===");
  {
    const c = await makeChild("RS_NewUser");
    check("brand-new child defaults to rating 400", c.rating === 400, c.rating);
    await cleanupChild(c.id);
  }

  console.log("\n=== B: existing user rating preserved ===");
  {
    const c = await makeChild("RS_Existing1200", 1200);
    check("explicitly-seeded 1200 rating is stored as-is, untouched", c.rating === 1200, c.rating);
    await cleanupChild(c.id);
  }

  console.log("\n=== C: equal ratings, win/loss ~16 ===");
  {
    const a = await makeChild("RS_Equal_A", 400);
    const b = await makeChild("RS_Equal_B", 400);
    const gameId = await seedFinishedGame(a.id, b.id, "w"); // host (a) wins
    const r = await client.rpc("apply_match_rating", { p_game_id: gameId });
    check("apply_match_rating succeeds", !r.error, r.error?.message);
    const aAfter = await getRating(a.id);
    const bAfter = await getRating(b.id);
    check("winner (400 vs 400) gains ~16", Math.abs(aAfter - 416) <= 1, aAfter);
    // The raw Elo math would put the loser at ~384, but the 400 floor
    // (section 4 of the spec, layered on top of section 3's example)
    // clamps any update back up to 400 -- this IS the floor doing its job,
    // not a miscalculation. See scenario G below for a case that proves
    // the floor engages from a value that would otherwise land elsewhere.
    check("loser (400 vs 400) is floored at 400, not driven below it", bAfter === 400, bAfter);
    await cleanupChild(a.id);
    await cleanupChild(b.id);
  }

  console.log("\n=== D/E: higher beats lower (small gain) vs lower beats higher (large gain) ===");
  {
    const strong = await makeChild("RS_Strong", 800);
    const weak = await makeChild("RS_Weak", 400);
    const gameId = await seedFinishedGame(strong.id, weak.id, "w"); // strong (host) wins
    await client.rpc("apply_match_rating", { p_game_id: gameId });
    const strongAfter = await getRating(strong.id);
    const weakAfter = await getRating(weak.id);
    const strongGain = strongAfter - 800;
    check("higher-rated player beating a lower-rated player gains only a small amount", strongGain > 0 && strongGain < 8, strongGain);
    check("lower-rated player losing to a much higher-rated player loses only a small amount", Math.abs(weakAfter - 400) < 8, weakAfter);
    await cleanupChild(strong.id);
    await cleanupChild(weak.id);
  }
  {
    const strong = await makeChild("RS_Strong2", 800);
    const weak = await makeChild("RS_Weak2", 400);
    const gameId = await seedFinishedGame(weak.id, strong.id, "w"); // weak (host) wins upset
    await client.rpc("apply_match_rating", { p_game_id: gameId });
    const weakAfter = await getRating(weak.id);
    const strongAfter = await getRating(strong.id);
    const weakGain = weakAfter - 400;
    check("lower-rated player beating a much higher-rated player gains a large amount", weakGain > 24, weakGain);
    check("higher-rated player losing to a much lower-rated player loses a large amount", 800 - strongAfter > 24, 800 - strongAfter);
    await cleanupChild(strong.id);
    await cleanupChild(weak.id);
  }

  console.log("\n=== F: draw ===");
  {
    const a = await makeChild("RS_Draw_A", 400);
    const b = await makeChild("RS_Draw_B", 400);
    const gameId = await seedFinishedGame(a.id, b.id, "draw");
    await client.rpc("apply_match_rating", { p_game_id: gameId });
    const aAfter = await getRating(a.id);
    const bAfter = await getRating(b.id);
    check("equal-rated draw leaves both ratings unchanged (expected score already 0.5)", aAfter === 400 && bAfter === 400, `${aAfter}, ${bAfter}`);
    await cleanupChild(a.id);
    await cleanupChild(b.id);
  }

  console.log("\n=== G: rating never falls below 400 ===");
  {
    // The floor only means something if the UNCLAMPED Elo result would
    // actually go below 400 -- that requires the near-400 player to be the
    // FAVORITE (higher- or equal-rated) and still lose, so the expected-
    // score term is large and the penalty is real. A 400-rated player
    // losing to a much weaker (300-rated) opponent is exactly that case:
    // expected score for the 400 side is high, so losing is heavily
    // punished by raw Elo math (~400 - 25 = 375), which the floor must
    // catch.
    const low = await makeChild("RS_Floor", 400);
    const weaker = await makeChild("RS_FloorOpp", 300);
    const gameId = await seedFinishedGame(low.id, weaker.id, "b"); // low (host, favorite) loses an upset
    await client.rpc("apply_match_rating", { p_game_id: gameId });
    const lowAfter = await getRating(low.id);
    check("an upset loss that would drop a 400-rated favorite below 400 is floored at exactly 400", lowAfter === 400, lowAfter);
    await cleanupChild(low.id);
    await cleanupChild(weaker.id);
  }

  console.log("\n=== H: simultaneous result submissions apply rating exactly once ===");
  {
    const a = await makeChild("RS_Concurrent_A", 400);
    const b = await makeChild("RS_Concurrent_B", 400);
    const gameId = await seedFinishedGame(a.id, b.id, "w");
    const results = await Promise.all(Array.from({ length: 8 }, () => client.rpc("apply_match_rating", { p_game_id: gameId })));
    check("all 8 concurrent apply_match_rating calls succeed without error", results.every((r) => !r.error), JSON.stringify(results.filter((r) => r.error).map((r) => r.error.message)));
    const aAfter = await getRating(a.id);
    check("rating applied exactly once despite 8 concurrent calls", aAfter === 416, aAfter);
    const { count } = await admin.from("rating_history").select("id", { count: "exact", head: true }).eq("game_id", gameId);
    check("exactly 2 rating_history rows written (one per player), not 16", count === 2, count);
    await cleanupChild(a.id);
    await cleanupChild(b.id);
  }

  console.log("\n=== I: client cannot directly modify rating ===");
  {
    const c = await makeChild("RS_NoDirect", 400);
    const { error } = await client.from("children").update({ rating: 9999 }).eq("id", c.id);
    const after = await getRating(c.id);
    check("direct client UPDATE of children.rating is blocked", !!error || after === 400, error?.message ?? after);
    const { error: insErr, data: insData } = await client.from("children").insert({ parent_id: await getTestParentId(), display_name: "RS_InsertRating", rating: 9999 }).select("id");
    check("direct client INSERT with an explicit rating is blocked", !!insErr, insErr?.message ?? JSON.stringify(insData));
    // This insert is expected to be blocked; if it ever succeeds, the row is
    // still tracked so the finally block removes it.
    if (!insErr && insData?.[0]?.id) {
      createdChildIds.add(insData[0].id);
      await admin.from("children").delete().eq("id", insData[0].id);
    }
    await cleanupChild(c.id);
  }

  console.log("\n=== J: tournament result does not modify rating ===");
  {
    const a = await makeChild("RS_Tourney_A", 400);
    const b = await makeChild("RS_Tourney_B", 400);
    const gameId = await seedFinishedGame(a.id, b.id, "w", "tournament");
    await client.rpc("apply_match_rating", { p_game_id: gameId });
    const aAfter = await getRating(a.id);
    check("tournament-type game does not change rating even if apply_match_rating is called", aAfter === 400, aAfter);
    const { count } = await admin.from("rating_history").select("id", { count: "exact", head: true }).eq("game_id", gameId);
    check("no rating_history row written for a tournament game", count === 0, count);
    await cleanupChild(a.id);
    await cleanupChild(b.id);
  }

  console.log("\n=== K: Invite Friend does not modify rating ===");
  {
    const a = await makeChild("RS_Invite_A", 400);
    const b = await makeChild("RS_Invite_B", 400);
    const gameId = await seedFinishedGame(a.id, b.id, "w", "invite");
    await client.rpc("apply_match_rating", { p_game_id: gameId });
    const aAfter = await getRating(a.id);
    check("invite-type game does not change rating", aAfter === 400, aAfter);
    await cleanupChild(a.id);
    await cleanupChild(b.id);
  }

  console.log("\n=== L: matchmaking selects closest available rating ===");
  {
    const searcher = await makeChild("RS_Closest_Searcher", 520);
    const near = await makeChild("RS_Closest_Near", 515);
    const mid = await makeChild("RS_Closest_Mid", 470);
    const far1 = await makeChild("RS_Closest_Far1", 700);
    const far2 = await makeChild("RS_Closest_Far2", 900);
    for (const c of [near, mid, far1, far2]) await seedQueueRow(c.id, c.rating, 0);
    const r = await client.rpc("find_or_create_match", { p_child_id: searcher.id, p_rating: searcher.rating, p_time_control: "10+0" });
    check("matchmaking call succeeds", !r.error, r.error?.message);
    check("matched immediately (someone within the initial window)", r.data[0].matched === true, JSON.stringify(r.data));
    const game = await admin.from("online_games").select("host_child_id, guest_child_id").eq("id", r.data[0].game_id).single();
    const opponentId = game.data.host_child_id === searcher.id ? game.data.guest_child_id : game.data.host_child_id;
    check("closest available rating (515) was chosen, not 470/700/900", opponentId === near.id, opponentId);
    for (const c of [searcher, near, mid, far1, far2]) await cleanupChild(c.id);
  }

  console.log("\n=== M: matchmaking expands search range when necessary ===");
  {
    const searcher = await makeChild("RS_Expand_Searcher", 500);
    const distant = await makeChild("RS_Expand_Distant", 850); // 350 away -- outside the immediate ±50 window
    await seedQueueRow(distant.id, distant.rating, 130); // waited 130s -> window is ±400 by then, so 350 is in range
    const r = await client.rpc("find_or_create_match", { p_child_id: searcher.id, p_rating: searcher.rating, p_time_control: "10+0" });
    check("a candidate far outside the immediate window is still matched once their own wait has expanded it enough", r.data?.[0]?.matched === true, JSON.stringify(r.data));
    await cleanupChild(searcher.id);
    await cleanupChild(distant.id);
  }
  {
    const searcher = await makeChild("RS_NoExpand_Searcher", 500);
    const tooFar = await makeChild("RS_NoExpand_TooFar", 1200); // 700 away, waited only 5s -> window is ±50
    await seedQueueRow(tooFar.id, tooFar.rating, 5);
    const r = await client.rpc("find_or_create_match", { p_child_id: searcher.id, p_rating: searcher.rating, p_time_control: "10+0" });
    check("a candidate still far outside their own (small) current window is correctly NOT matched", r.data?.[0]?.matched === false, JSON.stringify(r.data));
    await admin.from("matchmaking_queue").delete().eq("child_id", tooFar.id);
    await cleanupChild(searcher.id);
    await cleanupChild(tooFar.id);
  }

  console.log("\n=== N: longest-waiting candidate wins tie-break on equal rating difference ===");
  {
    const searcher = await makeChild("RS_Tie_Searcher", 500);
    const newer = await makeChild("RS_Tie_Newer", 520); // +20, waited less
    const older = await makeChild("RS_Tie_Older", 480); // -20, waited more (same absolute difference)
    await seedQueueRow(newer.id, newer.rating, 2);
    await seedQueueRow(older.id, older.rating, 10);
    const r = await client.rpc("find_or_create_match", { p_child_id: searcher.id, p_rating: searcher.rating, p_time_control: "10+0" });
    const game = await admin.from("online_games").select("host_child_id, guest_child_id").eq("id", r.data[0].game_id).single();
    const opponentId = game.data.host_child_id === searcher.id ? game.data.guest_child_id : game.data.host_child_id;
    check("with an equal rating gap, the longer-waiting candidate is chosen", opponentId === older.id, opponentId);
    await cleanupChild(searcher.id);
    await cleanupChild(newer.id);
    await cleanupChild(older.id);
  }

  console.log("\n=== O: no duplicate/leftover matchmaking rows after a match ===");
  {
    const a = await makeChild("RS_NoDup_A", 400);
    const b = await makeChild("RS_NoDup_B", 400);
    await seedQueueRow(b.id, b.rating, 0);
    await client.rpc("find_or_create_match", { p_child_id: a.id, p_rating: a.rating, p_time_control: "10+0" });
    const { count } = await admin.from("matchmaking_queue").select("id", { count: "exact", head: true }).in("child_id", [a.id, b.id]).eq("status", "waiting");
    check("no leftover 'waiting' queue rows for either player after a match", count === 0, count);
    await cleanupChild(a.id);
    await cleanupChild(b.id);
  }

  console.log("\n=== P: two players cannot be matched into two games simultaneously (concurrency) ===");
  {
    const searchers = [];
    for (let i = 0; i < 6; i++) searchers.push(await makeChild(`RS_Conc_${i}`, 400 + i * 5));
    const results = await Promise.all(searchers.map((c) => client.rpc("find_or_create_match", { p_child_id: c.id, p_rating: c.rating, p_time_control: "10+0" })));
    check("all 6 concurrent matchmaking calls succeed", results.every((r) => !r.error), JSON.stringify(results.filter((r) => r.error).map((r) => r.error.message)));
    const gameIds = [...new Set(results.map((r) => r.data?.[0]?.game_id).filter(Boolean))];
    const { data: games } = await admin.from("online_games").select("host_child_id, guest_child_id").in("id", gameIds);
    const appearances = {};
    for (const g of games) {
      appearances[g.host_child_id] = (appearances[g.host_child_id] || 0) + 1;
      appearances[g.guest_child_id] = (appearances[g.guest_child_id] || 0) + 1;
    }
    const doubleBooked = Object.values(appearances).filter((n) => n > 1);
    check("no player appears in more than one created game (no double-booking under concurrency)", doubleBooked.length === 0, JSON.stringify(appearances));
    for (const c of searchers) await cleanupChild(c.id);
  }

  console.log("\n=== Q: 20+ players, sensible closest-rating pairings ===");
  {
    const ratings = [400, 405, 410, 420, 425, 440, 460, 480, 500, 520, 540, 560, 600, 650, 700, 750, 800, 850, 900, 950, 1000, 1100];
    const kids = [];
    for (let i = 0; i < ratings.length; i++) kids.push(await makeChild(`RS_Q_${i}`, ratings[i]));
    for (const c of kids) await seedQueueRow(c.id, c.rating, 0);
    // Pop them off one at a time via a fresh searcher matching against the remaining pool.
    let anyMismatch = false;
    for (let i = 0; i < kids.length - 1; i += 2) {
      const remaining = await admin.from("matchmaking_queue").select("child_id, rating").eq("status", "waiting").in("child_id", kids.map((k) => k.id));
      if (remaining.data.length < 2) break;
      const searcher = remaining.data[0];
      await admin.from("matchmaking_queue").delete().eq("child_id", searcher.child_id); // remove searcher from pool, they're now the active searcher
      const r = await client.rpc("find_or_create_match", { p_child_id: searcher.child_id, p_rating: searcher.rating, p_time_control: "10+0" });
      if (!r.data?.[0]?.matched) continue;
      const game = await admin.from("online_games").select("host_child_id, guest_child_id").eq("id", r.data[0].game_id).single();
      const opponentId = game.data.host_child_id === searcher.child_id ? game.data.guest_child_id : game.data.host_child_id;
      const opponentRating = remaining.data.find((r2) => r2.child_id === opponentId)?.rating;
      const bestPossible = remaining.data.filter((r2) => r2.child_id !== searcher.child_id).reduce((best, cand) => (Math.abs(cand.rating - searcher.rating) < Math.abs(best.rating - searcher.rating) ? cand : best));
      if (opponentRating !== undefined && Math.abs(opponentRating - searcher.rating) > Math.abs(bestPossible.rating - searcher.rating)) anyMismatch = true;
    }
    check("across a 22-player pool, every pairing chose the closest (or tied-closest) available rating", !anyMismatch);
    for (const c of kids) await cleanupChild(c.id);
  }

  console.log("\n=== R: new players at 400 can find each other ===");
  {
    const a = await makeChild("RS_400_A", 400);
    const b = await makeChild("RS_400_B", 400);
    await seedQueueRow(b.id, 400, 0);
    const r = await client.rpc("find_or_create_match", { p_child_id: a.id, p_rating: 400, p_time_control: "10+0" });
    check("two fresh 400-rated players match each other immediately", r.data?.[0]?.matched === true, JSON.stringify(r.data));
    await cleanupChild(a.id);
    await cleanupChild(b.id);
  }

  console.log("\n=== S: 400-rated player does not skip a closer 420 to match a 1200 ===");
  {
    const searcher = await makeChild("RS_S_Searcher", 400);
    const close = await makeChild("RS_S_Close", 420);
    const far = await makeChild("RS_S_Far", 1200);
    await seedQueueRow(close.id, 420, 0);
    await seedQueueRow(far.id, 1200, 200); // even with a huge expanded window, closest-first must still win
    const r = await client.rpc("find_or_create_match", { p_child_id: searcher.id, p_rating: 400, p_time_control: "10+0" });
    const game = await admin.from("online_games").select("host_child_id, guest_child_id").eq("id", r.data[0].game_id).single();
    const opponentId = game.data.host_child_id === searcher.id ? game.data.guest_child_id : game.data.host_child_id;
    check("the closer 420-rated candidate is chosen over the 1200, even though the 1200 is also technically eligible", opponentId === close.id, opponentId);
    await cleanupChild(searcher.id);
    await cleanupChild(close.id);
    await cleanupChild(far.id);
  }

  console.log("\n=== T0: 0041 — one canonical signature, DEFAULT and explicit ===");
  {
    // Two arguments. Before 0041 both overloads matched this and PostgREST
    // refused with PGRST203; afterwards it resolves to the canonical function
    // and the omitted third parameter falls back to its DEFAULT.
    const a = await makeChild("RS_TC_Default_A", 500);
    const b = await makeChild("RS_TC_Default_B", 505);
    await seedQueueRow(b.id, 505, 0);
    const r = await client.rpc("find_or_create_match", { p_child_id: a.id, p_rating: 500 });
    check("a 2-argument call resolves (no PGRST203 ambiguity)", !r.error, r.error?.message);
    check("a 2-argument call still matches players", r.data?.[0]?.matched === true, JSON.stringify(r.data));
    if (r.data?.[0]?.game_id) {
      const g = await admin.from("online_games").select("time_control, white_time_ms").eq("id", r.data[0].game_id).single();
      check("the omitted third argument defaults to 10+0",
        g.data?.time_control === "10+0", JSON.stringify(g.data));
      check("the clock trigger sized 10+0 correctly (600000ms)",
        Number(g.data?.white_time_ms) === 600000, String(g.data?.white_time_ms));
    }
    await cleanupChild(a.id);
    await cleanupChild(b.id);
  }
  {
    // Three arguments, a non-default control. The chosen speed must reach the
    // created game, not be silently replaced by 10+0.
    const a = await makeChild("RS_TC_Explicit_A", 600);
    const b = await makeChild("RS_TC_Explicit_B", 605);
    await seedQueueRow(b.id, 605, 0, "5+0");
    const r = await client.rpc("find_or_create_match", { p_child_id: a.id, p_rating: 600, p_time_control: "5+0" });
    check("a 3-argument call resolves", !r.error, r.error?.message);
    if (r.data?.[0]?.game_id) {
      const g = await admin.from("online_games").select("time_control, white_time_ms").eq("id", r.data[0].game_id).single();
      check("the chosen time control is persisted (5+0)",
        g.data?.time_control === "5+0", JSON.stringify(g.data));
      check("the clock trigger sized 5+0 correctly (300000ms)",
        Number(g.data?.white_time_ms) === 300000, String(g.data?.white_time_ms));
    } else {
      check("3-argument call matched a same-speed opponent", false, JSON.stringify(r.data));
    }
    await cleanupChild(a.id);
    await cleanupChild(b.id);
  }

  console.log("\n=== T: existing Random Match functionality (full real flow) ===");
  {
    const a = await makeChild("RS_Full_A", 400);
    const b = await makeChild("RS_Full_B", 420);
    await seedQueueRow(b.id, 420, 0);
    const matchResult = await client.rpc("find_or_create_match", { p_child_id: a.id, p_rating: 400, p_time_control: "10+0" });
    check("matchmaking creates a real game", matchResult.data?.[0]?.matched === true, JSON.stringify(matchResult.data));
    const gameId = matchResult.data[0].game_id;
    const game = await admin.from("online_games").select("*").eq("id", gameId).single();
    check("created game has match_type='random' and a real clock", game.data.match_type === "random" && game.data.white_time_ms > 0, JSON.stringify(game.data));
    const mover = game.data.host_color === "w" ? game.data.host_child_id : game.data.guest_child_id;
    // Moves and results go through the SERVER path now. 0037/0038/0039 revoked
    // the browser-facing RPCs, so a signed-in client calling them directly must
    // be refused — assert that too, because it is the security property, not an
    // inconvenience to work around.
    const browserMove = await client.rpc("submit_online_move", { p_game_id: gameId, p_child_id: mover, p_fen: "forged", p_san: "e4" });
    check("a browser CANNOT submit a move directly", !!browserMove.error, "the browser-facing RPC accepted a call");
    const browserFinish = await client.rpc("finish_online_game_by_result", { p_game_id: gameId, p_child_id: mover, p_winner: game.data.host_color });
    check("a browser CANNOT declare a result directly", !!browserFinish.error, "the browser-facing RPC accepted a call");

    // Colours, derived rather than assumed: find_or_create_match assigns
    // host_color randomly, and the old version of this block declared
    // game.host_color the winner after a single move — which is a SELF-declared
    // win half the time, and a resignation the other half. That made it a 50/50
    // flake against 0036's minimum-plies guard.
    const white = game.data.host_color === "w" ? game.data.host_child_id : game.data.guest_child_id;
    const black = game.data.host_color === "w" ? game.data.guest_child_id : game.data.host_child_id;
    const moverColor = mover === white ? "w" : "b";

    const moveResult = await admin.rpc("submit_online_move_as_server", { p_game_id: gameId, p_child_id: mover, p_fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", p_san: "e4" });
    check("a real move can be submitted on the matched game (server path)", !moveResult.error, moveResult.error?.message);

    // 0036's guard: the fastest possible mate is four plies, so a player
    // claiming a win for THEMSELVES after one move cannot be reporting a real
    // checkmate. Assert it fires — this is the anti-exploit property, and it
    // must hold on the server path too.
    const premature = await admin.rpc("finish_online_game_by_result_as_server", { p_game_id: gameId, p_child_id: mover, p_winner: moverColor });
    check("a self-declared win before 4 plies is refused even on the server path",
      !!premature.error && /before a checkmate is possible/.test(premature.error.message ?? ""),
      premature.error?.message ?? "the premature claim was ACCEPTED");

    // Play out to four plies so a win claim is legitimate, then finish.
    for (const [child, fen, san] of [
      [black, "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", "e5"],
      [white, "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2", "Nf3"],
      [black, "rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", "Nf6"],
    ]) {
      const r = await admin.rpc("submit_online_move_as_server", { p_game_id: gameId, p_child_id: child, p_fen: fen, p_san: san });
      check("subsequent server-path move accepted (" + san + ")", !r.error, r.error?.message);
    }

    const finishResult = await admin.rpc("finish_online_game_by_result_as_server", { p_game_id: gameId, p_child_id: mover, p_winner: moverColor });
    check("the game can be finished via the server result RPC once 4 plies are played", !finishResult.error, finishResult.error?.message);
    const ratingResult = await client.rpc("apply_match_rating", { p_game_id: gameId });
    check("rating applies after finishing", !ratingResult.error, ratingResult.error?.message);
    const finalGame = await admin.from("online_games").select("host_rating_before, host_rating_after, guest_rating_before, guest_rating_after").eq("id", gameId).single();
    check("post-game rating before/after values are populated for the result screen", typeof finalGame.data.host_rating_before === "number" && typeof finalGame.data.host_rating_after === "number", JSON.stringify(finalGame.data));
    await cleanupChild(a.id);
    await cleanupChild(b.id);
  }


  console.log(`\n=== RATING SYSTEM SUMMARY: ${pass} passed, ${fail} failed ===`);
  if (fail > 0) {
    console.log("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
    // exitCode, not exit(): process.exit() here would terminate before the
    // finally block runs and leak every fixture this run created.
    process.exitCode = 1;
  }
}

/**
 * Entry point. The finally is the point of this structure: no outcome — pass,
 * fail, throw, or early return — can skip fixture cleanup.
 */
async function main() {
  if (process.argv.includes("--sweep-orphans")) {
    await sweepLegacyOrphans();
    return;
  }
  try {
    await runSuite();
  } finally {
    await cleanupTrackedFixtures();
  }
}

main().catch((err) => {
  console.error("Rating system test suite crashed:", err.message ?? err);
  process.exitCode = 1;
});

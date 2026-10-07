const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
function loadEnvLocal() {
  const content = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnvLocal();
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
function shape(err) {
  if (!err) return null;
  return { code: err.code, message: String(err.message || "").slice(0, 500), details: String(err.details || "").slice(0, 400), hint: String(err.hint || "").slice(0, 400) };
}
(async () => {
  const out = {};
  out.upsert_min = await (async () => {
    const { error } = await admin.rpc("upsert_child_game_review_analysis", {
      p_child_id: "00000000-0000-0000-0000-000000000000",
      p_source: "free_play",
      p_game_ref: "audit-probe",
    });
    return { error: shape(error) };
  })();
  out.find_full = await (async () => {
    const { error } = await admin.rpc("find_or_create_match", {
      p_child_id: "00000000-0000-0000-0000-000000000000",
      p_rating: 800,
      p_time_control: "10+0",
    });
    return { error: shape(error) };
  })();
  out.abandon_full = await (async () => {
    const { error } = await admin.rpc("abandon_matched_game", {
      p_game_id: "00000000-0000-0000-0000-000000000000",
      p_child_id: "00000000-0000-0000-0000-000000000000",
    });
    return { error: shape(error) };
  })();
  out.status_counts = {};
  for (const s of ["waiting", "matched", "active", "finished", "bogus"]) {
    const { count, error } = await admin.from("online_games").select("id", { count: "exact", head: true }).eq("status", s);
    out.status_counts[s] = { count, error: shape(error) };
  }
  const { data: sample } = await admin.from("online_games").select("status, started_at, host_ready_at, guest_ready_at, last_move_at, match_type").limit(5);
  out.sample_games = sample;
  const { count: tymCount } = await admin.from("child_train_your_mind_activity").select("id", { count: "exact", head: true });
  out.tym_rows = tymCount;
  const { data: tymSample } = await admin.from("child_train_your_mind_activity").select("activities_completed").limit(10);
  out.tym_counts = (tymSample || []).map((r) => r.activities_completed);
  const { count: matchedQ } = await admin.from("matchmaking_queue").select("id", { count: "exact", head: true }).eq("status", "waiting");
  out.queue_waiting = matchedQ;

  const openapi = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      Accept: "application/openapi+json",
    },
  }).then((r) => r.json());
  const paths = Object.keys(openapi.paths || {}).filter((p) => p.includes("rpc"));
  out.rpc_paths = paths.filter((p) =>
    /record_train|upsert_child_game|find_or_create|mark_game|abandon_matched|expire_abandoned|check_free|consume_free|get_free_game/.test(p)
  );
  const rpcs = {};
  for (const p of out.rpc_paths) {
    const post = openapi.paths[p].post || {};
    const params = (post.parameters || []).map((x) => x.name);
    rpcs[p] = { params, summary: post.summary };
  }
  out.rpc_openapi = rpcs;
  console.log(JSON.stringify(out, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

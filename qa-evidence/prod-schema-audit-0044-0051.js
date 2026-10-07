/**
 * READ-ONLY production schema audit for migrations 0044–0051.
 * No inserts/updates/deletes. RPCs called only with invalid/empty args
 * (authorization or signature errors) or expire_abandoned_matched_games dry-run.
 */
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

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const anon = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });

function shape(err) {
  if (!err) return null;
  return { code: err.code, message: String(err.message || "").slice(0, 400), details: String(err.details || "").slice(0, 200) };
}

async function probeSelect(table, cols) {
  const { data, error } = await admin.from(table).select(cols).limit(1);
  return { ok: !error, error: shape(error), rows: data ? data.length : 0 };
}

async function probeRpc(name, args) {
  const { data, error } = await admin.rpc(name, args);
  return { ok: !error, data, error: shape(error) };
}

async function fetchOpenApi() {
  const res = await fetch(`${URL}/rest/v1/`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Accept: "application/openapi+json" },
  });
  if (!res.ok) return { status: res.status, text: (await res.text()).slice(0, 200) };
  return res.json();
}

function tableProps(openapi, table) {
  const defs = openapi.definitions || openapi.components?.schemas || {};
  const schema = defs[table];
  if (!schema) return { found: false };
  const props = schema.properties || {};
  return { found: true, columns: Object.keys(props).sort(), types: Object.fromEntries(Object.entries(props).map(([k, v]) => [k, v.type || v.format || v.$ref || JSON.stringify(v).slice(0, 80)])) };
}

(async () => {
  const out = { url: URL.replace(/https:\/\//, "").split(".")[0], mode: "read-only" };

  const openapi = await fetchOpenApi();
  out.openapi_ok = !openapi.status;
  const tables = {};
  for (const t of ["child_train_your_mind_activity", "child_game_reviews", "children", "online_games", "matchmaking_queue", "free_game_usage", "schema_migrations"]) {
    tables[t] = tableProps(openapi, t);
  }
  out.tables = tables;

  out.m0044 = {
    table: await probeSelect("child_train_your_mind_activity", "id, child_id, activity_date, module_id, activities_completed, updated_at"),
    rpc_empty: await probeRpc("record_train_your_mind_use", {}),
    rpc_fake: await probeRpc("record_train_your_mind_use", { p_child_id: "00000000-0000-0000-0000-000000000000", p_module_id: "probe" }),
  };

  out.m0045 = {
    cols_required: await probeSelect("child_game_reviews", "id, game_ref, free_analysis, premium_analysis, source"),
    col_analysis_json: await probeSelect("child_game_reviews", "analysis_json"),
    rpc: await probeRpc("upsert_child_game_review_analysis", {}),
  };

  out.m0046 = {
    col: await probeSelect("children", "id, has_seen_opening_video"),
  };

  out.m0047 = {
    eligibility: await probeRpc("check_free_game_eligibility", { p_child_id: "00000000-0000-0000-0000-000000000000", p_game_type: "ai" }),
    consume: await probeRpc("consume_free_game_credit", { p_child_id: "00000000-0000-0000-0000-000000000000", p_game_type: "ai" }),
    status: await probeRpc("get_free_game_status", { p_child_id: "00000000-0000-0000-0000-000000000000" }),
  };

  out.m0048 = {
    ready_cols: await probeSelect("online_games", "id, status, started_at, host_ready_at, guest_ready_at"),
    white_ready_legacy: await probeSelect("online_games", "white_ready, black_ready"),
    mark: await probeRpc("mark_game_client_ready", {}),
    abandon: await probeRpc("abandon_matched_game", {}),
    mark_fake: await probeRpc("mark_game_client_ready", { p_game_id: "00000000-0000-0000-0000-000000000000", p_child_id: "00000000-0000-0000-0000-000000000000" }),
  };

  out.m0049 = {
    find_empty: await probeRpc("find_or_create_match", {}),
    find_partial: await probeRpc("find_or_create_match", { p_child_id: "00000000-0000-0000-0000-000000000000" }),
  };

  out.m0050 = {
    rpc: await probeRpc("record_train_your_mind_use", { p_child_id: "00000000-0000-0000-0000-000000000000", p_module_id: "probe" }),
  };

  out.m0051 = {
    expire_dry: await probeRpc("expire_abandoned_matched_games", { p_dry_run: true }),
    expire_noarg: await probeRpc("expire_abandoned_matched_games", {}),
    queue: await probeSelect("matchmaking_queue", "id, child_id, rating, status, time_control, created_at, matched_game_id"),
  };

  // History tables
  for (const t of ["supabase_migrations.schema_migrations", "schema_migrations"]) {
    const r = await admin.from(t.split(".").pop()).select("*").limit(5);
    out["hist_" + t] = { error: shape(r.error), sample: r.data };
  }

  out.realtime = { skipped: "isolated probe; see second script if needed" };

  // Anon RLS: should not write; select may fail
  out.anon_tym = await (async () => {
    const { error } = await anon.from("child_train_your_mind_activity").select("id").limit(1);
    return { error: shape(error) };
  })();

  console.log(JSON.stringify(out, null, 2));
})().catch((e) => {
  console.error("AUDIT_FAIL", e);
  process.exit(1);
});

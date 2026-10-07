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
  if (!err) return "ok";
  return { code: err.code, message: String(err.message || "").slice(0, 180) };
}

(async () => {
  const out = {};

  const t44 = await admin.from("child_train_your_mind_activity").select("child_id").limit(1);
  out.m0044_table = t44.error ? shape(t44.error) : "present";

  const r44 = await admin.rpc("record_train_your_mind_use", { p_child_id: "00000000-0000-0000-0000-000000000000" });
  out.m0044_rpc = r44.error ? shape(r44.error) : "callable";

  const t45 = await admin.from("child_game_reviews").select("id, analysis_json, source, game_ref").limit(1);
  out.m0045_reviews = t45.error ? shape(t45.error) : "columns_ok";

  const r45 = await admin.rpc("upsert_child_game_review_analysis", {});
  out.m0045_rpc = r45.error ? shape(r45.error) : "callable";

  const t46 = await admin.from("children").select("has_seen_opening_video").limit(1);
  out.m0046_column = t46.error ? shape(t46.error) : "present";

  const r47a = await admin.rpc("check_free_game_eligibility", { p_child_id: "00000000-0000-0000-0000-000000000000", p_game_type: "ai" });
  out.m0047_eligibility = r47a.error ? shape(r47a.error) : { data: r47a.data };
  const r47b = await admin.rpc("consume_free_game_credit", { p_child_id: "00000000-0000-0000-0000-000000000000", p_game_type: "ai" });
  out.m0047_consume = r47b.error ? shape(r47b.error) : { data: r47b.data };
  const r47c = await admin.rpc("get_free_game_status", { p_child_id: "00000000-0000-0000-0000-000000000000" });
  out.m0047_status = r47c.error ? shape(r47c.error) : { data: r47c.data };

  const t48 = await admin.from("online_games").select("id, status, white_ready, black_ready").limit(1);
  out.m0048_ready_cols = t48.error ? shape(t48.error) : "present";
  const r48a = await admin.rpc("mark_game_client_ready", {});
  out.m0048_mark_ready = r48a.error ? shape(r48a.error) : "callable";
  const r48b = await admin.rpc("abandon_matched_game", {});
  out.m0048_abandon = r48b.error ? shape(r48b.error) : "callable";

  const r49 = await admin.rpc("find_or_create_match", {});
  out.m0049_find_or_create = r49.error ? shape(r49.error) : "callable";

  const r50 = await admin.rpc("record_train_your_mind_use", { p_child_id: "00000000-0000-0000-0000-000000000000" });
  out.m0050_rpc = r50.error ? shape(r50.error) : "callable";

  const r51 = await admin.rpc("expire_abandoned_matched_games", { p_dry_run: true });
  out.m0051_expire = r51.error ? shape(r51.error) : { data: r51.data };

  const q51 = await admin.from("matchmaking_queue").select("id").limit(1);
  out.m0051_queue_table = q51.error ? shape(q51.error) : "present";

  console.log(JSON.stringify(out, null, 2));
})().catch((e) => {
  console.error("AUDIT_FAIL", e.message);
  process.exit(1);
});

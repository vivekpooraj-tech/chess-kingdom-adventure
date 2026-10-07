const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const envPath = path.join(__dirname, "..", ".env.local");
const env = fs.readFileSync(envPath, "utf8");
function get(key) {
  const m = env.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!m) return null;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v;
}

const childId = process.argv[2] || "556bdac3-568c-45f2-ac64-6f41dbe8910a";
const today = new Date().toISOString().slice(0, 10);

const admin = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { autoRefreshToken: false, persistSession: false },
});

(async () => {
  const { data: before, error: readErr } = await admin
    .from("screen_time_usage")
    .select("*")
    .eq("child_id", childId)
    .order("usage_date", { ascending: false })
    .limit(5);
  if (readErr) throw readErr;
  console.log("BEFORE", JSON.stringify(before));

  const { error } = await admin.from("screen_time_usage").upsert(
    { child_id: childId, usage_date: today, minutes_used: 0 },
    { onConflict: "child_id,usage_date" }
  );
  if (error) throw error;

  const { data: after } = await admin
    .from("screen_time_usage")
    .select("*")
    .eq("child_id", childId)
    .eq("usage_date", today)
    .maybeSingle();
  console.log("RESET_OK", JSON.stringify(after));
})().catch((err) => {
  console.error("ERR", err.message);
  process.exit(1);
});

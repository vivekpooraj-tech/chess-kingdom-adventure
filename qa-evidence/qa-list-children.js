const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const env = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
function get(key) {
  const m = env.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!m) return null;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

const admin = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { autoRefreshToken: false, persistSession: false },
});

(async () => {
  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const user = users.users.find((u) => u.email === "rajyam141502@gmail.com");
  const { data: parent } = await admin.from("parents").select("id").eq("auth_user_id", user.id).single();
  const { data: children } = await admin
    .from("children")
    .select("id, display_name, experience_level, avatar_id, buddy_id")
    .eq("parent_id", parent.id);
  console.log(JSON.stringify(children, null, 2));
})();

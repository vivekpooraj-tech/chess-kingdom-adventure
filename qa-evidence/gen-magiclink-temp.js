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

const admin = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { autoRefreshToken: false, persistSession: false },
});

(async () => {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: "rajyam141502@gmail.com",
    options: { redirectTo: "http://localhost:3000/auth/callback" },
  });
  if (error) {
    console.error("ERR", error.message);
    process.exit(1);
  }
  console.log(data.properties.action_link);
})();

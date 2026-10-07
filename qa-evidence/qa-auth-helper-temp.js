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

const url = get("NEXT_PUBLIC_SUPABASE_URL");
const serviceKey = get("SUPABASE_SERVICE_ROLE_KEY");
const anonKey = get("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const email = "rajyam141502@gmail.com";

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const mode = process.argv[2] || "user";
  if (mode === "user") {
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) throw error;
    const user = data.users.find((u) => u.email === email);
    if (!user) {
      console.log("USER_NOT_FOUND");
      return;
    }
    console.log("USER_ID", user.id);
    console.log(
      "PROVIDERS",
      JSON.stringify(user.identities?.map((i) => i.provider) ?? [])
    );
    console.log("CONFIRMED", user.email_confirmed_at ?? "no");
    return;
  }

  if (mode === "link") {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: "http://localhost:3000/auth/callback?next=/kingdom-map" },
    });
    if (error) throw error;
    console.log("ACTION_LINK", data.properties.action_link);
    console.log("HASHED_TOKEN", data.properties.hashed_token);
    return;
  }

  if (mode === "verify-password") {
    const client = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password: "QaTest1234",
    });
    if (error) throw error;
    console.log("SIGNIN_OK", data.user?.email);
    return;
  }

  if (mode === "set-password") {
    const { error } = await admin.auth.admin.updateUserById(
      "cf289421-6387-4971-8661-9fa5682af3bb",
      { password: "QaTest1234" }
    );
    if (error) throw error;
    console.log("PASSWORD_SET_OK");
    return;
  }

  if (mode === "callback-url") {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: "http://localhost:3000/auth/callback?next=/kingdom-map" },
    });
    if (error) throw error;
    const res = await fetch(data.properties.action_link, { redirect: "manual" });
    const location = res.headers.get("location");
    console.log("STATUS", res.status);
    console.log("LOCATION", location ?? "none");
    return;
  }

  if (mode === "local-callback") {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: "http://localhost:3000/auth/callback?next=/kingdom-map" },
    });
    if (error) throw error;
    const tokenHash = data.properties.hashed_token;
    const client = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: otpData, error: otpError } = await client.auth.verifyOtp({
      token_hash: tokenHash,
      type: "email",
    });
    if (otpError) {
      const retry = await client.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
      if (retry.error) throw retry.error;
      console.log("SESSION", JSON.stringify(retry.data.session));
      return;
    }
    console.log("SESSION", JSON.stringify(otpData.session));
  }
}

main().catch((err) => {
  console.error("ERR", err.message);
  process.exit(1);
});

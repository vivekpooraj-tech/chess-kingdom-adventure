// Live HTTP tests against a running dev server for the request-level
// guarantees app/api/ai/coach/route.ts is supposed to enforce.
//
// Requires:
//  - a dev server already running at BASE_URL (default http://localhost:3000)
//  - NEXT_PUBLIC_LOCAL_TEST_MODE=true and a seeded dev test user (see
//    scripts/dev-seed-test-user.js) so this script can obtain a REAL signed
//    -in session cookie the same way the app's own dev auto-signin does --
//    without one, every request here is rejected by middleware.ts before
//    it ever reaches the route, which would only prove the auth gate works
//    and tell us nothing about the route's own validation logic.
//
// Run: node scripts/test-ollie-security.js

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvLocal();

const BASE_URL = process.env.OLLIE_TEST_BASE_URL || "http://localhost:3000";
const ENDPOINT = `${BASE_URL}/api/ai/coach`;
const DEV_TEST_USER_EMAIL = "dev-test@local.chessmind.test";
const DEV_TEST_USER_PASSWORD = "dev-test-local-only-not-secret";

let passed = 0;
let failed = 0;

function check(label, condition, detail) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${label}${detail ? ` -- ${detail}` : ""}`);
  }
}

async function post(body, cookie) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
    redirect: "manual",
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // redirects and non-JSON error pages don't parse -- that's fine, the
    // status/type itself is the signal for the auth tests below.
  }
  return { status: res.status, type: res.type, json };
}

async function getAuthenticatedCookie() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
  }
  const supabase = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await supabase.auth.signInWithPassword({
    email: DEV_TEST_USER_EMAIL,
    password: DEV_TEST_USER_PASSWORD,
  });
  if (error || !data.session) {
    throw new Error(
      `Could not sign in as the dev test user (run scripts/dev-seed-test-user.js first): ${error?.message}`
    );
  }
  // Matches the exact cookie shape @supabase/ssr's createBrowserClient sets
  // (verified by inspecting a real signed-in session's document.cookie):
  // name `sb-<project-ref>-auth-token`, value `base64-` + base64 JSON of
  // the session object as-is.
  const projectRef = new URL(url).hostname.split(".")[0];
  const cookieValue = encodeURIComponent(
    "base64-" + Buffer.from(JSON.stringify(data.session)).toString("base64")
  );
  return { cookie: `sb-${projectRef}-auth-token=${cookieValue}`, userId: data.session.user.id };
}

async function getDevTestChildId(authUserId) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: parent } = await admin.from("parents").select("id").eq("auth_user_id", authUserId).single();
  const { data: child } = await admin.from("children").select("id").eq("parent_id", parent.id).limit(1).single();
  return child.id;
}

async function main() {
  // --- Unauthenticated: no session cookie at all ---
  // middleware.ts (not this route) is the actual enforcement point here --
  // it redirects any unauthenticated request to a non-public path before
  // the route handler ever runs, so no `reply` is ever produced. The route
  // handler's own getSessionUser() check is real defense-in-depth for any
  // request that reaches it without a resolvable user, but under this
  // app's normal routing an unauthenticated POST never gets that far, so
  // we assert on the observable guarantee (never a real reply) rather than
  // a specific status code.
  {
    const { status, json } = await post({ message: "What does a rook do?" });
    check(
      "unauthenticated request never returns a reply",
      !json?.reply && status !== 200,
      `got ${status} ${JSON.stringify(json)}`
    );
  }

  const { cookie, userId } = await getAuthenticatedCookie();
  const childId = await getDevTestChildId(userId);

  // --- Authenticated, but claiming a child that isn't theirs ---
  {
    const { status, json } = await post({ message: "hi", childId: "00000000-0000-0000-0000-000000000000" }, cookie);
    check("unowned/nonexistent childId is rejected with 403", status === 403, `got ${status} ${JSON.stringify(json)}`);
  }

  // --- Authenticated, missing childId entirely ---
  {
    const { status } = await post({ message: "hi" }, cookie);
    check("missing childId is rejected with 400", status === 400, `got ${status}`);
  }

  // --- Authenticated, empty message ---
  {
    const { status } = await post({ message: "   ", childId }, cookie);
    check("empty message is rejected with 400", status === 400, `got ${status}`);
  }

  // --- Authenticated, oversized message ---
  {
    const { status } = await post({ message: "a".repeat(5000), childId }, cookie);
    check("oversized message is rejected with 400", status === 400, `got ${status}`);
  }

  // --- Authenticated, malformed history (wrong type) ---
  {
    const { status } = await post({ message: "hi", childId, history: "not an array" }, cookie);
    check("non-array history is rejected with 400", status === 400, `got ${status}`);
  }

  // --- Authenticated, malformed history (bad role) ---
  {
    const { status } = await post({ message: "hi", childId, history: [{ from: "hacker", text: "x" }] }, cookie);
    check("invalid history role is rejected with 400", status === 400, `got ${status}`);
  }

  // --- Authenticated, valid request end-to-end ---
  {
    const { status, json } = await post({ message: "What does a rook do?", childId }, cookie);
    check("valid authenticated request succeeds with 200", status === 200, `got ${status}`);
    check("valid request returns a non-empty reply", typeof json?.reply === "string" && json.reply.length > 0, JSON.stringify(json));
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Test script itself failed to run (is the dev server up, and is the dev test user seeded?)");
  console.error(err);
  process.exit(1);
});

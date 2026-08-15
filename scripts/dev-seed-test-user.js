// One-time (idempotent) LOCAL DEV setup — creates a dedicated test parent
// account + test child so local test mode (see lib/devTestMode.ts) has a
// real Supabase session to sign into automatically at app/api/dev/auto-
// signin/route.ts, without touching any of the ~40 existing pages that
// independently call supabase.auth.getUser(). Every one of those keeps
// working completely unmodified — this script just makes sure a real,
// clearly-labeled test user/child exists for that route to sign into.
//
// Run once locally:  node scripts/dev-seed-test-user.js
// Safe to re-run — finds the existing test user/child instead of
// duplicating them.
//
// Uses SUPABASE_SERVICE_ROLE_KEY (already in .env.local) via the Supabase
// Admin API. That key bypasses Row Level Security entirely — never expose
// it to the browser, never commit it, and only ever run this script
// against your own local .env.local.

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// Keep these two values in sync with lib/devTestMode.ts's
// DEV_TEST_USER_EMAIL / DEV_TEST_USER_PASSWORD — duplicated here rather
// than imported because this script runs via plain `node`, outside
// Next.js's TypeScript/webpack pipeline.
const DEV_TEST_USER_EMAIL = "dev-test@local.chessmind.test";
const DEV_TEST_USER_PASSWORD = "dev-test-local-only-not-secret";
const DEV_TEST_CHILD_NAME = "Dev Test Child";
// Real ids from content/avatars.ts / content/buddies.ts — set explicitly
// so onboarding never triggers for this account (every page redirects to
// /onboarding/avatar if either is null).
const DEV_TEST_AVATAR_ID = "knight-kid";
const DEV_TEST_BUDDY_ID = "wise-owl";

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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function main() {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local — cannot seed the dev test user."
    );
    process.exit(1);
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Idempotent: reuse the existing test user instead of erroring on re-run.
  let userId;
  const { data: existingList, error: listError } = await admin.auth.admin.listUsers();
  if (listError) throw listError;
  const existingUser = existingList.users.find((u) => u.email === DEV_TEST_USER_EMAIL);

  if (existingUser) {
    userId = existingUser.id;
    console.log(`Found existing dev test user: ${DEV_TEST_USER_EMAIL} (${userId})`);
  } else {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: DEV_TEST_USER_EMAIL,
      password: DEV_TEST_USER_PASSWORD,
      email_confirm: true,
    });
    if (createError) throw createError;
    userId = created.user.id;
    console.log(`Created dev test user: ${DEV_TEST_USER_EMAIL} (${userId})`);
  }

  // The on_auth_user_created trigger (supabase/migrations/0001_init.sql)
  // creates the matching parents row the instant the auth user exists —
  // this fires for admin-created users too, it's a plain AFTER INSERT
  // trigger on auth.users. Just read it back.
  const { data: parent, error: parentError } = await admin
    .from("parents")
    .select("id")
    .eq("auth_user_id", userId)
    .single();
  if (parentError || !parent) {
    throw (
      parentError ??
      new Error(
        "No parents row found for the dev test user — the on_auth_user_created trigger may not have fired."
      )
    );
  }

  const { data: existingChild } = await admin
    .from("children")
    .select("id")
    .eq("parent_id", parent.id)
    .limit(1)
    .maybeSingle();

  if (existingChild) {
    console.log(`Dev test child already exists (${existingChild.id}) — nothing more to do.`);
  } else {
    const { data: child, error: childError } = await admin
      .from("children")
      .insert({
        parent_id: parent.id,
        display_name: DEV_TEST_CHILD_NAME,
        avatar_id: DEV_TEST_AVATAR_ID,
        buddy_id: DEV_TEST_BUDDY_ID,
        // piece_set_id, board_skin_id, rating all use their real DB
        // defaults (supabase/migrations/0016 and 0020) rather than being
        // hardcoded here, so this stays correct if those defaults change.
      })
      .select()
      .single();
    if (childError) throw childError;
    console.log(`Created dev test child "${DEV_TEST_CHILD_NAME}" (${child.id}).`);
  }

  console.log(
    "\nDone. With NEXT_PUBLIC_LOCAL_TEST_MODE=true in .env.local and `npm run dev` running, opening the app now signs in as this test user automatically — no login screen, no Parent Gate."
  );
}

main().catch((err) => {
  console.error("Failed to seed dev test user:", err);
  process.exit(1);
});

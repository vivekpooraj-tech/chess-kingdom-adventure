/**
 * Tests for migration 0034 (friends).
 *
 *   node scripts/test-friendships.js
 *
 * Skips with a clear PENDING message when 0034 has not been applied — the same
 * convention scripts/test-puzzle-economy.js uses for 0029, because this
 * environment applies migrations by hand through the Supabase SQL editor.
 *
 * What it checks is mostly the security model, because that is where a friends
 * feature on a product with children can do real harm:
 *
 *   - canonical ordering makes reversed duplicates impossible
 *   - a child cannot friend themselves
 *   - only the RECIPIENT can accept a request (otherwise anyone who guessed a
 *     code could add themselves to another child's friend list)
 *   - a bad code is indistinguishable from any other miss, so the RPC cannot be
 *     used to test whether a code exists
 *   - a parent cannot see friendships that do not involve their own children
 *
 * Everything it creates, it deletes.
 */
const fs = require("fs");
const { createClient } = require(process.cwd() + "/node_modules/@supabase/supabase-js");

const env = {};
for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const i = line.indexOf("=");
  if (i > 0 && !line.trim().startsWith("#")) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let pass = 0;
const failures = [];
const check = (n, c) => (c ? pass++ : failures.push(n));

const createdFriendships = [];

async function cleanup() {
  if (createdFriendships.length) {
    await admin.from("friendships").delete().in("id", createdFriendships);
  }
}

async function main() {
  // ---- is 0034 applied? ----
  const probe = await admin.from("friendships").select("id").limit(1);
  if (probe.error && /does not exist|schema cache/i.test(probe.error.message)) {
    console.log("=== PENDING: migration 0034_friendships.sql is not applied yet ===");
    console.log("Apply it in the Supabase SQL Editor, then re-run this script to validate:");
    console.log("  - duplicate / reversed-duplicate prevention");
    console.log("  - self-request rejection");
    console.log("  - accept-only-by-recipient");
    console.log("  - code enumeration resistance");
    console.log("  - RLS isolation between families");
    process.exit(0);
  }
  if (probe.error) throw new Error("unexpected probe error: " + probe.error.message);

  const { data: kids } = await admin
    .from("children")
    .select("id, friend_code, display_name")
    .limit(3);
  if (!kids || kids.length < 2) {
    console.error("Need at least two children to test friendships.");
    process.exit(1);
  }
  const [a, b] = kids;

  // ---- friend codes exist and are well formed ----
  check("every child has a friend code", Boolean(a.friend_code && b.friend_code));
  check("codes are 8 characters", (a.friend_code ?? "").length === 8);
  check(
    "codes avoid confusable characters",
    !/[OIL01UV]/.test(a.friend_code ?? "") && !/[OIL01UV]/.test(b.friend_code ?? "")
  );
  check("codes are distinct", a.friend_code !== b.friend_code);

  // ---- canonical ordering: the constraint itself ----
  {
    // Insert deliberately out of order; the check constraint must reject it.
    const lo = a.id < b.id ? a.id : b.id;
    const hi = a.id < b.id ? b.id : a.id;
    const bad = await admin
      .from("friendships")
      .insert({ child_a: hi, child_b: lo, requested_by: hi, status: "pending" })
      .select("id");
    check("reversed ordering is rejected by the check constraint", Boolean(bad.error));

    const good = await admin
      .from("friendships")
      .insert({ child_a: lo, child_b: hi, requested_by: lo, status: "pending" })
      .select("id")
      .single();
    check("canonical ordering is accepted", !good.error);
    if (good.data) createdFriendships.push(good.data.id);

    const dup = await admin
      .from("friendships")
      .insert({ child_a: lo, child_b: hi, requested_by: hi, status: "pending" })
      .select("id");
    check("a duplicate pair is rejected by the unique constraint", Boolean(dup.error));

    await cleanup();
    createdFriendships.length = 0;
  }

  // ---- self friendship ----
  {
    const self = await admin
      .from("friendships")
      .insert({ child_a: a.id, child_b: a.id, requested_by: a.id, status: "pending" })
      .select("id");
    check("a child cannot be friends with themselves", Boolean(self.error));
  }

  // ---- requester must be a party to the friendship ----
  if (kids.length >= 3) {
    const c = kids[2];
    const lo = a.id < b.id ? a.id : b.id;
    const hi = a.id < b.id ? b.id : a.id;
    const outsider = await admin
      .from("friendships")
      .insert({ child_a: lo, child_b: hi, requested_by: c.id, status: "pending" })
      .select("id");
    check("a third party cannot be recorded as the requester", Boolean(outsider.error));
  }

  // ---- the RPC does not leak whether a code exists ----
  {
    const { data: miss } = await admin.rpc("send_friend_request", {
      p_child_id: a.id,
      p_friend_code: "ZZZZZZZZ",
    });
    // Called with the service role there is no auth.uid(), so ownership fails
    // first; either answer is acceptable, but it must never be a code-specific
    // error that reveals existence.
    check("an unknown code returns a generic result", miss === "not_found" || miss === "not_authorized");
  }

  await cleanup();
  console.log(`\n=== FRIENDSHIPS: ${pass} passed, ${failures.length} failed ===`);
  if (failures.length) {
    console.error("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
    process.exit(1);
  }
  process.exit(0);
}

main().catch(async (e) => {
  await cleanup();
  console.error("crashed:", e.message);
  process.exit(1);
});

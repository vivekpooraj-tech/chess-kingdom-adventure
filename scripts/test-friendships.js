/**
 * Tests for migration 0034 (friends) and 0042 (friend-code privileges).
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
 *   - anonymous callers can do none of it
 *
 * TWO CLIENTS, DELIBERATELY.
 *
 * The constraint tests use the service role, because they are about what the
 * TABLE refuses regardless of who asks. The lifecycle tests must use a signed-in
 * client, because send_friend_request and respond_to_friend_request both gate on
 * auth.uid() owning the acting child — with the service role they return
 * 'not_authorized' before doing anything, which is why the RPC flow was never
 * covered before.
 *
 * FIXTURES, NOT REAL CHILDREN.
 *
 * An earlier version of this file inserted friendships between whichever real
 * children it found. It cleaned up, but a crash between insert and delete would
 * have left two real accounts befriended. It now creates its own children under
 * the dev test parent and deletes them by explicit id in `finally`, and asserts
 * the row counts return to baseline.
 */
const fs = require("fs");
const { createClient } = require(process.cwd() + "/node_modules/@supabase/supabase-js");

const env = {};
for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const i = line.indexOf("=");
  if (i > 0 && !line.trim().startsWith("#")) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const user = createClient(URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

let pass = 0;
const failures = [];
const check = (n, c, d) => (c ? pass++ : failures.push(d ? `${n} — ${d}` : n));

const createdFriendships = [];
const createdChildren = [];

/** Guaranteed teardown, by explicit id. Friendships first (they reference
 *  children), then the children this run made. Never by name prefix, and never
 *  a WHERE that could widen to a real row. */
async function cleanup() {
  if (createdFriendships.length) {
    await admin.from("friendships").delete().in("id", createdFriendships);
    createdFriendships.length = 0;
  }
  if (createdChildren.length) {
    await admin.from("friendships").delete().or(
      createdChildren.map((id) => `child_a.eq.${id},child_b.eq.${id}`).join(",")
    );
    await admin.from("children").delete().in("id", createdChildren);
    createdChildren.length = 0;
  }
}

const countOf = async (table) => {
  const { count } = await admin.from(table).select("id", { count: "exact", head: true });
  return count;
};

/** Create a fixture child through the SIGNED-IN client, so the BEFORE INSERT
 *  trigger runs exactly as it does for a parent using the dashboard. That is
 *  also what proves 0042 did not break friend-code generation. */
async function makeChild(parentId, name) {
  const { data, error } = await user
    .from("children")
    .insert({ parent_id: parentId, display_name: name })
    .select()
    .single();
  if (error) throw new Error(`fixture child "${name}" failed: ${error.message}`);
  createdChildren.push(data.id);
  return data;
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
    console.log("  - the full send/accept/decline/remove lifecycle");
    process.exitCode = 0;
    return;
  }
  if (probe.error) throw new Error("unexpected probe error: " + probe.error.message);

  const baseline = {
    friendships: await countOf("friendships"),
    children: await countOf("children"),
    parents: await countOf("parents"),
  };
  console.log(
    `baseline: friendships=${baseline.friendships} children=${baseline.children} parents=${baseline.parents}\n`
  );

  // ---- sign in as the dev test parent -------------------------------------
  const { data: auth, error: authError } = await user.auth.signInWithPassword({
    email: "dev-test@local.chessmind.test",
    password: "dev-test-local-only-not-secret",
  });
  if (authError) throw new Error("sign-in failed: " + authError.message);
  const { data: parent } = await user.from("parents").select("id").limit(1).single();
  if (!parent) throw new Error("the dev test account has no parent row");
  check("signed in as the dev test parent", Boolean(auth?.user));

  // ---- fixtures ------------------------------------------------------------
  const a = await makeChild(parent.id, "FR_FIXTURE_A");
  const b = await makeChild(parent.id, "FR_FIXTURE_B");
  const c = await makeChild(parent.id, "FR_FIXTURE_C");
  console.log("fixtures: 3 children\n");

  // ---- friend codes exist and are well formed ------------------------------
  // Also the functional proof for 0042: these codes came from the trigger.
  check("every child has a friend code", Boolean(a.friend_code && b.friend_code));
  check("codes are 8 characters", (a.friend_code ?? "").length === 8, String(a.friend_code));
  check(
    "codes avoid confusable characters",
    !/[OIL01UV]/.test(a.friend_code ?? "") && !/[OIL01UV]/.test(b.friend_code ?? "")
  );
  check("codes are distinct", a.friend_code !== b.friend_code);

  // ---- 0042: generate_friend_code is not client-callable --------------------
  // Before 0042 both of these return a code, because 0034 revoked EXECUTE from
  // `authenticated` but left the default PUBLIC grant in place. Reported rather
  // than failed while 0042 is unapplied, so this suite stays green on a
  // database that only has 0034 — the state it was written for.
  {
    const viaAnon = await anon.rpc("generate_friend_code");
    const viaUser = await user.rpc("generate_friend_code");
    const secured = Boolean(viaAnon.error) && Boolean(viaUser.error);
    if (secured) {
      check("0042: anon cannot execute generate_friend_code", Boolean(viaAnon.error));
      check("0042: authenticated cannot execute generate_friend_code", Boolean(viaUser.error));
    } else {
      console.log("  NOTE: 0042_secure_generate_friend_code.sql is not applied yet —");
      console.log("        generate_friend_code() is still reachable by",
        [!viaAnon.error && "anon", !viaUser.error && "authenticated"].filter(Boolean).join(" and "));
      console.log("        (child creation above still works, which is the point of 0042's design)\n");
    }
  }

  // ---- canonical ordering: the constraint itself ---------------------------
  {
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
    check("canonical ordering is accepted", !good.error, good.error?.message);
    if (good.data) createdFriendships.push(good.data.id);

    const dup = await admin
      .from("friendships")
      .insert({ child_a: lo, child_b: hi, requested_by: hi, status: "pending" })
      .select("id");
    check("a duplicate pair is rejected by the unique constraint", Boolean(dup.error));

    await admin.from("friendships").delete().in("id", createdFriendships);
    createdFriendships.length = 0;
  }

  // ---- self friendship ------------------------------------------------------
  {
    const self = await admin
      .from("friendships")
      .insert({ child_a: a.id, child_b: a.id, requested_by: a.id, status: "pending" })
      .select("id");
    check("a child cannot be friends with themselves", Boolean(self.error));
  }

  // ---- requester must be a party to the friendship --------------------------
  {
    const lo = a.id < b.id ? a.id : b.id;
    const hi = a.id < b.id ? b.id : a.id;
    const outsider = await admin
      .from("friendships")
      .insert({ child_a: lo, child_b: hi, requested_by: c.id, status: "pending" })
      .select("id");
    check("a third party cannot be recorded as the requester", Boolean(outsider.error));
  }

  // ---- the RPC does not leak whether a code exists --------------------------
  {
    const { data: miss } = await user.rpc("send_friend_request", {
      p_child_id: a.id,
      p_friend_code: "ZZZZZZZZ",
    });
    check("an unknown code returns a generic 'not_found'", miss === "not_found", String(miss));

    const { data: selfCode } = await user.rpc("send_friend_request", {
      p_child_id: a.id,
      p_friend_code: a.friend_code,
    });
    check("sending a request to your own code returns 'self'", selfCode === "self", String(selfCode));
  }

  // =========================================================================
  // LIFECYCLE — the part the service role could never reach
  // =========================================================================
  console.log("lifecycle (authenticated)");

  // 1-4. send, pending, visible to both sides with correct direction
  {
    const { data: sent, error } = await user.rpc("send_friend_request", {
      p_child_id: a.id,
      p_friend_code: b.friend_code,
    });
    check("A sends a request to B's code", !error && sent === "pending", `${sent} ${error?.message ?? ""}`);

    const { data: rows } = await admin
      .from("friendships")
      .select("id, child_a, child_b, requested_by, status")
      .or(`child_a.eq.${a.id},child_b.eq.${a.id}`);
    const row = rows?.[0];
    if (row) createdFriendships.push(row.id);

    check("a pending row exists", row?.status === "pending", JSON.stringify(row));
    check("the row is stored in canonical order", row && row.child_a < row.child_b);
    check("the requester is recorded as A", row?.requested_by === a.id);
    check("the pair is exactly A and B",
      row && [row.child_a, row.child_b].sort().join() === [a.id, b.id].sort().join());

    // 15. the requester may not accept their own request
    const { data: selfAccept } = await user.rpc("respond_to_friend_request", {
      p_child_id: a.id, p_friendship_id: row.id, p_action: "accept",
    });
    check("the requester CANNOT accept their own request",
      selfAccept === "not_authorized", String(selfAccept));

    // 14/16. a non-participant may not respond
    const { data: outsiderAccept } = await user.rpc("respond_to_friend_request", {
      p_child_id: c.id, p_friendship_id: row.id, p_action: "accept",
    });
    check("a non-participant CANNOT accept the request",
      outsiderAccept === "not_authorized", String(outsiderAccept));

    // 13. anon may not respond
    const { data: anonAccept, error: anonErr } = await anon.rpc("respond_to_friend_request", {
      p_child_id: b.id, p_friendship_id: row.id, p_action: "accept",
    });
    check("an anonymous caller CANNOT accept the request",
      anonAccept === "not_authorized" || Boolean(anonErr), String(anonAccept));

    // still pending after all three refusals
    const { data: afterRefusals } = await admin
      .from("friendships").select("status").eq("id", row.id).single();
    check("the request is still pending after every refused attempt",
      afterRefusals?.status === "pending", afterRefusals?.status);

    // 5. the recipient accepts
    const { data: accepted } = await user.rpc("respond_to_friend_request", {
      p_child_id: b.id, p_friendship_id: row.id, p_action: "accept",
    });
    check("the RECIPIENT can accept", accepted === "accepted", String(accepted));

    // 6/7. both sides see it, in both directions
    const { data: nowRow } = await admin
      .from("friendships").select("status, responded_at").eq("id", row.id).single();
    check("the friendship is accepted in the database", nowRow?.status === "accepted");
    check("responded_at is stamped", Boolean(nowRow?.responded_at));

    for (const [label, id] of [["A", a.id], ["B", b.id]]) {
      const { data: seen } = await admin
        .from("friendships")
        .select("id")
        .or(`child_a.eq.${id},child_b.eq.${id}`)
        .eq("status", "accepted");
      check(`${label} sees the accepted friendship`, (seen ?? []).length === 1);
    }

    // 6b. re-sending once accepted reports already_friends
    const { data: again } = await user.rpc("send_friend_request", {
      p_child_id: a.id, p_friend_code: b.friend_code,
    });
    check("re-sending to an existing friend returns 'already_friends'",
      again === "already_friends", String(again));

    // 10/11. removal, by either side
    const { data: removed } = await user.rpc("respond_to_friend_request", {
      p_child_id: b.id, p_friendship_id: row.id, p_action: "remove",
    });
    check("either participant can remove the friendship", removed === "removed", String(removed));
    const { data: gone } = await admin.from("friendships").select("id").eq("id", row.id);
    check("the friendship row is gone after removal", (gone ?? []).length === 0);
    createdFriendships.length = 0;
  }

  // 8/9. a declined request does not become a friendship, and can be re-sent
  {
    const { data: sent } = await user.rpc("send_friend_request", {
      p_child_id: a.id, p_friend_code: c.friend_code,
    });
    check("A sends a second request, to C", sent === "pending", String(sent));

    const { data: rows } = await admin
      .from("friendships").select("id, status")
      .or(`child_a.eq.${c.id},child_b.eq.${c.id}`);
    const row = rows?.[0];
    if (row) createdFriendships.push(row.id);

    const { data: declined } = await user.rpc("respond_to_friend_request", {
      p_child_id: c.id, p_friendship_id: row.id, p_action: "decline",
    });
    check("the recipient can decline", declined === "declined", String(declined));

    const { data: afterDecline } = await admin
      .from("friendships").select("status").eq("id", row.id).single();
    check("a declined request is NOT an accepted friendship",
      afterDecline?.status === "declined", afterDecline?.status);

    // A declined request may be sent again — the row is reused, not duplicated.
    const { data: resent } = await user.rpc("send_friend_request", {
      p_child_id: a.id, p_friend_code: c.friend_code,
    });
    check("a declined request can be sent again", resent === "pending", String(resent));
    const { data: stillOne } = await admin
      .from("friendships").select("id")
      .or(`child_a.eq.${c.id},child_b.eq.${c.id}`);
    check("re-sending reuses the row rather than duplicating it",
      (stillOne ?? []).length === 1, String((stillOne ?? []).length));
  }

  // 12. an anonymous caller cannot create a friendship at all
  {
    const { data: anonSend, error: anonErr } = await anon.rpc("send_friend_request", {
      p_child_id: a.id, p_friend_code: b.friend_code,
    });
    check("an anonymous caller CANNOT send a friend request",
      anonSend === "not_authorized" || Boolean(anonErr), String(anonSend));

    const lo = a.id < b.id ? a.id : b.id;
    const hi = a.id < b.id ? b.id : a.id;
    const direct = await anon
      .from("friendships")
      .insert({ child_a: lo, child_b: hi, requested_by: lo, status: "accepted" })
      .select("id");
    check("an anonymous caller CANNOT insert a friendship directly", Boolean(direct.error));
  }

  // A signed-in client may not write the table directly either — 0034 revokes
  // insert/update/delete so every state change goes through the RPCs.
  {
    const lo = a.id < b.id ? a.id : b.id;
    const hi = a.id < b.id ? b.id : a.id;
    const direct = await user
      .from("friendships")
      .insert({ child_a: lo, child_b: hi, requested_by: lo, status: "accepted" })
      .select("id");
    check("an authenticated client CANNOT insert a friendship directly", Boolean(direct.error));
  }

  // A child's friend_code must not be writable, or a code could be squatted.
  {
    const { error } = await user
      .from("children")
      .update({ friend_code: "HACKED12" })
      .eq("id", a.id);
    const { data: after } = await admin
      .from("children").select("friend_code").eq("id", a.id).single();
    check("a client cannot overwrite a friend_code",
      Boolean(error) || after?.friend_code !== "HACKED12", after?.friend_code);
  }

  await cleanup();

  const final = {
    friendships: await countOf("friendships"),
    children: await countOf("children"),
    parents: await countOf("parents"),
  };
  check("every table is back to its baseline row count",
    final.friendships === baseline.friendships &&
      final.children === baseline.children &&
      final.parents === baseline.parents,
    `friendships ${baseline.friendships}->${final.friendships}, children ${baseline.children}->${final.children}`);

  console.log(`\n=== FRIENDSHIPS: ${pass} passed, ${failures.length} failed ===`);
  if (failures.length) {
    console.error("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
    process.exitCode = 1;
    return;
  }
  process.exitCode = 0;
}

main().catch(async (e) => {
  // exitCode, not exit(): process.exit() would abandon the cleanup below.
  await cleanup();
  console.error("crashed:", e.message);
  process.exitCode = 1;
});

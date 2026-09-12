/**
 * Is migration 0043 (Chess School V2) live, and does it behave?
 *
 *   node scripts/verify-chess-school-migration.js          # read-only probes
 *   node scripts/verify-chess-school-migration.js --write  # + a real round trip
 *
 * WHY THIS EXISTS. supabase/migrations is a backlog, not a description of the
 * live database, and `supabase db push` must never be run here (the remote
 * history is empty; it would replay everything from 0001). Production SQL is
 * applied by hand in the Supabase SQL Editor. So the only honest way to know
 * whether Chess School progress is durable in the cloud is to ask the
 * database — which is what this does, using the same probe technique as the
 * rest of the repo: a select that a migration adds, an RPC called with a nil
 * uuid. PGRST205 / PGRST202 mean "not applied (or schema cache stale)"; a
 * Postgres error code means the object exists and rejected the input.
 *
 * Read-only by default. `--write` upserts a progress row for the dev test
 * child through the service role, reads it back, then deletes it — and it
 * also proves the two CHECK constraints reject what they should.
 */
const fs = require("fs");
const path = require("path");

const env = Object.fromEntries(
  fs
    .readFileSync(path.join(process.cwd(), ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    })
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing from .env.local");
  process.exit(2);
}
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const WRITE = process.argv.includes("--write");

let pass = 0;
const failures = [];
const check = (name, ok, detail) => {
  if (ok) pass++;
  else failures.push(name + (detail ? ` — ${detail}` : ""));
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${detail && !ok ? `  (${detail})` : ""}`);
};

async function rest(pathname, init) {
  const r = await fetch(`${URL_}/rest/v1/${pathname}`, { ...init, headers: { ...H, ...(init?.headers || {}) } });
  const text = await r.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: r.status, body };
}
const rpc = (name, args) => rest(`rpc/${name}`, { method: "POST", body: JSON.stringify(args) });
const NIL = "00000000-0000-0000-0000-000000000000";

(async () => {
  console.log("Probing", URL_, "\n");

  // --- Existence ------------------------------------------------------------
  const t1 = await rest("child_school_progress?select=id&limit=0");
  const t2 = await rest("school_entitlements?select=id&limit=0");
  const applied = t1.status === 200 && t2.status === 200;
  check("child_school_progress table exists", t1.status === 200, t1.body?.code || t1.status);
  check("school_entitlements table exists", t2.status === 200, t2.body?.code || t2.status);

  if (!applied) {
    console.log(`
=== MIGRATION 0043: NOT APPLIED (${t1.body?.code || t1.status} / ${t2.body?.code || t2.status}) ===

The app keeps working: progress falls back to the device (lib/school/v2/storage.ts)
and every screen says so. To apply:

  1. Open the Supabase dashboard -> SQL Editor.
  2. Paste the whole of supabase/migrations/0043_chess_school_v2.sql and run it.
  3. Re-run: node scripts/verify-chess-school-migration.js --write
`);
    process.exit(1);
  }

  // --- Columns the app relies on ------------------------------------------
  const c1 = await rest("child_school_progress?select=completed_sessions,skill_tags,unlocks,graduated_at,updated_at&limit=0");
  check("progress columns present", c1.status === 200, c1.body?.message);
  const c2 = await rest("school_entitlements?select=expires_at,revoked_at,checkout_session_id,payment_intent_id&limit=0");
  check("entitlement columns present", c2.status === 200, c2.body?.message);

  // --- Functions -----------------------------------------------------------
  const f1 = await rpc("parent_has_school_access", { p_parent_id: NIL });
  check("parent_has_school_access() exists and answers false for a nil parent", f1.status === 200 && f1.body === false, JSON.stringify(f1.body));
  const f2 = await rpc("grant_school_entitlement", { p_parent_id: NIL, p_checkout_session_id: "probe" });
  // A nil parent violates the FK — that is Postgres 23503 — proving the
  // function exists. PGRST202 would mean it does not.
  check("grant_school_entitlement() exists (FK rejects nil parent)", f2.status !== 404 && f2.body?.code !== "PGRST202", JSON.stringify(f2.body).slice(0, 120));
  const f4 = await rpc("merge_school_progress", { p_child_id: NIL, p_completed_sessions: [1], p_skill_tags: [], p_unlocks: [] });
  check("merge_school_progress() exists (FK rejects nil child)", f4.status !== 404 && f4.body?.code !== "PGRST202", JSON.stringify(f4.body).slice(0, 120));
  const f3 = await rpc("revoke_school_entitlement", { p_payment_intent_id: "pi_probe_does_not_exist" });
  check("revoke_school_entitlement() exists and is a no-op for an unknown intent", f3.status === 200 && f3.body === false, JSON.stringify(f3.body));

  // --- RLS is on (anon gets nothing) ------------------------------------------
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (anonKey) {
    const a = await fetch(`${URL_}/rest/v1/child_school_progress?select=id&limit=1`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    });
    const rows = await a.json().catch(() => null);
    check("anon reads zero progress rows (RLS)", a.status === 200 && Array.isArray(rows) && rows.length === 0, `status ${a.status}`);
    const g = await fetch(`${URL_}/rest/v1/rpc/grant_school_entitlement`, {
      method: "POST",
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_parent_id: NIL, p_checkout_session_id: "anon-probe" }),
    });
    check("anon cannot call grant_school_entitlement()", g.status === 401 || g.status === 403 || g.status === 404, `status ${g.status}`);
  }

  // --- Optional round trip --------------------------------------------------
  if (WRITE) {
    const kids = await rest("children?select=id,display_name&limit=1");
    const child = Array.isArray(kids.body) ? kids.body[0] : null;
    if (!child) {
      check("a child exists to round-trip with", false, "no children rows");
    } else {
      console.log(`\n  round trip with child ${child.id} (${child.display_name})`);
      const up = await rest("child_school_progress?on_conflict=child_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({ child_id: child.id, completed_sessions: [1, 2], skill_tags: ["board_setup"], unlocks: [] }),
      });
      check("upsert progress row", up.status === 201 || up.status === 200, JSON.stringify(up.body).slice(0, 120));
      const back = await rest(`child_school_progress?select=completed_sessions,skill_tags&child_id=eq.${child.id}`);
      check("read it back", Array.isArray(back.body) && back.body[0]?.completed_sessions?.join() === "1,2", JSON.stringify(back.body).slice(0, 120));
      const bad1 = await rest("child_school_progress?on_conflict=child_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({ child_id: child.id, completed_sessions: [1, 99] }),
      });
      check("CHECK rejects a session number outside 1..30", bad1.status === 400 && bad1.body?.code === "23514", JSON.stringify(bad1.body).slice(0, 100));
      const bad2 = await rest("child_school_progress?on_conflict=child_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({ child_id: child.id, completed_sessions: [1, 2], graduated_at: new Date().toISOString() }),
      });
      check("CHECK rejects graduated_at without session 30", bad2.status === 400 && bad2.body?.code === "23514", JSON.stringify(bad2.body).slice(0, 100));
      // Server-side union: a save that "forgets" session 2 must not remove it.
      const m1 = await rpc("merge_school_progress", { p_child_id: child.id, p_completed_sessions: [1, 3], p_skill_tags: ["fork"], p_unlocks: ["fork_master"] });
      check("merge_school_progress() exists and returns the row", m1.status === 200 && m1.body?.child_id === child.id, JSON.stringify(m1.body).slice(0, 120));
      check("merge is a UNION, not a replace (1,2 + 1,3 = 1,2,3)", Array.isArray(m1.body?.completed_sessions) && m1.body.completed_sessions.join() === "1,2,3", JSON.stringify(m1.body?.completed_sessions));
      check("merge keeps skills and unlocks from both sides", m1.body?.skill_tags?.includes("board_setup") && m1.body?.skill_tags?.includes("fork") && m1.body?.unlocks?.includes("fork_master"));
      const del = await rest(`child_school_progress?child_id=eq.${child.id}`, { method: "DELETE" });
      check("cleanup: row deleted", del.status === 204 || del.status === 200, `status ${del.status}`);
    }
  } else {
    console.log("\n  (skipped write round trip — pass --write to run it)");
  }

  console.log(`\n=== MIGRATION 0043 VERIFY: ${pass} passed, ${failures.length} failed ===`);
  if (failures.length) {
    console.error("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
    process.exitCode = 1;
  }
})();

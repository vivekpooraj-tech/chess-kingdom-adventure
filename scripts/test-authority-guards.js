/**
 * The authorization boundary for server-authoritative play.
 *
 *   node scripts/test-authority-guards.js
 *
 * Static analysis of the migrations and the routes. No database, no network,
 * nothing to leak — it reads the SQL that WILL be applied and asserts the
 * invariants that make it safe, so a regression is caught before it reaches
 * production rather than after.
 *
 * The specific mistakes this exists to prevent, both found in the audit of
 * 0036-0038:
 *
 *   1. Treating "auth.uid() is null" as "this is the trusted server". The anon
 *      key's JWT has no `sub` claim, so anonymous callers also have a null
 *      auth.uid(). The rule reads "anyone the database cannot identify is
 *      trusted".
 *
 *   2. Revoking the browser's grant while leaving an auth.uid()-based ownership
 *      check in place, which the service role cannot satisfy either — locking
 *      out every caller and hanging every game in `active`.
 */
const fs = require("fs");
const path = require("path");

const MIG = path.join(process.cwd(), "supabase", "migrations");
const read = (f) => fs.readFileSync(path.join(MIG, f), "utf8");

let pass = 0;
const failures = [];
const check = (name, cond, detail) => (cond ? pass++ : failures.push(detail ? `${name} — ${detail}` : name));

const g39 = read("0039_fix_authority_guard.sql");
const sql39 = g39.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");

// ---- the trusted-caller heuristic must be gone -----------------------------
{
  // Strip comments first: 0039 discusses the anti-pattern at length, and the
  // prose must not be mistaken for the code.
  check(
    "0039 contains no `auth.uid() is not null` trusted-caller heuristic",
    !/auth\.uid\(\)\s+is\s+not\s+null/i.test(sql39),
    "the anon role also has a null auth.uid()"
  );

  check(
    "0039 restores an UNCONDITIONAL ownership check on submit_online_move",
    /if\s+not\s+v_owns\s+then\s*\r?\n\s*raise\s+exception/i.test(sql39),
    "an ownership check gated on identity being present is not a check"
  );
}

// ---- server entry points are gated by GRANT, not by claims -----------------
const SERVER_FNS = [
  ["submit_online_move_as_server", "uuid, uuid, text, text"],
  ["finish_online_game_by_result_as_server", "uuid, uuid, text"],
];

for (const [fn, args] of SERVER_FNS) {
  check(`${fn} is defined`, new RegExp(`create or replace function public\\.${fn}\\b`, "i").test(sql39));

  for (const role of ["public", "anon", "authenticated"]) {
    const re = new RegExp(`revoke execute on function public\\.${fn}\\(${args}\\) from ${role}\\s*;`, "i");
    check(`${fn} is revoked from ${role}`, re.test(sql39));
  }

  const grant = new RegExp(`grant\\s+execute on function public\\.${fn}\\(${args}\\) to service_role\\s*;`, "i");
  check(`${fn} is granted to service_role only`, grant.test(sql39));

  // A server entry point must NOT be granted to a browser role anywhere.
  for (const role of ["anon", "authenticated"]) {
    const bad = new RegExp(`grant\\s+execute on function public\\.${fn}[^;]*to ${role}\\s*;`, "i");
    check(`${fn} is never granted to ${role}`, !bad.test(sql39));
  }
}

// ---- browser-facing originals stay revoked ---------------------------------
const CLIENT_FNS = [
  ["submit_online_move", "uuid, uuid, text, text"],
  ["finish_online_game_by_result", "uuid, uuid, text"],
];

for (const [fn, args] of CLIENT_FNS) {
  for (const role of ["public", "anon", "authenticated"]) {
    const re = new RegExp(`revoke execute on function public\\.${fn}\\(${args}\\) from ${role}\\s*;`, "i");
    check(`${fn} is revoked from ${role} in 0039`, re.test(sql39));
  }
}

// ---- 0039 must not be self-defeating ---------------------------------------
{
  // A server function whose body still consults auth.uid() would fail for the
  // service role exactly the way 0036 does.
  const serverBodies = sql39.split(/create or replace function public\./i).filter((b) => b.startsWith("submit_online_move_as_server") || b.startsWith("finish_online_game_by_result_as_server"));
  check("both server entry points were located for body inspection", serverBodies.length === 2, `found ${serverBodies.length}`);
  for (const body of serverBodies) {
    const fn = body.slice(0, body.indexOf("("));
    const decl = body.split("$$")[1] ?? "";
    check(`${fn} does not consult auth.uid()`, !/auth\.uid\(\)/i.test(decl),
      "the service role has no auth.uid(); this would reject the only legitimate caller");
  }
}

// ---- the routes must call the server entry points --------------------------
{
  const routes = [
    ["app/api/online/[gameId]/move/route.ts", ["submit_online_move_as_server", "finish_online_game_by_result_as_server"]],
    ["app/api/online/[gameId]/complete/route.ts", ["finish_online_game_by_result_as_server"]],
  ];
  for (const [file, fns] of routes) {
    const src = fs.readFileSync(path.join(process.cwd(), file), "utf8");
    for (const fn of fns) {
      check(`${file} calls ${fn}`, src.includes(`rpc("${fn}"`));
    }
    // The un-suffixed names would hit a function the route has no grant for
    // (and, for moves, one that now raises unconditionally).
    check(`${file} no longer calls the browser-facing submit_online_move`,
      !/rpc\("submit_online_move"/.test(src));
    check(`${file} no longer calls the browser-facing finish_online_game_by_result`,
      !/rpc\("finish_online_game_by_result"/.test(src));
  }
}

// ---- no client code may call the authority RPCs directly -------------------
{
  const q = fs.readFileSync(path.join(process.cwd(), "lib", "supabase", "queries.ts"), "utf8");
  // These wrappers are dead; what matters is that nothing IMPORTS them.
  const callers = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== "node_modules" && e.name !== ".next") walk(p); continue; }
      if (!/\.tsx?$/.test(e.name)) continue;
      if (p.endsWith(path.join("lib", "supabase", "queries.ts"))) continue;
      const src = fs.readFileSync(p, "utf8");
      if (/\bsubmitOnlineMove\b|\bfinishOnlineGame\b/.test(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, ""))) {
        callers.push(path.relative(process.cwd(), p));
      }
    }
  };
  for (const d of ["app", "components", "lib"]) walk(path.join(process.cwd(), d));
  check("no module calls the deprecated client move/finish wrappers", callers.length === 0, callers.join(", "));
  check("the deprecated wrappers are documented as such",
    /@deprecated/.test(q.slice(0, q.indexOf("export async function submitOnlineMove"))) ||
    q.includes("@deprecated"));
}

// ---- 0036/0037 must never be applied without 0039 --------------------------
{
  const g36 = read("0036_verify_self_declared_results.sql");
  const g37 = read("0037_server_authoritative_completion.sql");
  const body36 = g36.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  const body37 = g37.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");

  // This is the trap, asserted so it cannot be forgotten: 0036 keeps an
  // auth.uid() ownership check, 0037 revokes the browser. Together, with no
  // 0039, nothing can finish a game.
  const has36Check = /if\s+not\s+v_owns\s+then/i.test(body36);
  const has37Revoke = /revoke execute on function public\.finish_online_game_by_result/i.test(body37);
  check("0036 still carries the auth.uid() ownership check (documents the hazard)", has36Check);
  check("0037 still revokes the browser grant (documents the hazard)", has37Revoke);
  check(
    "0039 supplies the service-role path 0036+0037 would otherwise remove",
    has36Check && has37Revoke &&
      /create or replace function public\.finish_online_game_by_result_as_server/i.test(sql39),
    "applying 0036+0037 without 0039 leaves no caller able to finish a game"
  );
}

console.log(`\n=== AUTHORITY GUARDS: ${pass} passed, ${failures.length} failed ===`);
if (failures.length) {
  console.error("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
  process.exitCode = 1;
}

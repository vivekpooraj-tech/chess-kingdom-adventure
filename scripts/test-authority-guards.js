/**
 * The authorization boundary for server-authoritative play and settlement.
 *
 *   node scripts/test-authority-guards.js
 *
 * Static analysis of the migrations and the routes. No database, no network,
 * nothing to leak — it reads the SQL that WILL be applied and asserts the
 * invariants that make it safe, so a regression is caught before production
 * rather than after.
 *
 * The mistakes this exists to prevent, all three found in real audits here:
 *
 *   1. Treating "auth.uid() is null" as "this is the trusted server". The anon
 *      key's JWT has no `sub` claim, so anonymous callers also have a null
 *      auth.uid(). The rule reads "anyone the database cannot identify is
 *      trusted".
 *
 *   2. Revoking the browser's grant while leaving an auth.uid()-based ownership
 *      check in place, which the service role cannot satisfy either — locking
 *      out every caller and hanging every game in `active`.
 *
 *   3. A null clock reaching the settlement arithmetic. Under three-valued
 *      logic `null > 0` and `null <= 0` are both false, so neither branch
 *      guards the other and the row is finished with a default winner.
 *
 * WHY THERE IS ALMOST NO REGEX HERE
 *
 * An earlier version of this file built patterns with `new RegExp(`…`)`. Inside
 * a template literal `\s` becomes `s` and `\(` becomes a capture group, so
 * `grant\s+execute …\(uuid\)` silently became `grants+execute …(uuid)` — a
 * pattern that can never match. As a NEGATED assertion it then passed
 * vacuously, and a heredoc separately turned `\b` into a real 0x08 byte.
 *
 * So grants and revokes are PARSED into a structure and compared exactly,
 * rather than pattern-matched. Regex is used only for genuinely
 * whitespace-tolerant checks, always as a literal, never built from a template
 * literal. `assertNoTemplateRegex` below enforces that for this file itself.
 */
const fs = require("fs");
const path = require("path");

const MIG = path.join(process.cwd(), "supabase", "migrations");
const read = (f) => fs.readFileSync(path.join(MIG, f), "utf8");
const readRepo = (...p) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");

/** Migration prose discusses every anti-pattern at length; only executable SQL
 *  may be matched, or a comment would satisfy an assertion. */
const stripComments = (sql) =>
  sql.split(/\r?\n/).filter((l) => !l.trim().startsWith("--")).join("\n");

/** Strip JS/TS comments. These files DOCUMENT the forbidden patterns at
 *  length ("the secret is never NEXT_PUBLIC_"), and prose must never satisfy
 *  — or violate — an assertion about the code. */
const stripJs = (src) => src.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");

let pass = 0;
const failures = [];
const check = (name, cond, detail) =>
  cond ? pass++ : failures.push(detail ? `${name} — ${detail}` : name);

/** Exact substring. No escaping, no pattern semantics, nothing to corrupt. */
const has = (hay, needle) => hay.includes(needle);

/**
 * Parse every EXECUTE grant/revoke out of a migration, exactly.
 *
 * Returns a map keyed by `name(args)` — the identity signature — with the set
 * of roles granted and revoked. Comparing sets is stronger than matching
 * patterns: it catches a grant to an unexpected role, which a per-role regex
 * would only catch if someone remembered to write that role's assertion.
 */
function parseExecutePrivileges(sql) {
  const out = new Map();
  for (const raw of sql.split(/\r?\n/)) {
    const line = raw.trim().replace(/\s+/g, " ").toLowerCase();
    if (!line.endsWith(";")) continue;
    const body = line.slice(0, -1);

    let verb = null;
    let rest = null;
    if (body.startsWith("grant execute on function ")) {
      verb = "granted";
      rest = body.slice("grant execute on function ".length);
    } else if (body.startsWith("revoke execute on function ")) {
      verb = "revoked";
      rest = body.slice("revoke execute on function ".length);
    } else continue;

    const sep = verb === "granted" ? " to " : " from ";
    const at = rest.lastIndexOf(sep);
    if (at === -1) continue;
    const signature = rest.slice(0, at).trim();
    const role = rest.slice(at + sep.length).trim();

    if (!out.has(signature)) out.set(signature, { granted: new Set(), revoked: new Set() });
    out.get(signature)[verb].add(role);
  }
  return out;
}

const setOf = (s) => [...s].sort().join(",");

/**
 * A server-only entry point: revoked from every browser-reachable role, and
 * granted to service_role and nothing else.
 */
function checkServerOnly(privs, signature) {
  const p = privs.get(signature);
  check(`${signature}: privileges are declared`, !!p, "no grant/revoke statements found");
  if (!p) return;
  for (const role of ["public", "anon", "authenticated"]) {
    check(`${signature}: revoked from ${role}`, p.revoked.has(role));
  }
  check(`${signature}: granted to service_role`, p.granted.has("service_role"));
  // The strong form: service_role is the ONLY grantee.
  check(`${signature}: service_role is the only grantee`,
    setOf(p.granted) === "service_role", `granted to {${setOf(p.granted)}}`);
}

/** A browser-facing function that must hold no client grant. */
function checkFullyRevoked(privs, signature) {
  const p = privs.get(signature);
  check(`${signature}: privileges are declared`, !!p);
  if (!p) return;
  for (const role of ["public", "anon", "authenticated"]) {
    check(`${signature}: revoked from ${role}`, p.revoked.has(role));
  }
  check(`${signature}: granted to nobody`, p.granted.size === 0, `granted to {${setOf(p.granted)}}`);
}

// ===========================================================================
// 0039 — trusted callers are authorized by GRANT, not by a missing auth.uid()
// ===========================================================================
const sql39 = stripComments(read("0039_fix_authority_guard.sql"));
const privs39 = parseExecutePrivileges(sql39);

check("0039 contains no `auth.uid() is not null` trusted-caller heuristic",
  !has(sql39, "auth.uid() is not null"),
  "the anon role also has a null auth.uid()");

check("0039 restores an UNCONDITIONAL ownership check on submit_online_move",
  /if\s+not\s+v_owns\s+then/.test(sql39),
  "an ownership check gated on identity being present is not a check");

for (const fn of ["submit_online_move_as_server", "finish_online_game_by_result_as_server"]) {
  check(`0039 defines ${fn}`, has(sql39, `create or replace function public.${fn}`));
}
checkServerOnly(privs39, "public.submit_online_move_as_server(uuid, uuid, text, text)");
checkServerOnly(privs39, "public.finish_online_game_by_result_as_server(uuid, uuid, text)");
checkFullyRevoked(privs39, "public.submit_online_move(uuid, uuid, text, text)");
checkFullyRevoked(privs39, "public.finish_online_game_by_result(uuid, uuid, text)");

// A server entry point whose body still consults auth.uid() would reject the
// service role exactly the way 0036 does.
{
  const bodies = sql39
    .split("create or replace function public.")
    .filter((b) => b.startsWith("submit_online_move_as_server") || b.startsWith("finish_online_game_by_result_as_server"));
  check("both 0039 server entry points were located for body inspection",
    bodies.length === 2, `found ${bodies.length}`);
  for (const body of bodies) {
    const fn = body.slice(0, body.indexOf("("));
    const decl = body.split("$$")[1] ?? "";
    check(`${fn} does not consult auth.uid()`, !has(decl, "auth.uid()"),
      "the service role has no auth.uid(); this would reject the only legitimate caller");
  }
}

// ===========================================================================
// 0040 — server-only settlement, fail-closed on every uncertain clock state
// ===========================================================================
const sql40 = stripComments(read("0040_settle_timeouts_as_server.sql"));
const privs40 = parseExecutePrivileges(sql40);

check("0040 defines settle_timeout_as_server",
  has(sql40, "create or replace function public.settle_timeout_as_server"));
check("0040 uses no auth.uid() heuristic", !has(sql40, "auth.uid()"),
  "a cron has no auth.uid(); testing for it would reject the only legitimate caller");
checkServerOnly(privs40, "public.settle_timeout_as_server(uuid)");

// Fail-closed guards. Each must appear as executable SQL, before any
// arithmetic — every uncertain state returns without writing.
const FAIL_CLOSED = [
  ["a game that is not active", "g.status <> 'active'"],
  ["an untimed game", "g.time_control is null"],
  ["a game with no current_turn", "g.current_turn is null"],
  ["a game with no last_move_at", "g.last_move_at is null"],
  ["a null white clock", "g.white_time_ms is null"],
  ["a null black clock", "g.black_time_ms is null"],
];
for (const [label, needle] of FAIL_CLOSED) {
  check(`0040 refuses to settle ${label}`, has(sql40, needle),
    `missing guard: ${needle}`);
}

// The null-clock guards must come BEFORE the arithmetic, not merely exist.
{
  const guardAt = sql40.indexOf("g.white_time_ms is null");
  const mathAt = sql40.indexOf("v_white_ms := g.white_time_ms - v_elapsed_ms");
  check("0040's null-clock guard precedes the clock arithmetic",
    guardAt !== -1 && mathAt !== -1 && guardAt < mathAt,
    `guard@${guardAt} math@${mathAt}`);
}

check("0040 takes a row lock (race safety vs an incoming move)",
  has(sql40, "from online_games where id = p_game_id for update"));
check("0040 charges the white clock only when white is to move",
  has(sql40, "if g.current_turn = 'w' then") &&
  has(sql40, "v_white_ms := g.white_time_ms - v_elapsed_ms"));
check("0040 derives elapsed time from clock_timestamp()",
  has(sql40, "clock_timestamp()"));
check("0040 accepts no caller-supplied time, elapsed value or winner",
  !has(sql40, "p_now") && !has(sql40, "p_elapsed") && !has(sql40, "p_winner"),
  "the only parameter may be the game id");
check("0040 takes exactly one parameter, the game id",
  has(sql40, "settle_timeout_as_server(p_game_id uuid)"));

// ===========================================================================
// 0041 — exactly one matchmaking RPC, by exact signature
// ===========================================================================
const sql41 = stripComments(read("0041_drop_ambiguous_matchmaking_overload.sql"));

check("0041 drops the 2-argument find_or_create_match by exact signature",
  has(sql41, "drop function if exists public.find_or_create_match(uuid, int)"));
check("0041 drops it ONLY when the 3-argument form exists",
  has(sql41, "pg_get_function_identity_arguments(p.oid) = 'uuid, integer, text'"),
  "otherwise it could leave the database with no matchmaking function at all");
for (const sig of [
  "drop function if exists public.find_or_create_match(uuid, int, text)",
  "drop function if exists public.find_or_create_match(uuid, integer, text)",
  "drop function public.find_or_create_match(uuid, int, text)",
]) {
  check(`0041 never drops the canonical form: ${sig}`, !has(sql41, sig));
}
check("0041 creates no new function (it is a drop-only migration)",
  !has(sql41, "create or replace function"),
  "the canonical function must keep 0035's definition");

// The canonical function, and its DEFAULT, live in 0035. Assert them there —
// dropping the overload is only safe because the DEFAULT covers 2-arg callers.
{
  const sql35 = stripComments(read("0035_matchmaking_time_controls.sql"));
  check("0035 defines the canonical 3-argument find_or_create_match",
    has(sql35, "create or replace function public.find_or_create_match("));
  check("the canonical function has a DEFAULT time control",
    has(sql35, "p_time_control text default '10+0'"),
    "without the DEFAULT, dropping the 2-arg overload WOULD break 2-arg callers");
  check("0035 grants the canonical signature to authenticated",
    has(sql35, "grant execute on function public.find_or_create_match(uuid, int, text) to authenticated;"));
  check("0035 persists the chosen time control on the created game",
    has(sql35, "v_tc, clock_timestamp()"),
    "the selected control must reach online_games.time_control");
  check("0035 persists the chosen time control on the queue row",
    has(sql35, "values (p_child_id, v_rating, 'waiting', v_tc)"));
  check("0035 validates the time control against the allowed set",
    has(sql35, "if v_tc not in ('3+0', '3+2', '5+0', '5+3', '10+0', '10+5', '15+10') then"));
  // Ordering: 0041 must not be applied before the migration that creates the
  // function whose existence it depends on.
  check("0041 sorts after 0035, so the canonical form exists first",
    "0041_drop_ambiguous_matchmaking_overload.sql" > "0035_matchmaking_time_controls.sql");
}

// ===========================================================================
// Application code must use the server entry points
// ===========================================================================
for (const [file, expected] of [
  ["app/api/online/[gameId]/move/route.ts",
    ["submit_online_move_as_server", "finish_online_game_by_result_as_server"]],
  ["app/api/online/[gameId]/complete/route.ts",
    ["finish_online_game_by_result_as_server"]],
]) {
  const src = readRepo(...file.split("/"));
  for (const fn of expected) check(`${file} calls ${fn}`, has(src, `rpc("${fn}"`));
  check(`${file} no longer calls the browser-facing submit_online_move`,
    !has(src, 'rpc("submit_online_move"'));
  check(`${file} no longer calls the browser-facing finish_online_game_by_result`,
    !has(src, 'rpc("finish_online_game_by_result"'));
}

{
  const q = readRepo("lib", "supabase", "queries.ts");
  const callers = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== "node_modules" && e.name !== ".next") walk(p); continue; }
      if (!/\.tsx?$/.test(e.name)) continue;
      if (p.endsWith(path.join("lib", "supabase", "queries.ts"))) continue;
      const src = fs.readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
      if (/\bsubmitOnlineMove\b|\bfinishOnlineGame\b/.test(src)) {
        callers.push(path.relative(process.cwd(), p));
      }
    }
  };
  for (const d of ["app", "components", "lib"]) walk(path.join(process.cwd(), d));
  check("no module calls the deprecated client move/finish wrappers",
    callers.length === 0, callers.join(", "));
  check("the deprecated wrappers are documented as such", has(q, "@deprecated"));
}

// ===========================================================================
// The cron endpoint: secret-gated, fails closed, decides nothing itself
// ===========================================================================
{
  const route = readRepo("app", "api", "cron", "settle-games", "route.ts");
  check("the cron route authorizes every request", has(route, "authorizeCron("));
  check("the cron route reads a server-only secret",
    has(route, "process.env.CRON_SECRET") && !has(route, "NEXT_PUBLIC_CRON"));
  check("the cron route settles through the server RPC",
    has(route, 'rpc("settle_timeout_as_server"'));
  check("the cron route never writes online_games directly",
    !has(route, '.from("online_games").update('),
    "settlement must go through the locking function, not a bare update");
  check("the cron route never accepts a winner from the request",
    !has(route, 'searchParams.get("winner")') && !has(route, "body.winner"));
  check("one failing game does not abort the pass", has(route, "continue;"));

  const auth = readRepo("lib", "online", "cronAuth.ts");
  check("cron auth fails CLOSED when the secret is unset",
    has(auth, "if (!secret) return { ok: false"),
    "an unconfigured settlement endpoint must do nothing, not run unauthenticated");
  check("cron auth compares in constant time", has(auth, "safeEqual"));
  // Comments stripped: both files discuss NEXT_PUBLIC_ in prose precisely to
  // explain why the secret must not use it.
  check("no cron code reads a NEXT_PUBLIC_ env var for the secret",
    !has(stripJs(auth), "NEXT_PUBLIC") && !has(stripJs(route), "NEXT_PUBLIC"),
    "a NEXT_PUBLIC_ prefix would inline the secret into the client bundle");
}

// ===========================================================================
// 0036/0037 remain the documented hazard 0039 exists to neutralise
// ===========================================================================
{
  const body36 = stripComments(read("0036_verify_self_declared_results.sql"));
  const body37 = stripComments(read("0037_server_authoritative_completion.sql"));
  const has36Check = /if\s+not\s+v_owns\s+then/.test(body36);
  const has37Revoke = has(body37, "revoke execute on function public.finish_online_game_by_result");
  check("0036 still carries the auth.uid() ownership check (documents the hazard)", has36Check);
  check("0037 still revokes the browser grant (documents the hazard)", has37Revoke);
  check("0039 supplies the service-role path 0036+0037 would otherwise remove",
    has36Check && has37Revoke &&
      has(sql39, "create or replace function public.finish_online_game_by_result_as_server"),
    "applying 0036+0037 without 0039 leaves no caller able to finish a game");
}

// ===========================================================================
// Meta: this file must not reintroduce the escaping hazards that made an
// assertion silently unsatisfiable.
// ===========================================================================
{
  const self = readRepo("scripts", "test-authority-guards.js");
  // Built by concatenation so the needle does not appear literally in this
  // file and match itself — the first version of this assertion did exactly
  // that and reported a violation it had authored.
  const TEMPLATE_REGEX = "new RegExp(" + String.fromCharCode(96);
  check("this suite builds no regex from a template literal",
    !has(stripJs(self), TEMPLATE_REGEX),
    "backslash escapes lose their meaning inside a template literal");
  const control = [...self].filter((c) => {
    const n = c.charCodeAt(0);
    return (n < 0x20 && n !== 0x09 && n !== 0x0a && n !== 0x0d) || n === 0x7f;
  });
  check("this suite contains no stray control bytes", control.length === 0,
    `${control.length} found`);
}

console.log(`\n=== AUTHORITY GUARDS: ${pass} passed, ${failures.length} failed ===`);
if (failures.length) {
  console.error("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
  process.exitCode = 1;
}

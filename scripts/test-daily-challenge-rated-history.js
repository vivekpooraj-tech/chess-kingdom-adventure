/**
 * Daily Challenge cold-start rating nudge: regression test for migration 0058.
 *   node scripts/test-daily-challenge-rated-history.js
 *   node scripts/test-daily-challenge-rated-history.js --print-md5      (prints the md5 of the 0030 function, to compare with production)
 *   PGLITE_PATH=<path to @electric-sql/pglite> node ...                  (if PGlite is not installed next to the repo)
 *
 * Touches NO real database, no network, no browser. The behavioural part runs the REAL 0030 function (what production has) and the REAL 0058
 * function side by side in two isolated in-process PostgreSQL databases (PGlite), on identical fixtures, so what must not change is proven
 * equal and what must change is proven different. It is SKIPPED, loudly, if PGlite cannot be found (the static part always runs).
 *
 * The rule: a child's FIRST Daily Challenge (no Daily Challenge history) gets +1 difficulty from the rating only when the child has a rated
 * game on record AND their rating is at least 200 above the rating they had at their first rated game. The raw starting rating (1200 after
 * migration 0056, 400 before it) is never evidence by itself. Experience-band starts and caps, the Chess Mind engagement nudge and the whole
 * warm-start rolling-window logic are unchanged.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
let pass = 0;
const fails = [];
const check = (n, ok, d) => { if (ok) { pass++; console.log("  ok   " + n); } else { fails.push(n); console.log("  FAIL " + n + (d !== undefined ? " -- " + d : "")); } };

const M30 = read("supabase/migrations/0030_learner_aware_daily_challenge.sql");
const M58 = read("supabase/migrations/0058_daily_challenge_cold_start_rated_history.sql");
const bodyOf = (sql) => { const m = /\bAS\s+(\$[A-Za-z_]*\$)([\s\S]*?)\1\s*;/i.exec(sql); return m ? m[2] : ""; };
const norm = (b) => b.split("\n").map((l) => l.replace(/--.*$/, "").trim()).filter(Boolean);
const bag = (lines) => lines.reduce((m, l) => (m.set(l, (m.get(l) || 0) + 1), m), new Map());

console.log("== A. the change is exactly the intended one (static)");
const old30 = norm(bodyOf(M30)), new58 = norm(bodyOf(M58));
const bo = bag(old30), bn = bag(new58);
const added = [], removed = [];
for (const [l, n] of bn) { const d = n - (bo.get(l) || 0); for (let i = 0; i < d; i++) added.push(l); }
for (const [l, n] of bo) { const d = n - (bn.get(l) || 0); for (let i = 0; i < d; i++) removed.push(l); }
check("0058 removes exactly one executable line from the 0030 body: the raw-rating test 'coalesce(v_rating, 400) >= 600'", removed.length === 1 && removed[0] === "if coalesce(v_rating, 400) >= 600 then", removed.join(" | "));
check("0058 adds only the rated-history lookup, its variable and the new condition (7 lines)", added.length === 7 && [
  "v_rated_start int;",
  "select h.old_rating into v_rated_start",
  "from rating_history h",
  "where h.child_id = p_child_id",
  "order by h.created_at asc, h.id asc",
  "limit 1;",
  "if v_rated_start is not null and coalesce(v_rating, v_rated_start) >= v_rated_start + 200 then",
].every((l) => added.includes(l)), added.join(" | "));
check("everything else is the 0030 body: experience bands and caps, engagement nudge, rolling window, pool, history insert, return", old30.length - removed.length === new58.length - added.length && [
  "v_target := 3;   -- plays regularly -> start at \"intermediate\"".replace(/--.*$/, "").trim(), "v_cold_cap := 4;", "v_cold_cap := 3;", "v_cold_cap := 2;", "if v_chess_mind_solved >= 20 then", "v_target := least(v_target, v_cold_cap);",
  "if v_recent_count >= 3 then", "insert into daily_challenge_history (child_id, puzzle_id, challenge_date, level_served)", "raise exception 'Not authorized for this child';",
].every((l) => new58.includes(l)));
const sig = (s) => /create or replace function public\.get_daily_challenge\(p_child_id uuid, p_date date default current_date\)\s+returns table\(out_puzzle_id text, out_level_served int, out_result text, out_attempts int, out_theme text, out_mate_in int\)\s+language plpgsql\s+security definer set search_path = public/i.test(s);
check("signature, return shape, language, SECURITY DEFINER and search_path are identical to 0030", sig(M30) && sig(M58));
check("the grant stays with authenticated only", /grant execute on function public\.get_daily_challenge\(uuid, date\) to authenticated;/i.test(M58) && !/to\s+(anon|public)\b/i.test(M58.replace(/--.*$/gm, "")));
check("0058 touches no table and no data: one function and one grant, nothing else", !/\b(alter\s+table|create\s+table|drop\s|truncate|insert\s+into\s+(public\.)?(children|rating_history)|update\s+(public\.)?children)\b/i.test(M58.replace(/--.*$/gm, "")) && (M58.match(/\$function\$/g) || []).length === 2 && !/\r/.test(M58));
check("the file number 0058 is used by no other migration", fs.readdirSync(path.join(ROOT, "supabase", "migrations")).filter((f) => f.startsWith("0058")).length === 1);

let PGlite = null;
try { PGlite = require("@electric-sql/pglite").PGlite; } catch { try { if (process.env.PGLITE_PATH) PGlite = require(process.env.PGLITE_PATH).PGlite; } catch {} }
const finish = () => {
  console.log(`\n=== DAILY CHALLENGE RATED HISTORY: ${pass} passed, ${fails.length} failed ===`);
  fails.forEach((f) => console.log(" - " + f));
  process.exit(fails.length ? 1 : 0);
};

const SCHEMA = `create schema auth;
  create function auth.uid() returns uuid language sql stable as $x$ select nullif(current_setting('test.uid', true), '')::uuid $x$;
  create role authenticated nologin; create role anon nologin;
  create table parents (id uuid primary key default gen_random_uuid(), auth_user_id uuid not null);
  create table children (id uuid primary key default gen_random_uuid(), parent_id uuid not null references parents(id), rating int not null default 400, experience_level text);
  create table daily_challenge_puzzles (puzzle_id text primary key, level int not null check (level between 1 and 6), mate_in int not null check (mate_in between 1 and 3), theme text not null, active boolean not null default true);
  create table daily_challenge_history (id uuid primary key default gen_random_uuid(), child_id uuid not null references children(id) on delete cascade, puzzle_id text not null references daily_challenge_puzzles(puzzle_id),
    challenge_date date not null, level_served int not null check (level_served between 1 and 6), result text not null default 'pending' check (result in ('pending','solved','failed')), attempts int not null default 0,
    completed_at timestamptz, created_at timestamptz not null default now(), unique (child_id, challenge_date));
  create table child_chess_mind_stats (id uuid primary key default gen_random_uuid(), child_id uuid not null references children(id) on delete cascade, module_id text not null, total_solved int not null default 0, unique (child_id, module_id));
  create table rating_history (id uuid primary key default gen_random_uuid(), child_id uuid not null references children(id) on delete cascade, game_id uuid, old_rating int not null, rating_change int not null, new_rating int not null,
    result text not null, opponent_child_id uuid, created_at timestamptz not null default now());`;
const fn30 = () => { const s = M30.indexOf("create or replace function public.get_daily_challenge"); const e = "grant execute on function public.get_daily_challenge(uuid, date) to authenticated;"; return M30.slice(s, M30.indexOf(e, s) + e.length); };

async function fresh(fnSql) {
  const db = new PGlite();
  await db.exec(SCHEMA);
  for (let lvl = 1; lvl <= 6; lvl++) for (let n = 1; n <= 3; n++) await db.query("insert into daily_challenge_puzzles (puzzle_id, level, mate_in, theme) values ($1, $2, 1, 't')", [`L${lvl}-${n}`, lvl]);
  await db.exec(fnSql);
  return db;
}

if (process.argv.includes("--print-md5")) {
  if (!PGlite) { console.log("PGlite not found: set PGLITE_PATH"); process.exit(2); }
  (async () => { const db = await fresh(fn30()); const r = await db.query("select md5(regexp_replace(pg_get_functiondef('public.get_daily_challenge(uuid,date)'::regprocedure), '\\s+', ' ', 'g')) m"); console.log("md5 of the 0030 function (isolated PostgreSQL): " + r.rows[0].m); await db.close(); })();
} else if (!PGlite) {
  console.log("\n== B. behaviour"); console.log("  SKIPPED (not run): PGlite not found. Install @electric-sql/pglite or set PGLITE_PATH. Part A above DID run.");
  finish();
} else (async () => {
  console.log("\n== B. behaviour: the real 0030 function (old) and the real 0058 function (new) on identical fixtures");
  const OLD = await fresh(fn30()), NEW = await fresh(M58);
  const U1 = "11111111-1111-1111-1111-111111111111", U2 = "22222222-2222-2222-2222-222222222222";
  let nextDay = 0;
  const dayStr = () => { const d = new Date(Date.UTC(2099, 0, 1 + nextDay++)); return d.toISOString().slice(0, 10); };
  for (const db of [OLD, NEW]) { await db.query("insert into parents (id, auth_user_id) values ($1, $2)", [U1, U1]); await db.query("insert into parents (id, auth_user_id) values ($1, $2)", [U2, U2]); }
  const asUser = (db, uid) => db.query("select set_config('test.uid', $1, false)", [uid]);

  // Build one child identically in both databases; returns the id (same in both).
  async function child(spec) {
    const id = (await NEW.query("select gen_random_uuid() id")).rows[0].id;
    for (const db of [OLD, NEW]) {
      await db.query("insert into children (id, parent_id, rating, experience_level) values ($1, $2, $3, $4)", [id, U1, spec.rating ?? 1200, spec.exp ?? null]);
      if (spec.solved) await db.query("insert into child_chess_mind_stats (child_id, module_id, total_solved) values ($1, 'pattern', $2)", [id, spec.solved]);
      if (spec.ratedFrom !== undefined) await db.query("insert into rating_history (child_id, old_rating, rating_change, new_rating, result, created_at) values ($1, $2, $3, $4, 'win', now() - interval '30 days')", [id, spec.ratedFrom, (spec.rating ?? 1200) - spec.ratedFrom, spec.rating ?? 1200]);
      if (spec.laterGame) await db.query("insert into rating_history (child_id, old_rating, rating_change, new_rating, result, created_at) values ($1, $2, 0, $2, 'draw', now() - interval '1 day')", [id, spec.laterGame]);
      for (const h of spec.history || []) await db.query("insert into daily_challenge_history (child_id, puzzle_id, challenge_date, level_served, result, attempts) values ($1, $2, $3, $4, $5, $6)", [id, `L${h.level}-1`, h.date, h.level, h.result, h.attempts ?? 1]);
    }
    return id;
  }
  const level = async (db, id, date) => { await asUser(db, U1); const r = await db.query("select out_level_served l from get_daily_challenge($1, $2)", [id, date]); return r.rows[0].l; };
  // run a cold-start case on both functions and check each against its expected level
  async function cold(label, spec, expectOld, expectNew) {
    const id = await child(spec), date = dayStr();
    const o = await level(OLD, id, date), n = await level(NEW, id, date);
    check(`${label}: now level ${expectNew}` + (expectOld === expectNew ? " (unchanged from 0030)" : ` (0030 gave ${expectOld}, by design)`), n === expectNew && o === expectOld, `0030=${o} 0058=${n}`);
  }

  console.log("  -- a new player at the 1200 default with zero rated games: the starting rating must not raise the first challenge");
  await cold("new player, experience 'new', rating 1200, no rated games", { exp: "new" }, 2, 1);
  await cold("new player, experience 'knows_basics', rating 1200, no rated games", { exp: "knows_basics" }, 3, 2);
  await cold("new player, experience 'plays_regularly', rating 1200, no rated games", { exp: "plays_regularly" }, 4, 3);
  await cold("new player, experience not set (NULL) is treated as 'new'", { exp: null }, 2, 1);
  await cold("a child moved to 1200 by the optional 0057 (no rated game) is not nudged either", { exp: "knows_basics", rating: 1200 }, 3, 2);
  await cold("an old-default child (400, never played) is unaffected: it was never nudged", { exp: "new", rating: 400 }, 1, 1);
  await cold("a high rating with NO rated game on record (e.g. a hand-set 1800) is not evidence either", { exp: "new", rating: 1800 }, 2, 1);

  console.log("  -- the Chess Mind engagement nudge and the experience-band caps are unchanged");
  await cold("1200 + 20 Chess Mind solves, 'new': engagement nudge counts, capped at 2", { exp: "new", solved: 20 }, 2, 2);
  await cold("1200 + 20 solves, 'knows_basics': 2 + 1 = 3, at the cap of 3", { exp: "knows_basics", solved: 20 }, 3, 3);
  await cold("1200 + 20 solves, 'plays_regularly': 3 + 1 = 4, at the cap of 4", { exp: "plays_regularly", solved: 20 }, 4, 4);
  await cold("19 solves is below the engagement threshold: no nudge", { exp: "new", solved: 19 }, 2, 1);

  console.log("  -- an established player with rated-game history keeps the nudge, measured from where they began");
  await cold("rated from 1200 to 1450 (+250), 'new': nudged, capped at 2", { exp: "new", rating: 1450, ratedFrom: 1200 }, 2, 2);
  await cold("rated from 1200 to 1450, 'knows_basics': nudged to 3 (cap 3)", { exp: "knows_basics", rating: 1450, ratedFrom: 1200 }, 3, 3);
  await cold("rated from 1200 to 1450, 'plays_regularly': nudged to 4 (cap 4)", { exp: "plays_regularly", rating: 1450, ratedFrom: 1200 }, 4, 4);
  await cold("exactly +200 (1400 from 1200) counts: the boundary is inclusive, like >= 600 from 400", { exp: "new", rating: 1400, ratedFrom: 1200 }, 2, 2);
  await cold("+199 (1399 from 1200) is not yet demonstrated strength: no nudge", { exp: "new", rating: 1399, ratedFrom: 1200 }, 2, 1);
  await cold("a player who played and DROPPED (1200 to 1000) is not nudged (0030 would have nudged on the raw 1000)", { exp: "new", rating: 1000, ratedFrom: 1200 }, 2, 1);
  await cold("the nudge is measured from the FIRST rated game, not a later one", { exp: "new", rating: 1450, ratedFrom: 1200, laterGame: 1440 }, 2, 2);
  await cold("both nudges + 'plays_regularly' (3 + 1 + 1 = 5) are still capped at 4", { exp: "plays_regularly", rating: 1450, ratedFrom: 1200, solved: 20 }, 4, 4);
  await cold("both nudges + 'new' (1 + 1 + 1 = 3) are still capped at 2", { exp: "new", rating: 1450, ratedFrom: 1200, solved: 20 }, 2, 2);

  console.log("  -- legacy players (first rated game began at 400) behave exactly as before");
  await cold("began at 400, now 650 (+250): nudged as before", { exp: "new", rating: 650, ratedFrom: 400 }, 2, 2);
  await cold("began at 400, now 600 (exactly >= 600): nudged as before", { exp: "new", rating: 600, ratedFrom: 400 }, 2, 2);
  await cold("began at 400, now 599: not nudged as before", { exp: "new", rating: 599, ratedFrom: 400 }, 1, 1);
  await cold("began at 400, now 900, 'plays_regularly': 4 as before", { exp: "plays_regularly", rating: 900, ratedFrom: 400 }, 4, 4);

  console.log("  -- warm start (any Daily Challenge history): identical to 0030 whatever the rating or rated history");
  const mkHistory = (levels, results) => levels.map((lv, i) => ({ date: `2098-12-${String(10 + i).padStart(2, "0")}`, level: lv, result: results[i], attempts: 1 }));
  const warm = async (label, spec, expected) => {
    const id = await child(spec), date = "2098-12-25";
    const o = await level(OLD, id, date), n = await level(NEW, id, date);
    check(`${label}: level ${expected} in both functions`, o === expected && n === expected, `0030=${o} 0058=${n}`);
  };
  await warm("last level 3, only 2 resolved attempts (maintain)", { exp: "new", rating: 1200, history: mkHistory([3, 3], ["solved", "solved"]) }, 3);
  await warm("5 solved first try at level 3: nudged up to 4", { exp: "new", rating: 1200, history: mkHistory([3, 3, 3, 3, 3], ["solved", "solved", "solved", "solved", "solved"]) }, 4);
  await warm("5 failed at level 3: nudged down to 2", { exp: "plays_regularly", rating: 1450, ratedFrom: 1200, history: mkHistory([3, 3, 3, 3, 3], ["failed", "failed", "failed", "failed", "failed"]) }, 2);
  await warm("a child with 1450 rated history but Daily history at level 2 stays anchored at 2", { exp: "new", rating: 1450, ratedFrom: 1200, history: mkHistory([2, 2], ["solved", "failed"]) }, 2);

  console.log("  -- everything else about the function is unchanged");
  {
    const id = await child({ exp: "new" }), date = dayStr();
    const a = await level(NEW, id, date), b = await level(NEW, id, date);
    const rows = (await NEW.query("select count(*)::int c from daily_challenge_history where child_id = $1 and challenge_date = $2", [id, date])).rows[0].c;
    const same = (await NEW.query("select (select puzzle_id from daily_challenge_history where child_id = $1 and challenge_date = $2) = (select out_puzzle_id from get_daily_challenge($1, $2)) s", [id, date])).rows[0].s;
    check("same-day idempotency: a second call returns the same puzzle and there is still one history row", a === b && rows === 1 && same === true);
  }
  {
    const id = await child({ exp: "new" });
    await asUser(NEW, U2);
    const e = await NEW.query("select * from get_daily_challenge($1, $2)", [id, dayStr()]).then(() => null, (x) => x);
    check("ownership is still enforced: another parent gets 'Not authorized for this child'", !!e && /Not authorized for this child/.test(e.message), e && e.message);
    await asUser(NEW, "");
    const e2 = await NEW.query("select * from get_daily_challenge($1, $2)", [id, dayStr()]).then(() => null, (x) => x);
    check("and a caller with no identity is refused too", !!e2 && /Not authorized/.test(e2.message));
  }
  check("exactly one get_daily_challenge function exists afterwards, and authenticated can execute it", (await NEW.query("select count(*)::int c, bool_and(has_function_privilege('authenticated', p.oid, 'execute')) a from pg_proc p where proname = 'get_daily_challenge'")).rows.every((r) => r.c === 1 && r.a === true));
  let rerun = null; try { await NEW.exec(M58); } catch (x) { rerun = x; }
  check("0058 can be run a second time cleanly (idempotent)", !rerun, rerun && rerun.message);
  const over = new PGlite(); await over.exec(SCHEMA); await over.exec(fn30());
  let overErr = null; try { await over.exec(M58); } catch (x) { overErr = x; }
  check("0058 replaces the 0030 function in place (no drop needed) as one script", !overErr, overErr && overErr.message);
  await OLD.close(); await NEW.close(); await over.close();
  finish();
})().catch((e) => { console.log("HARNESS ERROR", e.message); process.exit(2); });

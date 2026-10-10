/**
 * Chess Mind rating policy regression test (migration 0056 + optional 0057 + lib/rating/policy.ts + lib/lichess/ratings.ts).
 *   node scripts/test-rating-policy.js
 *   PGLITE_PATH=<path to @electric-sql/pglite> node scripts/test-rating-policy.js     (if PGlite is not installed next to the repo)
 *
 * Touches NO real database, no network, no browser. The behavioural parts (D, E) run the real migration files in an isolated in-process
 * PostgreSQL (PGlite) on top of the 0026 function they replace; they are SKIPPED, loudly, if PGlite cannot be found (A-C always run).
 *
 *   A. the TypeScript policy: start 1200, provisional for 10 games, ONE K per game (64 if either player is provisional, else 32), floor 400
 *   B. Lichess: the rating for a speed, adult-only, never substituted from or written to the Chess Mind rating
 *   C. the migration text and the code base: only apply_match_rating writes a rating, no bulk reset, no stray rating write path, the SQL
 *      constants equal the TypeScript constants, Lichess code cannot reach a rating write, matchmaking has no Lichess path
 *   D. behaviour of 0056: new users, existing users untouched, provisional -> established at exactly 10, the shared K, win / loss / draw,
 *      zero-sum, a duplicate result is a no-op, unrated games never move or count, the floor, re-running the migration
 *   E. behaviour of the optional 0057: only a never-rated child sitting on the untouched default of 400 moves to 1200
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
let pass = 0;
const fails = [];
const check = (n, ok, d) => { if (ok) { pass++; console.log("  ok   " + n); } else { fails.push(n); console.log("  FAIL " + n + (d !== undefined ? " -- " + d : "")); } };
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const stripSqlComments = (s) => s.replace(/--[^\n]*/g, "");
const stripTsComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

// ---- load the real TypeScript modules (transpiled to a temp dir; no stubs, they import nothing but each other)
const ts = require(path.join(ROOT, "node_modules", "typescript"));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rating-policy-"));
for (const [src, out] of [["lib/rating/policy.ts", "policy.js"], ["lib/lichess/ratings.ts", "ratings.js"], ["lib/lichess/eligibility.ts", "eligibility.js"]]) {
  fs.writeFileSync(path.join(tmp, out), ts.transpileModule(read(src), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText);
}
const P = require(path.join(tmp, "policy.js"));
const L = require(path.join(tmp, "ratings.js"));
const E = require(path.join(tmp, "eligibility.js"));

console.log("== A. TypeScript policy");
check("new players start at 1200", P.STARTING_RATING === 1200);
check("the floor is 400", P.RATING_FLOOR === 400);
check("provisional for the first 10 completed rated games", P.PROVISIONAL_GAMES === 10);
check("K is 64 for a provisional game and 32 for an established one (32 is the value that was always used)", P.K_PROVISIONAL === 64 && P.K_ESTABLISHED === 32);
check("games 0..9 completed are provisional, 10 and more are established", [0, 1, 9].every((n) => P.isProvisional(n)) && [10, 11, 500].every((n) => !P.isProvisional(n)));
check("K is per GAME: 64 when EITHER player is provisional (either way round), 32 only when BOTH are established",
  P.kFactorForGame(0, 0) === 64 && P.kFactorForGame(0, 50) === 64 && P.kFactorForGame(50, 0) === 64 && P.kFactorForGame(9, 10) === 64 && P.kFactorForGame(10, 9) === 64 && P.kFactorForGame(10, 10) === 32 && P.kFactorForGame(11, 500) === 32);
check("equal ratings: a provisional game is +32 / -32 and an established game +16 / -16", P.ratingAfter(1200, 1200, 1, 0, 0) === 1232 && P.ratingAfter(1200, 1200, 0, 0, 0) === 1168 && P.ratingAfter(1200, 1200, 1, 10, 10) === 1216 && P.ratingAfter(1200, 1200, 0, 10, 10) === 1184);
check("an established player facing a provisional opponent moves at K=64 too (and the provisional player at the same K)", P.ratingAfter(1200, 1200, 1, 30, 2) === 1232 && P.ratingAfter(1200, 1200, 0, 2, 30) === 1168);
check("both players of a game always move by the same K: the two changes cancel (unfloored, rounded ratings)", [[0, 0], [0, 40], [40, 0], [9, 10], [10, 10], [25, 25]].every(([a, b]) => { const ra = 1350, rb = 1100; return [1, 0.5, 0].every((s) => (P.ratingAfter(ra, rb, s, a, b) - ra) + (P.ratingAfter(rb, ra, 1 - s, b, a) - rb) === 0); }));
check("a draw between equals changes nothing at either stage", P.ratingAfter(1200, 1200, 0.5, 0, 0) === 1200 && P.ratingAfter(1200, 1200, 0.5, 50, 50) === 1200);
check("a draw against a stronger player gains, against a weaker one loses (Elo, not a special case)", P.ratingAfter(1200, 1400, 0.5, 0, 0) > 1200 && P.ratingAfter(1200, 1000, 0.5, 0, 0) < 1200);
check("the rating never falls below the floor", P.ratingAfter(400, 300, 0, 0, 0) === 400 && P.ratingAfter(405, 400, 0, 0, 0) === 400);
check("expected score is 0.5 for equals and sums to 1 for a pair", P.expectedScore(1500, 1500) === 0.5 && Math.abs(P.expectedScore(1500, 1300) + P.expectedScore(1300, 1500) - 1) < 1e-12);

console.log("\n== B. Lichess: separate rating, adult-only (fallback matchmaking is NOT implemented; this is only the rule it would use)");
check("speeds map by Lichess's own rule (base + 40 x increment): 3+0 and 5+0 blitz, 10+0 and 15+10 rapid", L.lichessPerfForTimeControl("3+0") === "blitz" && L.lichessPerfForTimeControl("5+0") === "blitz" && L.lichessPerfForTimeControl("10+0") === "rapid" && L.lichessPerfForTimeControl("15+10") === "rapid");
check("1+0 is bullet, 30+0 is classical, and an unknown speed maps to nothing", L.lichessPerfForTimeControl("1+0") === "bullet" && L.lichessPerfForTimeControl("30+0") === "classical" && L.lichessPerfForTimeControl("fast") === null);
const perfs = { blitz: { rating: 1830.4, games: 220, prov: false }, rapid: { rating: 1710, prov: true }, bullet: {} };
const adult = (over) => L.lichessRatingFor({ ageBand: "adult", connected: true, perfs, timeControl: "5+0", ...over });
check("an adult who connected gets the REAL Lichess rating for the selected speed (rounded, not converted)", JSON.stringify(adult()) === JSON.stringify({ perf: "blitz", rating: 1830, provisional: false }));
check("a different speed picks that speed's rating, and a provisional Lichess rating is flagged", JSON.stringify(adult({ timeControl: "10+0" })) === JSON.stringify({ perf: "rapid", rating: 1710, provisional: true }));
check("no rating for that speed -> null (never the Chess Mind rating, never an invented number)", adult({ timeControl: "1+0" }) === null && adult({ timeControl: "30+0" }) === null && adult({ perfs: {} }) === null && adult({ perfs: null }) === null);
check("a Lichess rating that is not a finite number is treated as unavailable", adult({ perfs: { blitz: { rating: NaN } } }) === null && adult({ perfs: { blitz: { rating: "1800" } } }) === null);
check("a minor never gets a Lichess rating (kid, tween, teen)", ["kid", "tween", "teen", "child", "under18", "14-17"].every((b) => adult({ ageBand: b }) === null));
check("an unknown age band never does (null, undefined, empty, garbage)", [null, undefined, "", "unknown", "ADULT", " adult"].every((b) => adult({ ageBand: b }) === null));
check("an adult who has NOT connected gets nothing", adult({ connected: false }) === null);
check("eligibility is exactly 'adult' and nothing else", E.isLichessEligible("adult") === true && ["kid", "tween", "teen", null, undefined, ""].every((b) => E.isLichessEligible(b) === false));
check("the result carries no Chess Mind number: only perf, rating, provisional", Object.keys(adult()).sort().join() === "perf,provisional,rating");

console.log("\n== C. migration text and code base");
const MIG = "supabase/migrations/0056_rating_policy_start_1200_provisional.sql";
const OPT = "supabase/migrations/0057_optional_move_unplayed_400_to_1200.sql";
const mig = read(MIG);
const sql = stripSqlComments(mig);
const HAS_OPT = fs.existsSync(path.join(ROOT, OPT)); // 0057 is optional and may not be part of this checkout
const opt = HAS_OPT ? read(OPT) : "";
const optSql = stripSqlComments(opt);
check("0056 sets the default to 1200 for new rows", /alter\s+table\s+public\.children\s+alter\s+column\s+rating\s+set\s+default\s+1200\s*;/i.test(sql));
const upd = sql.match(/update\s+(?:public\.)?children\s+set\s+rating[^;]*;/gi) || [];
check("0056: the ONLY updates of children.rating are the two by-id updates inside apply_match_rating (no bulk reset, no unconditioned update)", upd.length === 2 && upd.every((u) => /where\s+id\s*=\s*g\.(host|guest)_child_id/i.test(u)), upd.join(" | "));
check("no delete, truncate, drop or insert into children in 0056", !/\b(delete\s+from|truncate|drop\s+(table|function|column)|insert\s+into\s+(public\.)?children)\b/i.test(sql));
check("0056 never mentions Lichess in executable SQL", !/lichess/i.test(sql));
const constant = (name) => Number((new RegExp(name + "\\s+constant\\s+int\\s*:=\\s*(\\d+)", "i").exec(sql) || [])[1]);
check("the SQL constants equal the TypeScript policy (K 64 / 32, 10 games, floor 400)", constant("k_provisional") === P.K_PROVISIONAL && constant("k_established") === P.K_ESTABLISHED && constant("provisional_games") === P.PROVISIONAL_GAMES && constant("rating_floor") === P.RATING_FLOOR);
check("K is chosen once per game from BOTH players' counts (either provisional -> provisional K for both)", /game_k\s*:=\s*case\s+when\s+host_games\s*<\s*provisional_games\s+or\s+guest_games\s*<\s*provisional_games\s+then\s+k_provisional\s+else\s+k_established\s+end/i.test(sql) && (sql.match(/game_k\s*\*/g) || []).length === 2 && !/host_k|guest_k/.test(sql));
check("the games count is derived from rating_history (no new column, no backfill)", /count\(\*\)\s+into\s+host_games\s+from\s+rating_history/i.test(sql) && /count\(\*\)\s+into\s+guest_games\s+from\s+rating_history/i.test(sql) && !/add\s+column/i.test(sql));
check("the guards are all still there (random only, rating_applied no-op, finished with a guest, valid winner)", /match_type\s*<>\s*'random'/.test(sql) && /if\s+g\.rating_applied\s+then\s+return/.test(sql) && /g\.status\s*<>\s*'finished'\s+or\s+g\.guest_child_id\s+is\s+null/.test(sql) && /g\.winner\s+is\s+null\s+or\s+g\.winner\s+not\s+in\s*\('w',\s*'b',\s*'draw'\)/.test(sql));
check("the 400 floor is applied to both players", (sql.match(/greatest\(rating_floor,/g) || []).length === 2);
check("both players are locked in a fixed order before ratings are read", /perform\s+1\s+from\s+children\s+where\s+id\s+in\s*\(g\.host_child_id,\s*g\.guest_child_id\)\s+order\s+by\s+id\s+for\s+update/i.test(sql));
check("execute stays with authenticated only (the grant is restated, nothing widened)", /grant\s+execute\s+on\s+function\s+public\.apply_match_rating\(uuid\)\s+to\s+authenticated\s*;/i.test(sql) && !/to\s+(anon|public)\b/i.test(sql));
check("0056 is complete as one script: $function$ opens once and closes once, LF line endings", (mig.match(/\$function\$/g) || []).length === 2 && !/\r/.test(mig));
const migDir = path.join(ROOT, "supabase", "migrations");
const prefixes = fs.readdirSync(migDir).filter((f) => f.endsWith(".sql")).map((f) => f.slice(0, 4));
check("the new migration numbers 0056 and 0057 are not used by any other migration file", prefixes.filter((p) => p === "0056").length === 1 && prefixes.filter((p) => p === "0057").length <= 1);
if (HAS_OPT) check("0057 is OPTIONAL and touches only children.rating: one UPDATE, 400 -> 1200, no rating_history insert, nothing else",
  /update\s+public\.children\s+c\s+set\s+rating\s*=\s*1200\s+where\s+c\.rating\s*=\s*400/i.test(optSql) && (optSql.match(/\bupdate\b/gi) || []).length === 1 && !/\b(insert|delete|truncate|drop|alter|create)\b/i.test(optSql) && /OPTIONAL - PROPOSED - NOT APPLIED/.test(opt));
if (HAS_OPT) check("0057 only moves a child with no rating_history, no rated game, no waiting queue row and no unfinished random game", /not exists \(select 1 from public\.rating_history h where h\.child_id = c\.id\)/i.test(optSql) && /rating_applied = true/i.test(optSql) && /q\.status = 'waiting'/.test(optSql) && /g\.status in \('matched', 'active'\)/.test(optSql));
const writers = fs.readdirSync(migDir).filter((f) => f.endsWith(".sql") && /update\s+(public\.)?children\s+(c\s+)?set\s+rating/i.test(stripSqlComments(fs.readFileSync(path.join(migDir, f), "utf8"))));
check("no other migration writes children.rating", writers.every((f) => /^(0008|0020|0026|0056|0057)_/.test(f)), writers.join(", "));
const walk = (d, out = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (["node_modules", ".next", ".git"].includes(e.name)) continue; const p = path.join(d, e.name); if (e.isDirectory()) walk(p, out); else if (/\.(ts|tsx)$/.test(e.name)) out.push(p); } return out; };
const codeFiles = ["app", "lib", "components"].flatMap((d) => walk(path.join(ROOT, d)));
const ratingWriters = codeFiles.filter((f) => /\.rpc\(\s*["']apply_match_rating["']/.test(fs.readFileSync(f, "utf8"))).map((f) => path.relative(ROOT, f).replace(/\\/g, "/")).sort();
check("the only code that settles a rating calls apply_match_rating, from the known server/online paths", ratingWriters.join() === ["app/api/cron/settle-games/route.ts", "app/api/online/[gameId]/complete/route.ts", "app/api/online/[gameId]/move/route.ts", "lib/supabase/queries.ts"].sort().join(), ratingWriters.join());
const directWrite = codeFiles.filter((f) => /from\(["']children["']\)[\s\S]{0,200}\.(update|upsert)\(\s*\{[^}]*\brating\b/.test(fs.readFileSync(f, "utf8")) || /from\(["']rating_history["']\)[\s\S]{0,80}\.(insert|update|upsert|delete)\(/.test(fs.readFileSync(f, "utf8")));
check("no code writes children.rating or rating_history directly", directWrite.length === 0, directWrite.map((f) => path.relative(ROOT, f)).join(", "));
check("a child is created with only parent_id (+ display_name): the database default decides the start rating", /\.insert\(\{\s*parent_id:\s*parent\.id\s*\}\)/.test(read("lib/supabase/queries.ts")) && /\.insert\(\{\s*parent_id:\s*parent\.id,\s*display_name:\s*displayName\s*\}\)/.test(read("lib/supabase/queries.ts")));
const nonRatingAreas = ["app/(tabs)/puzzles", "app/free-play", "app/puzzles", "lib/puzzles", "lib/training", "lib/trainYourMind", "lib/chess-engine"].map((d) => path.join(ROOT, d)).filter((d) => fs.existsSync(d));
const leaks = nonRatingAreas.flatMap((d) => walk(d)).filter((f) => /apply_match_rating|rating_history|children.*\brating\s*[:=]\s*\d/.test(fs.readFileSync(f, "utf8")));
check("puzzles, training and the computer game never call the rating function or write a rating", leaks.length === 0, leaks.map((f) => path.relative(ROOT, f)).join(", "));
const lichessFiles = [...walk(path.join(ROOT, "lib", "lichess")), ...walk(path.join(ROOT, "components", "lichess")), path.join(ROOT, "app", "lichess", "callback", "page.tsx")].filter((f) => fs.existsSync(f));
const lichessBad = lichessFiles.filter((f) => /apply_match_rating|rating_history|from\(["']children["']\)|policy["']|lib\/rating|\.rpc\(/.test(stripTsComments(fs.readFileSync(f, "utf8"))));
check("no Lichess file calls the rating function, touches children / rating_history, or imports the Chess Mind rating policy", lichessBad.length === 0, lichessBad.map((f) => path.relative(ROOT, f)).join(", "));
check("lib/rating/policy.ts has no import at all (nothing can leak a Lichess value into it)", !/^\s*import\s/m.test(read("lib/rating/policy.ts")));
check("matchmaking has no Lichess code path (fallback is not implemented), so a minor or unknown-age player cannot be sent there", !/lichess/i.test(stripTsComments(read("app/matchmaking/page.tsx"))));
check("the matchmaking copy quotes the rating the player really has and the provisional count from the policy (no hard-coded 400)", /starting at \{view\.rating\.toLocaleString\(\)\}/.test(read("app/matchmaking/page.tsx")) && /\{PROVISIONAL_GAMES\}/.test(read("app/matchmaking/page.tsx")) && !/starting at 400/.test(read("app/matchmaking/page.tsx")));

let PGlite = null;
try { PGlite = require("@electric-sql/pglite").PGlite; } catch { try { if (process.env.PGLITE_PATH) PGlite = require(process.env.PGLITE_PATH).PGlite; } catch {} }
const finish = () => {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
  console.log(`\n=== RATING POLICY: ${pass} passed, ${fails.length} failed ===`);
  fails.forEach((f) => console.log(" - " + f));
  process.exit(fails.length ? 1 : 0);
};
console.log("\n== D. behaviour of 0056 (the real file on top of the 0026 function, isolated PostgreSQL)");
if (!PGlite) { console.log("  SKIPPED (not run): PGlite not found. Install @electric-sql/pglite or set PGLITE_PATH. Parts A-C above DID run; D and E did not."); finish(); }
else (async () => {
  const SCHEMA = `create schema auth; create function auth.uid() returns uuid language sql stable as $x$ select null::uuid $x$; create role authenticated nologin; create role anon nologin;
    create table children (id uuid primary key default gen_random_uuid(), display_name text, rating int not null default 400);
    create table online_games (id uuid primary key default gen_random_uuid(), host_child_id uuid references children(id) on delete cascade, guest_child_id uuid references children(id) on delete cascade,
      host_color text not null default 'w', status text not null default 'active', winner text, match_type text not null default 'random', time_control text default '10+0',
      rating_applied boolean not null default false, host_rating_before int, host_rating_after int, guest_rating_before int, guest_rating_after int);
    create table rating_history (id uuid primary key default gen_random_uuid(), child_id uuid not null references children(id) on delete cascade, game_id uuid references online_games(id) on delete set null,
      old_rating int not null, rating_change int not null, new_rating int not null, result text not null check (result in ('win','loss','draw')), opponent_child_id uuid references children(id) on delete set null, created_at timestamptz not null default now());
    create table matchmaking_queue (id uuid primary key default gen_random_uuid(), child_id uuid not null references children(id) on delete cascade, status text not null default 'waiting', rating int);`;
  const m26 = read("supabase/migrations/0026_rating_system_hardening.sql");
  const from = m26.indexOf("create or replace function public.apply_match_rating(p_game_id uuid)");
  const endMark = "grant execute on function public.apply_match_rating(uuid) to authenticated;";
  const FN26 = m26.slice(from, m26.indexOf(endMark, from) + endMark.length);
  const fresh = async () => { const d = new PGlite(); await d.exec(SCHEMA); await d.exec(FN26); return d; };

  let db = await fresh();
  const q = async (s, p) => (await db.query(s, p)).rows;
  const mk = async (name, rating) => (await q(`insert into children (display_name${rating == null ? "" : ", rating"}) values ($1${rating == null ? "" : ", $2"}) returning id`, rating == null ? [name] : [name, rating]))[0].id;
  const rating = async (id) => (await q("select rating from children where id = $1", [id]))[0].rating;
  const games = async (id) => (await q("select count(*)::int c from rating_history where child_id = $1", [id]))[0].c;
  const game = async (host, guest, winner, o = {}) => (await q(`insert into online_games (host_child_id, guest_child_id, host_color, status, winner, match_type, rating_applied) values ($1,$2,'w',$3,$4,$5,$6) returning id`,
    [host, guest, o.status ?? "finished", winner, o.type ?? "random", o.applied ?? false]))[0].id;
  const settle = (id) => db.query("select apply_match_rating($1)", [id]);
  const seedHistory = async (id, n) => { for (let i = 0; i < n; i++) await q("insert into rating_history (child_id, game_id, old_rating, rating_change, new_rating, result) values ($1, null, 1200, 0, 1200, 'draw')", [id]); };
  const snapshot = async () => JSON.stringify(await q("select id, rating from children order by id"));

  const oldA = await mk("old400"), oldB = await mk("old1337", 1337), oldC = await mk("old1200", 1200), oldD = await mk("old2100", 2100);
  const before = await snapshot();
  let e = null; try { await db.exec(mig); } catch (x) { e = x; }
  check("0056 runs cleanly as one script over the production function", !e, e && `${e.code}: ${e.message}`);
  check("every existing player's rating is exactly what it was (no bulk reset, no recalculation)", (await snapshot()) === before);
  check("existing players keep their own rating whatever it is (400, 1337, 1200, 2100)", JSON.stringify((await q("select rating from children where id = any($1) order by rating", [[oldA, oldB, oldC, oldD]])).map((r) => r.rating)) === "[400,1200,1337,2100]");
  check("exactly one apply_match_rating function after the replacement", (await q("select count(*)::int c from pg_proc where proname = 'apply_match_rating'"))[0].c === 1);
  check("a brand-new player starts at 1200", (await q("select rating from children where id = $1", [await mk("fresh")]))[0].rating === 1200);
  e = null; try { await db.exec(mig); } catch (x) { e = x; }
  check("running 0056 a second time is clean, leaves one function and changes no existing rating", !e && (await q("select count(*)::int c from pg_proc where proname = 'apply_match_rating'"))[0].c === 1 && (await rating(oldA)) === 400 && (await rating(oldB)) === 1337 && (await rating(oldC)) === 1200 && (await rating(oldD)) === 2100, e && e.message);

  console.log("  -- first rated game: both players provisional, win / loss / draw");
  const w1 = await mk("w1"), l1 = await mk("l1");
  await settle(await game(w1, l1, "w"));
  check("win at 1200 v 1200: host +32, guest -32 (K=64), both equal to the TypeScript policy", (await rating(w1)) === P.ratingAfter(1200, 1200, 1, 0, 0) && (await rating(l1)) === P.ratingAfter(1200, 1200, 0, 0, 0) && (await rating(w1)) === 1232 && (await rating(l1)) === 1168, `${await rating(w1)}/${await rating(l1)}`);
  check("each player now has exactly one completed rated game", (await games(w1)) === 1 && (await games(l1)) === 1);
  const d1 = await mk("d1", 1500), d2 = await mk("d2", 1300);
  await settle(await game(d1, d2, "draw"));
  check("draw between 1500 and 1300: the lower player gains and the higher loses, both equal to the policy and the changes cancel", (await rating(d1)) === P.ratingAfter(1500, 1300, 0.5, 0, 0) && (await rating(d2)) === P.ratingAfter(1300, 1500, 0.5, 0, 0) && (await rating(d2)) > 1300 && (await rating(d1)) < 1500 && (await rating(d1)) - 1500 + (await rating(d2)) - 1300 === 0);
  const b1 = await mk("b1"), b2 = await mk("b2");
  await settle(await game(b1, b2, "b"));
  check("a black win is a guest win: guest up, host down (host_color w)", (await rating(b2)) === 1232 && (await rating(b1)) === 1168);

  console.log("  -- one K per game: 64 if EITHER player is provisional, 32 only if BOTH are established");
  const cases = [
    ["both provisional (0 and 0 games)", 0, 0, 1232, 1168],
    ["provisional host (9) v established guest (10): K=64 for both", 9, 10, 1232, 1168],
    ["established host (10) v provisional guest (9): K=64 for both", 10, 9, 1232, 1168],
    ["established host (40) v provisional guest (0): the established player also moves at K=64", 40, 0, 1232, 1168],
    ["both established (10 and 10): K=32 for both", 10, 10, 1216, 1184],
    ["both established (60 and 25): K=32 for both", 60, 25, 1216, 1184],
  ];
  for (const [label, gh, gg, wantH, wantG] of cases) {
    const h = await mk("kh"), g2 = await mk("kg");
    await seedHistory(h, gh); await seedHistory(g2, gg);
    await settle(await game(h, g2, "w"));
    check(label + ": host " + wantH + ", guest " + wantG + ", equal to the policy, and the two changes cancel", (await rating(h)) === wantH && (await rating(g2)) === wantG && wantH === P.ratingAfter(1200, 1200, 1, gh, gg) && wantG === P.ratingAfter(1200, 1200, 0, gg, gh) && (await rating(h)) - 1200 + (await rating(g2)) - 1200 === 0, `${await rating(h)}/${await rating(g2)}`);
  }
  const nine = await mk("nine"), est = await mk("est");
  await seedHistory(nine, 9); await seedHistory(est, 30);
  await settle(await game(nine, est, "w"));
  check("the 10th completed game still counts as provisional for the one who is playing it (count BEFORE the game): 9 -> 10 games", (await games(nine)) === 10 && (await rating(nine)) === 1232);
  const nowTen = await mk("nowTen"), est2 = await mk("est2");
  await seedHistory(nowTen, 10); await seedHistory(est2, 30);
  await settle(await game(nowTen, est2, "w"));
  check("the very next game (both now established) uses K=32: 1200 -> 1216 / 1184", (await rating(nowTen)) === 1216 && (await rating(est2)) === 1184);

  console.log("  -- a full run of 12 rated games for one player against established opponents");
  const run = await mk("runner"); let r = 1200, ok = true, firstDetail = "", cancel = true;
  const results = [1, 0, 1, 1, 0.5, 0, 1, 1, 0, 1, 1, 0];
  for (let i = 0; i < results.length; i++) {
    const opp = await mk("runopp" + i, 1100 + i * 40); await seedHistory(opp, 12);
    const oppBefore = await rating(opp), runBefore = await rating(run);
    const winner = results[i] === 0.5 ? "draw" : results[i] === 1 ? "w" : "b";
    await settle(await game(run, opp, winner));
    const expected = P.ratingAfter(r, oppBefore, results[i], i, 12); r = expected;
    if ((await rating(run)) - runBefore + ((await rating(opp)) - oppBefore) !== 0) cancel = false;
    if ((await rating(run)) !== expected || (await games(run)) !== i + 1) { ok = false; firstDetail = `game ${i + 1}: got ${await rating(run)}, expected ${expected}`; break; }
  }
  check("12 games: games 1-10 use K=64 (the runner is provisional) and games 11-12 use K=32 (both established), each rating equal to the policy, count = games played", ok, firstDetail);
  check("in every one of those games both players moved by exactly opposite amounts (zero-sum)", cancel);
  const hist = await q("select old_rating, rating_change, new_rating from rating_history where child_id = $1 order by created_at, id", [run]);
  check("rating_history chains: each row's old rating is the previous row's new rating and the delta adds up", hist.length === 12 && hist.every((h, i) => h.new_rating === h.old_rating + h.rating_change && (i === 0 || h.old_rating === hist[i - 1].new_rating)));
  check("games 11 and 12 moved at K=32 (a loss at similar strength is about -16, not -32)", Math.abs(hist[11].rating_change) <= 32 && Math.abs(hist[11].rating_change) > 0 && Math.abs(hist[10].rating_change) <= 32);

  console.log("  -- duplicate processing");
  const dupA = await mk("dupA"), dupB = await mk("dupB"), dupGame = await game(dupA, dupB, "w");
  await settle(dupGame);
  const afterOnce = [await rating(dupA), await rating(dupB), await games(dupA), await games(dupB)].join();
  await settle(dupGame); await settle(dupGame);
  check("calling it again (a retry, the other player's client, the cron) changes no rating and adds no history", [await rating(dupA), await rating(dupB), await games(dupA), await games(dupB)].join() === afterOnce);
  check("a rated game has exactly two history rows, one per player, and is flagged rated with before/after stored", (await q("select count(*)::int c from rating_history where game_id = $1", [dupGame]))[0].c === 2 && (await q("select rating_applied a, host_rating_before b, host_rating_after c, guest_rating_before d, guest_rating_after e from online_games where id = $1", [dupGame]))[0].a === true);

  console.log("  -- games that must NOT rate or count");
  const u1 = await mk("u1"), u2 = await mk("u2");
  const unrated = [
    ["an invite game", await game(u1, u2, "w", { type: "invite" })],
    ["a tournament game", await game(u1, u2, "w", { type: "tournament" })],
    ["a game that is still active", await game(u1, u2, null, { status: "active" })],
    ["a game still matched (never started)", await game(u1, u2, null, { status: "matched" })],
    ["an abandoned pre-start match (finished, no winner, already flagged)", await game(u1, u2, null, { applied: true })],
    ["a finished game with no recorded winner", await game(u1, u2, null)],
    ["a finished game with a nonsense winner value", await game(u1, u2, "x")],
  ];
  unrated.push(["a finished game with no opponent", (await q("insert into online_games (host_child_id, guest_child_id, status, winner, match_type) values ($1, null, 'finished', 'w', 'random') returning id", [u1]))[0].id]);
  for (const [, id] of unrated) await settle(id);
  check("none of those moved a rating", (await rating(u1)) === 1200 && (await rating(u2)) === 1200);
  check("none of those counted as a completed rated game (no history rows)", (await games(u1)) === 0 && (await games(u2)) === 0);
  check("the invalid ones were not flagged rated by the function (no winner, bad winner, no opponent, invite, tournament)", (await q("select count(*)::int c from online_games where id = any($1) and rating_applied = true", [unrated.filter((x) => /no recorded winner|nonsense|no opponent|invite|tournament/.test(x[0])).map((x) => x[1])]))[0].c === 0);
  await settle(await game(u1, u2, "w"));
  check("their first real rated game afterwards is still provisional (K=64): the unrated ones were not counted", (await rating(u1)) === 1232 && (await games(u1)) === 1);
  check("a game id that does not exist is a harmless no-op", !(await db.query("select apply_match_rating(gen_random_uuid())").catch((x) => x)).message);

  console.log("  -- the floor");
  const f1 = await mk("floor1", 400), f2 = await mk("floor2", 300);
  await settle(await game(f1, f2, "b"));
  check("a 400-rated favourite losing to a weaker player is floored at exactly 400, even at K=64", (await rating(f1)) === 400);
  const f3 = await mk("floor3", 405), f4 = await mk("floor4", 400);
  await settle(await game(f3, f4, "b"));
  check("a loss that would land at 372 is clamped to 400", (await rating(f3)) === 400);

  console.log("  -- permissions");
  check("authenticated can still execute it (the grant is kept)", (await q("select has_function_privilege('authenticated','public.apply_match_rating(uuid)','execute') a"))[0].a === true);
  await db.close();

  if (!HAS_OPT) { console.log("\n== E. SKIPPED (the optional 0057 file is not part of this checkout)"); finish(); return; }
  console.log("\n== E. behaviour of the optional 0057 (only never-rated children on the untouched default of 400 move to 1200)");
  db = await fresh();
  // the production picture: 8 children at 400, no history, no games in flight
  const eight = []; for (let i = 0; i < 8; i++) eight.push(await mk("p" + i, 400));
  const other = await mk("elite", 1650), at1200 = await mk("already1200", 1200);
  const earned = await mk("earned400", 400); await seedHistory(earned, 3);
  const oldRated = await mk("oldRated400", 400), oldOpp = await mk("oldOpp", 1500);
  const oldGame = await game(oldRated, oldOpp, "b", { applied: true }); await q("update online_games set host_rating_after = 400, guest_rating_after = 1510 where id = $1", [oldGame]);
  const searching = await mk("searching400", 400); await q("insert into matchmaking_queue (child_id, status, rating) values ($1, 'waiting', 400)", [searching]);
  const inMatch = await mk("inMatch400", 400), inMatchOpp = await mk("inMatchOpp", 400); await game(inMatch, inMatchOpp, null, { status: "matched" });
  const abandonedOnly = await mk("abandonedOnly400", 400), abOpp = await mk("abOpp", 400); await game(abandonedOnly, abOpp, null, { applied: true });
  const protectedIds = [earned, oldRated, searching, inMatch, inMatchOpp];
  await db.exec(mig);
  const snap0 = JSON.stringify(await q("select id, rating from children order by id"));
  e = null; try { await db.exec(opt); } catch (x) { e = x; }
  check("0057 runs cleanly as one statement", !e, e && e.message);
  const rated = async (id) => (await q("select rating from children where id = $1", [id]))[0].rating;
  let moved = 0; for (const id of eight) if ((await rated(id)) === 1200) moved++;
  check("all eight untouched-default children (400, no history, nothing in flight) are now 1200", moved === 8);
  check("a child who EARNED a 400 (has rating_history) is NOT moved", (await rated(earned)) === 400);
  check("a child with a game that was really rated (before history existed) is NOT moved", (await rated(oldRated)) === 400);
  check("a child waiting in the matchmaking queue is NOT moved", (await rated(searching)) === 400);
  check("children inside an unfinished random game are NOT moved (either side)", (await rated(inMatch)) === 400 && (await rated(inMatchOpp)) === 400);
  check("a child whose only game was an abandoned pre-start match (no rating computed) IS moved", (await rated(abandonedOnly)) === 1200 && (await rated(abOpp)) === 1200);
  check("every other child is untouched (1650, 1200, 1500)", (await rated(other)) === 1650 && (await rated(at1200)) === 1200 && (await rated(oldOpp)) === 1500);
  check("it wrote no rating_history row and changed no game", (await q("select count(*)::int c from rating_history"))[0].c === 3 && (await q("select count(*)::int c from online_games where rating_applied = true"))[0].c === 2);
  const snap1 = JSON.stringify(await q("select id, rating from children order by id"));
  e = null; try { await db.exec(opt); } catch (x) { e = x; }
  check("running it again is clean and changes nothing more", !e && JSON.stringify(await q("select id, rating from children order by id")) === snap1 && snap1 !== snap0);
  const mover = eight[0], moverOpp = await mk("moverOpp");
  await settle(await game(mover, moverOpp, "w"));
  check("a moved child is still provisional: their first rated game is K=64 (1200 -> 1232), because no history row was created", (await rated(mover)) === 1232 && (await games(mover)) === 1);
  await db.close();
  finish();
})().catch((e) => { console.log("HARNESS ERROR", e.message); process.exit(2); });

/**
 * Train Your Chess Mind — Phase 1 persistent exercise history.
 *
 * Imports the REAL app modules (selector, ids, history client, content pools,
 * generators). The database is replaced by an in-memory fake that mimics the
 * migration's semantics (per-child rows, idempotent upsert, 200-row cap); the
 * real SQL is only checked statically here — it cannot be exercised until
 * migration 0053 is approved and applied.
 *
 *   node scripts/test-train-your-mind-history.js
 */
const fs = require("fs");
const path = require("path");
const ts = require(path.join(process.cwd(), "node_modules", "typescript"));
const Module = require("module");

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request.startsWith("@/")) request = path.join(process.cwd(), request.slice(2));
  return origResolve.call(this, request, ...rest);
};
require.extensions[".ts"] = function (mod, filename) {
  const js = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  }).outputText;
  mod._compile(js, filename);
};
const R = (p) => require(path.join(process.cwd(), p));
const read = (p) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

const sel = R("lib/trainYourMind/exerciseSelection.ts");
const ids = R("lib/trainYourMind/exerciseIds.ts");
const hist = R("lib/trainYourMind/exerciseHistory.ts");
const cfg = R("lib/trainYourMind/historyConfig.ts");
const { PATTERN_CHALLENGES } = R("content/chessMindPatterns.ts");
const calc = R("content/chessMindCalculation.ts");
const engine = R("lib/trainYourMind/engine/pool.ts");
const POOL_INDEX = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/trainYourMind/pool-index.json"), "utf8"));
const LIB = new Map(
  ["data/puzzles/tactics-library.json", "data/puzzles/tactics-library-train.json"]
    .filter((f) => fs.existsSync(path.join(process.cwd(), f)))
    .flatMap((f) => JSON.parse(fs.readFileSync(path.join(process.cwd(), f), "utf8")))
    .map((p) => [p.id, p])
);

let pass = 0;
const failures = [];
function check(name, ok, detail) {
  if (ok) pass++;
  else {
    failures.push(name + (detail ? " -- " + detail : ""));
    console.log("FAIL:", name, detail || "");
  }
}

// Deterministic RNG so the tests are reproducible.
function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- In-memory fake of the table + RPC (per-child rows, shared by all devices).
function makeFakeDb() {
  const rows = new Map(); // `${child}|${module}|${exercise}` -> {…}
  let clock = 1_000_000_000_000;
  const db = {
    rows,
    tick: (ms) => { clock += ms; },
    now: () => clock,
    failReads: false,
    failWrites: false,
    client() {
      return {
        from() {
          const q = { filters: {}, lim: 1000 };
          const api = {
            select() { return api; },
            eq(k, v) { q.filters[k] = v; return api; },
            order() { return api; },
            limit(n) {
              q.lim = n;
              if (db.failReads) return Promise.resolve({ data: null, error: { message: "boom" } });
              const data = [...rows.values()]
                .filter((r) => r.child_id === q.filters.child_id && r.module_id === q.filters.module_id)
                .sort((a, b) => b.last_seen_at - a.last_seen_at)
                .slice(0, q.lim)
                .map((r) => ({ exercise_id: r.exercise_id, last_seen_at: new Date(r.last_seen_at).toISOString() }));
              return Promise.resolve({ data, error: null });
            },
          };
          return api;
        },
        rpc(name, a) {
          if (db.failWrites) return Promise.reject(new Error("offline"));
          if (name !== "record_train_your_mind_exercise_seen") return Promise.resolve({ error: { message: "unknown" } });
          const key = `${a.p_child_id}|${a.p_module_id}|${a.p_exercise_id}`;
          const cur = rows.get(key);
          clock += 1;
          if (cur) { cur.last_seen_at = clock; cur.times_seen++; }
          else rows.set(key, { child_id: a.p_child_id, module_id: a.p_module_id, exercise_id: a.p_exercise_id, last_seen_at: clock, times_seen: 1 });
          return Promise.resolve({ error: null });
        },
      };
    },
  };
  return db;
}

// A simulated "device": a fresh page session that loads history, picks, records.
async function pagePick(db, child, module, candidates, getId, rng, avoid) {
  const history = await hist.loadExerciseHistory(db.client(), child, module);
  const pick = sel.selectExercise(candidates, getId, history, { rng, now: db.now() + 1, avoidIds: avoid ? [avoid] : [] });
  await hist.recordExerciseSeen(db.client(), child, module, getId(pick.item));
  return pick;
}

(async () => {
  const rng = mulberry(42);
  const patId = (c) => ids.staticExerciseId(c.id);

  // 1. Stable ids.
  check("static ids are deterministic and prefixed", ids.staticExerciseId("p1") === ids.staticExerciseId("p1") && ids.staticExerciseId("p1") === "s:p1");
  const fenA = PATTERN_CHALLENGES[0].fen;
  const id1 = ids.generatedExerciseId("viz", fenA, "Which square?");
  check("generated ids are deterministic across calls", id1 === ids.generatedExerciseId("viz", fenA, "Which square?"));
  check("generated ids differ by fen, by prompt, and by kind",
    id1 !== ids.generatedExerciseId("viz", PATTERN_CHALLENGES[1].fen, "Which square?") &&
    id1 !== ids.generatedExerciseId("viz", fenA, "Other prompt") &&
    id1 !== ids.generatedExerciseId("mem", fenA, "Which square?"));
  check("library puzzle ids are namespaced", ids.libraryPuzzleExerciseId("abc") === "p:abc");
  check("ids fit the DB 200-char constraint", id1.length < 200 && ids.libraryPuzzleExerciseId("x".repeat(100)).length < 200);

  // Real content has unique authored ids (otherwise history would conflate exercises).
  check("pattern ids are unique", new Set(PATTERN_CHALLENGES.map((c) => c.id)).size === PATTERN_CHALLENGES.length);
  const allCalc = calc.CALCULATION_CHALLENGES;
  check("calculation ids are unique", new Set(allCalc.map((c) => c.id)).size === allCalc.length);

  // 2. Window: only the newest N recent entries count, and old ones age out.
  const now = 5_000_000_000_000;
  const mk = (n, ageMs) => Array.from({ length: n }, (_, i) => ({ exerciseId: "e" + i, lastSeenAt: now - ageMs - i }));
  check("recent window is capped at RECENT_WINDOW_COUNT", sel.recentIdSet(mk(100, 1000), { now }).size === cfg.RECENT_WINDOW_COUNT);
  check("entries older than the max age are forgotten", sel.recentIdSet(mk(5, cfg.RECENT_MAX_AGE_MS + 10_000), { now }).size === 0);

  // 3. Selection avoids recent items when alternatives exist.
  const pool = Array.from({ length: 10 }, (_, i) => ({ id: "x" + i }));
  const seen9 = pool.slice(0, 9).map((c, i) => ({ exerciseId: c.id, lastSeenAt: now - 1000 - i }));
  let allUnseen = true;
  for (let i = 0; i < 200; i++) {
    const r = sel.selectExercise(pool, (c) => c.id, seen9, { now, rng });
    if (r.item.id !== "x9" || r.reason !== "unseen") allUnseen = false;
  }
  check("only the unseen candidate is chosen while one exists", allUnseen);

  // 4. Small-pool fallback: everything recent -> least recently seen, never throws / empty.
  const lru = sel.selectExercise(pool, (c) => c.id, pool.map((c, i) => ({ exerciseId: c.id, lastSeenAt: now - 1000 * (i + 1) })), { now, rng });
  check("exhausted pool falls back to the least-recently-seen", lru.item.id === "x9" && lru.reason === "least-recent");
  const one = sel.selectExercise([{ id: "solo" }], (c) => c.id, [{ exerciseId: "solo", lastSeenAt: now }], { now, avoidIds: ["solo"], rng });
  check("single-item pool still returns that item (no empty/crash)", one && one.item.id === "solo");
  check("empty pool returns null rather than throwing", sel.selectExercise([], (c) => c, [], { now }) === null);
  const avoidCur = sel.selectExercise(pool, (c) => c.id, pool.map((c) => ({ exerciseId: c.id, lastSeenAt: now - 10 })), { now, rng, avoidIds: ["x3"] });
  check("fallback still avoids the on-screen exercise when another exists", avoidCur.item.id !== "x3");

  // 5. ACCEPTANCE: same child, Device A then fresh Device B — B must not repeat A.
  {
    const db = makeFakeDb();
    const child = "child-1";
    let violations = 0;
    for (let trial = 0; trial < 300; trial++) {
      const a = await pagePick(db, child, "pattern", PATTERN_CHALLENGES, patId, rng);
      db.tick(5000);
      const b = await pagePick(db, child, "pattern", PATTERN_CHALLENGES, patId, rng); // brand-new "page", no shared memory but the DB
      db.tick(5000);
      if (patId(a.item) === patId(b.item)) violations++;
    }
    check("ACCEPTANCE: Device B never repeats Device A's exercise for the same child (300 trials)", violations === 0, "violations=" + violations);
  }

  // 6. Same acceptance across a long run: no repeat within the recent window while pool > window.
  {
    const db = makeFakeDb();
    const lib = Array.from({ length: 80 }, (_, i) => ({ id: "L" + i }));
    const lastN = [];
    let bad = 0;
    for (let i = 0; i < 400; i++) {
      const pick = await pagePick(db, "child-w", "reaction", lib, (c) => "p:" + c.id, rng);
      const id = pick.item.id;
      if (lastN.includes(id)) bad++;
      lastN.push(id);
      if (lastN.length > cfg.RECENT_WINDOW_COUNT) lastN.shift();
      db.tick(1000);
    }
    check("no exercise repeats within the recent window across 400 fresh-page picks", bad === 0, "repeats=" + bad);
  }

  // 7. Siblings are isolated: child 2's history does not affect child 1, and vice versa.
  {
    const db = makeFakeDb();
    for (const c of pool) { await hist.recordExerciseSeen(db.client(), "sib-1", "pattern", c.id); db.tick(10); }
    const h1 = await hist.loadExerciseHistory(db.client(), "sib-1", "pattern");
    const h2 = await hist.loadExerciseHistory(db.client(), "sib-2", "pattern");
    check("a sibling's history is not visible to another child", h1.length === 10 && h2.length === 0);
    const hOther = await hist.loadExerciseHistory(db.client(), "sib-1", "memory");
    check("history is scoped per module", hOther.length === 0);
  }

  // 8. Duplicate / repeated recording is idempotent (one row, recency moves forward).
  {
    const db = makeFakeDb();
    await hist.recordExerciseSeen(db.client(), "c", "pattern", "s:a");
    const first = (await hist.loadExerciseHistory(db.client(), "c", "pattern"))[0].lastSeenAt;
    db.tick(1000);
    await hist.recordExerciseSeen(db.client(), "c", "pattern", "s:a");
    const rows = await hist.loadExerciseHistory(db.client(), "c", "pattern");
    check("recording the same exercise twice keeps a single row and refreshes recency", rows.length === 1 && rows[0].lastSeenAt > first);
  }

  // 9. Fail-open: read errors -> empty history (selection still works); write errors never throw.
  {
    const db = makeFakeDb();
    db.failReads = true; db.failWrites = true;
    const h = await hist.loadExerciseHistory(db.client(), "c", "pattern");
    let threw = false;
    try { await hist.recordExerciseSeen(db.client(), "c", "pattern", "s:a"); } catch { threw = true; }
    const r = sel.selectExercise(PATTERN_CHALLENGES, patId, h, { rng });
    check("history read failure fails open to an empty history", Array.isArray(h) && h.length === 0);
    check("history write failure never throws into the drill", !threw);
    check("selection still works with no history", !!r && r.reason === "unseen");
  }

  // 10. Generated drills: real generators + real selection avoid recent exercises, small pools fall back.
  {
    const db = makeFakeDb();
    let repeats = 0;
    const recent = [];
    for (let i = 0; i < 150; i++) {
      const history = await hist.loadExerciseHistory(db.client(), "g", "visualization");
      const picked = engine.pickExercise(POOL_INDEX, LIB, { category: "visualization", level: 2, history, rng, now: db.now() + 1 });
      if (recent.includes(picked.exercise.id)) repeats++;
      recent.push(picked.exercise.id); if (recent.length > cfg.RECENT_WINDOW_COUNT) recent.shift();
      await hist.recordExerciseSeen(db.client(), "g", "visualization", picked.exercise.id);
      db.tick(1000);
    }
    check("engine drill (visualization) never repeats within the window over 150 picks", repeats === 0, "repeats=" + repeats);

    const tiny = () => ({ id: "g:tiny:" + Math.floor(rng() * 3) });
    const exhausted = [{ exerciseId: "g:tiny:0", lastSeenAt: now - 300 }, { exerciseId: "g:tiny:1", lastSeenAt: now - 100 }, { exerciseId: "g:tiny:2", lastSeenAt: now - 200 }];
    const pk = sel.selectGenerated(tiny, (r) => r.id, exhausted, 40, { rng, now });
    check("generated drill with a tiny pool falls back to least-recent (no fake exercise invented)", pk.reason === "least-recent" && pk.item.id === "g:tiny:0");
    check("selectGenerated skips null generations and returns null if none", sel.selectGenerated(() => null, (r) => r, [], 10) === null);
  }

  // 11. Static wiring. Since the curriculum redesign every drill is a thin wrapper around
  // the shared TrainDrill; the server picks the exercise using the child's history and the
  // client records an exercise as seen only when it is actually shown.
  const pages = {
    pattern: "app/chess-mind/pattern/page.tsx",
    visualization: "app/chess-mind/visualization/page.tsx",
    memory: "app/chess-mind/memory/page.tsx",
    spatial: "app/chess-mind/spatial/page.tsx",
    mathematics: "app/chess-mind/mathematics/page.tsx",
    calculation: "app/chess-mind/calculation/page.tsx",
  };
  for (const [mod, file] of Object.entries(pages)) {
    const src = read(file);
    check(`${mod}: page renders the shared TrainDrill for its own module id`, src.includes("<TrainDrill") && src.includes(`category="${mod}"`));
    check(`${mod}: no unrestricted client-side Math.random pick remains`, !/Math\.random/.test(src));
  }
  const drill = read("components/trainYourMind/TrainDrill.tsx");
  check("TrainDrill records history when an exercise is PRESENTED (not when prefetched)", /const present = useCallback/.test(drill) && /recordExerciseSeen\(createClient\(\), child\.childId, category, ex\.id\)/.test(drill) && !/prefetched\.current = [^;]*recordExerciseSeen/.test(drill));
  check("TrainDrill passes the on-screen/seen ids so Next never repeats the current exercise", /exclude: seen\.current\.slice\(-40\)\.join\(","\)/.test(drill));
  check("TrainDrill keeps the daily-limit wiring (completion recorded through the shared hook)", /dailyLimit\.recordCompletion\(key/.test(drill) && /useTrainYourMindDailyLimit\(child\.childId, category\)/.test(drill));
  const trainRoute = read("app/api/chess-mind/train/route.ts");
  check("train route reads the CHILD's history server-side", /loadExerciseHistory\(supabase, resolution\.child\.id, category\)/.test(trainRoute));
  const trainer = read("components/chessMind/ReactionTrainer.tsx");
  check("reaction: records at present() (shown), not at prefetch", /const present = useCallback/.test(trainer) && /recordExerciseSeen\(createClient\(\), child\.childId, "reaction", next\.id\)/.test(trainer));
  check("reaction: a prefetched exercise is held in a ref and NOT recorded until presented", /prefetched\.current = resp\?\.exercise/.test(trainer) && !trainer.split("\n").some((l) => l.includes("prefetched.current") && l.includes("recordExerciseSeen")));
  const route = read("app/api/chess-mind/reaction/route.ts");
  check("legacy reaction route still reads the CHILD's history server-side and excludes it", /loadExerciseHistory\(supabase, resolution\.child\.id, "reaction"\)/.test(route) && /exclude\.add\(id\.slice\(2\)\)/.test(route));
  check("reaction route keeps the existing tier/streak logic", /tierForStreak/.test(route) && /selectTacticsPuzzle\(\{ skill: null, tier, exclude \}\)/.test(route));

  // 12. Scope: nothing in the excluded areas references the history.
  const scopeOut = ["app/academy", "app/chess-school", "lib/entitlement/dailyLimits.ts", "lib/trainYourMind/dailyUsage.ts", "lib/trainYourMind/useDailyLimit.ts", "content/chessMindCategories.ts"];
  const touches = (p) => {
    const full = path.join(process.cwd(), p);
    if (!fs.existsSync(full)) return false;
    const files = fs.statSync(full).isDirectory()
      ? fs.readdirSync(full, { recursive: true }).filter((f) => /\.(ts|tsx)$/.test(f)).map((f) => path.join(full, f))
      : [full];
    return files.some((f) => /exerciseHistory|exerciseSelection|useExerciseHistory/.test(fs.readFileSync(f, "utf8")));
  };
  check("Tactical Thinking/Academy, Chess School, daily cap and entitlement code do not use the history", scopeOut.every((p) => !touches(p)));
  check("daily limit constant is 3 per category per day", /trainYourMindPerCategory:\s*3/.test(read("lib/entitlement/dailyLimits.ts")));

  // 13. Migration static assertions.
  const sql = read("supabase/migrations/0053_train_your_mind_exercise_history.sql");
  check("migration: primary key is (child_id, module_id, exercise_id)", /primary key \(child_id, module_id, exercise_id\)/.test(sql));
  check("migration: child FK cascades on delete", /references public\.children\(id\) on delete cascade/.test(sql));
  check("migration: RLS enabled, select-only policy, client writes revoked", /enable row level security/.test(sql) && !/for (insert|update|delete|all)\b/i.test(sql) && /revoke insert, update, delete on public\.child_train_your_mind_exercise_history from authenticated/.test(sql));
  check("migration: RPC re-verifies ownership from auth.uid()", /p\.auth_user_id = auth\.uid\(\)/.test(sql) && /raise exception 'not authorized for this child'/.test(sql));
  check("migration: RPC is SECURITY DEFINER with pinned search_path and granted to authenticated only", /security definer set search_path = public/.test(sql) && /revoke all on function public\.record_train_your_mind_exercise_seen\(uuid, text, text\) from public, anon/.test(sql) && /grant execute on function public\.record_train_your_mind_exercise_seen\(uuid, text, text\) to authenticated/.test(sql));
  check("migration: idempotent upsert", /on conflict \(child_id, module_id, exercise_id\) do update/.test(sql));
  check("migration: bounded growth (200 rows)", /offset 200/.test(sql) && cfg.HISTORY_FETCH_LIMIT <= 200);
  check("migration: purely additive (no alter/drop of existing objects, rollback only in comments)", !/^\s*drop /im.test(sql.replace(/^--.*$/gm, "")) && [...sql.replace(/^--.*$/gm, "").matchAll(/alter table ([\w.]+)/gi)].every((m) => m[1] === "public.child_train_your_mind_exercise_history"));
  check("migration: does not touch the daily-usage table or RPC", !/child_train_your_mind_activity|record_train_your_mind_use/.test(sql.replace(/^--.*$/gm, "")));
  check("migration number follows the sequence (0053 after 0052)", fs.existsSync(path.join(process.cwd(), "supabase/migrations/0052_matchmaking_queue_game_fk_cascade.sql")));

  console.log(`\n${pass} checks passed, ${failures.length} failed`);
  if (failures.length) { console.log(failures.map((f) => " - " + f).join("\n")); process.exit(1); }
})();

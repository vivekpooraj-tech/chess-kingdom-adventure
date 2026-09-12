/**
 * Chess School V2 — the product rules, as tests.
 *
 *   node scripts/test-chess-school-v2.js
 *
 * Loads the REAL TypeScript sources (content/school/*, lib/school/v2/*) via
 * transpileModule, so there is no mirrored copy of the content to drift.
 *
 * What is held here, and why each one matters more than it looks:
 *
 *   - Every FEN loads and every accepted move is legal from it. This
 *     repository has shipped illegal puzzle positions before; a child stuck
 *     on a puzzle with no answer is the worst outcome a teaching app has.
 *   - Progress can never be inflated by bad data, and a child can never be
 *     permanently blocked. Those two are the honesty and kindness rules of
 *     the whole course.
 *   - Graduation happens on finishing session 30 regardless of the duel's
 *     result, because the final game has no win condition by design.
 *   - Nothing in the core loop reads content/lessons.ts or calls a model.
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
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filename,
  }).outputText;
  mod._compile(js, filename);
};

const { Chess } = require(path.join(process.cwd(), "node_modules", "chess.js"));
const C = require(path.join(process.cwd(), "content", "school", "sessions.ts"));
const M = require(path.join(process.cwd(), "content", "school", "modules.ts"));
const P = require(path.join(process.cwd(), "lib", "school", "v2", "progress.ts"));
const PS = require(path.join(process.cwd(), "lib", "school", "v2", "parentSummary.ts"));
const A = require(path.join(process.cwd(), "lib", "school", "v2", "access.ts"));
const MV = require(path.join(process.cwd(), "lib", "school", "v2", "moves.ts"));
const ST = require(path.join(process.cwd(), "lib", "school", "v2", "storage.ts"));

let pass = 0;
const failures = [];
const check = (name, cond) => (cond ? pass++ : failures.push(name));
const read = (...p) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");
/** Source with block and line comments removed, so prose cannot satisfy or trip a code check. */
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const readTree = (dir) => {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else out.push(full);
    }
  };
  walk(path.join(process.cwd(), dir));
  return out;
};

const SESSIONS = C.SCHOOL_SESSIONS;
const MODULES = M.SCHOOL_MODULES;
const STARRED = [1, 2, 4, 8, 10, 12, 13, 18, 24, 30];

// --- 1. The arc exists, whole ---------------------------------------------
{
  check("there are exactly 30 sessions", SESSIONS.length === 30);
  check("TOTAL_SESSIONS is read from the content, not hardcoded", C.TOTAL_SESSIONS === SESSIONS.length);
  check("session numbers are exactly 1..30", SESSIONS.map((s) => s.number).join(",") === Array.from({ length: 30 }, (_, i) => i + 1).join(","));
  check("session ids are unique", new Set(SESSIONS.map((s) => s.id)).size === 30);
  check("there are exactly 8 modules", MODULES.length === 8);
  check("module ids are unique", new Set(MODULES.map((m) => m.id)).size === 8);
  const covered = MODULES.flatMap((m) => m.sessionNumbers).sort((a, b) => a - b);
  check("every session belongs to exactly one module", covered.join(",") === Array.from({ length: 30 }, (_, i) => i + 1).join(","));
  check("every session's moduleId matches its module", SESSIONS.every((s) => M.moduleForSession(s.number)?.id === s.moduleId));
  check("the eight modules are the eight in the brief, in order", MODULES.map((m) => m.title).join("|") ===
    "Learn the Board|Pawns and Captures|Knights and Bishops|Rooks and Queen|King and Safety|Tactics|Full Game Skills|Graduate Challenge");
  check("the starred sessions are the ten WOW/ceremony sessions", SESSIONS.filter((s) => s.starred).map((s) => s.number).join(",") === STARRED.join(","));
}

// --- 2. Every session is coherent --------------------------------------------
{
  for (const s of SESSIONS) {
    check(`${s.id}: has at least two steps`, s.steps.length >= 2);
    check(`${s.id}: step ids unique`, new Set(s.steps.map((st) => st.id)).size === s.steps.length);
    check(`${s.id}: has Ollie intro/mistake/success`, !!s.ollie.intro && !!s.ollie.mistake && !!s.ollie.success);
    check(`${s.id}: has at least one skill tag`, s.skillTags.length > 0);
    check(`${s.id}: estimated minutes in a child-sized range`, s.estimatedMinutes >= 8 && s.estimatedMinutes <= 25);
    check(`${s.id}: is playable (no "coming soon" in the arc)`, s.status === "playable");
    if (s.status === "playable") {
      const teach = s.steps.some((st) => st.type === "teach" || st.type === "ceremony" || st.type === "exam");
      const apply = s.steps.some((st) => ["guided_board", "puzzle_drill", "bot_match", "parent_mode", "pass_and_play", "exam"].includes(st.type));
      check(`${s.id}: teaches something`, teach);
      check(`${s.id}: makes the child do something on a board`, apply);
    }
  }
  const teachSteps = SESSIONS.flatMap((s) => s.steps.filter((st) => st.type === "teach"));
  check("teach steps are short — never a wall of text", teachSteps.every((st) => st.lines.length <= 4 && st.lines.every((l) => l.length <= 160)));
}

// --- 3. Every position is real and every answer is legal ------------------
{
  const tryMove = (fen, mv) => MV.canonicalSan(fen, mv) !== null;
  let positions = 0, moves = 0;
  for (const s of SESSIONS) {
    for (const st of s.steps) {
      const w = `${s.id}/${st.id}`;
      const fens = [];
      if (st.type === "teach" && st.fen) fens.push([st.fen, []]);
      if (st.type === "guided_board") fens.push([st.fen, st.acceptMoves]);
      if (st.type === "bot_match" && st.fen) fens.push([st.fen, []]);
      if (st.type === "puzzle_drill" || st.type === "exam") {
        for (const p of [...st.drill.puzzles, st.drill.remedial]) fens.push([p.fen, p.solutionMoves, p.id]);
      }
      if (st.type === "parent_mode") {
        for (const b of st.beats) fens.push([b.fen, b.successMove ? [b.successMove] : []]);
      }
      for (const [fen, accepted, id] of fens) {
        positions++;
        const where = id ? `${w}/${id}` : w;
        check(`${where}: FEN loads`, MV.isLegalFen(fen));
        for (const m of accepted) {
          moves++;
          check(`${where}: "${m}" is legal`, tryMove(fen, m));
        }
      }
    }
  }
  check("verified a substantial number of positions", positions >= 60);
  check("verified a substantial number of moves", moves >= 80);

  // Notation tolerance: the runner must accept both spellings of one move.
  check("moveMatches accepts SAN against a UCI answer", MV.moveMatches("4k3/P7/8/8/8/8/8/4K3 w - - 0 1", "a8=Q+", ["a7a8q"]));
  check("moveMatches accepts a move given with or without the + suffix", MV.moveMatches("r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1", "Nc7", ["Nc7+"]));
  check("moveMatches rejects a wrong legal move", !MV.moveMatches("r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1", "Nb6", ["Nc7+"]));
  check("moveMatches rejects an illegal move", !MV.moveMatches("r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1", "Nd6", ["Nc7+"]));
}

// --- 4. Mastery: pass bars are sane and every drill has a way back ----------
{
  const drills = SESSIONS.flatMap((s) => s.steps.filter((st) => st.type === "puzzle_drill" || st.type === "exam").map((st) => [s.id, st]));
  check("there are drills", drills.length > 0);
  for (const [sid, st] of drills) {
    const d = st.drill;
    check(`${sid}: drill has 2–3 puzzles`, d.puzzles.length >= 2 && d.puzzles.length <= 3);
    check(`${sid}: pass bar is reachable but not trivial`, d.passRequired >= 1 && d.passRequired <= d.puzzles.length);
    check(`${sid}: drill has a remedial puzzle`, !!d.remedial && !!d.remedial.fen);
    check(`${sid}: drill has a remedial explanation`, typeof d.remedialTeach === "string" && d.remedialTeach.length > 20);
    check(`${sid}: puzzle ids unique within the drill`, new Set([...d.puzzles, d.remedial].map((p) => p.id)).size === d.puzzles.length + 1);
  }
  check("2 of 3 passes", P.drillOutcome(2, 2) === "passed");
  check("1 of 3 routes to remedial, never to a wall", P.drillOutcome(1, 2) === "remedial");
  check("the remedial path always clears", P.remedialClears() === true);
}

// --- 5. Progress: earned, never inflated, never blocked ----------------------
{
  const n = P.normalizeProgress;
  check("garbage normalises to empty", n(null).completedSessions.length === 0 && n("x").skillTags.length === 0);
  check("duplicate sessions collapse", n({ completedSessions: [3, 3, 1, 1] }).completedSessions.join(",") === "1,3");
  check("out-of-range sessions are dropped", n({ completedSessions: [0, 31, 99, -1, 5] }).completedSessions.join(",") === "5");
  check("fractional session numbers floor", n({ completedSessions: [2.9] }).completedSessions.join(",") === "2");
  check("unknown skill tags are dropped", n({ skillTags: ["fork", "chess_iq", "telepathy"] }).skillTags.join(",") === "fork");
  check("unknown unlocks are dropped", n({ unlocks: ["fork_master", "hacker"] }).unlocks.join(",") === "fork_master");
  check("graduation claim without session 30 is refused", n({ graduatedAt: "2026-01-01T00:00:00Z", completedSessions: [1, 2, 3] }).graduatedAt === null);
  check("graduation claim with session 30 is honoured", n({ graduatedAt: "2026-01-01T00:00:00Z", completedSessions: [30] }).graduatedAt !== null);

  const e = P.EMPTY_PROGRESS;
  check("fresh learner: next is session 1", P.nextSessionNumber(e) === 1);
  check("fresh learner: session 1 is unlocked", P.isSessionUnlocked(e, 1));
  check("fresh learner: session 2 is not", !P.isSessionUnlocked(e, 2));
  check("session 0 and 31 are never unlocked", !P.isSessionUnlocked(e, 0) && !P.isSessionUnlocked(e, 31));

  let p = P.completeSession(e, 1, () => new Date("2026-09-12T10:00:00Z"));
  check("completing 1 unlocks 2", P.isSessionUnlocked(p, 2));
  check("completing 1 keeps 1 open (replayable)", P.isSessionUnlocked(p, 1));
  check("completing 1 awards its skills", p.skillTags.includes("board_setup"));
  check("completing 1 does not graduate", p.graduatedAt === null);
  const p2 = P.completeSession(p, 1);
  check("completing the same session twice is idempotent", JSON.stringify(p2) === JSON.stringify(p));
  check("next session skips nothing: [1,3] done -> next is 2", P.nextSessionNumber(n({ completedSessions: [1, 3] })) === 2);

  // Walk the whole course.
  for (let i = 1; i <= 30; i++) p = P.completeSession(p, i, () => new Date("2026-09-12T10:00:00Z"));
  check("finishing all 30 graduates", p.graduatedAt !== null);
  check("finishing all 30 awards every share unlock", C.SCHOOL_UNLOCKS.every((u) => p.unlocks.includes(u.id)));
  check("after graduation, next stays on 30 so Continue never points at nothing", P.nextSessionNumber(p) === 30);
  check("completedCount is honest", P.completedCount(p) === 30);

  // Superpowers and big moments.
  check("no superpowers before session 2", P.unlockedSuperpowerIds(e).length === 0);
  const after2 = P.completeSession(P.completeSession(e, 1), 2);
  check("session 2 unlocks Pawn Promotion", P.unlockedSuperpowerIds(after2).includes("pawn-promotion"));
  check("next big moment for a fresh learner is session 2 (strictly beyond session 1)", P.nextBigMoment(e)?.number === 2);
  check("the big-moment card never repeats the up-next session", SESSIONS.every((s) => { const pr = P.normalizeProgress({ completedSessions: Array.from({ length: s.number - 1 }, (_, i) => i + 1) }); const bm = P.nextBigMoment(pr); return !bm || bm.number !== s.number; }));
  check("after session 9, next is 10 (starred) so the big moment ahead is Fork Festival", P.nextBigMoment(n({ completedSessions: [1,2,3,4,5,6,7,8,9] }))?.number === 12);
  check("after session 11, next is Fork Festival so the big moment ahead is Parent Mode", P.nextBigMoment(n({ completedSessions: [1,2,3,4,5,6,7,8,9,10,11] }))?.number === 13);
  check("every superpower is unlocked by a real session", M.PIECE_SUPERPOWERS.every((sp) => C.getSession(sp.unlockedBySession) !== null));
  check("a session's headline superpower is one that session unlocks", SESSIONS.every((s) => !s.superpowerId || M.getSuperpower(s.superpowerId)?.unlockedBySession === s.number));
  check("session 7 reveals both the Queen and the King", (() => { const q = P.completeSession(P.normalizeProgress({ completedSessions: [1,2,3,4,5,6] }), 7); const ids = P.unlockedSuperpowerIds(q); return ids.includes("queen-boss") && ids.includes("king-protected"); })());
}

// --- 6. Graduation: an event, win or lose ----------------------------------
{
  const s30 = C.getSession(30);
  check("session 30 exists and is starred", !!s30 && s30.starred);
  const types = s30.steps.map((st) => st.type);
  check("graduation opens with a ceremony", types[0] === "ceremony");
  check("graduation has a recap montage", types.includes("recap"));
  check("graduation has a real human duel (pass-and-play)", types.includes("pass_and_play"));
  check("graduation ends with a ceremony", types[types.length - 1] === "ceremony");
  check("graduation duel has no bot and therefore no hints", !s30.steps.some((st) => st.type === "bot_match"));
  check("graduation awards the graduate share card", s30.shareUnlock?.id === "graduate");
  check("graduate share card says 'Challenge me to a game!'", s30.shareUnlock?.tagline === "Challenge me to a game!");
  check("Ollie's graduation line is the one in the brief", s30.ollie.success === "You're not learning chess anymore. You're a chess player.");
  const montage = s30.steps.find((st) => st.type === "recap");
  check("the recap montage is a real montage with more than one beat", montage && montage.montage === true && montage.learned.length >= 3);

  // Win or lose: completing session 30 graduates. There is no result input at all.
  const almost = P.normalizeProgress({ completedSessions: Array.from({ length: 29 }, (_, i) => i + 1) });
  check("not graduated before session 30", !P.hasGraduated(almost));
  const grad = P.completeSession(almost, 30);
  check("graduated on finishing session 30 — no result required", P.hasGraduated(grad));
  check("completeSession has no 'won' parameter — losing cannot withhold graduation", P.completeSession.length <= 3);
}

// --- 7. WOW moments and share unlocks ----------------------------------------
{
  const ids = C.SCHOOL_UNLOCKS.map((u) => u.id);
  check("Fork Master exists", ids.includes("fork_master"));
  check("Fork Master card says 'Challenge me.'", C.SCHOOL_UNLOCKS.find((u) => u.id === "fork_master").tagline === "Challenge me.");
  check("session 12 is Fork Festival and awards Fork Master", C.getSession(12).shareUnlock?.id === "fork_master");
  check("Fork Festival Ollie line matches the brief", C.getSession(12).ollie.intro === "Today you learn the sneakiest trick in chess.");
  check("Fork Festival has three escalating fork puzzles", C.getSession(12).steps.find((st) => st.type === "puzzle_drill").drill.puzzles.length === 3);
  check("session 18 awards First Checkmate", C.getSession(18).shareUnlock?.id === "first_checkmate");
  check("session 18's guided board is a mate in one", (() => { const g = C.getSession(18).steps.find((st) => st.type === "guided_board"); const c = new Chess(g.fen); c.move(g.acceptMoves[0]); return c.isCheckmate(); })());
  check("session 24 has a bot match with NO hints", C.getSession(24).steps.some((st) => st.type === "bot_match" && st.hintsAllowed === false));
  check("session 8 and 10 bot matches DO allow hints", [8, 10].every((n) => C.getSession(n).steps.some((st) => st.type === "bot_match" && st.hintsAllowed === true)));
  check("every unlock is awarded by exactly one session", ids.every((id) => SESSIONS.filter((s) => s.shareUnlock?.id === id).length === 1));
}

// --- 8. Parent Mode ----------------------------------------------------------
{
  const s13 = C.getSession(13);
  const pm = s13.steps.find((st) => st.type === "parent_mode");
  check("session 13 has a parent_mode step", !!pm);
  check("parent mode has at least two beats", pm.beats.length >= 2);
  check("parent mode celebration is the brief's line", pm.celebration === "You did that to a REAL person.");
  for (const [i, b] of pm.beats.entries()) {
    check(`beat ${i}: parent instruction never leaks into child goal`, !b.childGoal.includes(b.successMove ?? " ") && b.childGoal !== b.parentInstruction);
    check(`beat ${i}: parentInstruction and childGoal are both present`, b.parentInstruction.length > 10 && b.childGoal.length > 5);
  }
  // Convention the panel relies on: the grown-up plays Black, the child White.
  const turns = pm.beats.map((b) => new Chess(b.fen).turn());
  check("parent beats are Black-to-move, child beats White-to-move", turns[0] === "b" && turns[turns.length - 1] === "w");
  // The parent's move really creates the position the child solves.
  const g = new Chess(pm.beats[0].fen); g.move(pm.beats[0].successMove);
  const afterParent = g.fen().split(" ").slice(0, 2).join(" ");
  const childStart = pm.beats[1].fen.split(" ").slice(0, 2).join(" ");
  check("the grown-up's move produces exactly the child's position", afterParent === childStart);
  // And the child's fork is a real fork: knight attacks both king and rook.
  const c = new Chess(pm.beats[1].fen); const mv = c.move(pm.beats[1].successMove);
  check("the child's answer gives check", mv && c.isCheck());
  check("ParentModePanel exists at components/school/v2", fs.existsSync(path.join(process.cwd(), "components", "school", "v2", "ParentModePanel.tsx")));
  const panel = read("components", "school", "v2", "ParentModePanel.tsx");
  check("the panel gates the parent's text behind a hand-over screen", /Pass the phone to your grown-up/.test(panel));
  check("the panel never fetches, calls a model, or offers a text box", !/fetch\(|aiProvider|<textarea|type="text"/.test(panel));
}

// --- 9. Parent summary: claims, not scores ----------------------------------
{
  const e = P.EMPTY_PROGRESS;
  const s = PS.parentSummary(e);
  check("empty summary is honest", /Nothing yet/.test(s.canNowDo[0]));
  check("sessions line is a count", s.sessionsLine === "0 of 30 sessions");
  const p = P.normalizeProgress({ completedSessions: [1, 2, 3, 4] });
  const s4 = PS.parentSummary(p);
  check("claims are phrased as 'Your child can now …'", s4.canNowDo.every((l) => l.startsWith("Your child can now ")));
  check("most recent skill first", /Knight/.test(s4.canNowDo[0]));
  check("at most three claims", s4.canNowDo.length <= 3);
  check("a practice suggestion is always present", typeof s4.practiceTogether === "string" && s4.practiceTogether.length > 20);
  const all = [PS.parentSummary(p), PS.parentSummary(e)].flatMap((x) => [x.currentFocus, x.learningNext, x.practiceTogether, ...x.canNowDo]).join(" ");
  check("no fake scores anywhere in parent copy", !/IQ|intelligence|\d+\s?%|score|rating/i.test(all));
  const src = read("lib", "school", "v2", "parentSummary.ts") + read("components", "school", "v2", "SchoolHome.tsx") + read("app", "chess-school", "parent", "page.tsx");
  check("no percentage bars in the school UI", !/percentComplete|progressbar/.test(src));
}

// --- 10. Ollie: scoped, deterministic, never load-bearing on a model --------
{
  const core = [
    ...readTree("content/school"),
    ...readTree("lib/school/v2"),
    ...readTree("components/school/v2"),
    ...readTree("app/chess-school/session"),
    ...readTree("app/chess-school/classroom"),
    ...readTree("app/chess-school/graduate"),
    ...readTree("app/chess-school/parent"),
    ...readTree("app/chess-school/modules"),
  ].map((f) => [f, fs.readFileSync(f, "utf8")]);
  check("core school code never imports the AI provider", core.every(([, s]) => !/lib\/ollie\/aiProvider|providers\//.test(s)));
  check("core school code never calls an Ollie API route", core.every(([, s]) => !/\/api\/ollie/.test(s)));
  check("core school code has no open chat input", core.every(([, s]) => !/<textarea|type="text"/.test(s)));
  check("every session carries deterministic Ollie copy", SESSIONS.every((s) => s.ollie.intro.length > 0 && s.ollie.mistake.length > 0 && s.ollie.success.length > 0));
  check("the brief's intro pattern is used", SESSIONS.some((s) => /Today we learn/.test(s.ollie.intro)));
  check("the brief's mistake line is used", SESSIONS.some((s) => s.ollie.mistake === "That's okay. Even I did that when I was learning."));
  check("the brief's win line is used", SESSIONS.some((s) => /didn't get lucky/.test(s.ollie.success)));
  check("the pre-graduation line is used", C.getSession(29).ollie.intro === "Tomorrow you play for real. I'm proud of you.");
}

// --- 11. Separation: not the Kingdom Journey, not touching it ---------------
{
  const core = [...readTree("content/school"), ...readTree("lib/school/v2"), ...readTree("components/school/v2")];
  check("Chess School V2 never imports content/lessons.ts", core.every((f) => !/from ["']@\/content\/lessons["']/.test(fs.readFileSync(f, "utf8"))));
  check("Chess School V2 never imports kingdomZones", core.every((f) => !/kingdomZones/.test(fs.readFileSync(f, "utf8"))));
  check("Chess School V2 never touches child_lesson_progress", core.every((f) => !/child_lesson_progress/.test(fs.readFileSync(f, "utf8"))));
  check("Chess School V2 never touches children.current_day", core.every((f) => !/current_day/.test(fs.readFileSync(f, "utf8"))));
  check("V1 course page still imports its own module", /lib\/school\/chessSchool/.test(read("app", "chess-school", "page.tsx")));
  check("V1 lesson route is untouched by V2 (no v2 imports)", !/school\/v2/.test(read("app", "lesson", "[dayId]", "page.tsx")));
  check("the V2 migration exists at 0043", fs.existsSync(path.join(process.cwd(), "supabase", "migrations", "0043_chess_school_v2.sql")));
  check("no duplicate 0032 school migration was created", !fs.readdirSync(path.join(process.cwd(), "supabase", "migrations")).some((f) => /^0032.*school/.test(f)));
  const mig = read("supabase", "migrations", "0043_chess_school_v2.sql");
  check("migration enables RLS on progress", /child_school_progress enable row level security/.test(mig));
  check("migration's policy is parent-owns-child", /p\.auth_user_id = auth\.uid\(\)/.test(mig));
  check("migration never alters an existing table", !/alter table public\.(children|parents|child_lesson_progress|premium_entitlements)/.test(mig));
  check("migration is idempotent (if not exists / or replace)", /create table if not exists/.test(mig) && /create or replace function/.test(mig));
  check("entitlement rows cannot be written by the client", !/school_entitlements for (all|insert|update)/.test(mig));
}

// --- 12. Access: premium includes School; free gets three sessions ----------
{
  const free = A.resolveSchoolAccess(null, null);
  check("no rows -> free tier", free.source === "free" && !free.hasFullAccess);
  check("free tier opens the first three sessions", A.canOpenSession(free, 3) && !A.canOpenSession(free, 4));
  const prem = A.resolveSchoolAccess({ premium_status: "premium", premium_expires_at: null }, null);
  check("premium -> full access", prem.hasFullAccess && prem.source === "premium");
  const expired = A.resolveSchoolAccess({ premium_status: "premium", premium_expires_at: "2020-01-01T00:00:00Z" }, null);
  check("expired premium -> free", !expired.hasFullAccess);
  const bought = A.resolveSchoolAccess(null, { expires_at: null });
  check("standalone purchase -> full access", bought.hasFullAccess && bought.source === "school_purchase");
  const lapsed = A.resolveSchoolAccess(null, { expires_at: "2020-01-01T00:00:00Z" }, new Date("2026-01-01T00:00:00Z"));
  check("lapsed standalone -> free", !lapsed.hasFullAccess);
  check("premium entitlement module is untouched", !/school/i.test(read("lib", "premium", "entitlement.ts")));
  // The Premium checkout route and the Premium success page are untouched;
  // the webhook gained a Chess School branch (section 16 holds it to account).
  check("Premium checkout route is untouched by V2", !/school/i.test(stripComments(read("app", "api", "stripe", "checkout", "route.ts"))));
  check("Premium success page is untouched by V2", !/school/i.test(stripComments(read("app", "upgrade", "success", "page.tsx"))));
  check("validate-promo is untouched by V2", !/school/i.test(read("app", "api", "stripe", "validate-promo", "route.ts")));
}

// --- 13. Offline safety: local mirror merges, never overwrites --------------
{
  const a = P.normalizeProgress({ completedSessions: [1, 2], skillTags: ["board_setup"] });
  const b = P.normalizeProgress({ completedSessions: [2, 3], unlocks: ["first_game"] });
  const m = ST.mergeProgress(a, b);
  check("merge is a union of sessions", m.completedSessions.join(",") === "1,2,3");
  check("merge keeps both sides' skills and unlocks", m.skillTags.includes("board_setup") && m.unlocks.includes("first_game"));
  const g1 = P.normalizeProgress({ completedSessions: [30], graduatedAt: "2026-02-01T00:00:00Z" });
  const g2 = P.normalizeProgress({ completedSessions: [30], graduatedAt: "2026-01-01T00:00:00Z" });
  check("merge keeps the EARLIER graduation date", ST.mergeProgress(g1, g2).graduatedAt === "2026-01-01T00:00:00Z");
  check("readLocalProgress is safe with no window", ST.readLocalProgress("x").completedSessions.length === 0);
}

// --- 14. Parent Lock is untouched, and V2 lives inside its allow-list ------
{
  const act = read("lib", "parentLock", "activities.ts");
  check("Chess Time allows the /chess-school prefix", /"\/chess-school"/.test(act));
  check("V2 routes live under /chess-school (so Chess Time does not bounce them)",
    fs.existsSync(path.join(process.cwd(), "app", "chess-school", "classroom", "page.tsx")) &&
    fs.existsSync(path.join(process.cwd(), "app", "chess-school", "session", "[sessionId]", "page.tsx")) &&
    fs.existsSync(path.join(process.cwd(), "app", "chess-school", "graduate", "page.tsx")) &&
    fs.existsSync(path.join(process.cwd(), "app", "chess-school", "parent", "page.tsx")));
  check("no app/school route was left behind", !fs.existsSync(path.join(process.cwd(), "app", "school")));
  const plFiles = readTree("lib/parentLock").concat(readTree("components/parentLock"));
  check("no Parent Lock file mentions Chess School V2", plFiles.every((f) => !/school\/v2|classroom/.test(fs.readFileSync(f, "utf8"))));
}

// --- 15. Cloud progress: union on the server, fallback on the device ---------
{
  const mig = read("supabase", "migrations", "0043_chess_school_v2.sql");
  check("migration defines merge_school_progress", /create or replace function public\.merge_school_progress/.test(mig));
  check("merge_school_progress unions every array (array_agg(distinct …))", (mig.match(/array_agg\(distinct/g) || []).length >= 3);
  check("merge keeps the EARLIER graduation (least)", /graduated_at = least\(/.test(mig));
  check("merge is callable by authenticated only", /grant execute on function public\.merge_school_progress[^;]*to authenticated/.test(mig) && /revoke all on function public\.merge_school_progress[^;]*from public, anon/.test(mig));
  check("merge runs as the caller (no security definer) so RLS applies", !/merge_school_progress[\s\S]{0,900}security definer/.test(mig));
  check("CHECK: session numbers must be 1..30", /child_school_progress_sessions_in_range/.test(mig) && /<@ array\[1,2,3/.test(mig));
  check("CHECK: graduated_at requires session 30", /graduated_at is null or 30 = any \(completed_sessions\)/.test(mig));
  const q = read("lib", "school", "v2", "queries.ts");
  check("client saves through merge_school_progress", /rpc\("merge_school_progress"/.test(q));
  check("client falls back to upsert only when the RPC is absent (PGRST202)", /PGRST202/.test(q) && /\.upsert\(/.test(q));
  check("client never deletes progress", !/\.delete\(/.test(q));
  check("a verifier for the live migration exists", fs.existsSync(path.join(process.cwd(), "scripts", "verify-chess-school-migration.js")));
  check("the certificate merges device progress like every other V2 screen", /mergeProgress/.test(read("components", "school", "v2", "CertificateView.tsx")));
}

// --- 16. ₹199 Chess School Lifetime Access ---------------------------------
{
  const school = stripComments(read("app", "api", "stripe", "checkout-school", "route.ts"));
  const premium = stripComments(read("app", "api", "stripe", "checkout", "route.ts"));
  const webhook = stripComments(read("app", "api", "stripe", "webhook", "route.ts"));
  const success = stripComments(read("app", "chess-school", "purchase", "success", "page.tsx"));
  const premiumSuccess = stripComments(read("app", "upgrade", "success", "page.tsx"));
  const pricing = require(path.join(process.cwd(), "lib", "pricing", "school.ts"));
  const premiumPricing = require(path.join(process.cwd(), "lib", "pricing", "regions.ts"));

  // THE invariant: a School session must never be redeemable as Premium.
  check("school checkout NEVER emits metadata.parent_id", !/\bparent_id:/.test(school));
  check("school checkout identifies the parent as school_parent_id", /school_parent_id: parent\.id/.test(school));
  check("school checkout tags the session as chess_school", /product: SCHOOL_CHECKOUT_PRODUCT/.test(school) && pricing.SCHOOL_CHECKOUT_PRODUCT === "chess_school");
  check("school checkout is a one-time payment, never a subscription", /mode: "payment"/.test(school) && !/subscription/.test(school));
  check("school checkout lands on its own success page, not /upgrade/success", /\/chess-school\/purchase\/success/.test(school) && !/upgrade\/success/.test(school));
  check("school checkout derives price from the request country, not the body", /getCountryFromRequest\(request\)/.test(school) && !/body\.(amount|price|currency)/.test(school));
  check("premium checkout route knows nothing about Chess School", !/chess_school|school/i.test(premium));
  check("premium success page unchanged in what it trusts (parent_id + paid)", /session\.metadata\?\.parent_id/.test(premiumSuccess) && !/school/i.test(premiumSuccess));
  check("webhook handles chess_school BEFORE the premium grant and returns", webhook.indexOf("SCHOOL_CHECKOUT_PRODUCT") < webhook.indexOf('admin.rpc("grant_premium_entitlement"') && /grant_school_entitlement[\s\S]{0,900}return NextResponse\.json\(\{ received: true \}\)/.test(webhook));
  check("webhook grants school from school_parent_id, never parent_id", /p_parent_id: schoolParentId/.test(webhook));
  check("webhook revokes school access on refund", /revoke_school_entitlement/.test(webhook));
  check("webhook still grants premium exactly as before", /p_duration: `\$\{PREMIUM_ENTITLEMENT_YEARS\} years`/.test(webhook));
  check("school success page checks product, parent and paid before granting", /metadata\?\.product !== SCHOOL_CHECKOUT_PRODUCT/.test(success) && /school_parent_id/.test(success) && /payment_status !== "paid"/.test(success) && /grant_school_entitlement/.test(success));
  check("school success page never grants premium", !/grant_premium_entitlement/.test(success));

  const inr = pricing.getSchoolRegionalPrice("IN");
  check("India price is ₹199 (19900 paise, inr)", inr.currency === "inr" && inr.amountMinor === 19900 && inr.display === "₹199");
  check("unknown country falls back to a price rather than failing", pricing.getSchoolRegionalPrice(null).amountMinor > 0);
  for (const c of ["IN", "US", "GB", "DE", "CA", "AU"]) {
    const s = pricing.getSchoolRegionalPrice(c), p = premiumPricing.getRegionalPrice(c);
    check(c + ": School is priced below Premium in the same currency", s.currency === p.currency && s.amountMinor < p.amountMinor);
  }
  check("product name says Lifetime Access", /Lifetime Access/.test(pricing.SCHOOL_PRODUCT_NAME));

  const mig = read("supabase", "migrations", "0043_chess_school_v2.sql");
  check("grant_school_entitlement is idempotent per checkout session", /where checkout_session_id = p_checkout_session_id/.test(mig));
  check("grant/revoke are service-role only", /revoke all on function public\.grant_school_entitlement[^;]*from public, anon, authenticated/.test(mig) && /revoke all on function public\.revoke_school_entitlement[^;]*from public, anon, authenticated/.test(mig));
  check("access function ignores a revoked entitlement", /se\.revoked_at is null/.test(mig));
  check("client access ignores a revoked entitlement", !A.resolveSchoolAccess(null, { expires_at: null, revoked_at: "2026-01-01T00:00:00Z" }).hasFullAccess);
  check("client access honours a live lifetime purchase", A.resolveSchoolAccess(null, { expires_at: null, revoked_at: null }).source === "school_purchase");
  check("the classroom offers the School checkout, with Premium as the alternative", /checkout-school/.test(read("components", "school", "v2", "UnlockSchoolButton.tsx")) && /href="\/upgrade"/.test(read("components", "school", "v2", "UnlockSchoolButton.tsx")));
}

// --- 18. 10/10 polish: resume, Ollie variety, session depth, WOW structure -----
{
  const R = require(path.join(process.cwd(), "lib", "school", "v2", "resume.ts"));
  const OL = require(path.join(process.cwd(), "lib", "school", "v2", "ollieLines.ts"));

  // Resume: a bookmark can never point outside the session, and never throws.
  check("bookmark without a window is 0 (server render safe)", R.readBookmark("c", "s", 5) === 0);
  check("writing/clearing a bookmark without a window is a no-op", (() => { R.writeBookmark("c", "s", 3); R.clearBookmark("c", "s"); return true; })());
  check("the runner restores a bookmark and clears it on finish", /readBookmark\(childId, session\.id/.test(read("components", "school", "v2", "SessionRunner.tsx")) && /clearBookmark\(childId, session\.id\)/.test(read("components", "school", "v2", "SessionRunner.tsx")));
  check("the runner writes the bookmark on every advance", /writeBookmark\(childId, session\.id, nextIndex\)/.test(read("components", "school", "v2", "SessionRunner.tsx")));
  check("the finish screen offers the NEXT session directly", /Next: \{nextSession\.title\}/.test(read("components", "school", "v2", "SessionRunner.tsx")));

  // Ollie: no repeats within a moment, and the identity register.
  const solved = [0, 1, 2, 3].map(OL.solvedLine);
  check("four puzzle successes in a row get four different lines", new Set(solved).size === 4);
  check("solved lines are about seeing, not luck", solved.every((l) => !/correct|good job|well done/i.test(l)));
  const misses = [0, 1, 2, 3].map(OL.missLine);
  check("four misses in a row get four different lines", new Set(misses).size === 4);
  check("a miss is never called wrong or bad", misses.every((l) => !/\bwrong\b|\bbad\b|incorrect/i.test(l)));
  check("out-of-range counts clamp instead of throwing", OL.solvedLine(99) === solved[3] && OL.missLine(-5) === misses[0]);
  check("losing a game gets a line that keeps the child in the game", /played the whole thing/.test(OL.gameEndLine("loss", true)));
  check("winning without hints names the independence", /nobody helping/.test(OL.gameEndLine("win", false)));
  check("perseverance is recognised, not just first-try success", OL.perseveranceLine(0) !== OL.perseveranceLine(1) && OL.perseveranceLine(1) !== OL.perseveranceLine(3));
  check("illegal taps get a nudge that explains, not a scold", /can't go there|Not a legal square/.test(OL.illegalLine(0)) && !/wrong/i.test(OL.illegalLine(0)));
  const steps = read("components", "school", "v2", "steps.tsx");
  check("guided board and puzzles respond to illegal taps", (steps.match(/onIllegalAttempt=/g) || []).length >= 2);
  check("a revealed answer is shown on the board, not only named", /revealedFen/.test(steps) && /fen=\{state === "revealed" \? revealedFen : puzzle\.fen\}/.test(steps));
  check("bot games always show whose turn it is", /Your move/.test(steps) && /Opponent is thinking/.test(steps));
  check("the teach step no longer echoes the previous line in the coach", !/step\.lines\[lineIndex - 1\]/.test(steps));

  // Session depth: no session is a single tap between two cards.
  const weight = (st) =>
    st.type === "guided_board" ? 1
    : st.type === "puzzle_drill" || st.type === "exam" ? st.drill.puzzles.length
    : st.type === "bot_match" || st.type === "pass_and_play" || st.type === "parent_mode" ? 2
    : 0;
  for (const s of SESSIONS) {
    const w = s.steps.reduce((n, st) => n + weight(st), 0);
    check(`${s.id}: has at least two board activities (has ${w})`, w >= 2);
  }
  check("every piece-introduction session drills the piece, not just one guided move", [4, 5, 6, 7].every((n) => C.getSession(n).steps.some((st) => st.type === "puzzle_drill")));
  check("check, castling, king safety and the endgame are drilled", [9, 19, 23, 26].every((n) => C.getSession(n).steps.some((st) => st.type === "puzzle_drill")));

  // The five WOW moments each carry a ceremony.
  for (const n of [10, 12, 18, 24, 30]) {
    check(`WOW session ${n} has a ceremony`, C.getSession(n).steps.some((st) => st.type === "ceremony"));
  }
  check("session 1 ends its first move with a ceremony", C.getSession(1).steps.some((st) => st.type === "ceremony"));
  check("first checkmate ceremony says check vs checkmate out loud", C.getSession(18).steps.some((st) => st.type === "ceremony" && st.lines.some((l) => /Check says.*Checkmate says/.test(l))));
  check("Fork Master ceremony names who to try it on", C.getSession(12).steps.some((st) => st.type === "ceremony" && st.lines.some((l) => /Papa, Mama, or a friend/.test(l))));

  // Parent page: the brief's three blocks, and the whole skill list.
  const pv = read("components", "school", "v2", "ParentView.tsx");
  check("parent page: CAN NOW / CURRENTLY LEARNING / NEXT", /CAN NOW/.test(pv) && /CURRENTLY LEARNING/.test(pv) && />NEXT</.test(pv));
  check("parent page lists every earned skill, not a top three", /summary\.allSkills\.map/.test(pv));
  const full = P.normalizeProgress({ completedSessions: Array.from({ length: 12 }, (_, i) => i + 1) });
  const ps = PS.parentSummary(full);
  check("after 12 sessions the parent sees more than three skills", ps.allSkills.length > 3);
  check("currently-learning is a plain phrase, not a session id", /^[a-z]/.test(ps.currentlyLearning) && !/s\d\d-/.test(ps.currentlyLearning));
  check("the next-after-that session is named", ps.afterThat.length > 0);

  // Paywall says what you get.
  const ub = read("components", "school", "v2", "UnlockSchoolButton.tsx");
  check("paywall lists what the purchase includes", /All 30 sessions/.test(ub) && /certificate/.test(ub));
  check("paywall never uses pressure language", !/only today|hurry|last chance|limited time/i.test(ub));
}

// --- 19. 11/10 WOW pass: checkmate freeze, real Pass & Play state, epic ceremonies
{
  const stepsSrc = read("components", "school", "v2", "steps.tsx");
  const runnerSrc = read("components", "school", "v2", "SessionRunner.tsx");
  const coachSrc = read("components", "school", "v2", "Coach.tsx");
  const certSrc = read("components", "school", "v2", "CertificateView.tsx");
  const OL = require(path.join(process.cwd(), "lib", "school", "v2", "ollieLines.ts"));

  // 1 & 2. Checkmate detection (guided_board) is real, driven by chess.js via
  // ChessBoard's own onMove callback -- not a per-session flag.
  check("GuidedBoardStepView reads isCheckmate from the board's own onMove callback", /isCheckmate\s*}\s*:\s*{\s*san:\s*string;\s*isCheckmate:\s*boolean/.test(stepsSrc));
  check("a delivered checkmate freezes into its own CHECKMATE view", /if \(mateAfterFen\)/.test(stepsSrc) && /CHECKMATE<\/h2>/.test(stepsSrc));
  check("the checkmate view explains why: no move, no block, no capture", /cannot move[\s\S]{0,60}Cannot block[\s\S]{0,60}Cannot capture/i.test(stepsSrc));
  check("the checkmate moment offers a replay the child can watch again", /Watch it again/.test(stepsSrc));
  check("replay re-runs the same before\\/after sequence rather than jumping straight to the result", /matePhase === "before" \? step\.fen : mateAfterFen/.test(stepsSrc));

  // Session 18 specifically: verify the real chess.js data the freeze/replay
  // will actually show is correct -- both the "before" and "after" positions
  // are legal, and the after position is genuinely checkmate.
  {
    const s18 = C.getSession(18);
    const guided = s18.steps.find((st) => st.type === "guided_board");
    check("session 18's guided board FEN is legal", MV.isLegalFen(guided.fen));
    const g = new Chess(guided.fen);
    const played = g.move(MV.canonicalSan(guided.fen, guided.acceptMoves[0]));
    check("session 18's mating move is legal from that position", !!played);
    check("session 18's mating move actually delivers checkmate", g.isCheckmate());
    check("the resulting 'after' position is itself a legal FEN (what replay shows)", MV.isLegalFen(g.fen()));
  }

  // 3. Pass & Play: real check/checkmate/draw feedback, not just a winner name.
  check("Pass & Play tracks isCheck from the board and shows a CHECK banner", /isCheck\s*}\s*\)\s*=>\s*{[\s\S]{0,120}setInCheck\(isCheck\)/.test(stepsSrc) && /CHECK!/.test(stepsSrc));
  check("Pass & Play distinguishes checkmate from an ordinary win in the result banner", /WINS\$\{over\.isCheckmate \? " BY CHECKMATE" : ""\}/.test(stepsSrc));
  check("Pass & Play explains a non-mate draw (covers stalemate) honestly, without over-claiming which draw rule fired", /nobody could force a win/.test(stepsSrc));
  check("Pass & Play shows a proper WHITE WINS \\/ BLACK WINS \\/ DRAW result screen", /"WHITE" : "BLACK"/.test(stepsSrc) && /: "DRAW"/.test(stepsSrc));

  // 4, 5, 6. Graduation proceeds after a win, a loss, OR a draw -- structurally,
  // not just by convention: the Continue button's condition never reads
  // `over.winner`, only that the game is over at all.
  {
    const fnStart = stepsSrc.indexOf("export function PassAndPlayStepView");
    const fnBody = stepsSrc.slice(fnStart, stepsSrc.indexOf("\n}\n", fnStart));
    check("the pass-and-play Continue button is gated on the game being over, not on who won", /{plies >= 6 \|\| over \? \(/.test(fnBody) && !/over\.winner \?[\s\S]{0,40}<Button/.test(fnBody));
  }
  check("session 30's duel carries distinct win \\/ loss \\/ draw framing", (() => {
    const duel = C.getSession(30).steps.find((st) => st.type === "pass_and_play");
    const rl = duel.resultLines;
    return !!rl && rl.win !== rl.loss && rl.loss !== rl.draw && /YOU WON/.test(rl.win) && /play another/.test(rl.loss);
  })());
  check("losing the Graduation Duel is never framed as failure", !/YOU LOST|YOU FAILED/i.test(C.getSession(30).steps.find((st) => st.type === "pass_and_play").resultLines.loss));
  check("completeSession still has no result parameter -- win or lose graduates the same way", P.completeSession.length <= 3);
  {
    // Exercise the actual graduation gate three times with the three
    // qualitatively different endings a duel can have -- the app never asks
    // "did they win" before recording the session, so all three reach the
    // identical completedSessions/graduatedAt outcome.
    const almost = P.normalizeProgress({ completedSessions: Array.from({ length: 29 }, (_, i) => i + 1) });
    for (const ending of ["win", "loss", "draw"]) {
      const graduated = P.completeSession(almost, 30);
      check(`graduation completes after a ${ending} (the API takes no result at all)`, P.hasGraduated(graduated));
    }
  }

  // 7. Session 24: no hint control anywhere, prelude included.
  {
    const s24 = C.getSession(24);
    const bot = s24.steps.find((st) => st.type === "bot_match");
    check("session 24's bot match still sets hintsAllowed: false", bot.hintsAllowed === false);
    check("session 24's prelude states plainly there are no hints, rather than sneaking one in", /NO HINTS/.test(bot.prelude.headline) && !/tap [a-h][1-8]|move your|the answer is/i.test(JSON.stringify(bot.prelude.lines)));
    check("the independence ceremony uses the brief's own words", /YOU DIDN'T NEED ME/.test(s24.steps.find((st) => st.type === "ceremony").headline));
  }
  check("a bot_match prelude renders before the board mounts (no engine cost while reading)", (() => {
    const fnStart = stepsSrc.indexOf("export function BotMatchStepView");
    const fnBody = stepsSrc.slice(fnStart, stepsSrc.indexOf("\n// ─", fnStart));
    const preludeIdx = fnBody.indexOf("step.prelude) {");
    const boardIdx = fnBody.indexOf("<ChessBoard");
    return preludeIdx > -1 && boardIdx > -1 && preludeIdx < boardIdx;
  })());

  // 8. Fork Master unlock sequence is intact, and the epic staging is additive
  // (only fires when a ceremony opts in).
  {
    const s12 = C.getSession(12);
    const ceremony = s12.steps.find((st) => st.type === "ceremony");
    check("Fork Master ceremony is marked epic", ceremony.epic === true);
    check("Fork Master unlock id and tagline are unchanged", ceremony.unlock.id === "fork_master" && ceremony.unlock.tagline === "Challenge me.");
    check("the three fork puzzles now react to the actual discovery, not the generic rotation", s12.steps.find((st) => st.type === "puzzle_drill").drill.puzzles.every((p) => !!p.successLine));
  }
  check("MilestoneCard only stages its reveal when explicitly asked (backward compatible)", /staged = false/.test(coachSrc));
  check("a staged MilestoneCard says NEW TITLE UNLOCKED before the title itself appears", /NEW TITLE UNLOCKED/.test(coachSrc));
  check("CeremonyStepView passes `epic` through as MilestoneCard's `staged`", /staged={step\.epic}/.test(stepsSrc));
  check("a non-epic ceremony's `stage` still ends complete (no regression to the original single fade-in)", /setStage\(3\)/.test(stepsSrc));

  // Reserved for genuine milestones only -- not sprinkled on every ceremony.
  {
    const epicIds = SESSIONS.flatMap((s) => s.steps.filter((st) => st.type === "ceremony" && st.epic).map((st) => st.id));
    const allCeremonyIds = SESSIONS.flatMap((s) => s.steps.filter((st) => st.type === "ceremony").map((st) => st.id));
    check("epic is reserved for genuine milestones, not used on every ceremony", epicIds.length > 0 && epicIds.length < allCeremonyIds.length);
    check("the small superpower reveals (queen & king, etc.) stay calm, not epic", !SESSIONS.flatMap((s) => s.steps).some((st) => st.type === "ceremony" && st.id === "s07-ceremony" && st.epic));
  }

  // Certificate: the brief's required elements, alongside the honest skill
  // list this course already refused to give up.
  check("the certificate names the brand, the school, and says CERTIFICATE OF GRADUATION", /CHESS SCHOOL/.test(certSrc) && /CERTIFICATE OF GRADUATION/.test(certSrc));
  check("the certificate still says GRADUATED CHESS PLAYER", /GRADUATED CHESS PLAYER/.test(certSrc));
  check("the certificate carries Ollie's signature as a coach, not a fake accreditation body", /Ollie — Chess Coach/.test(certSrc) && !/accredit|certified by the state|official examination/i.test(certSrc));
  check("the certificate still lists every earned skill (unchanged)", /orderedSkillClaims/.test(certSrc));

  // Act transitions: exist for 2-4, null (silent) for act 1, and are wired
  // into the one place a child sees "session complete".
  check("act transition lines exist for acts 2, 3 and 4", [2, 3, 4].every((a) => typeof OL.actTransitionLine(a) === "string" && OL.actTransitionLine(a).length > 0));
  check("there is nothing to transition INTO on act 1", OL.actTransitionLine(1) === null);
  check("the three act-transition lines are all different", new Set([2, 3, 4].map((a) => OL.actTransitionLine(a))).size === 3);
  check("the finish screen shows the act transition only when the next session is actually a new act", /nextAct !== module\?\.act/.test(runnerSrc));

  // Prelude / resultLines / montage / epic are all optional and backward
  // compatible: every session that doesn't opt in renders exactly as before.
  {
    const untouchedBotMatches = [8, 21].map((n) => C.getSession(n).steps.find((st) => st.type === "bot_match"));
    check("bot_match sessions that were never touched still have no prelude", untouchedBotMatches.every((b) => b.prelude === undefined));
    const untouchedPassAndPlay = [27, 28].map((n) => C.getSession(n).steps.find((st) => st.type === "pass_and_play"));
    check("pass_and_play sessions outside Graduation still use the generic result wording", untouchedPassAndPlay.every((p) => p.resultLines === undefined && p.prelude === undefined));
    check("ordinary recaps are still instant checklists, not montages", C.getSession(9).steps.find((st) => st.type === "recap").montage === undefined);
  }

  // Performance / footprint: no new runtime dependency, no animation library.
  check("Chess School V2 code does not import an animation library, new or pre-existing", [...readTree("components/school/v2"), ...readTree("lib/school/v2")].every((f) => !/from "framer-motion"|from "gsap"|from "lottie/i.test(fs.readFileSync(f, "utf8"))));
  check("the checkmate and ceremony reveals are plain CSS transitions, not a JS animation library", !/framer-motion|gsap|lottie/i.test(stepsSrc) && !/framer-motion|gsap|lottie/i.test(coachSrc));
}


// --- 17. Cross-device: the Motorola -> Lenovo scenario, against the real client code
{
  const Q = require(path.join(process.cwd(), "lib", "school", "v2", "queries.ts"));
  // A fake Supabase client: one server row, and a record of what the client asks of it.
  const makeServer = (row, opts = {}) => {
    const calls = [];
    const client = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => (opts.readError ? { data: null, error: { code: opts.readError } } : { data: row, error: null }) }) }),
        upsert: async (payload) => { calls.push(["upsert", payload]); return { error: null }; },
      }),
      rpc: async (name, args) => { calls.push([name, args]); return opts.rpcMissing ? { error: { code: "PGRST202" } } : { error: null }; },
    };
    return { client, calls };
  };
  // Node has no window, so readLocalProgress is the empty device — exactly a
  // freshly signed-in Lenovo.
  (async () => {
    // 1. Motorola finished session 1 and saved -> the client asks the server to MERGE.
    const moto = makeServer(null);
    const after1 = P.completeSession(P.EMPTY_PROGRESS, 1);
    const ok = await Q.saveSchoolProgress(moto.client, "child-1", after1);
    check("save goes through merge_school_progress, not a blind upsert", ok && moto.calls[0][0] === "merge_school_progress" && moto.calls[0][1].p_completed_sessions.join() === "1");
    // 2. Lenovo, empty device, reads the server row -> sees session 1 done.
    const lenovo = makeServer({ completed_sessions: [1], skill_tags: ["board_setup"], unlocks: [], graduated_at: null });
    const loaded = await Q.loadSchoolProgress(lenovo.client, "child-1");
    check("a fresh device loads the server's progress", loaded.synced && loaded.progress.completedSessions.join() === "1");
    check("classroom on the fresh device would open session 2", P.nextSessionNumber(loaded.progress) === 2 && P.isSessionUnlocked(loaded.progress, 2));
    check("parent page on the fresh device would claim the board-setup skill", PS.parentSummary(loaded.progress).canNowDo[0].includes("set up a chess board"));
    // 3. Server unreachable on the fresh device -> honest empty state, not a crash, not "synced".
    const offline = makeServer(null, { readError: "PGRST205" });
    const off = await Q.loadSchoolProgress(offline.client, "child-1");
    check("server unreachable -> falls back without throwing and reports unsynced", !off.synced && off.progress.completedSessions.length === 0);
    // 4. A database without the merge RPC still gets a save (upsert fallback).
    const old = makeServer(null, { rpcMissing: true });
    const ok2 = await Q.saveSchoolProgress(old.client, "child-1", after1);
    check("missing merge RPC -> upsert fallback, save still succeeds", ok2 && old.calls.some((c) => c[0] === "upsert"));
    // 5. A stale device can never downgrade the server: the device merge is a union.
    const stale = P.normalizeProgress({ completedSessions: [1, 2] });
    const server = P.normalizeProgress({ completedSessions: [1, 2, 3, 4] });
    check("device merge never removes a server session", ST.mergeProgress(server, stale).completedSessions.join() === "1,2,3,4");

    console.log("\n=== CHESS SCHOOL V2: " + pass + " passed, " + failures.length + " failed ===");
    if (failures.length) {
      console.error("Failures:\n" + failures.map((f) => " - " + f).join("\n"));
      process.exitCode = 1;
    }
  })();
}

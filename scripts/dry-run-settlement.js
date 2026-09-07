/**
 * What the sweeper WOULD do to the real production rows.
 *
 *   node scripts/dry-run-settlement.js
 *
 * STRICTLY READ-ONLY. It issues SELECTs and runs the same pure decision
 * function the cron route uses (lib/online/settlement.ts). It calls no RPC and
 * writes nothing, so it is safe against production at any time — including
 * before migration 0040 exists.
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
const S = require(path.join(process.cwd(), "lib", "online", "settlement.ts"));

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const SRV = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: SRV, Authorization: `Bearer ${SRV}` };

const REASONS = {
  not_active: "not an active game",
  untimed: "no time control — no clock, so no forfeit can be proven",
  no_current_turn: "current_turn is null — cannot tell whose clock is running",
  no_last_move_at: "last_move_at is missing or unparseable",
  malformed_clock: "clock value is missing, negative or implausible",
  time_remaining: "clock has not expired",
};

const dur = (ms) => {
  const s = Math.floor(Math.abs(ms) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

(async () => {
  const r = await fetch(
    `${BASE}/rest/v1/online_games?select=id,status,time_control,current_turn,last_move_at,white_time_ms,black_time_ms,match_type,rating_applied,created_at&order=created_at.desc`,
    { headers: H }
  );
  if (!r.ok) { console.error("read failed:", r.status, (await r.text()).slice(0, 200)); process.exitCode = 1; return; }
  const games = await r.json();
  const now = new Date();

  console.log(`DRY RUN — read-only. ${games.length} games. Server time ${now.toISOString()}`);
  console.log(`Grace period before settling a flagged clock: ${S.SETTLEMENT_GRACE_MS / 1000}s\n`);

  const tally = { settle: 0, skip: 0 };
  for (const g of games) {
    const d = S.decideSweep(g, now);
    const age = dur(now.getTime() - Date.parse(g.created_at));
    const would = d.action === "settle"
      ? `SETTLE — ${d.flagged} flagged, ${d.expectedWinner} wins (${dur(d.overshootMs)} past zero)`
      : "no action";
    const why = d.action === "settle"
      ? "clock expired by server time"
      : (g.status === "waiting" ? S.describeWaiting(g, now) : REASONS[d.reason] ?? d.reason);

    tally[d.action]++;
    console.log(`Game ID:      ${g.id}`);
    console.log(`Status:       ${g.status}   Age: ${age}   Type: ${g.match_type}`);
    console.log(`Timed:        ${g.time_control ?? "NO (untimed)"}`);
    console.log(`Current turn: ${g.current_turn ?? "(null)"}`);
    console.log(`Clock:        w=${g.white_time_ms ?? "-"}ms b=${g.black_time_ms ?? "-"}ms  last_move_at=${g.last_move_at ?? "(null)"}`);
    console.log(`Candidate:    ${d.action === "settle" ? "YES" : "no"}`);
    console.log(`Would action: ${would}`);
    console.log(`Reason:       ${why}\n`);
  }

  console.log(`SUMMARY: ${tally.settle} would be settled, ${tally.skip} left untouched.`);
  if (tally.settle === 0) {
    console.log("\nNo production row would be modified by a sweep right now.");
  }
})();

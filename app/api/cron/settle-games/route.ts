import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  decideSweep,
  shouldSettleRating,
  SETTLEMENT_GRACE_MS,
  type SweepableGame,
} from "@/lib/online/settlement";
import { authorizeCron } from "@/lib/online/cronAuth";

/**
 * Settle games that ran out of time while nobody was watching.
 *
 * THE PROBLEM THIS SOLVES
 *
 * claim_timeout is authoritative but gated on auth.uid(), so only a signed-in
 * participant can trigger it. A timed game both players walk away from is never
 * settled: it stays `active` forever and, if rated, never pays out. There was
 * no cron, no worker, and no vercel.json in this project at all.
 *
 * WHAT IT WILL AND WILL NOT DO
 *
 * Settles: active games with a time control, a known current_turn, and a clock
 * that server time says has expired.
 *
 * Leaves alone, deliberately:
 *
 *   * UNTIMED abandoned games. With no clock, nobody has forfeited anything and
 *     there is no evidence for a winner. Awarding one would be inventing a
 *     result. These stay active — including, as it happens, both of the games
 *     currently stuck in production. That is the correct outcome, not a gap.
 *
 *   * STALE WAITING games. A waiting row is an invite link nobody has opened.
 *     It reserves no free-game credit (see 0019's note on when a game is
 *     "consumed": creating an invite nobody joins consumes nothing) and it is
 *     invisible to matchmaking, which pairs through matchmaking_queue rather
 *     than through online_games. So a stale invite costs nothing and cancelling
 *     one could break a link a parent shared last week. There is also no known
 *     safe value to cancel it TO: online_games' CREATE TABLE predates this
 *     migration history (0019 notes this) and its status CHECK constraint is
 *     therefore unknown from the repo. Inventing a 'cancelled' status would be
 *     a destructive guess. Documented as a limitation instead.
 *
 * The rule throughout: a game stays unresolved rather than having a winner
 * invented for it.
 *
 * AUTHORITY
 *
 * This route never decides a result. decideSweep only chooses which rows are
 * worth a round trip; settle_timeout_as_server re-reads each row under
 * `for update` and redoes the arithmetic against clock_timestamp(). If the two
 * disagree the database wins and the route reports that nothing was settled.
 * No value from this process — least of all a clock reading — is written as
 * fact.
 */

/**
 * SCHEDULE — vercel.json currently says `0 3 * * *` (daily, 03:00 UTC).
 *
 * That is the FAIL-SAFE choice, not the ideal one. Vercel's Hobby plan permits
 * a cron to trigger only once per day, and a deployment carrying a more
 * frequent expression is rejected outright. The plan for this project could not
 * be determined from the repo — `.vercel/project.json` gives the org and
 * project ids but not the tier, and the CLI has no auth token in the build
 * environment — so the schedule that works on every plan was chosen over the
 * one that works on some.
 *
 * On Pro, change it to `*​/5 * * * *`. Frequency affects only how long an
 * abandoned game waits before settling; it can never affect correctness,
 * because every decision is re-made from clock_timestamp() inside a row lock
 * on each pass. A player with the app open still settles instantly through
 * claim_timeout — this exists solely for games nobody is watching.
 */

// Never prerender or cache: this reads live rows and writes.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Bound the work per invocation so one run cannot become a long transaction
 *  storm. Anything left over is picked up by the next tick — cron frequency
 *  affects latency, never correctness. */
const MAX_GAMES_PER_RUN = 100;

interface SweepSummary {
  scanned: number;
  candidates: number;
  settled: number;
  skipped: number;
  ratingsApplied: number;
  errors: number;
  /** Only present when something went wrong — game id and reason, no child data. */
  failures?: Array<{ gameId: string; stage: string; message: string }>;
  dryRun?: true;
}

async function sweep(dryRun: boolean): Promise<SweepSummary> {
  const admin = getSupabaseAdmin();

  // Only live timed games. Never `select *`: `moves` and `fen` can be large and
  // settlement is decided entirely by the clock. Backed by
  // online_games_active_timed_idx (0040).
  const { data, error } = await admin
    .from("online_games")
    .select(
      "id, status, time_control, current_turn, last_move_at, white_time_ms, black_time_ms, match_type, rating_applied, created_at"
    )
    .eq("status", "active")
    .not("time_control", "is", null)
    .order("last_move_at", { ascending: true, nullsFirst: true })
    .limit(MAX_GAMES_PER_RUN);

  if (error) {
    return { scanned: 0, candidates: 0, settled: 0, skipped: 0, ratingsApplied: 0, errors: 1,
      failures: [{ gameId: "-", stage: "query", message: error.message }] };
  }

  const games = (data ?? []) as SweepableGame[];
  // One server timestamp for the whole pass, so every row in a run is judged
  // against the same instant.
  const now = new Date();

  const summary: SweepSummary = {
    scanned: games.length, candidates: 0, settled: 0, skipped: 0, ratingsApplied: 0, errors: 0,
  };
  const failures: SweepSummary["failures"] = [];

  for (const game of games) {
    const decision = decideSweep(game, now);
    if (decision.action === "skip") {
      summary.skipped++;
      continue;
    }
    summary.candidates++;

    if (dryRun) continue;

    // One failure must not stop the pass — a single corrupt row would otherwise
    // block settlement for every other game, indefinitely, on every tick.
    try {
      const { data: rows, error: rpcError } = await admin.rpc("settle_timeout_as_server", {
        p_game_id: game.id,
      });
      if (rpcError) {
        summary.errors++;
        failures.push({ gameId: game.id, stage: "settle", message: rpcError.message });
        continue;
      }

      const row = Array.isArray(rows) ? rows[0] : null;
      // `settled: false` is the normal, expected answer for a game that was
      // already finished by a browser, or whose clock the database judged
      // still running. Not an error.
      if (!row?.settled) {
        summary.skipped++;
        continue;
      }
      summary.settled++;

      if (shouldSettleRating(game)) {
        const { error: rateError } = await admin.rpc("apply_match_rating", { p_game_id: game.id });
        if (rateError) {
          // The result is recorded; only the payout failed. Count it, keep
          // going, and let the next tick retry — apply_match_rating is
          // idempotent, so a retry cannot double-pay.
          summary.errors++;
          failures.push({ gameId: game.id, stage: "rating", message: rateError.message });
        } else {
          summary.ratingsApplied++;
        }
      }
    } catch (e) {
      summary.errors++;
      failures.push({
        gameId: game.id, stage: "unexpected",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (failures.length) summary.failures = failures;
  if (dryRun) summary.dryRun = true;
  return summary;
}

export async function GET(req: NextRequest) {
  // Extracted to lib/online/cronAuth so the decision is unit tested rather
  // than only exercised by a live request. CRON_SECRET is server-only: it has
  // no NEXT_PUBLIC_ prefix, so it never reaches a client bundle.
  const auth = authorizeCron(req.headers.get("authorization"), process.env.CRON_SECRET);
  if (!auth.ok) {
    // TEMPORARY DIAGNOSTIC — remove once the secret is confirmed present.
    //
    // The endpoint kept returning cron_not_configured across several redeploys
    // that were believed to have set CRON_SECRET, and there is no way to tell
    // "variable absent" from "variable present under another name or scope"
    // by probing from outside. This distinguishes them WITHOUT disclosing
    // anything: it reports how many environment variable NAMES contain "cron",
    // and the length of CRON_SECRET if it exists — never a value, never a
    // name, never a prefix. A count and a length are not a secret.
    if (auth.error === "cron_not_configured") {
      const matchingNames = Object.keys(process.env).filter((k) => /cron/i.test(k)).length;
      return NextResponse.json(
        {
          error: auth.error,
          diagnostic: {
            envVarsMatchingCron: matchingNames,
            cronSecretDefined: typeof process.env.CRON_SECRET === "string",
            cronSecretLength: process.env.CRON_SECRET?.length ?? 0,
            vercelEnv: process.env.VERCEL_ENV ?? "unknown",
          },
        },
        { status: auth.status }
      );
    }
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // ?dryRun=1 reports what WOULD be settled and writes nothing. Still requires
  // the secret — it reveals live game state.
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";

  const started = Date.now();
  const summary = await sweep(dryRun);
  const durationMs = Date.now() - started;

  // Structured and free of secrets, tokens and child identifiers. Game ids are
  // included only for rows that failed, which is the minimum needed to
  // diagnose one.
  console.log(
    JSON.stringify({ at: "cron/settle-games", graceMs: SETTLEMENT_GRACE_MS, durationMs, ...summary })
  );

  return NextResponse.json({ ok: true, durationMs, ...summary });
}

/** Vercel Cron issues GET. POST is accepted so the endpoint can be triggered
 *  manually with the same secret during an incident. */
export const POST = GET;

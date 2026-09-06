import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ACTIVE_CHILD_COOKIE_NAME } from "@/lib/childSession";
import { resolveActiveChildCached } from "@/lib/supabase/queries";
import { DRAW_OFFER_PREFIX } from "@/content/quickChat";
import { verifyGame, decideCompletion, colorOf, type CompletionIntent } from "@/lib/online/verifyGame";

/**
 * The authoritative way a rated game ends.
 *
 * Before this, the client decided results. finish_online_game_by_result took
 * p_winner verbatim, so a participant could declare themselves the winner of a
 * live rated game — demonstrated with zero moves played, and rated for it. And
 * submit_online_move stores the client's own FEN and SAN with no validation,
 * so the recorded position was only ever the client's claim.
 *
 * Here the client sends an INTENT — resign, claim_result, accept_draw — and
 * never a winner. The server reads the stored moves, replays them from the
 * starting position with chess.js, and decides:
 *
 *   * an illegal move stream cannot complete at all
 *   * a claimed result must actually exist in the replayed position
 *   * a resignation always makes the OPPONENT the winner, derived from who is
 *     asking rather than from what they sent
 *   * a draw by agreement requires a real outstanding offer on the game row
 *
 * Postgres cannot do this; there is no chess engine in the database. This route
 * is the smallest trusted boundary that can, and it already exists in the
 * stack — no new service, no external API.
 *
 * It also settles the rating itself, so a finished game no longer depends on a
 * client staying alive long enough to call apply_match_rating.
 */

const VALID_INTENTS: CompletionIntent[] = ["resign", "claim_result", "accept_draw"];

export async function POST(req: NextRequest, { params }: { params: { gameId: string } }) {
  // 1. Who is asking? Cookie session only — never a body-supplied identity.
  const supabase = createClient();
  const user = await getSessionUser(supabase);
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  let intent: CompletionIntent;
  try {
    const body = await req.json();
    intent = body?.intent;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!VALID_INTENTS.includes(intent)) {
    return NextResponse.json({ error: "invalid_intent" }, { status: 400 });
  }

  const cookieChildId = cookies().get(ACTIVE_CHILD_COOKIE_NAME)?.value ?? null;
  const resolution = await resolveActiveChildCached(supabase, user.id, cookieChildId);
  const child = resolution.child;
  if (!child) {
    return NextResponse.json({ error: "no_active_child" }, { status: 403 });
  }

  // 2. Read the authoritative row with the service role. The caller's own
  //    session is used for identity, never for reading the result they want.
  const admin = getSupabaseAdmin();
  const { data: game, error: readError } = await admin
    .from("online_games")
    .select(
      "id, host_child_id, guest_child_id, host_color, status, winner, moves, match_type, host_reaction, guest_reaction"
    )
    .eq("id", params.gameId)
    .maybeSingle();

  if (readError || !game) {
    return NextResponse.json({ error: "game_not_found" }, { status: 404 });
  }

  // 3. Participation is checked server-side against the row.
  const isHost = game.host_child_id === child.id;
  const isGuest = game.guest_child_id === child.id;
  if (!isHost && !isGuest) {
    return NextResponse.json({ error: "not_a_participant" }, { status: 403 });
  }

  // Already finished: report the settled result rather than re-deciding it.
  // This is what makes duplicate and concurrent requests harmless.
  if (game.status !== "active") {
    return NextResponse.json({ status: game.status, winner: game.winner, settled: true });
  }

  const requesterColor = colorOf(child.id, game.host_child_id, game.host_color as "w" | "b");
  if (!requesterColor) {
    return NextResponse.json({ error: "not_a_participant" }, { status: 403 });
  }

  // 4. Replay the stored moves and decide.
  const verified = verifyGame((game.moves as string[]) ?? []);
  const opponentReaction = (isHost ? game.guest_reaction : game.host_reaction) as string | null;
  const opponentOfferedDraw = Boolean(opponentReaction?.startsWith(DRAW_OFFER_PREFIX));

  const decision = decideCompletion({
    intent,
    verified,
    requesterColor,
    opponentOfferedDraw,
  });

  if (!decision.allowed || !decision.winner) {
    return NextResponse.json(
      { error: "rejected", reason: decision.reason, termination: verified.termination },
      { status: 409 }
    );
  }

  // 5. Finish the game. finish_online_game_by_result is a no-op once the game
  //    is no longer active, so two racing requests settle it exactly once.
  const { error: finishError } = await admin.rpc("finish_online_game_by_result", {
    p_game_id: game.id,
    p_child_id: child.id,
    p_winner: decision.winner,
  });
  if (finishError) {
    return NextResponse.json({ error: "finish_failed", detail: finishError.message }, { status: 500 });
  }

  // 6. Settle the rating here rather than leaving it to the client. Previously
  //    a finished rated game was only rated if a browser stayed open long
  //    enough to call this; both players closing the tab left it unrated
  //    forever. apply_match_rating is idempotent (rating_applied), so a
  //    concurrent settlement is safe.
  if (game.match_type === "random") {
    const { error: rateError } = await admin.rpc("apply_match_rating", { p_game_id: game.id });
    if (rateError) {
      // The result is recorded and correct; only the rating failed. Report it
      // rather than pretending the whole request failed.
      return NextResponse.json(
        { status: "finished", winner: decision.winner, rated: false, reason: decision.reason },
        { status: 200 }
      );
    }
  }

  return NextResponse.json({
    status: "finished",
    winner: decision.winner,
    rated: game.match_type === "random",
    reason: decision.reason,
    termination: verified.termination,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ACTIVE_CHILD_COOKIE_NAME } from "@/lib/childSession";
import { resolveActiveChildCached } from "@/lib/supabase/queries";
import { colorOf } from "@/lib/online/verifyGame";
import { validateMove, type MoveIntent } from "@/lib/online/moveValidation";

/**
 * The authoritative way a move is played.
 *
 * submit_online_move gets ownership, participation, turn and the clock right,
 * but it never looked at the chess: it wrote the client's own p_fen and p_san
 * verbatim, so the stored position was only ever the browser's claim. A client
 * could record any position it liked. (It also returns early for untimed games
 * before its own turn check, so those had no turn enforcement at all.)
 *
 * The browser now sends { from, to, promotion } and nothing else. This route
 * replays the authoritative history, validates the move, and generates the SAN
 * and FEN itself. Those server-generated values are then handed to
 * submit_online_move, which keeps doing the part it already does well — the
 * clock arithmetic on server time, the turn flip, the flag-fall — rather than
 * that logic being reimplemented here and drifting.
 *
 * Postgres cannot validate chess; there is no engine in it. This route is the
 * smallest trusted place that can, and it needs no new service.
 */

export async function POST(req: NextRequest, { params }: { params: { gameId: string } }) {
  const supabase = createClient();
  const user = await getSessionUser(supabase);
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  let intent: MoveIntent;
  try {
    const body = await req.json();
    intent = {
      from: body?.from,
      to: body?.to,
      promotion: body?.promotion,
      expectedPly: typeof body?.expectedPly === "number" ? body.expectedPly : undefined,
    };
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const cookieChildId = cookies().get(ACTIVE_CHILD_COOKIE_NAME)?.value ?? null;
  const resolution = await resolveActiveChildCached(supabase, user.id, cookieChildId);
  const child = resolution.child;
  if (!child) return NextResponse.json({ error: "no_active_child" }, { status: 403 });

  const admin = getSupabaseAdmin();
  const { data: game, error: readError } = await admin
    .from("online_games")
    .select("id, host_child_id, guest_child_id, host_color, status, moves, match_type")
    .eq("id", params.gameId)
    .maybeSingle();

  if (readError || !game) return NextResponse.json({ error: "game_not_found" }, { status: 404 });

  // A spectator — anyone who is not one of the two players — can never move.
  const isHost = game.host_child_id === child.id;
  const isGuest = game.guest_child_id === child.id;
  if (!isHost && !isGuest) {
    return NextResponse.json({ error: "not_a_participant" }, { status: 403 });
  }
  if (game.status !== "active") {
    return NextResponse.json({ error: "game_not_active", status: game.status }, { status: 409 });
  }

  // Colour comes from the row, never from the request body.
  const moverColor = colorOf(child.id, game.host_child_id, game.host_color as "w" | "b");
  if (!moverColor) return NextResponse.json({ error: "not_a_participant" }, { status: 403 });

  const result = validateMove((game.moves as string[]) ?? [], intent, moverColor);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason, detail: result.detail }, { status: 409 });
  }

  // Persist through the existing function, with SERVER-generated chess state.
  // It re-checks ownership, participation, active status and turn under a row
  // lock, and owns the clock arithmetic — so two racing moves serialise there.
  const { data: moveRows, error: moveError } = await admin.rpc("submit_online_move_as_server", {
    p_game_id: game.id,
    p_child_id: child.id,
    p_fen: result.fen,
    p_san: result.san,
  });
  if (moveError) {
    return NextResponse.json({ error: "move_failed", detail: moveError.message }, { status: 409 });
  }

  const row = Array.isArray(moveRows) ? moveRows[0] : null;
  // The clock may have fallen during this very move, in which case
  // submit_online_move has already finished the game and the result below is
  // the flag, not the chess.
  const flagged = row?.status === "finished";

  let finalStatus: string = flagged ? "finished" : "active";
  let finalWinner: string | null = flagged ? (row?.winner ?? null) : null;

  // The move itself ended the game: mate, stalemate, or a drawn position.
  if (!flagged && result.endsGame) {
    const winner = result.winner ?? "draw";
    const { error: finishError } = await admin.rpc("finish_online_game_by_result_as_server", {
      p_game_id: game.id,
      p_child_id: child.id,
      p_winner: winner,
    });
    if (!finishError) {
      finalStatus = "finished";
      finalWinner = winner;
    }
  }

  // Settle the rating here rather than depending on a browser staying open.
  // apply_match_rating is idempotent, so a concurrent settlement is harmless.
  if (finalStatus === "finished" && game.match_type === "random") {
    // The result is already recorded; a failed settlement must not fail the
    // move the player just made.
    const { error: rateError } = await admin.rpc("apply_match_rating", { p_game_id: game.id });
    if (rateError) {
      return NextResponse.json({
        ok: true,
        san: result.san,
        fen: result.fen,
        turn: result.turn,
        plies: result.plies,
        status: finalStatus,
        winner: finalWinner,
        rated: false,
        termination: flagged ? "timeout" : result.termination,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    san: result.san,
    fen: result.fen,
    turn: result.turn,
    plies: result.plies,
    status: finalStatus,
    winner: finalWinner,
    termination: flagged ? "timeout" : result.termination,
    whiteTimeMs: row?.white_time_ms ?? null,
    blackTimeMs: row?.black_time_ms ?? null,
  });
}

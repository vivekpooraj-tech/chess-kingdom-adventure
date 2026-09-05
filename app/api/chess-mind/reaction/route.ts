import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Chess } from "chess.js";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { ACTIVE_CHILD_COOKIE_NAME } from "@/lib/childSession";
import { resolveActiveChildCached } from "@/lib/supabase/queries";
import { selectTacticsPuzzle } from "@/lib/puzzles/tacticsLibrary.server";
import type { TacticsTier } from "@/lib/puzzles/tacticsTypes";
import type { ReactionChallenge, ReactionOption, ReactionResponse } from "@/lib/chessMind/reactionTypes";

/**
 * Serve ONE reaction challenge.
 *
 * Same architecture as /api/puzzles/next, for the same reason: the 5,000-puzzle
 * library stays on the server and the browser receives only the single position
 * it is about to be shown. A reaction trainer that shipped its own position set
 * to the client would undo that.
 *
 * The decoys matter pedagogically. Three random legal moves would make the
 * right answer obvious — it would be the only forcing one. So decoys are drawn
 * preferentially from the position's other checks and captures, which forces
 * the learner to actually distinguish between forcing moves rather than spot
 * the only one.
 */
const TIERS: TacticsTier[] = ["beginner", "intermediate", "advanced"];

/** Difficulty follows the current streak: three in a row moves you up a band. */
function tierForStreak(streak: number): TacticsTier {
  if (streak >= 12) return "advanced";
  if (streak >= 5) return "intermediate";
  return "beginner";
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const user = await getSessionUser(supabase);
  if (!user) {
    return NextResponse.json({ challenge: null } satisfies ReactionResponse, { status: 401 });
  }

  const cookieChildId = cookies().get(ACTIVE_CHILD_COOKIE_NAME)?.value ?? null;
  const resolution = await resolveActiveChildCached(supabase, user.id, cookieChildId);
  if (!resolution.child) {
    return NextResponse.json({ challenge: null } satisfies ReactionResponse);
  }

  const url = new URL(req.url);
  const streak = Math.max(0, Math.min(999, Number(url.searchParams.get("streak") ?? 0) || 0));
  const requestedTier = url.searchParams.get("tier");
  const tier =
    requestedTier && TIERS.includes(requestedTier as TacticsTier)
      ? (requestedTier as TacticsTier)
      : tierForStreak(streak);

  const exclude = new Set(
    (url.searchParams.get("exclude") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 50)
  );

  // A reaction challenge must be decidable at a glance, so ask for a one-move
  // idea: anything needing a long line is a calculation exercise, not this.
  let puzzle = selectTacticsPuzzle({ skill: null, tier, exclude });
  for (let i = 0; i < 6 && puzzle && puzzle.solution.length > 3; i++) {
    exclude.add(puzzle.id);
    puzzle = selectTacticsPuzzle({ skill: null, tier, exclude });
  }
  if (!puzzle) {
    return NextResponse.json({ challenge: null } satisfies ReactionResponse);
  }

  const game = new Chess(puzzle.fen);
  const uci = puzzle.solution[0];
  const correct = game.moves({ verbose: true }).find(
    (m) => m.from === uci.slice(0, 2) && m.to === uci.slice(2, 4)
  );
  if (!correct) {
    // The library is validated, so this should not happen; if it ever does,
    // fail closed rather than serve a challenge with no right answer.
    return NextResponse.json({ challenge: null } satisfies ReactionResponse);
  }

  const others = game.moves({ verbose: true }).filter((m) => !(m.from === correct.from && m.to === correct.to));
  // Prefer forcing decoys so the answer is not simply "the only check".
  const forcing = others.filter((m) => m.san.includes("+") || m.captured);
  const quiet = others.filter((m) => !m.san.includes("+") && !m.captured);
  const decoys = [...shuffle(forcing).slice(0, 3), ...shuffle(quiet)].slice(0, 3);

  const toOption = (m: (typeof others)[number]): ReactionOption => ({
    from: m.from,
    to: m.to,
    san: m.san,
    ...(m.promotion ? { promotion: m.promotion } : {}),
  });

  const options = shuffle([toOption(correct), ...decoys.map(toOption)]);
  const correctIndex = options.findIndex((o) => o.from === correct.from && o.to === correct.to);

  const challenge: ReactionChallenge = {
    id: puzzle.id,
    fen: puzzle.fen,
    sideToMove: puzzle.sideToMove,
    options,
    correctIndex,
    rating: puzzle.rating,
    tier,
  };

  return NextResponse.json({ challenge } satisfies ReactionResponse, {
    headers: { "Cache-Control": "no-store" },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { ACTIVE_CHILD_COOKIE_NAME } from "@/lib/childSession";
import { resolveActiveChildCached, getSolvedPuzzleIds } from "@/lib/supabase/queries";
import { getMatePuzzleById, selectMatePuzzle } from "@/lib/puzzles/matePool.server";
import type { MatePuzzleResponse } from "@/lib/puzzles/mateTypes";

/**
 * Serve ONE mate puzzle from content/puzzles.ts.
 *
 * Exists so the Puzzle Trainer no longer has to import the pool. The page
 * previously shipped all 1,000 puzzles to the browser in order to look up a
 * single one; now it asks for the one it needs (~150 bytes).
 *
 * Two modes, matching what the trainer actually does:
 *   ?id=<puzzleId>  — the Daily Challenge / any deep link. Returns that exact
 *                     puzzle, or null if the id is unknown, so the client can
 *                     fall back to a random pick exactly as it did before.
 *   (no id)         — free practice. A random puzzle the child has not solved
 *                     and has not seen recently on this device.
 *
 * Solved ids come from puzzle_library_solves server-side (durable, per child);
 * `exclude` carries the client's per-device recency list. That split is
 * deliberate — see lib/puzzles/recentPuzzles.ts.
 */
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const user = await getSessionUser(supabase);
  if (!user) {
    return NextResponse.json({ puzzle: null, solvedIds: [] } satisfies MatePuzzleResponse, {
      status: 401,
    });
  }

  const cookieChildId = cookies().get(ACTIVE_CHILD_COOKIE_NAME)?.value ?? null;
  // Goes through RLS on `children`, so this only ever resolves a child the
  // caller owns.
  const resolution = await resolveActiveChildCached(supabase, user.id, cookieChildId);
  const child = resolution.child;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const exclude = new Set(
    (url.searchParams.get("exclude") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      // Capped so a crafted request can't build an enormous set.
      .slice(0, 50)
  );

  const solvedIds = child
    ? await getSolvedPuzzleIds(supabase, child.id).catch(() => [] as string[])
    : [];

  // An explicit id always wins — the Daily Challenge must open its own puzzle
  // regardless of whether the child has solved it before.
  if (id) {
    const puzzle = getMatePuzzleById(id);
    if (puzzle) {
      return NextResponse.json({ puzzle, solvedIds } satisfies MatePuzzleResponse, {
        headers: { "Cache-Control": "no-store" },
      });
    }
    // Unknown id: fall through to a random pick rather than erroring, which is
    // what the client-side lookup effectively did with a bad ?id=.
  }

  const puzzle = selectMatePuzzle({ solved: new Set(solvedIds), exclude });
  return NextResponse.json({ puzzle, solvedIds } satisfies MatePuzzleResponse, {
    headers: { "Cache-Control": "no-store" },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { ACTIVE_CHILD_COOKIE_NAME } from "@/lib/childSession";
import { resolveActiveChildCached } from "@/lib/supabase/queries";
import { PARENT_PREMIUM_COLUMNS, resolvePremiumState } from "@/lib/premium/entitlement";
import { loadExerciseHistory } from "@/lib/trainYourMind/exerciseHistory";
import { LEVEL_NAMES, clampLevel, isEngineCategory, isLevelAllowed, type TrainResponse } from "@/lib/trainYourMind/curriculum";
import { familiesFor, pickExercise } from "@/lib/trainYourMind/engine/pool";
import { getPoolIndex, getTrainPuzzles } from "@/lib/trainYourMind/engine/library.server";
import { readServeGate } from "@/lib/trainYourMind/dailyLimitServer";

/**
 * Serve ONE Train Your Chess Mind exercise (all categories except Reaction, which
 * has its own timed route).
 *
 * Why a route and not client-side generation:
 *  - the puzzle library stays on the server; the browser receives only the one
 *    exercise it is about to solve;
 *  - Premium levels are enforced HERE — a locked level never leaves the server
 *    (same pattern as /api/academy/lesson), so opening dev tools cannot unlock it;
 *  - selection reads the child's persistent history (Phase 1) so an exercise seen
 *    recently on ANY device is avoided.
 *
 * The free daily cap (3 completed exercises per category, per child, per day) is enforced here
 * at serve time and, authoritatively, when a completion is recorded
 * (record_train_your_mind_completion, migration 0055).
 */
export async function GET(req: NextRequest) {
  const none = (body: TrainResponse, status = 200) =>
    NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

  const supabase = createClient();
  const user = await getSessionUser(supabase);
  if (!user) return none({ exercise: null }, 401);

  const url = new URL(req.url);
  const category = url.searchParams.get("category");
  if (!isEngineCategory(category)) return none({ exercise: null }, 400);
  const level = clampLevel(Number(url.searchParams.get("level") ?? 1) || 1);

  const cookieChildId = cookies().get(ACTIVE_CHILD_COOKIE_NAME)?.value ?? null;
  const resolution = await resolveActiveChildCached(supabase, user.id, cookieChildId);
  if (!resolution.child) return none({ exercise: null });

  const { data: parent } = await supabase
    .from("parents")
    .select(PARENT_PREMIUM_COLUMNS)
    .eq("auth_user_id", user.id)
    .maybeSingle();
  const isPremium = resolvePremiumState(parent).isPremium;

  // Free daily limit: 3 completed exercises PER CATEGORY, per child, per day (the categories
  // are counted independently), read from the database. A free child who has used all 3 slots
  // in THIS category is never served a 4th, from any device. Premium skips this entirely.
  if (!isPremium) {
    const gate = await readServeGate(supabase, resolution.child.id, category, url.searchParams.get("d"));
    if (gate && !gate.allowed) return none({ exercise: null, dailyLimit: { used: gate.used, limit: gate.limit } });
  }

  if (!isLevelAllowed(level, isPremium)) {
    return none({ exercise: null, locked: { level, levelName: LEVEL_NAMES[level], reason: "premium" } });
  }

  const index = getPoolIndex();
  if (!index) return none({ exercise: null }, 503);

  const exclude = (url.searchParams.get("exclude") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 60);
  const lastFamily = url.searchParams.get("lastFamily");

  const history = await loadExerciseHistory(supabase, resolution.child.id, category);
  const puzzles = getTrainPuzzles();

  // Reinforcement: after repeated mistakes in one family, serve an easier exercise
  // of that family. Falls back to a normal pick if that family has none there.
  const reinforce = url.searchParams.get("family");
  let picked = null;
  if (reinforce && familiesFor(category).some((f) => f.id === reinforce)) {
    const easier = clampLevel(Math.max(1, level - 1));
    picked = pickExercise(index, puzzles, { category, level: easier, history, exclude, lastFamily, onlyFamily: reinforce });
  }
  // Optional mode (e.g. Reaction's "check recognition"): restrict to that family.
  const mode = url.searchParams.get("mode");
  if (!picked && mode && familiesFor(category).some((f) => f.id === mode)) {
    picked = pickExercise(index, puzzles, { category, level, history, exclude, lastFamily, onlyFamily: mode });
  }
  if (!picked) picked = pickExercise(index, puzzles, { category, level, history, exclude, lastFamily });
  if (!picked) return none({ exercise: null }, 404);

  return none({ exercise: picked.exercise, servedLevel: picked.servedLevel });
}

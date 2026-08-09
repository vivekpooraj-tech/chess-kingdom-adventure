import type { SupabaseClient } from "@supabase/supabase-js";

export interface ChildProfile {
  id: string;
  display_name: string;
  avatar_id: string | null;
  buddy_id: string | null;
  board_skin_id: string;
  piece_set_id: string;
  rating: number;
  current_day: number;
}

/**
 * This v1 slice supports exactly one child per parent account — the
 * multi-child profile switcher from the full PRD is Phase 2. Every caller
 * gets (or lazily creates) that single child row.
 *
 * The `public.parents` row always exists by the time this runs (created by
 * the `on_auth_user_created` trigger in 0001_init.sql the moment someone
 * signs up) — so a missing *child* row is the only case this needs to handle.
 *
 * Kept for internal use by resolveActiveChild() below (it's the "create the
 * very first child" step) — direct callers elsewhere should use
 * resolveActiveChild() instead, which handles multiple children correctly.
 */
export async function getOrCreateChild(
  supabase: SupabaseClient,
  authUserId: string
): Promise<ChildProfile> {
  const { data: parent, error: parentError } = await supabase
    .from("parents")
    .select("id")
    .eq("auth_user_id", authUserId)
    .single();

  if (parentError || !parent) {
    throw new Error(
      "No parent record found for this account — the signup trigger should have created one."
    );
  }

  const { data: existingChild } = await supabase
    .from("children")
    .select("*")
    .eq("parent_id", parent.id)
    .limit(1)
    .maybeSingle();

  if (existingChild) return existingChild as ChildProfile;

  const { data: newChild, error: insertError } = await supabase
    .from("children")
    .insert({ parent_id: parent.id })
    .select()
    .single();

  if (insertError || !newChild) {
    throw new Error(insertError?.message ?? "Failed to create child profile");
  }

  return newChild as ChildProfile;
}

export async function getChildrenForParent(
  supabase: SupabaseClient,
  authUserId: string
): Promise<ChildProfile[]> {
  const { data: parent } = await supabase
    .from("parents")
    .select("id")
    .eq("auth_user_id", authUserId)
    .single();
  if (!parent) return [];

  const { data, error } = await supabase
    .from("children")
    .select("*")
    .eq("parent_id", parent.id)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ChildProfile[];
}

export async function createChild(
  supabase: SupabaseClient,
  authUserId: string,
  displayName: string
): Promise<ChildProfile> {
  const { data: parent, error: parentError } = await supabase
    .from("parents")
    .select("id")
    .eq("auth_user_id", authUserId)
    .single();
  if (parentError || !parent) throw parentError ?? new Error("No parent record found");

  const { data: newChild, error } = await supabase
    .from("children")
    .insert({ parent_id: parent.id, display_name: displayName })
    .select()
    .single();
  if (error || !newChild) throw error ?? new Error("Failed to create child profile");
  return newChild as ChildProfile;
}

export interface ActiveChildResolution {
  /** The resolved child, or null if the caller must show the profile picker. */
  child: ChildProfile | null;
  /** True when there's more than one child and no valid selection yet. */
  needsSelection: boolean;
  /** Every child on this account — the picker UI needs this either way. */
  allChildren: ChildProfile[];
}

/**
 * The core multi-child resolution logic, used by every page that needs "the
 * current child": zero children -> create the first one (old single-child
 * behavior, zero friction); exactly one child -> just use it (no picker ever
 * shown for single-child families); multiple children -> use the cookie's
 * choice if it's valid, otherwise signal that a picker is needed.
 */
export async function resolveActiveChild(
  supabase: SupabaseClient,
  authUserId: string,
  activeChildIdFromCookie: string | null
): Promise<ActiveChildResolution> {
  const allChildren = await getChildrenForParent(supabase, authUserId);

  if (allChildren.length === 0) {
    const created = await getOrCreateChild(supabase, authUserId);
    return { child: created, needsSelection: false, allChildren: [created] };
  }

  if (allChildren.length === 1) {
    return { child: allChildren[0], needsSelection: false, allChildren };
  }

  const matched = activeChildIdFromCookie
    ? allChildren.find((c) => c.id === activeChildIdFromCookie)
    : undefined;

  if (matched) {
    return { child: matched, needsSelection: false, allChildren };
  }

  return { child: null, needsSelection: true, allChildren };
}

export async function updateChildAvatar(
  supabase: SupabaseClient,
  childId: string,
  avatarId: string
) {
  const { error } = await supabase
    .from("children")
    .update({ avatar_id: avatarId })
    .eq("id", childId);
  if (error) throw error;
}

export async function updateChildBuddy(
  supabase: SupabaseClient,
  childId: string,
  buddyId: string
) {
  const { error } = await supabase
    .from("children")
    .update({ buddy_id: buddyId })
    .eq("id", childId);
  if (error) throw error;
}

export async function updateChildBoardSkin(
  supabase: SupabaseClient,
  childId: string,
  boardSkinId: string
) {
  const { error } = await supabase
    .from("children")
    .update({ board_skin_id: boardSkinId })
    .eq("id", childId);
  if (error) throw error;
}

export async function updateChildPieceSet(
  supabase: SupabaseClient,
  childId: string,
  pieceSetId: string
) {
  const { error } = await supabase
    .from("children")
    .update({ piece_set_id: pieceSetId })
    .eq("id", childId);
  if (error) throw error;
}

/**
 * Writes through mark_lesson_complete() (see
 * supabase/migrations/0009_mark_lesson_complete_rpc.sql) instead of a plain
 * client-side upsert — the day-limit/premium check has to happen
 * server-side, since a client-supplied "trust me, this is allowed" can't be
 * trusted from a browser console. Throws if the RPC rejects the day (e.g.
 * a locked day on a free account) — callers should only ever reach this
 * from a UI state that's already confirmed the day is unlocked, so a throw
 * here means something upstream let it through incorrectly, not a normal
 * user-facing case to catch and recover from silently.
 */
export async function markLessonComplete(
  supabase: SupabaseClient,
  childId: string,
  dayNumber: number
) {
  const { error } = await supabase.rpc("mark_lesson_complete", {
    p_child_id: childId,
    p_day_number: dayNumber,
  });
  if (error) throw error;
}

export async function getCompletedDays(
  supabase: SupabaseClient,
  childId: string
): Promise<number[]> {
  const { data, error } = await supabase
    .from("child_lesson_progress")
    .select("day_number")
    .eq("child_id", childId)
    .eq("status", "completed");
  if (error) throw error;
  return (data ?? []).map((r) => r.day_number);
}

/** Today's date as YYYY-MM-DD in the *local* timezone (not UTC) — see the
 * comment in supabase/migrations/0002_screen_time_usage.sql for why. */
export function localDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export interface ScreenTimeLimits {
  weekdayMinutes: number;
  weekendMinutes: number;
}

export async function getScreenTimeLimits(
  supabase: SupabaseClient,
  authUserId: string
): Promise<ScreenTimeLimits> {
  const { data, error } = await supabase
    .from("parents")
    .select("screen_time_weekday_minutes, screen_time_weekend_minutes")
    .eq("auth_user_id", authUserId)
    .single();
  if (error || !data) throw error ?? new Error("No parent record found");
  return {
    weekdayMinutes: data.screen_time_weekday_minutes,
    weekendMinutes: data.screen_time_weekend_minutes,
  };
}

export async function getTodayUsageMinutes(
  supabase: SupabaseClient,
  childId: string,
  dateStr: string
): Promise<number> {
  const { data, error } = await supabase
    .from("screen_time_usage")
    .select("minutes_used")
    .eq("child_id", childId)
    .eq("usage_date", dateStr)
    .maybeSingle();
  if (error) throw error;
  return data?.minutes_used ?? 0;
}

/** Total screen-time minutes over the last `days` days (today inclusive) —
 * real usage already recorded by addUsageMinutes, just summed for the
 * Parent Dashboard's "Time spent" section (Phase 10B point 22). */
export async function getRecentUsageMinutes(
  supabase: SupabaseClient,
  childId: string,
  days = 7
): Promise<number> {
  const since = localDateString(new Date(Date.now() - (days - 1) * 86_400_000));
  const { data, error } = await supabase
    .from("screen_time_usage")
    .select("minutes_used")
    .eq("child_id", childId)
    .gte("usage_date", since);
  if (error) throw error;
  return (data ?? []).reduce((sum, row) => sum + row.minutes_used, 0);
}

/**
 * Adds `minutesToAdd` to today's usage and returns the new total. Read-then-
 * write rather than a single atomic increment — acceptable because a child
 * has exactly one active device/tab in this v1 (see getOrCreateChild), so
 * there's no real concurrent-write race to worry about yet.
 */
export async function addUsageMinutes(
  supabase: SupabaseClient,
  childId: string,
  dateStr: string,
  minutesToAdd: number
): Promise<number> {
  const current = await getTodayUsageMinutes(supabase, childId, dateStr);
  const next = current + minutesToAdd;
  const { error } = await supabase.from("screen_time_usage").upsert(
    { child_id: childId, usage_date: dateStr, minutes_used: next },
    { onConflict: "child_id,usage_date" }
  );
  if (error) throw error;
  return next;
}

export async function getEarnedAchievementKeys(
  supabase: SupabaseClient,
  childId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from("child_achievements")
    .select("achievement_key")
    .eq("child_id", childId);
  if (error) throw error;
  return (data ?? []).map((r) => r.achievement_key);
}

/**
 * Checks every achievement definition against the child's current real
 * state (completed days + premium status) and awards any newly-earned ones.
 * Safe to call repeatedly (e.g. on every lesson completion and every
 * Kingdom Map load) — already-earned achievements are skipped via the
 * unique(child_id, achievement_key) constraint, so this never double-awards.
 *
 * Returns the achievement keys newly earned THIS call, so the UI can
 * celebrate them if it wants to.
 */
export async function evaluateAndAwardAchievements(
  supabase: SupabaseClient,
  childId: string,
  completedDays: number[],
  isPremium: boolean,
  completedAcademyIds: string[] = [],
  openingEncounters: OpeningEncounterDetail[] = [],
  chessMindTotalSolved = 0,
  onlineWinsCount = 0
): Promise<string[]> {
  // Imported here (not at module top) to avoid a circular import between
  // lib/supabase and content/ — this file is the only place that needs them.
  const { ACHIEVEMENTS } = await import("@/content/achievements");
  const { OPENINGS } = await import("@/content/openings");
  const { MASTERY_THRESHOLD } = await import("@/lib/openings/practiceTracking");
  const openingsById = new Map(OPENINGS.map((o) => [o.id, o]));

  const alreadyEarned = new Set(await getEarnedAchievementKeys(supabase, childId));
  const newlyEarned: string[] = [];

  const discoveredIds = openingEncounters.filter((e) => e.first_seen_at).map((e) => e.opening_id);
  const studiedIds = openingEncounters.filter((e) => e.studied_at).map((e) => e.opening_id);
  const gambitDiscoveredCount = discoveredIds.filter((id) => openingsById.get(id)?.isGambit).length;
  const masteredCount = openingEncounters.filter((e) => e.practice_successes >= MASTERY_THRESHOLD).length;

  for (const achievement of ACHIEVEMENTS) {
    if (alreadyEarned.has(achievement.key)) continue;

    let earned = false;
    if (achievement.criteria.type === "complete_day") {
      earned = completedDays.includes(achievement.criteria.day);
    } else if (achievement.criteria.type === "complete_count") {
      earned = completedDays.length >= achievement.criteria.count;
    } else if (achievement.criteria.type === "premium") {
      earned = isPremium;
    } else if (achievement.criteria.type === "academy_complete") {
      earned = completedAcademyIds.includes(achievement.criteria.contentId);
    } else if (achievement.criteria.type === "opening_count") {
      earned = discoveredIds.length >= achievement.criteria.count;
    } else if (achievement.criteria.type === "opening_studied_count") {
      earned = studiedIds.length >= achievement.criteria.count;
    } else if (achievement.criteria.type === "gambit_count") {
      earned = gambitDiscoveredCount >= achievement.criteria.count;
    } else if (achievement.criteria.type === "opening_mastered_count") {
      earned = masteredCount >= achievement.criteria.count;
    } else if (achievement.criteria.type === "chess_mind_count") {
      earned = chessMindTotalSolved >= achievement.criteria.count;
    } else if (achievement.criteria.type === "online_wins") {
      earned = onlineWinsCount >= achievement.criteria.count;
    }

    if (earned) {
      const { error } = await supabase
        .from("child_achievements")
        .upsert(
          { child_id: childId, achievement_key: achievement.key },
          { onConflict: "child_id,achievement_key", ignoreDuplicates: true }
        );
      if (!error) newlyEarned.push(achievement.key);
    }
  }

  return newlyEarned;
}

// --- Online multiplayer -----------------------------------------------

export interface OnlineGame {
  id: string;
  host_child_id: string;
  guest_child_id: string | null;
  host_color: "w" | "b";
  fen: string;
  status: "waiting" | "active" | "finished";
  winner: "w" | "b" | "draw" | null;
  host_reaction: string | null;
  guest_reaction: string | null;
  /** "random" games (worldwide matchmaking) hide quick-chat/emoji in the
   * UI and settle rating changes on finish — "invite" games (the
   * original friend-link mode) are unaffected. */
  match_type: "invite" | "random";
  /** Full SAN move history, appended to by whichever client makes each
   * move — see appendGameMove(). Needed for opening recognition, since
   * ChessBoard's own move history resets whenever its `fen` prop changes
   * (which happens every move here, driven by Realtime sync). */
  moves: string[];
}

export async function createOnlineGame(
  supabase: SupabaseClient,
  hostChildId: string
): Promise<OnlineGame> {
  const { data, error } = await supabase
    .from("online_games")
    .insert({ host_child_id: hostChildId })
    .select()
    .single();
  if (error || !data) throw error ?? new Error("Failed to create game");
  return data as OnlineGame;
}

export async function getOnlineGame(
  supabase: SupabaseClient,
  gameId: string
): Promise<OnlineGame | null> {
  const { data, error } = await supabase
    .from("online_games")
    .select("*")
    .eq("id", gameId)
    .maybeSingle();
  if (error) throw error;
  return data as OnlineGame | null;
}

/**
 * Compare-and-swap join: the `.is('guest_child_id', null)` filter means
 * this UPDATE matches zero rows (and returns false) if someone already
 * claimed the guest slot between this player loading the page and clicking
 * join — RLS alone can't express that race-safety, so the app query does.
 */
export async function joinOnlineGame(
  supabase: SupabaseClient,
  gameId: string,
  guestChildId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("online_games")
    .update({ guest_child_id: guestChildId, status: "active" })
    .eq("id", gameId)
    .is("guest_child_id", null)
    .select();
  if (error) throw error;
  return (data ?? []).length > 0;
}

export async function updateGameFen(
  supabase: SupabaseClient,
  gameId: string,
  fen: string
): Promise<void> {
  const { error } = await supabase.from("online_games").update({ fen }).eq("id", gameId);
  if (error) throw error;
}

/**
 * Updates the position AND appends the move that produced it, in one
 * write. Read-then-write on `moves` — safe here because only the player
 * who just made a move calls this for that move, so there's no concurrent
 * writer racing to append the same slot (same reasoning as
 * addUsageMinutes elsewhere in this file).
 */
export async function appendGameMove(
  supabase: SupabaseClient,
  gameId: string,
  fen: string,
  san: string
): Promise<void> {
  const { data: current } = await supabase
    .from("online_games")
    .select("moves")
    .eq("id", gameId)
    .single();
  const moves = [...(current?.moves ?? []), san];
  const { error } = await supabase.from("online_games").update({ fen, moves }).eq("id", gameId);
  if (error) throw error;
}

export async function finishOnlineGame(
  supabase: SupabaseClient,
  gameId: string,
  winner: "w" | "b" | "draw"
): Promise<void> {
  const { error } = await supabase
    .from("online_games")
    .update({ status: "finished", winner })
    .eq("id", gameId);
  if (error) throw error;
}

export async function sendReaction(
  supabase: SupabaseClient,
  gameId: string,
  isHost: boolean,
  reaction: string
): Promise<void> {
  const field = isHost ? "host_reaction" : "guest_reaction";
  const { error } = await supabase
    .from("online_games")
    .update({ [field]: reaction })
    .eq("id", gameId);
  if (error) throw error;
}

// --- Random matchmaking (rating-based, post-course-completion) ----------

export interface MatchmakingResult {
  matched: boolean;
  gameId: string | null;
}

/**
 * Atomically pairs with the closest-rated waiting opponent, or enqueues
 * the caller if nobody's waiting — see find_or_create_match() in
 * supabase/migrations/0008_matchmaking.sql for the actual matching logic
 * (it has to run server-side in a single transaction to be race-safe).
 */
export async function findOrCreateMatch(
  supabase: SupabaseClient,
  childId: string,
  rating: number
): Promise<MatchmakingResult> {
  const { data, error } = await supabase.rpc("find_or_create_match", {
    p_child_id: childId,
    p_rating: rating,
  });
  if (error) throw error;
  const row = data?.[0];
  return { matched: row?.matched ?? false, gameId: row?.game_id ?? null };
}

/** Leaves the queue — used both for an explicit "Cancel search" and as
 * cleanup if the child navigates away while still waiting. */
export async function cancelMatchmaking(supabase: SupabaseClient, childId: string): Promise<void> {
  const { error } = await supabase
    .from("matchmaking_queue")
    .delete()
    .eq("child_id", childId)
    .eq("status", "waiting");
  if (error) throw error;
}

/** Settles ELO-style rating changes for a finished random match — see
 * apply_match_rating() in the same migration for why this is safe to call
 * from either (or both) players' clients. */
export async function applyMatchRating(supabase: SupabaseClient, gameId: string): Promise<void> {
  const { error } = await supabase.rpc("apply_match_rating", { p_game_id: gameId });
  if (error) throw error;
}

// --- Puzzle accuracy tracking -------------------------------------------

export async function recordPuzzleAttempt(
  supabase: SupabaseClient,
  childId: string,
  dayNumber: number,
  isCorrect: boolean,
  attemptNumber: number
): Promise<void> {
  const { error } = await supabase.from("puzzle_attempts").insert({
    child_id: childId,
    day_number: dayNumber,
    is_correct: isCorrect,
    attempt_number: attemptNumber,
  });
  if (error) throw error;
}

export interface PuzzleAccuracyStats {
  totalAttempts: number;
  puzzlesSolved: number; // distinct days with at least one correct attempt
  firstTryCorrect: number; // distinct days solved on attempt_number === 1
}

export async function getPuzzleAccuracyStats(
  supabase: SupabaseClient,
  childId: string
): Promise<PuzzleAccuracyStats> {
  const { data, error } = await supabase
    .from("puzzle_attempts")
    .select("day_number, is_correct, attempt_number")
    .eq("child_id", childId);
  if (error) throw error;

  const rows = data ?? [];
  const solvedDays = new Set(rows.filter((r) => r.is_correct).map((r) => r.day_number));
  const firstTryDays = new Set(
    rows.filter((r) => r.is_correct && r.attempt_number === 1).map((r) => r.day_number)
  );

  return {
    totalAttempts: rows.length,
    puzzlesSolved: solvedDays.size,
    firstTryCorrect: firstTryDays.size,
  };
}

// --- Puzzle previews (free-tier daily sample of locked-day content) -----

export async function getTodayPreviewCount(
  supabase: SupabaseClient,
  childId: string,
  dateStr: string
): Promise<number> {
  const { data, error } = await supabase
    .from("puzzle_preview_usage")
    .select("previews_used")
    .eq("child_id", childId)
    .eq("usage_date", dateStr)
    .maybeSingle();
  if (error) throw error;
  return data?.previews_used ?? 0;
}

/** Read-then-write, same reasoning as addUsageMinutes — one active device per child in this v1. */
export async function incrementPreviewCount(
  supabase: SupabaseClient,
  childId: string,
  dateStr: string
): Promise<number> {
  const current = await getTodayPreviewCount(supabase, childId, dateStr);
  const next = current + 1;
  const { error } = await supabase.from("puzzle_preview_usage").upsert(
    { child_id: childId, usage_date: dateStr, previews_used: next },
    { onConflict: "child_id,usage_date" }
  );
  if (error) throw error;
  return next;
}

// --- Academy content progress (video/timeline lessons) ------------------

export interface AcademyProgress {
  status: "in_progress" | "completed";
  progressSeconds: number;
  quizScore: number | null;
}

export async function getAcademyProgress(
  supabase: SupabaseClient,
  childId: string,
  contentId: string
): Promise<AcademyProgress | null> {
  const { data, error } = await supabase
    .from("child_academy_progress")
    .select("status, progress_seconds, quiz_score")
    .eq("child_id", childId)
    .eq("content_id", contentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { status: data.status, progressSeconds: data.progress_seconds, quizScore: data.quiz_score };
}

/** Called periodically while a video plays, so playback can resume where a
 * child left off — doesn't mark completion, just position. */
export async function saveAcademyVideoProgress(
  supabase: SupabaseClient,
  childId: string,
  contentId: string,
  progressSeconds: number
): Promise<void> {
  const { error } = await supabase.from("child_academy_progress").upsert(
    { child_id: childId, content_id: contentId, progress_seconds: progressSeconds },
    { onConflict: "child_id,content_id" }
  );
  if (error) throw error;
}

export async function completeAcademyContent(
  supabase: SupabaseClient,
  childId: string,
  contentId: string,
  quizScore: number
): Promise<void> {
  const { error } = await supabase.from("child_academy_progress").upsert(
    {
      child_id: childId,
      content_id: contentId,
      status: "completed",
      quiz_score: quizScore,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "child_id,content_id" }
  );
  if (error) throw error;
}

export async function getCompletedAcademyContentIds(
  supabase: SupabaseClient,
  childId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from("child_academy_progress")
    .select("content_id")
    .eq("child_id", childId)
    .eq("status", "completed");
  if (error) throw error;
  return (data ?? []).map((r) => r.content_id);
}

// --- Opening encounters (Chess Mind / Exploration progress) -------------

/** No-op if this opening was already recorded — first_seen_at shouldn't move. */
export async function recordOpeningEncounter(
  supabase: SupabaseClient,
  childId: string,
  openingId: string
): Promise<void> {
  const { error } = await supabase.from("child_opening_encounters").upsert(
    { child_id: childId, opening_id: openingId },
    { onConflict: "child_id,opening_id", ignoreDuplicates: true }
  );
  if (error) throw error;
}


// --- Chess Mind practice stats -------------------------------------------

/** Read-then-write, same reasoning as addUsageMinutes — one active device per child in this v1. */
export async function recordChessMindSolve(
  supabase: SupabaseClient,
  childId: string,
  moduleId: string
): Promise<void> {
  const { data } = await supabase
    .from("child_chess_mind_stats")
    .select("total_solved")
    .eq("child_id", childId)
    .eq("module_id", moduleId)
    .maybeSingle();
  const next = (data?.total_solved ?? 0) + 1;
  const { error } = await supabase.from("child_chess_mind_stats").upsert(
    { child_id: childId, module_id: moduleId, total_solved: next, updated_at: new Date().toISOString() },
    { onConflict: "child_id,module_id" }
  );
  if (error) throw error;

  // Best-effort — a missed activity row only affects the streak display,
  // never the real total_solved count above, so it's not worth failing
  // the whole call over.
  const today = localDateString();
  try {
    await supabase
      .from("child_chess_mind_activity")
      .upsert(
        { child_id: childId, activity_date: today, module_id: moduleId },
        { onConflict: "child_id,activity_date,module_id", ignoreDuplicates: true }
      );
  } catch {
    // Best-effort, see comment above.
  }
}

export async function getChessMindTotalSolved(
  supabase: SupabaseClient,
  childId: string
): Promise<number> {
  const { data, error } = await supabase
    .from("child_chess_mind_stats")
    .select("total_solved")
    .eq("child_id", childId);
  if (error) throw error;
  return (data ?? []).reduce((sum, r) => sum + r.total_solved, 0);
}

/** module_id -> total_solved, for the dashboard's per-category scores and
 * for lib/chessMind/kingdomUnlocks.ts's threshold checks. */
export async function getChessMindStatsByModule(
  supabase: SupabaseClient,
  childId: string
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("child_chess_mind_stats")
    .select("module_id, total_solved")
    .eq("child_id", childId);
  if (error) throw error;
  const out: Record<string, number> = {};
  for (const row of data ?? []) out[row.module_id] = row.total_solved;
  return out;
}

/** Consecutive days (ending today or yesterday) with at least one Chess
 * Mind challenge solved — a real streak from real per-day activity rows,
 * not inferred from total_solved alone (which can't tell you WHEN). */
export async function getChessMindStreak(supabase: SupabaseClient, childId: string): Promise<number> {
  const { data, error } = await supabase
    .from("child_chess_mind_activity")
    .select("activity_date")
    .eq("child_id", childId)
    .order("activity_date", { ascending: false });
  if (error) throw error;

  const dates = [...new Set((data ?? []).map((r) => r.activity_date as string))];
  if (dates.length === 0) return 0;

  const today = localDateString();
  const yesterday = localDateString(new Date(Date.now() - 86_400_000));
  if (dates[0] !== today && dates[0] !== yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const cur = new Date(dates[i]);
    const diffDays = Math.round((prev.getTime() - cur.getTime()) / 86_400_000);
    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

/** Which categories were already practiced today — used to show the daily
 * challenge as already completed. */
export async function getTodayChessMindModules(
  supabase: SupabaseClient,
  childId: string
): Promise<string[]> {
  const today = localDateString();
  const { data, error } = await supabase
    .from("child_chess_mind_activity")
    .select("module_id")
    .eq("child_id", childId)
    .eq("activity_date", today);
  if (error) throw error;
  return (data ?? []).map((r) => r.module_id);
}

// --- Online win count (Playing achievements) ------------------------------

export async function getOnlineWinsCount(supabase: SupabaseClient, childId: string): Promise<number> {
  const { data, error } = await supabase
    .from("online_games")
    .select("host_child_id, guest_child_id, host_color, winner")
    .eq("status", "finished")
    .or(`host_child_id.eq.${childId},guest_child_id.eq.${childId}`);
  if (error) throw error;
  const rows = data ?? [];
  return rows.filter((g) => {
    if (!g.winner || g.winner === "draw") return false;
    if (g.host_child_id === childId) return g.winner === g.host_color;
    if (g.guest_child_id === childId) return g.winner !== g.host_color;
    return false;
  }).length;
}

// --- Opening progress ladder (DISCOVERED / STUDIED / PRACTICED / MASTERED) --

export interface OpeningEncounterDetail {
  opening_id: string;
  first_seen_at: string | null;
  studied_at: string | null;
  practice_attempts: number;
  practice_successes: number;
}

export async function getOpeningEncounters(
  supabase: SupabaseClient,
  childId: string
): Promise<OpeningEncounterDetail[]> {
  const { data, error } = await supabase
    .from("child_opening_encounters")
    .select("opening_id, first_seen_at, studied_at, practice_attempts, practice_successes")
    .eq("child_id", childId);
  if (error) throw error;
  return data ?? [];
}

/** Marks an opening's Academy detail page as viewed — creates the
 * encounter row if this is the child's first interaction with this
 * opening at all (studying it before ever reaching it in a real game is
 * completely valid). Never overwrites an existing studied_at. */
export async function markOpeningStudied(
  supabase: SupabaseClient,
  childId: string,
  openingId: string
): Promise<void> {
  const { data: existing } = await supabase
    .from("child_opening_encounters")
    .select("studied_at")
    .eq("child_id", childId)
    .eq("opening_id", openingId)
    .maybeSingle();
  if (existing?.studied_at) return;

  const { error } = await supabase.from("child_opening_encounters").upsert(
    { child_id: childId, opening_id: openingId, studied_at: new Date().toISOString() },
    { onConflict: "child_id,opening_id" }
  );
  if (error) throw error;
}

/**
 * Records one practice session's result. "Successful" means the player
 * played through the opening's ENTIRE defining move sequence without
 * deviating from it before the practice game ended — not a judgment on
 * move quality, just "did they complete the line." See
 * lib/openings/practiceTracking.ts for how this feeds into MASTERED.
 */
export async function recordOpeningPracticeAttempt(
  supabase: SupabaseClient,
  childId: string,
  openingId: string,
  wasSuccessful: boolean
): Promise<void> {
  const { data: existing } = await supabase
    .from("child_opening_encounters")
    .select("practice_attempts, practice_successes")
    .eq("child_id", childId)
    .eq("opening_id", openingId)
    .maybeSingle();

  const { error } = await supabase.from("child_opening_encounters").upsert(
    {
      child_id: childId,
      opening_id: openingId,
      practice_attempts: (existing?.practice_attempts ?? 0) + 1,
      practice_successes: (existing?.practice_successes ?? 0) + (wasSuccessful ? 1 : 0),
    },
    { onConflict: "child_id,opening_id" }
  );
  if (error) throw error;
}

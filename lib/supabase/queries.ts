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

/**
 * Server-side equivalent of what ScreenTimeGate used to compute itself on
 * mount (auth check already done by the caller, limits + today's usage
 * fetched in parallel instead of sequentially) — lets a Server Component
 * page pass the initial gate status down as props instead of making the
 * client redo the same round trips a second time right after the server
 * already rendered the real page.
 */
export async function getScreenTimeStatus(
  supabase: SupabaseClient,
  authUserId: string,
  childId: string
): Promise<{ limitMinutes: number; usedMinutes: number }> {
  const [limits, usedMinutes] = await Promise.all([
    getScreenTimeLimits(supabase, authUserId),
    getTodayUsageMinutes(supabase, childId, localDateString()),
  ]);
  const limitMinutes = isWeekend() ? limits.weekendMinutes : limits.weekdayMinutes;
  return { limitMinutes, usedMinutes };
}

function isWeekend(d: Date = new Date()): boolean {
  const day = d.getDay(); // 0 = Sunday, 6 = Saturday
  return day === 0 || day === 6;
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
    } else if (achievement.criteria.type === "academy_complete_all") {
      earned = achievement.criteria.contentIds.every((id) => completedAcademyIds.includes(id));
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

// --- Daily free game limits (supabase/migrations/0019_daily_free_game_limits.sql) ---
// A separate entitlement layer from the lesson/Academy paywall below —
// gates actual gameplay (Free Play vs AI, Random Match, Invite a Friend),
// not lesson-day access. Free children get 2 AI + 2 multiplayer games per
// rolling 24h window; premium is unlimited. See the migration's header
// comment for the exact rule on when a game counts as "started."

export interface FreeGameStatus {
  isPremium: boolean;
  aiRemaining: number | null;
  aiNextAvailableAt: string | null;
  mpRemaining: number | null;
  mpNextAvailableAt: string | null;
}

/** Read-only — never consumes a credit. For the "X of 2 free games
 * remaining today" indicator, shown before any game starts. */
export async function getFreeGameStatus(supabase: SupabaseClient, childId: string): Promise<FreeGameStatus> {
  const { data, error } = await supabase.rpc("get_free_game_status", { p_child_id: childId });
  if (error) throw error;
  const row = data?.[0];
  return {
    isPremium: row?.is_premium ?? false,
    aiRemaining: row?.ai_remaining ?? null,
    aiNextAvailableAt: row?.ai_next_available_at ?? null,
    mpRemaining: row?.mp_remaining ?? null,
    mpNextAvailableAt: row?.mp_next_available_at ?? null,
  };
}

export interface StartGameResult {
  allowed: boolean;
  remaining: number | null;
  nextAvailableAt: string | null;
}

/** Called the moment a child picks a difficulty on the Free Play screen,
 * before the board renders — the only "AI game started" event that exists
 * (Free Play has no server-side game row; Stockfish runs client-side). */
export async function startAiGame(supabase: SupabaseClient, childId: string): Promise<StartGameResult> {
  const { data, error } = await supabase.rpc("start_ai_game", { p_child_id: childId });
  if (error) throw error;
  const row = data?.[0];
  return {
    allowed: row?.allowed ?? false,
    remaining: row?.remaining ?? null,
    nextAvailableAt: row?.next_available_at ?? null,
  };
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
   * move — see submitOnlineMove(). Needed for opening recognition, since
   * ChessBoard's own move history resets whenever its `fen` prop changes
   * (which happens every move here, driven by Realtime sync). */
  moves: string[];
  /** References an id in content/timeControls.ts, e.g. "10+0" — null for
   * games created before Phase 16B (untimed; the clock UI simply doesn't
   * render for these). */
  time_control: string | null;
  initial_time_ms: number | null;
  increment_ms: number;
  /** Authoritative remaining time — always trust these over any local
   * countdown. Written ONLY by submit_online_move/claim_timeout/
   * join_online_game (see supabase/migrations/0017_online_game_clocks.sql);
   * the client has no direct write access to these columns at all
   * (column-level REVOKE), so there's nothing to "trust the client" about. */
  white_time_ms: number | null;
  black_time_ms: number | null;
  /** Server timestamp the current player's clock started counting down
   * from — combine with white_time_ms/black_time_ms + current_turn to
   * derive the live remaining time client-side for display only. */
  last_move_at: string | null;
  current_turn: "w" | "b" | null;
  /** True once apply_match_rating() has settled this game's rating change
   * (only ever true for match_type="random") — the four *_before/*_after
   * columns below are only meaningful once this is true. */
  rating_applied: boolean;
  host_rating_before: number | null;
  host_rating_after: number | null;
  guest_rating_before: number | null;
  guest_rating_after: number | null;
}

export interface CreateInviteGameResult {
  id: string | null;
  /** True if the host has used their 2 free multiplayer games today
   * (premium hosts never see this) — no game row was created. */
  blocked: boolean;
}

/**
 * SECURITY DEFINER RPC (supabase/migrations/0019_daily_free_game_limits.sql)
 * — replaces the old plain client .insert(), which had no way to check the
 * host's free-multiplayer allowance server-side before handing out an
 * invite link. Does NOT consume a credit itself (see the migration's
 * header comment on when a game is "consumed") — only join_online_game
 * does, once a friend actually joins.
 */
export async function createInviteGame(
  supabase: SupabaseClient,
  hostChildId: string,
  timeControlId: string
): Promise<CreateInviteGameResult> {
  const { data, error } = await supabase.rpc("create_invite_game", {
    p_host_child_id: hostChildId,
    p_time_control: timeControlId,
  });
  if (error) throw error;
  const row = data?.[0];
  return { id: row?.id ?? null, blocked: row?.blocked ?? false };
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
 * Server-side join (supabase/migrations/0017_online_game_clocks.sql) —
 * needed beyond just consistency with the other online-game writes: the
 * clock's start time (last_move_at) has to come from the database's own
 * clock, never a client-supplied timestamp. Same compare-and-swap
 * race-safety as before (only succeeds if guest_child_id was still null),
 * now enforced inside the RPC instead of via a client-side filter.
 */
export interface JoinOnlineGameResult {
  joined: boolean;
  /** True if the join was rejected because the host or guest has used
   * their 2 free multiplayer games today (never true for premium). */
  blocked: boolean;
}

export async function joinOnlineGame(
  supabase: SupabaseClient,
  gameId: string,
  guestChildId: string
): Promise<JoinOnlineGameResult> {
  const { data, error } = await supabase.rpc("join_online_game", {
    p_game_id: gameId,
    p_guest_child_id: guestChildId,
  });
  if (error) throw error;
  const row = data?.[0];
  return { joined: row?.joined ?? false, blocked: row?.blocked ?? false };
}

export interface SubmitMoveResult {
  whiteTimeMs: number | null;
  blackTimeMs: number | null;
  status: "waiting" | "active" | "finished";
  winner: "w" | "b" | "draw" | null;
}

/**
 * The single atomic move+clock operation (supabase/migrations/
 * 0017_online_game_clocks.sql) — replaces the old plain client
 * .update({fen, moves}), which had no server-side turn or timing
 * enforcement at all. Deducts real elapsed time (server clock) from the
 * mover's own remaining time and rejects the move if that clock had
 * already reached zero — check `result.status === "finished"` after
 * calling this, since a move can come back rejected-by-timeout as a
 * normal result rather than a thrown error (an error here would roll back
 * the very update that marks the game finished — see the migration's
 * comment on why).
 */
export async function submitOnlineMove(
  supabase: SupabaseClient,
  gameId: string,
  childId: string,
  fen: string,
  san: string
): Promise<SubmitMoveResult> {
  const { data, error } = await supabase.rpc("submit_online_move", {
    p_game_id: gameId,
    p_child_id: childId,
    p_fen: fen,
    p_san: san,
  });
  if (error) throw error;
  const row = data?.[0];
  return {
    whiteTimeMs: row?.white_time_ms ?? null,
    blackTimeMs: row?.black_time_ms ?? null,
    status: row?.status ?? "active",
    winner: row?.winner ?? null,
  };
}

/**
 * Asks the server to check whether the side currently on move has run out
 * of time, using the server's own clock — a premature or malicious call
 * just returns the unchanged current state, it can't force a timeout that
 * hasn't genuinely happened yet. Typically polled by the player who is
 * NOT on move, watching the opponent's clock run out.
 */
export async function claimTimeout(
  supabase: SupabaseClient,
  gameId: string,
  childId: string
): Promise<{ status: "waiting" | "active" | "finished"; winner: "w" | "b" | "draw" | null }> {
  const { data, error } = await supabase.rpc("claim_timeout", {
    p_game_id: gameId,
    p_child_id: childId,
  });
  if (error) throw error;
  const row = data?.[0];
  return { status: row?.status ?? "active", winner: row?.winner ?? null };
}

/**
 * Called when a client locally detects checkmate/draw via chess.js —
 * unchanged trust model from before (this app has never re-validated
 * chess legality server-side; that's a separate, pre-existing scope from
 * the clock work this phase is about). Moved to an RPC purely so
 * status/winner can be locked down from direct client writes without
 * also breaking this call site.
 */
export async function finishOnlineGame(
  supabase: SupabaseClient,
  gameId: string,
  childId: string,
  winner: "w" | "b" | "draw"
): Promise<void> {
  const { error } = await supabase.rpc("finish_online_game_by_result", {
    p_game_id: gameId,
    p_child_id: childId,
    p_winner: winner,
  });
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

// --- Random matchmaking (rating-based; gated by the free multiplayer
// daily limit above, not by lesson completion) ----------------------------

export interface MatchmakingResult {
  matched: boolean;
  gameId: string | null;
  /** True if the caller has used their 2 free multiplayer games today —
   * never joined the queue (never true for premium). */
  blocked: boolean;
}

/**
 * Atomically pairs with the closest-rated waiting opponent, or enqueues
 * the caller if nobody's waiting — see find_or_create_match() in
 * supabase/migrations/0008_matchmaking.sql (matching logic) and
 * 0019_daily_free_game_limits.sql (free-multiplayer eligibility, checked
 * for both sides of a pairing) for why this has to run server-side in a
 * single transaction to be race-safe.
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
  return { matched: row?.matched ?? false, gameId: row?.game_id ?? null, blocked: row?.blocked ?? false };
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

/** quizScore is null for completions that never involved a quiz — e.g. the
 * first-time cinematic intro (app/welcome), which reuses this same content
 * row/table rather than inventing a parallel "seen it" mechanism. The
 * child_academy_progress.quiz_score column is already nullable for exactly
 * this reason ("null until taken"). */
export async function completeAcademyContent(
  supabase: SupabaseClient,
  childId: string,
  contentId: string,
  quizScore: number | null
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

/** Batch status lookup for a course's own lesson list (e.g. the Tactics
 * landing page's ○/◐/✓ per-lesson indicators) — one query instead of one
 * per lesson. Same child_academy_progress table as everything else above;
 * just a different read shape, not a new progress system. */
export async function getAcademyProgressForIds(
  supabase: SupabaseClient,
  childId: string,
  contentIds: string[]
): Promise<Record<string, "in_progress" | "completed">> {
  if (contentIds.length === 0) return {};
  const { data, error } = await supabase
    .from("child_academy_progress")
    .select("content_id, status")
    .eq("child_id", childId)
    .in("content_id", contentIds);
  if (error) throw error;
  const result: Record<string, "in_progress" | "completed"> = {};
  for (const row of data ?? []) result[row.content_id] = row.status;
  return result;
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

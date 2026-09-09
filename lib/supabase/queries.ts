import type { SupabaseClient } from "@supabase/supabase-js";
import { getCachedActiveChild, setCachedActiveChild } from "./activeChildCache";
import type { AgeBand, ExperienceLevel } from "@/lib/learner/experienceLevel";

export interface ChildProfile {
  id: string;
  display_name: string;
  avatar_id: string | null;
  buddy_id: string | null;
  board_skin_id: string;
  piece_set_id: string;
  rating: number;
  current_day: number;
  experience_level: ExperienceLevel | null;
  age_band: AgeBand | null;
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

/**
 * One round trip instead of two (parents lookup, then a dependent children
 * lookup) — this runs on every single protected navigation via
 * resolveActiveChild(), so the extra sequential round trip was real,
 * measurable per-tap latency, not just a style nit. PostgREST resolves the
 * embed via the existing children.parent_id FK, so this is the same data
 * under the same RLS policies, just fetched as one request.
 */
export async function getChildrenForParent(
  supabase: SupabaseClient,
  authUserId: string
): Promise<ChildProfile[]> {
  const { data: parent, error } = await supabase
    .from("parents")
    .select("children(*)")
    .eq("auth_user_id", authUserId)
    .order("created_at", { referencedTable: "children", ascending: true })
    .maybeSingle();
  if (error) throw error;
  if (!parent) return [];
  return ((parent as unknown as { children: ChildProfile[] }).children ?? []) as ChildProfile[];
}

/**
 * One child profile by id. RLS ("parent can manage own children", 0001)
 * scopes the select to the caller's own children — a child id belonging to
 * someone else, or that doesn't exist, simply returns null. Cheaper than
 * resolveActiveChild when the caller already knows the id (e.g. the Game
 * Review, opened from a screen that already resolved the active child).
 */
export async function getChildProfileById(
  supabase: SupabaseClient,
  childId: string
): Promise<ChildProfile | null> {
  const { data, error } = await supabase
    .from("children")
    .select(
      "id, display_name, avatar_id, buddy_id, board_skin_id, piece_set_id, rating, current_day, experience_level, age_band"
    )
    .eq("id", childId)
    .maybeSingle();
  if (error) return null;
  return (data as ChildProfile | null) ?? null;
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
  // Child-profile resolution is SEPARATE from parent authentication: a
  // transient failure here (Supabase hiccup, cold radio) must never cascade
  // into signing the parent out. No caller maps a thrown error from this to
  // signOut() — but one retry keeps a momentary blip from error-paging a
  // parent whose session is perfectly valid.
  let allChildren: ChildProfile[];
  try {
    allChildren = await getChildrenForParent(supabase, authUserId);
  } catch {
    await new Promise((r) => setTimeout(r, 400));
    allChildren = await getChildrenForParent(supabase, authUserId);
  }

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

/**
 * Same result as resolveActiveChild(), backed by a short-lived shared cache
 * (see lib/supabase/activeChildCache.ts for the full safety reasoning --
 * keyed by real auth user id + the cookie value, TTL'd, invalidated on
 * child switch). Use this at page/component call sites instead of calling
 * resolveActiveChild() directly; reach for the uncached version only where
 * a guaranteed-fresh read matters more than avoiding a duplicate query.
 */
export async function resolveActiveChildCached(
  supabase: SupabaseClient,
  authUserId: string,
  activeChildIdFromCookie: string | null
): Promise<ActiveChildResolution> {
  const cached = getCachedActiveChild(authUserId, activeChildIdFromCookie);
  if (cached) return cached;

  const resolution = await resolveActiveChild(supabase, authUserId, activeChildIdFromCookie);
  setCachedActiveChild(authUserId, activeChildIdFromCookie, resolution);
  return resolution;
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

export async function updateChildExperienceProfile(
  supabase: SupabaseClient,
  childId: string,
  experienceLevel: ExperienceLevel,
  ageBand: AgeBand | null
) {
  const { error } = await supabase
    .from("children")
    .update({ experience_level: experienceLevel, age_band: ageBand })
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

/** Return shape for evaluateAndAwardAchievements — see its own doc comment. */
export interface AchievementEvaluationResult {
  /** Achievement keys newly earned THIS call, so the UI can celebrate them. */
  newlyEarned: string[];
  /** Every key the child has now, already-earned plus this call's new ones —
   * lets a caller that needs the full set (e.g. Kingdom Map's stats count
   * and badge grid) skip a second getEarnedAchievementKeys() round trip,
   * since this function already had to read that same set internally to
   * know what NOT to re-award. */
  allEarned: string[];
}

/**
 * Checks every achievement definition against the child's current real
 * state (completed days + premium status) and awards any newly-earned ones.
 * Safe to call repeatedly (e.g. on every lesson completion and every
 * Kingdom Map load) — already-earned achievements are skipped via the
 * unique(child_id, achievement_key) constraint, so this never double-awards.
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
): Promise<AchievementEvaluationResult> {
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

  return { newlyEarned, allEarned: [...alreadyEarned, ...newlyEarned] };
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
   * original friend-link mode) are unaffected. "tournament" games (Group
   * Tournament, supabase/migrations/0023_group_tournaments.sql) also hide
   * chat (same stranger-safety reasoning as "random") and never settle
   * rating — apply_match_rating() already ignores anything that isn't
   * "random". */
  match_type: "invite" | "random" | "tournament";
  /** Set only for match_type="tournament" games — which tournament/round/
   * pairing this game belongs to. Never client-writable. */
  tournament_id: string | null;
  round_number: number | null;
  tournament_pairing_id: string | null;
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
/**
 * @deprecated Unused, and non-functional after migration 0039.
 *
 * Moves go through POST /api/online/[gameId]/move, which validates them with
 * chess.js and calls submit_online_move_as_server (service_role only). 0039
 * makes the browser-facing submit_online_move raise unconditionally, so this
 * wrapper can only throw. Kept as a signpost rather than deleted so the reason
 * is discoverable from the call site someone is tempted to restore.
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
/**
 * @deprecated Unused, and revoked from the browser by migrations 0037/0039.
 *
 * Results are decided by POST /api/online/[gameId]/complete, which replays the
 * stored moves and calls finish_online_game_by_result_as_server.
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
  rating: number,
  /** Desired speed. Players only match with others who asked for the same one.
   *  Omitted (or with migration 0035 unapplied) the server keeps its previous
   *  hardcoded 10+0 behaviour. */
  timeControl?: string
): Promise<MatchmakingResult> {
  const payload: Record<string, unknown> = { p_child_id: childId, p_rating: rating };
  if (timeControl) payload.p_time_control = timeControl;

  let { data, error } = await supabase.rpc("find_or_create_match", payload);

  // Migration 0035 adds the third parameter. Until it is applied the
  // three-argument overload does not exist, and PostgREST reports that as a
  // missing function rather than a bad argument — so fall back to the
  // two-argument call, which still produces a (10+0) game. Matchmaking keeps
  // working either way; only the choice of speed is unavailable.
  if (error && timeControl && /does not exist|schema cache|could not find the function/i.test(error.message)) {
    ({ data, error } = await supabase.rpc("find_or_create_match", {
      p_child_id: childId,
      p_rating: rating,
    }));
  }

  if (error) throw error;
  const row = data?.[0];
  return { matched: row?.matched ?? false, gameId: row?.game_id ?? null, blocked: row?.blocked ?? false };
}

/**
 * Whether the server understands per-speed matchmaking (migration 0035).
 *
 * Probed so the UI can hide a speed picker that would silently do nothing.
 * Offering a choice that is quietly ignored is worse than offering none.
 */
export async function supportsTimeControlMatchmaking(
  supabase: SupabaseClient
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("matchmaking_queue")
      .select("time_control")
      .limit(1);
    if (!error) return true;
    return !/does not exist|schema cache|column/i.test(error.message);
  } catch {
    return false;
  }
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

// --- Puzzle library solve history (Phase 14C) ---------------------------
// Cross-surface record of which content/puzzles.ts puzzles a child has
// solved (Puzzle Trainer + Daily Challenge). One row per (child, puzzle);
// see supabase/migrations/0029_puzzle_library_solves.sql.

/**
 * Records that a child solved a library puzzle. Idempotent via
 * unique(child_id, puzzle_id): if the puzzle was already solved (through
 * either surface) this is a no-op — the original solved_at / first_try /
 * attempts stay as first recorded, rather than being overwritten with a
 * later re-solve's data. `attempts` / `firstTry` describe THIS solving
 * session and are only ever persisted for the very first solve, so they're
 * real numbers, not fabricated running totals.
 */
export async function recordPuzzleLibrarySolve(
  supabase: SupabaseClient,
  childId: string,
  puzzleId: string,
  source: "trainer" | "daily",
  firstTry: boolean,
  attempts: number
): Promise<void> {
  const { error } = await supabase.from("puzzle_library_solves").upsert(
    {
      child_id: childId,
      puzzle_id: puzzleId,
      source,
      first_try: firstTry,
      attempts: Math.max(1, attempts),
    },
    { onConflict: "child_id,puzzle_id", ignoreDuplicates: true }
  );
  if (error) throw error;
}

/** All puzzle ids this child has already solved — one indexed query, ids
 * only (short text, ≤ the 1,000-puzzle library), fetched once per Puzzle
 * Trainer page load for no-repeat selection. */
export async function getSolvedPuzzleIds(
  supabase: SupabaseClient,
  childId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from("puzzle_library_solves")
    .select("puzzle_id")
    .eq("child_id", childId);
  if (error) throw error;
  return (data ?? []).map((r) => r.puzzle_id as string);
}

/**
 * The full solve history — id, source, first-try, and WHEN — for the
 * puzzle history / personal-best / streak surfaces (Phase E, Priority 4).
 * Same table as getSolvedPuzzleIds, same RLS, just more columns; capped at
 * `limit` most recent rows via the table's existing (child_id, solved_at
 * desc) index, since a personal-best/streak view needs recency, not the
 * entire lifetime history of a heavy solver.
 */
export interface PuzzleSolveRecord {
  puzzleId: string;
  solvedAt: string;
  firstTry: boolean;
  source: "trainer" | "daily";
}

export async function getPuzzleSolveHistory(
  supabase: SupabaseClient,
  childId: string,
  limit = 500
): Promise<PuzzleSolveRecord[]> {
  const { data, error } = await supabase
    .from("puzzle_library_solves")
    .select("puzzle_id, solved_at, first_try, source")
    .eq("child_id", childId)
    .order("solved_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    puzzleId: r.puzzle_id as string,
    solvedAt: r.solved_at as string,
    firstTry: !!r.first_try,
    source: r.source as "trainer" | "daily",
  }));
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

/** True once this child has completed at least one rated Random Match —
 * used only to decide whether to show the "starting your rating journey"
 * first-timer message vs. the normal matchmaking copy. */
export async function hasRatingHistory(supabase: SupabaseClient, childId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("rating_history")
    .select("id", { count: "exact", head: true })
    .eq("child_id", childId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

/** Net Random Match rating change so far today, from the server-written
 * rating_history table (supabase/migrations/0026_rating_system_hardening.sql)
 * — for the Profile page's "+N today" line. 0 if no rated games today. */
export async function getTodayRatingChange(supabase: SupabaseClient, childId: string): Promise<number> {
  const { data, error } = await supabase
    .from("rating_history")
    .select("rating_change")
    .eq("child_id", childId)
    .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString());
  if (error) throw error;
  return (data ?? []).reduce((sum, r) => sum + r.rating_change, 0);
}

export interface RatingPoint {
  newRating: number;
  ratingChange: number;
  result: "win" | "loss" | "draw";
  createdAt: string;
}

/**
 * This child's rated-game rating timeline, oldest first.
 *
 * rating_history has been written on every rated Random Match since 0026 but
 * was only ever read for two booleans, so the app has never been able to answer
 * "am I improving?" — the one question a chess player actually asks. Returned
 * oldest-first because every consumer wants it in chronological order.
 *
 * Capped: a trend needs a window, not a full career, and this keeps the payload
 * small on a route that already fetches plenty.
 */
export async function getRatingTimeline(
  supabase: SupabaseClient,
  childId: string,
  limit = 30
): Promise<RatingPoint[]> {
  const { data, error } = await supabase
    .from("rating_history")
    .select("new_rating, rating_change, result, created_at")
    .eq("child_id", childId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? [])
    .map((r) => ({
      newRating: r.new_rating as number,
      ratingChange: r.rating_change as number,
      result: r.result as "win" | "loss" | "draw",
      createdAt: r.created_at as string,
    }))
    .reverse();
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

// --- Game Review learning signals (Phase 26) -----------------------------
// supabase/migrations/0033_game_review_learning_signals.sql.
//
// Every function here is BEST-EFFORT by design: it swallows a
// missing-table / permission / network error and returns a safe value,
// because the Game Review must behave identically whether or not 0033 has
// been applied and whether or not the child has any history yet
// (PostGameAnalysis never awaits these in a way that can block the UI).

export interface GameReviewInput {
  source: "free_play" | "online";
  playedColor: "w" | "b" | null;
  result: "win" | "loss" | "draw" | null;
  accuracy: number | null;
  totalMoves: number | null;
  mistakes: number;
  blunders: number;
  inaccuracies: number;
  biggestMomentSkill: string | null;
  biggestMomentPly: number | null;
  openingName: string | null;
}

export interface SkillSignal {
  skill: string;
  weakCount: number;
  practiceAttempts: number;
  practiceCorrect: number;
}

/** Insert one completed-review record. Fire-and-forget. */
export async function recordGameReview(
  supabase: SupabaseClient,
  childId: string,
  input: GameReviewInput
): Promise<void> {
  try {
    await supabase.from("child_game_reviews").insert({
      child_id: childId,
      source: input.source,
      played_color: input.playedColor,
      result: input.result,
      accuracy: input.accuracy,
      total_moves: input.totalMoves,
      mistakes: input.mistakes,
      blunders: input.blunders,
      inaccuracies: input.inaccuracies,
      biggest_moment_skill: input.biggestMomentSkill,
      biggest_moment_ply: input.biggestMomentPly,
      opening_name: input.openingName,
    });
  } catch {
    // best-effort — see file note
  }
}

/**
 * Bump the weakness counter for each skill flagged in this review.
 * `skillCounts` maps SkillId -> how many of the game's mistakes it caused.
 * Uses the bump_skill_signal RPC (atomic upsert, SECURITY DEFINER with an
 * ownership check).
 */
export async function bumpSkillWeaknesses(
  supabase: SupabaseClient,
  childId: string,
  skillCounts: Record<string, number>
): Promise<void> {
  const entries = Object.entries(skillCounts).filter(([, n]) => n > 0);
  await Promise.all(
    entries.map(async ([skill, n]) => {
      try {
        await supabase.rpc("bump_skill_signal", {
          p_child_id: childId,
          p_skill: skill,
          p_weak_delta: n,
        });
      } catch {
        // best-effort
      }
    })
  );
}

/** Record the outcome of a review-driven practice set for one skill. */
export async function recordSkillPractice(
  supabase: SupabaseClient,
  childId: string,
  skill: string,
  attempts: number,
  correct: number
): Promise<void> {
  if (attempts <= 0) return;
  try {
    await supabase.rpc("bump_skill_signal", {
      p_child_id: childId,
      p_skill: skill,
      p_attempts_delta: attempts,
      p_correct_delta: Math.max(0, Math.min(correct, attempts)),
    });
  } catch {
    // best-effort
  }
}

/** All of this child's skill signals, keyed by SkillId. Empty object on any
 * failure or when 0033 isn't applied yet. */
export async function getSkillSignals(
  supabase: SupabaseClient,
  childId: string
): Promise<Record<string, SkillSignal>> {
  try {
    const { data, error } = await supabase
      .from("child_skill_signals")
      .select("skill, weak_count, practice_attempts, practice_correct")
      .eq("child_id", childId);
    if (error || !data) return {};
    const out: Record<string, SkillSignal> = {};
    for (const row of data) {
      out[row.skill as string] = {
        skill: row.skill as string,
        weakCount: (row.weak_count as number) ?? 0,
        practiceAttempts: (row.practice_attempts as number) ?? 0,
        practiceCorrect: (row.practice_correct as number) ?? 0,
      };
    }
    return out;
  } catch {
    return {};
  }
}

export interface RecentReviewRow {
  accuracy: number | null;
  result: string | null;
  mistakes: number;
  blunders: number;
  biggestMomentSkill: string | null;
  reviewedAt: string;
  /** Opening the reviewed game was played in, when the review recorded one.
   *  Only reviewed games carry this, so anything computed from it measures
   *  reviewed games rather than all games played. */
  openingName: string | null;
}

/** The child's most recent review records (newest first) — for a future
 * trend view / Parent Dashboard. Empty array on any failure. */
export async function getRecentGameReviews(
  supabase: SupabaseClient,
  childId: string,
  limit = 10
): Promise<RecentReviewRow[]> {
  try {
    const { data, error } = await supabase
      .from("child_game_reviews")
      .select("accuracy, result, mistakes, blunders, biggest_moment_skill, opening_name, reviewed_at")
      .eq("child_id", childId)
      .order("reviewed_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data.map((r) => ({
      accuracy: (r.accuracy as number | null) ?? null,
      result: (r.result as string | null) ?? null,
      mistakes: (r.mistakes as number) ?? 0,
      blunders: (r.blunders as number) ?? 0,
      biggestMomentSkill: (r.biggest_moment_skill as string | null) ?? null,
      openingName: (r.opening_name as string | null) ?? null,
      reviewedAt: r.reviewed_at as string,
    }));
  } catch {
    return [];
  }
}

/**
 * Every finished online game for a child, from that child's point of view.
 *
 * Returns rows already normalised to the shape lib/stats/playerStats.ts works
 * in — colour and result resolved here rather than in the UI, because the
 * host/guest and winner/host_color mapping is easy to get subtly backwards and
 * should exist in exactly one place. getOnlineWinsCount does the same mapping
 * inline; this is the same rule, applied once for every consumer.
 *
 * Reads go through RLS, so this can only ever return games belonging to a
 * child the caller owns.
 *
 * Never throws: statistics are a read-only view, and a failed fetch should show
 * "no data yet" rather than break the page it is on.
 */
export interface PlayedGameRow {
  id: string;
  playedAt: string;
  color: "w" | "b";
  result: "win" | "loss" | "draw";
  timeControl: string | null;
  matchType: string;
  ratingBefore: number | null;
  ratingAfter: number | null;
  opponentChildId: string | null;
  tournamentId: string | null;
}

export async function getPlayedGames(
  supabase: SupabaseClient,
  childId: string,
  limit = 500
): Promise<PlayedGameRow[]> {
  try {
    const { data, error } = await supabase
      .from("online_games")
      .select(
        "id, created_at, host_child_id, guest_child_id, host_color, winner, status, match_type, time_control, host_rating_before, host_rating_after, guest_rating_before, guest_rating_after, tournament_id"
      )
      .eq("status", "finished")
      .or(`host_child_id.eq.${childId},guest_child_id.eq.${childId}`)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];

    const rows: PlayedGameRow[] = [];
    for (const g of data) {
      const isHost = g.host_child_id === childId;
      // host_color is the colour the HOST had; the guest necessarily had the other.
      const hostColor = (g.host_color as string) === "b" ? "b" : "w";
      const color: "w" | "b" = isHost ? hostColor : hostColor === "w" ? "b" : "w";

      const winner = g.winner as string | null;
      let result: "win" | "loss" | "draw";
      if (!winner || winner === "draw") result = "draw";
      else result = winner === color ? "win" : "loss";

      rows.push({
        id: g.id as string,
        playedAt: g.created_at as string,
        color,
        result,
        timeControl: (g.time_control as string | null) ?? null,
        matchType: (g.match_type as string | null) ?? "invite",
        ratingBefore: (isHost ? g.host_rating_before : g.guest_rating_before) ?? null,
        ratingAfter: (isHost ? g.host_rating_after : g.guest_rating_after) ?? null,
        opponentChildId: (isHost ? g.guest_child_id : g.host_child_id) ?? null,
        tournamentId: (g.tournament_id as string | null) ?? null,
      });
    }
    return rows;
  } catch {
    return [];
  }
}

/**
 * A child's tournament participations, with every rival's points, so finishing
 * positions can be derived (lib/stats/tournamentRecord.ts).
 *
 * Positions are not stored anywhere — tournament_participants records points
 * only — so this reads the whole participant list of each tournament the child
 * entered. That is allowed: 0023_group_tournaments.sql lets any authenticated
 * user read participants, unlike `children`, whose parent-owns-child RLS is
 * exactly why a global cross-family leaderboard is not possible without a
 * SECURITY DEFINER function.
 *
 * Never throws — an empty record renders as "no tournaments yet".
 */
export async function getTournamentParticipations(
  supabase: SupabaseClient,
  childId: string
): Promise<
  {
    tournamentId: string;
    tournamentName: string;
    status: string;
    points: number;
    allPoints: number[];
    endedAt: string | null;
  }[]
> {
  try {
    const { data: mine, error } = await supabase
      .from("tournament_participants")
      .select("tournament_id, points")
      .eq("child_id", childId);
    if (error || !mine || mine.length === 0) return [];

    const ids = mine.map((r) => r.tournament_id as string);

    const [{ data: tournaments }, { data: everyone }] = await Promise.all([
      supabase.from("tournaments").select("id, name, status, created_at").in("id", ids),
      supabase.from("tournament_participants").select("tournament_id, points").in("tournament_id", ids),
    ]);

    const byTournament = new Map<string, number[]>();
    for (const row of everyone ?? []) {
      const key = row.tournament_id as string;
      const list = byTournament.get(key);
      const pts = Number(row.points) || 0;
      if (list) list.push(pts);
      else byTournament.set(key, [pts]);
    }
    const meta = new Map((tournaments ?? []).map((t) => [t.id as string, t]));

    return mine.map((r) => {
      const id = r.tournament_id as string;
      const t = meta.get(id);
      return {
        tournamentId: id,
        tournamentName: (t?.name as string) ?? "Tournament",
        status: (t?.status as string) ?? "unknown",
        points: Number(r.points) || 0,
        allPoints: byTournament.get(id) ?? [],
        endedAt: (t?.created_at as string) ?? null,
      };
    });
  } catch {
    return [];
  }
}

// --- Friends (migration 0034) ----------------------------------------------
//
// Every function here tolerates the migration not being applied. This
// environment applies migrations by hand through the Supabase SQL editor (see
// the note in scripts/test-puzzle-economy.js about 0029), so the table may not
// exist yet, and a friends page that threw in that state would take down the
// whole route. Missing table reads as "no friends yet"; writes report
// `not_enabled` so the UI can say so plainly rather than failing silently.

export type FriendshipStatus = "pending" | "accepted" | "declined" | "blocked";

export interface FriendRow {
  friendshipId: string;
  /** The OTHER child in the friendship. */
  friendChildId: string;
  friendName: string;
  friendRating: number | null;
  status: FriendshipStatus;
  /** True when the signed-in child sent the request. */
  outgoing: boolean;
  createdAt: string;
}

/**
 * True when the failure means "this table/function has not been created yet".
 *
 * Two different errors mean that, and only checking one of them is how a
 * feature-detection flag ends up lying. Postgres raises 42P01 ("relation does
 * not exist"), but PostgREST usually answers first with PGRST205 and the text
 * "Could not find the table ... in the schema cache" — which contains neither
 * the code nor the phrase "does not exist". An earlier version of this checked
 * only the Postgres form, so the friends page rendered its full working UI
 * against a table that was not there.
 */
function isMissingRelation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205" || error.code === "PGRST202") return true;
  const message = error.message ?? "";
  return /does not exist|schema cache|could not find the (table|function)/i.test(message);
}

export interface FriendsResult {
  /** False when migration 0034 has not been applied. */
  enabled: boolean;
  accepted: FriendRow[];
  incoming: FriendRow[];
  outgoing: FriendRow[];
}

export async function getFriends(
  supabase: SupabaseClient,
  childId: string
): Promise<FriendsResult> {
  const empty: FriendsResult = { enabled: true, accepted: [], incoming: [], outgoing: [] };
  try {
    const { data, error } = await supabase
      .from("friendships")
      .select("id, child_a, child_b, requested_by, status, created_at")
      .or(`child_a.eq.${childId},child_b.eq.${childId}`)
      .neq("status", "declined");

    if (isMissingRelation(error)) return { ...empty, enabled: false };
    if (error || !data) return empty;

    const otherIds = data.map((r) => (r.child_a === childId ? r.child_b : r.child_a));
    // Names come from `children`, which is parent-owns-child. A friend in
    // another family therefore resolves to no row, and is shown as "Chess Mind
    // player" rather than leaking anything — the same treatment opponents get.
    const names = new Map<string, { name: string; rating: number | null }>();
    if (otherIds.length) {
      const { data: kids } = await supabase
        .from("children")
        .select("id, display_name, rating")
        .in("id", otherIds);
      for (const k of kids ?? []) {
        names.set(k.id as string, {
          name: (k.display_name as string) ?? "Chess Mind player",
          rating: (k.rating as number) ?? null,
        });
      }
    }

    const rows: FriendRow[] = data.map((r) => {
      const other = r.child_a === childId ? (r.child_b as string) : (r.child_a as string);
      const known = names.get(other);
      return {
        friendshipId: r.id as string,
        friendChildId: other,
        friendName: known?.name ?? "Chess Mind player",
        friendRating: known?.rating ?? null,
        status: r.status as FriendshipStatus,
        outgoing: r.requested_by === childId,
        createdAt: r.created_at as string,
      };
    });

    return {
      enabled: true,
      accepted: rows.filter((r) => r.status === "accepted"),
      incoming: rows.filter((r) => r.status === "pending" && !r.outgoing),
      outgoing: rows.filter((r) => r.status === "pending" && r.outgoing),
    };
  } catch {
    return empty;
  }
}

/** The child's own shareable code, or null before 0034 is applied. */
export async function getFriendCode(
  supabase: SupabaseClient,
  childId: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("children")
      .select("friend_code")
      .eq("id", childId)
      .maybeSingle();
    if (error || !data) return null;
    return (data.friend_code as string | null) ?? null;
  } catch {
    return null;
  }
}

export type SendFriendRequestResult =
  | "pending"
  | "accepted"
  | "already_friends"
  | "not_found"
  | "self"
  | "not_authorized"
  | "not_enabled"
  | "error";

export async function sendFriendRequest(
  supabase: SupabaseClient,
  childId: string,
  friendCode: string
): Promise<SendFriendRequestResult> {
  try {
    const { data, error } = await supabase.rpc("send_friend_request", {
      p_child_id: childId,
      p_friend_code: friendCode,
    });
    if (error) {
      // Missing function reads the same as a missing table: not enabled yet.
      if (/does not exist|schema cache/i.test(error.message)) return "not_enabled";
      return "error";
    }
    return (data as SendFriendRequestResult) ?? "error";
  } catch {
    return "error";
  }
}

export async function respondToFriendRequest(
  supabase: SupabaseClient,
  childId: string,
  friendshipId: string,
  action: "accept" | "decline" | "remove" | "block"
): Promise<string> {
  try {
    const { data, error } = await supabase.rpc("respond_to_friend_request", {
      p_child_id: childId,
      p_friendship_id: friendshipId,
      p_action: action,
    });
    if (error) {
      if (/does not exist|schema cache/i.test(error.message)) return "not_enabled";
      return "error";
    }
    return (data as string) ?? "error";
  } catch {
    return "error";
  }
}

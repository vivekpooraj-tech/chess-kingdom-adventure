import type { SupabaseClient } from "@supabase/supabase-js";

export interface ChildProfile {
  id: string;
  display_name: string;
  avatar_id: string | null;
  buddy_id: string | null;
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

export async function markLessonComplete(
  supabase: SupabaseClient,
  childId: string,
  dayNumber: number
) {
  const { error } = await supabase.from("child_lesson_progress").upsert(
    {
      child_id: childId,
      day_number: dayNumber,
      status: "completed",
      completed_at: new Date().toISOString(),
    },
    { onConflict: "child_id,day_number" }
  );
  if (error) throw error;

  // Advance the map cursor so Kingdom Map unlocks the next day.
  const { error: advanceError } = await supabase
    .from("children")
    .update({ current_day: dayNumber + 1 })
    .eq("id", childId)
    .lte("current_day", dayNumber); // never move current_day backwards
  if (advanceError) throw advanceError;
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
  isPremium: boolean
): Promise<string[]> {
  // Import here (not at module top) to avoid a circular import between
  // lib/supabase and content/ — this file is the only place that needs it.
  const { ACHIEVEMENTS } = await import("@/content/achievements");

  const alreadyEarned = new Set(await getEarnedAchievementKeys(supabase, childId));
  const newlyEarned: string[] = [];

  for (const achievement of ACHIEVEMENTS) {
    if (alreadyEarned.has(achievement.key)) continue;

    let earned = false;
    if (achievement.criteria.type === "complete_day") {
      earned = completedDays.includes(achievement.criteria.day);
    } else if (achievement.criteria.type === "complete_count") {
      earned = completedDays.length >= achievement.criteria.count;
    } else if (achievement.criteria.type === "premium") {
      earned = isPremium;
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

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

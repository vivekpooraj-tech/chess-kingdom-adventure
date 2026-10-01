-- First-time cinematic opening (brand logo reveal, distinct from the
-- Chess Origins video shown by /welcome). One boolean per child, following
-- the exact pattern as avatar_id/buddy_id/experience_level: a dedicated
-- column, read as part of the normal child-profile select, written by its
-- own updateChildX()-style helper.
--
-- Column-level GRANT is required alongside the ALTER, not implied by it --
-- see 0032_grant_child_experience_update.sql for the exact incident this
-- would otherwise repeat: a new children column with no matching grant
-- fails client writes with 42501 permission denied, hard-blocking
-- onboarding. RLS ("parent can manage own children", 0001) still restricts
-- the write to the caller's own child.

alter table public.children
  add column if not exists has_seen_opening_video boolean not null default false;

comment on column public.children.has_seen_opening_video is
  'True once this child has been shown the first-time cinematic opening video. Never resets.';

grant update (has_seen_opening_video) on public.children to authenticated;

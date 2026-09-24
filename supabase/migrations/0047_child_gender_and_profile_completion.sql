-- Required "Tell us about you" onboarding step (name/gender/avatar are now
-- all mandatory for a new child profile — see lib/auth/postAuthDestination.ts
-- and the matching guards in app/(tabs)/kingdom-map/page.tsx,
-- app/choose-child/page.tsx and app/onboarding/experience/page.tsx).
--
-- Column-level GRANT is required alongside the ALTER, not implied by it --
-- see 0032_grant_child_experience_update.sql for the exact incident this
-- would otherwise repeat: a new children column with no matching grant
-- fails client writes with 42501 permission denied, hard-blocking
-- onboarding. RLS ("parent can manage own children", 0001) still restricts
-- the write to the caller's own child.
--
-- NEVER inferred from name/avatar/anything else — always an explicit user
-- choice, written by its own updateChildGender() helper
-- (lib/supabase/queries.ts), same pattern as avatar_id/buddy_id/
-- experience_level/has_seen_opening_video.

alter table public.children
  add column if not exists gender text
    check (gender in ('male', 'female', 'unspecified'));

comment on column public.children.gender is
  'Explicit user-selected gender identity: male, female, or unspecified ("prefer not to say"). NULL means not yet chosen (new-user onboarding incomplete). Never inferred.';

grant update (gender) on public.children to authenticated;

-- display_name was an original 0001 column and, until updateChildName()
-- (lib/supabase/queries.ts) existed, nothing had ever needed to UPDATE it
-- after insert — only INSERT/SELECT were ever granted. Same incident class
-- as 0032/0046: a column that needs a new kind of write needs its own
-- explicit grant, RLS alone does not imply it.
grant update (display_name) on public.children to authenticated;

-- display_name has always been `not null default 'Adventurer'` (0001_init.sql)
-- — meaning getOrCreateChild's bare `insert({ parent_id })` silently gave
-- every new child the identity "Adventurer" with no way to distinguish "the
-- user typed Adventurer on purpose" from "never asked." Dropping NOT NULL
-- (and the default) lets the application insert an explicit NULL for a
-- brand-new child and treat NULL — not the string 'Adventurer' — as "name
-- not yet chosen." Existing rows keep whatever they already have, including
-- any that are literally 'Adventurer', so no existing user's stored name
-- changes or gets reset by this migration.
alter table public.children
  alter column display_name drop not null,
  alter column display_name drop default;

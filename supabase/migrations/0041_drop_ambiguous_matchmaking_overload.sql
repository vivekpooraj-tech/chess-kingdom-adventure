-- Remove the two-argument find_or_create_match, which 0035 left behind.
--
-- THE PROBLEM
--
-- 0026 created find_or_create_match(uuid, int). 0035 added
-- find_or_create_match(uuid, int, text default '10+0') to carry the time
-- control, but never dropped the older one. Both now exist, and because the
-- third parameter has a DEFAULT, a two-argument call matches BOTH candidates.
--
-- PostgREST cannot choose, and refuses:
--
--   Could not choose the best candidate function between:
--     public.find_or_create_match(p_child_id => uuid, p_rating => integer),
--     public.find_or_create_match(p_child_id => uuid, p_rating => integer,
--                                 p_time_control => text)
--
-- That is a real, observed failure, not a theoretical one: it is what
-- scripts/test-rating-system.js hits today, which is why that suite crashes
-- against the live database.
--
-- The app itself is NOT currently broken. lib/supabase/queries.ts calls the
-- three-argument form first and only falls back to two arguments when the
-- three-argument function is missing (the pre-0035 world). Since 0035 is
-- applied, the fallback is never taken. But the fallback is now a landmine: if
-- it were ever reached it would fail with the error above rather than
-- degrading gracefully, which is the opposite of what it was written to do.
--
-- THE FIX
--
-- Drop the superseded two-argument function. Afterwards exactly one
-- find_or_create_match exists, two- and three-argument calls both resolve to
-- it unambiguously, and the fallback in queries.ts becomes harmless again.
--
-- SAFETY
--
--   * The three-argument version's DEFAULT means every existing two-argument
--     caller keeps working and keeps getting a 10+0 game, exactly as before.
--   * No data is touched. This drops a function, not a row.
--   * `if exists` makes it safe to run more than once, and safe on a database
--     where 0026's version was never created.
--
-- ORDERING: apply AFTER 0035. Harmless if 0035 has not been applied — in that
-- case this would drop the only version, so DO NOT run it on a database
-- without 0035. Verify with the query at the bottom first.
--
-- ROLLBACK: re-run the create-function block from 0026 verbatim. Nothing
-- depends on the two-argument signature existing.

do $$
begin
  -- Only drop the 2-arg form when the 3-arg form is actually present, so this
  -- cannot leave the database with no matchmaking function at all.
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'find_or_create_match'
      and pg_get_function_identity_arguments(p.oid) = 'uuid, integer, text'
  ) then
    drop function if exists public.find_or_create_match(uuid, int);
    raise notice 'dropped the superseded 2-argument find_or_create_match';
  else
    raise notice 'the 3-argument find_or_create_match is absent; nothing dropped';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- VERIFICATION (read-only)
-- ---------------------------------------------------------------------------
-- Run BEFORE to confirm both exist, and AFTER to confirm only the 3-arg
-- version remains. Expect one row afterwards: 'uuid, integer, text'.
--
-- select pg_get_function_identity_arguments(p.oid) as signature
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' and p.proname = 'find_or_create_match'
-- order by 1;

-- Extends child_opening_encounters (0010) with the fields needed for a
-- real, honest DISCOVERED -> STUDIED -> PRACTICED -> MASTERED progression:
--   DISCOVERED — row exists at all (opening reached in a real game, unchanged from 0010).
--   STUDIED    — studied_at is set (viewed the opening's Academy detail page).
--   PRACTICED  — practice_attempts > 0 (completed at least one practice session).
--   MASTERED   — practice_successes >= the threshold defined alongside
--                MASTERY_THRESHOLD in lib/openings/practiceTracking.ts
--                (currently 3) — "successfully" means the player played the
--                opening's full defining move sequence without deviating,
--                not just "attempted."
-- Status itself is computed from these fields at read time (see
-- lib/openings/practiceTracking.ts), not stored redundantly.
alter table public.child_opening_encounters
  add column studied_at timestamptz,
  add column practice_attempts int not null default 0,
  add column practice_successes int not null default 0;

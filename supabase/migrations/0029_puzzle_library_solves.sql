-- Phase 14C: cross-library puzzle solve history.
--
-- Until now there was NO record of which Puzzle Trainer puzzles a child had
-- solved:
--   * puzzle_attempts (0005) is keyed by day_number (int) -- Academy
--     lesson-day puzzles only, not the content/puzzles.ts id space;
--   * daily_challenge_history (0025) is one row per child per DAY -- it
--     tracks the Daily Challenge outcome, not "has this child ever solved
--     puzzle X".
--
-- puzzle_library_solves is that missing record: one row per (child, puzzle)
-- the first time the child solves it, whether through the Puzzle Trainer or
-- the Daily Challenge. It powers:
--   * no-repeat selection in the Puzzle Trainer (prefer unsolved puzzles);
--   * an accurate "Puzzles" count on the Parent Dashboard that does not
--     double-count a puzzle solved through both Trainer and Daily Challenge;
--   * the data foundation for a future Premium "complete puzzle history".
--
-- Deliberately NOT changed by this migration:
--   * daily_challenge_history / daily_challenge_puzzles and their RPCs --
--     daily_challenge_history stays authoritative for daily status, result,
--     attempts and challenge date; this table is additive and independent;
--   * puzzle_attempts -- lesson-puzzle accuracy is untouched;
--   * RLS on any existing table.
--
-- puzzle_id is intentionally a bare text column with NO foreign key: puzzle
-- CONTENT lives in application code (content/puzzles.ts), not the database
-- (same accepted tradeoff as daily_challenge_puzzles' metadata mirror and
-- TIME_CONTROLS vs online_games.time_control).

create table if not exists public.puzzle_library_solves (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  puzzle_id text not null,
  source text not null check (source in ('trainer', 'daily')),
  first_try boolean not null,
  attempts integer not null default 1,
  solved_at timestamptz not null default now(),
  -- One row per puzzle per child: a puzzle is "solved" once. Re-solving it
  -- (through either surface) must not create a second row, so the client
  -- writes with `on conflict (child_id, puzzle_id) do nothing` -- the
  -- original solved_at / first_try / attempts are preserved as recorded.
  unique (child_id, puzzle_id)
);

create index if not exists puzzle_library_solves_child_solved_at_idx
  on public.puzzle_library_solves (child_id, solved_at desc);

alter table public.puzzle_library_solves enable row level security;

-- Same ownership model as puzzle_attempts (0005): the authenticated parent
-- can read/write only rows belonging to their own children. No anon access,
-- no broad public access.
drop policy if exists "parent can manage own child's puzzle library solves" on public.puzzle_library_solves;
create policy "parent can manage own child's puzzle library solves"
  on public.puzzle_library_solves for all
  using (
    child_id in (
      select c.id from public.children c
      join public.parents p on p.id = c.parent_id
      where p.auth_user_id = auth.uid()
    )
  )
  with check (
    child_id in (
      select c.id from public.children c
      join public.parents p on p.id = c.parent_id
      where p.auth_user_id = auth.uid()
    )
  );

-- Phase 26: Game Review learning signals.
--
-- The post-game Game Review (components/game/analysis/PostGameAnalysis.tsx)
-- already runs the engine analysis, an accuracy score, a "biggest learning
-- moment" with a conservative skill attribution, and a "practice this
-- skill" loop into existing puzzle/lesson content. Until now NONE of that
-- was persisted -- every review was in-memory and gone on navigation, so
-- the app could never say "you've seen this pattern before" or feed a real
-- weakness signal into the learner model / Parent Dashboard.
--
-- This migration is ADDITIVE and idempotent. It adds two new tables and
-- touches NOTHING that already exists:
--
--   1. child_game_reviews   -- one row per completed review: which game,
--      accuracy, move-quality counts, the biggest-moment skill. A durable
--      "recent reviews" record and the raw material for future trend UI.
--
--   2. child_skill_signals  -- one row per (child, skill): how often that
--      skill has been flagged as a mistake in reviews (`weak_count`) and
--      how the child has done in the matching practice
--      (`practice_attempts` / `practice_correct`). This is the signal the
--      review reads to show "this is a pattern you've seen before" and
--      that Phase D+ surfaces on the Parent Dashboard.
--
-- Deliberately NOT changed:
--   * child_chess_mind_stats / child_chess_mind_activity (0011, 0014) --
--     the existing practice-volume model is untouched; skill signals are a
--     separate, complementary concept (a *weakness* signal is the opposite
--     of a practice-count), kept in their own table so nothing that sums
--     child_chess_mind_stats (getChessMindTotalSolved, kingdomUnlocks.ts,
--     streak logic, Parent Dashboard "Skills Snapshot") is affected.
--   * children.experience_level / age_band (0027) -- read only.
--   * puzzle_library_solves (0029), puzzle_attempts (0005), RLS on any
--     existing table.
--
-- `skill` / `biggest_moment_skill` are bare text columns with NO foreign
-- key or enum: the skill TAXONOMY lives in application code
-- (lib/analysis/skills.ts), same accepted tradeoff as puzzle_id in
-- puzzle_library_solves and module_id in child_chess_mind_stats. The app
-- coerces unknown values to its neutral bucket on read.

-- --------------------------------------------------------------------------
-- 1. child_game_reviews -- one row per completed Game Review
-- --------------------------------------------------------------------------
create table if not exists public.child_game_reviews (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  -- Which surface the reviewed game came from.
  source text not null check (source in ('free_play', 'online')),
  played_color text check (played_color in ('w', 'b')),
  result text check (result in ('win', 'loss', 'draw')),
  -- 0-100 Chess Mind accuracy (lib/analysis/accuracy.ts). Nullable only for
  -- the degenerate "no player moves analyzed" case.
  accuracy int check (accuracy is null or (accuracy between 0 and 100)),
  total_moves int check (total_moves is null or total_moves >= 0),
  mistakes int not null default 0 check (mistakes >= 0),
  blunders int not null default 0 check (blunders >= 0),
  inaccuracies int not null default 0 check (inaccuracies >= 0),
  -- SkillId of the biggest learning moment; NULL when the game had no
  -- flagged mistakes (a clean game still gets a review row).
  biggest_moment_skill text,
  biggest_moment_ply int check (biggest_moment_ply is null or biggest_moment_ply >= 0),
  opening_name text,
  reviewed_at timestamptz not null default now()
);

create index if not exists child_game_reviews_child_reviewed_at_idx
  on public.child_game_reviews (child_id, reviewed_at desc);

alter table public.child_game_reviews enable row level security;

-- Same ownership model as puzzle_library_solves (0029) / puzzle_attempts
-- (0005): the authenticated parent can read/write only rows for their own
-- children. No anon, no broad public access. A parent reaches a child's
-- reviews through the existing parents -> children relationship only.
drop policy if exists "parent can manage own child's game reviews" on public.child_game_reviews;
create policy "parent can manage own child's game reviews"
  on public.child_game_reviews for all
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

-- --------------------------------------------------------------------------
-- 2. child_skill_signals -- rolling per-(child, skill) learning signal
-- --------------------------------------------------------------------------
create table if not exists public.child_skill_signals (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  -- SkillId from lib/analysis/skills.ts.
  skill text not null,
  -- Times this skill has been the cause of a flagged mistake in a review.
  weak_count int not null default 0 check (weak_count >= 0),
  -- How the child has done in review-driven practice for this skill.
  practice_attempts int not null default 0 check (practice_attempts >= 0),
  practice_correct int not null default 0 check (practice_correct >= 0),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One row per child per skill -- writers upsert with
  -- `on conflict (child_id, skill)`.
  unique (child_id, skill)
);

create index if not exists child_skill_signals_child_idx
  on public.child_skill_signals (child_id);

alter table public.child_skill_signals enable row level security;

drop policy if exists "parent can manage own child's skill signals" on public.child_skill_signals;
create policy "parent can manage own child's skill signals"
  on public.child_skill_signals for all
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

-- --------------------------------------------------------------------------
-- bump_skill_signal(child, skill, weak_delta, attempts_delta, correct_delta)
--
-- Atomic upsert so recording a review's mistakes (several skills at once)
-- and recording a practice result don't race. SECURITY DEFINER + an
-- explicit ownership check, matching the pattern used by the free-game and
-- daily-challenge RPCs -- the caller can only ever touch their own child.
-- --------------------------------------------------------------------------
create or replace function public.bump_skill_signal(
  p_child_id uuid,
  p_skill text,
  p_weak_delta int default 0,
  p_attempts_delta int default 0,
  p_correct_delta int default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.children c
    join public.parents p on p.id = c.parent_id
    where c.id = p_child_id and p.auth_user_id = auth.uid()
  ) then
    raise exception 'not authorized for this child';
  end if;

  insert into public.child_skill_signals as s
    (child_id, skill, weak_count, practice_attempts, practice_correct, last_seen_at, updated_at)
  values
    (p_child_id, p_skill, greatest(p_weak_delta, 0), greatest(p_attempts_delta, 0),
     greatest(p_correct_delta, 0), now(), now())
  on conflict (child_id, skill) do update set
    weak_count = s.weak_count + greatest(p_weak_delta, 0),
    practice_attempts = s.practice_attempts + greatest(p_attempts_delta, 0),
    practice_correct = s.practice_correct + greatest(p_correct_delta, 0),
    last_seen_at = now(),
    updated_at = now();
end;
$$;

revoke all on function public.bump_skill_signal(uuid, text, int, int, int) from public;
grant execute on function public.bump_skill_signal(uuid, text, int, int, int) to authenticated;

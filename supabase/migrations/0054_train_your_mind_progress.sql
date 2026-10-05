-- Train Your Chess Mind — per-child, per-category progression (level, progress,
-- mastery). One row per (child, category).
--
-- WHY A TABLE: the redesigned Train Your Mind has five levels per category
-- (Foundation -> Master). A child's level must follow them across devices and
-- sessions, exactly like the Phase 1 exercise history (0053), so it lives in the
-- database keyed by child_id — never in the browser.
--
-- WRITE MODEL (same as 0044 / 0053): clients may SELECT their own children's rows
-- via RLS; every write goes through a SECURITY DEFINER RPC that re-verifies
-- parent -> child ownership from auth.uid(). The progression RULES live in
-- lib/trainYourMind/progression.ts (single source of truth); the RPC stores the
-- resulting snapshot and enforces only what is security-relevant:
--   * the module id must be one of the seven real categories,
--   * a free account can never be stored above level 2 (FREE_MAX_LEVEL in
--     lib/trainYourMind/curriculum.ts) — checked with the existing
--     parent_is_premium(), not re-derived,
--   * payload sizes are bounded.
--
-- Purely additive. Does not touch the daily cap (child_train_your_mind_activity /
-- record_train_your_mind_use), exercise history (0053), pricing, or entitlement.
--
-- ROLLBACK (not run automatically):
--   drop function if exists public.save_train_your_mind_progress(uuid, text, smallint, smallint, int, int, jsonb, jsonb, jsonb, boolean);
--   drop table if exists public.child_train_your_mind_progress;

create table public.child_train_your_mind_progress (
  child_id uuid not null references public.children(id) on delete cascade,
  module_id text not null,
  level smallint not null default 1,
  best_level smallint not null default 1,
  attempts int not null default 0,
  correct int not null default 0,
  recent jsonb not null default '[]'::jsonb,
  last_ten jsonb not null default '[]'::jsonb,
  family_stats jsonb not null default '{}'::jsonb,
  mastered boolean not null default false,
  mastered_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (child_id, module_id),
  constraint tym_progress_module check (
    module_id in ('pattern', 'visualization', 'calculation', 'memory', 'spatial', 'mathematics', 'reaction')
  ),
  constraint tym_progress_level check (level between 1 and 5 and best_level between 1 and 5),
  constraint tym_progress_counts check (attempts >= 0 and correct >= 0 and correct <= attempts and attempts <= 1000000)
);

alter table public.child_train_your_mind_progress enable row level security;

create policy "parent can view own child's train your mind progress"
  on public.child_train_your_mind_progress for select
  using (
    child_id in (
      select c.id from public.children c
      join public.parents p on p.id = c.parent_id
      where p.auth_user_id = auth.uid()
    )
  );

-- No insert/update/delete policy. Also withdraw every table privilege that is not
-- needed, so safety does not rest on RLS alone: anon gets nothing, authenticated
-- may only SELECT.
revoke all on public.child_train_your_mind_progress from public, anon, authenticated;
grant select on public.child_train_your_mind_progress to authenticated;

-- ----------------------------------------------------------------------------
-- save_train_your_mind_progress(...) — the one write path.
--
-- Idempotent upsert of the snapshot the app computed. Raises if the caller does
-- not own p_child_id. A non-premium parent's level is clamped to 2.
-- ----------------------------------------------------------------------------
create or replace function public.save_train_your_mind_progress(
  p_child_id uuid,
  p_module_id text,
  p_level smallint,
  p_best_level smallint,
  p_attempts int,
  p_correct int,
  p_recent jsonb,
  p_last_ten jsonb,
  p_family_stats jsonb,
  p_mastered boolean
)
returns void
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare
  v_parent_id uuid;
  v_is_premium boolean;
  v_level smallint;
  v_best smallint;
begin
  select c.parent_id into v_parent_id
  from public.children c
  join public.parents p on p.id = c.parent_id
  where c.id = p_child_id and p.auth_user_id = auth.uid();

  if v_parent_id is null then
    raise exception 'not authorized for this child';
  end if;

  if p_module_id is null
     or p_module_id not in ('pattern', 'visualization', 'calculation', 'memory', 'spatial', 'mathematics', 'reaction') then
    raise exception 'invalid module';
  end if;

  if p_level is null or p_level not between 1 and 5
     or p_best_level is null or p_best_level not between 1 and 5
     or p_attempts is null or p_attempts < 0 or p_attempts > 1000000
     or p_correct is null or p_correct < 0 or p_correct > p_attempts then
    raise exception 'invalid progress values';
  end if;

  if jsonb_typeof(p_recent) <> 'array' or jsonb_array_length(p_recent) > 12
     or jsonb_typeof(p_last_ten) <> 'array' or jsonb_array_length(p_last_ten) > 10
     or jsonb_typeof(p_family_stats) <> 'object' or pg_column_size(p_family_stats) > 4096
     or pg_column_size(p_recent) > 4096 then
    raise exception 'progress payload too large or malformed';
  end if;

  v_is_premium := public.parent_is_premium(v_parent_id);
  -- Free accounts train Foundation + Developing only (FREE_MAX_LEVEL = 2).
  v_level := case when v_is_premium then p_level else least(p_level, 2::smallint) end;
  v_best := case when v_is_premium then p_best_level else least(p_best_level, 2::smallint) end;

  insert into public.child_train_your_mind_progress as t
    (child_id, module_id, level, best_level, attempts, correct, recent, last_ten, family_stats, mastered, mastered_at, updated_at)
  values
    (p_child_id, p_module_id, v_level, v_best, p_attempts, p_correct, p_recent, p_last_ten, p_family_stats,
     coalesce(p_mastered, false) and v_is_premium, case when coalesce(p_mastered, false) and v_is_premium then now() end, now())
  on conflict (child_id, module_id) do update
    set level = excluded.level,
        best_level = greatest(t.best_level, excluded.best_level),
        attempts = excluded.attempts,
        correct = excluded.correct,
        recent = excluded.recent,
        last_ten = excluded.last_ten,
        family_stats = excluded.family_stats,
        mastered = t.mastered or excluded.mastered,
        mastered_at = coalesce(t.mastered_at, excluded.mastered_at),
        updated_at = now();
end;
$$;

revoke all on function public.save_train_your_mind_progress(uuid, text, smallint, smallint, int, int, jsonb, jsonb, jsonb, boolean) from public, anon;
grant execute on function public.save_train_your_mind_progress(uuid, text, smallint, smallint, int, int, jsonb, jsonb, jsonb, boolean) to authenticated;

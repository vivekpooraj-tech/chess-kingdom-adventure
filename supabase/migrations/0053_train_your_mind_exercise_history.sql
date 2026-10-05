-- Train Your Chess Mind — Phase 1: persistent per-child exercise history.
--
-- Until now every drill picked its next exercise with client-side
-- Math.random() and kept no memory beyond the page, so the same child could
-- be served the same exercise again after a refresh, on another device, or in
-- another session. This table remembers which exercises a CHILD PROFILE has
-- recently been shown, so selection (lib/trainYourMind/exerciseSelection.ts)
-- can avoid them regardless of which device/session is asking.
--
-- Keyed by child_id (never by device, browser, or auth session) so that the
-- same child on Device A and Device B shares one history.
--
-- Purely additive: one new table and one new function. No existing table,
-- policy, function, or row is touched. It does NOT affect the daily cap
-- (child_train_your_mind_activity / record_train_your_mind_use), pricing,
-- or Premium entitlement.
--
-- Same write model as 0044: clients may SELECT their own children's rows via
-- RLS, but every write goes through a SECURITY DEFINER RPC that re-verifies
-- parent -> child ownership from auth.uid().
--
-- exercise_id is an opaque, deterministic string produced by the app (see
-- lib/trainYourMind/exerciseIds.ts); the database does not interpret it.
--
-- Growth is bounded: the RPC keeps only the newest 200 rows per
-- (child_id, module_id).
--
-- ROLLBACK (not run automatically):
--   drop function if exists public.record_train_your_mind_exercise_seen(uuid, text, text);
--   drop table if exists public.child_train_your_mind_exercise_history;

create table public.child_train_your_mind_exercise_history (
  child_id uuid not null references public.children(id) on delete cascade,
  module_id text not null,
  exercise_id text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  times_seen int not null default 1,
  primary key (child_id, module_id, exercise_id),
  constraint tym_history_module_len check (char_length(module_id) between 1 and 40),
  constraint tym_history_exercise_len check (char_length(exercise_id) between 1 and 200)
);

create index tym_exercise_history_recent_idx
  on public.child_train_your_mind_exercise_history (child_id, module_id, last_seen_at desc);

alter table public.child_train_your_mind_exercise_history enable row level security;

create policy "parent can view own child's train your mind exercise history"
  on public.child_train_your_mind_exercise_history for select
  using (
    child_id in (
      select c.id from public.children c
      join public.parents p on p.id = c.parent_id
      where p.auth_user_id = auth.uid()
    )
  );

-- No insert/update/delete policy; writes only via the RPC below.
revoke insert, update, delete on public.child_train_your_mind_exercise_history from authenticated;

-- ----------------------------------------------------------------------------
-- record_train_your_mind_exercise_seen(child, module, exercise)
--
-- Idempotent upsert: the first call inserts, later calls bump last_seen_at and
-- times_seen. Safe to call twice for the same presentation (it only moves
-- recency forward). Raises if the caller does not own p_child_id.
-- ----------------------------------------------------------------------------
create or replace function public.record_train_your_mind_exercise_seen(
  p_child_id uuid,
  p_module_id text,
  p_exercise_id text
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_parent_id uuid;
begin
  select c.parent_id into v_parent_id
  from public.children c
  join public.parents p on p.id = c.parent_id
  where c.id = p_child_id and p.auth_user_id = auth.uid();

  if v_parent_id is null then
    raise exception 'not authorized for this child';
  end if;

  if p_module_id is null or char_length(p_module_id) not between 1 and 40
     or p_exercise_id is null or char_length(p_exercise_id) not between 1 and 200 then
    raise exception 'invalid module or exercise id';
  end if;

  insert into public.child_train_your_mind_exercise_history (child_id, module_id, exercise_id)
  values (p_child_id, p_module_id, p_exercise_id)
  on conflict (child_id, module_id, exercise_id) do update
    set last_seen_at = now(),
        times_seen = child_train_your_mind_exercise_history.times_seen + 1;

  -- Bound growth: keep only the newest 200 rows for this child + module.
  delete from public.child_train_your_mind_exercise_history h
  where h.child_id = p_child_id
    and h.module_id = p_module_id
    and h.exercise_id in (
      select x.exercise_id
      from public.child_train_your_mind_exercise_history x
      where x.child_id = p_child_id and x.module_id = p_module_id
      order by x.last_seen_at desc, x.exercise_id
      offset 200
    );
end;
$$;

revoke all on function public.record_train_your_mind_exercise_seen(uuid, text, text) from public, anon;
grant execute on function public.record_train_your_mind_exercise_seen(uuid, text, text) to authenticated;

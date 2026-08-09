-- Chess Mind expansion (Phase 7 continued). child_chess_mind_stats (0011)
-- already has a free-text module_id column, so new categories (pattern,
-- memory, visualization) need no schema change there — this migration only
-- adds what's genuinely new: per-day activity, for a real (not fabricated)
-- streak and "practiced today" signal.
create table public.child_chess_mind_activity (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  activity_date date not null,
  module_id text not null,
  created_at timestamptz not null default now(),
  unique (child_id, activity_date, module_id)
);

alter table public.child_chess_mind_activity enable row level security;

create policy "parent can manage own child's chess mind activity"
  on public.child_chess_mind_activity for all
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

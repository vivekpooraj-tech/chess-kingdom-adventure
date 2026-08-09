-- Tracks how many locked-day puzzle previews a free (non-premium) child has
-- used today — capped at 3/day across ANY locked day (not just one specific
-- day), as a "try before you buy" sample of the paid content. Same
-- local-date-string pattern as screen_time_usage for the same reason: the
-- "day" boundary should follow the child's device clock, not server UTC.

create table public.puzzle_preview_usage (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  usage_date date not null,
  previews_used int not null default 0,
  unique (child_id, usage_date)
);

alter table public.puzzle_preview_usage enable row level security;

create policy "parent can manage own child's puzzle preview usage"
  on public.puzzle_preview_usage for all
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

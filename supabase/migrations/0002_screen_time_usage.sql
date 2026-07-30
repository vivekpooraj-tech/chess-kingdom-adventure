-- Screen-time usage tracking — one row per child per calendar day.
-- Date is tracked as the child's LOCAL calendar date (computed client-side
-- and passed in), not the server's UTC date — otherwise a family in, say,
-- US Pacific time would see their "day" flip at 5pm local time (midnight
-- UTC), which would be a confusing and wrong day-boundary for screen-time
-- purposes. Known v1 simplification: relies on the device's clock being
-- roughly correct; a determined kid changing their system clock could
-- reset their own limit early — acceptable for a v1 family-trust feature,
-- not a security boundary.

create table public.screen_time_usage (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  usage_date date not null,
  minutes_used int not null default 0,
  unique (child_id, usage_date)
);

alter table public.screen_time_usage enable row level security;

create policy "parent can manage own child's screen time usage"
  on public.screen_time_usage for all
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

-- Generic completion/progress tracking for Academy content (starting with
-- the History of Chess video/timeline) — separate from
-- child_lesson_progress since Academy content isn't part of the 30-day
-- Kingdom Journey and isn't numbered by day.
create table public.child_academy_progress (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  content_id text not null, -- matches an id in content/academyVideos.ts
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  progress_seconds int not null default 0, -- video resume position; unused for text-only content
  quiz_score int, -- correct answers out of the quiz length; null until taken
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (child_id, content_id)
);

alter table public.child_academy_progress enable row level security;

create policy "parent can manage own child's academy progress"
  on public.child_academy_progress for all
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

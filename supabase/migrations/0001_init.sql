-- Chess Kingdom Adventure — v1 slice schema
-- Scope note: avatars/ai_buddies are static content defined in code
-- (content/avatars.ts, content/buddies.ts, content/minigame-catalog.ts) for
-- this slice, not DB tables — that matches the full schema in
-- docs/03-database-schema.md conceptually but skips the CMS-style tables
-- until there's an actual reason to edit content without a deploy.

-- 1. Parents ----------------------------------------------------------------
create table public.parents (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  email text,
  premium_status text not null default 'free' check (premium_status in ('free', 'premium')),
  screen_time_weekday_minutes int not null default 60,
  screen_time_weekend_minutes int not null default 180,
  created_at timestamptz not null default now()
);

alter table public.parents enable row level security;

create policy "parents can read own row"
  on public.parents for select
  using (auth_user_id = auth.uid());

create policy "parents can update own row"
  on public.parents for update
  using (auth_user_id = auth.uid());

-- Auto-create a parent row the moment someone signs up, so app code never
-- has to worry about a missing parent record — only ever a missing child.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.parents (auth_user_id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Children -----------------------------------------------------------------
create table public.children (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.parents(id) on delete cascade,
  display_name text not null default 'Adventurer',
  avatar_id text,          -- matches an id in content/avatars.ts
  buddy_id text,           -- matches an id in content/buddies.ts
  current_day int not null default 1,
  created_at timestamptz not null default now()
);

alter table public.children enable row level security;

create policy "parent can manage own children"
  on public.children for all
  using (
    parent_id in (select id from public.parents where auth_user_id = auth.uid())
  )
  with check (
    parent_id in (select id from public.parents where auth_user_id = auth.uid())
  );

-- 3. Lesson progress ----------------------------------------------------------
create table public.child_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  day_number int not null,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  completed_at timestamptz,
  unique (child_id, day_number)
);

alter table public.child_lesson_progress enable row level security;

create policy "parent can manage own child's progress"
  on public.child_lesson_progress for all
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

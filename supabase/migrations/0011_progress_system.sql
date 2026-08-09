-- Real backing data for Phase 9's progress/achievement expansion. Every new
-- achievement criterion this phase adds is computed from one of these two
-- tables (or from existing online_games data) — nothing is fabricated.

-- Distinct openings a child has actually reached in a real game, first-seen
-- timestamp kept for potential future "recently learned" UI. Written by the
-- client the moment lib/openings/recognitionEngine.ts first identifies a
-- new opening for that child (see app/free-play/page.tsx).
create table public.child_opening_encounters (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  opening_id text not null, -- matches an id in content/openings.ts
  first_seen_at timestamptz not null default now(),
  unique (child_id, opening_id)
);

alter table public.child_opening_encounters enable row level security;

create policy "parent can manage own child's opening encounters"
  on public.child_opening_encounters for all
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

-- Running totals per Chess Mind module (spatial, mathematics, ...). One row
-- per child+module, incremented on every correct answer — a real, if
-- simple, measure of practice rather than a fabricated "mastery score."
create table public.child_chess_mind_stats (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  module_id text not null, -- "spatial" | "mathematics"
  total_solved int not null default 0,
  updated_at timestamptz not null default now(),
  unique (child_id, module_id)
);

alter table public.child_chess_mind_stats enable row level security;

create policy "parent can manage own child's chess mind stats"
  on public.child_chess_mind_stats for all
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

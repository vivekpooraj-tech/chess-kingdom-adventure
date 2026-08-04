-- Tracks every puzzle attempt (not just the final outcome) so the parent
-- dashboard can show real accuracy — "moved the intended piece" is the bar
-- for "correct" here (see the comment on PuzzleContent.acceptedPieceTypes
-- in lib/types.ts for why: most puzzle positions are simplified movement
-- practice, not single-answer tactics).

create table public.puzzle_attempts (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  day_number int not null,
  is_correct boolean not null,
  attempt_number int not null default 1,
  created_at timestamptz not null default now()
);

alter table public.puzzle_attempts enable row level security;

create policy "parent can manage own child's puzzle attempts"
  on public.puzzle_attempts for all
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

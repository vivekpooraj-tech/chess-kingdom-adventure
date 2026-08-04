-- Adds a selectable board skin per child, following the same
-- static-content-in-code pattern as avatar_id/buddy_id — content/boardSkins.ts
-- is the source of truth for valid ids, not a DB table. "classic-forest" as
-- the default reproduces the board's original hardcoded colors exactly, so
-- every existing child keeps today's look with no migration-time visual change.
alter table public.children
  add column board_skin_id text not null default 'classic-forest';

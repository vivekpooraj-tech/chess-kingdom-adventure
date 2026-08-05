-- Splits piece style out from board skin as its own independent choice, so
-- any piece set can pair with any board. content/pieceSets.ts is the source
-- of truth for valid ids, same static-content-in-code pattern as
-- avatar_id/buddy_id/board_skin_id. "classic" as the default reproduces the
-- original flat-silhouette pieces, so no visual change for existing children.
alter table public.children
  add column piece_set_id text not null default 'classic';

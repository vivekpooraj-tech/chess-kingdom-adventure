-- The "classic" piece set (public/pieces/light|dark/*.svg) has been removed
-- from content/pieceSets.ts and its asset files deleted. Existing children
-- whose stored piece_set_id is still 'classic' are unaffected at read time —
-- getPieceSet() already falls back to DEFAULT_PIECE_SET_ID for any
-- unrecognized id — but the column's insert-time default was still the now
-- deleted 'classic', so every brand-new child row (getOrCreateChild inserts
-- with no explicit piece_set_id) would keep defaulting to a dead value.
-- Point it at the same set the app-level DEFAULT_PIECE_SET_ID already uses.
alter table public.children alter column piece_set_id set default 'neostaunton-hand';

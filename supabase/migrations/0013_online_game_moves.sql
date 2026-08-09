-- Real gap found while wiring opening recognition into online games:
-- online_games only ever stored the CURRENT fen, never the move history.
-- ChessBoard rebuilds its internal Chess instance from scratch whenever its
-- `fen` prop changes (see components/board/ChessBoard.tsx's `useMemo(() =>
-- new Chess(fen), [fen])`) — which happens on every single move in an
-- online game, since each move round-trips through Supabase and back via
-- Realtime. That means ChessBoard's own onPositionChange.history is
-- effectively always empty for online games, unlike Free Play where the
-- board owns the whole game locally. The opening recognition engine needs
-- the real SAN sequence, so it has to come from the database instead.
alter table public.online_games
  add column moves text[] not null default '{}';

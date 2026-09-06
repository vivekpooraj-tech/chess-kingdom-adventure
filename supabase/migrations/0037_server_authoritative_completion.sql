-- Take result reporting away from the client.
--
-- finish_online_game_by_result is granted to `authenticated`, so any signed-in
-- participant can call it directly and name the winner. Migration 0036 made an
-- instant self-declared win impossible, but a player could still claim one
-- after four arbitrary moves — the function has never looked at the board,
-- because Postgres has no chess engine to look with.
--
-- The verification now lives in the Next.js server (app/api/online/[gameId]/
-- complete), which replays the stored moves with chess.js and decides the
-- result itself. That route uses the service role, which is not subject to
-- these grants, so the client no longer needs this privilege — and should not
-- have it.
--
-- After this migration:
--   * a browser cannot finish a game directly; it can only ask the route to
--   * the route derives the winner from the replayed position, or from who is
--     resigning, and never from anything the client sent
--   * claim_timeout keeps its grant: it is already server-authoritative, it
--     decides expiry from clock_timestamp() and last_move_at, and the client
--     cannot influence its outcome
--
-- The function itself is unchanged, including 0036's guard, which stays as
-- defence in depth for anything still holding the privilege.
--
-- Safe to run more than once.
--
-- ROLLBACK, if the route needs to be disabled in a hurry:
--   grant execute on function public.finish_online_game_by_result(uuid, uuid, text) to authenticated;

revoke execute on function public.finish_online_game_by_result(uuid, uuid, text) from authenticated;

-- Belt and braces: PUBLIC should never have held it, but make that explicit
-- rather than assumed.
revoke execute on function public.finish_online_game_by_result(uuid, uuid, text) from public;

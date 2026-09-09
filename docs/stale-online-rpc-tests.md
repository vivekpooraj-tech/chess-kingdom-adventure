# Three online-game suites still call revoked client RPCs

**Status:** known-stale, not a product regression. Do not delete them — they
cover behaviour nothing else covers, and the fix is small but not mechanical.

## What fails

| Suite | Result |
| --- | --- |
| `scripts/test-tournament-security.js` | 28 pass / 3 fail |
| `scripts/test-rated-match-e2e.js` | 14 pass / 6 fail |
| `scripts/test-random-match-invite-regression.js` | 20 pass / 7 fail |

Every one of the 16 failures is the same error:

```
permission denied for function submit_online_move
permission denied for function finish_online_game_by_result
```

## Why it is not a regression

Migrations `0037`, `0038` and `0039` deliberately revoke both functions from
`public`, `anon` and `authenticated`:

```sql
-- 0039_fix_authority_guard.sql
revoke execute on function public.submit_online_move(uuid, uuid, text, text) from authenticated;
revoke execute on function public.finish_online_game_by_result(uuid, uuid, text) from authenticated;
```

The browser no longer submits moves or results directly. It POSTs to
`/api/online/[gameId]/move` and `/complete`, which validate server-side and
then call the `*_as_server` variants with the service-role client. See
`lib/supabase/queries.ts:718` — *"0039 makes the browser-facing
submit_online_move raise unconditionally"* — and the assertion in
`test-authority-guards.js`: *"no module calls the deprecated client move/finish
wrappers."*

These suites are asserting a capability the hardening removed on purpose.

Several failures are also **cascades**, not independent faults. In
`test-random-match-invite-regression.js` the move at line 92 is denied, so the
turn never flips; `claim_timeout` then correctly makes the side actually on the
clock lose, and the assertion at line 113 reports `expected w, got b`. That is
`claim_timeout` behaving correctly with a failed precondition.

## The migration

Signatures are identical apart from the suffix and the calling client. Each of
the three files already declares both `admin` (service role) and `client`.

```diff
-await client.rpc("submit_online_move", { p_game_id, p_child_id, p_fen, p_san })
+await admin.rpc("submit_online_move_as_server", { p_game_id, p_child_id, p_fen, p_san })

-await client.rpc("finish_online_game_by_result", { p_game_id, p_child_id, p_winner })
+await admin.rpc("finish_online_game_by_result_as_server", { p_game_id, p_child_id, p_winner })
```

12 call sites:

- `test-tournament-security.js` — 196, 212, 217, 224
- `test-rated-match-e2e.js` — 221, 268, 332, 367, 388
- `test-random-match-invite-regression.js` — 92, 143, 151

## Why this was NOT done as part of release verification

It is 12 lines, but it is not a mechanical rename, and doing it carelessly
would weaken security tests.

**1. Three assertions would silently change meaning.** In
`test-tournament-security.js` the calls fall into two different categories that
the file currently treats identically:

- Lines 196, 212, 217 are *setup and idempotency* — they want the call to
  succeed, or to be a no-op on an already-finished game. These test the SQL
  function's own logic and belong on `admin` + `_as_server`.
- Line 224 (`a non-participant child_id cannot submit a result`) is a
  *boundary* assertion. Moving it to `admin` would test the function's
  ownership check; leaving it on `client` tests the GRANT. Those are two
  different properties and both are worth having — but they are not the same
  test.

**2. That assertion currently passes for the wrong reason.** It asserts
`!!strangerErr` — any error counts. Since the revocation, it is satisfied by
`permission denied` before the ownership check is ever reached. It is green
while no longer testing what its name claims.

**3. The trust model changed too.** These tests pass a client-supplied
`p_fen`/`p_san`. The real route *generates* both server-side from chess.js
(`lib/online/moveValidation.ts`) and never trusts the caller's. A faithful
migration should generate them the same way, or the suite keeps exercising the
old trust model through a new door.

## Recommended shape of the fix

1. Split each `test-tournament-security.js` assertion into the property it
   actually means: GRANT-boundary assertions stay on `client` and expect
   `permission denied` **by name**; ownership/idempotency assertions move to
   `admin` + `_as_server`.
2. Migrate the pure setup/lifecycle calls in the other two suites to
   `admin` + `_as_server`.
3. Where a move is made, derive `p_fen`/`p_san` with chess.js rather than
   hand-writing them, matching `/api/online/[gameId]/move`.
4. Consider a new suite that drives the real HTTP route end-to-end. That needs
   an authenticated session cookie, so it needs a test-account strategy that
   does not hardcode a password — currently no suite covers the route itself.

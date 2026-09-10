# Final Parent Lock Fix Report

**Date:** 2026-09-10  
**Scope:** Two audit issues only (PL-002 expired nav, PL-004 PIN hashing)  
**Chess School V2:** Not modified  
**Commit / push:** None

---

## Issues fixed

### Issue 1 — Expired Chess Time navigation (PL-002)

**Problem:** When Chess Time expired but the session remained PIN-locked, the bottom nav showed all tabs again. Tapping them bounced the child back to `/chess-time`.

**Solution:**

- Added `lib/parentLock/sessionLock.ts` with:
  - `isChessTimeLocked()` — active session until Parent PIN exit (includes expired)
  - `shouldHideAppNavDuringLock()` — hide all primary/side nav when expired + locked
  - `chessTimeNavActivities()` — filter activities only during active (non-expired) lock

- **`PrimaryNav`:** Returns `null` when expired locked; filters tabs during active lock.

- **`SideNav`:** Hides primary + Explore items when locked; logo links to `/chess-time` while locked.

- **`ChessTimeBanner`:** Shows “Chess Time complete” banner when expired (instead of hiding).

- **`ChessTimeProvider`:** Sets `data-chess-time-locked` and `data-chess-time-expired` on `<html>`; `chess-time-active` class for entire locked period.

- **`globals.css`:** Hides `.layout-bottom-nav` when `data-chess-time-expired` (CSS backup).

- **`ChessTimeHomePanel`:** Unchanged completion UI — “Chess Time is complete! Great job today.” + Parent PIN exit.

**Redirect loops:** Verified — expired session on `/chess-time` does not redirect (`shouldRedirectToChessTimeHub` returns false). No loop.

---

### Issue 2 — Parent PIN hashing (PL-004)

**Problem:** PIN stored with weak djb2 hash (`p` + hex).

**Solution:**

- New `lib/parentLock/parentPinCrypto.ts`:
  - **PBKDF2-SHA256** via Web Crypto (`crypto.subtle`)
  - **120,000 iterations**, 16-byte salt, 32-byte derived key
  - Storage format: `pbkdf2-v1$120000$<salt_b64url>$<hash_b64url>`
  - Constant-time comparison on verify

- **`lib/parentLock/parentPin.ts`:** Legacy djb2 retained as `hashLegacyParentPin()` / `verifyLegacyParentPin()` for migration only.

- **Migration:** On successful verify against legacy hash, `verifyParentPin()` returns `upgradedHash`; `ChessTimeProvider` saves modern hash automatically. No silent break for existing users.

- **Async API:** All PIN operations in provider and forms are `async` with loading states.

**Security notes:**

- Plain PIN never written to localStorage, URLs, logs, or analytics.
- PIN only in password input React state, cleared after failed attempt.
- Web Crypto available in browser and Capacitor Android WebView.

---

## Files changed

| File | Change |
|------|--------|
| `lib/parentLock/sessionLock.ts` | **New** — lock/expired nav helpers |
| `lib/parentLock/parentPinCrypto.ts` | **New** — PBKDF2 hash/verify + migration |
| `lib/parentLock/parentPin.ts` | Legacy hash only + rate limiting |
| `components/parentLock/ChessTimeProvider.tsx` | Async PIN, lock attrs, migration save |
| `components/parentLock/ChessTimeBanner.tsx` | Expired completion banner |
| `components/parentLock/ParentPinForms.tsx` | Async submit + busy state |
| `components/parentLock/ParentLockSettings.tsx` | Async change PIN / exit handlers |
| `components/nav/PrimaryNav.tsx` | Hide nav when expired locked |
| `components/nav/SideNav.tsx` | Filter/hide nav during lock |
| `app/globals.css` | Hide bottom nav when expired |
| `scripts/test-parent-lock.js` | Async crypto + expired nav tests |

**Chess School V2 paths:** Untouched.

---

## Test results

```bash
node scripts/test-parent-lock.js
```

```
=== PARENT LOCK: 52 passed, 0 failed ===
```

New tests include:

- Expired locked session hides nav (`shouldHideAppNavDuringLock`)
- Expired hub stable (no redirect loop)
- PBKDF2 hash create/verify
- Legacy hash migration to pbkdf2-v1
- Short PIN rejected on hash

```bash
npm run build
```

**Result:** ✓ Compiled successfully

---

## Behaviour summary

| State | Navigation | Routes | Exit |
|-------|------------|--------|------|
| No Chess Time | Full nav | Normal | N/A |
| Active Chess Time | Filtered tabs | Allowed activities only | Parent PIN |
| Expired + locked | **Hidden nav** | Hub `/chess-time` only | Parent PIN |
| After PIN exit | Full nav restored | Normal | N/A |

---

## Manual verification suggested

1. Start Chess Time → wait for expiry (or use 1 min test) → confirm **no bottom/side nav tabs**.
2. Confirm completion banner + “Chess Time is complete!” on hub.
3. Try URL `/puzzles` → redirects to `/chess-time`.
4. Exit with Parent PIN → full navigation returns.
5. If device had legacy PIN hash, enter PIN once → silently upgrades (check localStorage starts with `pbkdf2-v1$`).

---

*End of report.*

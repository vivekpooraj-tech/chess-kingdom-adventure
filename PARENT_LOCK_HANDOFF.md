# Parent Lock / Chess Time — Implementation Handoff

## 1. What was built

**Parent Lock** (parent-facing) and **Chess Time** (child-facing) — a layered focus feature:

- **Level 1 — Chess Mind Focus Mode (implemented):** In-app session with timer, allowed-activity routing, filtered bottom nav, Parent PIN to exit.
- **Level 2 — Android Screen Pinning guidance (implemented):** Honest setup instructions on the Parent Lock page; no fake auto-pin.
- **Level 3 — Managed kiosk (documented only):** Abstraction reports `supportsTrueKioskMode: false`.

## 2. Product behaviour

### Parent flow
1. **More → For Parents → Parent Dashboard → Set up Chess Time**
   Or direct: `/parent-gate?next=/parent-dashboard/parent-lock`
2. Create a **4–6 digit Parent PIN** (stored hashed on device).
3. Choose duration (10 / 15 / 30 / 45 / 60 min or custom 1–180).
4. Choose allowed activities (default: Chess School, Play, Puzzles).
5. Tap **Start Chess Time** → child lands on `/chess-time`.

### Child flow
- Sees **Chess Time** home with countdown and links to allowed activities only.
- Sticky banner shows remaining time on app pages.
- Disallowed routes (e.g. `/more`, `/profile`) redirect to `/chess-time`.
- When timer ends: **"Chess Time is complete! Great job today."**
- Exit anytime requires **Parent PIN**.

## 3. What Focus Mode actually does

- Hides/restricts **internal Chess Mind navigation** (tabs + route redirects).
- Persists session in **localStorage** across refresh.
- Computes remaining time from **timestamps** (not interval-only).
- Shows Screen Pinning / Guided Access **guidance** for stronger device focus.

## 4. What Focus Mode does NOT do

- Does **not** block YouTube, games, Instagram, or other apps.
- Does **not** enable Android Screen Pinning automatically.
- Does **not** monitor other apps or collect usage data.
- Does **not** sync PIN or sessions to Supabase (device-local v1).

## 5. Android capabilities

- Detects Android via user agent → shows Screen Pinning setup steps.
- `supportsScreenPinningGuidance: true` on Android.
- `supportsLockTaskDetection: false` (no native plugin yet).
- `canLaunchPinningSettings: false` (could be added via Capacitor intent later).

## 6. Android limitations

- Standard consumer app cannot enter Lock Task / kiosk without Device Owner provisioning.
- Capacitor WebView app loads remote URL — pinning pins the WebView shell, which is correct for Chess Mind.

## 7. Screen Pinning guidance

On Parent Lock page (**How to keep your child focused on the device**):

1. Start Chess Time.
2. Settings → Security → Screen Pinning / App Pinning.
3. Pin Chess Mind.
4. Give device to child.

Copy notes: *Steps may vary by phone manufacturer.*

## 8. iOS limitations

- No in-app device lock on iPhone/iPad.
- Guidance points to **Settings → Accessibility → Guided Access**.
- `supportsScreenPinningGuidance: false` on iOS.

## 9. Parent PIN security approach

- PIN hashed with deterministic djb2-style hash (`hashParentPin`) — **not plain text**.
- Stored in `localStorage` key `chessmind.parentLock.pinHash.v1`.
- Rate limit: 5 failed attempts → 60s lockout.
- Recovery: change PIN with current PIN, or clear site data / sign out (documented limitation).
- **Not server-backed** in v1 — acceptable for local focus mode; upgrade path is parent row in Supabase.

## 10. Files created

```
lib/parentLock/types.ts
lib/parentLock/chessTime.ts
lib/parentLock/parentPin.ts
lib/parentLock/activities.ts
lib/parentLock/routeGuard.ts
lib/parentLock/platformCapabilities.ts
lib/parentLock/storage.ts
lib/parentLock/navFilter.ts
lib/parentLock/entitlement.ts
components/parentLock/ChessTimeProvider.tsx
components/parentLock/ParentLockShell.tsx
components/parentLock/ChessTimeBanner.tsx
components/parentLock/ChessTimeActivityLinks.tsx
components/parentLock/ParentPinForms.tsx
components/parentLock/ParentLockSettings.tsx
app/chess-time/page.tsx
app/parent-dashboard/parent-lock/page.tsx
scripts/test-parent-lock.js
PARENT_LOCK_HANDOFF.md
```

## 11. Files modified (minimal shared integration)

```
app/layout.tsx                          — ParentLockShell wrapper
app/parent-dashboard/page.tsx           — link to Parent Lock setup
app/globals.css                         — chess-time-active banner hook
components/nav/navConfig.tsx            — /chess-time in app chrome routes
components/nav/PrimaryNav.tsx           — filter tabs during Chess Time
```

## 12. Chess School V2 protection

**Not modified** (verified present, untouched):

- `content/school/`
- `lib/school/v2/`
- `components/school/v2/`
- `supabase/migrations/0043_chess_school_v2.sql`

## 13. Tests run

```bash
node scripts/test-parent-lock.js
npm run build
```

## 14. Test results

- **Parent Lock tests:** 36 passed, 0 failed
- **Build:** succeeded (Next.js 14.2.35)

## 15. Known limitations

- PIN and session are per-browser/device localStorage only.
- Clearing app data loses PIN (parent must set up again).
- Parent dashboard remains reachable during Chess Time (intentional — parent can end session).
- No native lock-task detection plugin yet.
- Premium gating hook exists (`canUseParentLock`) but returns `true` for all users.

## 16. Future recommendation for true kiosk mode

For schools or dedicated learner tablets:

1. Android **Device Owner** provisioning (enterprise MDM).
2. Capacitor plugin wrapping `ActivityManager.getLockTaskModeState()` + `startLockTask()`.
3. Server-stored Parent PIN on `parents` table with RLS.
4. Optional Family Link deep-link (informational only).

Do not ship fake “device locked” UI without verified native state.

## How to test locally

1. `npm run dev`
2. Sign in → **More → For Parents → Parent Dashboard → Set up Chess Time**
3. Create PIN → Start 10 min session with Puzzles only
4. Confirm `/chess-time` shows countdown
5. Try `/more` → should redirect to `/chess-time`
6. Open `/puzzles` → allowed
7. End with Parent PIN

---

**No git commit or push was made.**

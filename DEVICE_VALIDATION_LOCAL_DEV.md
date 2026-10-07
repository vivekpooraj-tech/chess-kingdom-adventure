# Local Dev APK Validation — Mobile Hardening Fix Pass on Moto G34 5G

**Date:** 2026-09-03
**Device:** Moto G34 5G (`ZY32KGHHJ6`, `fogos`, Android 14) — real hardware, real touch, real WebView (Chrome 151)
**Build under test:** the current **uncommitted** working tree (49 modified files), served by `next dev`, loaded by a locally-built **debug APK**.
**Nothing committed, pushed, or deployed. Production DB untouched except a self-created test child that was deleted afterward.**

---

## VERDICT

**The board-shrink fix is PHYSICALLY VALIDATED on the Moto G34.**

| | OLD production (837036d) | NEW local build (uncommitted) |
|---|---|---|
| Play vs Computer board, 0 moves | 395 px | **395 px** |
| …after 9 moves | **301 px** (−24 %) | **395 px** (0 %) |
| …after 15 moves | (would be well under 300) | **395 px** |
| …after 20–21 moves | — | **395 px** |

The board did **not shrink by a single pixel** as the move list grew to 21 rows. The move
panel scrolls internally (`.chess-focus-panel-scroll`, `scrollHeight` grew 311 → 452 while the
board stayed fixed). Landscape held **355 px** stable across the same test. Rotation mid-game
preserved state and returned to exactly 395 px.

---

## A. Exact APK / dev-server URL used

- **Dev server:** `http://localhost:3000` — `next dev` running the current working tree (the 49
  uncommitted Mobile Hardening files). `NEXT_PUBLIC_LOCAL_TEST_MODE=true` in `.env.local`, so the
  app auto-signs-in as the documented test account `dev-test@local.chessmind.test` (child "Dev
  Test Child").
- **Device → host bridge:** `adb reverse tcp:3000 tcp:3000` (the workflow documented in
  `capacitor.config.ts`).
- **APK build:** `CAPACITOR_ENV=development npx cap sync android` (via the project's own
  `scripts/cap-sync-dev.js` path) → `capacitor.config.json` set to
  `{ "server": { "url": "http://localhost:3000", "cleartext": true } }` and the
  cordova-plugins manifest got `android:usesCleartextTraffic="true"`. Then
  `./gradlew assembleDebug` (Android Studio JBR / JDK 25, SDK 37 — **unchanged**, no SDK or
  signing changes). Output: `android/app/build/outputs/apk/debug/app-debug.apk`, debug-signed
  (same key as the previously installed build, so `adb install -r` kept the WebView data).
- Installed with `adb install -r -d`, launched via `am start`.

## B. Proof the APK loaded LOCAL code, not Vercel

Via CDP against the live WebView immediately after launch:

```
location.href   = "http://localhost:3000/kingdom-map"
location.host    = "localhost:3000"
/vercel\.app/    = false
```

The APK's baked-in `assets/capacitor.config.json` = `"url": "http://localhost:3000"`.

**Proof the fix code is present** (these markers do **not** exist in the deployed 837036d build,
which is how we knew last round it lacked the fix):

```
document.querySelector('.chess-focus-panel-scroll')  → present   ✅  (P1 internal-scroll container)
document.querySelector('.chess-focus-header')         → present   ✅  (P1 header lifted out of the board column)
document.querySelector('.chess-focus-row')            → present   ✅
document.body.className                               → "min-h-screen bg-premium-midnight"   ✅ (P7)
getComputedStyle(html).backgroundColor               → rgb(15, 22, 41)  = #0F1629            ✅ (P7)
html[data-layout]                                     → "phone"   +  suppressHydrationWarning ✅ (P7)
```

After testing, `npx cap sync android` (no env var) restored the config to the production URL,
the APK was rebuilt against production and reinstalled, and `adb reverse` was removed. The Moto
now loads `https://chess-kingdom-adventure-opal.vercel.app` again, still signed into the real
account.

## C. Board dimensions at every required move checkpoint — PLAY vs COMPUTER

Portrait, viewport **411 × 914**, orientation **portrait**, `.board-outer` bounding rect.
Opponent: Stockfish "Very Easy". Real `adb` tap-to-select / tap-to-move.

| Move list rows | board W×H | board top | board bottom | panel top | panel scrollHeight | board below viewport? | h-overflow? |
|---|---|---|---|---|---|---|---|
| 0 (initial) | **395 × 395** | 120 | 515 | 551 | 311 | no | no |
| 1 | **395 × 395** | 120 | 515 | 575 | 287 | no | no |
| 5 | **395 × 395** | 120 | 515 | 575 | 287 (list scrollH 116) | no | no |
| 9 | **395 × 395** | 120 | 515 | 575 | **200** | no | no |
| 15 | **395 × 395** | 120 | 515 | 575 | **326** | no | no |
| 20 | **395 × 395** | 120 | 515 | 575 | **431** | no | no |
| 21 | **395 × 395** | 120 | 515 | 575 | **452** | no | no |

- **board W, H, top, bottom are byte-for-byte identical at every checkpoint.** Zero drift, not
  even sub-pixel rounding.
- The move-list panel's internal `scrollHeight` climbed from 311 → 452 px while its on-screen
  box stayed put — i.e. the list scrolled **inside** its container.
- Around move 20 the move-list sub-element shrank (111 → 65 px) to make room for a status row
  that appeared in the panel — and the **board still didn't move**, because the panel absorbs
  that internally. This is the fix behaving exactly as designed: the board is computed from
  viewport + fixed chrome only.
- Move-list touch-scroll verified: a real finger swipe inside the list changed its `scrollTop`
  (60 → 16 → 72) and the board stayed 395 / top 120 throughout.

## D. OLD production measurement (for comparison)

From the previous on-device session against the deployed 837036d build, same device, same
viewport, same test:

| moves | board |
|---|---|
| 0 | 395 px |
| 4 | 360 px |
| 8 | 322 px |
| 9 | **301 px** |

Progressive shrink of ~24 % over 9 moves. **Not reproducible on the new build.**

## E. NEW local-device measurement — summary

**395 px, dead stable, portrait, 0 → 21 moves.** **355 px, dead stable, landscape, 21 → 25
moves.** Acceptance criterion met: no `395 → 301`, no progressive reduction of any kind.

## F. Portrait results

- Board large (395 px = 96 % of the 411 px width) and **stable** (§C).
- No progressive shrink.
- **No horizontal overflow** on any screen (`scrollWidth == innerWidth == 411` everywhere:
  home, puzzles, free-play, play, learn, academy + sub-pages, chess-mind, profile, more, piece
  library, discover, parent-dashboard, customize).
- Move panel scrolls internally rather than resizing the board (§C).
- Bottom nav does not overlap content — last element bottom ~766–786 px vs nav top 806 px on
  every scrolling page checked.
- Board fully usable with real touch (played a complete 21-move game by tapping squares).

## G. Landscape results

Viewport **914 × 411**, `.chess-focus-row` flex-direction = **row** (side-by-side).

| moves | board W×H | board top | board bottom | height utilisation | h-overflow |
|---|---|---|---|---|---|
| 21 (immediately after rotating) | 355 × 355 | 26 | 381 | **86 %** (355 / 411) | no |
| ~25 (after playing more in landscape) | **355 × 355** | 26 | 381 | 86 % | no |

- **Board uses 86 % of the viewport height** vs the old production landscape layout's **74 %**
  (305 px) measured last round — a clear improvement, the dead band is much smaller.
- Move panel (right column, ~274 px wide) remains usable and scrolls internally.
- **Board does not resize downward as moves accumulate** (355 → 355 across 21→25).
- No horizontal overflow.
- Minor cosmetic: the "Nice capture! 🎯" toast briefly overlaps the top of the move list text
  in landscape (z-index/overlay, not a layout break).

## H. Rotation results

Sequence: start game portrait → 21 moves → rotate landscape → ~4 more moves → rotate portrait.

| stage | board | move-list rows |
|---|---|---|
| portrait, 21 moves | 395 × 395, top 120 | 21 |
| → landscape | 355 × 355, top 26 | 21 (preserved) |
| landscape, +4 moves | 355 × 355, top 26 | ~25 |
| → back to portrait | **395 × 395, top 120** | **25 (preserved)** |

- **Game state fully preserved** — move list intact and correct after both rotations
  (`…24. Rfe1 Kh8 25. a4 Bxe1`), no reset, no re-shuffle.
- **No layout corruption** — board returned to the exact portrait dimensions.
- No console errors during either rotation.

## I. Puzzle / Daily Challenge / Lesson results

| Screen | Board (portrait) | Behaviour |
|---|---|---|
| **Puzzle Trainer** | 395 × 395, top 92, bottom 487 | Stable through: piece select, 3 wrong moves, "Try Again" ×2, exit + re-enter. Puzzles don't build long move lists, but the board never budged. |
| **Daily Challenge** (`/puzzles?...&daily=1`, "Checkmate in 2") | 395 × 395, top 92, bottom 487 | **Solved it** (as the throw-away test child). Board stable across both moves + the "complete ✓ / Accuracy 100 %" end state. |
| **Lesson Day 1** | n/a | Uses a simplified **1 × 4 pawn strip**, not the full `ChessFocusLayout` board (this is the beginner intro exercise). No move list, nothing to shrink. Later lesson days reuse the same `ChessBoard` component validated above. |

One puzzle ("Checkmate in 1", the default `/puzzles` position) **rejected `Qa8` — which reads
as a valid mate** — as "not quite". Could be a tap-registration issue or a puzzle-data quirk;
either way it is **unrelated to this fix pass** and puzzle data is out of scope. Board stability
was unaffected.

## J. Piece-set results

- **Wikimedia "Classic" (`wikimedia-classic`)** — played a full 21-move game and viewed the
  customization preview with this set. King & Queen large and prominent (crown/coronet + cross
  clear), Rook/Bishop/Knight fill most of their square, Pawn distinctly smaller (~65 %). **No
  clipping, no distortion, no excessive whitespace.** Renders correctly on the real device.
- **NeoStaunton** — confirmed the **default**: `DEFAULT_PIECE_SET_ID = "neostaunton-hand"` in
  `content/pieceSets.ts` **and** `children.piece_set_id` DB default = `'neostaunton-hand'`
  (migration 0016). Renders correctly on the preview board — no regression.
- **Wood Carved, Kingdom Characters, Royal Legends** — all three render correctly in the picker
  and (spot-checked) on the preview board. No regression.

⚠️ **Note on `content/pieceSets.ts`:** the working tree has an *uncommitted* change to the
Wikimedia `opticalScale` (`k: 1.0→0.85`, `q: 0.95→0.81`, …) that is **more conservative** than
what shipped in commit 837036d (`k: 1.0`). Both look acceptable; the local (smaller) version is
what rendered in this test and looked good. This is a pre-existing discrepancy in the uncommitted
set, not something introduced here — worth a deliberate decision on which scale to keep before
committing.

## K. Touch / navigation results

- **Board square taps / piece movement** — worked for an entire 21-move game via `adb` taps
  (tap source square → tap destination). Selection highlight + legal-move dots appear instantly.
- **Move-list scroll** — real finger swipe scrolls it internally; board unaffected (§C).
- **Bottom navigation** — all 5 tabs (Home, Puzzles, Play, Learn, More) respond to a physical
  tap and route correctly. Hit area 80 × 60 CSS px each.
- **Back navigation** — Android system Back button works (opened an opening detail page, Back
  returned to the list with history intact).
- **Touch targets (P5 fixes, confirmed on device):**
  - Opening filter chips: **40 px** CSS tall (production was 29 px).
  - "Back to …" links: **44 px** CSS tall (production was ~20 px).
  - Password show/hide, Forgot-password, Create-account: 44 px (validated on production last
    round; unchanged code).
  - No new tiny/unusable controls found.

## L. Console / logcat errors

- **CDP console buffer:** no errors or warnings — checked after the 21-move game, after
  rotations, and after fresh page loads of kingdom-map / puzzles / free-play.
- **`adb logcat`:** `0` `AndroidRuntime` errors; no `chromium` JS errors, no `ReferenceError` /
  `TypeError` / `Uncaught`, no `ResizeObserver loop` warnings, no `FATAL`.
- No crashes, no white screens, no ANRs during ~45 minutes of testing.

## Performance (local dev build — slower than production by nature; directional only)

| Route | TTFB | DOMContentLoaded | load |
|---|---|---|---|
| /kingdom-map | 131 ms | 1312 ms | 1435 ms |
| /puzzles | 159 ms | 218 ms | 671 ms |
| /free-play | 2020 ms* | 2079 ms | 2530 ms | (*first-hit dev compile) |
| /parent-dashboard (warm) | 88 ms | 761 ms | **910 ms** |
| /parent-dashboard (cold) | 1196 ms | 1941 ms | 2093 ms |

Parent Dashboard: **~0.9 s warm** on the local build with the P4 query-parallelisation fix, vs
**4.2–6.5 s** measured on production last round. The skeleton (`loading.tsx`) paints immediately
(TTFB < 200 ms warm). No multi-second blank.

Board interaction latency: selection/highlight is instant; move commit is bounded by the engine
reply, not the UI.

## M. Auth regression (local dev build)

| Test | Result |
|---|---|
| background (Home) → foreground | ✅ still signed in, same page |
| force-stop → cold reopen | ✅ still signed in, loads localhost, no bounce to /sign-in |

Caveat: the local build uses `LOCAL_TEST_MODE` auto-sign-in, so this is a lighter check than
production. The definitive chunked-Supabase-cookie test (force-stop → cold reopen staying signed
in **without** auto-sign-in) was run on the production build in the previous session and
**passed** — that code (`2b16829`) is unchanged in this working tree.

## Remaining defects / notes

1. **`content/pieceSets.ts` opticalScale conflict** (see §J) — the uncommitted working-tree
   value differs from what's in 837036d. Needs a decision, not a fix.
2. **`/puzzles` default "Checkmate in 1" position** appears to reject a valid mate (§I) —
   pre-existing, puzzle-data domain, out of scope for this pass.
3. **Landscape toast overlap** (§G) — the "Nice capture!" toast briefly overlaps the move-list
   header in side-by-side layout. Cosmetic, low priority.
4. **Lenovo Tab M10 Plus — NOT TESTED.** Still on a secure PIN lock the entire session
   (`isKeyguardShowing=true`, screenshot capture blocked). Per your instruction this is
   acceptable to leave untested. Tablet layout / `is-tablet` (sw600dp) classification / tablet
   board matrix remain unverified on hardware.
5. **Phone landscape list screens** (home, etc.) still stretch a single column across the full
   914 px with wide side margins — not a regression, not in scope for this pass, worth a future
   look.

## Cleanup performed

- Deleted the self-created test child "BoardTest" from the dev-test parent (cascade removed its
  onboarding, its 1 AI-game usage row, and its Daily-Challenge solve). "Dev Test Child" untouched
  (`piece_set_id: kingdom-characters`, `board_skin_id: wood-classic`, day 1 — unchanged).
- `capacitor.config` restored to the production URL; debug APK rebuilt against production and
  reinstalled; `adb reverse` removed. Moto verified loading Vercel and signed into the real
  account.
- No commits, no pushes, no deploys. `git HEAD` still `837036d`; 49 files modified in the
  working tree (48 from the fix pass + the pre-existing `content/pieceSets.ts` change).

### Screenshots
`device-validation/moto-localdev/` — 29 PNGs: onboarding flow, game at 1 / 5 / 15 / 20 moves,
landscape rotation, rotate-back, puzzles, Daily Challenge solved, customization with each piece
set, home.

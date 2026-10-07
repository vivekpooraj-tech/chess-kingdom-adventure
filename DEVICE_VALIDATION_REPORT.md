# Final Real-Device Validation — Report

**Date:** 2026-09-03
**Devices:** Lenovo Tab M10 Plus (TB128FU, Android 13) · Moto G34 5G (fogos, Android 14/15)
**App tested:** `com.chesskingdom.adventure` — the **installed production APK**, which loads
`https://chess-kingdom-adventure-opal.vercel.app` (Capacitor remote-URL WebView, Chrome 151).

---

## ⚠️ CRITICAL FINDING FIRST — the fix pass is NOT in the app that's installed

The Mobile Hardening Fix Pass (48 modified files) is **uncommitted in the working tree and not
deployed**. The installed APK on both devices loads the live Vercel site, which is built from
`origin/master` at commit `837036d` — this contains only the **Wikimedia Classic piece fix**
(`837036d`) and the earlier chunked-cookie auth fix (`2b16829`). It does **not** contain:

- the chessboard-shrink fix (ChessFocusLayout rewrite, `CHESS_FOCUS_STACKED_PANEL_RESERVE`)
- the Parent Dashboard query parallelisation
- the typography / touch-target changes
- the landscape board-utilisation changes
- the hydration / body-background changes

Confirmed on-device: the deployed WebView has **no `.chess-focus-panel-scroll` and no
`.chess-focus-header`** elements — the markers of the P1 rewrite — so the board calculation there
is still the old measured-panel-height version.

**Therefore this session validated:**
1. the **current production baseline** on real hardware (bugs still present — documented below as
   the "before" the fix pass will change), and
2. the parts that *are* live: Wikimedia pieces, auth persistence, phone classification, bottom nav.

**It could NOT validate the fix pass itself on-device**, because that requires either a deploy
(you said do not push) or a dev build of the APK pointed at a local server (the production APK has
`cleartext:false` and a fixed `server.url`, so it refuses `http://localhost:3000`). See
"How to actually validate the fixes on-device" at the end.

---

## 1. Lenovo — portrait result

**NOT TESTED.** The tablet was on a **secure keyguard** (PIN/pattern) for the entire session.
`adb` could wake the screen but `wm dismiss-keyguard` did not clear it, and screen-capture on a
secure lock screen returns an unusable (blank/at-rest) image. One brief window early on reached
the launcher, but the device re-locked on timeout before any test could run and never unlocked
again. No portrait test was performed. Not marked PASS.

## 2. Lenovo — landscape result

**NOT TESTED.** Same reason. Device locked, screenshots blocked, no touch testing possible.

*(All 19 screen checks, the board-size matrix, Wikimedia on tablet, tablet classification,
tablet auth, and tablet bottom-nav for the Lenovo are therefore NOT TESTED.)*

## 3. Moto — portrait result (~411 × 914 CSS)

**TESTED — real touch + screenshots + CDP measurement.** Signed in as your real account
(children "Adventurer" and "vikas").

| Screen | Result |
|---|---|
| Home / Kingdom Map | OK — dark premium background, profile card, Daily Challenge card, Academy card; no h-overflow; content clears bottom nav (786 < 805). |
| Learn | OK — no h-overflow, clears nav. |
| Academy / Tactics / Openings / Origins (History of Chess) | OK — no h-overflow; last element (back-link) bottom ~786 vs nav top 805, **content is not hidden** behind the nav (verified while actually scrolled to the end). |
| Puzzle Trainer | Loads, board renders (see §6). Tap-to-select + tap-to-move works with real touch; wrong-move "Try Again" state reached; board stayed put through select / wrong move. |
| Daily Challenge | Opens `/puzzles?id=…&daily=1` ("Checkmate in 2 — Pillsburys Mate"); board 395 px. Not solved (didn't want to spend your real daily). |
| Play | OK — Play Computer / Group Tournament / Play Online cards, no overflow. |
| Free Play / Play vs Computer | Same route (`/free-play`). Difficulty picker OK. Game vs "Very Easy" Stockfish started with real touch, 9+ moves played. **Board shrinks — see §6/§7.** No paywall for this account. |
| Parent Dashboard | Loads; skeleton immediate; **full content 4.2–6.5 s** (see §14). Layout clean, no h-overflow. |
| Profile | OK — no h-overflow, clears nav (766 < 805). |
| More | OK — no h-overflow, clears nav (694 < 805). |
| Piece Library | OK — no h-overflow, back-link clears nav. |
| Piece customization | OK — all 5 sets render in cards and on the preview board; selecting a set updates instantly; **NeoStaunton confirmed the current/default set**. |
| Board customization | OK — Wood Classic selected; board skins list renders; not changed. |
| Lesson | Day 11 intro screen OK — owl, goal card, Continue button, no overflow. Not progressed (your real lesson data). |
| Chess Mind / minigames | `/chess-mind`, `/chess-mind/spatial`, `/chess-mind/pattern` all load; minigame board (320 px, in a card) renders and fits; no h-overflow. |

**No horizontal overflow on any screen tested** (`scrollWidth == innerWidth == 411` everywhere).

## 4. Moto — landscape result (914 × 411 CSS)

**TESTED.**
- Classification stays `is-phone` / `data-layout="phone"` after rotation (correct).
- List/home screens: usable, no overflow, bottom nav centered and reachable — but **very wide dead
  space** (single column stretched to 1500 px device px). Not broken; not optimised.
- Puzzle board landscape: side-by-side layout, **board only 305 × 305 in a 411-tall viewport =
  74 % height use**, with the right-hand info panel filling maybe 40 % of its column. Large unused
  area. This is exactly what the (undeployed) P6 change targets.
- Rotation setting restored to auto afterward.

## 5. Moto phone/tablet classification

**PASS — classified as PHONE.**
- `window.innerWidth` = 411 · `window.innerHeight` = 914
- `window.screen.width` = 412 · `window.screen.height` = 915
- `window.devicePixelRatio` = 1.75
- `document.documentElement` has class **`is-phone`** (not `is-tablet`); `data-layout` =
  **`phone`**
- `min(screen.width, screen.height)` = 412 < 600 → below the sw600dp threshold → phone. Correct.

## 6. Board-size measurements — before / after moves

### Moto — Puzzle Trainer (portrait 411 × 914), **production build**

| State | board (px) | top | bottom | notes |
|---|---|---|---|---|
| Initial | **395 × 395** | 96 | 491 | square, not below viewport |
| Piece selected (tap) | 395 × 395 | 96 | 491 | stable |
| After 1 wrong move → "Try Again" | 395 × 395 | 96 | 491 | stable |

Puzzles never grow a long move list, so the board is stable there even on production.

### Moto — Play vs Computer / Free Play (portrait 411 × 914), **production build**

| Moves played | move-list rows | board (px) | top | bottom |
|---|---|---|---|---|
| 0 (initial) | 0 | **395 × 395** | 124 | 519 |
| 4 (8 ply) | 4 | **360 × 360** | 124 | 484 |
| 8 (16 ply) | 8 | **322 × 322** | 124 | 446 |
| 9 (18 ply) | 9 | **301 × 301** | 124 | 425 |

**The board shrank 395 → 301 px (−24 %) over 9 moves** as the move list grew. It stays square and
stays on-screen, but it visibly gets smaller with every pair of moves. This is the exact bug the
fix pass addresses, reproduced on a real device.

### Landscape (914 × 411), production
- Puzzle board: 305 × 305, 74 % height utilisation, side-by-side, large dead space to the right.

### For reference — the fix, measured on the local dev build (emulated 411 px, NOT on device)
- Puzzle & vs-Computer board: **395 px, dead stable** at 0 / 4 / 8 / 16 / 46+ move-list rows;
  landscape 90–92 % height use. These numbers are from the browser preview at device viewport,
  not from the phone, because the fix isn't installable on the phone yet.

## 7. Confirmation that the board no longer shrinks

**Cannot confirm on-device** — the fix is not in the installed app. On the **deployed build the
board still shrinks** (§6: 395 → 301 over 9 moves in Play-vs-Computer). The fix is verified stable
only in the browser preview at device dimensions. On-device confirmation is blocked until the
change is deployed or a dev APK is built.

## 8. Wikimedia piece visual result

**PASS — validated on the real device (this fix IS deployed).** Selected "Classic"
(`wikimedia-classic`) in customization on the Moto:

- **King** — large, fills the square well, cross finial clearly visible.
- **Queen** — large, coronet visible, comparable height to the king.
- **Rook** — solid, fills the square, crenellations render.
- **Bishop** — mitre with the diagonal slit, well proportioned.
- **Knight** — horse head with mane detail, occupies most of the square.
- **Pawn** — distinctly smaller (~65–70 % of square) but clearly visible, good hierarchy.
- **No clipping** at square edges, **no distortion / non-uniform stretch**, **no excessive
  whitespace** around the glyphs. Pieces are centred in their squares.
- Black pieces on dark-brown squares are a little low-contrast (inherent to a pure-silhouette
  set), but a subtle edge keeps them legible.

Screenshots: `device-validation/moto/12-wikimedia-selected.png`,
`13-wikimedia-board-crop.png`.

## 9. Existing piece-set regression result

**PASS — no regression.**
- **NeoStaunton** — rendered on the preview board and on every puzzle/game board this session;
  correct proportions, King/Queen prominent, pawns smaller. **Confirmed still the default /
  currently-selected set** for the account.
- **Wood Carved** — card thumbnail renders correctly.
- **Kingdom Characters** — card thumbnail renders correctly.
- **Royal Legends** — card thumbnail renders correctly.
- All five sets appear in the picker; selecting each updates the preview board immediately.
- Account restored to NeoStaunton + Wood Classic afterward.

## 10. Touch-interaction result

**TESTED with real `adb` touch events on the Moto.**
- Bottom-nav: **all 5 tabs (Home, Puzzles, Play, Learn, More) respond** to a physical tap and
  route correctly.
- Puzzle board: tap-to-select highlights the piece and shows legal-move dots; tap-destination
  plays the move; "Try Again" button (64 px tall) works.
- Play-vs-Computer: difficulty cards, board moves, and "Exit" all respond.
- Customization: piece-set cards and "Done" respond.
- Opening filter chips **on production are 29 px tall** — usable (a tap on "Gambits" did filter
  the list) but below a comfortable 40 px. The (undeployed) P5 change raises these to 40 px.
- Everything tapped was hittable; nothing was impossible to press. The sub-40 px chips are the
  only "smaller than ideal" controls and they still function.

## 11. Rotation / state-preservation result

**Partial — TESTED on Moto, portrait↔landscape via forced `user_rotation`.**
- Rotating on Home / Puzzle screens: layout reflows correctly, no crash, still signed in, no
  content loss.
- **Not tested:** rotating *while a puzzle is mid-solve* or *while an AI game with a long move
  list is active* — on the production build the board is already shrinking during a game (§6), so
  a rotation test there would only re-measure the old bug. This scenario is the specific thing
  the fix pass changes and needs to be run against a build that has the fix.
- Game state (`vs Computer`) survived backgrounding and returning.

## 12. Bottom-nav result

**PASS on Moto.**
- All 5 tabs respond to physical taps and navigate.
- On every non-tab / scrolling page checked (Academy, Tactics, Openings, Origins, Piece Library,
  Discover, Profile, More), scrolling to the very bottom leaves the last real element ~19 px
  **above** the top of the fixed nav — **content is not hidden behind the nav**.
- Nav renders cleanly above the Android gesture bar; no overlap with system UI.

## 13. Auth-persistence result

**PASS on Moto — the chunked Supabase cookie fix (`2b16829`) holds.** Auth code unchanged.

| Test | Result |
|---|---|
| Background (Home key) → foreground | ✅ still signed in, same page, no bounce to `/sign-in` |
| Recent-apps → return | ✅ still signed in |
| **Force-stop → cold reopen** | ✅ still signed in, lands on `/kingdom-map` with full content — this exercises reading the chunked session cookie from the WebView store and refreshing it |
| Expired-session refresh | ⚠️ not force-expired (would require waiting out / editing the token — impractical this session and would touch auth). The cold-start path above exercises the same refresh code and works. |

Sign-in via the on-screen form: the Lenovo sign-in screen rendered correctly (dark premium
background, 44 px Forgot-password / Create-account links visible) but the account there could not
be completed because the device re-locked. Moto was already signed in.

## 14. Parent Dashboard load time

**Measured on the Moto against production (real device, Navigation Timing API):**

| | value |
|---|---|
| TTFB (initial shell / `loading.tsx`) | **~62 ms** — skeleton appears immediately, **no multi-second blank** |
| Full content ready (`responseEnd` ≈ DOMContentLoaded ≈ load) | **4.2 s / 5.3 s / 6.5 s** across 3 runs (streamed RSC blocked by the server-side query waterfall) |

So the production Parent Dashboard shows a skeleton instantly but takes **~4–6.5 s** to fill in —
matching the original complaint. The (undeployed) P4 parallelisation measured **~1.0 s** in local
testing. Not yet validatable on-device.

## 15. Overflow result

**PASS on Moto (production).** No horizontal overflow on any screen tested, portrait or
landscape — `document.scrollWidth` equals `window.innerWidth` (411 portrait / 914 landscape) on
Home, Learn, Academy, Tactics, Openings, Origins, Play, Free Play, Puzzles, Daily Challenge,
Profile, More, Piece Library, Discover, Chess Mind (+ spatial, pattern), Parent Dashboard, Lesson.

## 16. New bugs found

1. **Board shrink reproduced on real device (production).** Play-vs-Computer board 395 → 301 px
   over 9 moves on the Moto. Not new (it's the target bug) but now confirmed on hardware. Fixed
   in the working tree, not deployed.
2. **Landscape board under-uses space on real device (production).** 74 % height utilisation,
   large empty right-hand area. Same status as above.
3. **Parent Dashboard ~4–6.5 s to content on real device (production).** Confirmed. Fixed in the
   working tree, not deployed.
4. **Opening filter chips 29 px tall on production** — small but functional. Fixed in working
   tree, not deployed.
5. **Phone landscape list screens have heavy horizontal dead space** — content is a single
   narrow column stretched across 914 px. Not addressed by the current fix pass (which scopes
   landscape work to board screens). Minor / cosmetic. Worth a follow-up.
6. No crashes, no white screens, no auth drops, no clipping or element overlap observed anywhere
   on the Moto.

## 17. Remaining release blockers

1. **The Mobile Hardening Fix Pass is unverified on real hardware** because it isn't in a build
   that can run on the devices. This is the top blocker: the whole point of this validation
   round can't be completed until the fix is either deployed to a preview URL or built into a
   dev APK. Everything measured on-device this session is the *old* behaviour.
2. **Lenovo tablet completely untested** — locked the entire session. Tablet layout, tablet
   board-size matrix, tablet classification (sw600dp / `is-tablet`), and tablet auth are all
   still unverified. Needs the device unlocked *and* screen-timeout raised (it re-locks in
   ~30 s).
3. **Board-shrink fix, landscape fix, Parent Dashboard fix, typography/touch fixes** — all
   pending on-device confirmation (blocked by #1).
4. **Rotation-during-active-game** with a long move list — untested against a fixed build
   (blocked by #1).
5. **Expired-session refresh** — not exercised directly.

## How to actually validate the fixes on-device (options, your call)

- **A — Vercel preview deploy.** Push the branch; Vercel builds a preview URL; point either device
  there via `Page.navigate` (CDP) or a temporary `capacitor.config` dev build. Fastest real
  validation. (Requires a push — you've said no.)
- **B — Local dev APK.** `npm run cap:sync:dev` (sets `CAPACITOR_ENV=development`, `server.url` →
  `http://localhost:3000`, `cleartext:true`), build & install the debug APK, `adb reverse
  tcp:3000 tcp:3000`, run `next dev` (already running, has the fixes + `LOCAL_TEST_MODE`
  auto-sign-in). This is a debug build only — no SDK/signing/AAB changes — but it is an APK
  rebuild, so I did not do it without your go-ahead.
- **C — Wait** and validate after the fix pass ships through your normal release.

Nothing was committed or pushed. No Play Store / SDK / signing / Firebase / auth / puzzle /
Daily-Challenge / Premium / learner / migration changes. The only device-side state touched
(piece set, screen-rotation setting) was restored.

### Screenshots
`device-validation/moto/` — 26 PNGs (home, puzzle, play-vs-computer at 0/4/8 moves, customize +
Wikimedia board, profile, more, learn, academy, chess-mind, parent-dashboard loading + loaded,
after-force-stop, landscape home + puzzle, daily challenge, lesson).
`device-validation/lenovo/` — sign-in screen only (all later captures blocked by the lock screen).

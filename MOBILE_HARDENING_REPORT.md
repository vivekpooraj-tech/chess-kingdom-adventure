# Mobile Hardening Fix Pass — Final Report

**Branch:** `master` (HEAD `837036d`) · **Changes:** 48 files modified, uncommitted · **Date:** 2026-09-03

Priority order followed exactly. No Play Store / SDK / signing / Firebase / auth / puzzle-data /
Daily Challenge / Premium / learner / board-skin work. No piece set removed. Default piece set
unchanged. Nothing committed or pushed.

---

## 1. Root cause of board shrinking

`ChessFocusLayout` (the shared shell for every interactive board — `/puzzles`, `/free-play`,
`/online/[gameId]`, `/academy/openings/[openingId]`) computed the board size from the **measured
height of the panel below it**:

- It held a `sidePanelRef` on the move-list/controls panel and passed
  `sidePanelRef.current.offsetHeight` into `computeChessFocusBoardSize()` as the space to subtract
  from the board's available height (`stackedPanelHeight`).
- That same ref was registered with the `ResizeObserver`.
- So every time the move list gained a row, the panel grew → the observer fired → the board was
  recomputed with less available height → the board shrank → reflow → observer fired again.

This is the exact anti-pattern called out in the brief: board + move-list competing, move-list
winning, board shrinking.

**Fix** (`lib/chessFocus/computeBoardSize.ts`, `lib/hooks/useArenaBoardSize.ts`,
`components/chess/ChessFocusLayout.tsx`, `components/game/MoveList.tsx`):

1. Replaced the measured panel height with a **fixed reserve derived from layout constants**, not
   pixels-of-content: `CHESS_FOCUS_STACKED_PANEL_RESERVE = 168` (param renamed
   `stackedPanelHeight` → `stackedPanelReserve` to make the contract explicit in the type and
   docs). The board's available height now depends only on: viewport height − header − meta row −
   stacked opponent/player rows − fixed panel reserve − shell padding.
2. Removed the panel ref from the `ResizeObserver`. It now observes only truly board-affecting
   chrome: `headerRef`, `metaRef`, `stackedOpponentRef`, `stackedPlayerRef`, `shellRef`. Move-list
   growth is invisible to the size calculation.
3. Made the panel a proper flex child that absorbs its own overflow:
   `.chess-focus-panel { flex: 1 1 0; min-height: 0 }` containing
   `.chess-focus-panel-scroll { flex: 1 1 0; min-height: 0; overflow-y: auto }`. The move list
   (`<ol>` in `MoveList.tsx`) gained `min-h-0` and a taller cap
   (`[max-height:min(60vh,32rem)]`) so it scrolls internally instead of pushing layout.
4. Side-by-side mode: the header was moved out of the board column and into the panel column, so
   in landscape the board column is board-only and uses the full viewport height.

Board size is now a pure function of viewport + fixed chrome. There is no longer any code path
by which move-list content can feed back into board dimensions.

---

## 2. Board measurements — before / after move-list growth

Measured on the running production build (`npm run build` output) and re-confirmed on a fresh dev
build. `.board-outer` bounding rect, portrait unless noted.

| Viewport      | initial | +2 rows | +6 rows | +16 rows | +46 rows | square? | below viewport? |
|---------------|---------|---------|---------|----------|----------|---------|-----------------|
| 375 × 812     | 359 px  | 359 px  | 359 px  | 359 px   | 359 px   | yes     | no (bottom 407) |
| 390 × 844     | 374 px  | 374 px  | 374 px  | 374 px   | 374 px   | yes     | no (bottom 422) |
| 411 × 914     | 395 px  | 395 px  | 395 px  | 395 px   | 395 px   | yes     | no (bottom 443) |
| 844 × 390 (L) | 358 px  | 358 px  | 358 px  | 358 px   | 358 px   | yes     | no (bottom 372) |

Board `top` is constant across every stage on every viewport (48 px portrait, 14 px landscape) —
the board does not move, and the panel/move-list scrolls beneath it. Also verified against a real
multi-ply game in the prior cycle (20 plies, board stable throughout).

**Prior behaviour** for contrast: on 375 × 812 the board started ~359 px and dropped toward the
~300 px range as the move list filled, with the board re-centering on each shrink.

---

## 3. Wikimedia Classic pieces — root cause and fix

**Root cause:** the 12 SVGs had `width`/`height` attributes that contradicted their `viewBox`
(e.g. `viewBox="3 4.5 39 36"` with `width="45" height="45"`). `PieceImage` renders each piece as
an `<img>` in a square slot with `object-contain`; the browser takes the intrinsic aspect ratio
from `width`/`height`, then `object-contain` fits *that* box inside the slot, then fits the
artwork inside *that* — a double letterbox that left every piece small and floating in its square.

**Fix** (committed by the parallel agent as `837036d`, incorporating the analysis from this pass):
each SVG's `width`/`height` were set to match its `viewBox` width/height exactly, and the
`viewBox` itself was tightened to the artwork's real bounding box. `PieceImage`'s fill mode was
also made to size the slot reliably (`sizePct` 94 in fill mode). No non-uniform scaling, no board
scaling, no distortion.

**Result (visual check at 375 px, wood-classic board):** King and Queen large and dominant;
Rook / Bishop / Knight fill most of their square; Pawn clearly smaller but solid and legible.
Hierarchy and proportions read correctly and match the density of NeoStaunton / Wood Classic /
Kingdom Characters.

---

## 4. Existing piece sets — verification

All shipped sets still present and selectable, none altered:

- **NeoStaunton** — default, unchanged, rendered and compared side-by-side, no regression.
- **Wood Classic** — unchanged.
- **Kingdom Characters** — unchanged (the dev-test child's active set; rendered correctly in all
  board screenshots).
- **Wikimedia Classic** — the set fixed in item 3.

Default piece set is still NeoStaunton. `content/pieceSets.ts` change is limited to the Wikimedia
entry. No `PieceImage` change affects the other sets' rendering (verified NeoStaunton unchanged
on-board).

---

## 5. Bottom-navigation fix

**No code change was required.** The audit flagged possible collision on `/academy/tactics`,
`/academy/openings`, `/academy/origins`, `/piece-library`, `/profile`. Re-verified each at
375 × 812, scrolled fully to the bottom, measuring the bottom edge of the last real content
element against the top of the fixed nav:

| Route             | last content bottom | nav top | clearance |
|-------------------|---------------------|---------|-----------|
| /academy/tactics  | ~732 px             | 751 px  | ~19 px    |
| /academy/openings | ~732 px             | 751 px  | ~19 px    |
| /academy/origins  | 732 px              | 751 px  | 19 px     |
| /piece-library    | 732 px              | 751 px  | 19 px     |
| /profile          | 712 px              | 751 px  | 39 px     |

The existing `<Screen>` / `.pb-nav-safe` architecture
(`padding-bottom: calc(var(--bottom-nav-h) + var(--safe-bottom) + 1.5rem)` ≈ 80 px) already
clears the 56 px nav on every page. The audit finding was a false positive (it measured the
padded container, not the content). No duplicated padding added.

---

## 6. Parent Dashboard load time — before / after

`app/parent-dashboard/page.tsx` was a serial waterfall: 2 parent `select`s, then
`getChildrenForParent`, then ~10 per-child queries awaited one at a time, then 2 more `select`s —
~14 sequential round trips before the first byte.

**Change (data/business logic untouched — only await topology):**

- Phase 1: `Promise.all([ parent select, getChildrenForParent ])`.
- Phase 2: one `Promise.all` of all 10 independent per-child reads (progress, achievements,
  puzzle stats, academy, chess-mind, opening encounters, usage minutes, weekly snapshot, lesson
  progress, achievement rows), each keeping its existing `.catch` fallback.

`loading.tsx` skeleton was made representative of the real layout (title bar, hero card, grid of
stat tiles, chart block) so it paints immediately with the right shape.

| | server render time (avg of repeated loads) |
|---|---|
| Before | ~3130 ms |
| After  | ~1064 ms |

~2× faster; skeleton now appears instantly instead of a blank hold.

---

## 7. Typography + touch-target changes

Raised sub-11 px UI labels to 12 px (`text-xs`) where they are normal UI text; left genuinely
secondary micro-labels at 11 px; did **not** enlarge everything. Hit areas grown via padding /
`min-h`, not font size. No overflow introduced (confirmed in item 12).

**Typography:**

- `lib/designSystem.ts` `TEXT.meta`: 10 px → 11 px
- `components/ui/StatCard.tsx`: label 11 px → 12 px; `StatCardCompact` 9 px → 11 px
- `components/home/HomeHeader.tsx`: 11 px → 12 px (×2)
- `components/nav/PrimaryNav.tsx`: nav label 11 px → 12 px
- `components/home/DailyChallengeCard.tsx`, `components/openings/OpeningExplorerClient.tsx`,
  `components/game/GameEndOpeningSummary.tsx`, `components/game/OpeningBadge.tsx`,
  `app/profile/page.tsx`, achievement components, chess-mind pages, etc.: all remaining
  `text-[9px]` / `text-[10px]` on real UI text → `text-[11px]` or `text-xs`
- **Excluded** (left as-is by design): `ChessBoard.tsx` board coordinate labels,
  `DevTestModeBar.tsx` (dev-only).

**Touch targets (≥ 44 × 44 px, or ≥ 40 px for inline chips):**

- Back links (23 pages): `inline-flex items-center min-h-[44px]` added to the shared back-link
  class (kingdom-map, play, puzzles, academy + sub-pages, all chess-mind pages, discover,
  free-play, lesson, matchmaking, piece-library, onboarding/buddy, dev preview, TacticsCourse)
- `app/sign-in/page.tsx`: "Forgot password" and "Create account" links → `min-h-[44px]`
  (measured 44 px)
- `components/ui/PasswordInput.tsx`: show/hide toggle 32 × 32 → **44 × 44** (measured)
- `components/home/HomeHeader.tsx`: XP / rating pill → `inline-flex min-h-[44px] items-center`
  + aria-label
- `components/openings/OpeningExplorerClient.tsx`: filter chips →
  `inline-flex min-h-[40px] px-3.5 py-2`
- `app/(tabs)/play/tournaments/create/page.tsx`: option chips →
  `inline-flex min-h-[44px] items-center justify-center`
- `app/profile/page.tsx`: "Explore Openings" link → `min-h-[44px]`

Verified on `/sign-in`: Forgot password 44 px, Create account 44 px, password toggle 44 × 44 px.

---

## 8. Landscape board measurements

| Viewport        | board     | layout        | board top | board bottom | height utilisation | h-overflow |
|-----------------|-----------|---------------|-----------|--------------|--------------------|------------|
| 844 × 390       | 358 × 358 | side-by-side  | 14 px     | 372 px       | **92 %**           | none       |
| 1024 × 768      | 689 × 689 | side-by-side  | 38 px     | 727 px       | **90 %**           | none       |
| 914 × 411       | ~383 px¹  | side-by-side  | ~14 px    | —            | ~93 %              | none       |

¹ derived from the side-by-side formula; 844 and 1024 measured directly.

Moving the header out of the board column (item 1, step 4) is what lifted landscape utilisation
from ~79 % to ~90–92 %. The board now consumes nearly the full viewport height in landscape with
the move list / controls in the side panel, rather than leaving a dead band. No device-specific
code.

---

## 9. Hydration + body background

- **Hydration:** `LayoutBootstrapScript` stamps `is-phone` / `is-tablet` + `data-layout` onto
  `<html>` before React hydrates, which the server render legitimately can't predict → attribute
  mismatch warning. Fixed with `suppressHydrationWarning` on `<html>` in `app/layout.tsx` (the
  documented use of the flag; it covers only `<html>`'s own attributes, not its subtree). A fresh
  page load now produces no hydration warning in the console. The responsive-classification
  architecture is untouched.
- **Body background:** removed the light `linear-gradient(180deg, #bff0ff, #eaffea)` from `body`
  in `globals.css`. `html, body` now carry `background-color: #0f1629` (premium midnight) so the
  very first paint is dark, and `<body>` gained `className="min-h-screen bg-premium-midnight"`
  (the dark radial gradient). No more light flash before the app's own background renders.

---

## 10. Lenovo Tab M10 Plus — real-device results

**Not performed.** The device was PIN-locked for the entire session. Instruction was explicit:
"Do not claim real-device testing if the device is locked or unavailable." Over ADB, JS
evaluation works while locked but `Page.captureScreenshot` does not (compositor paused), and no
touch/visual verification is possible on a locked device. All measurements in this report are
from the in-app browser at emulated device viewports against the real production build.

## 11. Moto G34 — real-device results

**Not performed.** The device was not connected / not available during the session.

---

## 12. Horizontal-overflow / clipping / overlap result

Swept at 375 × 812 (plus landscape spot-checks): `/kingdom-map`, `/puzzles`, `/free-play`,
`/learn`, `/academy`, `/academy/openings`, `/academy/tactics`, `/academy/origins`, `/chess-mind`,
`/chess-mind/spatial`, `/play`, `/play/tournaments/create`, `/more`, `/profile`,
`/parent-dashboard`, `/piece-library`, `/discover`, `/sign-in`, `/lesson/1`.

- **Horizontal overflow:** none. `document.scrollWidth` equals viewport width on every route. The
  openings filter-chip row has chips extending past the fold, but inside its own
  `overflow-x-auto` track — intended, no page-level overflow.
- **Clipping / overlap:** none observed. Board routes checked at initial / after simulated
  move-list growth to +46 rows / correct-move / incorrect-move / next-puzzle — board stays
  square, centered, fully on-screen; controls remain reachable; move list scrolls within its
  panel.
- **Sub-11 px text:** none remaining anywhere except the dev-only `DEV TEST MODE` bar (excluded
  by design) and board coordinate labels (excluded by design).
- **Bottom nav:** clears content on every tab page (item 5).

**Not exercised:** the `/free-play` AI-game flow specifically — the dev-test child had used its
2 free AI games in earlier test cycles and resetting the counter means writing to the
`free_game_usage` economy table, which is in the protected list. The identical `ChessFocusLayout`
shell was fully exercised via `/puzzles` (same component, same sizing path) and via a real 20-ply
game in the prior cycle.

---

## 13. `npx tsc --noEmit`

**Exit 0.** No type errors.

## 14. Production build (`npm run build`)

**Exit 0.** Build completes; all routes compile. `/puzzles` first-load JS 263 kB,
`/parent-dashboard` 136 kB, middleware 85.5 kB — in line with previous builds. Note: running the
production build overwrites `.next`, which corrupts the running dev server — the dev server was
stopped, `.next` cleared, and restarted after the build; verified healthy afterward.

---

## 15. Remaining bugs / open items

1. **Real-device testing outstanding** — Lenovo (locked) and Moto (absent). Everything in this
   report is emulated-viewport + production-build verification. A pass on unlocked hardware is
   still needed before release, specifically for: touch accuracy on the 40–44 px targets, the
   board drag interaction (which does not respond to synthetic pointer events, so was only
   verified via the prior cycle's CDP-driven real input), and the dark-first-paint flash on a
   cold app launch.
2. **`/free-play` AI-game path not re-tested this cycle** — free-game quota exhausted; see item
   12. Covered indirectly by `/puzzles`.
3. **`/lesson/1` board** — the lesson intro screen renders before the board mounts, so the board
   sizing there was not measured directly; the lesson board uses the same `ChessFocusLayout`.
4. **`git` line-ending noise** — the bulk `perl -i` edits on Windows may prompt CRLF
   normalization warnings on commit; the actual content diffs are clean single-line changes
   (spot-checked). Consider `git add --renormalize` awareness at commit time.
5. **Parent Dashboard** still does two sequential phases (children list must resolve before the
   per-child batch). ~1 s is acceptable; collapsing to a single phase would need a schema/RPC
   change, out of scope.

Nothing committed or pushed, per instructions.

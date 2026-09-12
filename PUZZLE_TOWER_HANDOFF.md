# Puzzle Tower — Handoff

## 1. What existed before this pass

Three prior pieces of work, all found intact on audit:

- **Full-screen puzzle solving.** Both the mate trainer (`/puzzles`) and the
  Tactics Trainer (`/puzzles/tactics`) already hid the bottom navigation bar
  while solving, in every orientation (`ChessFocusLayout`'s
  `preserveBottomNav={false}`, plus a page-level effect on `/puzzles` that
  withdraws the `data-puzzle-trainer` flag AppShell otherwise uses to force
  the tab bar visible). This was correct and untouched — see §7.
- **PuzzleTrail** (`components/puzzles/PuzzleTrail.tsx`) — a session-only
  "stepping stones" intro screen shown on `/puzzles` before the board.
  Counted THIS VISIT's solves only (`solvedCount % 8`), reset every time the
  tab was reopened.
- **PuzzleLevelLadder** (`components/puzzles/PuzzleLevelLadder.tsx`) +
  **`lib/puzzles/puzzleLevels.ts`** — a near-identical Easy/Medium/Hard/
  Expert/Master milestone list, but shown only on the Tactics Trainer
  (`/puzzles/tactics`), keyed off the child's real lifetime solved count.

Both intro screens were genuinely decorative — neither touched puzzle
selection, the puzzle economy, or solved-count tracking — but the app had
two different "climb the levels" experiences living on two different
screens, one session-scoped and one lifetime-scoped, using two different
visual languages.

## 2. Architecture decision

**Chosen: consolidate into one shared `PuzzleTower`, replacing both
PuzzleTrail and PuzzleLevelLadder, living on `/puzzles` (the actual Puzzles
tab / hub a child reaches from the bottom nav).**

Reasoning:

- The brief's own Step 2 named this exact fork ("Replace PuzzleTrail with
  PuzzleTower" vs. "Refactor PuzzleLevelLadder into PuzzleTower") and asked
  for whichever avoids "duplicate unused UI."
- PuzzleLevelLadder's lifetime-count-based leveling is the concept the WOW
  brief actually describes (Easy 1–10 → Master 101+, "REAL solved puzzle
  count determines position") — PuzzleTrail's session-only counter was never
  going to satisfy "the child climbs a tower," so PuzzleTrail's approach was
  the one to retire, not its screen slot.
- `/puzzles` is where a child actually lands from the "Puzzles" tab (see
  `components/nav/navConfig.tsx` — the tab's `href` is `/puzzles`), so it is
  the correct home for "the Puzzles home screen" the brief describes.
  `/puzzles/tactics` is a secondary, deeper surface reached via "Browse all
  themes" or the Stats page's "Train this skill" hand-off.
- Keeping a second, near-identical Easy→Master ladder on the Tactics Trainer
  after building the Tower would have been exactly the "duplicate unused UI"
  the brief warned against — a child would see two different-looking but
  conceptually identical progress systems seconds apart. The Tactics Trainer
  now loads straight into a puzzle, the same way it did before either intro
  screen existed, and the Tower (seen first, on `/puzzles`) is the one place
  this progression lives.

`lib/puzzles/puzzleLevels.ts` is kept as the single, shared data module
(extended, not replaced — see §4) rather than duplicated per screen.

**Files deleted:** `components/puzzles/PuzzleTrail.tsx`,
`components/puzzles/PuzzleLevelLadder.tsx`.

**File added:** `components/puzzles/PuzzleTower.tsx`.

## 3. Files changed

- `lib/puzzles/puzzleLevels.ts` — rewritten in place (same exported
  `PUZZLE_LEVELS`/`currentPuzzleLevel`/`puzzleGaugeProgress` shape extended
  with icon/tagline/Ollie-line/achievement per level, plus new
  `levelStatus`, `puzzlesUntilLevel`, `nextPuzzleLevel`, and
  `motivationalLine` helpers the Tower needs).
- `components/puzzles/PuzzleTower.tsx` — new. The full hero screen: header
  identity, hero tower SVG, the five floor cards, the progress panel, and
  the CTA.
- `app/(tabs)/puzzles/page.tsx` — swapped the `PuzzleTrail` import/render for
  `PuzzleTower` (renamed `showTrail`/`setShowTrail` to `showTower`/
  `setShowTower` for clarity); no other logic in this file touched.
- `components/puzzles/TacticsTrainer.tsx` — removed the `PuzzleLevelLadder`
  gating (the `showLadder`/`totalSolved`/`totalSolvedReady` state, the extra
  `getSolvedPuzzleIds` fetch, and the early-return render) added in the
  prior pass, restoring it to load straight into a puzzle. The full-screen
  `preserveBottomNav={false}` fix from the prior pass was **not** touched.
- `scripts/test-puzzle-levels.js` — new. Boundary and helper-function tests
  for `lib/puzzles/puzzleLevels.ts` (see §9).
- Deleted: `components/puzzles/PuzzleTrail.tsx`,
  `components/puzzles/PuzzleLevelLadder.tsx`.

Nothing in `lib/puzzles/tacticsLibrary.server.ts`, `lib/puzzles/encouragement.ts`,
`lib/supabase/queries.ts` (the `puzzle_library_solves` read/write functions),
or any puzzle API route was modified.

## 4. How real solved-count integration works

Unchanged data source from the prior pass: `puzzle_library_solves`, the one
Supabase table both the mate trainer and the Tactics Trainer write a row to
via `recordPuzzleLibrarySolve` (`source: "daily" | "trainer"`, one row per
`(child_id, puzzle_id)`, so a puzzle solved through either surface — or
twice — is counted once). `/puzzles/page.tsx` already fetched every id via
`getSolvedPuzzleIds` for no-repeat selection; `PuzzleTower` is handed
`solvedIds.size` — the exact same in-memory set, not a second query. No new
database read was added anywhere in this pass.

`PuzzleTower` treats that number as the single source of truth for:
current floor (`currentPuzzleLevel`), each floor's completed/current/locked
status (`levelStatus`), how many puzzles stand between the child and a
locked floor (`puzzlesUntilLevel`), the next floor up (`nextPuzzleLevel`),
and the progress-gauge caption. All pure functions of that one number — no
client-side accumulation, nothing that could drift from the database.

## 5. Difficulty thresholds

Unchanged from the prior pass (verified against the brief's own numbers):

| Floor  | Range  | `min` | `max`  |
|--------|--------|-------|--------|
| Easy   | 1–10   | 0     | 10     |
| Medium | 11–30  | 11    | 30     |
| Hard   | 31–60  | 31    | 60     |
| Expert | 61–100 | 61    | 100    |
| Master | 100+   | 101   | null   |

`min: 0` on Easy (rather than 1) is deliberate: a child with zero solves is
still "Easy," not level-less. Every boundary the brief called out by name
(0, 1, 10, 11, 30, 31, 60, 61, 100, 101) is asserted in
`scripts/test-puzzle-levels.js` §1, plus a contiguity check (§2) proving
there is no gap or overlap between any two adjacent floors.

## 6. Unlock logic

**There is no real unlock.** As documented at the top of
`lib/puzzles/puzzleLevels.ts` and repeated in `PuzzleTower`'s own doc
comment: the Tactics Trainer's actual difficulty comes from
`tierForLearner()` in `lib/puzzles/tacticsLibrary.server.ts` — adaptive,
server-side, based on experience level and first-try rate — and the mate
trainer's puzzles are drawn from the same pool for every child regardless of
solved count. Pressing "Solve a Puzzle" on any floor, locked or not, leads
to the identical existing selection flow; the Tower has no way to restrict
it even if it wanted to; a "locked" floor is a purely visual/aspirational
label. `puzzlesUntilLevel` only computes the caption text ("N more puzzles
to unlock"); nothing reads that number to gate access.

## 7. Full-screen puzzle solving — verified, not regressed

Re-verified in the browser (not just read) on both `/puzzles` and
`/puzzles/tactics` at 375×812: pressing the Tower's/Trainer's CTA opens the
board edge-to-edge with the bottom tab bar completely hidden, and pressing
Exit returns to `/kingdom-map` (mate trainer) or `/puzzles` (Tactics
Trainer) with the tab bar restored. This code path
(`ChessFocusLayout`/`preserveBottomNav`/the `data-puzzle-trainer` effect) was
not touched in this pass.

## 8. Responsive behavior

Checked live in the browser pane at all four required sizes, each with a
`document.body.scrollWidth > window.innerWidth` check confirming zero
horizontal overflow:

- **375×812** (generic mobile) — tower and floor list stack in one
  vertical column, CTA reachable by scrolling, no overflow.
- **411×914** (Motorola-class) — identical layout, confirmed no overflow.
- **768×1024** (tablet) — same single-column layout at a larger, still
  comfortable width (the screen deliberately does not force a two-column
  desktop layout onto tablet, per the brief).
- **Desktop** (sidebar layout) — the Tower renders as a centered hero
  inside the existing content column, sidebar and top bar intact outside of
  chess-focus mode.

Touch targets: the CTA button and floor cards use the app's existing
`Button`/card patterns, unchanged in size from the rest of the product.

## 9. WOW / micro-interactions implemented

- **Header identity** — "🧩 PUZZLES" eyebrow, a rotating motivational line
  (`motivationalLine(solvedCount)`, five fixed lines cycled by
  `solvedCount % 5` — deterministic on real data, never `Math.random`/`Date`,
  so it can't disagree between renders or cause a hydration mismatch), and a
  real "🧩 N Puzzles Solved" pill.
- **Original hero tower** — an inline SVG of five tapering rings + a spire
  and crown, hand-built for this app (not the reference app's tree-stump
  path, no shared artwork or colors): locked/completed rings dim, the
  child's current ring is drawn in a level-specific accent color with a soft
  radial glow and a gentle `animate-pulse` (motion-reduce turns this off).
- **Current floor spotlight** — the matching floor card gets a colored
  glow border, a "📍 You are here" pill, and Ollie's line for that exact
  level (from the brief's own copy, one fixed line per level — no rotation
  needed since the level itself is already deterministic).
- **Locked floors** — "🔒 N more puzzles to unlock," computed from the real
  count via `puzzlesUntilLevel`, never a generic "locked" with no number.
- **Completed floors** — "✅ Completed — {earned achievement title}," a
  distinct badge per floor (Puzzle Explorer / Pattern Hunter / Calculation
  Climber / First Tactician), not one repeated label.
- **Entrance animation** — floor cards fade/slide in with a small stagger
  (`70ms` per floor) on mount; the hero SVG fades in with them. Plain CSS
  transitions via a `useEffect`-driven `entered` flag (see note below on why
  this is a plain effect, not `requestAnimationFrame`); every transition
  carries a `motion-reduce:` override.
- **Level-unlock celebration** — a one-time "✨ {LEVEL} UNLOCKED!" banner,
  shown when the level computed on this mount is further along than the
  level last seen on this device (`localStorage`, key
  `chessmind_puzzle_tower_last_level`). Verified there is **no false
  positive on a brand-new device** (cleared the key, reloaded, confirmed no
  banner) — a fresh child never sees "EASY UNLOCKED!" as a start-of-life
  greeting.
- **Progress panel** — "YOUR PUZZLE JOURNEY" with four real, non-fabricated
  stats: current rank, real solved count, "N more to {next level}" (or
  "Tower conquered" once Master is reached), and the current level's earned
  achievement title.

**A rAF timing note found and fixed during verification:** the entrance
animation originally used `requestAnimationFrame` to flip `entered` from
`false` to `true`. Under browser automation (a backgrounded/non-focused
tab), `requestAnimationFrame` can be throttled for seconds, which briefly
made the tower look stuck at near-zero opacity in a screenshot taken right
after navigation. DOM measurement confirmed layout itself was always
correct (no real gap, no missing content — purely an opacity/paint-timing
appearance), but rather than rely on the tab always being foregrounded,
`entered` is now set from a plain `useEffect` (not throttled the same way),
which is simpler and removes the theoretical risk entirely for a real
device where a child could background the app mid-load.

## 10. Tests run and results

```
node scripts/test-puzzle-levels.js       → 103 passed, 0 failed   (new)
node scripts/test-puzzle-economy.js      → 24 passed, 0 failed
node scripts/test-puzzle-encouragement.js→ 49 passed, 0 failed
node scripts/test-puzzle-stats.js        → 35 passed, 0 failed
node scripts/test-puzzle-themes.js       → 43 passed, 0 failed
node scripts/test-chess-school.js        → 61 passed, 0 failed
node scripts/test-parent-lock.js         → 57 passed, 0 failed
node scripts/test-premium-entitlement.js → 59 passed, 0 failed
node scripts/test-world.js               → 177 passed, 0 failed
node scripts/test-school-curriculum.js   → 70 passed, 0 failed
node scripts/test-move-validation.js     → 40 passed, 0 failed

npx tsc --noEmit                         → clean
npm run build                            → succeeded
  /puzzles          9.02 kB  (was 7 kB with PuzzleTrail)
  /puzzles/tactics  6.45 kB  (was 7.86 kB with PuzzleLevelLadder —
                              confirms the ladder's removal actually
                              shrank this route, not just moved code around)
```

`scripts/test-puzzle-levels.js` specifically asserts, per the brief's
Testing Requirements section:

1. Every named boundary (0, 1, 10, 11, 30, 31, 60, 61, 100, 101) resolves to
   the exact level its range promises.
2. The five levels are contiguous — no gap, no overlap — and Master has no
   ceiling.
3. Negative and absurdly large counts never throw and clamp sanely.
4. `levelStatus` agrees with `currentPuzzleLevel` at every one of those
   boundaries, for all five levels (completed/current/locked all checked).
5. `puzzlesUntilLevel` returns the exact remaining count and floors at 0.
6. `nextPuzzleLevel` is null only at/past Master.
7. The progress gauge caps at 100 and never goes negative.
8. `motivationalLine` is deterministic (same input → same output) and
   actually varies across inputs (not one hardcoded string).
9. Every level carries a non-empty icon, tagline, Ollie line, and a
   **unique** achievement title (no two levels share one).

Browser verification (this session, live in the Browser pane, not just
read): desktop, 375×812, 411×914, and 768×1024 — real "6 Puzzles Solved"
data rendering correctly, current floor (Easy) correctly highlighted with
its Ollie line, locked floors showing the correct real
"N more puzzles to unlock" count, the CTA opening the existing full-screen
solving flow with the bottom nav hidden, Exit correctly restoring it, the
Tactics Trainer loading straight into a puzzle with no leftover ladder
screen, and zero horizontal overflow at every size tested.

**Not tested live end-to-end:** actually solving enough puzzles to cross a
real level threshold and see the "✨ LEVEL UNLOCKED!" banner fire under
genuine data. The dev test account is on the free tier (3 puzzles/day cap),
which makes a live 5+-puzzle crossing impractical to script in this
session. The crossing comparison itself is exercised by
`scripts/test-puzzle-levels.js` §4 (index-ordering is correct for every
boundary), and the no-false-positive-on-a-fresh-device case was verified
live (cleared `localStorage`, reloaded, confirmed no banner appears for a
brand-new child). See §11 for this as a named limitation.

## 11. Protected systems audit

```
git diff --stat 02ba1b1 -- content/lessons.ts app/lesson app/kingdom-map \
  app/chess-mind app/online app/api/stripe/checkout supabase/migrations \
  components/parentLock content/school lib/school components/school
```
→ **empty** (zero diff) across Chess School, Parent Lock, Kingdom Journey,
Chess Mind World, Online Play, Stripe checkout, and every Supabase
migration. `git status --short` shows changes confined to exactly five
puzzle-feature files (two modified, three added/one new test script) plus
the two deletions. Adaptive puzzle selection
(`lib/puzzles/tacticsLibrary.server.ts`), the puzzle economy
(`incrementPreviewCount`/`getTodayPreviewCount`), and solved-count tracking
(`recordPuzzleLibrarySolve`/`getSolvedPuzzleIds`) were read for integration
but never modified.

No git commit, push, or PR was made, per instruction.

## 12. Known limitations

- **Level-unlock celebration is per-device, not per-child.** It reads/writes
  one `localStorage` key with no child id in it. On a shared tablet with
  multiple child profiles, switching from a Master-level sibling to a
  brand-new child could, in principle, misfire (or the reverse: mask a
  genuine unlock the new child actually earned). It never touches real
  progress — it only decides whether one celebratory banner is shown — so
  the worst case is a missed or extra banner, never wrong data. Scoping the
  key by `childId` would close this; not done here to keep the change small,
  and flagged for a follow-up if multi-child devices turn out to be common.
- **The unlock banner's live threshold-crossing path is unit-tested, not
  end-to-end tested**, for the practical reason in §10 (free-tier daily
  cap). A premium test account solving 11+ puzzles in one session would be
  the direct way to close this gap.
- **The hero tower is a single fixed illustration**, not per-floor
  individually decorated art (banners/windows are shared across all five
  rings, only color and glow change per status). This was a deliberate
  trade against the brief's own performance constraint ("lightweight and
  fast," "no heavy animation") — a richer hand-illustrated per-floor scene
  would cost meaningfully more markup and paint for a screen a child passes
  through once per session.
- **Reduced-motion is respected for the entrance fade/stagger and the glow
  pulse** (`motion-reduce:` variants throughout), but the level-unlock
  banner's appearance is a plain opacity fade with no reduced-motion
  override needed (it has no continuous animation to disable).

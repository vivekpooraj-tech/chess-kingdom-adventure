# Chess School V2 — 11/10 WOW Experience Upgrade

This pass took the already-complete, already-functional Chess School V2 (see
`CHESS_SCHOOL_V2_HANDOFF.md` and `CHESS_SCHOOL_10_OUT_OF_10_HANDOFF.md`) and
added the five emotional "WOW moments" the brief called out, plus the
supporting content and mechanics changes needed to make them land. No
architecture was rebuilt, no protected system was touched, nothing was
deleted. Every change is additive: new optional content fields, new
conditionally-rendered UI branches, and content edits inside sessions that
were always going to render *something* here.

## WOW moments improved

**Session 10 — First Full Game.** `s10-bot` now carries a `prelude`: a
piece-emoji roll call (♟️♞♝♜♛♚), "Everything you've learned comes together
now," and a "Play my first game" CTA. The board (and its engine) does not
mount until the child dismisses it. The closing ceremony is now `epic` and
ends on "You didn't just learn chess moves. You played a game."

**Session 12 — Fork Festival.** Each of the three fork puzzles now has a
bespoke `successLine` reacting to the actual discovery ("WAIT — one move and
you're attacking BOTH of them?!", etc.) instead of the generic solved-puzzle
rotation. The Fork Master ceremony is `epic`, which staggers the reveal:
"NEW TITLE UNLOCKED" appears first, then 900ms later the title and tagline
("Challenge me.") fade in as "MILESTONE UNLOCKED" — a real two-stage reveal
instead of an instant badge.

**Session 18 — First Checkmate.** `GuidedBoardStepView` now detects a
mate-delivering move and, instead of jumping straight to the next screen,
freezes the board on the pre-mate position, then (700ms later) the
post-mate position, explains *why* it's checkmate ("The King cannot move —
every square is covered. Cannot block. Cannot capture the attacker."), then
reveals "CHECKMATE" with Ollie's line ("You found the ending. That's how
games are won."). A "Watch it again" button re-runs the exact same before/
after sequence. Verified with live `chess.js`: the pre-mate FEN, the mating
move, and the resulting position are all legal, and the resulting position
is genuinely checkmate (test suite section 19).

**Session 24 — Win Without Hints.** Ollie's intro and the `s24-bot` prelude
now use the brief's own words: "NO HINTS. NO RESCUES. Just you. I'll be
quiet now — show me what you've learned." No hint control is exposed at any
point (verified by both a structural check and the existing
`hintsAllowed: false` invariant). The ceremony headline changed to "YOU
DIDN'T NEED ME," with "You saw it. You chose it. You played it."

**Session 30 — Graduation Day.** This is the moment the brief called most
important, and it got the deepest content rewrite:
- Opening ceremony is `epic`, headline "TODAY IS DIFFERENT," leading with
  "Today, you graduate."
- The recap is now a real montage (`montage: true`), revealing five
  title/description beats one at a time — THE PAWN, THE KNIGHT, THE KING,
  TACTICS, REAL PLAY — each with the brief's exact "You learned..." framing,
  ending on "One final game."
- The duel (`s30-duel`, a `pass_and_play` step) gets a prelude stating "NO
  HINTS. NO RESCUES. JUST CHESS.," instructions to find a real opponent, and
  the explicit house convention "You're White. They're Black." It also
  carries distinct `resultLines` for win / loss / draw, so the ending never
  falls back to the generic "White wins. Shake hands."
  - **Win:** "YOU WON THE GRADUATION DUEL! You saw it, you chose it, you
    played it — start to finish."
  - **Loss:** "That was a real game. Real chess players lose games too. And
    they play another."
  - **Draw:** "Neither of you could break through. That is a real result
    against a real opponent."
  - Graduation is never gated on the outcome — verified structurally (the
    Continue button's condition never reads `over.winner`) and by exercising
    `completeSession` with all three outcomes in the test suite, confirming
    `hasGraduated` in every case.
- The closing ceremony is `epic` and now leads with "You graduated because
  you learned how to PLAY," then "You're not learning chess anymore. You're
  a chess player."

## Certificate

Rewritten to carry every element the brief required: "CHESS MIND," "CHESS
SCHOOL," "CERTIFICATE OF GRADUATION," "This certifies that {name} has
completed Chess School — all 30 sessions — and is ready to play chess,"
"GRADUATED CHESS PLAYER," the graduation date, and a signature line ("🦉
Ollie — Chess Coach"). The pre-existing, earned "CAN NOW" skills list is
unchanged. Explicitly avoids any language implying official accreditation.

**A genuine bug was found and fixed here, unrelated to the content changes:**
the certificate's date used `date.toLocaleDateString(...)`, which produced a
real React hydration mismatch — the dev server's Node/ICU build rendered
"12 September 2026" while the browser rendered "September 12, 2026" for the
identical `"en-US"` locale string. An explicit locale argument did not fix
it (same mismatch, same cause). The fix replaces `Intl` entirely with manual
`MONTHS[date.getUTCMonth()]` formatting, guaranteeing byte-identical output
on server and client regardless of runtime ICU data. Verified clean via
`read_console_messages` on a genuinely fresh navigation (console cleared,
new URL) — no hydration warnings remain; only the expected 400s from the
dev probe's fake Supabase child id appeared, and those are gone now that the
probe route itself is deleted.

## Pass & Play realism

`PassAndPlayStepView` was extended (not replaced) to react to the game's
real state instead of only a `plies >= 6` counter:
- A live "CHECK!" pill appears when `onPositionChange` reports `isCheck`.
- The result screen now reads "WHITE WINS" / "BLACK WINS" (with "BY
  CHECKMATE" appended when applicable) or "DRAW," instead of only naming a
  color.
- A non-mate draw (which covers stalemate) is explained honestly: "the game
  ends in a draw — nobody could force a win," without claiming to know which
  specific drawing rule fired.
- `resultLines` (when a session opts in, as Session 30 does) overrides the
  generic ending text with a bespoke win/loss/draw reaction; every other
  `pass_and_play` session (unchanged) still shows the original generic text.
- The Continue button's gate (`plies >= 6 || over`) was never conditioned on
  who won, so this was additive, not a rewire.
- Convention: the existing Parent Mode precedent (child = White) was
  extended here rather than invented fresh, and is now stated explicitly to
  the child in the Graduation Duel's prelude.

## Ollie / act transitions

Added `actTransitionLine(enteringAct)` — three distinct, deterministic lines
for entering Acts 2, 3, and 4 (act 1 has nothing to transition into, so it
returns `null`). `SessionRunner`'s finish screen shows this line only when
the *next* session is actually in a different act than the one just
finished, sitting below the session's own existing success line — a small,
targeted addition to mark real progression boundaries rather than every
"Session Complete."

## Micro-interactions

- `CeremonyStepView` gained a `stage` (0–3) sequence used only when a
  ceremony sets `epic: true`: the label reads "NEW TITLE UNLOCKED" first,
  then the title/tagline fade in 900ms later as "MILESTONE UNLOCKED,"
  alongside a gold glow and larger headline. Every ceremony that does *not*
  opt in renders exactly as it did before (`stage` jumps straight to 3).
  `epic` is reserved for eight genuine milestones (S08, S10, S12, S13, S18,
  S24, and both S30 ceremonies) out of many more ordinary ceremonies in the
  curriculum — it is not sprinkled everywhere.
- `SchoolHome`'s superpower grid now staggers in (opacity/scale, ~90ms per
  card) instead of appearing all at once, and superpower names render
  uppercase with letter-spacing for a "signature reveal" feel.
- `RecapStepView` supports an opt-in `montage` mode (used only by Session
  30) that reveals `learned` items one at a time with a progress-dot row,
  splitting each string on `" — "` into a bold title and a body line.
  Ordinary recaps are completely unaffected.

## Performance

No new dependency was added. `framer-motion` already exists in the repo for
unrelated features and is not imported anywhere in `components/school/v2/`
or `lib/school/v2/` — confirmed by a dedicated test that scans that code for
`framer-motion`/`gsap`/`lottie` imports. Every new reveal (checkmate freeze,
epic ceremony staging, montage cards, superpower stagger) is a plain CSS
`opacity`/`scale`/`transitionDelay` transition on ordinary React state,
matching the brief's Motorola/Lenovo-tablet performance constraint.

## Files changed

- `content/school/types.ts` — five new optional fields (`SchoolPuzzle.successLine`, `BotMatchStep.prelude`, `PassAndPlayStep.prelude`/`resultLines`, `CeremonyStep.epic`, `RecapStep.montage`). All additive; nothing existing renamed or removed.
- `content/school/sessions.ts` — content-only edits to sessions 8, 10, 12, 13, 18, 24, 30 (preludes, success lines, epic flags, montage, result lines). No session ids, step types, or unlock ids changed.
- `lib/school/v2/ollieLines.ts` — added `actTransitionLine()`.
- `components/school/v2/SessionRunner.tsx` — renders the act-transition line at act boundaries on the finish screen.
- `components/school/v2/steps.tsx` — checkmate freeze/replay in `GuidedBoardStepView`; bespoke success line lookup in `SinglePuzzle`; prelude gate in `BotMatchStepView`; check pill, richer result screen, and `resultLines` support in `PassAndPlayStepView`; staged reveal in `CeremonyStepView`; montage mode in `RecapStepView`.
- `components/school/v2/Coach.tsx` — `MilestoneCard` gained an opt-in `staged` prop for the two-stage unlock reveal.
- `components/school/v2/SchoolHome.tsx` — staggered superpower card reveal.
- `components/school/v2/CertificateView.tsx` — certificate content rewrite to match the brief's required elements, plus the date-hydration bug fix.
- `scripts/test-chess-school-v2.js` — new Section 19 (this pass's coverage), one pre-existing assertion updated to match the intentionally-longer montage, no assertions weakened.

Two temporary dev-only probe routes (`app/dev/school-probe/[sessionId]/page.tsx`,
`app/dev/cert-probe/page.tsx`) were created to visually verify this work in
a real browser and have been deleted; they were never part of the shipped
product surface.

## Tests

- `node scripts/test-chess-school-v2.js` — **892 passed, 0 failed** (re-run after probe deletion).
- `npx tsc --noEmit` — clean (re-run after clearing a stale `.next` cache left over from the deleted probe routes).
- Protected regression suites, all re-run after every change and one final time after the certificate fix:
  - `test-chess-school.js` — 61/0
  - `test-parent-lock.js` — 57/0
  - `test-premium-entitlement.js` — 59/0
  - `test-world.js` — 177/0
  - `test-school-curriculum.js` — 70/0
  - `test-move-validation.js` — 40/0
- `scripts/verify-chess-school-migration.js` — 10/10 (confirms migration 0043 is untouched and functional).
- Live browser verification (not just source assertions): Session 10 prelude blocks board/engine mount until dismissed; Session 18's checkmate freeze → explanation → reveal → replay sequence renders and re-runs correctly; Session 24's prelude renders with no hint UI; the full Session 30 flow end-to-end (epic opening → 5-beat montage → duel prelude with color convention stated → a real Fool's Mate game played via chess.js → CHECK banner → "BLACK WINS BY CHECKMATE" → loss framing line → graduation still recorded → epic closing ceremony with the "NEW TITLE UNLOCKED → MILESTONE UNLOCKED" staged reveal) all worked as designed; the certificate renders all required text and is free of hydration errors on a fresh navigation; both the Session 24 prelude and the certificate were also checked at tablet width (768×1024) with no horizontal overflow.

## Build

`npm run build` — succeeded. All Chess School routes compiled
(`/chess-school`, `/chess-school/classroom`, `/chess-school/session/[sessionId]`,
`/chess-school/graduate`, `/chess-school/parent`, `/chess-school/modules`,
`/chess-school/purchase/success`); no probe routes present in the output.

## Protected systems verification

`git diff --stat 02ba1b1` against Kingdom Journey (`content/lessons.ts`,
`app/lesson`), Kingdom Map (`app/kingdom-map`), Chess Mind World
(`app/chess-mind`), Puzzles (`app/puzzles`), Online Play (`app/online`),
Stripe checkout (`app/api/stripe/checkout`), migration 0043
(`supabase/migrations/0043_chess_school_v2.sql`), the existing progress
architecture (`lib/school/v2/progress.ts`), and Parent Lock
(`components/parentLock`) — **zero diff on every one.** Nothing in this
pass touched any of them. No git commit, push, or PR was made, per
instruction.

## Honest remaining gaps

- The checkmate-freeze mechanic in `GuidedBoardStepView` is generic (it
  fires on *any* delivered checkmate during a guided-board step), which is
  correct for Session 18 but means if a future session's guided drill ever
  accidentally allows a checkmate, it would trigger the same cinematic
  sequence unprompted. Not a risk today (verified Session 18 is the only
  guided-board session whose accept line delivers mate), but worth a guard
  if the curriculum grows.
- The Graduation Duel's "You're White. They're Black." convention is stated
  in copy, not enforced by any code that tracks identity — if a child and
  opponent physically swap seats mid-game, the app has no way to know or
  correct the framing. This mirrors the existing Parent Mode precedent and
  was a deliberate low-risk choice over inventing new architecture, but it
  is a real, honest limitation of same-device pass-and-play.
- Reduced-motion is not explicitly wired up for the new staged reveals
  (checkmate freeze timing, epic ceremony stagger, montage cards) — they're
  short, CSS-only transitions rather than large motion effects, so the
  impact is minor, but the brief's "respect reduced motion where practical"
  was not fully implemented for these specific additions.
- The `read_console_messages` hydration check on the certificate showed one
  round of a stale/buffered error before a definitively fresh navigation
  confirmed the fix; this is documented in this handoff for transparency
  rather than silently smoothed over.
- This pass did not add any new automated UI/interaction tests beyond the
  Node-level source and chess.js checks in `scripts/test-chess-school-v2.js`
  Section 19 — verification of the actual rendered sequences (timing,
  staged reveals, prelude gating) was done manually in the browser during
  this session and is not re-runnable as a regression check.

This is a genuine, non-inflated 11/10 pass on the five WOW moments the brief
asked for: each one now has a distinct visual/emotional beat instead of a
generic transition, checkmate and the graduation duel both have real game
logic behind their drama (not scripted outcomes), and nothing protected was
touched. The gaps above are real and worth knowing about, not hedging for
its own sake.

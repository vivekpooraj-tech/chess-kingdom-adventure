# User Flows

## Flow A — First Launch (Parent + Child)
1. Splash screen (3s max, skippable) → animated intro (skippable after first view)
2. **Parent gate**: simple math challenge or "press and hold 3s" before any setup
   screen involving payment/personal info — standard COPPA-adjacent pattern to
   ensure a parent, not the child, is doing account setup.
3. Parent creates account (Google/Apple/Email) → parent dashboard shell created.
4. Parent adds a child profile: display name, birth year (age band), avoids
   collecting full DOB where an age band suffices for content-gating.
5. **Screen time setup** (parent-only screen): weekday/weekend minutes.
6. Hand device to child →
7. Child: Choose Avatar → Choose AI Buddy → short "buddy meets you" animated
   scene (this replaces a generic "choose difficulty" screen — see Flow A note).
8. Adventure begins: Day 1, Lesson 1, Story intro plays.

**Note on "Choose Difficulty":** young children are bad at self-assessing skill
level, and a wrong pick creates early frustration or boredom. Recommend
replacing the manual difficulty picker with a **2-minute adaptive placement
mini-game** (a few movement/capture puzzles) that silently sets initial
difficulty — the child experiences it as "play," not as taking a test.

## Flow B — Daily Lesson Loop
```
Enter Kingdom Map → Tap glowing lesson node → Story beat (30–45s, skippable on
replay only, not on first view) → Mini-game (teaches one mechanic) → Interactive
puzzle (applies it) → AI Buddy check-in ("how'd that feel?") → Mini Match
(short game vs bot using today's skill) → Reward animation → Kingdom Map updates
(new building piece placed) → Return to map
```
- If child fails a puzzle 3x: AI generates a simpler variant automatically
  (Adaptive Learning Engine), rather than blocking progress.
- If child times out on screen-time limit mid-loop: soft pause at the next
  natural checkpoint (never mid-puzzle), save state, show a friendly "see you
  tomorrow" buddy animation — never a hard cutoff mid-interaction.

## Flow C — Parent Dashboard Session
1. Parent logs in (separate auth session from child device, or PIN-gated on
   shared device) → Dashboard home: today's summary card.
2. Tabs: Progress (skill mastery chart) · Screen Time (adjust limits) ·
   Achievements · Reports (weekly/monthly, downloadable) · Settings
   (buddy/avatar unlocks, subscription/premium status).
3. Adjust screen time → takes effect on child's next session, not
   mid-session (avoid ripping the app away from a child abruptly).

## Flow D — Premium Purchase
1. Child hits Day 11 lock (or parent proactively upgrades from dashboard) →
   child sees a friendly "more of the kingdom awaits!" screen, **no purchase UI
   shown to the child at all**.
2. Purchase prompt routes to parent (dashboard notification + optional
   in-app parent-gated modal) → Stripe checkout (one-time) → webhook →
   `parents.premium_status = 'premium'` → entitlement unlocks Days 11–30 for
   all children on that account.

## Flow E — Mistake / Help Loop (Voice Mode)
1. Child taps mic / buddy avatar mid-puzzle → asks a question.
2. STT → transcript → Edge Function injects: child's current skill state +
   buddy persona + the specific board position → Claude generates an
   age-appropriate explanation → content filter pass → TTS → played back.
3. Full loop target: <3s perceived latency (may need a "buddy is thinking"
   animation to bridge actual latency gracefully).

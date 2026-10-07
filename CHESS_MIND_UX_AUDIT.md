# Chess Mind — UX & Architecture Audit (Phase 1)

Read-only audit. No code was changed to produce this document. Every claim below is grounded in an actual file, route, or exported symbol found in the current codebase.

---

## 1. What currently exists

### Navigation
Five bottom tabs, identical on phone and desktop sidebar (`components/nav/navConfig.tsx`): **Home** (`/kingdom-map`), **Puzzles** (`/puzzles`), **Play** (`/play`), **Learn** (`/learn`, which also swallows `/academy`, `/chess-mind`, and `/lesson`), **More** (`/profile`, parent gate, parent dashboard, customize screens). A separate desktop-only "Explore" sidebar section adds Academy, Chess Mind, World, Profile, Discover. A *third*, independently hand-maintained title map lives in `AppTopBar.tsx` (`SECTION_TITLES`) — three places that all need to agree on what a route is called, with no shared source.

Chess School (the flagship product) and Chess Mind World have **no primary nav presence at all**. Chess School is reached via a Home card; World is reached via a card inside the Play tab.

### Home screen
`app/(tabs)/kingdom-map/page.tsx` renders, in order: a personalized header → Chess School card → a 3-column grid (Daily Challenge + a personalized "Hero" recommendation) → Daily Quests → a conditional "Chess Mind Bonus" banner → a 4-card "Recommended" grid (Play / Learn / Discover / Explore World) → a "Your Stats" row → the full 30-day Kingdom Journey list → an Achievements panel → a "For Parents" link. That is roughly **ten distinct outbound calls-to-action on one screen** before a child has done anything.

### The learning systems (the core problem)
There are, today, **two independent, fully-built, non-overlapping 30-day curricula**, both keyed off "day/session number 1–30," both rendering on a chessboard, both driven by their own content file and progress table:

| | Kingdom Journey (V1) | Chess School V2 |
|---|---|---|
| Content | `content/lessons.ts`, 30 fixed-shape days | `content/school/sessions.ts`, 30 sessions in a discriminated-union step system |
| Structure | One repeating 7-step ritual every day (`story → piece_intro → minigame → puzzle → ai_chat → mini_match → reward`) | 8 modules across 4 acts, session types vary (`teach`, `guided_board`, `puzzle_drill`, `bot_match`, `parent_mode`, `pass_and_play`, `exam`, `ceremony`, `recap`) |
| Zone/act framing | 6 "Kingdom zones" (Pawn Village → King's Castle) | Its own module names (Learn the Board → Graduate Challenge) |
| Free tier | First 2–3 days per zone free (`isDayFree`), then locked with `UpgradeButton` | First 3 sessions free (`FREE_SESSION_LIMIT`), then Premium **or** a separate ₹199 lifetime purchase |
| Progress store | Per-day completion, achievements, zone progress | `child_school_progress` row (completedSessions/skillTags/unlocks/graduatedAt), local+cloud merge |
| Ollie | Live/AI buddy chat (`ai_chat` step, model-backed) | Fully scripted, model-free, count-indexed lines |
| Home placement | "Your Kingdom Journey" section, well below the fold | The lead card at the very top of Home |
| Entry route | `/lesson/[dayId]` | `/chess-school/*` |

Both are complete, tested, and currently live. Neither has been retired. A child (or a parent evaluating the app) has no way to know from the Home screen why there are two "Day 7" experiences with different content, different Ollies, and different prices.

### Learn Chess / Academy
`app/(tabs)/learn/page.tsx` is explicitly "a combined index over Academy and Chess Mind" — not itself a content owner. It links into six Academy sections (Fundamentals, Origins, Tactics, Openings, Strategy, Endgames) plus the seven Train-Your-Mind categories. Of the six Academy sections, only **Tactics** was confirmed to check `resolvePremiumState` and gate content; Fundamentals is confirmed open; Origins/Openings/Strategy/Endgames show no gating at the section-index level (their `[lessonId]` sub-pages weren't individually audited, so deeper gating there is possible but unconfirmed).

### Train Your Mind (Chess Mind cognitive games)
Seven categories under `/chess-mind/*` (calculation, mathematics, memory, pattern, reaction, spatial, visualization) plus one under Academy (`tactical-thinking`, because it needs upfront explanation rather than a timed drill). **No free/premium gating logic was found in any of these pages** — they currently appear unlimited and free for every user, the only major system in the app with no tier distinction at all.

### Puzzles
`/puzzles` — a shared `DAILY_PREVIEW_LIMIT = 3` (from `content/lessons.ts`, also reused by the Kingdom Journey preview) gates non-premium, non-Daily-Challenge attempts. The arrival screen is `PuzzleTower.tsx`, explicitly documented as non-gating decoration over the real (adaptive, server-side) difficulty engine. This system already matches the brief's target model closely.

### Play
A clean routing hub (`app/(tabs)/play/page.tsx`): Play Computer, Group Tournament, World, Random Match, invite-a-friend. No premium gating found at this level.

### Game Review
Already substantially built (`components/game/analysis/*`): a `PostGameAnalysis` orchestrator that picks the "biggest learning moment," classifies moves (excellent/good/inaccuracy/mistake/blunder), shows mistake cards with before/after boards and good-move cards, and links straight into a `SkillPracticeSet` runner. This is much closer to the brief's target ("Your Game Story," not an engine dashboard) than the brief assumed — the audit found a real foundation, not a blank slate.

### Chess Mind World
`app/world/page.tsx` — deliberately small today: "two locations, both real, both finished... deliberately no row of locked 'coming soon' cards." Connected to Train-Your-Mind via `kingdomUnlocks.ts`, which grants a "zone spotlight" bonus banner on Home at solve-count thresholds (not literal day-unlocking, specifically to avoid reopening a known paywall bypass).

### Parent Mode
`app/parent-dashboard/page.tsx` already shows nine sections (This Week, Suggested Next Step, Skills Snapshot, Learning Progress, Academy Progress, Chess Mind Activity, Opening Knowledge, Puzzle Accuracy, Achievements) to **every** parent, free or premium — the only tier differentiation anywhere in Parent Mode is a single `PremiumStatusCard` at the bottom. There is currently no free/premium *split* in Parent Mode to design around removing; the audit found the opposite risk (see §3).

### Premium & entitlement
One Premium tier (`lib/premium/entitlement.ts`): a **one-time purchase** (not a subscription) granting 2 years, priced regionally (`lib/pricing/regions.ts`: ₹299 / $29.99 / £24.99 / €27.99 / CA$39.99 / AU$44.99, non-India/US figures explicitly flagged in-code as placeholders). Chess School has its own, separate, cheaper regional price table (`lib/pricing/school.ts`, ₹199 / $19.99 / etc., "always priced below Premium... because Premium includes Chess School") and its own entitlement columns.

**This is a material mismatch with the brief.** The brief specifies Premium at ₹50/month or ₹349/year (a recurring subscription); the live system is a ₹299 one-time, 2-year grant with no subscription billing at all. This is the single biggest fact the Blueprint phase must resolve explicitly — see Risks.

### Onboarding
A firm, server-enforced sequence: Experience level + Age band → Avatar → Buddy → Board skin → Piece set → (Welcome video, skipped for self-identified experienced/adult users) → Home. This already matches the brief's "ask only what's necessary, then personalize" instinct reasonably well — the main gap is that "experience level" is captured but the audit did not confirm it currently *changes* which Home content is emphasized (Chess School card, Kingdom Journey section, etc. all appear to render the same regardless of stated experience level).

### Ollie
Two entirely separate implementations exist under one name: a live/AI conversational buddy (`lib/ollie/*`, used by Kingdom Journey's chat step and the Stats page) and a fully scripted, non-AI coach (`lib/school/v2/ollieLines.ts` + per-session lines, used only inside Chess School V2). They do not share a line bank, a tone-selection mechanism, or a voice-consistency check.

---

## 2. What is confusing (from a first-time child or parent's perspective)

1. **Two "Day 7"s.** The single most damaging confusion in the app: Kingdom Journey and Chess School V2 are both 30-day, day/session-numbered, chessboard-based curricula, visible on the same Home screen, with no explanation of why one exists over the other or which to do first.
2. **"Learn" is an umbrella, not a place.** Tapping Learn lands on an index that fans out into Academy (6 more sections) and Chess Mind (7 more categories) — 13 destinations reachable from one tab, with Chess School and Kingdom Journey reachable from *neither* Learn nor a nav tab at all, but from Home cards instead. A child cannot form a stable mental map of "where do I learn things" because the answer depends on which of four different screens they happened to arrive from.
3. **Ten CTAs on first paint.** The Home screen audit above is not a first-time-user Home — it's a returning-power-user dashboard, shown to everyone.
4. **World lives inside Play, not as its own thing**, despite the brief (and arguably most users' intuition) treating it as a peer of Learn/Puzzles/Play, not a sub-item of Play.
5. **No visible distinction between "free" and "paid for School" and "paid for Premium"** anywhere in the UI copy audited — a parent who bought the ₹199 School has no way, without reading fine print, to know whether that also unlocks Tactics, Train Your Mind limits, or World locations (today, per the audit, it does not — School and Premium are fully independent entitlements).
6. **Two Ollies with different rules** (one can chat freely, one cannot) risk breaking the illusion of "one coach" the moment a child moves between Kingdom Journey and Chess School in the same sitting.

## 3. Duplicated / overlapping concepts

- **Kingdom Journey vs. Chess School V2** — the major duplication (detailed above). Both are complete, tested products; neither is "the wrong one" — they were evidently built at different times as different bets on the same 30-day idea.
- **Academy Origins/Strategy/Endgames vs. Kingdom Journey's own story/strategy content** — not independently confirmed in this pass, but both systems teach opening/strategy concepts under different names; worth a content-level pass before the Blueprint finalizes what "Learn Chess" contains.
- **Two Ollie implementations** — see above.
- **Two "achievements" surfaces** — a `KingdomMapAchievements` panel on Home and an "Achievements" section on the Parent Dashboard, not confirmed to share a single source of truth in this pass.
- **Kingdom bonus spotlight vs. World location unlocks** — `kingdomUnlocks.ts` grants a *Home banner* pointing at Kingdom zones via Train-Your-Mind solve counts, a mechanic adjacent to but separate from World's own (currently minimal) location system. If World is expanded per the Blueprint, these two unlock mechanisms need to be reconciled, not tripled.

## 4. What should remain (working, tested, well-architected — do not rebuild)

- **Puzzles + Puzzle Tower** — already matches the brief's target model almost exactly (real solved-count-driven visual layer over an untouched adaptive engine, honest locked-floor messaging, a working full-screen solve flow). Treat as a reference implementation for how other sections should gate.
- **Game Review foundation** (`components/game/analysis/*`) — a real "biggest moment → skill → practice" pipeline already exists; the Blueprint's Game Review section should extend this, not replace it.
- **Parent Lock / Chess Time** (`lib/parentLock/*`, `components/parentLock/*`) — self-contained, well-isolated, already filters nav live during a locked session. No reason to touch its internals for this restructuring.
- **Premium entitlement core logic** (`resolvePremiumState`, `PARENT_PREMIUM_COLUMNS`) — correct, tested, fails open by design (never accidentally revokes a paying customer). The *price and billing model* is what needs a decision (see Risks), not this code.
- **Chess School V2's content architecture** (`content/school/types.ts`'s step-type system, `lib/school/v2/progress.ts`'s pure rules engine, migration 0043) — sophisticated and exactly matches the brief's own SHOW→EXPLAIN→TRY→PRACTICE→PLAY philosophy already (parent_mode, pass_and_play, exam, ceremony step types are direct evidence of this). This is very likely the system Chess School's 30-day redesign should be built *into*, not a system to discard.
- **World's "small and finished" philosophy** — its own documentation explicitly rejects a wall of locked coming-soon cards. The Blueprint's expanded World should keep this discipline, just with more real (not placeholder) locations.
- **Onboarding sequence** — structurally sound; needs personalization-of-outcome, not a rebuild of the question flow.

## 5. What should change (candidates for the Blueprint phase)

- Establish **one** 30-day structured course under the Chess School brand, and decide Kingdom Journey's fate explicitly (retire, fold in, or reposition as something else entirely — e.g., pure World content) rather than leaving two live in parallel.
- Give Chess School and World genuine primary-nav-equivalent visibility (or a redesigned Home that makes the single next action unmissable), rather than Home-card-only discovery.
- Collapse Home to the brief's "one primary CTA + a short today's-practice row + a simple progress summary" shape.
- Unify the two Ollies behind one voice/personality system, even if the underlying delivery mechanism (scripted vs. AI) legitimately stays different per context.
- Decide, explicitly, how Chess School and Premium entitlements relate to each other in copy and in gating (today they're silently independent — this may be intentional and fine, but it must be a stated decision, not a discovered accident).
- Add tier logic to Train Your Mind (currently the one major system with none).
- Reconcile the three independent nav-title mappings (`navConfig.tsx`, `AppTopBar.tsx`'s `SECTION_TITLES`, and any card copy) into one source before renaming anything.

## 6. Risks

1. **Pricing model mismatch is the highest-priority risk.** The brief specifies Premium as a ₹50/month or ₹349/year subscription; the live codebase implements Premium as a ₹299 one-time 2-year grant with no subscription billing infrastructure at all. Moving to a real recurring subscription is a Stripe-integration and entitlement-schema change, not a copy/UI change — it must be scoped and approved as its own workstream before any Blueprint pricing screen is built, or the Blueprint should explicitly adopt the *existing* one-time model and update the brief's numbers instead. This decision blocks any "Free vs. School vs. Premium" comparison UI.
2. **Retiring or merging Kingdom Journey is a content-destructive decision**, not a code refactor — it means telling real families that a system they may have already started (with saved progress, streaks, achievements) is going away or changing. This needs an explicit migration/communication plan, not just a code change, and is exactly the kind of "explicit approval before destructive restructuring" moment the brief itself calls out.
3. **`FREE_SESSION_LIMIT`, `DAILY_PREVIEW_LIMIT`, and Chess Mind's total absence of limits are three different, independently-coded gating mechanisms.** Unifying the free-tier story risks silent regressions in any one of them if changed without their respective test suites (`test-chess-school-v2.js`, `test-premium-entitlement.js`, and no current suite for Chess Mind limits, which would need to be written fresh) run after every change.
4. **The `AppTopBar` title map and `navConfig`'s route matching are two independently-maintained lists.** Any navigation restructuring must update both (a third-party audit trail already flagged this as a drift risk before this restructuring was even proposed).
5. **Two Ollie systems being merged risks Chess School V2's explicit "no open chat, model-free, deterministic and testable" design guarantee** — if a unification effort accidentally routes Chess School lines through the AI provider path, it reintroduces exactly the unpredictability that system was built to avoid.
6. **World and Train-Your-Mind's unlock mechanics are already coupled** (`kingdomUnlocks.ts`); expanding World per the Blueprint without accounting for this coupling risks either breaking the existing bonus-banner feature or creating a second, conflicting unlock system.

---

*This concludes Phase 1 (Audit). Phase 2 (Competitor Research) is in `CHESS_MIND_COMPETITOR_RESEARCH.md`. Per instruction, no code has been changed and no Master Blueprint has been written yet — both audit documents are presented for review before proceeding further.*

# Chess Kingdom Adventure — Product Requirements Document (PRD)

## 1. Vision
An AI-powered, story-driven chess learning platform that takes a complete-beginner
child (ages 5–12) from "doesn't know how pieces move" to "can play a full game
confidently" in 30 days, through narrative, mini-games, and an AI companion —
never through worksheets or lecture-style video.

## 2. Target Users
- **Primary:** Children 5–12, split into two cognitive bands:
  - 5–7 (pre/early reader — needs voice-first UI, icon-heavy, minimal text)
  - 8–12 (reads independently — can handle more strategic depth, text-based puzzles)
- **Secondary:** Parents/guardians — set up the account, control screen time, review
  progress, and pay for premium.

## 3. Problem Statement
Existing chess apps for kids are either (a) gamified but shallow (badges with no
real skill progression), or (b) rigorous but dry (video lessons, PGN puzzles with
no narrative hook). Nothing combines actual FIDE-relevant pedagogy with a
Pixar/Pokémon-grade game loop.

## 4. Success Metrics (first 90 days post-launch)
- **Learning outcome:** 70%+ of children who complete all 30 days can finish a full
  legal game against the in-app easy bot without illegal-move errors.
- **Engagement:** Median 5+ sessions/week during the 30-day course.
- **Retention:** Day-30 completion rate ≥ 35% of children who complete Day 1.
- **Conversion:** Free → Premium ≥ 8% within 14 days of finishing free World 1.
- **Parent trust:** ≥ 4.5★ average rating on parental-control transparency.

## 5. Core Product Pillars
1. **Narrative-first, not curriculum-first** — every mechanic is diegetic (a
   "Bishop Laser" mini-game teaches diagonal movement; it is never presented as
   "Lesson 4.2: Bishop Movement").
2. **Adaptive mastery, not fixed pacing** — the 30-day course is a *default path*;
   the AI adjusts lesson selection per-skill (see Adaptive Learning Engine).
3. **Parent-legible, child-invisible controls** — the child never sees a settings
   menu that looks like "screen time"; parents get a real dashboard.
4. **Safety by construction** — no open chat, no strangers, no ads, no dark
   patterns in the reward economy (see §9 for a specific concern here).

## 6. Scope: What's In v1 vs. Later
Your spec asks for camera board-scanning, six fully voiced AI buddies with
persistent memory, 50+ mini-games, 500+ achievements, and safe multiplayer, all
at launch. Recommendation: **cut v1 scope to protect quality**, ship the rest as
fast-follow. Rationale in §10.

**v1 (Launch / "World 1 free"):**
- Full onboarding flow (avatar, 1 AI buddy fully built — not six — others "coming
  soon"), parent setup, screen-time controls.
- Days 1–10 of the 30-day course (piece movement → basic checkmates → first full
  game), ~15 mini-games covering all six pieces at least twice each.
- Core AI features: AI coach chat (text first, voice fast-follow), mistake
  explanation, adaptive difficulty for the shipped content.
- Parent dashboard v1: today's activity, screen time, accuracy trend, weekly email
  summary.
- Reward economy: coins, stars, one buildable-world track (Castle), daily reward.
- Stripe one-time premium purchase gating Days 11–30.

**v1.1–v1.3 (weeks 6–16 post-launch):** remaining AI buddies, Days 11–30 content,
multiplayer (friend-approval only), boss battles, more mini-games, achievements
expansion, camera board-scan (this is the highest R&D-risk item — treat as its own
spike, not a committed feature).

**v2+:** Intermediate/Advanced/Tournament/Grandmaster kingdoms, printable
certificates, pet/decoration economy depth.

## 7. Non-Functional Requirements
- **Safety/COPPA & children's privacy:** no behavioral ad tracking, minimal PII,
  parental consent gate before any data collection, data deletion on request.
  This governs backend/auth design from day one — not a later compliance pass.
- **Accessibility:** WCAG 2.1 AA where compatible with a game UI (color-contrast,
  captioned voice lines, reduced-motion toggle for sensory-sensitive kids).
- **Performance:** Stockfish WASM must not block the main thread — run in a Web
  Worker; target <100ms move-suggestion latency on a mid-range tablet.
- **Offline:** core lesson content playable offline (PWA), sync progress on
  reconnect.

## 8. Out of Scope (explicitly)
- Real-money trading of any kind, loot boxes with randomized paid rewards (see §9
  — the "Treasure Chest" mechanic needs a specific safeguard).
- Any open-text chat between children, even "approved friends."
- Third-party ad networks.

## 9. Risk Flags Worth Your Attention
- **Reward economy vs. children's-product norms:** "Treasure Chests" with
  randomized contents, if purchasable with real money, reads as a loot box aimed
  at children — this is restricted or banned outright in several jurisdictions
  (Belgium, Netherlands rulings; platform policies from Apple/Google are also
  stricter for kids categories). Recommendation: chests are earned only, never
  purchasable, and contents are always predictable in *category* (child sees "1
  Rare Skin" not a mystery box) even if the exact skin is randomized.
- **"AI Voice Chat" + open-ended child voice input:** free-form voice input from a
  5-year-old to an LLM needs a tightly scoped system prompt, aggressive
  content filtering, and no persistence of raw audio beyond what's needed for
  transcription — flag this for a dedicated safety review before it ships, not as
  a checkbox at the end.
- **"AI Buddy remembers every child" + cross-session memory:** define exactly what
  is stored (skill progress, favorite jokes told) vs. not stored (nothing that
  looks like a profile of the child's personality/behavior for anyone but the
  learning engine).

## 10. Why Trim the v1 Scope
Six fully-voiced, personality-distinct AI companions; 50+ unique mini-games; 500+
achievements; camera piece-recognition CV; safe multiplayer; and a full 30-day
curriculum is, realistically, 9–14 months for a small senior team, not a single
sprint. Shipping a narrower but *deeper* World 1 (one exceptional AI buddy, ~15
polished mini-games, Days 1–10) gets you real user data and revenue before the
full 50-mini-game catalog is built — and lets the adaptive-learning engine be
tuned on real kids instead of guessed at. This is the single highest-leverage
change I'd make to your spec.

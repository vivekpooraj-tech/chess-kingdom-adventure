# Development Roadmap & Sprint Plan

Assumes a small senior team (2 full-stack eng, 1 designer, 1 part-time chess
content/pedagogy expert, 1 PM) and 2-week sprints. Timeline is realistic-case,
not best-case.

## Phase 0 — Foundation (Sprints 1–2, weeks 1–4)
- Repo scaffold per folder structure; CI/CD to Vercel; Supabase project +
  migrations for identity/curriculum/progress tables.
- Auth flows (parent + child profile linking), parent gate.
- Design system implementation: Tailwind tokens, core UI primitives, one full
  screen (Kingdom Map shell) at production polish to validate the visual bar.
- Stockfish WASM integration spike: confirm Web Worker performance on a
  representative low-end tablet.

**Sprint 1 deliverable:** a child can sign in (via parent), pick an avatar, and
see an empty (visually complete) Kingdom Map. No lesson content yet.

## Phase 1 — Core Loop, One Lesson End-to-End (Sprints 3–4, weeks 5–8)
- Build the 6–8 reusable mini-game *mechanic engines* (not 50 mini-games —
  see Technical Architecture doc).
- Ship Day 1 fully: story beat → 1 mini-game → 1 puzzle → AI chat check-in →
  mini match vs. bot → reward animation, wired to real progress tables.
- Adaptive Learning Engine v0: mastery scoring table + "retry easier variant"
  logic (rules-based, not yet AI-driven).
- One AI Buddy (fully built persona, voice, animation) — this is your v1
  buddy; others deferred.

**Sprint 4 deliverable:** Day 1 is playable start-to-finish and feels like the
target Pixar-quality bar. This is the internal "go/no-go" checkpoint — if Day 1
doesn't delight, don't scale content production yet.

## Phase 2 — Content Scale-Out (Sprints 5–8, weeks 9–16)
- Days 2–10 content production (content pipeline: lesson JSON schema → CMS-lite
  authoring, ideally so the chess-pedagogy expert can author without touching
  code).
- Parent Dashboard v1 (progress, screen time, weekly report).
- Stripe integration + Day 11 paywall.
- Puzzle generation: AI-assisted authoring tool (internal, not child-facing)
  that generates candidate puzzles from real games, reviewed by the chess
  expert before going live — do not ship un-reviewed AI-generated puzzles
  directly to children.

**Sprint 8 deliverable:** Free tier (Days 1–10) is feature-complete and
QA-passed; premium paywall functional in Stripe test mode.

## Phase 3 — Launch Prep (Sprints 9–10, weeks 17–20)
- Accessibility pass (contrast, captions, reduced-motion).
- COPPA-adjacent privacy review (data collected, retention, deletion flow).
- Load/perf testing, offline/PWA verification.
- E2E test suite covering the full Day 1–10 path.
- Soft launch to a small cohort (friends/family or a waitlist) for real
  engagement data before public launch.

## Phase 4 — Post-Launch Fast Follow (weeks 21+)
- Days 11–30 content.
- Remaining 5 AI buddies.
- Boss battles, expanded mini-game catalog toward 50, achievements expansion
  toward 500.
- Safe multiplayer (friend-approval flow).
- Camera board-scanning: separate R&D spike, timeline TBD pending feasibility.

## Sprint 1 — Detailed Backlog (ready to start)
1. Monorepo + CI scaffold
2. Supabase project, initial migrations (parents, children, avatars, ai_buddies)
3. Auth: Google/Apple/Email via Supabase Auth
4. Parent gate screen
5. Avatar picker screen (static asset set, ok to use placeholder art)
6. Kingdom Map shell (static, no lesson nodes wired yet)
7. Tailwind design tokens + 6 core UI primitives (Button, Card, Modal, Speech
   Bubble, Progress Bar, Reward Toast)
8. Stockfish WASM Web Worker spike + benchmark report

---
**Recommendation on where to spend your first real design/eng hours:** Phase 1's
Sprint 4 checkpoint (one fully polished lesson day) is the single highest-value
milestone in this whole plan — it's the cheapest point to discover whether the
"Pixar + Pokémon + Duolingo" feel is actually achievable at your team size and
budget before committing to 30 days × 6 buddies × 50 mini-games of content.

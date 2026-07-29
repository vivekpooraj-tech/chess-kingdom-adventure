# Technical Architecture

## 1. High-Level Diagram (described)
```
┌─────────────────────────────────────────────────────────┐
│  Client (Next.js 14 App Router, TS, PWA)                 │
│  ┌───────────┐ ┌───────────┐ ┌────────────┐              │
│  │ Story/UI  │ │ Chess     │ │ Mini-game   │              │
│  │ (Framer   │ │ Board     │ │ Engine      │              │
│  │ Motion,   │ │ (react-   │ │ (Canvas/    │              │
│  │ Lottie)   │ │ chessboard│ │ WebGL per   │              │
│  │           │ │ + DnD)    │ │ game type)  │              │
│  └───────────┘ └───────────┘ └────────────┘              │
│  Stockfish (WASM, in Web Worker) ── local move eval       │
└──────────────┬────────────────────────────────────────────┘
               │ HTTPS / Supabase JS client
┌──────────────▼────────────────────────────────────────────┐
│  Supabase                                                  │
│  - Auth (Google/Apple/Email, parent+child linked accounts)│
│  - Postgres (RLS enforced per-family)                      │
│  - Storage (avatars, buddy assets, replay data)            │
│  - Edge Functions (server-side AI orchestration)            │
└──────────────┬────────────────────────────────────────────┘
               │
┌──────────────▼────────────────────────────────────────────┐
│  AI Orchestration Layer (Supabase Edge Fn / small Node svc)│
│  - Claude API: coaching dialogue, mistake explanation,      │
│    story generation, puzzle generation                      │
│  - OpenAI: TTS/STT (or provider-agnostic voice layer)       │
│  - Prompt templates versioned per AI Buddy persona           │
└──────────────┬────────────────────────────────────────────┘
               │
┌──────────────▼──────────┐   ┌────────────────────────────┐
│ Stripe (one-time         │   │ Firebase Cloud Messaging    │
│ purchase, webhooks →     │   │ (push notifications only —  │
│ Supabase entitlements)   │   │ no other Firebase services)  │
└───────────────────────────┘   └────────────────────────────┘
```

## 2. Key Architectural Decisions

**Chess engine runs client-side.** Stockfish WASM in a dedicated Web Worker keeps
board evaluation and hint generation off the main thread and off the network —
critical for offline play and for latency on tablets. Server only sees the final
game/puzzle result for progress tracking, not every candidate move.

**AI orchestration is server-side only.** No LLM API keys ever ship to the
client. All Claude/OpenAI calls go through a thin Edge Function layer that (a)
injects the correct AI-buddy persona + the child's current skill state, (b) runs
output through a content filter tuned for this age range, (c) rate-limits per
child to control cost and misuse.

**One mini-game engine, many configs — not 50 separate codebases.** "50 unique
mini-games" should mean 50 *content* variations across a small number of
reusable game *mechanics* (drag-to-target, timed-reaction, pattern-match,
maze-navigate, board-click-sequence). Recommend building 6–8 core mechanic
engines in v1, each parameterized by piece/skill/difficulty, rather than
hand-building 50 bespoke experiences. This is the difference between a
maintainable codebase and an unshippable one.

**Adaptive Learning Engine is a real system, not a prompt.** A rules/scoring
engine (Postgres tables + server logic) tracks per-skill mastery (e.g.
`knight_fork_recognition: 0.72`) from puzzle results. The LLM is used to
*narrate* and *generate content* for whatever the deterministic engine decides
next — not to decide pedagogy itself. This keeps learning outcomes measurable and
debuggable.

**Parent and child are separate auth identities, linked.** A parent account can
have N child profiles. Child profiles have no independent login credential by
default (PIN or parent-approved child login only) — avoids a child accidentally
loop into email/OAuth flows meant for adults.

## 3. Tech Stack Notes vs. Your List
- Confirmed as specified: Next.js, React, TypeScript, Tailwind, Framer Motion,
  React DnD, Lottie, Supabase (Auth/Postgres/Storage), Stripe, Vercel.
- **Stockfish WASM:** confirmed — run in Web Worker, not main thread.
- **Firebase:** scope narrowly to Cloud Messaging (push notifications) only,
  since Supabase already covers auth/db/storage — running two backend platforms
  in parallel for overlapping concerns (e.g. Firebase Auth *and* Supabase Auth)
  is a common source of avoidable complexity.
- **Speech-to-Text/Text-to-Speech:** pick one provider path for v1 (e.g. OpenAI's
  audio APIs) rather than juggling two AI vendors' voice stacks simultaneously;
  add a second provider later only if quality/cost requires it.
- **Camera piece recognition:** not a "just add a library" feature — needs an
  actual CV model (custom-trained or fine-tuned) and a hardware-variability test
  matrix (lighting, board sets, phone cameras). Treat as an R&D spike with its
  own timeline, not a line item alongside "add Stripe."

## 4. Environments
- `local` → Supabase local dev stack + `.env.local`
- `staging` → Vercel preview + Supabase staging project, Stripe test mode
- `production` → Vercel production + Supabase prod project, Stripe live mode
- CI runs unit tests + a Stockfish-integration smoke test + Playwright E2E on
  the core lesson-completion flow before any deploy to staging.

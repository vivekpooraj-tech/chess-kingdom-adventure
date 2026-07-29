# Folder Structure (Next.js App Router, TypeScript)

```
chess-kingdom-adventure/
├── apps/
│   └── web/
│       ├── app/
│       │   ├── (marketing)/                 # public landing/pricing pages
│       │   ├── (auth)/
│       │   │   ├── sign-in/
│       │   │   └── parent-gate/
│       │   ├── (parent)/
│       │   │   ├── dashboard/
│       │   │   ├── reports/
│       │   │   └── settings/
│       │   ├── (child)/
│       │   │   ├── onboarding/
│       │   │   │   ├── avatar/
│       │   │   │   ├── buddy/
│       │   │   │   └── placement/
│       │   │   ├── kingdom-map/
│       │   │   ├── lesson/[dayId]/
│       │   │   └── minigame/[variantId]/
│       │   └── api/
│       │       ├── ai/                      # edge functions: coach, story, puzzle-gen
│       │       ├── stripe/webhook/
│       │       └── progress/
│       ├── components/
│       │   ├── ui/                          # shadcn-style primitives (Button, Modal…)
│       │   ├── board/                       # ChessBoard, PieceSprite, MoveHighlight
│       │   ├── buddy/                       # BuddyAvatar, BuddySpeechBubble
│       │   ├── minigames/
│       │   │   ├── engines/                 # DragToTarget, TimedReaction, MazeNav…
│       │   │   └── variants/                # config-driven per-game content
│       │   └── rewards/                     # ConfettiBurst, CoinCounter, ChestOpen
│       ├── lib/
│       │   ├── supabase/                    # client, server, middleware helpers
│       │   ├── chess-engine/                # Stockfish worker wrapper, PGN utils
│       │   ├── ai/                          # prompt templates, persona configs
│       │   ├── adaptive-learning/           # mastery scoring, next-lesson selection
│       │   └── screen-time/                 # session tracking, lock logic
│       ├── hooks/
│       ├── stores/                          # zustand/jotai: child session state
│       ├── types/
│       ├── content/
│       │   ├── lessons/                     # day-by-day content definitions (JSON/MD)
│       │   ├── stories/                     # narrative beats per crystal
│       │   └── achievements/
│       ├── public/
│       │   ├── lottie/
│       │   ├── sprites/
│       │   └── audio/
│       ├── tests/
│       │   ├── unit/
│       │   └── e2e/                         # Playwright
│       └── next.config.ts
├── packages/                                # shared across web + future mobile
│   ├── chess-logic/                         # rules engine glue, puzzle validators
│   ├── ui-kit/                               # cross-platform design tokens
│   └── config/                              # eslint, tsconfig, tailwind presets
├── supabase/
│   ├── migrations/
│   ├── functions/                           # edge functions (AI orchestration)
│   └── seed.sql
├── docs/                                    # this planning doc set lives here
└── turbo.json / pnpm-workspace.yaml
```

**Why a monorepo (turborepo/pnpm workspaces) even for web-only v1:** the chess
rules/validation logic and design tokens will be needed again the moment you
build a mobile app or a marketing site — isolating them into `packages/` now is
cheap; retrofitting it later after `apps/web` has swallowed everything is not.

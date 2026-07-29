# Design System

## 1. Design Principles
- **Huge tap targets:** minimum 64×64px for any child-facing interactive
  element (well above the usual 44px accessibility minimum) — small motor
  control in the 5–7 band demands it.
- **Minimal text, maximum icon/voice:** every screen readable via icon + optional
  voice narration alone for the 5–7 band; text becomes a secondary channel, not
  the primary one, until age band 8–12.
- **One primary action per screen.** No nested menus during the lesson loop.
- **Constant positive motion:** idle animations on buddy/avatar so the screen
  never feels static or "waiting."

## 2. Color System
- Each World/Kingdom gets a distinct saturated palette (e.g. Pawn Village =
  warm greens/yellows, Knight Forest = deep green/violet) so children
  orient by color before they can read the world name.
- Semantic colors kept consistent across worlds: gold = reward, soft red (never
  harsh/alarming red) = "try again," blue = AI buddy speech bubble.
- All color pairs checked for 4.5:1 contrast minimum even inside playful
  palettes — accessibility is not optional for a kids' product.

## 3. Typography
- Rounded, friendly display face for headers (e.g. Fredoka, Baloo 2, or a
  licensed equivalent).
- High-legibility rounded sans for body/UI text (e.g. Nunito) — avoid anything
  with ambiguous lowercase l/I/1 for early readers.
- Base body size for the 5–7 band: 20px minimum equivalent; 8–12 band: 16px.

## 4. Motion (Framer Motion + Lottie)
- Reward moments get full-screen Lottie sequences (confetti/fireworks/coin
  bursts) capped at ~2s so they delight without stalling the loop.
- Every button press gets a spring "squish" micro-interaction (100–150ms) —
  this single detail does more for "feels alive" than most larger animations.
- Respect `prefers-reduced-motion`: swap large celebratory animations for a
  shorter, calmer variant rather than removing feedback entirely.

## 5. Sound & Voice
- Every buddy line has both audio (TTS or pre-recorded) and captioned text —
  never audio-only, for accessibility and for quiet-mode play.
- Distinct short "earcons" (sound icons) for: correct move, illegal move,
  reward, level-up — consistent across the whole app so kids learn them fast.

## 6. Component Tokens (Tailwind config direction)
```
colors: { world-{name}-{50..900}, semantic-reward, semantic-retry, semantic-info }
radius: { button: 24px, card: 20px, modal: 28px }  // rounded, never sharp
spacing: 4px base scale, but touch targets always rounded up to 64px min
shadow: soft, colored shadows matching the element (not default gray) for a
        Pixar-toy feel rather than a flat "material design" feel
```

## 7. Chess Board Skin
- Default board: clear, high-contrast, standard-ish square colors (never so
  stylized it hurts pattern-recognition transfer to a *real* board — this
  matters for the "play on a real board" success metric).
- Piece skins can be reskinned (dragon set, robot set) for reward/cosmetic
  purposes, but always keep a "classic clarity" toggle, since the actual
  chess-learning value depends on the child recognizing standard piece shapes.

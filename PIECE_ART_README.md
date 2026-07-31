# Chess Kingdom Adventure — Character Asset Pack (v0.1, first pass)

## What's in this pack
- `light/king.svg`, `light/queen.svg`, `light/bishop.svg`, `light/knight.svg`, `light/rook.svg`, `light/pawn.svg`
- `dark/` — same six, dark-team costume variants (not simple recolors: different robe cuts/colors per the spec)
- `colors.json` — light/dark palette
- `piece_metadata.json` — character names, moods, file mapping

All files are hand-built layered SVG (512×512 viewBox, 48px safe area), grouped and named per your layer
structure (Character > Head/Body/Eyes/Mouth/Accessories/etc.), using only the palette hex values from your spec.

## What this is NOT (yet)
This is a **style baseline**, not the full production pack from the spec. Honestly out of scope for me to
produce in one pass:
- DXF / native Illustrator (.ai) files — I don't have Illustrator/Inkscape to export true DXF or AI-native
  files. SVG opens fine in Illustrator and Inkscape, and DXF can be exported from Illustrator/Inkscape once
  you're happy with the SVGs.
- PNG/WEBP raster exports at 2x/4x, character-sheet.png, turnaround-sheet.png — easy to generate once the
  vector style is approved (just re-rendering, not redesigning).
- Board tiles, move-dot/capture-ring/selection icons, sparkle/star/magic/crown effect icons — not built yet.
- `pieces.ts`, `flutter_assets.dart`, `theme.json`, `animations.json`, `LICENSE.md`, `CHANGELOG.md` — not built yet.
- Idle/blink/wave/hop animations — these SVGs are static; animation would be a separate pass (CSS/Lottie/Rive).

## Suggested next step
Look at the 12 SVGs first — they define the visual language everything else builds on. If the proportions/
style land, I'll extend to the dark-team polish pass, PNG exports, and the board/effects icon set next.

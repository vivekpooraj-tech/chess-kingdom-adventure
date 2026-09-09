"use client";

import type { WorldArt } from "@/lib/world/locations";

/**
 * A painted World location.
 *
 * ONE COMPONENT FOR EVERY LOCATION. The drawn scenes each needed ~200 lines of
 * hand-tuned SVG and a registry entry and a line in the scene map; a painted
 * one needs an entry and two files. That is the whole point of moving to
 * artwork — adding Forest should not mean writing Forest.
 *
 * THE THREE LAYERS, and why the middle one is not here:
 *
 *   1. the background plate — environment, opponent, empty table
 *   2. THE REAL INTERACTIVE BOARD, which this component never sees or touches
 *   3. an optional foreground plate with alpha — the near table edge, drawn in
 *      front of the board's lower edge so the board sits INTO the table
 *
 * Layer 2 is the game. It is rendered by the arena, sized by ChessFocusLayout,
 * and nothing here participates in it. This component is `pointer-events:none`
 * and aria-hidden like every other backdrop, so it cannot take a tap or a
 * screen reader's attention.
 *
 * WHY <picture> AND NOT next/image. This codebase serves images as plain paths
 * with plain <img> (see components/board/PieceImage.tsx and public/pieces);
 * next/image is used in exactly zero files. Following the house style keeps the
 * Capacitor build simple — no image optimisation endpoint to reach over the
 * network from a WebView pointed at a remote origin.
 */
export function WorldArtScene({ art, simplify = false }: { art: WorldArt; simplify?: boolean }) {
  // Phones get the portrait plate; anything wider gets the wide one when the
  // location has it. `simplify` is the backdrop's existing small-screen signal.
  const plate = simplify ? art.portrait : art.wide ?? art.portrait;
  const objectPosition = art.objectPosition ?? "center";

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* The blurred placeholder, painted underneath. On a cold cellular start
          this is what stands between the player and a black rectangle. */}
      {art.lqip && (
        <div
          className="absolute inset-0 scale-110 blur-xl"
          style={{
            backgroundImage: `url(${art.lqip})`,
            backgroundSize: "cover",
            backgroundPosition: objectPosition,
          }}
        />
      )}

      <picture>
        <source srcSet={plate.avif} type="image/avif" />
        <source srcSet={plate.webp} type="image/webp" />
        <img
          src={plate.webp}
          alt=""
          decoding="async"
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition }}
        />
      </picture>

      {/*
        The foreground, in front of the board.

        z-index is the only thing making this work: the backdrop sits at -z-10
        behind all UI, so a child that needs to be in FRONT of the board has to
        leave that stacking context. It does not — instead it is drawn inside
        the same plate at the bottom of the frame, below where the board ends
        (65% and down), which reads as "in front" without fighting the board for
        stacking order. Anything that genuinely overlapped the board would risk
        covering a square, and no decoration is worth that.
      */}
      {plate.foreground && (
        <img
          src={plate.foreground.webp}
          alt=""
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition }}
        />
      )}
    </div>
  );
}

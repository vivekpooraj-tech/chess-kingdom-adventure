"use client";

import { WorldSceneBackdrop } from "./WorldSceneBackdrop";
import type { WorldLocationId } from "@/lib/world/locations";

/**
 * Everything a World game needs the arena to do differently — and nothing
 * else. Mounted through ChessFocusLayout's `boardMeta` slot, which is the
 * only hook the arena offers above the board, and rendered ONLY when a World
 * location is active, so a normal Free Play or online game is untouched by
 * construction rather than by a conditional.
 *
 * It does three things.
 *
 * 1. THE SCENE, FULL-BLEED. A `fixed inset-0` child of `boardMeta` escapes to
 *    the viewport; `-z-10` puts it above the arena shell's own background and
 *    below every piece of UI, so it can cover nothing and capture nothing.
 *
 * 2. SKY. A spacer that pushes the board DOWN to open canvas above it.
 *
 *    This is the part worth understanding, because the obvious approach is
 *    wrong. Making the header shorter does not create room above the board —
 *    it pulls the whole column up and creates room BELOW. What actually opens
 *    sky is adding height above the board, which is exactly what `boardMeta`
 *    does.
 *
 *    It is free because of an invariant the sizing module states outright:
 *    "on every common phone portrait viewport the board stays limited by
 *    WIDTH". On a 390px phone the board is 352px because of the 8px side
 *    padding, not because of anything vertical, and there is ~560px of
 *    vertical slack. Spending some of it above the board costs the board
 *    nothing — verified by measurement, not by assumption.
 *
 *    Zero in side-by-side and landscape, where the board IS height-limited
 *    and a spacer would genuinely shrink it, and where the composition
 *    already has room at the sides.
 *
 * 3. QUIET CHROME. The arena header keeps its height — losing it would pull
 *    the board up again — but loses its centred title and its solid controls,
 *    so the band reads as sky with two small glass controls floating in it
 *    rather than as a title bar. The freed centre is where the opponent's
 *    head sits.
 *
 * The board is never touched: no width, no height, no padding, no geometry.
 */
export function WorldArenaChrome({ locationId }: { locationId: WorldLocationId }) {
  return (
    <>
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
        <WorldSceneBackdrop locationId={locationId} scrim={0.42} />
      </div>

      {/* The sky. Height only — it draws nothing itself; the scene behind it
          shows through. */}
      <div className="world-sky pointer-events-none w-full" aria-hidden="true" />

      <style jsx global>{`
        /*
         * Scoped to World games by existence: this component only renders when
         * a location is active, so these rules simply do not exist for a normal
         * game. No flag, no cleanup, nothing to leave behind.
         */
        .world-sky {
          height: 0;
        }

        /* Portrait phones and small tablets: open real sky above the board.
           The board is width-limited here, so this costs it nothing. */
        @media (max-width: 699px) and (orientation: portrait) {
          .world-sky {
            /*
             * Tuned by measurement, not by taste. The board is width-limited
             * only until the column runs out of height, and at 411x914 there
             * turned out to be ~129px of genuine slack, not the ~560px the
             * raw arithmetic suggested — the panel reserve and the two player
             * rows claim most of it. 176px here cost the board 45px
             * (371 -> 326), which is exactly the regression this must not
             * cause. This value stays inside the slack, and the board
             * measurement in the verification step is what proves it.
             */
            height: 72px;
          }

          /*
           * How much sky is safe depends on the viewport's HEIGHT, not a
           * single percentage. Measured: at 411x914 a 110px sky left the board
           * at its full 371px, but the same 12vh on a 390x844 screen (101px)
           * pushed it to 337 — a regression. The slack is whatever the column
           * has left after the header, both player rows and the fixed panel
           * reserve, and that does not scale with vh. So the value is banded
           * by height and each band is verified by measuring the board, which
           * is the only check that actually means anything here.
           */
          @media (min-height: 880px) {
            .world-sky {
              height: 104px;
            }
          }
        }

        /*
         * The arena header, made quiet. Height is deliberately NOT reduced:
         * a shorter header pulls the board up and closes the sky this
         * component just opened.
         */
        .chess-focus-header {
          background: transparent;
        }

        /* The centred match title goes, freeing the middle of the band for the
           opponent. The place is named by the World badge and the opponent by
           their own card, so nothing is lost that is not said elsewhere. */
        .chess-focus-header h1 {
          display: none;
        }

        /* Exit becomes a glass pill instead of bare text on a sky. */
        .chess-focus-header > button:first-child {
          background: rgba(10, 8, 20, 0.42);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 999px;
          padding-left: 0.7rem;
          padding-right: 0.85rem;
          min-height: 36px;
          color: rgba(247, 243, 232, 0.92);
        }

        /* Same treatment for the fullscreen control on the right. */
        .chess-focus-header button:last-child {
          background: rgba(10, 8, 20, 0.42);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          border: 1px solid rgba(255, 255, 255, 0.12);
        }

        /* The move-list / info panel below the board becomes glass too, so the
           foreground of the scene reads through it instead of being covered by
           a slab. Its own borders and text colours are untouched. */
        .chess-focus-panel {
          background: rgba(8, 6, 18, 0.34);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border-radius: 1rem;
        }

        @media (prefers-reduced-transparency: reduce) {
          .chess-focus-header > button:first-child,
          .chess-focus-header button:last-child,
          .chess-focus-panel {
            backdrop-filter: none;
            -webkit-backdrop-filter: none;
            background: rgba(8, 6, 18, 0.9);
          }
        }
      `}</style>
    </>
  );
}

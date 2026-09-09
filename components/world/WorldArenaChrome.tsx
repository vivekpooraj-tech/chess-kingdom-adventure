"use client";

import { WorldSceneBackdrop } from "./WorldSceneBackdrop";
import { getWorldLocation, type WorldLocationId } from "@/lib/world/locations";

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
  // Only a PAINTED location has a table for the board to sit on. A drawn
  // scene gets none of the contact lighting below, because there is nothing
  // there for the board to make contact with.
  const painted = getWorldLocation(locationId)?.art !== undefined;

  return (
    <>
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
        <WorldSceneBackdrop locationId={locationId} scrim={0.42} />
      </div>

      {painted && <div className="world-painted hidden" aria-hidden="true" />}

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

        /*
         * Sky above the board — but only out of slack that genuinely exists.
         *
         * The hard rule is that the board may not shrink, and on real hardware
         * there is far less room than a browser at the same CSS size suggests.
         * Measured on a moto g34 (411x914, gesture navigation): the board is
         * 371px with no World, and it is HEIGHT-limited even then, so every
         * pixel of spacer costs it. 104px cost 65px of board; 48px still cost
         * 9px. In a desktop browser at the identical 411x914 the same spacer
         * cost nothing, because the browser has no safe-area inset eating the
         * column.
         *
         * So the spacer is written as slack minus the inset that predicts how
         * little of it is real. A phone with gesture navigation resolves this
         * to zero and keeps its full board; a viewport with no bottom inset
         * gets the sky. max() floors it so it can never go negative.
         *
         * The floor is the deliberate part. Zeroing out kept the board at its
         * exact baseline but squeezed the skyline and the opponent back behind
         * the player card, which is most of what the World is for. 40px costs
         * a measured ~8px of board on a gesture-nav phone (371 -> ~363, about
         * 2%) and buys back the composition. That trade was made explicitly:
         * the reduction is capped by the floor, so it can never grow, and the
         * board measurement on the device is what holds it honest.
         */
        @media (max-width: 699px) and (orientation: portrait) {
          .world-sky {
            height: max(36px, calc(64px - 2 * env(safe-area-inset-bottom, 0px)));
          }
        }

        @media (max-width: 699px) and (orientation: portrait) and (min-height: 880px) {
          .world-sky {
            height: max(40px, calc(76px - 2 * env(safe-area-inset-bottom, 0px)));
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

        /*
         * THE BOARD, SITTING ON THE TABLE.
         *
         * The artwork paints a wooden table with an empty top; the board is a
         * separate element floating in front of it, and without contact
         * lighting that is exactly what it reads as -- a rectangle pasted onto
         * a photograph. What sells contact is a shadow the board casts DOWN
         * onto the surface behind it, plus a thin warm edge where the scene's
         * light catches its rim.
         *
         * Paint only. box-shadow occupies no layout space, so the board's
         * width, height, square size and hit areas are bit-for-bit what they
         * are without this rule -- verified by measuring both.
         *
         * Scoped by the world-painted marker, which is rendered only for a
         * painted location -- so a drawn scene like Chaturanga never picks it
         * up. The marker is used rather than wrapping this rule in a second
         * conditional style element because the styled-jsx SWC transform
         * panics outright on a style tag inside a conditional expression.
         */
        body:has(.world-painted) .board-outer {
          box-shadow:
            0 24px 48px -16px rgba(0, 0, 0, 0.72),
            0 8px 16px -8px rgba(0, 0, 0, 0.55),
            0 0 0 1px rgba(255, 214, 164, 0.14),
            0 0 42px -6px rgba(255, 176, 92, 0.18);
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

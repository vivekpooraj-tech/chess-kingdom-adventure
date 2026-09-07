"use client";

import { useWorldLocation } from "@/lib/world/useWorldLocation";

/**
 * The floating control pill.
 *
 * Every button here calls a handler the game page already owns. There is no
 * confirmation state, no game state and no action logic in this file — pressing
 * Resign runs the page's existing `setResignConfirm(true)`, which shows the
 * page's existing confirmation in the panel. The pill is a shortcut to controls
 * that already exist, never a second copy of them, so the two can never
 * disagree about whether a resignation was confirmed.
 *
 * Renders nothing without a location, so it cannot alter the normal game.
 *
 * Hidden below `sm`: on a phone the panel's own buttons are already within
 * thumb reach and a floating bar would cover the bottom rank.
 */
export function WorldControlBar({
  onResign,
  onOfferDraw,
  onSettings,
  drawOffered,
  disabled,
}: {
  onResign?: () => void;
  onOfferDraw?: () => void;
  onSettings?: () => void;
  /** True once this player has offered — the button becomes a status. */
  drawOffered?: boolean;
  /** Game over: the bar stays visible but inert, so it does not vanish and
   *  shift the layout at the moment a game ends. */
  disabled?: boolean;
}) {
  const { location } = useWorldLocation();
  if (!location) return null;

  const item =
    "flex flex-col items-center gap-1 rounded-xl px-4 py-2 font-classic-body text-[11px] text-premium-ivory/75 transition-colors hover:bg-white/[0.07] hover:text-premium-ivory focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-premium-gold disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent";

  return (
    /*
     * Anchored bottom-RIGHT, not centred.
     *
     * Centred, it landed on the board. Measured at 1024x768 side-by-side: the
     * bar occupied x 430-595 while the board spanned to x 656, so it covered
     * the lower ranks — the one thing a control bar must never do. The board
     * fills the column height in that layout, so there is no clear strip
     * beneath it to centre into.
     *
     * The panel column is the reliably clear region in side-by-side, and in the
     * stacked layout the bottom-right is below the board rather than on it. One
     * anchor therefore works for both, without measuring the board at runtime.
     */
    <div className="pointer-events-none absolute bottom-3 right-3 z-20 hidden justify-end sm:flex">
      <div
        className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-white/10 bg-black/45 px-2 py-1.5 backdrop-blur-md"
        role="group"
        aria-label="Game controls"
      >
        {onResign && (
          <button type="button" onClick={onResign} disabled={disabled} className={item}>
            <span aria-hidden="true" className="text-base">
              ⚑
            </span>
            Resign
          </button>
        )}

        {onOfferDraw && (
          <button
            type="button"
            onClick={onOfferDraw}
            disabled={disabled || drawOffered}
            className={item}
          >
            <span aria-hidden="true" className="text-base">
              ½
            </span>
            {drawOffered ? "Offered" : "Offer Draw"}
          </button>
        )}

        {onSettings && (
          <button type="button" onClick={onSettings} disabled={disabled} className={item}>
            <span aria-hidden="true" className="text-base">
              ⚙
            </span>
            Settings
          </button>
        )}
      </div>
    </div>
  );
}

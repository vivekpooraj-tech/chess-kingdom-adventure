/**
 * Chess School board fit.
 *
 * The lesson board used to be sized from the viewport alone
 * (min(100vw - 1rem, 88dvh, 720px)). That ignores everything else on a lesson
 * screen — the exit/header block, the Ollie line, the teaching text and the
 * primary button — so on a phone the board took its full width and the button
 * (and often the whole prompt) ended up below the fold, forcing a scroll to
 * finish a step.
 *
 * The board now also has to leave room for the rest of the screen. The page
 * measures how tall everything EXCEPT the board is, and this pure function turns
 * that into the widest board that still lets the whole step fit on one screen.
 *
 *   boardWidth = viewportHeight - nonBoardHeight - frameExtra
 *
 *   viewportHeight  visible height (visualViewport, so browser bars and the
 *                   on-screen keyboard are respected)
 *   nonBoardHeight  document height minus the board frame's own height: header,
 *                   progress bar, coach line, text, button and bottom padding
 *   frameExtra      the board frame is taller than it is wide (the thinking line
 *                   under the squares); that extra height comes out of the width
 *
 * It never returns a board narrower than MIN_SCHOOL_BOARD: below that the squares
 * stop being comfortable touch targets, so a very short viewport scrolls a little
 * instead of shrinking the board further. It only ever REDUCES the width — when the
 * CSS width already fits, it returns null and the layout is left exactly as it was.
 */
export const MIN_SCHOOL_BOARD = 280;

export function fitBoardWidth(args: {
  viewportHeight: number;
  nonBoardHeight: number;
  frameExtra: number;
  /** The width the existing CSS formula already gives the frame. */
  cssWidth: number;
}): number | null {
  const { viewportHeight, nonBoardHeight, frameExtra, cssWidth } = args;
  if (![viewportHeight, nonBoardHeight, frameExtra, cssWidth].every(Number.isFinite)) return null;
  const room = Math.floor(viewportHeight - nonBoardHeight - Math.max(0, frameExtra));
  if (room >= cssWidth) return null;
  return Math.min(cssWidth, Math.max(MIN_SCHOOL_BOARD, room));
}

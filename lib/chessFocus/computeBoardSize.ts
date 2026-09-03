export const CHESS_FOCUS_SIDE_PANEL_WIDTH = 272;
export const CHESS_FOCUS_SIDE_PANEL_GAP = 12;
export const CHESS_FOCUS_MIN_BOARD = 240;
export const CHESS_FOCUS_MAX_BOARD = 1200;

/**
 * Fixed vertical space held back for the info/move-list panel in the
 * STACKED (portrait / narrow) layout. It is deliberately a constant, not a
 * measurement of the panel's rendered height: the panel contains the move
 * list, which grows as a game progresses, and feeding its height back into
 * the board calculation is exactly what used to make the board shrink move
 * by move. The panel takes whatever space is actually left over and scrolls
 * internally when its content exceeds that — see ChessFocusLayout.
 *
 * Sized so that on every common phone portrait viewport (>= ~360×640) the
 * board stays limited by WIDTH (i.e. full size), while still guaranteeing
 * the panel a usable strip (captured pieces + a few move rows, or a puzzle
 * objective) before the board starts winning height on genuinely short
 * screens.
 */
export const CHESS_FOCUS_STACKED_PANEL_RESERVE = 168;

export type ComputeBoardSizeParams = {
  viewportWidth: number;
  viewportHeight: number;
  boardColumnChromeHeight: number;
  /** Fixed reserve for the panel below the board in stacked layout. NOT the
   * panel's measured height — see CHESS_FOCUS_STACKED_PANEL_RESERVE. */
  stackedPanelReserve: number;
  isSideBySide: boolean;
  sidePanelWidth?: number;
  horizontalPadding?: number;
  verticalPadding?: number;
};

function clampBoard(size: number): number {
  return Math.max(CHESS_FOCUS_MIN_BOARD, Math.min(CHESS_FOCUS_MAX_BOARD, Math.floor(size)));
}

/**
 * On a large screen an unconstrained board fills ~100% of the viewport
 * height, which leaves the side panel looking dwarfed and gives the
 * workspace no vertical breathing room. Soft-cap it so board + panel read
 * as a composed workspace rather than a giant board with an afterthought
 * beside it. Small screens are unaffected (they need every pixel).
 */
function breathingCap(viewportWidth: number, viewportHeight: number): number {
  const smallEdge = Math.min(viewportWidth, viewportHeight);
  if (smallEdge >= 800) return 820;
  if (smallEdge >= 680) return Math.round(smallEdge * 0.92);
  return CHESS_FOCUS_MAX_BOARD;
}

/**
 * Single source of truth for chess focus board sizing.
 *
 * The invariant: the returned size depends ONLY on the viewport and the
 * fixed chrome (header, player rows) — never on the panel's content. Adding
 * moves to the move list must not change it.
 *
 *   Side-by-side: min(availableHeight, availableWidth - sidePanel)
 *   Stacked:      min(availableWidth, availableHeight - fixedPanelReserve)
 */
export function computeChessFocusBoardSize(params: ComputeBoardSizeParams): number {
  const {
    viewportWidth,
    viewportHeight,
    boardColumnChromeHeight,
    stackedPanelReserve,
    isSideBySide,
    sidePanelWidth = CHESS_FOCUS_SIDE_PANEL_WIDTH,
    horizontalPadding = 8,
    verticalPadding = 8,
  } = params;

  const shellH = horizontalPadding * 2;
  const shellV = verticalPadding * 2;

  const cap = breathingCap(viewportWidth, viewportHeight);

  if (isSideBySide) {
    // The panel is a fixed-width band (sidePanelWidth); its height never
    // constrains the board. Board is the largest square that fits the
    // remaining width AND the full column height.
    const availableHeight = viewportHeight - boardColumnChromeHeight - shellV;
    const availableWidth =
      viewportWidth - sidePanelWidth - CHESS_FOCUS_SIDE_PANEL_GAP - shellH;
    return clampBoard(Math.min(availableHeight, availableWidth, cap));
  }

  const availableWidth = viewportWidth - shellH;
  const availableHeight =
    viewportHeight - boardColumnChromeHeight - stackedPanelReserve - shellV;
  return clampBoard(Math.min(availableWidth, availableHeight, cap));
}

/**
 * Should the board and its info panel sit side-by-side?
 *
 *   - landscape and >= 560px wide → split (a landscape device has to put
 *     the controls somewhere; beside the board beats off-screen below it)
 *   - >= 1000px wide → split even in portrait (12.9" tablet, a portrait
 *     desktop window) — there's room for a full board AND the panel
 *   - otherwise (phones, and tablet PORTRAIT up to ~1000px) → stack, board
 *     first. On a tall portrait screen a board-on-top layout is the
 *     natural, premium choice; the info panel sits directly below it (not
 *     a cramped strip) and the board is only lightly capped for breathing
 *     room — see breathingCap.
 */
export function isChessFocusSideBySide(viewportWidth: number, viewportHeight: number): boolean {
  if (viewportWidth > viewportHeight && viewportWidth >= 560) return true;
  return viewportWidth >= 1000;
}

export const CHESS_FOCUS_SIDE_PANEL_WIDTH = 272;
export const CHESS_FOCUS_SIDE_PANEL_GAP = 12;
export const CHESS_FOCUS_MIN_BOARD = 240;
export const CHESS_FOCUS_MAX_BOARD = 1200;

export type ComputeBoardSizeParams = {
  viewportWidth: number;
  viewportHeight: number;
  boardColumnChromeHeight: number;
  stackedPanelHeight: number;
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
 * Landscape: min(availableHeight, availableWidth - sidePanel)
 * Portrait: min(fullWidth, availableHeight - stackedPanel)
 */
export function computeChessFocusBoardSize(params: ComputeBoardSizeParams): number {
  const {
    viewportWidth,
    viewportHeight,
    boardColumnChromeHeight,
    stackedPanelHeight,
    isSideBySide,
    sidePanelWidth = CHESS_FOCUS_SIDE_PANEL_WIDTH,
    horizontalPadding = 8,
    verticalPadding = 8,
  } = params;

  const shellH = horizontalPadding * 2;
  const shellV = verticalPadding * 2;

  const cap = breathingCap(viewportWidth, viewportHeight);

  if (isSideBySide) {
    const availableHeight = viewportHeight - boardColumnChromeHeight - shellV;
    const availableWidth =
      viewportWidth - sidePanelWidth - CHESS_FOCUS_SIDE_PANEL_GAP - shellH;
    return clampBoard(Math.min(availableHeight, availableWidth, cap));
  }

  const availableWidth = viewportWidth - shellH;
  const availableHeight =
    viewportHeight - boardColumnChromeHeight - stackedPanelHeight - shellV;
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

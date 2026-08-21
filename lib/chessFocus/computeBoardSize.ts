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

  if (isSideBySide) {
    const availableHeight = viewportHeight - boardColumnChromeHeight - shellV;
    const availableWidth =
      viewportWidth - sidePanelWidth - CHESS_FOCUS_SIDE_PANEL_GAP - shellH;
    return clampBoard(Math.min(availableHeight, availableWidth));
  }

  const availableWidth = viewportWidth - shellH;
  const availableHeight =
    viewportHeight - boardColumnChromeHeight - stackedPanelHeight - shellV;
  return clampBoard(Math.min(availableWidth, availableHeight));
}

/** Orientation-based side-by-side — never width breakpoints alone. */
export function isChessFocusSideBySide(viewportWidth: number, viewportHeight: number): boolean {
  return viewportWidth > viewportHeight && viewportWidth >= 480;
}

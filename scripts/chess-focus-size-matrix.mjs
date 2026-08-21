/**
 * Reports expected chess focus board sizes at common viewport breakpoints.
 * Run: node scripts/chess-focus-size-matrix.mjs
 */

const CHESS_FOCUS_SIDE_PANEL_WIDTH = 272;
const CHESS_FOCUS_SIDE_PANEL_GAP = 12;
const CHESS_FOCUS_MIN_BOARD = 240;
const CHESS_FOCUS_MAX_BOARD = 1200;

function isChessFocusSideBySide(viewportWidth, viewportHeight) {
  return viewportWidth > viewportHeight && viewportWidth >= 480;
}

function computeChessFocusBoardSize(params) {
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

  let size;
  if (isSideBySide) {
    const availableHeight = viewportHeight - boardColumnChromeHeight - shellV;
    const availableWidth = viewportWidth - sidePanelWidth - CHESS_FOCUS_SIDE_PANEL_GAP - shellH;
    size = Math.min(availableHeight, availableWidth);
  } else {
    const availableWidth = viewportWidth - shellH;
    const availableHeight = viewportHeight - boardColumnChromeHeight - stackedPanelHeight - shellV;
    size = Math.min(availableWidth, availableHeight);
  }

  return Math.max(CHESS_FOCUS_MIN_BOARD, Math.min(CHESS_FOCUS_MAX_BOARD, Math.floor(size)));
}

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 800, height: 1280 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
];

const CHROME_PORTRAIT = 52;
const CHROME_LANDSCAPE = 88;
const STACKED_PANEL = 180;

console.log("Chess Focus board size matrix\n");
console.log(
  "viewport".padEnd(14),
  "orient".padEnd(10),
  "sideBySide".padEnd(11),
  "board".padEnd(7),
  "unusedV".padEnd(9),
  "unusedH"
);

for (const vp of VIEWPORTS) {
  const sideBySide = isChessFocusSideBySide(vp.width, vp.height);
  const chrome = sideBySide ? CHROME_LANDSCAPE : CHROME_PORTRAIT;
  const board = computeChessFocusBoardSize({
    viewportWidth: vp.width,
    viewportHeight: vp.height,
    boardColumnChromeHeight: chrome,
    stackedPanelHeight: sideBySide ? 0 : STACKED_PANEL,
    isSideBySide: sideBySide,
  });

  const orient = vp.width > vp.height ? "landscape" : "portrait";
  const unusedV = vp.height - chrome - board - (sideBySide ? 0 : STACKED_PANEL) - 16;
  const unusedH = sideBySide
    ? vp.width - board - CHESS_FOCUS_SIDE_PANEL_WIDTH - 12 - 16
    : vp.width - board - 16;

  console.log(
    `${vp.width}x${vp.height}`.padEnd(14),
    orient.padEnd(10),
    String(sideBySide).padEnd(11),
    String(board).padEnd(7),
    String(Math.max(0, Math.round(unusedV))).padEnd(9),
    Math.max(0, Math.round(unusedH))
  );
}

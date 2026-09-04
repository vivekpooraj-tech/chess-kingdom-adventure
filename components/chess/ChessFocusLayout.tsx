"use client";

import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { FullscreenIcon, CloseIcon } from "@/components/nav/icons";
import { IconButton } from "@/components/ui/Button";
import {
  computeChessFocusBoardSize,
  isChessFocusSideBySide,
  CHESS_FOCUS_SIDE_PANEL_WIDTH,
  CHESS_FOCUS_STACKED_PANEL_RESERVE,
} from "@/lib/chessFocus/computeBoardSize";
import { setChessFocusActive, resetChessFocusMode } from "@/lib/chessFocus/focusMode";

/**
 * The true CSS viewport the shell has to fit into. Deliberately NOT
 * getViewportMetrics() — that substitutes physical screen dimensions when
 * `is-tablet` is set and the reported viewport looks small, which is a
 * workaround for broken WebView innerWidth on some Android tablets but
 * over-fires (browser chrome, split-screen, emulation) and would size the
 * board + panel wider than the space that actually exists, clipping them.
 * The shell is `position: fixed; inset: 0`, so visualViewport / innerWidth
 * is exactly what it occupies.
 */
function readViewport(): { width: number; height: number } {
  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  return {
    width: Math.round(vv?.width ?? window.innerWidth),
    height: Math.round(vv?.height ?? window.innerHeight),
  };
}

const BOARD_COLUMN_GAPS = 10;
const MEASURE_BUFFER = 6;
/** Side-panel width band — must stay in step with the CSS clamp() below and
 * with the sidePanelWidth passed into computeChessFocusBoardSize. */
const SIDE_PANEL_MIN = CHESS_FOCUS_SIDE_PANEL_WIDTH; // 272
const SIDE_PANEL_MAX = 360;

export type ChessFocusLayoutProps = {
  title: string;
  onExit?: () => void;
  opponentRow?: ReactNode;
  playerRow?: ReactNode;
  renderBoard: (boardSize: number) => ReactNode;
  sidePanel?: ReactNode;
  /** Extra content measured as part of board-column chrome (above the board). */
  boardMeta?: ReactNode;
  /** Keep the primary tab bar visible (e.g. Puzzle Trainer tab). */
  preserveBottomNav?: boolean;
};

/**
 * Reusable full-screen chess focus shell for every interactive board screen
 * (Puzzle Trainer, Free Play, Online, opening trainer).
 *
 * Board-sizing contract — the important part:
 *   The board is the largest STABLE square that fits the viewport and the
 *   fixed chrome (header + player rows). Its size NEVER depends on how tall
 *   the move list / info panel is. The panel takes whatever space is left
 *   and scrolls internally. Adding moves does not shrink the board.
 *
 *   Stacked (phones, tablet portrait): header · board · panel below it,
 *   panel fills the remaining height and scrolls.
 *   Side-by-side (landscape ≥ 560w, or any viewport ≥ 1000w): header spans
 *   the top, board on the left sized to the FULL column height, panel is a
 *   fixed-width scrolling band on the right that also holds the player rows.
 *
 * Hides PrimaryNav while mounted unless `preserveBottomNav` is set.
 */
export function ChessFocusLayout({
  title,
  onExit,
  opponentRow,
  playerRow,
  boardMeta,
  renderBoard,
  sidePanel,
  preserveBottomNav = false,
}: ChessFocusLayoutProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const metaRef = useRef<HTMLDivElement | null>(null);
  const stackedOpponentRef = useRef<HTMLDivElement | null>(null);
  const stackedPlayerRef = useRef<HTMLDivElement | null>(null);

  const [boardSize, setBoardSize] = useState(480);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);
  const [isCompactLandscape, setIsCompactLandscape] = useState(false);
  const [isSideBySide, setIsSideBySide] = useState(false);

  useEffect(() => {
    if (!preserveBottomNav) {
      setChessFocusActive(true);
      return () => setChessFocusActive(false);
    }
    resetChessFocusMode();
  }, [preserveBottomNav]);

  useLayoutEffect(() => {
    setFullscreenSupported(typeof document !== "undefined" && document.fullscreenEnabled === true);
    function onChange() {
      setIsFullscreen(document.fullscreenElement === shellRef.current);
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useLayoutEffect(() => {
    function recompute() {
      const shellEl = shellRef.current;
      const metrics =
        preserveBottomNav && shellEl
          ? { width: shellEl.clientWidth, height: shellEl.clientHeight }
          : readViewport();
      const sideBySide = isChessFocusSideBySide(metrics.width, metrics.height);
      setIsSideBySide(sideBySide);
      setIsCompactLandscape(sideBySide && metrics.height <= 520);

      const shellStyle = shellEl ? getComputedStyle(shellEl) : null;
      const shellPadV = shellStyle
        ? parseFloat(shellStyle.paddingTop) + parseFloat(shellStyle.paddingBottom)
        : 16;

      // Chrome that sits ABOVE the board and eats into its available height.
      // Stacked: header + meta + both player rows sit above/around the board.
      // Side-by-side: the header AND the player rows live in the panel
      // column, so the only thing above the board is `boardMeta` — the board
      // gets nearly the full viewport height.
      const headerH = sideBySide ? 0 : headerRef.current?.offsetHeight ?? 0;
      const metaH = metaRef.current?.offsetHeight ?? 0;
      const stackedRowsH = sideBySide
        ? 0
        : (stackedOpponentRef.current?.offsetHeight ?? 0) +
          (stackedPlayerRef.current?.offsetHeight ?? 0);

      const boardColumnChrome =
        headerH + metaH + stackedRowsH + BOARD_COLUMN_GAPS + MEASURE_BUFFER + shellPadV;

      const sidePanelWidth = sideBySide
        ? Math.min(SIDE_PANEL_MAX, Math.max(SIDE_PANEL_MIN, Math.floor(metrics.width * 0.3)))
        : 0;

      let viewportHeight = metrics.height;
      let viewportWidth = metrics.width;

      if (!preserveBottomNav) {
        // Full-screen shell — readViewport is the whole visual viewport.
      } else if (!shellEl) {
        const root = getComputedStyle(document.documentElement);
        const layout = document.documentElement.dataset.layout ?? "phone";
        const navH = parseFloat(root.getPropertyValue("--bottom-nav-h")) || 56;
        const topbarH = parseFloat(root.getPropertyValue("--topbar-h")) || 0;
        const safeBottom = parseFloat(root.getPropertyValue("--safe-bottom")) || 0;
        const bottomReserve = layout === "desktop" ? safeBottom : navH + safeBottom;
        const topReserve = layout === "phone" ? 0 : topbarH;
        viewportHeight = metrics.height - bottomReserve - topReserve;
        if (layout === "desktop") {
          viewportWidth =
            metrics.width - (parseFloat(root.getPropertyValue("--app-sidenav-w")) || 240);
        }
      }

      const next = computeChessFocusBoardSize({
        viewportWidth,
        viewportHeight,
        boardColumnChromeHeight: isFullscreen ? boardColumnChrome * 0.6 : boardColumnChrome,
        // FIXED reserve — never the panel's measured height. This is what
        // keeps the board from shrinking as the move list grows.
        stackedPanelReserve: sideBySide ? 0 : CHESS_FOCUS_STACKED_PANEL_RESERVE,
        isSideBySide: sideBySide,
        sidePanelWidth,
        horizontalPadding: isFullscreen ? 4 : 8,
        verticalPadding: isFullscreen ? 4 : 8,
      });

      setBoardSize(next);
    }

    recompute();
    // Observe only the FIXED chrome (header, meta, player rows) and the
    // shell itself — never the info/move-list panel, whose height is
    // content-driven and must not feed back into the board size.
    const ro = new ResizeObserver(recompute);
    [headerRef, metaRef, stackedOpponentRef, stackedPlayerRef, shellRef].forEach((ref) => {
      if (ref.current) ro.observe(ref.current);
    });
    window.addEventListener("resize", recompute);
    window.addEventListener("orientationchange", recompute);
    window.visualViewport?.addEventListener("resize", recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recompute);
      window.removeEventListener("orientationchange", recompute);
      window.visualViewport?.removeEventListener("resize", recompute);
    };
  }, [isFullscreen, preserveBottomNav]);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      shellRef.current?.requestFullscreen?.().catch(() => {});
    }
  }

  const header = !isFullscreen && !preserveBottomNav && (
    <div
      ref={headerRef}
      className="chess-focus-header flex-shrink-0 w-full flex items-center justify-between gap-2 px-2 py-0.5"
    >
      <button
        onClick={onExit}
        aria-label="Exit"
        className="flex items-center gap-1.5 font-classic-body text-xs text-premium-ivory/55 hover:text-premium-ivory transition-colors rounded min-h-[44px] px-1"
      >
        <CloseIcon className="w-4 h-4" /> Exit
      </button>
      {!isCompactLandscape && (
        <h1 className="font-classic-display text-sm sm:text-base text-premium-ivory/85 truncate px-2">
          {title}
        </h1>
      )}
      {fullscreenSupported ? (
        <IconButton
          label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          tone="premium"
          size={isCompactLandscape ? 36 : 44}
          onClick={toggleFullscreen}
        >
          <FullscreenIcon className="w-4 h-4" />
        </IconButton>
      ) : (
        <span className="w-11" aria-hidden="true" />
      )}
    </div>
  );

  const shellProps = {
    ref: shellRef,
    className: preserveBottomNav
      ? "chess-focus-shell--preserve-nav flex flex-col w-full bg-premium-midnight pt-safe overflow-hidden"
      : "chess-focus-shell fixed inset-0 z-50 bg-premium-midnight flex flex-col overflow-hidden",
    style: preserveBottomNav
      ? undefined
      : {
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          paddingLeft: "env(safe-area-inset-left, 0px)",
          paddingRight: "env(safe-area-inset-right, 0px)",
        },
  };

  const Shell = preserveBottomNav ? "main" : "div";

  return (
    <Shell {...shellProps}>
      <style jsx>{`
        /* SIDE-BY-SIDE: board column is sized exactly to the board (inline
           width) and centred in the row's full height; the panel is a
           fixed-width band that scrolls and also carries the player rows. */
        .chess-focus-row[data-side="true"] {
          flex-direction: row;
          align-items: stretch;
          justify-content: center;
        }
        .chess-focus-row[data-side="true"] .chess-focus-board-col {
          flex: 0 0 auto;
          min-width: 0;
          align-self: center;
        }
        .chess-focus-row[data-side="true"] .chess-focus-board-slot {
          flex: 0 0 auto;
        }
        .chess-focus-row[data-side="true"] .chess-focus-panel {
          width: clamp(${SIDE_PANEL_MIN}px, 30vw, ${SIDE_PANEL_MAX}px);
          min-height: 0;
          flex: none;
        }
        /* STACKED: header, board, then the panel fills the leftover height
           and scrolls internally — the board's size does NOT depend on it. */
        .chess-focus-row[data-side="false"] {
          flex-direction: column;
        }
        .chess-focus-row[data-side="false"] .chess-focus-board-col {
          flex: 0 0 auto;
          width: 100%;
        }
        .chess-focus-row[data-side="false"] .chess-focus-board-slot {
          flex: 0 0 auto;
        }
        .chess-focus-row[data-side="false"] .chess-focus-panel {
          width: 100%;
          flex: 1 1 0;
          min-height: 0;
        }
        /* The panel's scroll region — takes the leftover height, scrolls
           its own content. Header (when it lives here, in side-by-side)
           stays pinned above it. */
        .chess-focus-panel-scroll {
          flex: 1 1 0;
          min-height: 0;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }
      `}</style>

      {!isSideBySide && header}

      <div
        className="chess-focus-row flex flex-1 min-h-0 w-full gap-2 px-2 pb-1"
        data-side={isSideBySide ? "true" : "false"}
      >
        <div
          className="chess-focus-board-col flex flex-col items-center min-w-0 w-full"
          style={isSideBySide ? { width: boardSize } : undefined}
        >
          {boardMeta && (
            <div ref={metaRef} className="flex-shrink-0 w-full">
              {boardMeta}
            </div>
          )}

          {opponentRow && !isSideBySide && (
            <div ref={stackedOpponentRef} className="flex-shrink-0 w-full px-0.5">
              {opponentRow}
            </div>
          )}

          <div className="chess-focus-board-slot w-full flex items-center justify-center">
            {renderBoard(boardSize)}
          </div>

          {playerRow && !isSideBySide && (
            <div ref={stackedPlayerRef} className="flex-shrink-0 w-full px-0.5">
              {playerRow}
            </div>
          )}
        </div>

        {(sidePanel || isSideBySide) && (
          <div className="chess-focus-panel flex flex-col">
            {isSideBySide && header}
            <div className="chess-focus-panel-scroll flex flex-col gap-2">
              {isSideBySide && opponentRow && (
                <div className="flex-shrink-0 w-full px-0.5">{opponentRow}</div>
              )}
              {isSideBySide && playerRow && (
                <div className="flex-shrink-0 w-full px-0.5">{playerRow}</div>
              )}
              {sidePanel}
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}

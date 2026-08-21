"use client";

import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { FullscreenIcon, CloseIcon } from "@/components/nav/icons";
import { IconButton } from "@/components/ui/Button";
import {
  computeChessFocusBoardSize,
  isChessFocusSideBySide,
  CHESS_FOCUS_SIDE_PANEL_WIDTH,
} from "@/lib/chessFocus/computeBoardSize";
import { setChessFocusActive } from "@/lib/chessFocus/focusMode";
import { getViewportMetrics } from "@/lib/viewport";

const BOARD_COLUMN_GAPS = 12;
const MEASURE_BUFFER = 6;

export type ChessFocusLayoutProps = {
  title: string;
  onExit: () => void;
  opponentRow?: ReactNode;
  playerRow?: ReactNode;
  renderBoard: (boardSize: number) => ReactNode;
  sidePanel?: ReactNode;
  /** Extra content measured as part of board-column chrome (above the board). */
  boardMeta?: ReactNode;
};

/**
 * Reusable full-screen chess focus shell for every interactive board screen.
 * Portrait: full-width board, info/controls below.
 * Landscape: large board left, compact scrollable panel right.
 * Hides PrimaryNav while mounted. Board size from one shared algorithm.
 */
export function ChessFocusLayout({
  title,
  onExit,
  opponentRow,
  playerRow,
  boardMeta,
  renderBoard,
  sidePanel,
}: ChessFocusLayoutProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const metaRef = useRef<HTMLDivElement | null>(null);
  const opponentRowRef = useRef<HTMLDivElement | null>(null);
  const playerRowRef = useRef<HTMLDivElement | null>(null);
  const sidePanelRef = useRef<HTMLDivElement | null>(null);

  const [boardSize, setBoardSize] = useState(480);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);
  const [isCompactLandscape, setIsCompactLandscape] = useState(false);

  useEffect(() => {
    setChessFocusActive(true);
    return () => setChessFocusActive(false);
  }, []);

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
      const metrics = getViewportMetrics();
      const sideBySide = isChessFocusSideBySide(metrics.width, metrics.height);
      setIsCompactLandscape(sideBySide && metrics.height <= 520);

      const shellStyle = shellRef.current ? getComputedStyle(shellRef.current) : null;
      const shellPadV = shellStyle
        ? parseFloat(shellStyle.paddingTop) + parseFloat(shellStyle.paddingBottom)
        : 16;

      const boardColumnChrome =
        (headerRef.current?.offsetHeight ?? 0) +
        (metaRef.current?.offsetHeight ?? 0) +
        (opponentRowRef.current?.offsetHeight ?? 0) +
        (playerRowRef.current?.offsetHeight ?? 0) +
        BOARD_COLUMN_GAPS +
        MEASURE_BUFFER +
        shellPadV;

      const stackedPanelHeight =
        !sideBySide && sidePanelRef.current ? sidePanelRef.current.offsetHeight + 8 : 0;

      const sidePanelWidth = sideBySide
        ? Math.min(CHESS_FOCUS_SIDE_PANEL_WIDTH, Math.max(220, Math.floor(metrics.width * 0.28)))
        : 0;

      const next = computeChessFocusBoardSize({
        viewportWidth: metrics.width,
        viewportHeight: metrics.height,
        boardColumnChromeHeight: isFullscreen ? boardColumnChrome * 0.6 : boardColumnChrome,
        stackedPanelHeight,
        isSideBySide: sideBySide,
        sidePanelWidth,
        horizontalPadding: isFullscreen ? 4 : 8,
        verticalPadding: isFullscreen ? 4 : 8,
      });

      setBoardSize(next);
    }

    recompute();
    const ro = new ResizeObserver(recompute);
    [headerRef, metaRef, opponentRowRef, playerRowRef, sidePanelRef, shellRef].forEach((ref) => {
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
  }, [isFullscreen, sidePanel, opponentRow, playerRow, boardMeta]);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      shellRef.current?.requestFullscreen?.().catch(() => {});
    }
  }

  return (
    <div
      ref={shellRef}
      className="chess-focus-shell fixed inset-0 z-50 bg-premium-midnight flex flex-col overflow-hidden"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        paddingLeft: "env(safe-area-inset-left, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
      }}
    >
      <style jsx>{`
        @media (orientation: landscape) {
          .chess-focus-row {
            flex-direction: row;
            align-items: center;
            justify-content: center;
          }
          .chess-focus-board-col {
            flex: 1 1 auto;
            min-width: 0;
            max-height: 100%;
          }
          .chess-focus-panel {
            width: min(${CHESS_FOCUS_SIDE_PANEL_WIDTH}px, 28vw);
            max-height: calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
            overflow-y: auto;
            flex: none;
          }
        }
        @media (orientation: portrait) {
          .chess-focus-row {
            flex-direction: column;
          }
          .chess-focus-board-col {
            flex: 1 1 auto;
            min-height: 0;
          }
          .chess-focus-panel {
            width: 100%;
            flex: none;
          }
        }
      `}</style>

      <div className="chess-focus-row flex flex-1 min-h-0 w-full gap-2 px-2 py-1">
        <div className="chess-focus-board-col flex flex-col min-w-0 w-full">
          {!isFullscreen && (
            <div ref={headerRef} className="flex-shrink-0 w-full flex items-center justify-between gap-2 py-0.5">
              <button
                onClick={onExit}
                aria-label="Exit"
                className="flex items-center gap-1.5 font-classic-body text-xs text-premium-ivory/55 hover:text-premium-ivory transition-colors rounded min-h-[36px]"
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
                  size={isCompactLandscape ? 28 : 32}
                  onClick={toggleFullscreen}
                >
                  <FullscreenIcon className="w-4 h-4" />
                </IconButton>
              ) : (
                <span className="w-8" aria-hidden="true" />
              )}
            </div>
          )}

          {boardMeta && (
            <div ref={metaRef} className="flex-shrink-0 w-full">
              {boardMeta}
            </div>
          )}

          {opponentRow && (
            <div ref={opponentRowRef} className="flex-shrink-0 w-full px-0.5">
              {opponentRow}
            </div>
          )}

          <div className="flex-1 min-h-0 w-full flex items-center justify-center">
            {renderBoard(boardSize)}
          </div>

          {playerRow && (
            <div ref={playerRowRef} className="flex-shrink-0 w-full px-0.5">
              {playerRow}
            </div>
          )}
        </div>

        {sidePanel && (
          <div ref={sidePanelRef} className="chess-focus-panel flex flex-col gap-2">
            {sidePanel}
          </div>
        )}
      </div>
    </div>
  );
}

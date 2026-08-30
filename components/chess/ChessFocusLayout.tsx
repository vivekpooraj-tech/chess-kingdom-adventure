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

const BOARD_COLUMN_GAPS = 12;
const MEASURE_BUFFER = 6;
/** Side-panel width band — must stay in step with the CSS clamp() below and
 * with the sidePanelWidth passed into computeChessFocusBoardSize. */
const SIDE_PANEL_MIN = CHESS_FOCUS_SIDE_PANEL_WIDTH; // 272
const SIDE_PANEL_MAX = 340;

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
 * Stacked: board first, info/controls directly below it.
 * Side-by-side (>=900px wide, or landscape >=600px): board + a compact
 * scrollable panel, sized as one centred group so there's no dead gap.
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
  const [isSideBySide, setIsSideBySide] = useState(false);

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
      const metrics = readViewport();
      const sideBySide = isChessFocusSideBySide(metrics.width, metrics.height);
      setIsSideBySide(sideBySide);
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
        ? Math.min(SIDE_PANEL_MAX, Math.max(SIDE_PANEL_MIN, Math.floor(metrics.width * 0.24)))
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
        /* Side-by-side (wide screen or roomy landscape): board column is
           sized exactly to the board (inline width), panel is a fixed band,
           and the row centres the pair — no dead gap, no lopsided margins. */
        .chess-focus-row[data-side="true"] {
          flex-direction: row;
          align-items: center;
          justify-content: center;
        }
        .chess-focus-row[data-side="true"] .chess-focus-board-col {
          flex: 0 0 auto;
          min-width: 0;
          max-height: 100%;
        }
        .chess-focus-row[data-side="true"] .chess-focus-board-slot {
          flex: 1 1 auto;
          min-height: 0;
        }
        .chess-focus-row[data-side="true"] .chess-focus-panel {
          width: clamp(${SIDE_PANEL_MIN}px, 24vw, ${SIDE_PANEL_MAX}px);
          max-height: calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
          overflow-y: auto;
          flex: none;
        }
        /* Stacked: board first, controls hug it directly, leftover space
           falls to the bottom of the shell rather than opening a gap
           between the board and its own panel. */
        .chess-focus-row[data-side="false"] {
          flex-direction: column;
        }
        .chess-focus-row[data-side="false"] .chess-focus-board-col {
          flex: 0 1 auto;
          min-height: 0;
          width: 100%;
        }
        .chess-focus-row[data-side="false"] .chess-focus-board-slot {
          flex: 0 0 auto;
        }
        .chess-focus-row[data-side="false"] .chess-focus-panel {
          width: 100%;
          flex: none;
        }
      `}</style>

      <div
        className="chess-focus-row flex flex-1 min-h-0 w-full gap-2 px-2 py-1"
        data-side={isSideBySide ? "true" : "false"}
      >
        <div
          className="chess-focus-board-col flex flex-col min-w-0 w-full"
          style={isSideBySide ? { width: boardSize } : undefined}
        >
          {!isFullscreen && (
            <div ref={headerRef} className="flex-shrink-0 w-full flex items-center justify-between gap-2 py-0.5">
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
                  size={isCompactLandscape ? 32 : 36}
                  onClick={toggleFullscreen}
                >
                  <FullscreenIcon className="w-4 h-4" />
                </IconButton>
              ) : (
                <span className="w-9" aria-hidden="true" />
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

          <div className="chess-focus-board-slot w-full flex items-center justify-center">
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

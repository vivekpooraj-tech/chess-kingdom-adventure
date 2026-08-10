"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { FullscreenIcon, CloseIcon } from "@/components/nav/icons";
import { IconButton } from "@/components/ui/Button";

/**
 * Board-first "Chess Arena" shell for actual gameplay (Free Play, Online
 * Game, Opening Practice) — NOT for lesson/study boards, which keep their
 * own page layouts untouched. Desktop (lg+) puts the board center-left and
 * a side panel (move list, controls, opening badge, etc.) on the right;
 * below `lg` the layout stacks board-first with the side panel content
 * flowing underneath. The caller renders its own `<ChessBoard arenaMode
 * size={useArenaBoardSize(...)} .../>` and passes it in as `board` — this
 * shell only owns the surrounding chrome, not the board itself, so there's
 * still exactly one ChessBoard implementation.
 *
 * No chess clock/timer exists anywhere in this app's data model (verified
 * before building this) — the top/bottom rows show whatever player info
 * the caller has (name, avatar, difficulty/rating badge), not a fabricated
 * clock.
 */
export function GameArenaLayout({
  title,
  onExit,
  opponentRow,
  playerRow,
  board,
  sidePanel,
}: {
  title: string;
  onExit: () => void;
  opponentRow: ReactNode;
  playerRow: ReactNode;
  board: ReactNode;
  sidePanel?: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);

  useEffect(() => {
    setFullscreenSupported(typeof document !== "undefined" && document.fullscreenEnabled === true);
    function onChange() {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      containerRef.current?.requestFullscreen?.().catch(() => {});
    }
  }

  return (
    <div
      ref={containerRef}
      className="arena-shell min-h-screen bg-premium-midnight flex flex-col lg:items-center lg:justify-center px-3 sm:px-4 py-3 lg:py-6"
    >
      {/* Short landscape phones (e.g. a phone rotated sideways) are wide
          enough for a side-by-side layout but land under the `lg` width
          breakpoint, so the default Tailwind `lg:` classes below never
          kick in for them — without this, the board would get stuck
          height-capped in the narrow stacked mobile layout with a lot of
          unused width to its right (caught during Phase 15 breakpoint
          verification). This mirrors the same real-media-query pattern
          ChessBoard.tsx already uses for its own mobile breakout, since
          Tailwind's `lg:` prefix is width-only and has no orientation
          variant. */}
      <style jsx>{`
        @media (orientation: landscape) and (max-height: 500px) {
          .arena-shell {
            align-items: center;
            justify-content: center;
          }
          .arena-row {
            flex-direction: row !important;
            align-items: center !important;
            gap: 1.5rem !important;
          }
          .arena-side-panel {
            width: 240px !important;
            flex: none !important;
          }
        }
      `}</style>
      {/* No outer max-width: useArenaBoardSize already clamps the board
          itself (MAX_SIZE) and reserves fixed space for the side panel, so
          an additional cap here would only fight that math — and did, at
          very large viewports, capping the board well below its intended
          size (caught during Phase 15 breakpoint verification). */}
      <div className="arena-row w-full flex flex-col lg:flex-row gap-4 lg:gap-8 lg:items-center lg:justify-center">
        {/* Board column */}
        <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
          <div className="w-full flex items-center justify-between gap-2">
            <button
              onClick={onExit}
              aria-label="Exit game"
              className="flex items-center gap-1.5 font-classic-body text-xs text-premium-ivory/50 hover:text-premium-ivory transition-colors"
            >
              <CloseIcon className="w-4 h-4" /> Exit
            </button>
            <h1 className="font-classic-display text-sm sm:text-base text-premium-ivory/80 truncate">
              {title}
            </h1>
            {fullscreenSupported ? (
              <IconButton
                label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                tone="premium"
                size={32}
                onClick={toggleFullscreen}
              >
                <FullscreenIcon className="w-4 h-4" />
              </IconButton>
            ) : (
              <span className="w-8" aria-hidden="true" />
            )}
          </div>

          <div className="w-full flex items-center">{opponentRow}</div>

          <div className="w-full flex items-center justify-center">{board}</div>

          <div className="w-full flex items-center">{playerRow}</div>
        </div>

        {/* Side panel — desktop + short landscape: fixed-width right
            column; mobile/tablet portrait: stacks below the board. */}
        {sidePanel && (
          <div className="arena-side-panel w-full lg:w-[320px] lg:flex-none flex flex-col gap-3">
            {sidePanel}
          </div>
        )}
      </div>
    </div>
  );
}

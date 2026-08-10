"use client";

import { ReactNode, useLayoutEffect, useRef, useState } from "react";
import { FullscreenIcon, CloseIcon } from "@/components/nav/icons";
import { IconButton } from "@/components/ui/Button";
import { useArenaBoardSize } from "@/lib/hooks/useArenaBoardSize";

// Vertical gaps between the 4 stacked rows (header/opponent/board/player,
// each separated by gap-2 = 8px -> 3 gaps) — the shell's own padding is
// measured for real below (getComputedStyle), not hardcoded here, since it
// genuinely differs between the base py-3 (mobile/landscape) and lg:py-6
// (desktop) — an earlier fixed guess reserved the larger desktop padding
// even in landscape mode, wasting real board space that Phase 16's
// "no scroll in landscape" requirement needed back. +8px safety buffer for
// sub-pixel row-height rounding (row heights come back as e.g. 19.2px,
// which doesn't perfectly cancel through Math.floor()).
const FIXED_GAPS = 24;
const ROUNDING_BUFFER = 8;
// Short landscape phones get noticeably tighter on vertical room than any
// portrait breakpoint — shrinks the header's icon button and hides the
// (purely decorative) title text to reclaim a few more px for the board,
// per section 8's "shrink decorative elements before shrinking the board."
const LANDSCAPE_QUERY = "(orientation: landscape) and (max-height: 500px)";

/**
 * Board-first "Chess Arena" shell for actual gameplay (Free Play, Online
 * Game) — NOT for lesson/study boards, which keep their own page layouts
 * untouched. Desktop (lg+, or short landscape) puts the board center-left
 * and a side panel (move list, controls, opening badge, etc.) on the
 * right; otherwise the layout stacks board-first with the side panel
 * flowing underneath.
 *
 * `renderBoard` is a render-prop rather than a plain ReactNode: this shell
 * measures its own header/opponent/player row heights via ResizeObserver
 * (Phase 16 — replaces Phase 15's hand-guessed reservedHeight constants
 * with the real rendered chrome height) and only then knows how much
 * vertical space is actually left for the board, so the caller's
 * <ChessBoard size={...} arenaMode .../> has to be constructed *after*
 * that measurement, not before. Still exactly one ChessBoard
 * implementation — this shell never renders board content itself, it just
 * decides what size to hand the caller's own board element.
 *
 * No chess clock/timer exists anywhere in this app's data model (verified
 * before building this) — the top/bottom rows show whatever player info
 * the caller has (name, avatar, difficulty/rating badge), not a
 * fabricated clock.
 */
export function GameArenaLayout({
  title,
  onExit,
  opponentRow,
  playerRow,
  renderBoard,
  sidePanel,
}: {
  title: string;
  onExit: () => void;
  opponentRow: ReactNode;
  playerRow: ReactNode;
  renderBoard: (boardSize: number) => ReactNode;
  sidePanel?: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const opponentRowRef = useRef<HTMLDivElement | null>(null);
  const playerRowRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);
  const [isCompactLandscape, setIsCompactLandscape] = useState(false);
  // Sane fallback for the very first paint before ResizeObserver's first
  // callback fires (effectively instant, but React still needs an initial
  // value) — not a guess used for real sizing, just a one-frame default.
  const [chromeHeight, setChromeHeight] = useState(160);

  useLayoutEffect(() => {
    const mql = window.matchMedia(LANDSCAPE_QUERY);
    setIsCompactLandscape(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setIsCompactLandscape(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  useLayoutEffect(() => {
    function measure() {
      const style = containerRef.current ? getComputedStyle(containerRef.current) : null;
      const paddingV = style
        ? parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
        : 48;
      const h =
        (headerRef.current?.offsetHeight ?? 0) +
        (opponentRowRef.current?.offsetHeight ?? 0) +
        (playerRowRef.current?.offsetHeight ?? 0) +
        FIXED_GAPS +
        paddingV +
        ROUNDING_BUFFER;
      setChromeHeight(h);
    }
    measure();
    const ro = new ResizeObserver(measure);
    if (headerRef.current) ro.observe(headerRef.current);
    if (opponentRowRef.current) ro.observe(opponentRowRef.current);
    if (playerRowRef.current) ro.observe(playerRowRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [isCompactLandscape]);

  const boardSize = useArenaBoardSize(chromeHeight);

  useLayoutEffect(() => {
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
          <div ref={headerRef} className="w-full flex items-center justify-between gap-2">
            <button
              onClick={onExit}
              aria-label="Exit game"
              className="flex items-center gap-1.5 font-classic-body text-xs text-premium-ivory/50 hover:text-premium-ivory transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/60 rounded"
            >
              <CloseIcon className="w-4 h-4" /> Exit
            </button>
            {!isCompactLandscape && (
              <h1 className="font-classic-display text-sm sm:text-base text-premium-ivory/80 truncate">
                {title}
              </h1>
            )}
            {fullscreenSupported ? (
              <IconButton
                label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                tone="premium"
                size={isCompactLandscape ? 24 : 32}
                onClick={toggleFullscreen}
              >
                <FullscreenIcon className={isCompactLandscape ? "w-3 h-3" : "w-4 h-4"} />
              </IconButton>
            ) : (
              <span className={isCompactLandscape ? "w-6" : "w-8"} aria-hidden="true" />
            )}
          </div>

          <div ref={opponentRowRef} className="w-full flex items-center">
            {opponentRow}
          </div>

          <div className="w-full flex items-center justify-center">{renderBoard(boardSize)}</div>

          <div ref={playerRowRef} className="w-full flex items-center">
            {playerRow}
          </div>
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

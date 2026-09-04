"use client";

import { useEffect, useLayoutEffect, useMemo, useState, useCallback, useRef } from "react";
import { Chess, Square, PieceSymbol, Color } from "chess.js";
import clsx from "clsx";
import { stockfish, Difficulty } from "@/lib/chess-engine/stockfishEngine";
import { getBoardSkin } from "@/content/boardSkins";
import { getPieceSet } from "@/content/pieceSets";
import { PieceImage } from "@/components/board/PieceImage";
import type { PieceSetOption } from "@/lib/types";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

// Fraction of an image-backed board (skin.boardImageUrl) that's frame
// margin on each side, e.g. wood-classic.svg's 36px frame out of a 792px
// square canvas. Every image-backed skin must use this same proportion so
// the transparent interactive grid lines up with the image's drawn squares.
const BOARD_IMAGE_FRAME_FRACTION = 36 / 792;
// Piece-slide animation. Purely cosmetic: the chess.js `game` instance is
// always the single source of truth and the board always renders the
// CURRENT position — the slide is a `pointer-events-none` overlay layered
// on top. If the animation is interrupted, never starts, or its cleanup
// races, the only visible effect is that a piece "snaps" instead of
// gliding; input, move legality and game state are never affected.
// Chess.com-style glide — long enough to read, short enough to stay snappy.
const MOVE_ANIMATION_MS = 280;
const MOVE_EASING = "cubic-bezier(0.25, 0.1, 0.25, 1)";
// Hard ceiling after which a slide is force-cleared even if no
// `transitionend` ever arrives (reduced-motion, backgrounded tab, a
// same-row/col move that only transitions one property, etc).
const MOVE_ANIMATION_TIMEOUT_MS = MOVE_ANIMATION_MS + 150;
const DEFAULT_GAME_OVER_PAUSE_MS = 1400;

export interface ChessBoardProps {
  /** Starting position; defaults to the standard game start. */
  fen?: string;
  /** Restrict which side the child is allowed to move (useful for puzzles). */
  playableColor?: Color;
  /** Called after every legal move the child makes. */
  onMove?: (opts: {
    fen: string;
    san: string;
    isCheckmate: boolean;
    piece: PieceSymbol;
    from: Square;
    to: Square;
  }) => void;
  /** Called when the child attempts an illegal move — used for AI mistake-explanations. */
  onIllegalAttempt?: (from: Square, to: Square) => void;
  /**
   * Called once, the moment the game ends — after EITHER side's move,
   * unlike onMove which only fires for the child's own moves. Needed for a
   * full game (Free Play Arena) where the opponent's move can also end the
   * game (e.g. Stockfish delivers checkmate).
   */
  onGameOver?: (result: { isCheckmate: boolean; isDraw: boolean; winner: Color | null }) => void;
  /**
   * Fires after every ply — both the child's moves and the opponent's —
   * with the current game state. For chrome around the board (move list,
   * captured pieces) that needs to stay in sync without keeping its own
   * separate Chess instance. `capturedByWhite`/`capturedByBlack` assume a
   * standard starting position; callers passing a custom `fen` (puzzles,
   * lessons) should ignore that part since "captured relative to a
   * non-standard start" isn't a meaningful concept.
   */
  onPositionChange?: (opts: {
    fen: string;
    history: string[];
    turn: Color;
    isCheck: boolean;
    capturedByWhite: PieceSymbol[];
    capturedByBlack: PieceSymbol[];
  }) => void;
  /**
   * Auto-opponent for the non-playable side. The board enforces real chess
   * turn order, so without *something* replying, a `playableColor` board
   * only ever allows one move before silently refusing further input.
   * - "stockfish": a real, deliberately weakened Stockfish engine (Skill
   *   Level 0 + shallow search) — genuinely beatable, occasionally blunders,
   *   appropriate for a beginner.
   * - "random": picks any legal move at random. Used as an automatic
   *   fallback if the Stockfish worker fails to load (e.g. offline), and
   *   still available directly for callers that don't need real strength.
   */
  opponent?: "stockfish" | "random";
  /**
   * Engine strength when opponent="stockfish" — defaults to "easy" (the
   * same weak, sometimes-blundering play used throughout the lesson
   * content), so existing lesson-page boards keep working unchanged. The
   * Free Play Arena passes the player's chosen tier explicitly.
   */
  difficulty?: Difficulty;
  /** Visual size in px (square board). */
  size?: number;
  /** References an id in content/boardSkins.ts; defaults to Classic Forest
   * (today's original hardcoded colors) when omitted or unrecognized. */
  boardSkinId?: string;
  /** References an id in content/pieceSets.ts; defaults to the original
   * flat-silhouette set when omitted or unrecognized. Independent of
   * boardSkinId — any piece set can pair with any board skin. */
  pieceSetId?: string;
  /**
   * Pure display mode — clicks don't select or move pieces, and the
   * auto-opponent never runs. For showing a position (e.g. stepping
   * through an opening's move sequence in the Academy) without letting the
   * viewer accidentally change it. The caller drives what's shown by
   * changing `fen`; this component never mutates state on its own.
   */
  readOnly?: boolean;
  /**
   * Optional historical position to display while keeping this board's live
   * game instance intact. This lets an arena player review earlier moves and
   * return to the current game without resetting its move history.
   */
  displayFen?: string;
  /**
   * Phase 15 — raises the board's internal viewport-height ceiling from
   * 75vh to 90vh for actual gameplay screens (Free Play, Online Game,
   * Opening Practice) via useArenaBoardSize, which already pass a much
   * larger `size`. Every other call site (lessons, Academy, Chess Mind,
   * onboarding, the customize preview) omits this and keeps the exact
   * existing 75vh behavior — this is purely additive, opt-in per call
   * site, not a change to the default.
   */
  arenaMode?: boolean;
  /**
   * Chess Focus Mode — parent (ChessFocusLayout) owns sizing entirely.
   * No vh caps or padding breakout; board is exactly min(size, 100%).
   */
  focusMode?: boolean;
  /** Milliseconds to linger on the final position before `onGameOver`. */
  gameOverPauseMs?: number;
}

/**
 * Click-to-select-then-move interaction (tap piece -> tap destination).
 * Chosen over full drag-and-drop for the v1 slice: it's far more reliable on
 * touch devices for small hands than precise drag targeting, and is easier to
 * make accessible (keyboard/switch-control friendly later). React DnD can be
 * layered on top later as an alternate input mode if desired.
 */
const STANDARD_PIECE_COUNTS: Record<PieceSymbol, number> = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };

/** Pieces missing from each side relative to a standard start — i.e. what
 * the other side has captured. Meaningless for a non-standard `fen`. */
function computeCaptured(game: Chess): {
  capturedByWhite: PieceSymbol[];
  capturedByBlack: PieceSymbol[];
} {
  const present: Record<Color, Record<PieceSymbol, number>> = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
  };
  for (const row of game.board()) {
    for (const sq of row) {
      if (sq) present[sq.color][sq.type]++;
    }
  }
  const missing = (color: Color): PieceSymbol[] => {
    const out: PieceSymbol[] = [];
    (Object.keys(STANDARD_PIECE_COUNTS) as PieceSymbol[]).forEach((type) => {
      const count = STANDARD_PIECE_COUNTS[type] - present[color][type];
      for (let i = 0; i < count; i++) out.push(type);
    });
    return out;
  };
  return { capturedByWhite: missing("b"), capturedByBlack: missing("w") };
}

/**
 * A single in-flight slide. `seq` is a monotonic id: every timer/RAF/
 * transitionend callback captures the `seq` it was created for and no-ops
 * unless it's still the current one, so a stale callback from a superseded
 * move can never clear or corrupt a newer slide's state.
 */
type MoveAnim = {
  seq: number;
  from: Square;
  to: Square;
  piece: PieceSymbol;
  color: Color;
  /** Position before this ply — drawn while the slide runs. */
  fenBefore: string;
};

function squareGridIndex(
  square: Square,
  ranks: readonly string[],
  files: readonly string[]
): { col: number; row: number } {
  return { col: files.indexOf(square[0]), row: ranks.indexOf(square[1]) };
}

/**
 * Imperative slide — CSS `transform` transitions do not reliably interpolate
 * when the value uses custom properties (`var(--dx)`), which was causing
 * pieces to snap instead of glide. This overlay always starts at the origin
 * square, then transitions to explicit `translate3d(N%, N%, 0)` values.
 */
function MoveSlideOverlay({
  from,
  to,
  piece,
  color,
  pieceSet,
  onComplete,
}: {
  from: { col: number; row: number };
  to: { col: number; row: number };
  piece: PieceSymbol;
  color: Color;
  pieceSet: PieceSetOption;
  onComplete: () => void;
}) {
  const slideRef = useRef<HTMLDivElement>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useLayoutEffect(() => {
    const el = slideRef.current;
    if (!el) return;

    const dx = (to.col - from.col) * 100;
    const dy = (to.row - from.row) * 100;

    el.style.transition = "none";
    el.style.transform = "translate3d(0, 0, 0)";
    // Force the browser to commit the origin transform before animating.
    void el.offsetWidth;

    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        el.style.transition = `transform ${MOVE_ANIMATION_MS}ms ${MOVE_EASING}`;
        el.style.transform = `translate3d(${dx}%, ${dy}%, 0)`;
      });
    });

    const finish = () => onCompleteRef.current();
    const handleEnd = (e: TransitionEvent) => {
      if (e.propertyName === "transform") finish();
    };
    el.addEventListener("transitionend", handleEnd);
    const timeout = setTimeout(finish, MOVE_ANIMATION_TIMEOUT_MS);

    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
      el.removeEventListener("transitionend", handleEnd);
      clearTimeout(timeout);
    };
  }, [from.col, from.row, to.col, to.row]);

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      <div
        ref={slideRef}
        className="piece-move-slide absolute motion-reduce:!transition-none"
        style={{
          width: "12.5%",
          height: "12.5%",
          left: `${from.col * 12.5}%`,
          top: `${from.row * 12.5}%`,
        }}
      >
        <PieceImage set={pieceSet} piece={piece} color={color} />
      </div>
    </div>
  );
}

export function ChessBoard({
  fen,
  playableColor,
  onMove,
  onIllegalAttempt,
  onGameOver,
  onPositionChange,
  opponent,
  difficulty = "easy",
  size = 480,
  boardSkinId,
  pieceSetId,
  readOnly = false,
  displayFen,
  arenaMode = false,
  focusMode = false,
  gameOverPauseMs = DEFAULT_GAME_OVER_PAUSE_MS,
}: ChessBoardProps) {
  const game = useMemo(() => new Chess(fen), [fen]);
  const skin = useMemo(() => getBoardSkin(boardSkinId), [boardSkinId]);
  const pieceSet = useMemo(() => getPieceSet(pieceSetId), [pieceSetId]);
  const [renderTick, forceRender] = useState(0);
  // Purely-visual slide overlay. NEVER gates input or move legality.
  const [anim, setAnim] = useState<MoveAnim | null>(null);
  const animSeqRef = useRef(0);
  const gameOverFiredRef = useRef(false);

  // While a slide is running, draw the pre-move position so the piece can
  // visibly leave its origin square instead of snapping to the destination.
  const displayGame = useMemo(() => {
    if (displayFen) return new Chess(displayFen);
    if (anim?.fenBefore) return new Chess(anim.fenBefore);
    return game;
  }, [displayFen, game, anim, renderTick]);
  const [selected, setSelected] = useState<Square | null>(null);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [engineThinking, setEngineThinking] = useState(false);

  /** Drop the slide if (and only if) `seq` is still the current one. Safe
   * to call from any stale timer / transitionend / RAF callback — a
   * superseded seq is a no-op. Clearing `anim` re-runs the driver effect
   * below, which resets `animAtDestination`. Purely visual: the move it
   * animated was already applied to `game` and reported via `onMove` when
   * it happened. */
  const clearAnim = useCallback((seq: number) => {
    setAnim((cur) => (cur && cur.seq === seq ? null : cur));
    forceRender((n) => n + 1);
  }, []);

  // A live square selection belongs to the current position, never to a
  // historical one being reviewed.
  useEffect(() => {
    if (displayFen) setSelected(null);
  }, [displayFen]);

  // A new position (new game, online opponent move, puzzle step, review
  // navigation) makes any in-flight slide stale — drop it immediately so
  // it can never linger against a position it doesn't belong to.
  useEffect(() => {
    setAnim(null);
  }, [fen, displayFen]);

  useEffect(() => {
    gameOverFiredRef.current = false;
  }, [fen]);

  const applyMove = useCallback(
    (
      from: Square,
      to: Square,
      opts?: { promotion?: string; notifyPlayerMove?: boolean }
    ) => {
      // chess.js throws on an illegal move rather than returning null.
      // A rejected move must never touch selection, animation or timers.
      let result;
      const fenBefore = game.fen();
      try {
        result = game.move({
          from,
          to,
          promotion: (opts?.promotion ?? "q") as "q",
        });
      } catch {
        return null;
      }
      if (!result) return null;

      setSelected(null);
      setLastMove({ from: result.from as Square, to: result.to as Square });

      if (!readOnly && !displayFen) {
        const seq = ++animSeqRef.current;
        setAnim({
          seq,
          from: result.from as Square,
          to: result.to as Square,
          piece: (result.promotion ?? result.piece) as PieceSymbol,
          color: result.color,
          fenBefore,
        });
      }

      // Re-render after `anim` is queued so the first painted frame shows
      // `fenBefore` with the sliding overlay — not the post-move position.
      forceRender((n) => n + 1);
      if (opts?.notifyPlayerMove) {
        onMove?.({
          fen: game.fen(),
          san: result.san,
          isCheckmate: game.isCheckmate(),
          piece: result.piece,
          from: result.from as Square,
          to: result.to as Square,
        });
      }

      return result;
    },
    [game, readOnly, displayFen, onMove]
  );

  // Fires exactly once, after either side's move ends the game — covers
  // the case onMove doesn't (the opponent delivering checkmate/stalemate).
  // `gameOverFiredRef` is only set from inside the timer, so if this effect
  // re-runs before the pause elapses the timer is simply rescheduled — the
  // callback is never lost. Independent of the slide animation.
  useEffect(() => {
    if (anim) return;
    if (gameOverFiredRef.current) return;
    if (!onGameOver) return;
    if (!game.isGameOver()) return;
    const isCheckmate = game.isCheckmate();
    const isDraw = game.isDraw();
    const winner: Color | null = isCheckmate ? (game.turn() === "w" ? "b" : "w") : null;
    const result = { isCheckmate, isDraw, winner };
    const timer = setTimeout(() => {
      gameOverFiredRef.current = true;
      onGameOver(result);
    }, gameOverPauseMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderTick, fen, gameOverPauseMs, anim]);

  useEffect(() => {
    if (!onPositionChange) return;
    const { capturedByWhite, capturedByBlack } = computeCaptured(game);
    onPositionChange({
      fen: game.fen(),
      history: game.history(),
      turn: game.turn(),
      isCheck: game.isCheck(),
      capturedByWhite,
      capturedByBlack,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderTick, fen]);

  function playRandomMove() {
    const moves = game.moves({ verbose: true });
    if (moves.length === 0) return;
    const pick = moves[Math.floor(Math.random() * moves.length)];
    applyMove(pick.from as Square, pick.to as Square);
  }

  // Auto-opponent — see the `opponent` doc comment above. Deliberately NOT
  // gated on the slide animation: the opponent replies on the real game
  // state; its own move then animates like any other.
  useEffect(() => {
    if (readOnly) return;
    if (!opponent || !playableColor) return;
    if (game.isGameOver()) return;
    if (game.turn() === playableColor) return; // still the child's turn — nothing to do

    let cancelled = false;

    const timer = setTimeout(async () => {
      if (opponent === "stockfish") {
        setEngineThinking(true);
        try {
          // "very-easy" picks deliberately weaker moves via its own
          // candidate-selection strategy (see getBeginnerMove's doc
          // comment) rather than just searching at Easy's depth — every
          // other difficulty is unaffected, still going through
          // getBestMove exactly as before.
          const { move: uciMove } =
            difficulty === "very-easy"
              ? await stockfish.getBeginnerMove(game.fen())
              : await stockfish.getBestMove(game.fen(), difficulty);
          if (cancelled) return;
          const from = uciMove.slice(0, 2) as Square;
          const to = uciMove.slice(2, 4) as Square;
          const promotion = uciMove.length > 4 ? uciMove[4] : undefined;
          // If the engine's move doesn't apply (position drifted while it
          // was thinking), applyMove returns null — fall back to a random
          // legal move so the game can never stall on the opponent's turn.
          if (!applyMove(from, to, { promotion }) && !cancelled) playRandomMove();
        } catch {
          // Engine failed to load (e.g. offline, worker blocked) — fall
          // back to a random legal move so the board never gets stuck.
          if (!cancelled) playRandomMove();
        } finally {
          if (!cancelled) setEngineThinking(false);
        }
      } else {
        playRandomMove();
      }
    }, 400); // brief beat after the slide lands, then the opponent replies

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderTick, opponent, playableColor, game]);

  const legalTargets = useMemo(() => {
    if (!selected) return new Set<Square>();
    const moves = game.moves({ square: selected, verbose: true });
    return new Set(moves.map((m) => m.to as Square));
  }, [selected, game]);

  // Presentation only — chess.js's own isCheck()/turn() decide whether and
  // whose king to highlight, no separate check-detection logic. `renderTick`
  // is a deliberate dependency: `displayGame` is the same mutated instance
  // across moves in a live game, so recompute has to be pinned to the tick.
  const checkedKingSquare = useMemo(() => {
    if (!displayGame.isCheck()) return null;
    const mover = displayGame.turn();
    for (const row of displayGame.board()) {
      for (const cell of row) {
        if (cell && cell.type === "k" && cell.color === mover) return cell.square as Square;
      }
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayGame, renderTick]);


  const handleSquareClick = useCallback(
    (square: Square) => {
      // Input is NEVER gated on the slide animation — see MoveAnim.
      if (readOnly) return;
      const piece = game.get(square);

      // Selecting a piece
      if (!selected) {
        if (piece && (!playableColor || piece.color === playableColor)) {
          setSelected(square);
        }
        return;
      }

      // Clicking the same square again = deselect
      if (square === selected) {
        setSelected(null);
        return;
      }

      // Attempting a move
      if (legalTargets.has(square)) {
        applyMove(selected, square, { notifyPlayerMove: true });
      } else if (piece && (!playableColor || piece.color === playableColor)) {
        // Re-select a different one of your own pieces
        setSelected(square);
      } else {
        onIllegalAttempt?.(selected, square);
        setSelected(null);
      }
    },
    [selected, legalTargets, game, playableColor, onIllegalAttempt, readOnly, applyMove]
  );

  // Image-backed skins (skin.boardImageUrl) draw their own frame/coordinate
  // labels baked into the image, so the interactive grid has to shrink and
  // inset to land exactly on the image's drawn squares instead of filling
  // the full board. Expressed as percentages (not size * fraction px) so it
  // stays correct at whatever pixel size the responsive outer box actually
  // renders at, not just the literal `size` prop.
  const framePercent = skin.boardImageUrl ? BOARD_IMAGE_FRAME_FRACTION * 100 : 0;
  const gridPercent = 100 - framePercent * 2;

  // Flip the board for Black so that player's own pieces render at the
  // bottom, matching how a real chess board looks from either side — this
  // matters for online multiplayer, where one player is genuinely Black.
  const displayRanks = playableColor === "b" ? [...RANKS].reverse() : RANKS;
  const displayFiles = playableColor === "b" ? [...FILES].reverse() : FILES;
  // Slide overlay geometry. Only shown when NOT reviewing a historical
  // position (a stale slide against `displayFen` would be nonsense).
  const animActive = anim != null && !displayFen;
  const animFrom = animActive ? squareGridIndex(anim!.from, displayRanks, displayFiles) : null;
  const animTo = animActive ? squareGridIndex(anim!.to, displayRanks, displayFiles) : null;

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      {/*
        Mobile breakout: below the sm breakpoint, the board expands past its
        immediate parent's padding to use the full available width instead
        of sitting inset — meant for a native app wrapper (APK/TWA) where the
        board should read as edge-to-edge like most chess apps, not just a
        bigger fixed size. Assumes a 1.5rem (px-6/p-6) parent padding, which
        every current call site (page `<main>` and `<Card>`) uses — the
        negative margin exactly cancels it out. A real @media query (via
        styled-jsx) rather than a Tailwind breakpoint class, since inline
        `style.width` below would otherwise always win over any class for
        the same property regardless of viewport size.
      */}
      <style jsx>{`
        .board-outer {
          width: ${focusMode ? `min(${size}px, 100%)` : `min(${size}px, 100%, ${arenaMode ? "96dvh" : "85dvh"})`};
        }
        ${focusMode
          ? ""
          : `@media (max-width: 1023px) {
          .board-outer {
            width: min(calc(100% + 3rem), ${arenaMode ? "96dvh" : "88dvh"});
            margin-left: -1.5rem;
            margin-right: -1.5rem;
          }
        }
        @media (orientation: landscape) and (min-width: 600px) {
          .board-outer {
            width: min(${size}px, 100%, 98dvh);
            margin-left: 0;
            margin-right: 0;
          }
        }`}
      `}</style>
      <div
        className="board-outer relative rounded-card overflow-hidden shadow-premiumCard ring-1 ring-premium-gold/10 select-none mx-auto"
        style={{
          aspectRatio: "1 / 1",
          ...(skin.frameColor && !skin.boardImageUrl
            ? { backgroundColor: skin.frameColor, padding: "3%", boxSizing: "border-box" }
            : {}),
        }}
    >
      {skin.boardImageUrl && (
        <img
          src={skin.boardImageUrl}
          alt=""
          className="absolute inset-0 w-full h-full"
          draggable={false}
        />
      )}
      <div
        className="grid grid-cols-8 grid-rows-8 overflow-visible"
        style={
          skin.boardImageUrl
            ? {
                position: "absolute",
                left: `${framePercent}%`,
                top: `${framePercent}%`,
                width: `${gridPercent}%`,
                height: `${gridPercent}%`,
              }
            : { width: "100%", height: "100%" }
        }
      >
        {displayRanks.map((rank, rIdx) =>
          displayFiles.map((file, fIdx) => {
            const square = `${file}${rank}` as Square;
            const piece = displayGame.get(square);
            const isDark = (rIdx + fIdx) % 2 === 1;
            const isSelected = selected === square;
            const isLegalTarget = legalTargets.has(square);
            const isLastMove = !displayFen && lastMove && (lastMove.from === square || lastMove.to === square);
            const isCheckedKing = checkedKingSquare === square;
            // While a piece is sliding IN to `to`, suppress the real piece
            // there so there's never a double image. If the slide is
            // cleared early for any reason the real piece simply appears —
            // the board state was already correct underneath.
            const hideForSlide = animActive && anim!.from === square;
            const captureFade =
              animActive &&
              anim!.to === square &&
              piece != null &&
              piece.color !== anim!.color;
            // Inline style always wins over a Tailwind class, so the
            // last-move highlight has to be folded into this same value
            // rather than layered on via a separate "bg-kingdom-gold/30"
            // class (which the skin's inline backgroundColor would hide).
            // Image-backed skins stay transparent otherwise, letting the
            // image show through.
            const squareBackground =
              isLastMove && !isSelected
                ? "rgba(205, 210, 106, 0.5)"
                : skin.boardImageUrl
                ? "transparent"
                : isDark
                ? skin.darkSquare
                : skin.lightSquare;

            // Chess.com-style in-square coordinate labels — bottom-left
            // corner of the bottom displayed row gets file letters, top-left
            // corner of the left displayed column gets rank numbers. Uses
            // the loop index (not the literal rank/file) so it stays correct
            // when the board is flipped for Black. Image-backed skins
            // already bake their own labels into the image.
            const showFileLabel = !skin.boardImageUrl && rIdx === 7;
            const showRankLabel = !skin.boardImageUrl && fIdx === 0;
            const labelColorClass = skin.coordinateColor
              ? undefined
              : isDark
              ? "text-white/80"
              : "text-kingdom-night/50";
            const labelColorStyle = skin.coordinateColor ? { color: skin.coordinateColor } : undefined;

            return (
              <button
                key={square}
                onClick={() => handleSquareClick(square)}
                className={clsx(
                  "relative flex items-center justify-center transition-colors w-full h-full overflow-visible",
                  isSelected && "ring-4 ring-inset ring-kingdom-gold",
                  isCheckedKing && !isSelected && "ring-4 ring-inset ring-red-500/80"
                )}
                style={{
                  backgroundColor: isCheckedKing
                    ? "rgba(239, 68, 68, 0.35)"
                    : squareBackground,
                }}
                aria-label={`${square}${piece ? ` — ${piece.color === "w" ? "white" : "black"} ${piece.type}` : ""}${isCheckedKing ? " — in check" : ""}`}
              >
                {isLegalTarget && !piece && (
                  <span className="absolute w-1/3 h-1/3 rounded-full bg-kingdom-gold/70" />
                )}
                {isLegalTarget && piece && (
                  <span className="absolute inset-1 rounded-full ring-4 ring-kingdom-coral/70" />
                )}
                {showFileLabel && (
                  <span
                    className={clsx(
                      "absolute bottom-0.5 left-1 font-body text-[10px] sm:text-xs font-bold leading-none pointer-events-none",
                      labelColorClass
                    )}
                    style={labelColorStyle}
                  >
                    {file}
                  </span>
                )}
                {showRankLabel && (
                  <span
                    className={clsx(
                      "absolute top-0.5 left-1 font-body text-[10px] sm:text-xs font-bold leading-none pointer-events-none",
                      labelColorClass
                    )}
                    style={labelColorStyle}
                  >
                    {rank}
                  </span>
                )}
                {piece && !hideForSlide && (
                  <div
                    className={clsx(
                      "piece-on-board absolute inset-0 pointer-events-none",
                      captureFade && "piece-capture-fade"
                    )}
                  >
                    <PieceImage set={pieceSet} piece={piece.type} color={piece.color} />
                  </div>
                )}
              </button>
            );
          })
        )}
        {animActive && animFrom && animTo && (
          <MoveSlideOverlay
            from={animFrom}
            to={animTo}
            piece={anim!.piece}
            color={anim!.color}
            pieceSet={pieceSet}
            onComplete={() => clearAnim(anim!.seq)}
          />
        )}
      </div>
      </div>
      <p
        className={clsx(
          "font-body text-sm italic text-center min-h-[1.25rem]",
          engineThinking ? "text-kingdom-night/50" : "invisible"
        )}
        aria-live="polite"
      >
        Ollie is thinking...
      </p>
    </div>
  );
}

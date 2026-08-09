"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Chess, Square, PieceSymbol, Color } from "chess.js";
import clsx from "clsx";
import { motion, AnimatePresence } from "framer-motion";
import { stockfish, Difficulty } from "@/lib/chess-engine/stockfishEngine";
import { getBoardSkin } from "@/content/boardSkins";
import { getPieceSet } from "@/content/pieceSets";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

// Fraction of an image-backed board (skin.boardImageUrl) that's frame
// margin on each side, e.g. wood-classic.svg's 36px frame out of a 792px
// square canvas. Every image-backed skin must use this same proportion so
// the transparent interactive grid lines up with the image's drawn squares.
const BOARD_IMAGE_FRAME_FRACTION = 36 / 792;

// Maps chess.js's piece/color codes to the uploaded character asset pack's
// file names — public/pieces/{light,dark}/{name}.svg.
const PIECE_FILE_NAME: Record<PieceSymbol, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};

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
}: ChessBoardProps) {
  const game = useMemo(() => new Chess(fen), [fen]);
  const skin = useMemo(() => getBoardSkin(boardSkinId), [boardSkinId]);
  const pieceSet = useMemo(() => getPieceSet(pieceSetId), [pieceSetId]);
  const [renderTick, forceRender] = useState(0);
  const [selected, setSelected] = useState<Square | null>(null);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [engineThinking, setEngineThinking] = useState(false);
  const gameOverReportedRef = useRef(false);

  useEffect(() => {
    gameOverReportedRef.current = false;
  }, [fen]);

  // Fires once, right after either side's move ends the game — covers the
  // case onMove doesn't (the opponent delivering checkmate/stalemate).
  useEffect(() => {
    if (gameOverReportedRef.current) return;
    if (!game.isGameOver()) return;
    gameOverReportedRef.current = true;
    const isCheckmate = game.isCheckmate();
    const isDraw = game.isDraw();
    // The side whose turn it WOULD be is the side that got checkmated.
    const winner: Color | null = isCheckmate ? (game.turn() === "w" ? "b" : "w") : null;
    onGameOver?.({ isCheckmate, isDraw, winner });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderTick, fen]);

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
    const result = game.move({ from: pick.from, to: pick.to, promotion: "q" });
    if (result) {
      setLastMove({ from: pick.from as Square, to: pick.to as Square });
      forceRender((n) => n + 1);
    }
  }

  // Auto-opponent — see the `opponent` doc comment above.
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
          const { move: uciMove } = await stockfish.getBestMove(game.fen(), difficulty);
          if (cancelled) return;
          const from = uciMove.slice(0, 2) as Square;
          const to = uciMove.slice(2, 4) as Square;
          const promotion = uciMove.length > 4 ? uciMove[4] : undefined;
          const result = game.move({ from, to, promotion: promotion as any });
          if (result) {
            setLastMove({ from, to });
            forceRender((n) => n + 1);
          }
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
    }, 500); // brief pause so the opponent's reply doesn't feel instant/robotic

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
  // whose king to highlight, no separate check-detection logic.
  const checkedKingSquare = useMemo(() => {
    if (!game.isCheck()) return null;
    const mover = game.turn();
    for (const row of game.board()) {
      for (const cell of row) {
        if (cell && cell.type === "k" && cell.color === mover) return cell.square as Square;
      }
    }
    return null;
  }, [game]);


  const handleSquareClick = useCallback(
    (square: Square) => {
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
        const move = game.move({ from: selected, to: square, promotion: "q" });
        setSelected(null);
        setLastMove({ from: selected, to: square });
        forceRender((n) => n + 1);
        if (move) {
          onMove?.({
            fen: game.fen(),
            san: move.san,
            isCheckmate: game.isCheckmate(),
            piece: move.piece,
            from: move.from as Square,
            to: move.to as Square,
          });
        }
      } else if (piece && (!playableColor || piece.color === playableColor)) {
        // Re-select a different one of your own pieces
        setSelected(square);
      } else {
        onIllegalAttempt?.(selected, square);
        setSelected(null);
      }
    },
    [selected, legalTargets, game, playableColor, onMove, onIllegalAttempt, readOnly]
  );

  // Image-backed skins (skin.boardImageUrl) draw their own frame/coordinate
  // labels baked into the image, so the interactive grid has to shrink and
  // inset to land exactly on the image's drawn squares instead of filling
  // the full board. Expressed as percentages (not size * fraction px) so it
  // stays correct at whatever pixel size the responsive outer box actually
  // renders at, not just the literal `size` prop.
  const framePercent = skin.boardImageUrl ? BOARD_IMAGE_FRAME_FRACTION * 100 : 0;
  const gridPercent = 100 - framePercent * 2;
  const pieceFolder = pieceSet.folder ? `${pieceSet.folder}/` : "";

  // Flip the board for Black so that player's own pieces render at the
  // bottom, matching how a real chess board looks from either side — this
  // matters for online multiplayer, where one player is genuinely Black.
  const displayRanks = playableColor === "b" ? [...RANKS].reverse() : RANKS;
  const displayFiles = playableColor === "b" ? [...FILES].reverse() : FILES;

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
          /* A separate max-width + max-height (previous attempt) doesn't
             work here: width was an EXPLICIT pixel value, and CSS only
             lets aspect-ratio derive the AUTO dimension (height) from an
             explicit one, not the other way around — so max-height
             clamped height alone, leaving width at its full explicit
             value and breaking the square into a short, wide rectangle.
             Since the interactive grid inside is positioned by percentage
             against this box, a non-square parent scattered pieces
             outside the visible board in landscape. Folding every
             constraint into width itself (via min()) keeps width as the
             single source of truth, so aspect-ratio always derives a
             matching, correct height from it — guaranteed square. */
          width: min(${size}px, 100%, 75vh);
        }
        @media (max-width: 639px) {
          .board-outer {
            width: min(calc(100% + 3rem), 75vh);
            margin-left: -1.5rem;
            margin-right: -1.5rem;
          }
        }
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
        className="grid grid-cols-8 grid-rows-8"
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
            const piece = game.get(square);
            const isDark = (rIdx + fIdx) % 2 === 1;
            const isSelected = selected === square;
            const isLegalTarget = legalTargets.has(square);
            const isLastMove = lastMove && (lastMove.from === square || lastMove.to === square);
            const isCheckedKing = checkedKingSquare === square;
            // Inline style always wins over a Tailwind class, so the
            // last-move highlight has to be folded into this same value
            // rather than layered on via a separate "bg-kingdom-gold/30"
            // class (which the skin's inline backgroundColor would hide).
            // Image-backed skins stay transparent otherwise, letting the
            // image show through.
            const squareBackground =
              isLastMove && !isSelected
                ? "rgba(255, 197, 61, 0.3)"
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
                  "relative flex items-center justify-center transition-colors w-full h-full",
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
                <AnimatePresence>
                  {piece && (
                    <motion.div
                      key={`${square}-${piece.type}-${piece.color}`}
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.6, opacity: 0 }}
                      className="flex items-center justify-center drop-shadow-sm"
                      // Pawns are the shortest/simplest piece in every set —
                      // at the same bounding box as everything else, they
                      // read as noticeably smaller. Boxing them larger (not
                      // scaling the image itself, so it still lands via
                      // object-fit: contain) makes them visually match the
                      // other pieces' apparent size instead of looking
                      // undersized in comparison.
                      style={
                        piece.type === "p"
                          ? { width: "98%", height: "98%" }
                          : { width: "90%", height: "90%" }
                      }
                    >
                      <img
                        src={`/pieces/${pieceFolder}${piece.color === "w" ? "light" : "dark"}/${
                          PIECE_FILE_NAME[piece.type]
                        }.svg`}
                        alt={`${piece.color === "w" ? "light" : "dark"} ${piece.type}`}
                        // width/height are the SVG's real intrinsic
                        // dimensions (HTML attributes, not CSS) — piece sets
                        // aren't all square (e.g. wood-classic is 200x300).
                        // object-fit: contain (not max-width/height + auto,
                        // which rendered the square "classic" set wildly
                        // oversized in testing) fills this fixed box and
                        // scales the image to fit within it, preserving
                        // aspect ratio, for every piece set uniformly.
                        width={pieceSet.intrinsicSize.width}
                        height={pieceSet.intrinsicSize.height}
                        style={{ width: "100%", height: "100%", objectFit: "contain" }}
                        draggable={false}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            );
          })
        )}
      </div>
      </div>
      {engineThinking && (
        <p className="font-body text-sm text-kingdom-night/50 italic">Ollie is thinking...</p>
      )}
    </div>
  );
}

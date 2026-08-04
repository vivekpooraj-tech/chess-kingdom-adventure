"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Chess, Square, PieceSymbol, Color } from "chess.js";
import clsx from "clsx";
import { motion, AnimatePresence } from "framer-motion";
import { stockfish, Difficulty } from "@/lib/chess-engine/stockfishEngine";
import { getBoardSkin } from "@/content/boardSkins";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

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
  onMove?: (opts: { fen: string; san: string; isCheckmate: boolean; piece: PieceSymbol }) => void;
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
}

/**
 * Click-to-select-then-move interaction (tap piece -> tap destination).
 * Chosen over full drag-and-drop for the v1 slice: it's far more reliable on
 * touch devices for small hands than precise drag targeting, and is easier to
 * make accessible (keyboard/switch-control friendly later). React DnD can be
 * layered on top later as an alternate input mode if desired.
 */
export function ChessBoard({
  fen,
  playableColor,
  onMove,
  onIllegalAttempt,
  onGameOver,
  opponent,
  difficulty = "easy",
  size = 480,
  boardSkinId,
}: ChessBoardProps) {
  const game = useMemo(() => new Chess(fen), [fen]);
  const skin = useMemo(() => getBoardSkin(boardSkinId), [boardSkinId]);
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


  const handleSquareClick = useCallback(
    (square: Square) => {
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
    [selected, legalTargets, game, playableColor, onMove, onIllegalAttempt]
  );

  const squareSize = size / 8;

  // Flip the board for Black so that player's own pieces render at the
  // bottom, matching how a real chess board looks from either side — this
  // matters for online multiplayer, where one player is genuinely Black.
  const displayRanks = playableColor === "b" ? [...RANKS].reverse() : RANKS;
  const displayFiles = playableColor === "b" ? [...FILES].reverse() : FILES;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="rounded-card overflow-hidden shadow-toy select-none"
        style={{ width: size, height: size }}
    >
      <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
        {displayRanks.map((rank, rIdx) =>
          displayFiles.map((file, fIdx) => {
            const square = `${file}${rank}` as Square;
            const piece = game.get(square);
            const isDark = (rIdx + fIdx) % 2 === 1;
            const isSelected = selected === square;
            const isLegalTarget = legalTargets.has(square);
            const isLastMove = lastMove && (lastMove.from === square || lastMove.to === square);
            // Inline style always wins over a Tailwind class, so the
            // last-move highlight has to be folded into this same value
            // rather than layered on via a separate "bg-kingdom-gold/30"
            // class (which the skin's inline backgroundColor would hide).
            const squareBackground =
              isLastMove && !isSelected ? "rgba(255, 197, 61, 0.3)" : isDark ? skin.darkSquare : skin.lightSquare;

            return (
              <button
                key={square}
                onClick={() => handleSquareClick(square)}
                className={clsx(
                  "relative flex items-center justify-center transition-colors",
                  isSelected && "ring-4 ring-inset ring-kingdom-gold"
                )}
                style={{
                  width: squareSize,
                  height: squareSize,
                  fontSize: squareSize * 0.65,
                  backgroundColor: squareBackground,
                }}
                aria-label={`${square}${piece ? ` — ${piece.color === "w" ? "white" : "black"} ${piece.type}` : ""}`}
              >
                {isLegalTarget && !piece && (
                  <span className="absolute w-1/3 h-1/3 rounded-full bg-kingdom-gold/70" />
                )}
                {isLegalTarget && piece && (
                  <span className="absolute inset-1 rounded-full ring-4 ring-kingdom-coral/70" />
                )}
                <AnimatePresence>
                  {piece && (
                    <motion.div
                      key={`${square}-${piece.type}-${piece.color}`}
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.6, opacity: 0 }}
                      className="flex items-center justify-center drop-shadow-sm"
                      style={{ width: "88%", height: "88%" }}
                    >
                      <img
                        src={`/pieces/${piece.color === "w" ? "light" : "dark"}/${
                          PIECE_FILE_NAME[piece.type]
                        }.svg`}
                        alt={`${piece.color === "w" ? "light" : "dark"} ${piece.type}`}
                        width={squareSize * 0.88}
                        height={squareSize * 0.88}
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

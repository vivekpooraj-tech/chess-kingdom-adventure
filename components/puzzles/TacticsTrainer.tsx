"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import { ChessBoard } from "@/components/board/ChessBoard";
import { ChessFocusLayout } from "@/components/chess/ChessFocusLayout";
import { SideToMoveIndicator } from "@/components/board/SideToMoveIndicator";
import { MoveFeedback } from "@/components/game/MoveFeedback";
import { Button } from "@/components/ui/Button";
import { SkeletonBlock } from "@/components/ui/Skeleton";
import { TEXT } from "@/lib/designSystem";
import { getSkill } from "@/lib/analysis/skills";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import { resolveActiveChildCached, recordPuzzleLibrarySolve } from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";
import type { TacticsPuzzle, TacticsPuzzleResponse } from "@/lib/puzzles/tacticsTypes";

/**
 * Tactics Trainer — the client for the 5,000-puzzle server-side library.
 *
 * The browser never sees the library. Each puzzle arrives from
 * /api/puzzles/next as roughly 300 bytes, so this screen costs the same
 * whether the library holds 5,000 puzzles or 500,000.
 *
 * Correctness model differs from the mate trainer on /puzzles, deliberately.
 * That one accepts ANY move that delivers mate, because a mate is a mate. A
 * Lichess tactic has one intended line, verified at build time, so a move is
 * checked against the stored solution. Both are strict; they are strict about
 * different things, which is why they are separate components rather than one
 * with a mode flag.
 *
 * The opponent's replies are scripted from the same solution line — no engine
 * is involved, so the sequence a child sees is exactly the one that was
 * validated, every time.
 */

type Status = "loading" | "playing" | "wrong" | "solved" | "empty";

export function TacticsTrainer() {
  const [puzzle, setPuzzle] = useState<TacticsPuzzle | null>(null);
  const [reason, setReason] = useState<TacticsPuzzleResponse["reason"]>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [moveIndex, setMoveIndex] = useState(0);
  const [boardFen, setBoardFen] = useState<string | null>(null);
  const [boardKey, setBoardKey] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [solvedCount, setSolvedCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [boardSkinId, setBoardSkinId] = useState<string | undefined>();
  const [pieceSetId, setPieceSetId] = useState<string | undefined>();

  const childIdRef = useRef<string | null>(null);
  const seenRef = useRef<string[]>([]);

  // Child + board preferences. Failure here is non-fatal: puzzles still work,
  // they just aren't recorded.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const user = await getVerifiedUser(supabase);
        if (!user || cancelled) return;
        const resolution = await resolveActiveChildCached(
          supabase,
          user.id,
          getActiveChildIdClient()
        );
        if (cancelled) return;
        childIdRef.current = resolution.child?.id ?? null;
        setBoardSkinId(resolution.child?.board_skin_id ?? undefined);
        setPieceSetId(resolution.child?.piece_set_id ?? undefined);
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadPuzzle = useCallback(async () => {
    setStatus("loading");
    setMoveIndex(0);
    setAttempts(0);
    try {
      const exclude = seenRef.current.slice(-20).join(",");
      const res = await fetch(`/api/puzzles/next${exclude ? `?exclude=${exclude}` : ""}`, {
        cache: "no-store",
      });
      const data: TacticsPuzzleResponse = await res.json();
      if (!data.puzzle) {
        setStatus("empty");
        return;
      }
      seenRef.current.push(data.puzzle.id);
      setPuzzle(data.puzzle);
      setReason(data.reason);
      setBoardFen(data.puzzle.fen);
      setBoardKey((k) => k + 1);
      setStatus("playing");
    } catch {
      setStatus("empty");
    }
  }, []);

  useEffect(() => {
    void loadPuzzle();
  }, [loadPuzzle]);

  /**
   * Validate the child's move against the stored line.
   *
   * Compared in UCI (from/to/promotion) rather than SAN: SAN is
   * position-dependent and can differ by disambiguation, whereas the UCI pair
   * is exactly what was validated at build time.
   */
  function handleMove(opts: { from: string; to: string; san: string }) {
    if (!puzzle || status !== "playing") return;

    const expected = puzzle.solution[moveIndex];
    if (!expected) return;

    const played = `${opts.from}${opts.to}`;
    // Promotion: the stored move carries a 5th char; accept the match on the
    // square pair and let the promotion piece ride along.
    const matches = expected.slice(0, 4) === played;

    if (!matches) {
      setAttempts((n) => n + 1);
      setStreak(0);
      setStatus("wrong");
      return;
    }

    const nextIndex = moveIndex + 1;

    // Solved: no scripted reply left means that was the final move.
    if (nextIndex >= puzzle.solution.length) {
      setMoveIndex(nextIndex);
      setStatus("solved");
      setSolvedCount((n) => n + 1);
      setStreak((n) => (attempts === 0 ? n + 1 : 0));
      const childId = childIdRef.current;
      if (childId) {
        // Same table the mate trainer writes to, so a child's solve history
        // stays one list across both surfaces.
        void recordPuzzleLibrarySolve(
          createClient(),
          childId,
          puzzle.id,
          "trainer",
          attempts === 0,
          attempts + 1
        ).catch(() => {});
      }
      return;
    }

    // Otherwise play the opponent's scripted reply and hand the turn back.
    const reply = puzzle.solution[nextIndex];
    try {
      const game = new Chess(boardFen ?? puzzle.fen);
      game.move({ from: played.slice(0, 2), to: played.slice(2, 4), promotion: expected[4] });
      game.move({
        from: reply.slice(0, 2),
        to: reply.slice(2, 4),
        promotion: reply.length > 4 ? reply[4] : undefined,
      });
      setBoardFen(game.fen());
      setMoveIndex(nextIndex + 1);
      setBoardKey((k) => k + 1);
    } catch {
      // The line was validated at build time, so this should be unreachable;
      // if it ever happens, credit the solve rather than trapping the child.
      setStatus("solved");
    }
  }

  function retry() {
    if (!puzzle) return;
    setBoardFen(puzzle.fen);
    setMoveIndex(0);
    setBoardKey((k) => k + 1);
    setStatus("playing");
  }

  if (status === "loading" && !puzzle) {
    return (
      <main className="min-h-screen bg-premium-midnight flex flex-col items-center gap-6 px-6 pt-10 pb-nav-safe">
        <div className="h-9 w-48 rounded bg-premium-navy/70 animate-pulse" />
        <SkeletonBlock className="w-full max-w-md aspect-square" />
      </main>
    );
  }

  if (status === "empty" || !puzzle) {
    return (
      <main className="min-h-screen bg-premium-midnight flex flex-col items-center justify-center gap-4 px-6">
        <p className={TEXT.body}>No tactics puzzles are available right now.</p>
        <Button tone="premium" onClick={() => void loadPuzzle()}>
          Try again
        </Button>
      </main>
    );
  }

  const skill = getSkill(puzzle.skill);
  const remaining = Math.ceil((puzzle.solution.length - moveIndex) / 2);

  return (
    <ChessFocusLayout
      title="Tactics Trainer"
      preserveBottomNav
      renderBoard={(boardSize) => (
        <div className="board-feedback flex w-full items-center justify-center" data-feedback={status}>
          <ChessBoard
            key={boardKey}
            fen={boardFen ?? puzzle.fen}
            playableColor={puzzle.sideToMove}
            size={boardSize}
            focusMode
            boardSkinId={boardSkinId}
            pieceSetId={pieceSetId}
            readOnly={status === "solved"}
            onMove={handleMove}
          />
        </div>
      )}
      sidePanel={
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-classic-body text-xs bg-premium-gold/15 text-premium-gold rounded-full px-3 py-1">
              <span aria-hidden="true">{skill.emoji}</span> {skill.name}
            </span>
            <span className="font-classic-body text-xs bg-premium-navyLight/70 text-premium-ivory/75 rounded-full px-3 py-1 capitalize">
              {puzzle.tier}
            </span>
            <SideToMoveIndicator color={puzzle.sideToMove} tone="premium" />
          </div>

          {/* Only shown when the server actually chose this puzzle for a
              recorded weakness — never as generic encouragement. */}
          {reason && status === "playing" && (
            <p className="rounded-premiumBtn border border-premium-gold/25 bg-premium-gold/10 px-3 py-2 font-classic-body text-sm text-premium-gold">
              Ollie picked this: {reason.skillName} came up in {reason.weakCount} of your reviewed
              games.
            </p>
          )}

          {status === "playing" && (
            <p className={`${TEXT.caption} normal-case`}>
              {moveIndex === 0
                ? `Find the best move. ${skill.principle}`
                : `Good — keep going. ${remaining} move${remaining === 1 ? "" : "s"} to finish.`}
            </p>
          )}

          {status === "wrong" && (
            <div className="flex flex-col gap-2">
              <MoveFeedback tone="incorrect">
                Not the move this position needs. Look again — {skill.name.toLowerCase()}.
              </MoveFeedback>
              <Button tone="premium" variant="ghost" onClick={retry} className="w-full">
                Try Again
              </Button>
            </div>
          )}

          {status === "solved" && (
            <div className="flex flex-col gap-2">
              <MoveFeedback tone="correct">
                {streak >= 2 ? `Solved — that's ${streak} in a row, first try.` : "Solved."}
              </MoveFeedback>
              <div className="rounded-premiumBtn border border-premium-gold/20 bg-premium-navy/70 p-3 flex flex-col gap-1">
                <p className={`${TEXT.meta} text-premium-gold`}>The line</p>
                <p className="font-classic-body text-sm text-premium-ivory">
                  {puzzle.solutionSan.join(" ")}
                </p>
              </div>
              <Button tone="premium" onClick={() => void loadPuzzle()} className="w-full">
                Next Puzzle →
              </Button>
            </div>
          )}

          <p className={`${TEXT.caption} mt-auto pt-2 border-t border-white/5`}>
            Solved this session: {solvedCount}
          </p>
        </div>
      }
    />
  );
}

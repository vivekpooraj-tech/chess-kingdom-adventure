"use client";

import { Suspense, useEffect, useLayoutEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import {
  resolveActiveChildCached,
  getTodayPreviewCount,
  incrementPreviewCount,
  getSolvedPuzzleIds,
  recordPuzzleLibrarySolve,
  localDateString,
} from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";
import { PARENT_PREMIUM_COLUMNS, resolvePremiumState } from "@/lib/premium/entitlement";
import { DAILY_PREVIEW_LIMIT } from "@/content/lessons";
import { rememberPuzzleShown, readRecentPuzzleIds } from "@/lib/puzzles/recentPuzzles";
import type { ChessPuzzle } from "@/lib/types";
import type { MatePuzzleResponse } from "@/lib/puzzles/mateTypes";
import { isSoundMateInNFirstMove } from "@/lib/chess-engine/puzzleValidation";
import { recordDailyChallengeResult } from "@/lib/supabase/dailyChallengeQueries";
import { ChessBoard } from "@/components/board/ChessBoard";
import { ChessFocusLayout } from "@/components/chess/ChessFocusLayout";
import { SideToMoveIndicator } from "@/components/board/SideToMoveIndicator";
import { MoveFeedback } from "@/components/game/MoveFeedback";
import { prefersNeutralHomeTone } from "@/lib/learner/experienceLevel";
import { encourageAfterMiss, celebrateSolve, progressNudge } from "@/lib/puzzles/encouragement";
import { SecondaryCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { UpgradeButton } from "@/components/upgrade/UpgradeButton";
import { SkeletonBlock, SkeletonRow } from "@/components/ui/Skeleton";
import { TEXT } from "@/lib/designSystem";
import { getMatePattern } from "@/content/matePatterns";
import { PuzzleTower } from "@/components/puzzles/PuzzleTower";

type Status = "playing" | "correct" | "incorrect";

const OBJECTIVE_TEXT: Record<1 | 2 | 3, string> = {
  1: "Find the winning move.",
  2: "Find the first move that forces checkmate in 2 moves.",
  3: "Calculate the sequence and force checkmate in 3 moves.",
};

// useSearchParams() requires a Suspense boundary in the App Router.
export default function PuzzlesPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-premium-midnight" />}>
      <PuzzlesPageInner />
    </Suspense>
  );
}

function PuzzlesPageInner() {
  const router = useRouter();

  // AppShell stamps html[data-puzzle-trainer] on /puzzles, and globals.css
  // reads it as "this is a normal tab page, keep the tab bar visible" — twice,
  // both times with !important, even in chess-focus mode. That was right
  // when solving stayed docked in portrait, but the trainer now goes
  // full-screen in every orientation (the bar is `fixed bottom-0 z-50`, the
  // same z-index as the focus shell and later in the DOM, so it would paint
  // straight over the bottom rank), so the flag is withdrawn for as long as
  // this screen is mounted, not just in landscape. Restored on the way out;
  // if the user navigates away instead, AppShell's own effect owns it again.
  useLayoutEffect(() => {
    const root = document.documentElement;
    const had = root.dataset.puzzleTrainer;
    delete root.dataset.puzzleTrainer;
    return () => {
      if (had !== undefined) root.dataset.puzzleTrainer = had;
    };
  }, []);
  const searchParams = useSearchParams();

  // A puzzle id in the URL (the Daily Challenge card links here with
  // ?id=<puzzle>&daily=1) opens that exact puzzle — that path is untouched.
  // A bare /puzzles visit is free practice: it opens a RANDOM puzzle,
  // skipping the ones shown most recently on this device, so signing in
  // and opening Puzzles never lands you on the same position every time.
  const requestedId = searchParams.get("id");
  const isDaily = searchParams.get("daily") === "1";
  // The puzzle itself now arrives from /api/puzzles/mate rather than from a
  // bundled copy of the pool, so there is no puzzle to render until that
  // resolves. The board stays behind the skeleton until `selectionReady`
  // flips, exactly as it did before — that gate already existed because the
  // random pick was always deferred to an effect.

  const [boardSkinId, setBoardSkinId] = useState<string | undefined>(undefined);
  const [pieceSetId, setPieceSetId] = useState<string | undefined>(undefined);
  const [loaded, setLoaded] = useState(false);
  const [childId, setChildId] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [todayCount, setTodayCount] = useState(0);

  const [puzzle, setPuzzle] = useState<ChessPuzzle | null>(null);
  const [selectionReady, setSelectionReady] = useState(false);
  const [solvedIds, setSolvedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [boardKey, setBoardKey] = useState(0);
  const [moveCount, setMoveCount] = useState(0);
  const [status, setStatus] = useState<Status>("playing");
  const [solvedCount, setSolvedCount] = useState(0);
  // Consecutive first-try solves this session. Reset by a wrong attempt, so it
  // reports genuine unaided runs rather than counting retried puzzles.
  const [streakCount, setStreakCount] = useState(0);
  const [dailyAttempts, setDailyAttempts] = useState(0);
  // Misses on the CURRENT puzzle. Survives "Try Again" (that's the same
  // puzzle, so the encouragement ladder should keep getting more helpful) and
  // resets only when a different puzzle loads. See lib/puzzles/encouragement.ts.
  const [missCount, setMissCount] = useState(0);
  // Warm child copy vs. neutral adult copy, from the child profile the page
  // already resolves — no extra query.
  const [neutralTone, setNeutralTone] = useState(false);
  // The tower is the arrival screen for an ordinary tab visit. A Daily
  // Challenge link or a direct puzzle id promises to land straight on that
  // exact puzzle, so both skip it entirely rather than adding a detour.
  const [showTower, setShowTower] = useState(() => !requestedId && !isDaily);

  // The Daily Challenge is a separate free daily activity — it never counts
  // against the 3/day Puzzle Trainer allowance and is always playable, even
  // once that allowance is spent. Only bare (free-practice) /puzzles visits
  // hit the limit.
  const limitReached = !isPremium && !isDaily && todayCount >= DAILY_PREVIEW_LIMIT;

  // The FEN the player's NEXT move should be validated from — the puzzle's
  // own starting position at first, then whatever position the auto-
  // opponent's reply lands on after each of the player's non-final moves.
  // Never the live game's post-move FEN (that's `opts.fen` in handleMove,
  // which is the position AFTER the move being validated, not before it).
  const [beforeFen, setBeforeFen] = useState<string>("");

  useEffect(() => {
    if (puzzle) setBeforeFen(puzzle.fen);
  }, [puzzle]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      // getVerifiedUser() reads the already-verified session from local
      // storage instead of getUser()'s network round trip to re-validate it
      // against Supabase's Auth server — safe here because this is only
      // deciding what to render for THIS client; every query below is still
      // enforced by RLS server-side regardless of what the client believes
      // its own identity is. It also retries once on a transient network
      // failure, so a momentary blip refreshing an expired token (the
      // common case right after reopening the app) doesn't bounce a
      // genuinely signed-in user to a fresh magic-link request.
      const user = await getVerifiedUser(supabase);
      if (!user) {
        router.push("/sign-in");
        return;
      }
      const resolution = await resolveActiveChildCached(supabase, user.id, getActiveChildIdClient());
      if (resolution.needsSelection) {
        router.push("/choose-child");
        return;
      }
      const child = resolution.child!;
      setChildId(child.id);
      setBoardSkinId(child.board_skin_id);
      setPieceSetId(child.piece_set_id);
      setNeutralTone(prefersNeutralHomeTone(child.experience_level, child.age_band));

      // Independent of each other (all only need user/child ids already in
      // hand) — run together instead of one after the other. The puzzle fetch
      // joins the same batch: it is a server round-trip now, so issuing it
      // alongside these rather than after them keeps the page's time-to-board
      // the same as when the pool was bundled.
      const recent = readRecentPuzzleIds();
      const query = requestedId
        ? `?id=${encodeURIComponent(requestedId)}`
        : recent.length
          ? `?exclude=${recent.map(encodeURIComponent).join(",")}`
          : "";
      const [{ data: parent }, previewCount, solved, mateRes] = await Promise.all([
        supabase.from("parents").select(PARENT_PREMIUM_COLUMNS).eq("auth_user_id", user.id).single(),
        getTodayPreviewCount(supabase, child.id, localDateString()),
        getSolvedPuzzleIds(supabase, child.id).catch(() => [] as string[]),
        fetch(`/api/puzzles/mate${query}`, { cache: "no-store" })
          .then((r) => r.json() as Promise<MatePuzzleResponse>)
          .catch(() => ({ puzzle: null, solvedIds: [] }) as MatePuzzleResponse),
      ]);
      const premium = resolvePremiumState(parent).isPremium;
      setIsPremium(premium);
      if (!premium) {
        setTodayCount(previewCount);
      }

      const solvedSet = new Set(solved);
      setSolvedIds(solvedSet);

      // The server settled which puzzle to open: a `?id=` link (Daily
      // Challenge, or a deep link) gets that exact puzzle; a bare visit gets a
      // random one the child hasn't solved, skipping this device's recent
      // list. Same rules as before, just decided where the pool lives now.
      if (mateRes.puzzle) {
        setPuzzle(mateRes.puzzle);
        rememberPuzzleShown(mateRes.puzzle.id);
      }
      setSelectionReady(true);
      setLoaded(true);
    }
    load();
  }, [router, requestedId]);

  function resetPuzzle() {
    setBoardKey((k) => k + 1);
    setMoveCount(0);
    setStatus("playing");
    if (puzzle) setBeforeFen(puzzle.fen);
  }

  async function nextPuzzle() {
    // Ask the server for the next one. Recent ids (this device) plus the
    // current puzzle are excluded; solved ids are applied server-side.
    const exclude = [...readRecentPuzzleIds(), ...(puzzle ? [puzzle.id] : [])];
    try {
      const res = await fetch(
        `/api/puzzles/mate?exclude=${exclude.map(encodeURIComponent).join(",")}`,
        { cache: "no-store" }
      );
      const data = (await res.json()) as MatePuzzleResponse;
      if (!data.puzzle) return;
      setPuzzle(data.puzzle);
      setMissCount(0); // a different puzzle — the ladder starts over
      rememberPuzzleShown(data.puzzle.id);
    } catch {
      // Network blip: keep the current puzzle rather than blanking the board.
      return;
    }
    setBoardKey((k) => k + 1);
    setMoveCount(0);
    setStatus("playing");
    setDailyAttempts(0);
  }

  function markSolved() {
    if (!puzzle) return;
    setStatus("correct");
    setSolvedCount((n) => n + 1);
    setStreakCount((n) => (dailyAttempts === 0 ? n + 1 : 0));

    // Attempts / first-try for THIS solving session (dailyAttempts counts
    // wrong tries on the current puzzle, reset on nextPuzzle) — real numbers,
    // only ever persisted for the very first solve of a puzzle.
    const attemptNumber = dailyAttempts + 1;
    const firstTry = dailyAttempts === 0;

    // Free Puzzle Trainer quota: a bare free-practice solve spends one of the
    // 3/day preview credits. The Daily Challenge is a separate free activity
    // and never does — hence the !isDaily guard.
    if (!isPremium && !isDaily && childId) {
      const supabase = createClient();
      incrementPreviewCount(supabase, childId, localDateString())
        .then(setTodayCount)
        .catch(() => {});
    }
    // Server-authoritative: this only ever writes to the daily_challenge_
    // history row already created by get_daily_challenge (see
    // DailyChallengeCard) — the RPC itself is idempotent (a duplicate or
    // retried call can't double-count), matching the same client-reports-
    // the-chess-outcome trust model as finish_online_game_by_result.
    // daily_challenge_history stays authoritative for daily status/result.
    if (isDaily && childId) {
      const supabase = createClient();
      recordDailyChallengeResult(supabase, childId, localDateString(), true).catch(() => {});
    }

    // Cross-library solve history (Phase 14C): one row per (child, puzzle),
    // written once (unique(child_id, puzzle_id) — a re-solve is a no-op).
    // Powers no-repeat selection and the Parent Dashboard "Puzzles" count;
    // a puzzle solved through both Daily and Trainer is still one row.
    if (childId) {
      const supabase = createClient();
      recordPuzzleLibrarySolve(
        supabase,
        childId,
        puzzle.id,
        isDaily ? "daily" : "trainer",
        firstTry,
        attemptNumber
      ).catch(() => {});
      setSolvedIds((prev) => {
        if (prev.has(puzzle.id)) return prev;
        const next = new Set(prev);
        next.add(puzzle.id);
        return next;
      });
    }
  }

  // Fires after every ply (the child's own move AND the auto-opponent's
  // reply) — used only to track the position the NEXT player move should
  // be validated from. See the `beforeFen` doc comment above.
  function handlePositionChange(pos: { fen: string }) {
    setBeforeFen(pos.fen);
  }

  function markIncorrect() {
    setStatus("incorrect");
    setStreakCount(0);
    setDailyAttempts((n) => n + 1);
    setMissCount((n) => n + 1);
    if (isDaily && childId) {
      const supabase = createClient();
      recordDailyChallengeResult(supabase, childId, localDateString(), false).catch(() => {});
    }
  }

  function handleMove(opts: { fen: string; san: string; isCheckmate: boolean }) {
    if (!puzzle) return;
    const isFinalMove = moveCount === puzzle.mateIn - 1;
    if (isFinalMove) {
      if (opts.isCheckmate) {
        markSolved();
      } else {
        markIncorrect();
      }
      return;
    }

    // Not the last move yet — must be a sound forcing move against every
    // legal reply, checked from the position it was actually played from
    // (beforeFen), not the puzzle's original starting FEN.
    const remainingDepth = puzzle.mateIn - moveCount;
    if (isSoundMateInNFirstMove(beforeFen, opts.san, remainingDepth)) {
      setMoveCount((c) => c + 1); // opponent auto-replies (ChessBoard's opponent="stockfish"), then the child's next move
    } else {
      markIncorrect();
    }
  }

  // Shown first, ahead of the loading skeleton below — the puzzle itself
  // keeps loading in the background via the effect above, so by the time
  // the child taps "Solve a Puzzle" it's usually already there.
  if (showTower) {
    return (
      <PuzzleTower
        solvedCount={solvedIds.size}
        isPremium={isPremium}
        freePuzzlesLeft={isPremium ? null : Math.max(0, DAILY_PREVIEW_LIMIT - todayCount)}
        onStart={() => setShowTower(false)}
      />
    );
  }

  if (!loaded || !selectionReady || !puzzle) {
    // A real skeleton, not a blank screen — this page is a client component
    // (needs the puzzle id from the URL before it knows what to render), so
    // there's no server loading.tsx that can cover this gap; the tap needs
    // to feel acknowledged immediately while the auth + active-child lookup
    // that `load()` above kicks off resolves in the background.
    // `selectionReady` also guards the one-tick window before the random
    // free-practice puzzle is chosen, so the placeholder is never shown.
    return (
      <main className="min-h-screen bg-premium-midnight flex flex-col items-center gap-6 px-6 pt-10 pb-nav-safe">
        <div className="h-9 w-48 rounded bg-premium-navy/70 animate-pulse" />
        <SkeletonBlock className="w-full max-w-md aspect-square" />
        <SkeletonRow className="h-4 w-40" />
      </main>
    );
  }

  const movesRemaining = puzzle.mateIn - moveCount;
  const matePattern = getMatePattern(puzzle.theme);

  if (!limitReached) {
    return (
      <ChessFocusLayout
        title="Puzzle Trainer"
        // Full-screen hides the tab bar, so the shell's own Exit button is
        // the only way out. It must go somewhere — without this it renders
        // and does nothing, which is a trap.
        onExit={() => {
          if (!isDaily) {
            setShowTower(true);
            return;
          }
          router.push("/kingdom-map");
        }}
        // Solving is a board-first moment in any orientation: the board gets
        // the whole viewport and the panel sits beside/below it, rather than
        // sharing the screen with the tab bar the way an ordinary tab page
        // does.
        preserveBottomNav={false}
        renderBoard={(boardSize) => (
          <div className="board-feedback flex w-full items-center justify-center" data-feedback={status}>
            <ChessBoard
              key={boardKey}
              fen={puzzle.fen}
              playableColor={puzzle.sideToMove}
              opponent={puzzle.mateIn > 1 ? "stockfish" : undefined}
              difficulty="easy"
              size={boardSize}
              focusMode
              boardSkinId={boardSkinId}
              pieceSetId={pieceSetId}
              onMove={handleMove}
              onPositionChange={handlePositionChange}
            />
          </div>
        )}
        sidePanel={
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-classic-body text-xs bg-premium-emerald/25 text-emerald-300 rounded-full px-3 py-1 font-semibold">
                Checkmate in {puzzle.mateIn}
              </span>
              <span className="font-classic-body text-xs bg-premium-gold/15 text-premium-gold rounded-full px-3 py-1">
                {puzzle.theme}
              </span>
              <SideToMoveIndicator color={puzzle.sideToMove} tone="premium" />
            </div>

            {status === "playing" && moveCount === 0 && (
              <p className={`${TEXT.caption} normal-case`}>{OBJECTIVE_TEXT[puzzle.mateIn]}</p>
            )}

            {status === "correct" && isDaily && (
              <div className="flex flex-col gap-2">
                <MoveFeedback tone="correct">
                  Daily Challenge complete ✓ — Checkmate in {puzzle.mateIn} · Accuracy{" "}
                  {Math.round(100 / (dailyAttempts + 1))}%
                </MoveFeedback>
                <Link href="/kingdom-map">
                  <Button tone="premium" className="w-full">Back to the Kingdom →</Button>
                </Link>
              </div>
            )}
            {status === "correct" && !isDaily && (
              <div className="flex flex-col gap-2">
                <MoveFeedback tone="correct">
                  {celebrateSolve({
                    firstTry: missCount === 0,
                    streak: streakCount,
                    neutralTone,
                  })}
                </MoveFeedback>
                {/* Naming the pattern is what makes a solved puzzle reusable on
                    a real board. Omitted entirely for themes we cannot describe
                    accurately — see content/matePatterns.ts. */}
                {matePattern && (
                  <div className="rounded-premiumBtn border border-premium-gold/20 bg-premium-navy/70 p-3 flex flex-col gap-1">
                    <p className={`${TEXT.meta} text-premium-gold`}>{puzzle.theme}</p>
                    <p className={TEXT.body}>{matePattern.description}</p>
                    <p className={`${TEXT.caption} normal-case`}>{matePattern.recognise}</p>
                  </div>
                )}
                <Button tone="premium" onClick={nextPuzzle} className="w-full">
                  Next Puzzle →
                </Button>
              </div>
            )}
            {status === "incorrect" && (
              <div className="flex flex-col gap-2">
                {/* Gets more helpful with each attempt, never sterner — and
                    only ever names the puzzle's own stored theme, never a
                    generated explanation of why the move works. */}
                <MoveFeedback tone="incorrect">
                  {encourageAfterMiss({
                    attempt: missCount,
                    neutralTone,
                    hint: puzzle.theme,
                  })}
                </MoveFeedback>
                <Button tone="premium" variant="ghost" onClick={resetPuzzle} className="w-full">
                  Try Again
                </Button>
              </div>
            )}
            {status === "playing" && moveCount > 0 && (
              <MoveFeedback tone="neutral">
                {progressNudge(movesRemaining, neutralTone)}
              </MoveFeedback>
            )}

            {!isDaily && (
              <p className={`${TEXT.caption} mt-auto pt-2 border-t border-white/5`}>
                {isPremium
                  ? `Solved this session: ${solvedCount}`
                  : `${Math.max(0, DAILY_PREVIEW_LIMIT - todayCount)} of ${DAILY_PREVIEW_LIMIT} free puzzles left today`}
              </p>
            )}
          </div>
        }
      />
    );
  }

  return (
    <main className="min-h-screen bg-premium-midnight flex flex-col items-center justify-center gap-6 px-4 sm:px-6 pt-8 pb-nav-safe">
      <h1 className={`${TEXT.display} text-center`}>Puzzle Trainer</h1>
      <SecondaryCard className="max-w-sm w-full flex flex-col items-center gap-5 text-center border border-premium-gold/15">
        <span className="text-5xl">🔒</span>
        <h2 className={TEXT.heading}>Today&apos;s free puzzles are used up</h2>
        <p className={TEXT.body}>
          Free accounts get {DAILY_PREVIEW_LIMIT} puzzles a day — come back tomorrow for more, or unlock
          unlimited puzzles right now.
        </p>
        <UpgradeButton tone="premium" />
      </SecondaryCard>
      <Link
        href="/kingdom-map"
        className="font-body text-sm text-premium-ivory/65 underline underline-offset-2 min-h-[44px] flex items-center"
      >
        Back to Home
      </Link>
    </main>
  );
}

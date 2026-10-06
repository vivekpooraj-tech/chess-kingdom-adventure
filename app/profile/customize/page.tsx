"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChessBoard } from "@/components/board/ChessBoard";
import { BoardStyleCard, PieceStyleCard } from "@/components/customize/StyleCards";
import { PIECE_SETS, effectivePieceSetId } from "@/content/pieceSets";
import { BOARD_SKINS, effectiveBoardSkinId } from "@/content/boardSkins";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import { resolveActiveChild, updateChildPieceSet, updateChildBoardSkin } from "@/lib/supabase/queries";
import { getActiveChildIdClient, setActiveChildIdClient } from "@/lib/childSession";
import { ScreenTimeGate } from "@/components/screen-time/ScreenTimeGate";
import { PrimaryCard } from "@/components/ui/Card";
import { ScreenSkeleton } from "@/components/ui/ScreenSkeleton";
import { Button } from "@/components/ui/Button";
import { TEXT } from "@/lib/designSystem";
import { backLabel, destinationHref } from "@/lib/navigation/destinations";

/**
 * Unified "Customize Your Chessboard" screen (Phase 13) — replaces the two
 * single-purpose editors (formerly at this route and /profile/customize,
 * both now redirect here) with one screen so a child can see piece + board
 * together instead of guessing how they'll look combined. Reuses the exact
 * same per-child persistence as before (children.piece_set_id/board_skin_id
 * via updateChildPieceSet/updateChildBoardSkin) — no new table, no new
 * picker component for onboarding, which keeps its own separate sequential
 * PieceSetPicker/BoardSkinPicker steps untouched.
 *
 * The choices are a small curated library read straight from the registries
 * (content/boardSkins.ts, content/pieceSets.ts); each card previews itself with
 * the real board / piece renderers (components/customize/StyleCards.tsx).
 */
export default function CustomizeChessboardPage() {
  const router = useRouter();
  const [childId, setChildId] = useState<string | null>(null);
  const [pieceSetId, setPieceSetId] = useState<string | null>(null);
  const [boardSkinId, setBoardSkinId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const user = await getVerifiedUser(supabase);
      if (!user) {
        router.push("/sign-in");
        return;
      }
      const resolution = await resolveActiveChild(supabase, user.id, getActiveChildIdClient());
      if (resolution.needsSelection) {
        router.push("/choose-child");
        return;
      }
      const child = resolution.child!;
      setActiveChildIdClient(child.id);
      setChildId(child.id);
      // Show the board and pieces that are actually in effect, so a retired/unknown saved id (or the
      // legacy database default) still marks the Standard Green board and Classic pieces as selected.
      // Display only: nothing is written until the child picks one.
      setPieceSetId(effectivePieceSetId(child.piece_set_id));
      setBoardSkinId(effectiveBoardSkinId(child.board_skin_id));
    }
    load();
  }, [router]);

  function selectPieceSet(id: string) {
    setPieceSetId(id);
    setError(null);
    if (!childId) return;
    updateChildPieceSet(createClient(), childId, id).catch(() => {
      setError("Couldn't save your pieces — please try again.");
    });
  }

  function selectBoardSkin(id: string) {
    setBoardSkinId(id);
    setError(null);
    if (!childId) return;
    updateChildBoardSkin(createClient(), childId, id).catch(() => {
      setError("Couldn't save your board — please try again.");
    });
  }

  if (!childId || !pieceSetId || !boardSkinId) {
    return <ScreenSkeleton maxWidth="wide" />;
  }

  return (
    <ScreenTimeGate childId={childId}>
      <main className="min-h-screen bg-premium-midnight px-4 sm:px-6 py-10 flex flex-col items-center gap-10">
        <div className="text-center max-w-md">
          <button
            type="button"
            onClick={() => router.push(destinationHref("PROFILE"))}
            className="mb-2 inline-flex min-h-[44px] items-center font-body text-sm text-premium-ivory/65 underline underline-offset-2"
          >
            {backLabel("PROFILE")}
          </button>
          <p className={`${TEXT.meta} text-premium-gold`}>Profile</p>
          <h1 className={`${TEXT.display} mt-2`}>Customize Your Chessboard</h1>
          <p className={`${TEXT.body} mt-2`}>
            Mix and match any pieces with any board — your changes save instantly.
          </p>
        </div>

        <PrimaryCard className="flex items-center justify-center w-full max-w-md">
          <ChessBoard boardSkinId={boardSkinId} pieceSetId={pieceSetId} readOnly size={340} />
        </PrimaryCard>

        {error && (
          <p role="alert" className="font-classic-body text-sm text-red-300 text-center -mt-4">
            {error}
          </p>
        )}

        <section className="w-full max-w-3xl" aria-labelledby="customize-board-heading">
          <h2
            id="customize-board-heading"
            className="mb-3 font-classic-body text-xs font-bold uppercase tracking-[0.16em] text-premium-gold"
          >
            Board style
          </h2>
          <div role="group" aria-labelledby="customize-board-heading" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {BOARD_SKINS.map((skin) => (
              <BoardStyleCard
                key={skin.id}
                skin={skin}
                pieceSetId={pieceSetId}
                selected={boardSkinId === skin.id}
                onSelect={selectBoardSkin}
              />
            ))}
          </div>
        </section>

        <section className="w-full max-w-3xl" aria-labelledby="customize-piece-heading">
          <h2
            id="customize-piece-heading"
            className="mb-3 font-classic-body text-xs font-bold uppercase tracking-[0.16em] text-premium-gold"
          >
            Piece style
          </h2>
          <div role="group" aria-labelledby="customize-piece-heading" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {PIECE_SETS.map((set) => (
              <PieceStyleCard
                key={set.id}
                set={set}
                boardSkinId={boardSkinId}
                selected={pieceSetId === set.id}
                onSelect={selectPieceSet}
              />
            ))}
          </div>
        </section>

        <Button tone="premium" size="lg" onClick={() => router.push("/profile")}>
          Done
        </Button>
      </main>
    </ScreenTimeGate>
  );
}

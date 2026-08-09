"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChessBoard } from "@/components/board/ChessBoard";
import { PIECE_SETS } from "@/content/pieceSets";
import { BOARD_SKINS } from "@/content/boardSkins";
import { createClient } from "@/lib/supabase/client";
import { resolveActiveChild, updateChildPieceSet, updateChildBoardSkin } from "@/lib/supabase/queries";
import { getActiveChildIdClient, setActiveChildIdClient } from "@/lib/childSession";
import { ScreenTimeGate } from "@/components/screen-time/ScreenTimeGate";
import { PrimaryCard, SecondaryCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CheckIcon } from "@/components/nav/icons";
import { TEXT } from "@/lib/designSystem";

const PREVIEW_PIECE_ORDER = ["king", "queen", "rook", "bishop", "knight", "pawn"] as const;

/**
 * Unified "Customize Your Chessboard" screen (Phase 13) — replaces the two
 * single-purpose editors (formerly at this route and /kingdom-map/board-skin,
 * both now redirect here) with one screen so a child can see piece + board
 * together instead of guessing how they'll look combined. Reuses the exact
 * same per-child persistence as before (children.piece_set_id/board_skin_id
 * via updateChildPieceSet/updateChildBoardSkin) — no new table, no new
 * picker component for onboarding, which keeps its own separate sequential
 * PieceSetPicker/BoardSkinPicker steps untouched.
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
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
      setPieceSetId(child.piece_set_id);
      setBoardSkinId(child.board_skin_id);
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
    return <main className="min-h-screen bg-premium-midnight" />;
  }

  return (
    <ScreenTimeGate childId={childId}>
      <main className="min-h-screen bg-premium-midnight px-4 sm:px-6 py-10 flex flex-col items-center gap-10">
        <div className="text-center max-w-md">
          <p className={`${TEXT.meta} text-premium-gold`}>Kingdom Map</p>
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

        <section className="w-full max-w-2xl">
          <h2 className={`${TEXT.heading} mb-4`}>Pieces</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {PIECE_SETS.map((set) => {
              const folder = set.folder ? `${set.folder}/` : "";
              const isSelected = pieceSetId === set.id;
              return (
                <SecondaryCard key={set.id} className="!p-0 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => selectPieceSet(set.id)}
                    aria-pressed={isSelected}
                    aria-label={`${set.name}${isSelected ? " — selected" : ""}`}
                    className="w-full h-full flex flex-col items-center gap-3 p-4 rounded-premiumCard border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/60"
                    style={{
                      borderColor: isSelected ? "#D4AF37" : "rgba(255,255,255,0.08)",
                      borderWidth: isSelected ? 2 : 1,
                    }}
                  >
                    <div className="grid grid-cols-3 gap-1 w-full">
                      {PREVIEW_PIECE_ORDER.map((piece) => (
                        <div key={piece} className="aspect-square flex items-center justify-center">
                          <img
                            src={`/pieces/${folder}light/${piece}.svg`}
                            alt=""
                            width={set.intrinsicSize.width}
                            height={set.intrinsicSize.height}
                            style={{ width: "88%", height: "88%", objectFit: "contain" }}
                            draggable={false}
                          />
                        </div>
                      ))}
                    </div>
                    <span className="font-classic-display text-sm text-premium-ivory text-center">
                      {set.emoji} {set.name}
                    </span>
                    <span
                      className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-classic-body text-xs font-semibold ${
                        isSelected
                          ? "bg-emerald-500/15 text-emerald-300 border border-emerald-400/30"
                          : "bg-transparent text-premium-ivory/0 border border-transparent"
                      }`}
                    >
                      {isSelected && (
                        <>
                          <CheckIcon className="w-3.5 h-3.5" /> Selected
                        </>
                      )}
                    </span>
                  </button>
                </SecondaryCard>
              );
            })}
          </div>
        </section>

        <section className="w-full max-w-2xl">
          <h2 className={`${TEXT.heading} mb-4`}>Board</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {BOARD_SKINS.map((skin) => {
              const isSelected = boardSkinId === skin.id;
              return (
                <SecondaryCard key={skin.id} className="!p-0 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => selectBoardSkin(skin.id)}
                    aria-pressed={isSelected}
                    aria-label={`${skin.name}${isSelected ? " — selected" : ""}`}
                    className="w-full h-full flex flex-col items-center gap-3 p-4 rounded-premiumCard border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/60"
                    style={{
                      borderColor: isSelected ? "#D4AF37" : "rgba(255,255,255,0.08)",
                      borderWidth: isSelected ? 2 : 1,
                    }}
                  >
                    <div
                      className="grid grid-cols-4 grid-rows-2 w-full aspect-[2/1] rounded-md overflow-hidden"
                      style={{
                        border: skin.frameColor ? `3px solid ${skin.frameColor}` : "1px solid rgba(255,255,255,0.1)",
                      }}
                    >
                      {Array.from({ length: 8 }).map((_, i) => {
                        const row = Math.floor(i / 4);
                        const col = i % 4;
                        const dark = (row + col) % 2 === 1;
                        return (
                          <div
                            key={i}
                            style={{ backgroundColor: dark ? skin.darkSquare : skin.lightSquare }}
                          />
                        );
                      })}
                    </div>
                    <span className="font-classic-display text-sm text-premium-ivory text-center">
                      {skin.emoji} {skin.name}
                    </span>
                    <span
                      className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-classic-body text-xs font-semibold ${
                        isSelected
                          ? "bg-emerald-500/15 text-emerald-300 border border-emerald-400/30"
                          : "bg-transparent text-premium-ivory/0 border border-transparent"
                      }`}
                    >
                      {isSelected && (
                        <>
                          <CheckIcon className="w-3.5 h-3.5" /> Selected
                        </>
                      )}
                    </span>
                  </button>
                </SecondaryCard>
              );
            })}
          </div>
        </section>

        <Button tone="premium" size="lg" onClick={() => router.push("/profile")}>
          Done
        </Button>
      </main>
    </ScreenTimeGate>
  );
}

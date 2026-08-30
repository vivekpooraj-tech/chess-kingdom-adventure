"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FUNDAMENTALS_TOPICS } from "@/content/academyFundamentals";
import { ChessBoard } from "@/components/board/ChessBoard";
import { PrimaryNav } from "@/components/nav/PrimaryNav";
import { Screen } from "@/components/layout/Screen";
import { SecondaryCard } from "@/components/ui/Card";
import { TEXT } from "@/lib/designSystem";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import { resolveActiveChild } from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";

export default function FundamentalsPage() {
  // Best-effort — these example boards are read-only diagrams, so the page
  // still works fully even if resolving the child fails (matches the same
  // pattern used in Chess Mind's spatial/mathematics pages).
  const [boardSkinId, setBoardSkinId] = useState<string | undefined>(undefined);
  const [pieceSetId, setPieceSetId] = useState<string | undefined>(undefined);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const user = await getVerifiedUser(supabase);
      if (!user) return;
      const resolution = await resolveActiveChild(supabase, user.id, getActiveChildIdClient());
      if (resolution.child) {
        setBoardSkinId(resolution.child.board_skin_id);
        setPieceSetId(resolution.child.piece_set_id);
      }
    }
    load();
  }, []);

  return (
    <>
      <Screen maxWidth="compact">
        <div className="mx-auto max-w-xl text-center">
          <h1 className={TEXT.display}>Chess Fundamentals</h1>
          <p className={`${TEXT.body} mt-2`}>
            The board, the pieces, and the rules that hold it all together.
          </p>
        </div>

        <div className="flex w-full flex-col gap-4">
          {FUNDAMENTALS_TOPICS.map((topic, i) => (
            <SecondaryCard key={topic.id} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="font-classic-body text-[10px] font-semibold text-premium-gold border border-premium-gold/30 rounded-full w-5 h-5 flex items-center justify-center flex-none">
                  {i + 1}
                </span>
                <h2 className={TEXT.subheading}>{topic.title}</h2>
              </div>
              <p className={TEXT.body}>{topic.explanation}</p>
              {topic.exampleFen && (
                <div className="flex flex-col items-center gap-2 pt-1">
                  <ChessBoard
                    fen={topic.exampleFen}
                    size={240}
                    readOnly
                    boardSkinId={boardSkinId}
                    pieceSetId={pieceSetId}
                  />
                  {topic.exampleCaption && (
                    <p className={`${TEXT.caption} text-center italic normal-case`}>
                      {topic.exampleCaption}
                    </p>
                  )}
                </div>
              )}
            </SecondaryCard>
          ))}
        </div>

        <Link
          href="/academy"
          className="font-body text-sm text-premium-ivory/40 underline underline-offset-2"
        >
          Back to the Academy
        </Link>
      </Screen>
      <PrimaryNav />
    </>
  );
}

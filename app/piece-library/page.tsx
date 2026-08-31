"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import { resolveActiveChild } from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";
import { getPieceSet, PIECE_SYMBOL_BY_NAME } from "@/content/pieceSets";
import { PIECE_LIBRARY } from "@/content/pieceLibrary";
import { PieceImage } from "@/components/board/PieceImage";
import { SecondaryCard } from "@/components/ui/Card";
import { PrimaryNav } from "@/components/nav/PrimaryNav";
import { Screen } from "@/components/layout/Screen";
import { ScreenSkeleton } from "@/components/ui/ScreenSkeleton";
import { TEXT } from "@/lib/designSystem";

export default function PieceLibraryPage() {
  const router = useRouter();
  const [pieceSetId, setPieceSetId] = useState<string | undefined>(undefined);
  const [loaded, setLoaded] = useState(false);

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
      setPieceSetId(resolution.child!.piece_set_id);
      setLoaded(true);
    }
    load();
  }, [router]);

  if (!loaded) {
    return (
      <>
        <ScreenSkeleton maxWidth="wide" />
        <PrimaryNav />
      </>
    );
  }

  const pieceSet = getPieceSet(pieceSetId);

  return (
    <>
    <Screen maxWidth="wide">
      <div className="mx-auto max-w-xl text-center">
        <h1 className={TEXT.display}>The Piece Library</h1>
        <p className={`${TEXT.body} mt-2`}>
          Meet the six chess pieces — how they move, and their role & power.
        </p>
      </div>

      <div className="auto-grid" style={{ "--grid-min": "19rem" } as React.CSSProperties}>
        {PIECE_LIBRARY.map((entry) => (
          <SecondaryCard key={entry.piece} className="flex flex-col gap-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 bg-premium-midnightDeep rounded-premiumBtn p-2">
                <span className="flex h-11 w-11 items-center justify-center">
                  <PieceImage set={pieceSet} piece={PIECE_SYMBOL_BY_NAME[entry.piece]} color="w" fill />
                </span>
                <span className="flex h-11 w-11 items-center justify-center">
                  <PieceImage set={pieceSet} piece={PIECE_SYMBOL_BY_NAME[entry.piece]} color="b" fill />
                </span>
              </div>
              <div className="flex-1">
                <h2 className={TEXT.subheading}>{entry.name}</h2>
                <span className="font-classic-body text-xs bg-premium-gold/15 text-premium-gold rounded-full px-2 py-0.5">
                  {entry.value === null ? "Priceless" : `Worth ${entry.value} point${entry.value === 1 ? "" : "s"}`}
                </span>
              </div>
            </div>

            <div>
              <p className={`${TEXT.meta} text-premium-gold mb-1`}>How it moves</p>
              <p className={TEXT.body}>{entry.howItMoves}</p>
            </div>

            <div>
              <p className={`${TEXT.meta} text-premium-gold mb-1`}>Role & Power</p>
              <p className={TEXT.body}>{entry.role}</p>
            </div>

            <p className="font-classic-body text-xs text-premium-ivory/60 bg-premium-midnightDeep rounded-premiumBtn p-3">
              {entry.funFact}
            </p>
          </SecondaryCard>
        ))}
      </div>

      <Link
        href="/discover"
        className="font-body text-sm text-premium-ivory/40 underline underline-offset-2"
      >
        Back to Discover
      </Link>
    </Screen>
    <PrimaryNav />
    </>
  );
}

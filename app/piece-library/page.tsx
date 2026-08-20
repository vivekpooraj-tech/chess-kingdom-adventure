"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import { resolveActiveChild } from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";
import { getPieceSet } from "@/content/pieceSets";
import { PIECE_LIBRARY } from "@/content/pieceLibrary";
import { SecondaryCard } from "@/components/ui/Card";
import { PrimaryNav } from "@/components/nav/PrimaryNav";
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
    return <main className="min-h-screen" />;
  }

  const pieceSet = getPieceSet(pieceSetId);
  const folder = pieceSet.folder ? `${pieceSet.folder}/` : "";

  return (
    <>
    <main className="min-h-screen bg-premium-midnight flex flex-col items-center gap-8 px-6 pt-12 pb-24">
      <div className="text-center">
        <h1 className={TEXT.display}>The Piece Library</h1>
        <p className={`${TEXT.body} mt-2`}>
          Meet the six chess pieces — how they move, and their role & power.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-3xl w-full">
        {PIECE_LIBRARY.map((entry) => (
          <SecondaryCard key={entry.piece} className="flex flex-col gap-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 bg-premium-midnightDeep rounded-premiumBtn p-2">
                <img
                  src={`/pieces/${folder}light/${entry.piece}.svg`}
                  alt={`Light ${entry.name}`}
                  width={pieceSet.intrinsicSize.width}
                  height={pieceSet.intrinsicSize.height}
                  style={{ width: 44, height: 44, objectFit: "contain" }}
                  draggable={false}
                />
                <img
                  src={`/pieces/${folder}dark/${entry.piece}.svg`}
                  alt={`Dark ${entry.name}`}
                  width={pieceSet.intrinsicSize.width}
                  height={pieceSet.intrinsicSize.height}
                  style={{ width: 44, height: 44, objectFit: "contain" }}
                  draggable={false}
                />
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
    </main>
    <PrimaryNav />
    </>
  );
}

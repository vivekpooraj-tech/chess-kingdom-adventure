"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { resolveActiveChild } from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";
import { getPieceSet } from "@/content/pieceSets";
import { PIECE_LIBRARY } from "@/content/pieceLibrary";
import { Card } from "@/components/ui/Card";

export default function PieceLibraryPage() {
  const router = useRouter();
  const [pieceSetId, setPieceSetId] = useState<string | undefined>(undefined);
  const [loaded, setLoaded] = useState(false);

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
    <main className="min-h-screen flex flex-col items-center gap-8 px-6 py-12">
      <div className="text-center">
        <h1 className="font-display text-3xl text-kingdom-night">The Piece Library 📖</h1>
        <p className="font-body text-kingdom-night/70 mt-2">
          Meet the six chess pieces — how they move, and their role & power!
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-3xl w-full">
        {PIECE_LIBRARY.map((entry) => (
          <Card key={entry.piece} className="flex flex-col gap-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 bg-kingdom-sky/10 rounded-card p-2">
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
                <h2 className="font-display text-xl text-kingdom-night">{entry.name}</h2>
                <span className="font-body text-xs bg-kingdom-gold/20 text-kingdom-night/70 rounded-full px-2 py-0.5">
                  {entry.value === null ? "Priceless!" : `Worth ${entry.value} point${entry.value === 1 ? "" : "s"}`}
                </span>
              </div>
            </div>

            <div>
              <p className="font-display text-sm text-kingdom-royal mb-1">How it moves</p>
              <p className="font-body text-sm text-kingdom-night/80">{entry.howItMoves}</p>
            </div>

            <div>
              <p className="font-display text-sm text-kingdom-royal mb-1">Role & Power</p>
              <p className="font-body text-sm text-kingdom-night/80">{entry.role}</p>
            </div>

            <p className="font-body text-xs text-kingdom-night/60 bg-kingdom-gold/10 rounded-card p-3">
              💡 {entry.funFact}
            </p>
          </Card>
        ))}
      </div>

      <Link
        href="/kingdom-map"
        className="font-body text-sm text-kingdom-night/40 underline underline-offset-2"
      >
        Back to the Kingdom Map
      </Link>
    </main>
  );
}

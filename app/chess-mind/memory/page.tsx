"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CHESS_MATH_POSITIONS } from "@/content/chessMindMath";
import { PATTERN_CHALLENGES } from "@/content/chessMindPatterns";
import { generateMemoryQuestion, RevealQuestion } from "@/lib/chessMind/revealQuestions";
import { RevealChallenge } from "@/components/chessMind/RevealChallenge";
import { PrimaryNav } from "@/components/nav/PrimaryNav";
import { Screen } from "@/components/layout/Screen";
import { TEXT } from "@/lib/designSystem";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import { resolveActiveChild, recordChessMindSolve } from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";

// Reuses real, already chess.js-verified positions from other Chess Mind
// content instead of authoring a third position bank.
const POSITION_POOL = [
  ...CHESS_MATH_POSITIONS.map((p) => p.fen),
  ...PATTERN_CHALLENGES.map((p) => p.fen),
];

function pickRound(): { fen: string; question: RevealQuestion } {
  const fen = POSITION_POOL[Math.floor(Math.random() * POSITION_POOL.length)];
  return { fen, question: generateMemoryQuestion(fen) };
}

export default function MemoryPage() {
  const [round, setRound] = useState<{ fen: string; question: RevealQuestion } | null>(null);
  const [solved, setSolved] = useState(0);
  const [childId, setChildId] = useState<string | null>(null);
  const [boardSkinId, setBoardSkinId] = useState<string | undefined>(undefined);
  const [pieceSetId, setPieceSetId] = useState<string | undefined>(undefined);

  useEffect(() => {
    setRound(pickRound());
    async function loadChild() {
      const supabase = createClient();
      const user = await getVerifiedUser(supabase);
      if (!user) return;
      const resolution = await resolveActiveChild(supabase, user.id, getActiveChildIdClient());
      if (resolution.child) {
        setChildId(resolution.child.id);
        setBoardSkinId(resolution.child.board_skin_id);
        setPieceSetId(resolution.child.piece_set_id);
      }
    }
    loadChild();
  }, []);

  if (!round) {
    return <main className="min-h-screen bg-premium-midnight" />;
  }

  return (
    <>
      <Screen maxWidth="compact">
        <div className="mx-auto max-w-xl text-center">
          <h1 className={TEXT.display}>Memory</h1>
          <p className="font-classic-body text-sm text-premium-ivory/50 mt-2">
            Look closely, then remember what you saw.
          </p>
        </div>

        <RevealChallenge
          key={JSON.stringify(round)}
          fen={round.fen}
          question={round.question}
          revealSeconds={5}
          solved={solved}
          boardSkinId={boardSkinId}
          pieceSetId={pieceSetId}
          onCorrect={() => {
            setSolved((s) => s + 1);
            if (childId) recordChessMindSolve(createClient(), childId, "memory").catch(() => {});
          }}
          onNext={() => setRound(pickRound())}
        />

        <Link
          href="/chess-mind"
          className="font-body text-sm text-premium-ivory/40 underline underline-offset-2"
        >
          Back to Chess Mind
        </Link>
      </Screen>
      <PrimaryNav />
    </>
  );
}

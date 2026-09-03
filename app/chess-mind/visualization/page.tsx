"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CHESS_MATH_POSITIONS } from "@/content/chessMindMath";
import { PATTERN_CHALLENGES } from "@/content/chessMindPatterns";
import { generateVisualizationQuestion, RevealQuestion } from "@/lib/chessMind/revealQuestions";
import { RevealChallenge } from "@/components/chessMind/RevealChallenge";
import { PrimaryNav } from "@/components/nav/PrimaryNav";
import { Screen } from "@/components/layout/Screen";
import { ScreenSkeleton } from "@/components/ui/ScreenSkeleton";
import { TEXT } from "@/lib/designSystem";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import { resolveActiveChild, recordChessMindSolve } from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";

const POSITION_POOL = [
  ...CHESS_MATH_POSITIONS.map((p) => p.fen),
  ...PATTERN_CHALLENGES.map((p) => p.fen),
];

function pickRound(): { fen: string; question: RevealQuestion } {
  // A handful of positions have no piece with a legal move to ask about
  // (rare, but possible for very sparse endgame-style FENs) — retry with a
  // different position rather than show a broken question.
  for (let attempt = 0; attempt < 20; attempt++) {
    const fen = POSITION_POOL[Math.floor(Math.random() * POSITION_POOL.length)];
    const question = generateVisualizationQuestion(fen);
    if (question) return { fen, question };
  }
  // Exhausted retries (shouldn't happen with this pool) — fall back to the
  // first position's math-question style via memory generator isn't right
  // either; just retry the pool's first entry once more as a last resort.
  const fen = POSITION_POOL[0];
  return { fen, question: generateVisualizationQuestion(fen)! };
}

export default function VisualizationPage() {
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
    return (
      <>
        <ScreenSkeleton maxWidth="compact" />
        <PrimaryNav />
      </>
    );
  }

  return (
    <>
      <Screen maxWidth="compact">
        <div className="mx-auto max-w-xl text-center">
          <h1 className={TEXT.display}>Visualization</h1>
          <p className="font-classic-body text-sm text-premium-ivory/50 mt-2">
            See the position, then picture where a piece can go.
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
            if (childId) recordChessMindSolve(createClient(), childId, "visualization").catch(() => {});
          }}
          onNext={() => setRound(pickRound())}
        />

        <Link
          href="/chess-mind"
          className="inline-flex items-center min-h-[44px] font-body text-sm text-premium-ivory/40 underline underline-offset-2"
        >
          Back to Chess Mind
        </Link>
      </Screen>
      <PrimaryNav />
    </>
  );
}

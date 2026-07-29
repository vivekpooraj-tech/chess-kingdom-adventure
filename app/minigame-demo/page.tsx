"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MemoryFlip } from "@/components/minigames/engines/MemoryFlip";
import { TimedReaction } from "@/components/minigames/engines/TimedReaction";

/**
 * Dev-only page to try the newer mini-game engines in isolation before
 * they're wired into real lesson content. Not linked from anywhere in the
 * normal app flow — remove once Days 2+ content uses these for real.
 */
export default function MinigameDemoPage() {
  const [memoryKey, setMemoryKey] = useState(0);
  const [reactionKey, setReactionKey] = useState(0);
  const [memoryDone, setMemoryDone] = useState(false);
  const [reactionDone, setReactionDone] = useState(false);

  return (
    <main className="min-h-screen flex flex-col items-center gap-10 px-6 py-12">
      <h1 className="font-display text-3xl text-kingdom-night">Mini-Game Engine Demo</h1>

      <Card className="flex flex-col items-center gap-4">
        <h2 className="font-display text-lg text-kingdom-night/70">MemoryFlip</h2>
        {memoryDone ? (
          <div className="flex flex-col items-center gap-3">
            <p className="font-display text-xl text-kingdom-forest">Solved! 🎉</p>
            <Button
              size="md"
              onClick={() => {
                setMemoryDone(false);
                setMemoryKey((k) => k + 1);
              }}
            >
              Play again
            </Button>
          </div>
        ) : (
          <MemoryFlip
            key={memoryKey}
            prompt="Find the matching Knights!"
            pairs={[
              { id: "n1", glyph: "♞" },
              { id: "n2", glyph: "♟" },
              { id: "n3", glyph: "♝" },
              { id: "n4", glyph: "♜" },
            ]}
            onComplete={() => setMemoryDone(true)}
          />
        )}
      </Card>

      <Card className="flex flex-col items-center gap-4">
        <h2 className="font-display text-lg text-kingdom-night/70">TimedReaction</h2>
        {reactionDone ? (
          <div className="flex flex-col items-center gap-3">
            <p className="font-display text-xl text-kingdom-forest">All 3 rounds done! ⚡</p>
            <Button
              size="md"
              onClick={() => {
                setReactionDone(false);
                setReactionKey((k) => k + 1);
              }}
            >
              Play again
            </Button>
          </div>
        ) : (
          <TimedReaction
            key={reactionKey}
            prompt="Tap the glowing square before time runs out!"
            pieceGlyph="♘"
            rows={3}
            cols={4}
            rounds={3}
            roundTimeMs={3500}
            onComplete={() => setReactionDone(true)}
          />
        )}
      </Card>
    </main>
  );
}
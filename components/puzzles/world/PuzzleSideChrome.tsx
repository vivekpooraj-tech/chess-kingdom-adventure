"use client";

import type { ReactNode } from "react";
import { useWorld } from "@/lib/world/WorldContext";
import { starsFromAttempt } from "@/lib/puzzles/puzzleArena";

export function PuzzleSideChrome({
  children,
  hint,
  status,
  missCount,
  nextHint,
}: {
  children: ReactNode;
  hint?: string | null;
  status: "playing" | "correct" | "incorrect";
  missCount: number;
  nextHint?: string | null;
}) {
  const world = useWorld();
  const stars = starsFromAttempt(status, missCount);

  if (world === "atelier") {
    return (
      <div className="pz-panel pz-panel--atelier">
        <p className="pz-kicker">Coach note</p>
        <p className="pz-note">{hint || "Calculate the forcing line. Only real checks and mates count."}</p>
        {children}
        {nextHint ? <p className="pz-next">{nextHint}</p> : null}
      </div>
    );
  }

  if (world === "enchanted") {
    return (
      <div className="pz-panel pz-panel--enchanted">
        <div className="pz-ollie" role="note">
          <p className="pz-kicker">Ollie</p>
          <p className="pz-note">{hint || "Find the idea that opens the next chamber."}</p>
        </div>
        <p className="pz-stars" aria-label={`${stars} of 3 stars`}>
          {["1", "2", "3"].map((n, i) => (
            <span key={n} data-on={i < stars ? "true" : "false"}>
              ★
            </span>
          ))}
        </p>
        {children}
      </div>
    );
  }

  return (
    <div className="pz-panel pz-panel--classic">
      <p className="pz-kicker">Position notes</p>
      {children}
    </div>
  );
}

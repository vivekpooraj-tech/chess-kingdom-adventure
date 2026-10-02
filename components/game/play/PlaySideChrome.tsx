"use client";

import type { ReactNode } from "react";
import { useWorld } from "@/lib/world/WorldContext";

/**
 * World-specific panel chrome around the existing move list / match controls.
 * Does not replace clocks, resign, draw, or move submission.
 */
export function PlaySideChrome({
  children,
  hint,
  capturedCount,
  isCheck,
}: {
  children: ReactNode;
  hint?: string | null;
  capturedCount: number;
  isCheck: boolean;
}) {
  const world = useWorld();
  const stars = Math.max(
    1,
    Math.min(3, (capturedCount > 0 ? 1 : 0) + (isCheck ? 1 : 0) + (capturedCount > 2 ? 1 : 0))
  );

  if (world === "atelier") {
    return (
      <div className="play-panel play-panel--atelier">
        <p className="play-kicker">Coach telemetry</p>
        <p className="play-note">
          {hint || "Play the position you see. Material and checks are the only live signals here."}
        </p>
        {children}
      </div>
    );
  }

  if (world === "enchanted") {
    return (
      <div className="play-panel play-panel--enchanted">
        <div className="play-ollie" role="note">
          <p className="play-kicker">Ollie</p>
          <p className="play-note">{hint || "Watch the jumper. Pin what leaps."}</p>
        </div>
        <p className="play-stars" aria-label={`${stars} of 3 stars`}>
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
    <div className="play-panel play-panel--classic">
      <p className="play-kicker">Official scoresheet</p>
      {children}
    </div>
  );
}

export function PlayOpponentFrame({
  children,
  name,
}: {
  children: ReactNode;
  name: string;
}) {
  const world = useWorld();
  if (world === "atelier") {
    return (
      <div className="play-opp play-opp--atelier">
        <p className="play-kicker">Active drill · opponent</p>
        <p className="play-opp-name">{name}</p>
        {children}
      </div>
    );
  }
  if (world === "enchanted") {
    return (
      <div className="play-opp play-opp--enchanted">
        <p className="play-kicker">Rival</p>
        <p className="play-opp-name">{name}</p>
        {children}
      </div>
    );
  }
  return (
    <div className="play-opp play-opp--classic">
      <p className="play-kicker">Opponent</p>
      {children}
    </div>
  );
}

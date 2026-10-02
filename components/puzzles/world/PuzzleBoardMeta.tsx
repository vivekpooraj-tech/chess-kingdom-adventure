"use client";

import { useWorld } from "@/lib/world/WorldContext";
import {
  MASTERY_RAIL,
  masteryRailState,
  puzzleChambers,
} from "@/lib/puzzles/puzzleArena";

export function PuzzleBoardMeta({
  theme,
  objective,
  drill,
  depth,
  accuracy,
  time,
  streak,
  solvedCount,
  rating,
  source,
  notes,
  isDaily,
}: {
  theme: string;
  objective: string;
  drill: string;
  depth: string;
  accuracy: string;
  time: string;
  streak: string;
  solvedCount: number;
  rating?: number | null;
  source: string;
  notes?: string | null;
  isDaily?: boolean;
}) {
  const world = useWorld();

  if (world === "atelier") {
    const rail = masteryRailState(solvedCount);
    return (
      <div className="pz-meta pz-meta--atelier" aria-label="Training instruments">
        <div className="pz-grid">
          <span>
            <b>Drill</b> {drill}
          </span>
          <span>
            <b>Theme</b> {theme}
          </span>
          <span>
            <b>Accuracy</b> {accuracy}
          </span>
          <span>
            <b>Depth</b> {depth}
          </span>
          <span>
            <b>Time</b> {time}
          </span>
          <span>
            <b>Streak</b> {streak}
          </span>
        </div>
        <ol className="pz-rail" aria-label="Mastery">
          {MASTERY_RAIL.map((step, i) => (
            <li key={step.id} data-state={rail[i]?.status}>
              {step.label}
            </li>
          ))}
        </ol>
      </div>
    );
  }

  if (world === "enchanted") {
    const chambers = puzzleChambers(solvedCount);
    return (
      <div className="pz-meta pz-meta--enchanted" aria-label="Quest path">
        <ol className="pz-path">
          {chambers.map((c) => (
            <li key={c.id} data-state={c.status === "current" ? "here" : c.status}>
              {c.label}
            </li>
          ))}
        </ol>
        <p className="pz-trial">
          <strong>{theme}</strong>
          <span>{objective}</span>
        </p>
      </div>
    );
  }

  return (
    <div className="pz-meta pz-meta--classic" aria-label="Study sheet">
      <div className="pz-desk__row">
        <p className="pz-kicker pz-kicker--classic">
          {isDaily ? "Puzzle · Problem of the day" : "Puzzle · Study"}
        </p>
        <ul className="pz-desk__chips">
          {rating != null && <li>Rating {rating}</li>}
          <li>{source}</li>
        </ul>
      </div>
      <p className="pz-desk__title">
        <span>{theme}</span>
        <span className="pz-sheet-line">{objective}</span>
      </p>
      {notes && notes !== objective ? <p className="pz-notes">{notes}</p> : null}
    </div>
  );
}

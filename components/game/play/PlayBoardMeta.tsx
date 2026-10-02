"use client";

import { useWorld } from "@/lib/world/WorldContext";
import {
  QUEST_CHAMBERS,
  playArenaTitle,
  protocolForDifficulty,
  sessionFigures,
} from "./playArena";
import type { Difficulty } from "@/lib/chess-engine/stockfishEngine";
import { getTimeControl } from "@/content/timeControls";

export function PlayBoardMeta({
  historyLength,
  capturedCount,
  difficulty,
  openingName,
  startedAt,
  matchLine,
  timeControl,
  objectiveHint,
}: {
  historyLength: number;
  capturedCount: number;
  difficulty?: Difficulty;
  openingName?: string | null;
  startedAt?: string;
  matchLine?: string | null;
  /** online_games.time_control id ("5+0"); absent for untimed games. */
  timeControl?: string | null;
  objectiveHint?: string | null;
}) {
  const world = useWorld();
  const stats = sessionFigures(historyLength, capturedCount, startedAt);
  const chamberIndex = Math.min(QUEST_CHAMBERS.length - 1, Math.floor(historyLength / 8));

  if (world === "atelier") {
    return (
      <div className="play-meta play-meta--atelier" aria-label="Training instruments">
        <div className="play-grid">
          <span>
            <b>Drill</b> {protocolForDifficulty(difficulty)}
          </span>
          <span>
            <b>Theme</b> {openingName || "Open play"}
          </span>
          <span>
            <b>Plies</b> {stats.plyDepth}
          </span>
          <span>
            <b>Depth</b> {stats.movePairs}
          </span>
          <span>
            <b>Time</b> {stats.elapsed}
          </span>
          <span>
            <b>Takes</b> {stats.capturedCount}
          </span>
        </div>
      </div>
    );
  }

  if (world === "enchanted") {
    return (
      <div className="play-meta play-meta--enchanted" aria-label="Quest path">
        <ol className="play-path">
          {QUEST_CHAMBERS.map((name, i) => (
            <li
              key={name}
              data-state={i < chamberIndex ? "open" : i === chamberIndex ? "here" : "locked"}
            >
              {name}
            </li>
          ))}
        </ol>
        <p className="play-trial">
          <strong>{playArenaTitle(world, "Quest Trial")}</strong>
          <span>{objectiveHint || "Play the position. Defend the hall."}</span>
        </p>
      </div>
    );
  }

  const tc = timeControl ? getTimeControl(timeControl) : null;
  const sheet = [
    matchLine || (difficulty ? `Engine · ${DIFFICULTY_WORD[difficulty]}` : "Casual"),
    tc ? `${tc.description} ${tc.label}` : "Untimed",
    openingName || null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="play-meta play-meta--classic" aria-label="Match information">
      <p className="play-kicker play-kicker--classic">Classic Pro</p>
      <p className="play-sheet-line">{sheet}</p>
    </div>
  );
}

const DIFFICULTY_WORD: Record<Difficulty, string> = {
  "very-easy": "Very easy",
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

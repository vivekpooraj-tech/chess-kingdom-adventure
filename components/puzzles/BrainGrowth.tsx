"use client";

import { TEXT } from "@/lib/designSystem";
import { PUZZLE_LEVELS } from "@/lib/puzzles/puzzleLevels";
import { FLOOR_ACCENT } from "./PuzzleLevelCard";

/**
 * "Your Brain Grows Stronger" — five original brain icons (hand-drawn SVG
 * paths, not emoji), one per tower floor, growing larger and gaining
 * visible neural connections as the stage rises. The active stage is
 * `displayLevelId` rather than always the child's real current level, so
 * during an unlock celebration this panel can evolve a beat behind the
 * climber and land on the new stage in sync with it.
 */
export function BrainGrowth({
  displayLevelId,
  realLevelId,
}: {
  /** The stage currently being drawn as "active" — may lag one step behind
   * `realLevelId` for the moment a celebration is animating the crossing. */
  displayLevelId: string;
  /** The child's true current level, from the real solved count — used
   * only to mark earlier stages "earned" vs. the display stage itself. */
  realLevelId: string;
}) {
  const realIdx = PUZZLE_LEVELS.findIndex((l) => l.id === realLevelId);

  return (
    <div className="flex flex-col gap-3 rounded-premiumCard border border-premium-gold/20 bg-premium-navy/70 p-4">
      <p className={`${TEXT.meta} text-premium-gold`}>🧠 YOUR BRAIN GROWS STRONGER</p>
      <div className="flex items-end justify-between gap-1.5">
        {PUZZLE_LEVELS.map((level, i) => {
          const isDisplay = level.id === displayLevelId;
          const isEarned = i <= realIdx;
          return (
            <div key={level.id} className="flex flex-1 flex-col items-center gap-1 min-w-0">
              <BrainIcon
                stage={i}
                active={isDisplay}
                dim={!isEarned && !isDisplay}
                accentRing={FLOOR_ACCENT[level.id].ring}
              />
              <p
                className={`${TEXT.caption} text-center leading-tight ${
                  isDisplay ? "text-premium-gold" : isEarned ? "text-premium-ivory/70" : "text-premium-ivory/35"
                }`}
              >
                {level.brainStageLabel}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** One stage of the brain, 0 (Easy) through 4 (Master) — larger, brighter,
 * and progressively more "wired" as the stage rises. A single shared
 * silhouette path scaled up per stage, plus stage-specific neuron dots and
 * connecting lines, so the five icons read as one growing thing rather than
 * five unrelated drawings. */
function BrainIcon({
  stage,
  active,
  dim,
  accentRing,
}: {
  stage: number;
  active: boolean;
  dim: boolean;
  accentRing: string;
}) {
  const scale = 0.62 + stage * 0.095; // 0.62 → 1.0 across the five stages
  const color = dim ? "rgba(255,255,255,0.18)" : active ? accentRing : "rgba(255,255,255,0.55)";
  const neurons = [
    [],
    [[38, 30]],
    [
      [30, 26],
      [46, 30],
    ],
    [
      [26, 24],
      [46, 22],
      [36, 40],
    ],
    [
      [24, 22],
      [48, 20],
      [36, 38],
      [30, 48],
      [44, 46],
    ],
  ][stage];

  return (
    <div
      className={`relative flex h-11 w-11 items-center justify-center rounded-full transition-all duration-500 motion-reduce:transition-none ${
        active ? "shadow-goldGlow" : ""
      }`}
      style={{ backgroundColor: active ? `${accentRing}22` : "transparent" }}
    >
      <svg viewBox="0 0 72 56" width={44 * scale} height={34 * scale} className="motion-reduce:transition-none">
        {/* Brain silhouette: two lobes over one base curve. */}
        <path
          d="M36 6 C20 6 10 16 10 28 C10 34 13 39 18 42 C17 47 20 51 26 52 C30 53 33 51 36 48 C39 51 42 53 46 52 C52 51 55 47 54 42 C59 39 62 34 62 28 C62 16 52 6 36 6 Z"
          fill={dim ? "rgba(255,255,255,0.06)" : `${color}33`}
          stroke={color}
          strokeWidth="2.5"
        />
        {/* Center fissure. */}
        <path
          d="M36 10 C33 18 39 24 35 32 C39 40 33 46 36 50"
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          opacity={dim ? 0.3 : 0.7}
        />
        {/* Neurons + connecting lines — density rises with stage. */}
        {neurons.map(([nx, ny], i) => (
          <g key={i}>
            {i > 0 && (
              <line
                x1={neurons[i - 1][0]}
                y1={neurons[i - 1][1]}
                x2={nx}
                y2={ny}
                stroke={color}
                strokeWidth="1"
                opacity={dim ? 0.25 : 0.6}
              />
            )}
            <circle
              cx={nx}
              cy={ny}
              r={active ? 2.6 : 2}
              fill={color}
              className={active ? "motion-safe:animate-pulse" : ""}
            />
          </g>
        ))}
        {/* Master stage: a small crown resting above the brain. */}
        {stage === 4 && (
          <path
            d="M28 8 L31 2 L36 6 L41 2 L44 8 L28 8 Z"
            fill={dim ? "rgba(255,255,255,0.15)" : accentRing}
          />
        )}
      </svg>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { TEXT } from "@/lib/designSystem";
import {
  PUZZLE_LEVELS,
  currentPuzzleLevel,
  levelStatus,
  puzzlesUntilLevel,
  nextPuzzleLevel,
  motivationalLine,
  type PuzzleLevel,
} from "@/lib/puzzles/puzzleLevels";
import { PuzzleLevelCard, FLOOR_ACCENT } from "./PuzzleLevelCard";
import { PuzzleClimber } from "./PuzzleClimber";
import { BrainGrowth } from "./BrainGrowth";
import { PuzzleTowerProgress } from "./PuzzleTowerProgress";
import { PuzzleRewards } from "./PuzzleRewards";
import { PuzzleUnlockCelebration } from "./PuzzleUnlockCelebration";
import { OllieNote } from "@/components/ollie/OllieNote";
import { PuzzleTierPath } from "./PuzzleTierPath";
import { PuzzleTowerScene } from "./PuzzleTowerScene";

/** Remembers the last level this device saw, purely to detect "you just
 * crossed a threshold" for the unlock celebration. A shared device with
 * multiple children could in principle show a stale banner to the wrong
 * child — a known, minor limitation (see the handoff doc), not a progress
 * bug: nothing here is ever read back into the real solved count. */
const LAST_LEVEL_KEY = "chessmind_puzzle_tower_last_level";

/** How long the climber's glide between two rings takes — must match the
 * transition duration set on PuzzleClimber's own wrapping <g>. */
const CLIMB_MS = 900;
/** How long the climber pauses at its OLD position, celebrating and
 * looking up, before actually starting the glide. */
const LOOK_UP_MS = 500;

type CelebrationPhase = "none" | "look-up" | "climbing" | "modal";

/**
 * The Puzzles tab's hero screen — the child's real lifetime solved-puzzle
 * count, told as a climb up an original Chess Mind tower: a climbing
 * adventurer, a brain that visibly grows sharper, and a genuine unlock
 * celebration when a threshold is actually crossed.
 *
 * Supersedes the earlier PuzzleTrail/PuzzleLevelLadder screens (see
 * PUZZLE_TOWER_HANDOFF.md) and this component's own first pass (see
 * PUZZLE_TOWER_V2_HANDOFF.md) — the leveling data and thresholds are
 * unchanged from both; only the presentation grew.
 *
 * Phase 2 adds an illustrated SVG backdrop + isometric tier path — still no
 * raster art assets, same performance discipline on mid-range Android.
 */
export function PuzzleTower({
  solvedCount,
  isPremium,
  freePuzzlesLeft,
  onStart,
}: {
  solvedCount: number;
  isPremium: boolean;
  /** Free-tier puzzles left today; null once premium (unlimited). */
  freePuzzlesLeft: number | null;
  onStart: () => void;
}) {
  const current = currentPuzzleLevel(solvedCount);
  const next = nextPuzzleLevel(solvedCount);
  const toNext = next ? puzzlesUntilLevel(next, solvedCount) : 0;
  // Master-first, matching the hero art's top-to-bottom orientation — the
  // aspirational floors are what a child scrolls DOWN through to reach
  // their own, the same direction the tower itself narrows.
  const floors = [...PUZZLE_LEVELS].reverse();

  // Entrance state: floors and the gauge animate in on mount rather than
  // appearing pre-drawn, but only once and only via CSS transitions (no
  // library) — motion-reduce below turns this into an instant appearance.
  // A plain effect rather than requestAnimationFrame: rAF is throttled on a
  // backgrounded tab (easy to hit if the child switches apps mid-load), and
  // there is nothing here that needs a specific animation-frame boundary —
  // just "after the first paint, not during it".
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    setEntered(true);
  }, []);

  // Which floor the climber/brain are currently DRAWN at — usually just
  // `current.id`, except for the brief window right after a genuine
  // crossing, where it starts at the child's previous floor and glides up
  // to the new one so the crossing is something the child SEES happen,
  // not just a label that changed underneath them.
  const [displayLevelId, setDisplayLevelId] = useState(current.id);
  const [climbing, setClimbing] = useState(false);
  const [celebration, setCelebration] = useState<CelebrationPhase>("none");
  const [pendingLevel, setPendingLevel] = useState<PuzzleLevel | null>(null);
  // Guards the crossing check against React's dev-only Strict Mode
  // double-invocation of effects: the first invocation's synchronous
  // localStorage write would otherwise make the second invocation see
  // last === current and silently swallow a genuine celebration. Without
  // this guard the bug is invisible in production (Strict Mode never
  // double-invokes there) but very confusing to chase down locally.
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    if (hasCheckedRef.current) return;
    hasCheckedRef.current = true;
    try {
      const last = window.localStorage.getItem(LAST_LEVEL_KEY);
      const idx = PUZZLE_LEVELS.findIndex((l) => l.id === current.id);
      const lastIdx = last ? PUZZLE_LEVELS.findIndex((l) => l.id === last) : -1;
      const genuineCrossing = !!last && lastIdx >= 0 && idx > lastIdx;

      // Written immediately, not after the celebration plays — a refresh
      // mid-celebration must not replay it, and the real solved count
      // (never this key) stays the only source of truth for progress.
      window.localStorage.setItem(LAST_LEVEL_KEY, current.id);

      if (genuineCrossing) {
        setDisplayLevelId(last as string);
        setPendingLevel(current);
        setCelebration("look-up");
        window.setTimeout(() => {
          setCelebration("climbing");
          setClimbing(true);
          setDisplayLevelId(current.id);
        }, LOOK_UP_MS);
        window.setTimeout(() => {
          setClimbing(false);
          setCelebration("modal");
        }, LOOK_UP_MS + CLIMB_MS);
      } else {
        setDisplayLevelId(current.id);
      }
    } catch {
      /* localStorage unavailable — tower still works, just no celebration */
      setDisplayLevelId(current.id);
    }
    // Deliberately no cleanup that cancels the scheduled timers: React 18
    // silently ignores a state update reaching an unmounted component, so
    // letting a short-lived (<=1.4s) celebration timer run to completion is
    // harmless even across a real unmount. A cancelling cleanup here is
    // actively wrong under React Strict Mode's dev-only double-invoke —
    // its synthetic unmount would cancel the very timers the guarded
    // (never-re-run) second invocation depends on, silently swallowing
    // every celebration in local development while production (where
    // Strict Mode never double-invokes) stayed unaffected. Found and fixed
    // during this pass's own verification.
    //
    // Only ever checked once per mount (a fresh tab visit), not on every
    // solvedCount change within the same visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#080c18] px-4 pt-6 pb-nav-safe">
      <div className="relative mx-auto flex w-full max-w-md flex-col gap-5 md:max-w-6xl md:grid md:grid-cols-[minmax(0,1.2fr)_minmax(280px,360px)] md:items-start md:gap-6 lg:gap-8">
        {/* ── Left: story + illustrated hero + tiers ──────────────────── */}
        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col items-center gap-1 text-center md:items-start md:text-left">
            <p className={`${TEXT.meta} text-premium-gold`}>🧩 PUZZLES</p>
            <h1 className={TEXT.display}>The Puzzle Tower</h1>
            <p className={`${TEXT.body} normal-case text-premium-ivory/85`}>
              Solve today. Climb higher. Grow sharper.
            </p>
            <p className={`${TEXT.caption} normal-case text-premium-ivory/55`}>
              {motivationalLine(solvedCount)}
            </p>
            <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-premium-gold/30 bg-premium-gold/10 px-4 py-1.5 backdrop-blur-sm">
              <span aria-hidden="true">🧩</span>
              <span className="font-classic-display text-sm text-premium-gold tabular-nums">
                {solvedCount} Puzzle{solvedCount === 1 ? "" : "s"} Solved
              </span>
            </div>
          </div>

          <OllieNote className="md:max-w-lg border-premium-gold/25 bg-premium-navy/60 backdrop-blur-sm">
            {current.ollieLine}
          </OllieNote>

          {/* Illustrated hero frame — sunset kingdom + tower + meadow path */}
          <section className="relative overflow-hidden rounded-premiumCard border border-premium-gold/25 shadow-premiumGlow">
            <PuzzleTowerScene />
            <div className="relative z-10 flex flex-col gap-4 px-3 pb-4 pt-6 sm:px-5">
              <TowerHero displayLevelId={displayLevelId} climbing={climbing} entered={entered} />
              <PuzzleTierPath solvedCount={solvedCount} entered={entered} />
              <p className="text-center font-classic-display text-sm italic text-premium-ivory/50">
                Small puzzles. Big minds.
              </p>
            </div>
          </section>

          <ol className="flex flex-col gap-3" aria-label="Puzzle Tower levels">
            {floors.map((level, i) => (
              <PuzzleLevelCard
                key={level.id}
                level={level}
                status={levelStatus(level, solvedCount)}
                toUnlock={puzzlesUntilLevel(level, solvedCount)}
                entered={entered}
                delayMs={i * 70}
              />
            ))}
          </ol>
        </div>

        {/* ── Right: glass sidebar ───────────────────────────────────── */}
        <div className="flex flex-col gap-4 md:sticky md:top-[calc(var(--topbar-h,3.5rem)+1rem)] [&_.rounded-premiumCard]:border-white/10 [&_.rounded-premiumCard]:bg-premium-navy/55 [&_.rounded-premiumCard]:backdrop-blur-md">
          <BrainGrowth displayLevelId={displayLevelId} realLevelId={current.id} />

          <PuzzleTowerProgress
            solvedCount={solvedCount}
            current={current}
            next={next}
            toNext={toNext}
            entered={entered}
          />

          <PuzzleRewards />

          <div className="flex flex-col items-center gap-1 text-center md:items-stretch">
            {!isPremium && freePuzzlesLeft !== null && (
              <p className={`${TEXT.caption} text-center md:text-left`}>
                {freePuzzlesLeft} of your free puzzles left today
              </p>
            )}
          </div>

          <Button tone="premium" block onClick={onStart} className="mb-2">
            🧩 Solve a Puzzle
          </Button>
        </div>
      </div>

      {celebration === "modal" && pendingLevel && (
        <PuzzleUnlockCelebration
          level={pendingLevel}
          onContinue={() => {
            setCelebration("none");
            setPendingLevel(null);
          }}
        />
      )}
    </main>
  );
}

/**
 * The hero graphic: five tapering rings stacked into a spire, tallest and
 * narrowest at the top (Master), widest at the base (Easy) — an original
 * silhouette, not the reference app's tree-stump path. The climbing
 * adventurer stands on `displayLevelId`'s ring; the child's real current
 * ring gets a soft glow and a gentle pulse regardless of where the climber
 * currently is (so the destination is always visible while a celebration
 * is mid-glide). Pure inline SVG, no image asset, no animation library.
 */
function TowerHero({
  displayLevelId,
  climbing,
  entered,
}: {
  displayLevelId: string;
  climbing: boolean;
  entered: boolean;
}) {
  const rings = [
    { id: "easy", y: 210, w: 170 },
    { id: "medium", y: 168, w: 142 },
    { id: "hard", y: 128, w: 114 },
    { id: "expert", y: 90, w: 86 },
    { id: "master", y: 54, w: 58 },
  ];
  const ringHeight = 38;
  const displayRing = rings.find((r) => r.id === displayLevelId) ?? rings[0];

  return (
    <div className="relative flex justify-center py-2" aria-hidden="true">
      <svg
        viewBox="0 0 220 280"
        className={`h-60 w-auto md:h-[19rem] transition-opacity duration-700 motion-reduce:transition-none ${
          entered ? "opacity-100" : "opacity-0"
        }`}
      >
        <defs>
          <radialGradient id="towerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={FLOOR_ACCENT[displayLevelId].ring} stopOpacity="0.65" />
            <stop offset="100%" stopColor={FLOOR_ACCENT[displayLevelId].ring} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="towerStone" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4a5568" />
            <stop offset="50%" stopColor="#2d3748" />
            <stop offset="100%" stopColor="#1a202c" />
          </linearGradient>
          <filter id="towerShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000" floodOpacity="0.45" />
          </filter>
        </defs>

        {/* Ground shadow */}
        <ellipse cx="110" cy="252" rx="78" ry="12" fill="rgba(0,0,0,0.35)" />

        {/* Stone base platform */}
        <path
          d="M52 248 L168 248 L158 262 L62 262 Z"
          fill="#1e293b"
          stroke="rgba(255,255,255,0.12)"
          filter="url(#towerShadow)"
        />

        {rings
          .filter((r) => r.id === displayLevelId)
          .map((r) => (
            <circle
              key={`glow-${r.id}`}
              cx="110"
              cy={r.y + ringHeight / 2}
              r="78"
              fill="url(#towerGlow)"
              className="motion-safe:animate-pulse"
            />
          ))}

        {rings.map((r) => {
          const isDisplay = r.id === displayLevelId;
          const isPast =
            rings.findIndex((x) => x.id === r.id) <
            rings.findIndex((x) => x.id === displayLevelId);
          const accent = FLOOR_ACCENT[r.id];
          const half = r.w / 2;
          const topHalf = half - 12;
          const fill = isDisplay
            ? accent.ring
            : isPast
              ? "rgba(255,255,255,0.14)"
              : "rgba(255,255,255,0.05)";
          return (
            <g key={r.id} filter="url(#towerShadow)">
              {/* Battlements */}
              <path
                d={`M${110 - half},${r.y + 6} h8 v-6 h${Math.max(8, topHalf - 8)} v6 h8 v-6 h${Math.max(8, topHalf - 16)} v6 h8 v-6 h${Math.max(8, half - 24)} v6 h8 v-6 h8`}
                fill="none"
                stroke={isDisplay ? accent.ring : "rgba(255,255,255,0.1)"}
                strokeWidth="1"
                opacity="0.5"
              />
              <polygon
                points={`${110 - half},${r.y + ringHeight} ${110 + half},${r.y + ringHeight} ${110 + topHalf},${r.y} ${110 - topHalf},${r.y}`}
                fill={fill}
                fillOpacity={isDisplay ? 0.92 : 1}
                stroke={isDisplay ? accent.ring : "rgba(255,255,255,0.16)"}
                strokeWidth={isDisplay ? 2.5 : 1}
              />
              <polygon
                points={`${110 - topHalf + 8},${r.y + 8} ${110 + topHalf - 8},${r.y + 8} ${110 + topHalf - 14},${r.y + ringHeight - 6} ${110 - topHalf + 14},${r.y + ringHeight - 6}`}
                fill="rgba(0,0,0,0.15)"
                opacity={isDisplay ? 0.35 : 0.2}
              />
              <rect
                x={110 - topHalf / 2 - 6}
                y={r.y + 14}
                width="6"
                height="10"
                rx="1"
                fill={isDisplay ? "#fef08a" : "rgba(255,255,255,0.12)"}
                opacity={isDisplay ? 0.85 : 1}
              />
              <rect
                x={110 + topHalf / 2}
                y={r.y + 14}
                width="6"
                height="10"
                rx="1"
                fill={isDisplay ? "#fef08a" : "rgba(255,255,255,0.12)"}
                opacity={isDisplay ? 0.85 : 1}
              />
            </g>
          );
        })}

        <polygon points="110,14 126,54 94,54" fill={FLOOR_ACCENT.master.ring} fillOpacity="0.95" />
        <text x="110" y="12" textAnchor="middle" fontSize="18">
          👑
        </text>

        <text x="24" y="242" fontSize="16">
          🚩
        </text>
        <text x="188" y="242" fontSize="16">
          🚩
        </text>

        <PuzzleClimber
          x={110}
          y={displayRing.y + ringHeight / 2 + 14}
          climbing={climbing}
          celebrating={climbing}
        />
      </svg>
    </div>
  );
}

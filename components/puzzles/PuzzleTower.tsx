"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { OllieNote } from "@/components/ollie/OllieNote";
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

/** Remembers the last level this device saw, purely to detect "you just
 * crossed a threshold" for the one-time unlock celebration. A shared device
 * with multiple children could in principle show a stale banner to the
 * wrong child — a known, minor limitation (see the handoff doc), not a
 * progress bug: nothing here is ever read back into the real solved count. */
const LAST_LEVEL_KEY = "chessmind_puzzle_tower_last_level";

/** Distinct per-floor accent so five stacked cards don't all read as one
 * repeated shape — deliberately original rather than the reference app's
 * palette, and calmer than Master's so the top floor still reads as the
 * standout. */
const FLOOR_ACCENT: Record<string, { border: string; glow: string; ring: string }> = {
  easy: { border: "border-emerald-400/40", glow: "rgba(52,211,153,0.35)", ring: "#34d399" },
  medium: { border: "border-sky-400/40", glow: "rgba(56,189,248,0.35)", ring: "#38bdf8" },
  hard: { border: "border-violet-400/40", glow: "rgba(167,139,250,0.35)", ring: "#a78bfa" },
  expert: { border: "border-rose-400/40", glow: "rgba(251,113,133,0.35)", ring: "#fb7185" },
  master: { border: "border-premium-gold/60", glow: "rgba(255,197,61,0.55)", ring: "#FFC53D" },
};

/**
 * The Puzzles tab's hero screen — an original "climb the tower" visual
 * progression built from the child's REAL lifetime solved-puzzle count.
 *
 * Supersedes the earlier PuzzleTrail (session-only stepping stones) and
 * PuzzleLevelLadder (a near-identical milestone list that only lived on the
 * Tactics Trainer) with one shared experience, shown before either puzzle
 * flow. See PUZZLE_TOWER_HANDOFF.md for why those two were retired rather
 * than kept alongside this.
 *
 * Pure CSS/SVG/emoji — no illustrated art assets, no animation library —
 * same performance discipline the rest of Chess Mind holds to on mid-range
 * Android hardware.
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

  // One-time "you just unlocked a floor" celebration — compared against the
  // last level this device saw, not persisted anywhere authoritative.
  const [justUnlocked, setJustUnlocked] = useState<PuzzleLevel | null>(null);
  useEffect(() => {
    try {
      const last = window.localStorage.getItem(LAST_LEVEL_KEY);
      const idx = PUZZLE_LEVELS.findIndex((l) => l.id === current.id);
      const lastIdx = last ? PUZZLE_LEVELS.findIndex((l) => l.id === last) : -1;
      if (last && lastIdx >= 0 && idx > lastIdx) setJustUnlocked(current);
      window.localStorage.setItem(LAST_LEVEL_KEY, current.id);
    } catch {
      /* localStorage unavailable — the tower still works, just no banner */
    }
    // Only ever checked once per mount (a fresh tab visit), not on every
    // solvedCount change within the same visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-premium-midnight px-4 pt-6 pb-nav-safe">
      <div className="relative mx-auto flex w-full max-w-md flex-col gap-5">
        {/* ── Header / puzzle identity ───────────────────────────────── */}
        <div className="flex flex-col items-center gap-1 text-center">
          <p className={`${TEXT.meta} text-premium-gold`}>🧩 PUZZLES</p>
          <h1 className={TEXT.display}>The Puzzle Tower</h1>
          <p className={`${TEXT.body} normal-case`}>{motivationalLine(solvedCount)}</p>
          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-premium-gold/30 bg-premium-gold/10 px-4 py-1.5">
            <span aria-hidden="true">🧩</span>
            <span className="font-classic-display text-sm text-premium-gold tabular-nums">
              {solvedCount} Puzzle{solvedCount === 1 ? "" : "s"} Solved
            </span>
          </div>
        </div>

        {justUnlocked && (
          <div
            role="status"
            className={`rounded-premiumBtn border border-premium-gold bg-premium-gold/15 px-4 py-3 text-center shadow-goldGlow transition-opacity duration-700 motion-reduce:transition-none ${
              entered ? "opacity-100" : "opacity-0"
            }`}
          >
            <p className="font-classic-display text-sm text-premium-gold">
              ✨ {justUnlocked.label.toUpperCase()} UNLOCKED!
            </p>
          </div>
        )}

        {/* ── Hero tower ─────────────────────────────────────────────── */}
        <TowerHero solvedCount={solvedCount} entered={entered} />

        {/* ── The floors, Master at the top down to Easy at the bottom ─ */}
        <ol className="flex flex-col gap-3" aria-label="Puzzle Tower levels">
          {floors.map((level, i) => (
            <TowerFloor
              key={level.id}
              level={level}
              status={levelStatus(level, solvedCount)}
              toUnlock={puzzlesUntilLevel(level, solvedCount)}
              entered={entered}
              delayMs={i * 70}
            />
          ))}
        </ol>

        {/* ── Player progress panel ─────────────────────────────────── */}
        <div className="flex flex-col gap-3 rounded-premiumCard border border-premium-gold/20 bg-premium-navy/70 p-4">
          <p className={`${TEXT.meta} text-premium-gold`}>YOUR PUZZLE JOURNEY</p>
          <div className="grid grid-cols-2 gap-3">
            <Stat icon="👑" label="Current Rank" value={current.label} />
            <Stat icon="🧩" label="Puzzles Solved" value={String(solvedCount)} />
            <Stat
              icon="📈"
              label="Next Level"
              value={next ? `${toNext} more to ${next.label}` : "Tower conquered"}
            />
            <Stat icon="🏆" label="Achievement" value={current.achievement} />
          </div>
        </div>

        <div className="flex flex-col items-center gap-1 text-center">
          {!isPremium && freePuzzlesLeft !== null && (
            <p className={`${TEXT.caption}`}>{freePuzzlesLeft} of your free puzzles left today</p>
          )}
        </div>

        <Button tone="premium" block onClick={onStart} className="mb-2">
          🧩 Solve a Puzzle
        </Button>
      </div>
    </main>
  );
}

function Stat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-premiumBtn bg-premium-midnight/60 px-3 py-2">
      <span className={`${TEXT.caption} uppercase tracking-wide`}>
        <span aria-hidden="true">{icon}</span> {label}
      </span>
      <span className="font-classic-display text-sm text-premium-ivory truncate">{value}</span>
    </div>
  );
}

/**
 * The hero graphic: five tapering rings stacked into a spire, tallest and
 * narrowest at the top (Master), widest at the base (Easy) — an original
 * silhouette, not the reference app's tree-stump path. The child's current
 * ring gets a soft glow and a gentle pulse; every other ring is drawn dim.
 * Pure inline SVG, no image asset, no animation library.
 */
function TowerHero({ solvedCount, entered }: { solvedCount: number; entered: boolean }) {
  const current = currentPuzzleLevel(solvedCount);
  // Bottom to top, widest to narrowest — five trapezoid rings plus a spire
  // finial. Coordinates are hand-placed for a 220x260 viewBox.
  const rings = [
    { id: "easy", y: 210, w: 170 },
    { id: "medium", y: 168, w: 142 },
    { id: "hard", y: 128, w: 114 },
    { id: "expert", y: 90, w: 86 },
    { id: "master", y: 54, w: 58 },
  ];
  const ringHeight = 38;

  return (
    <div className="relative flex justify-center py-2" aria-hidden="true">
      <svg
        viewBox="0 0 220 260"
        className={`h-56 w-auto transition-opacity duration-700 motion-reduce:transition-none ${
          entered ? "opacity-100" : "opacity-0"
        }`}
      >
        <defs>
          <radialGradient id="towerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={FLOOR_ACCENT[current.id].ring} stopOpacity="0.55" />
            <stop offset="100%" stopColor={FLOOR_ACCENT[current.id].ring} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Glow behind the child's current ring only. */}
        {rings
          .filter((r) => r.id === current.id)
          .map((r) => (
            <circle
              key={`glow-${r.id}`}
              cx="110"
              cy={r.y + ringHeight / 2}
              r="70"
              fill="url(#towerGlow)"
              className="motion-safe:animate-pulse motion-reduce:animate-none"
            />
          ))}

        {rings.map((r) => {
          const isCurrent = r.id === current.id;
          const accent = FLOOR_ACCENT[r.id];
          const half = r.w / 2;
          const topHalf = half - 12;
          return (
            <g key={r.id}>
              <polygon
                points={`${110 - half},${r.y + ringHeight} ${110 + half},${r.y + ringHeight} ${110 + topHalf},${r.y} ${110 - topHalf},${r.y}`}
                fill={isCurrent ? accent.ring : "rgba(255,255,255,0.06)"}
                fillOpacity={isCurrent ? 0.85 : 1}
                stroke={isCurrent ? accent.ring : "rgba(255,255,255,0.14)"}
                strokeWidth={isCurrent ? 2 : 1}
              />
              {/* A couple of small lit windows per ring. */}
              <rect x={110 - topHalf / 2 - 6} y={r.y + 12} width="6" height="10" rx="1" fill={isCurrent ? "#1b2452" : "rgba(255,255,255,0.15)"} />
              <rect x={110 + topHalf / 2} y={r.y + 12} width="6" height="10" rx="1" fill={isCurrent ? "#1b2452" : "rgba(255,255,255,0.15)"} />
            </g>
          );
        })}

        {/* Spire + crown finial above the Master ring. */}
        <polygon points="110,18 122,52 98,52" fill={FLOOR_ACCENT.master.ring} fillOpacity="0.9" />
        <text x="110" y="16" textAnchor="middle" fontSize="16">
          👑
        </text>

        {/* A pair of small banners for chess-set flavor, low on the tower. */}
        <text x="30" y="236" fontSize="18">🚩</text>
        <text x="182" y="236" fontSize="18">🚩</text>
      </svg>
    </div>
  );
}

function TowerFloor({
  level,
  status,
  toUnlock,
  entered,
  delayMs,
}: {
  level: PuzzleLevel;
  status: "completed" | "current" | "locked";
  toUnlock: number;
  entered: boolean;
  delayMs: number;
}) {
  const accent = FLOOR_ACCENT[level.id];

  return (
    <li
      className={`rounded-premiumCard border p-4 transition-all duration-500 motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0 ${
        entered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      } ${
        status === "current"
          ? `${accent.border} bg-premium-navy/90`
          : status === "completed"
            ? "border-white/15 bg-premium-navy/60"
            : "border-white/10 bg-premium-navy/40"
      }`}
      style={{
        transitionDelay: `${delayMs}ms`,
        boxShadow: status === "current" ? `0 0 22px ${accent.glow}` : undefined,
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-2xl leading-none flex-none" aria-hidden="true">
            {level.icon}
          </span>
          <div className="min-w-0">
            <p
              className={`font-classic-display text-base truncate ${
                status === "locked" ? "text-premium-ivory/60" : "text-premium-ivory"
              }`}
            >
              {level.label}
            </p>
            <p className={`${TEXT.caption} normal-case truncate`}>{level.tagline}</p>
          </div>
        </div>
        <span className={`${TEXT.caption} flex-none tabular-nums`}>{level.rangeLabel}</span>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        {status === "current" && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-classic-body text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: accent.ring, backgroundColor: `${accent.glow}` }}
          >
            📍 You are here
          </span>
        )}
        {status === "completed" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 font-classic-body text-[11px] text-premium-ivory/80">
            ✅ Completed — {level.achievement}
          </span>
        )}
        {status === "locked" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 font-classic-body text-[11px] text-premium-ivory/50">
            🔒 {toUnlock} more puzzle{toUnlock === 1 ? "" : "s"} to unlock
          </span>
        )}
      </div>

      {status === "current" && (
        <div className="mt-3">
          <OllieNote>{level.ollieLine}</OllieNote>
        </div>
      )}
    </li>
  );
}

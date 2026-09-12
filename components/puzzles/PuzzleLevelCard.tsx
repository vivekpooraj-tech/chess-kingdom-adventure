"use client";

import { OllieNote } from "@/components/ollie/OllieNote";
import { TEXT } from "@/lib/designSystem";
import type { LevelStatus, PuzzleLevel } from "@/lib/puzzles/puzzleLevels";

/** Per-floor accent — deliberately original rather than the reference app's
 * palette, distinct enough that five stacked cards don't read as one
 * repeated shape, calmer than Master's so the top floor still stands out. */
export const FLOOR_ACCENT: Record<string, { border: string; glow: string; ring: string }> = {
  easy: { border: "border-emerald-400/40", glow: "rgba(52,211,153,0.35)", ring: "#34d399" },
  medium: { border: "border-sky-400/40", glow: "rgba(56,189,248,0.35)", ring: "#38bdf8" },
  hard: { border: "border-orange-400/40", glow: "rgba(251,146,60,0.35)", ring: "#fb923c" },
  expert: { border: "border-rose-400/40", glow: "rgba(251,113,133,0.35)", ring: "#fb7185" },
  master: { border: "border-premium-gold/60", glow: "rgba(255,197,61,0.55)", ring: "#FFC53D" },
};

/** One floor of the tower — unlocked/current/locked, with the honest
 * "N more puzzles" requirement on locked floors and Ollie's line on the
 * child's current one. Pure presentation; every number it shows is passed
 * in already computed from the real solved count. */
export function PuzzleLevelCard({
  level,
  status,
  toUnlock,
  entered,
  delayMs,
}: {
  level: PuzzleLevel;
  status: LevelStatus;
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
            style={{ color: accent.ring, backgroundColor: accent.glow }}
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

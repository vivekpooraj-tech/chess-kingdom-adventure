"use client";

import { useRemainingMs, type ClockSync } from "@/lib/game/useRemainingMs";

/**
 * Purely presentational — the ms value it renders is computed by the
 * caller from server-authoritative state (online_games.white_time_ms /
 * black_time_ms / last_move_at / current_turn), ticked locally only for a
 * smooth display. This component has no timer of its own and trusts
 * nothing about elapsed time; it just formats whatever number it's given.
 */
interface ChessClockProps {
  ms: number;
  /** Is this side currently on move? Drives the stronger visual treatment. */
  active: boolean;
}

const LOW_MS = 2 * 60 * 1000;
const CRITICAL_MS = 30 * 1000;

// One consistent format across the app: M:SS (no leading zero on minutes),
// which naturally reads as e.g. "0:59" once under a minute.
function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function ChessClock({ ms, active }: ChessClockProps) {
  const isCritical = ms <= CRITICAL_MS;
  const isLow = ms <= LOW_MS;

  const urgencyClasses = isCritical
    ? "text-red-400 border-red-400/50"
    : isLow
    ? "text-amber-300 border-amber-300/40"
    : "text-premium-ivory border-white/10";

  const activeClasses = active
    ? "bg-premium-navyLight shadow-[0_0_0_1px_rgba(212,175,55,0.4),0_0_16px_rgba(212,175,55,0.25)] scale-105"
    : "bg-premium-navy/60 opacity-70";

  return (
    <span
      role="timer"
      aria-label={`${active ? "Active" : "Waiting"} clock: ${formatClock(ms)} remaining`}
      className={[
        "inline-flex items-center justify-center font-classic-display tabular-nums rounded-premiumBtn border px-3 py-1 text-lg transition-[transform,box-shadow] duration-300",
        urgencyClasses,
        activeClasses,
        active && isCritical ? "motion-safe:animate-pulse" : "",
      ].join(" ")}
    >
      {formatClock(ms)}
    </span>
  );
}

/**
 * Self-ticking wrapper (Phase 2 performance pass) — owns its own 250ms
 * interval and re-renders ONLY itself, not the page that hosts it. Before
 * this, the live-ticking ms values lived in OnlineGamePage's own state, so
 * every 250ms tick re-rendered the entire game screen — the board, the
 * side panel, everything — just to update two numbers. The server-
 * authoritative inputs (baseMs/lastSyncAt/isRunning) only change on a real
 * Realtime update (an actual move or timeout), so the hook's setInterval is
 * the only thing ticking in between.
 *
 * The tick itself now lives in useRemainingMs so the progress bar can share
 * it; the behaviour here is unchanged.
 */
export function LiveChessClock({ baseMs, lastSyncAt, isRunning, gameActive }: ClockSync) {
  const displayMs = useRemainingMs({ baseMs, lastSyncAt, isRunning, gameActive });
  return <ChessClock ms={displayMs} active={isRunning} />;
}

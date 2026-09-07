"use client";

import { useEffect, useState } from "react";

export interface ClockSync {
  /** Remaining ms as of `lastSyncAt`, from the server row. */
  baseMs: number;
  /** ISO timestamp of the last authoritative sync (online_games.last_move_at). */
  lastSyncAt: string | null;
  /** Is this side the one whose clock is currently running down? */
  isRunning: boolean;
  /** game.status === "active" — ticking is meaningless otherwise. */
  gameActive: boolean;
}

/**
 * The one place in the app that turns server-authoritative clock state into a
 * live remaining-ms number.
 *
 * Lifted out of LiveChessClock unchanged so the progress bar could share it.
 * The alternative — having the bar compute its own elapsed time — would have
 * meant two copies of `baseMs - elapsed` that could drift apart after any
 * future edit, and a bar that disagreed with the digits beside it would be
 * worse than no bar at all.
 *
 * Each caller owns its own interval and re-renders only itself. That is the
 * point: the server-authoritative inputs change only on a real Realtime update,
 * so nothing above these components re-renders between moves. Hoisting this
 * into the game page instead would put a 250ms tick back into the page state
 * and re-render the board four times a second.
 */
export function useRemainingMs({ baseMs, lastSyncAt, isRunning, gameActive }: ClockSync): number {
  const [displayMs, setDisplayMs] = useState(baseMs);

  useEffect(() => {
    if (!gameActive || !isRunning || !lastSyncAt) {
      setDisplayMs(baseMs);
      return;
    }
    function tick() {
      const elapsed = Date.now() - new Date(lastSyncAt!).getTime();
      setDisplayMs(Math.max(0, baseMs - elapsed));
    }
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [baseMs, lastSyncAt, isRunning, gameActive]);

  return displayMs;
}

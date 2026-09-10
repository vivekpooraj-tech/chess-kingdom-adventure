/**
 * Chess Time session model — pure logic, timestamp-based.
 *
 * Remaining time is always derived from startedAt + durationMinutes, never
 * from a ticking interval alone.
 */
import type { ChessTimeActivityId, ChessTimeRemaining, ChessTimeSession } from "./types";

export function createChessTimeSession(input: {
  durationMinutes: number;
  allowedActivities: ChessTimeActivityId[];
  nowMs?: number;
}): ChessTimeSession {
  const durationMinutes = clampDuration(input.durationMinutes);
  return {
    startedAt: input.nowMs ?? Date.now(),
    durationMinutes,
    allowedActivities: [...input.allowedActivities],
    active: true,
    paused: false,
    parentExitRequired: true,
  };
}

export function clampDuration(minutes: number): number {
  if (!Number.isFinite(minutes)) return 15;
  return Math.min(Math.max(Math.floor(minutes), 1), 180);
}

export function getEndsAtMs(session: ChessTimeSession): number {
  return session.startedAt + session.durationMinutes * 60_000;
}

export function getChessTimeRemaining(
  session: ChessTimeSession,
  nowMs: number = Date.now()
): ChessTimeRemaining {
  const totalMs = session.durationMinutes * 60_000;
  if (!session.active || session.paused) {
    return {
      totalMs,
      remainingMs: totalMs,
      expired: false,
      displaySeconds: Math.floor(totalMs / 1000),
    };
  }
  const remainingMs = Math.max(0, getEndsAtMs(session) - nowMs);
  return {
    totalMs,
    remainingMs,
    expired: remainingMs <= 0,
    displaySeconds: Math.floor(remainingMs / 1000),
  };
}

export function isChessTimeExpired(
  session: ChessTimeSession,
  nowMs: number = Date.now()
): boolean {
  if (!session.active) return true;
  if (session.paused) return false;
  return getChessTimeRemaining(session, nowMs).expired;
}

export function formatChessTimeRemaining(displaySeconds: number): string {
  const s = Math.max(0, displaySeconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function endChessTimeSession(session: ChessTimeSession): ChessTimeSession {
  return { ...session, active: false };
}

export function parseChessTimeSession(raw: unknown): ChessTimeSession | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Partial<ChessTimeSession>;
  if (typeof v.startedAt !== "number" || typeof v.durationMinutes !== "number") return null;
  if (!Array.isArray(v.allowedActivities)) return null;
  return {
    startedAt: v.startedAt,
    durationMinutes: clampDuration(v.durationMinutes),
    allowedActivities: v.allowedActivities as ChessTimeActivityId[],
    active: v.active !== false,
    paused: v.paused === true,
    parentExitRequired: v.parentExitRequired !== false,
  };
}

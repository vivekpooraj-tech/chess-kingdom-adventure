/**
 * Parent Lock / Chess Time — shared types.
 *
 * Level 1: in-app focus (Chess Mind navigation + PIN exit).
 * Level 2: Android Screen Pinning guidance (parent-enabled on device).
 * Level 3: managed kiosk — future only; never claimed as supported here.
 */

export type ParentLockPlatform = "web" | "android" | "ios" | "unknown";

export interface ParentLockCapabilities {
  platform: ParentLockPlatform;
  /** Parent can be guided to enable Screen Pinning on Android. */
  supportsScreenPinningGuidance: boolean;
  /** True only when a native bridge confirms lock-task mode (usually false). */
  supportsLockTaskDetection: boolean;
  lockTaskActive: boolean;
  /** Enterprise / Device Owner kiosk — not available in consumer app v1. */
  supportsTrueKioskMode: boolean;
  canLaunchPinningSettings: boolean;
  limitations: string[];
}

/** Activities a parent may allow during Chess Time (in-app only). */
export type ChessTimeActivityId =
  | "chess_school"
  | "play"
  | "puzzles"
  | "world"
  | "academy";

export interface ChessTimeActivity {
  id: ChessTimeActivityId;
  label: string;
  emoji: string;
  description: string;
}

export interface ChessTimeSession {
  startedAt: number;
  durationMinutes: number;
  allowedActivities: ChessTimeActivityId[];
  active: boolean;
  paused: boolean;
  parentExitRequired: boolean;
}

export interface ChessTimeRemaining {
  totalMs: number;
  remainingMs: number;
  expired: boolean;
  /** Whole seconds for display (floor). */
  displaySeconds: number;
}

export const CHESS_TIME_SESSION_STORAGE_KEY = "chessmind.chessTime.session.v1";
export const PARENT_PIN_HASH_STORAGE_KEY = "chessmind.parentLock.pinHash.v1";
export const PARENT_PIN_ATTEMPTS_STORAGE_KEY = "chessmind.parentLock.pinAttempts.v1";

/** Duration presets shown to parents (minutes). */
export const CHESS_TIME_DURATION_PRESETS = [10, 15, 30, 45, 60] as const;

export const DEFAULT_CHESS_TIME_ACTIVITIES: ChessTimeActivityId[] = [
  "chess_school",
  "play",
  "puzzles",
];

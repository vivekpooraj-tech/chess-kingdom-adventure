/**
 * Client-side persistence for Chess Time + Parent PIN.
 * Browser localStorage only — no server sync in v1.
 */
import type { ChessTimeSession } from "./types";
import {
  CHESS_TIME_SESSION_STORAGE_KEY,
  PARENT_PIN_ATTEMPTS_STORAGE_KEY,
  PARENT_PIN_HASH_STORAGE_KEY,
} from "./types";
import { parseChessTimeSession } from "./chessTime";
import { parsePinAttempts, type PinAttemptState } from "./parentPin";

function readJson(key: string): unknown {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode */
  }
}

export function loadChessTimeSession(): ChessTimeSession | null {
  return parseChessTimeSession(readJson(CHESS_TIME_SESSION_STORAGE_KEY));
}

export function saveChessTimeSession(session: ChessTimeSession | null): void {
  if (!session) {
    if (typeof window !== "undefined") localStorage.removeItem(CHESS_TIME_SESSION_STORAGE_KEY);
    return;
  }
  writeJson(CHESS_TIME_SESSION_STORAGE_KEY, session);
}

export function loadParentPinHash(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(PARENT_PIN_HASH_STORAGE_KEY);
}

export function saveParentPinHash(hash: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PARENT_PIN_HASH_STORAGE_KEY, hash);
}

export function clearParentPinHash(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PARENT_PIN_HASH_STORAGE_KEY);
}

export function loadPinAttempts(): PinAttemptState {
  return parsePinAttempts(readJson(PARENT_PIN_ATTEMPTS_STORAGE_KEY));
}

export function savePinAttempts(state: PinAttemptState): void {
  writeJson(PARENT_PIN_ATTEMPTS_STORAGE_KEY, state);
}

export function hasParentPinConfigured(): boolean {
  return !!loadParentPinHash();
}

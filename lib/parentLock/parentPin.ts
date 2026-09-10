/**
 * Parent PIN — format validation, rate limiting, legacy hash (migration only).
 *
 * New PINs use PBKDF2 via parentPinCrypto.ts. Legacy djb2 hashes (prefix "p")
 * remain verifiable until the parent next enters the correct PIN, which
 * upgrades storage automatically.
 */

export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 6;
export const MAX_PIN_ATTEMPTS = 5;
export const PIN_LOCKOUT_MS = 60_000;

/** @deprecated Legacy djb2 — only for verifying existing stored hashes. */
export function hashLegacyParentPin(pin: string): string {
  let h = 5381;
  const normalized = pin.trim();
  for (let i = 0; i < normalized.length; i++) {
    h = (h * 33) ^ normalized.charCodeAt(i);
  }
  return `p${(h >>> 0).toString(16)}`;
}

export function isLegacyParentPinHash(stored: string | null | undefined): boolean {
  return typeof stored === "string" && /^p[0-9a-f]+$/i.test(stored);
}

export function verifyLegacyParentPin(pin: string, storedHash: string | null): boolean {
  if (!storedHash || !validatePinFormat(pin) || !isLegacyParentPinHash(storedHash)) {
    return false;
  }
  return hashLegacyParentPin(pin) === storedHash;
}

export function validatePinFormat(pin: string): boolean {
  const t = pin.trim();
  if (t.length < PIN_MIN_LENGTH || t.length > PIN_MAX_LENGTH) return false;
  return /^\d+$/.test(t);
}

export interface PinAttemptState {
  failures: number;
  lockedUntil: number | null;
}

export function parsePinAttempts(raw: unknown): PinAttemptState {
  if (!raw || typeof raw !== "object") return { failures: 0, lockedUntil: null };
  const v = raw as Partial<PinAttemptState>;
  return {
    failures: typeof v.failures === "number" ? v.failures : 0,
    lockedUntil: typeof v.lockedUntil === "number" ? v.lockedUntil : null,
  };
}

export function isPinLockedOut(state: PinAttemptState, nowMs: number): boolean {
  if (!state.lockedUntil) return false;
  return nowMs < state.lockedUntil;
}

export function recordPinFailure(
  state: PinAttemptState,
  nowMs: number
): PinAttemptState {
  const failures = state.failures + 1;
  if (failures >= MAX_PIN_ATTEMPTS) {
    return { failures: 0, lockedUntil: nowMs + PIN_LOCKOUT_MS };
  }
  return { failures, lockedUntil: null };
}

export function resetPinAttempts(): PinAttemptState {
  return { failures: 0, lockedUntil: null };
}

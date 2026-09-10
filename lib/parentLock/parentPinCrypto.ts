/**
 * Parent PIN — PBKDF2 via Web Crypto (browser + Capacitor WebView).
 *
 * Stored format: pbkdf2-v1$<iterations>$<salt_b64url>$<hash_b64url>
 *
 * Legacy djb2 hashes (prefix "p" + hex) are verified once, then transparently
 * upgraded to pbkdf2-v1 on successful PIN entry.
 */
import {
  isPinLockedOut,
  parsePinAttempts,
  recordPinFailure,
  resetPinAttempts,
  validatePinFormat,
  verifyLegacyParentPin,
  isLegacyParentPinHash,
  type PinAttemptState,
} from "./parentPin";

export const PIN_HASH_SCHEME = "pbkdf2-v1";
export const PBKDF2_ITERATIONS = 120_000;
const SALT_BYTES = 16;
const KEY_BYTES = 32;

function getCrypto(): Crypto {
  if (typeof globalThis.crypto?.subtle !== "undefined") {
    return globalThis.crypto;
  }
  throw new Error("Web Crypto is unavailable — Parent PIN cannot be secured on this device.");
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(encoded: string): Uint8Array {
  const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function normalizePin(pin: string): string {
  return pin.trim();
}

async function derivePbkdf2Key(pin: string, salt: Uint8Array): Promise<Uint8Array> {
  const crypto = getCrypto();
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(normalizePin(pin)),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    KEY_BYTES * 8
  );
  return new Uint8Array(bits);
}

export function isModernParentPinHash(stored: string | null | undefined): boolean {
  return typeof stored === "string" && stored.startsWith(`${PIN_HASH_SCHEME}$`);
}

/** Create a new pbkdf2-v1 hash for storage. Never stores plain PIN. */
export async function hashParentPin(pin: string): Promise<string> {
  if (!validatePinFormat(pin)) {
    throw new Error("Invalid PIN format");
  }
  const salt = getCrypto().getRandomValues(new Uint8Array(SALT_BYTES));
  const derived = await derivePbkdf2Key(pin, salt);
  return `${PIN_HASH_SCHEME}$${PBKDF2_ITERATIONS}$${bytesToBase64Url(salt)}$${bytesToBase64Url(derived)}`;
}

async function verifyModernParentPin(pin: string, storedHash: string): Promise<boolean> {
  if (!validatePinFormat(pin) || !isModernParentPinHash(storedHash)) return false;
  const parts = storedHash.split("$");
  if (parts.length !== 4 || parts[0] !== PIN_HASH_SCHEME) return false;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  const salt = base64UrlToBytes(parts[2]!);
  const expected = base64UrlToBytes(parts[3]!);
  const crypto = getCrypto();
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(normalizePin(pin)),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    expected.length * 8
  );
  const actual = new Uint8Array(bits);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i]! ^ expected[i]!;
  return diff === 0;
}

export interface ParentPinVerifyResult {
  ok: boolean;
  /** When a legacy hash matched, store this upgraded hash. */
  upgradedHash?: string;
}

/**
 * Verify PIN against stored hash. Upgrades legacy djb2 hashes on success.
 */
export async function verifyParentPin(
  pin: string,
  storedHash: string | null
): Promise<ParentPinVerifyResult> {
  if (!storedHash || !validatePinFormat(pin)) return { ok: false };

  if (isModernParentPinHash(storedHash)) {
    return { ok: await verifyModernParentPin(pin, storedHash) };
  }

  if (isLegacyParentPinHash(storedHash) && verifyLegacyParentPin(pin, storedHash)) {
    return { ok: true, upgradedHash: await hashParentPin(pin) };
  }

  return { ok: false };
}

export type { PinAttemptState };
export {
  isPinLockedOut,
  parsePinAttempts,
  recordPinFailure,
  resetPinAttempts,
  validatePinFormat,
  isLegacyParentPinHash,
  verifyLegacyParentPin,
};

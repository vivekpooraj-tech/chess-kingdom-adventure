"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ChessTimeActivityId, ChessTimeSession, ParentLockCapabilities } from "@/lib/parentLock/types";
import {
  createChessTimeSession,
  formatChessTimeRemaining,
  getChessTimeRemaining,
  isChessTimeExpired,
} from "@/lib/parentLock/chessTime";
import {
  hashParentPin,
  isPinLockedOut,
  recordPinFailure,
  resetPinAttempts,
  validatePinFormat,
  verifyParentPin,
} from "@/lib/parentLock/parentPinCrypto";
import { isChessTimeLocked } from "@/lib/parentLock/sessionLock";
import {
  clearParentPinHash,
  hasParentPinConfigured,
  loadChessTimeSession,
  loadParentPinHash,
  loadPinAttempts,
  saveChessTimeSession,
  saveParentPinHash,
  savePinAttempts,
} from "@/lib/parentLock/storage";
import { buildParentLockCapabilities, detectPlatformFromUserAgent } from "@/lib/parentLock/platformCapabilities";
import { shouldRedirectToChessTimeHub } from "@/lib/parentLock/routeGuard";

export type PinActionResult = { ok: boolean; error?: string };

interface ChessTimeContextValue {
  session: ChessTimeSession | null;
  capabilities: ParentLockCapabilities;
  pinConfigured: boolean;
  /** PIN-locked session (includes expired completion state). */
  locked: boolean;
  remainingLabel: string;
  expired: boolean;
  startChessTime: (durationMinutes: number, activities: ChessTimeActivityId[]) => void;
  endChessTimeWithPin: (pin: string) => Promise<PinActionResult>;
  setupParentPin: (pin: string, confirmPin: string) => Promise<PinActionResult>;
  changeParentPin: (currentPin: string, newPin: string, confirmPin: string) => Promise<PinActionResult>;
  clearParentPinWithVerification: (pin: string) => Promise<PinActionResult>;
}

const ChessTimeContext = createContext<ChessTimeContextValue | null>(null);

export function ChessTimeProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<ChessTimeSession | null>(null);
  const [pinConfigured, setPinConfigured] = useState(false);
  const [tick, setTick] = useState(0);

  const capabilities = useMemo(
    () =>
      buildParentLockCapabilities({
        platform:
          typeof navigator !== "undefined"
            ? detectPlatformFromUserAgent(navigator.userAgent)
            : "unknown",
      }),
    []
  );

  useEffect(() => {
    setSession(loadChessTimeSession());
    setPinConfigured(hasParentPinConfigured());
  }, []);

  useEffect(() => {
    if (!session?.active) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [session?.active]);

  const expired = session ? isChessTimeExpired(session) : false;
  const locked = isChessTimeLocked(session);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("chess-time-active", locked);
    root.toggleAttribute("data-chess-time-locked", locked);
    root.toggleAttribute("data-chess-time-expired", locked && expired);
    return () => {
      root.classList.remove("chess-time-active");
      root.removeAttribute("data-chess-time-locked");
      root.removeAttribute("data-chess-time-expired");
    };
  }, [locked, expired]);

  const remaining = session
    ? getChessTimeRemaining(session)
    : { displaySeconds: 0, expired: true, remainingMs: 0, totalMs: 0 };
  void tick;

  const startChessTime = useCallback(
    (durationMinutes: number, activities: ChessTimeActivityId[]) => {
      if (!hasParentPinConfigured()) return;
      const next = createChessTimeSession({ durationMinutes, allowedActivities: activities });
      saveChessTimeSession(next);
      setSession(next);
      router.push("/chess-time");
    },
    [router]
  );

  const verifyPinWithRateLimit = useCallback(async (pin: string): Promise<PinActionResult> => {
    const attempts = loadPinAttempts();
    const now = Date.now();
    if (isPinLockedOut(attempts, now)) {
      const secs = Math.ceil(((attempts.lockedUntil ?? now) - now) / 1000);
      return { ok: false, error: `Too many tries. Wait ${secs}s.` };
    }
    const hash = loadParentPinHash();
    const verified = await verifyParentPin(pin, hash);
    if (!verified.ok) {
      savePinAttempts(recordPinFailure(attempts, now));
      return { ok: false, error: "Incorrect PIN." };
    }
    savePinAttempts(resetPinAttempts());
    if (verified.upgradedHash) {
      saveParentPinHash(verified.upgradedHash);
    }
    return { ok: true };
  }, []);

  const endChessTimeWithPin = useCallback(
    async (pin: string) => {
      const result = await verifyPinWithRateLimit(pin);
      if (!result.ok) return result;
      saveChessTimeSession(null);
      setSession(null);
      return { ok: true };
    },
    [verifyPinWithRateLimit]
  );

  const setupParentPin = useCallback(async (pin: string, confirmPin: string) => {
    if (!validatePinFormat(pin)) {
      return { ok: false, error: "PIN must be 4–6 digits." };
    }
    if (pin !== confirmPin) {
      return { ok: false, error: "PINs do not match." };
    }
    try {
      saveParentPinHash(await hashParentPin(pin));
      setPinConfigured(true);
      savePinAttempts(resetPinAttempts());
      return { ok: true };
    } catch {
      return { ok: false, error: "Could not secure PIN on this device." };
    }
  }, []);

  const changeParentPin = useCallback(
    async (currentPin: string, newPin: string, confirmPin: string) => {
      const check = await verifyPinWithRateLimit(currentPin);
      if (!check.ok) return check;
      return setupParentPin(newPin, confirmPin);
    },
    [setupParentPin, verifyPinWithRateLimit]
  );

  const clearParentPinWithVerification = useCallback(
    async (pin: string) => {
      const check = await verifyPinWithRateLimit(pin);
      if (!check.ok) return check;
      clearParentPinHash();
      setPinConfigured(false);
      saveChessTimeSession(null);
      setSession(null);
      return { ok: true };
    },
    [verifyPinWithRateLimit]
  );

  useEffect(() => {
    if (!session?.active) return;
    if (shouldRedirectToChessTimeHub({ pathname, session })) {
      router.replace("/chess-time");
    }
  }, [pathname, router, session]);

  const value: ChessTimeContextValue = {
    session,
    capabilities,
    pinConfigured,
    locked,
    remainingLabel: formatChessTimeRemaining(remaining.displaySeconds),
    expired,
    startChessTime,
    endChessTimeWithPin,
    setupParentPin,
    changeParentPin,
    clearParentPinWithVerification,
  };

  return <ChessTimeContext.Provider value={value}>{children}</ChessTimeContext.Provider>;
}

export function useChessTime(): ChessTimeContextValue {
  const ctx = useContext(ChessTimeContext);
  if (!ctx) throw new Error("useChessTime must be used within ChessTimeProvider");
  return ctx;
}

export function useChessTimeOptional(): ChessTimeContextValue | null {
  return useContext(ChessTimeContext);
}

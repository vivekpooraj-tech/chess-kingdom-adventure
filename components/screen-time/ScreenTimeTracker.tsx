"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import {
  addUsageMinutes,
  getScreenTimeLimits,
  getTodayUsageMinutes,
  resolveActiveChild,
} from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";
import { TimeCompleteOverlay } from "@/components/screen-time/TimeCompleteOverlay";
import {
  accumulate,
  dateKey,
  isBlocked,
  parseLeader,
  pickLimit,
  shouldClaimLeadership,
  type Accumulator,
} from "@/lib/screenTime/session";

/**
 * The single owner of screen-time accrual.
 *
 * Mounted once in AppShell, which the root layout renders and route changes do
 * not remount — so one interval runs for the whole app and navigation never
 * restarts it. No page mounts a timer of its own.
 *
 * What it counts is ACTIVE, VISIBLE time. Wall-clock counting billed a child
 * for a tab left open on a sleeping laptop; the accumulator only advances
 * while the document is visible, and a suspiciously large jump (a machine
 * resuming from sleep) is discarded rather than charged.
 *
 * Sub-minute time is kept in a remainder and persisted, so moving between
 * screens — or closing the tab — no longer throws away partial minutes. That
 * was exploitable: navigating every 30 seconds accrued nothing at all.
 *
 * With several tabs open, exactly one accrues. Tabs elect a leader through a
 * heartbeat in localStorage, so three tabs cost one minute a minute rather
 * than three.
 *
 * The server stays authoritative. The client decides when to WRITE a minute,
 * never how many minutes exist: totals and limits are re-read from Supabase on
 * a slow timer, so clearing local state, refreshing or opening a second device
 * cannot restore a spent allowance.
 */

/** How often the accumulator folds in elapsed active time. */
const TICK_MS = 5_000;
/**
 * How often limits and the server total are re-read (parent changes, other
 * devices, midnight). Slow on purpose — a background correctness check, not a
 * live feed.
 */
const RESYNC_MS = 5 * 60_000;

const LEADER_KEY = "chessmind-st-leader";
const REMAINDER_KEY = "chessmind-st-remainder";

/** Surfaces whose time is not the child's play time. */
const EXCLUDED_PREFIXES = [
  "/parent-dashboard",
  "/parent-gate",
  "/sign-in",
  "/forgot-password",
  "/reset-password",
  "/choose-child",
  "/upgrade",
  "/dev/",
];

export function isExcludedPath(pathname: string): boolean {
  return EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

/**
 * A live online game is not interrupted.
 *
 * Blocking mid-game would abandon a real opponent and, in a rated game, cost
 * the child material and rating through no fault of their own. The chess clock
 * bounds how long this defers for, time keeps accruing throughout, and the
 * overlay appears the moment they leave the board.
 */
function deferOverlay(pathname: string): boolean {
  return pathname.startsWith("/online/");
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode — degrade to single-tab behaviour */
  }
}

export function ScreenTimeTracker() {
  const pathname = usePathname();
  const [blocked, setBlocked] = useState(false);
  const [limitMinutes, setLimitMinutes] = useState<number | null>(null);
  const [usedMinutes, setUsedMinutes] = useState(0);

  // Refs so nothing here can restart the interval.
  const childIdRef = useRef<string | null>(null);
  const limitRef = useRef<number | null>(null);
  const usedRef = useRef(0);
  const accRef = useRef<Accumulator>({ remainderMs: 0, date: dateKey(new Date()) });
  const lastTickRef = useRef<number>(Date.now());
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const selfIdRef = useRef<string>(Math.random().toString(36).slice(2));
  const lastResyncRef = useRef<number>(0);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    const selfId = selfIdRef.current;

    // Restore a partial minute left by a previous tab or a reload.
    const savedRemainder = readStorage(REMAINDER_KEY);
    if (savedRemainder) {
      try {
        const parsed = JSON.parse(savedRemainder);
        if (parsed?.date === dateKey(new Date()) && typeof parsed.remainderMs === "number") {
          accRef.current = { remainderMs: parsed.remainderMs, date: parsed.date };
        }
      } catch {
        /* ignore malformed state */
      }
    }

    async function resync(): Promise<void> {
      const user = await getVerifiedUser(supabase);
      if (!user || cancelled) return;

      let childId = childIdRef.current;
      if (!childId) {
        // Resolve the child the way every other surface does. The active-child
        // cookie is not set straight after sign-in, and requiring it meant the
        // tracker accrued nothing for that whole session.
        const resolution = await resolveActiveChild(supabase, user.id, getActiveChildIdClient());
        childId = resolution.child?.id ?? null;
        if (!childId || cancelled) return;
        childIdRef.current = childId;
      }

      const [limits, used] = await Promise.all([
        getScreenTimeLimits(supabase, user.id),
        getTodayUsageMinutes(supabase, childId, dateKey(new Date())),
      ]);
      if (cancelled) return;

      const limit = pickLimit(new Date(), limits);
      limitRef.current = limit;
      usedRef.current = used;
      setLimitMinutes(limit);
      setUsedMinutes(used);
      setBlocked(isBlocked(used, limit));
      lastResyncRef.current = Date.now();
    }

    void resync().catch(() => {
      /* Screen time must never break the app; no enforcement beats a blank page. */
    });

    const interval = window.setInterval(() => {
      void (async () => {
        if (cancelled) return;
        const now = Date.now();
        const elapsed = now - lastTickRef.current;
        lastTickRef.current = now;

        // Leader election: only one tab accrues.
        const record = parseLeader(readStorage(LEADER_KEY));
        const mayAccrue = shouldClaimLeadership(record, selfId, now);
        if (mayAccrue) writeStorage(LEADER_KEY, JSON.stringify({ id: selfId, ts: now }));

        const visible =
          typeof document === "undefined" || document.visibilityState === "visible";
        const excluded = isExcludedPath(pathRef.current);
        const childId = childIdRef.current;
        const limit = limitRef.current;

        // Periodic correctness resync, even while idle: catches a parent
        // raising the limit, another device spending time, and midnight.
        if (now - lastResyncRef.current > RESYNC_MS) {
          await resync().catch(() => {});
          return;
        }

        if (!childId || limit === null) return;
        // Stop the meter once blocked; a locked child is not spending time.
        if (!mayAccrue || !visible || excluded || usedRef.current >= limit) return;

        const result = accumulate(accRef.current, elapsed, new Date());
        accRef.current = result.accumulator;
        writeStorage(
          REMAINDER_KEY,
          JSON.stringify({
            date: result.accumulator.date,
            remainderMs: result.accumulator.remainderMs,
          })
        );

        if (result.dayRolled) {
          // New day: new allowance, and the lock lifts.
          await resync().catch(() => {});
          return;
        }
        if (result.minutesToCommit <= 0) return;

        try {
          const total = await addUsageMinutes(
            supabase,
            childId,
            dateKey(new Date()),
            result.minutesToCommit
          );
          if (cancelled) return;
          usedRef.current = total;
          setUsedMinutes(total);
          if (isBlocked(total, limit)) setBlocked(true);
        } catch {
          /* transient failure — the remainder is kept, so nothing is lost */
        }
      })();
    }, TICK_MS);

    // A visibility change resets the elapsed baseline, so hidden time is not
    // folded in when the tab comes back.
    const onVisibility = () => {
      lastTickRef.current = Date.now();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Persist the partial minute when the tab goes away, and release
    // leadership so another tab takes over immediately rather than waiting for
    // the heartbeat to go stale.
    const onPageHide = () => {
      writeStorage(
        REMAINDER_KEY,
        JSON.stringify({ date: accRef.current.date, remainderMs: accRef.current.remainderMs })
      );
      const record = parseLeader(readStorage(LEADER_KEY));
      if (record?.id === selfId) {
        try {
          window.localStorage.removeItem(LEADER_KEY);
        } catch {
          /* nothing to do */
        }
      }
    };
    window.addEventListener("pagehide", onPageHide);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      onPageHide();
    };
  }, []);

  if (!blocked || limitMinutes === null) return null;
  if (isExcludedPath(pathname)) return null; // a parent must always reach the dashboard
  if (deferOverlay(pathname)) return null;

  return <TimeCompleteOverlay limitMinutes={limitMinutes} usedMinutes={usedMinutes} />;
}

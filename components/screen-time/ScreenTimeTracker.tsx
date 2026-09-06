"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import {
  addUsageMinutes,
  getScreenTimeLimits,
  getTodayUsageMinutes,
  localDateString,
} from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";
import { resolveActiveChild } from "@/lib/supabase/queries";
import { Card } from "@/components/ui/Card";

/**
 * The one owner of screen-time accrual.
 *
 * A parent who sets "60 minutes on a weekday" means sixty minutes of using
 * Chess Mind, not sixty minutes on a subset of its screens. Accrual previously
 * lived inside ScreenTimeGate, which wraps only four surfaces — Kingdom Map,
 * its customize page, the day lessons and Welcome. Everything else counted for
 * nothing: playing a real game at /online, Free Play, the Puzzle Trainer, every
 * Academy course, every Chess Mind module. A child could play chess all
 * afternoon and the parent's limit would never be approached, let alone hit.
 *
 * It also lost time on every navigation. The 60-second interval lived in a page
 * component, so moving between screens before it fired discarded that partial
 * minute entirely; a child tapping between tabs could stay under the limit
 * indefinitely.
 *
 * Mounting here in AppShell fixes both: AppShell is mounted once by the root
 * layout and is NOT remounted by route changes, so the tick keeps running
 * across navigation and covers every screen the shell wraps.
 *
 * Accrual is deliberately skipped on parent and auth screens — a parent
 * adjusting settings is not the child using their allowance.
 */

const TICK_MS = 60_000;

/** Routes where time must not be charged to the child. */
const EXCLUDED = [
  "/parent-dashboard",
  "/parent-gate",
  "/sign-in",
  "/forgot-password",
  "/reset-password",
  "/choose-child",
  "/upgrade",
  "/dev/",
];

function isExcluded(pathname: string): boolean {
  return EXCLUDED.some((p) => pathname === p || pathname.startsWith(p));
}

export function ScreenTimeTracker() {
  const pathname = usePathname();
  const [locked, setLocked] = useState(false);

  // Refs so the interval never restarts when these change — restarting is what
  // used to throw away partial minutes.
  const childIdRef = useRef<string | null>(null);
  const limitRef = useRef<number | null>(null);
  const usedRef = useRef(0);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function init() {
      try {
        const user = await getVerifiedUser(supabase);
        if (!user || cancelled) return;
        // Resolve the child the same way every other surface does, rather than
        // trusting the cookie alone: straight after sign-in the active-child
        // cookie may not be set yet, and requiring it meant the tracker
        // silently accrued nothing for that whole session. resolveActiveChild
        // falls back to the parent's child when the cookie is absent.
        const resolution = await resolveActiveChild(
          supabase,
          user.id,
          getActiveChildIdClient()
        );
        const childId = resolution.child?.id ?? null;
        if (!childId || cancelled) return;

        const limits = await getScreenTimeLimits(supabase, user.id);
        const day = new Date().getDay();
        const limit = day === 0 || day === 6 ? limits.weekendMinutes : limits.weekdayMinutes;
        const used = await getTodayUsageMinutes(supabase, childId, localDateString());
        if (cancelled) return;

        childIdRef.current = childId;
        limitRef.current = limit;
        usedRef.current = used;
        if (limit > 0 && used >= limit && !isExcluded(pathRef.current)) setLocked(true);
      } catch {
        // Screen time must never break the app. A failed read simply means no
        // enforcement this session rather than a blank screen.
      }
    }
    void init();

    const interval = setInterval(async () => {
      if (cancelled) return;
      const childId = childIdRef.current;
      const limit = limitRef.current;
      if (!childId || limit === null) return;
      // Don't charge parent/auth time to the child, and stop counting once the
      // limit is reached — the total should not run away while locked.
      if (isExcluded(pathRef.current) || usedRef.current >= limit) return;

      try {
        const total = await addUsageMinutes(supabase, childId, localDateString(), 1);
        if (cancelled) return;
        usedRef.current = total;
        if (limit > 0 && total >= limit) setLocked(true);
      } catch {
        /* transient failure — try again next tick */
      }
    }, TICK_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Leaving a child screen for a parent screen must lift the overlay, so a
  // parent can always reach the dashboard to change the limit.
  if (!locked || isExcluded(pathname)) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Daily screen time reached"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-premium-midnight px-6"
    >
      <Card className="flex w-full max-w-sm flex-col items-center gap-5 text-center">
        <span className="text-6xl" aria-hidden="true">
          🌙
        </span>
        <h1 className="font-display text-2xl text-kingdom-night">Time to rest for today!</h1>
        <p className="font-body text-kingdom-night/70">
          You&apos;ve used up today&apos;s Chess Mind time. Come back tomorrow.
        </p>
      </Card>
    </div>
  );
}

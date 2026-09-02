"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import {
  addUsageMinutes,
  getScreenTimeLimits,
  getTodayUsageMinutes,
  localDateString,
} from "@/lib/supabase/queries";
import { Card } from "@/components/ui/Card";

const CHECK_INTERVAL_MS = 60_000; // sync + re-check once per minute

function isWeekend(d: Date = new Date()): boolean {
  const day = d.getDay(); // 0 = Sunday, 6 = Saturday
  return day === 0 || day === 6;
}

/**
 * Wraps any child-facing screen (Kingdom Map, lesson pages) and enforces the
 * parent's daily screen-time limit. Checks once per minute rather than
 * continuously — per the product plan, a limit should pause play at a
 * natural checkpoint, not yank the screen away mid-click. A once-a-minute
 * check is a reasonable approximation of that without needing to know
 * where every "natural checkpoint" is in every screen that uses this.
 *
 * `initialLimitMinutes`/`initialUsedMinutes` are optional: pass them when
 * the caller is a Server Component that already resolved the user/child on
 * this same request (see getScreenTimeStatus in lib/supabase/queries.ts) —
 * this skips the client-side auth.getUser() + two more sequential queries
 * that would otherwise blank the whole screen out again on every visit,
 * even though the server already rendered the real content a moment
 * earlier. Callers that can't do that server-side resolution (client-
 * rendered pages that discover childId asynchronously) can omit them and
 * keep the original fetch-then-render behavior unchanged.
 */
export function ScreenTimeGate({
  childId,
  initialLimitMinutes,
  initialUsedMinutes,
  children,
}: {
  childId: string;
  initialLimitMinutes?: number;
  initialUsedMinutes?: number;
  children: ReactNode;
}) {
  const hasInitial = initialLimitMinutes !== undefined && initialUsedMinutes !== undefined;
  const initiallyLocked = hasInitial && initialUsedMinutes! >= initialLimitMinutes!;

  const [status, setStatus] = useState<"loading" | "ok" | "locked">(
    hasInitial ? (initiallyLocked ? "locked" : "ok") : "loading"
  );
  const limitRef = useRef<number>(initialLimitMinutes ?? 0);
  const usedRef = useRef<number>(initialUsedMinutes ?? 0);
  const lockedRef = useRef(initiallyLocked);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function init() {
      const user = await getVerifiedUser(supabase);
      if (!user || cancelled) return;

      const limits = await getScreenTimeLimits(supabase, user.id);
      const limitMinutes = isWeekend() ? limits.weekendMinutes : limits.weekdayMinutes;
      const today = localDateString();
      const usedMinutes = await getTodayUsageMinutes(supabase, childId, today);

      if (cancelled) return;
      limitRef.current = limitMinutes;
      usedRef.current = usedMinutes;
      const alreadyOver = usedMinutes >= limitMinutes;
      lockedRef.current = alreadyOver;
      setStatus(alreadyOver ? "locked" : "ok");
    }

    // The OK state from the server render is trusted as-is (no flash from a
    // redundant round trip). But a LOCKED state is re-verified client-side
    // first: getScreenTimeStatus computes "today" with the server's own
    // (UTC) clock, so for a user whose local date has already rolled past
    // midnight it reads yesterday's usage total and wrongly locks the Home
    // screen until UTC midnight (a ~5.5h nightly window in IST). init()
    // re-checks with the device-local date/weekday before the lock sticks.
    if (!hasInitial || initiallyLocked) init();

    const interval = setInterval(async () => {
      if (cancelled || lockedRef.current) return;
      const today = localDateString();
      const newTotal = await addUsageMinutes(supabase, childId, today, 1);
      usedRef.current = newTotal;
      if (newTotal >= limitRef.current) {
        lockedRef.current = true;
        setStatus("locked");
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId]);

  if (status === "loading") {
    return <main className="min-h-screen" />;
  }

  if (status === "locked") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-6 px-6">
        <Card className="max-w-sm w-full flex flex-col items-center gap-5 text-center">
          <span className="text-6xl">🌙</span>
          <h1 className="font-display text-2xl text-kingdom-night">
            Time to rest for today!
          </h1>
          <p className="font-body text-kingdom-night/70">
            You've used up today's Kingdom time. Come back tomorrow for more adventure!
          </p>
        </Card>
      </main>
    );
  }

  return <>{children}</>;
}

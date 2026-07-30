"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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
 * Renders nothing (a blank loading state) until the first check completes,
 * to avoid a flash of playable content before we know whether time's up.
 */
export function ScreenTimeGate({ childId, children }: { childId: string; children: ReactNode }) {
  const [status, setStatus] = useState<"loading" | "ok" | "locked">("loading");
  const limitRef = useRef<number>(0);
  const usedRef = useRef<number>(0);
  const lockedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
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

    init();

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

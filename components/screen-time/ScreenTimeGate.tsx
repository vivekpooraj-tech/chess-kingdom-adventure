"use client";

import { ReactNode } from "react";

/**
 * Retired. Renders its children and nothing else.
 *
 * This used to own screen-time accrual and blocking for the four screens it
 * wrapped (Kingdom Map, its customize page, the day lessons, Welcome). Both
 * jobs now belong to ScreenTimeTracker, which AppShell mounts once for the
 * whole app — so the gate covered a fraction of the app while the tracker
 * covers all of it, and keeping its 60-second poller running alongside would
 * mean two intervals and two sources of truth for the same lock.
 *
 * Kept as a pass-through rather than deleted so the four call sites keep their
 * existing structure; its props are accepted and ignored. New code should not
 * use it.
 *
 * One deliberate trade-off: those pages previously received the blocked state
 * from the server and could lock before first paint, whereas the tracker
 * resyncs a moment after mount. A blocked child may therefore see the page
 * briefly before the overlay appears. That is a UX delay, not a hole — the
 * server owns the totals, so the extra second cannot buy more allowance.
 */
export function ScreenTimeGate({
  children,
}: {
  childId: string;
  initialLimitMinutes?: number;
  initialUsedMinutes?: number;
  children: ReactNode;
}) {
  return <>{children}</>;
}

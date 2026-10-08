"use client";

import Link from "next/link";
import { Notice } from "./Parts";
import { usePolled } from "@/lib/watch/usePolled";
import { fetchBroadcasts, type UpcomingEvent } from "@/lib/watch/lichess";
import { monthLabel, shortDate, timeLabel } from "@/lib/watch/format";

/** The calendar: the same upcoming events as the Watch home, as one plain chronological list grouped by month. Nothing to filter or open. */
export function CalendarView() {
  const r = usePolled((s) => fetchBroadcasts(s, 100), 120000);
  const now = Date.now();

  const groups: { month: string; items: UpcomingEvent[] }[] = [];
  for (const u of r.data?.upcoming ?? []) {
    const month = monthLabel(u.startsAt, now);
    const last = groups[groups.length - 1];
    if (last && last.month === month) last.items.push(u);
    else groups.push({ month, items: [u] });
  }

  return (
    <section className="wt-game" aria-label="Calendar">
      <Link href="/watch" className="wt-back">
        ← Back to Watch
      </Link>
      <h1 className="wt-game__title">Calendar</h1>
      {r.status === "loading" && <Notice title="Finding upcoming events..." />}
      {r.status === "error" && !r.data && <Notice tone="error" title="Couldn't load upcoming events." onRetry={r.retry} />}
      {r.data && groups.length === 0 && <p className="wt-empty">No upcoming chess events right now.</p>}
      {groups.map((g) => (
        <section key={g.month} className="wt-month" aria-label={g.month}>
          <h2 className="wt-h2">{g.month}</h2>
          <ul className="wt-cal">
            {g.items.map((u) => (
              <li key={u.tourId} className="wt-cal__row">
                <time className="wt-cal__date" dateTime={new Date(u.startsAt).toISOString()}>
                  {shortDate(u.startsAt)}
                </time>
                <span className="wt-cal__name">{u.name}</span>
                <span className="wt-cal__time">{timeLabel(u.startsAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}

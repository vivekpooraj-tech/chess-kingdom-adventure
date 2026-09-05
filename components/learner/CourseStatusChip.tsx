"use client";

import { useEffect, useState } from "react";

/**
 * Real completion status for one course, shown on the Learn page.
 *
 * Renders nothing until real data arrives, and nothing at all for a signed-out
 * visitor or a failed read. That is deliberate: an empty slot is honest, while
 * a "0 of 6" for someone whose progress simply could not be loaded is not.
 *
 * There are no percentages here. A lesson is either complete or it is not, so
 * the chip counts completed lessons and says so.
 *
 * All instances share one request. Several chips render on the Learn page and
 * each firing its own fetch would put the page straight back into the
 * per-visit request pattern an earlier performance pass removed.
 */

let inflight: Promise<Set<string>> | null = null;

function loadCompleted(): Promise<Set<string>> {
  if (!inflight) {
    inflight = fetch("/api/academy/progress")
      .then((r) => (r.ok ? r.json() : { completed: [] }))
      .then((j: { completed?: string[] }) => new Set(j.completed ?? []))
      .catch(() => new Set<string>());
  }
  return inflight;
}

export function CourseStatusChip({
  courseId,
  lessonIds,
}: {
  courseId: string;
  lessonIds: string[];
}) {
  const [done, setDone] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadCompleted().then((completed) => {
      if (cancelled) return;
      setDone(lessonIds.filter((id) => completed.has(`${courseId}:${id}`)).length);
    });
    return () => {
      cancelled = true;
    };
  }, [courseId, lessonIds]);

  if (done === null) return null;

  const total = lessonIds.length;
  const label = done === 0 ? "Start" : done >= total ? "Mastered" : `${done} of ${total}`;
  const complete = done >= total && total > 0;

  return (
    <span
      className={`font-classic-body text-[11px] font-semibold rounded-full px-2 py-1 whitespace-nowrap flex-none border ${
        complete
          ? "border-premium-gold/50 text-premium-gold bg-premium-gold/10"
          : "border-white/15 text-premium-ivory/70"
      }`}
    >
      {label}
    </span>
  );
}

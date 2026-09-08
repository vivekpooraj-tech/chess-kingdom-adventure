/**
 * The Learn page's single source of completed-lesson ids on the client.
 *
 * Learn is deliberately a static server page with no server-side Supabase
 * calls (see app/(tabs)/learn/page.tsx), so every personalized element on it is
 * a client island that fills in afterwards. Several of those islands render at
 * once — the per-course status chips and the learning path panel — and each
 * firing its own request would put the page straight back into the per-visit
 * request pattern an earlier performance pass removed.
 *
 * So the fetch lives here, once, and every island shares the same in-flight
 * promise. This module was extracted from CourseStatusChip when the second
 * consumer arrived; the behaviour is unchanged.
 *
 * Ids come back in the `courseId:lessonId` form used by child_academy_progress
 * (see /api/academy/progress). A failed read resolves to an EMPTY set, and
 * callers are expected to render nothing rather than a confident zero — an
 * empty slot is honest, "0 of 6" for someone whose progress merely failed to
 * load is not.
 */
let inflight: Promise<Set<string>> | null = null;

export function loadCompletedLessonIds(): Promise<Set<string>> {
  if (!inflight) {
    inflight = fetch("/api/academy/progress")
      .then((r) => (r.ok ? r.json() : { completed: [] }))
      .then((j: { completed?: string[] }) => new Set(j.completed ?? []))
      .catch(() => new Set<string>());
  }
  return inflight;
}

/** How many of `lessonIds` are complete for `courseId`. */
export function countCompleted(
  completed: ReadonlySet<string>,
  courseId: string,
  lessonIds: readonly string[]
): number {
  return lessonIds.filter((id) => completed.has(`${courseId}:${id}`)).length;
}

/** Test seam only — resets the shared promise so a suite can re-exercise it. */
export function __resetAcademyProgressCache(): void {
  inflight = null;
}

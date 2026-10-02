import { redirect } from "next/navigation";

/**
 * Phase 8A — V1 Closeout root flip.
 *
 * /chess-school is the primary "School" nav tab's destination
 * (components/nav/navConfig.tsx). It used to land on the V1 day-based course
 * page (now dormant at /chess-school/legacy — see that file). Chess School
 * V2 (the real, intended curriculum: 30 sessions, its own progress/access
 * model, migration 0043) already lived at /chess-school/classroom, one tap
 * deeper, so the tab literally named "School" did not show the school being
 * shipped.
 *
 * This redirect is the entire fix. /chess-school/classroom already resolves
 * its own auth (-> /sign-in) and child selection (-> /choose-child) exactly
 * like the old V1 page did (see lib/school/v2/server.ts's
 * loadSchoolPageContext), so a bare redirect here introduces no auth gap.
 * Parent Lock's chess_school activity allow-list
 * (lib/parentLock/activities.ts: ["/chess-school", "/lesson"]) is
 * prefix-matched, so /chess-school/classroom was already covered before
 * this change — nothing there needed to change either.
 *
 * No V1 code or data was deleted: children.current_day and
 * child_lesson_progress are untouched, and the V1 page itself still exists,
 * dormant, at /chess-school/legacy.
 */
export default function ChessSchoolRootPage() {
  redirect("/chess-school/classroom");
}

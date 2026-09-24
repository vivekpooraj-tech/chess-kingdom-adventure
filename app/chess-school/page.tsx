import { redirect } from "next/navigation";

/**
 * V1 "Kingdom Journey" course index — retired as the canonical Chess
 * School. content/lessons.ts, child_lesson_progress, children.current_day,
 * /lesson/[dayId] and every achievement keyed off them are untouched and
 * still fully functional; only this index page's own URL now forwards to
 * the real canonical course home. See the route-migration audit this
 * session for why this is safe: the two progress systems
 * (child_lesson_progress vs child_school_progress) are fully disjoint, nothing
 * else depends on this exact path (Parent Lock's "/chess-school" allow-list
 * is a prefix match that already covers /chess-school/classroom), and no
 * evidence exists of real user progress on the V1 path to preserve.
 */
export default function ChessSchoolPage() {
  redirect("/chess-school/classroom");
}

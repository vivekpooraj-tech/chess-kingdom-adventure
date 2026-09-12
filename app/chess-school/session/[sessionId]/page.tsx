import { notFound, redirect } from "next/navigation";
import { getSessionById } from "@/content/school/sessions";
import { SessionRunner } from "@/components/school/v2/SessionRunner";
import { canOpenSession } from "@/lib/school/v2/access";
import { loadSchoolPageContext } from "@/lib/school/v2/server";

export const metadata = {
  title: "Chess School · Session",
};

/**
 * One session. Full-screen — no tab chrome — because the board needs the
 * height, exactly as /lesson/[dayId] renders bare.
 *
 * ACCESS IS DECIDED HERE, ON THE SERVER. A free account asking for session 7
 * is redirected to the classroom before any content renders; the client-side
 * lock in the runner is only a second line for progress gating (session
 * order), not for paid access. That split matters: progress can safely be
 * enriched from the device, entitlement never can.
 */
export default async function SessionPage({ params }: { params: { sessionId: string } }) {
  const session = getSessionById(params.sessionId);
  if (!session) notFound();

  const { child, progress, access } = await loadSchoolPageContext();
  if (!canOpenSession(access, session.number)) redirect("/chess-school/classroom");

  return (
    <SessionRunner
      session={session}
      childId={child.id}
      childName={child.display_name}
      initialProgress={progress}
    />
  );
}

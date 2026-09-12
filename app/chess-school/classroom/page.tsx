import { TabPageShell } from "@/components/nav/TabPageShell";
import { SchoolHome } from "@/components/school/v2/SchoolHome";
import { loadSchoolPageContext } from "@/lib/school/v2/server";

export const metadata = {
  title: "Chess School · Classroom",
  description: "From zero to playing with real people — in 30 extraordinary sessions.",
};

/**
 * Chess School V2's home.
 *
 * WHY /chess-school/classroom AND NOT /chess-school. The root is the live V1
 * course page (the framing layer over the Kingdom Journey), and the brief
 * forbids breaking it. Living UNDER /chess-school rather than beside it is
 * not just politeness: Parent Lock's Chess Time maps the "Chess School"
 * activity to the /chess-school and /lesson prefixes, so a V2 mounted at
 * /school would bounce a child out of the classroom mid-session whenever
 * Chess Time was on. This path inherits that allow-list, and the app nav
 * chrome, without a single Parent Lock file changing.
 */
export default async function ClassroomPage() {
  const { child, progress, access } = await loadSchoolPageContext();
  return (
    <TabPageShell>
      <SchoolHome
        childId={child.id}
        childName={child.display_name}
        initialProgress={progress}
        access={access}
      />
    </TabPageShell>
  );
}

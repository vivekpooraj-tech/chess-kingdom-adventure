import { TabPageShell } from "@/components/nav/TabPageShell";
import { ParentView } from "@/components/school/v2/ParentView";
import { loadSchoolPageContext } from "@/lib/school/v2/server";

export const metadata = {
  title: "Chess School · For parents",
};

/**
 * Progress for the grown-up, in the grown-up's language.
 *
 * Nothing on this page is a score. It is a short list of things the child
 * can now do — each one a claim the app will stand behind because the session
 * that teaches it is complete — the module they are in, what comes next, and
 * one concrete thing to try together tonight. A parent who does not know
 * chess should be able to act on every line without looking anything up.
 */
export default async function SchoolParentPage() {
  const { child, progress } = await loadSchoolPageContext();
  return (
    <TabPageShell>
      <ParentView childId={child.id} name={child.display_name} initialProgress={progress} />
    </TabPageShell>
  );
}

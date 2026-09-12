import { TabPageShell } from "@/components/nav/TabPageShell";
import { CertificateView } from "@/components/school/v2/CertificateView";
import { loadSchoolPageContext } from "@/lib/school/v2/server";

export const metadata = {
  title: "Chess School · Graduate",
};

/**
 * The certificate.
 *
 * It exists only once the child has finished session 30 — win or lose the
 * duel. Before that it is a locked destination with an honest count, not a
 * preview with placeholder text, because a certificate that can be seen
 * before it is earned is not worth earning.
 */
export default async function GraduatePage() {
  const { child, progress } = await loadSchoolPageContext();
  return (
    <TabPageShell>
      <CertificateView childId={child.id} childName={child.display_name} initialProgress={progress} />
    </TabPageShell>
  );
}

import Link from "next/link";
import { TabPageShell } from "@/components/nav/TabPageShell";
import { Button } from "@/components/ui/Button";
import { SchoolChip } from "@/components/school/v2/Coach";
import { TEXT } from "@/lib/designSystem";
import { SCHOOL_ACTS } from "@/content/school/modules";
import { getSession } from "@/content/school/sessions";
import { moduleProgress } from "@/lib/school/v2/progress";
import { loadSchoolPageContext } from "@/lib/school/v2/server";

export const metadata = {
  title: "Chess School · Modules",
};

/**
 * The eight modules as an overview — the shape of the course at a glance,
 * without every session listed. The classroom home already carries the full
 * map; this is the page for a child (or parent) who wants to see the arc:
 * four acts, eight modules, and which one they are in.
 */
export default async function ModulesPage() {
  const { progress } = await loadSchoolPageContext();
  const modules = moduleProgress(progress);

  return (
    <TabPageShell>
      <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pb-20 pt-4">
        <header>
          <p className={`${TEXT.meta} text-premium-gold`}>CHESS SCHOOL</p>
          <h1 className={`${TEXT.display} mt-1`}>Eight modules. Four acts.</h1>
          <p className={`${TEXT.caption} mt-1`}>Each module is a handful of sessions about one idea.</p>
        </header>

        <ol className="space-y-3">
          {modules.map(({ module, completed, total, isCurrent }) => {
            const starred = module.sessionNumbers
              .map(getSession)
              .filter((s) => s && s.starred)
              .map((s) => s!.title);
            return (
              <li
                key={module.id}
                className={`rounded-premiumCard border p-5 ${
                  isCurrent ? "border-premium-gold/40 bg-premium-gold/[0.06]" : "border-white/10 bg-white/[0.04]"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <SchoolChip>{SCHOOL_ACTS[module.act]}</SchoolChip>
                  {isCurrent ? <SchoolChip tone="gold">You are here</SchoolChip> : null}
                  {completed === total ? <SchoolChip tone="gold">Done</SchoolChip> : null}
                </div>
                <p className={`${TEXT.subheading} mt-3`}>
                  {module.number}. {module.title}
                </p>
                <p className={`${TEXT.body} mt-1`}>{module.blurb}</p>
                <p className={`${TEXT.caption} mt-3`}>
                  {completed} of {total} session{total === 1 ? "" : "s"}
                  {starred.length ? ` · Big moment${starred.length === 1 ? "" : "s"}: ${starred.join(", ")}` : ""}
                </p>
              </li>
            );
          })}
        </ol>

        <Link href="/chess-school/classroom">
          <Button tone="premium" block>
            Back to the classroom
          </Button>
        </Link>
      </main>
    </TabPageShell>
  );
}

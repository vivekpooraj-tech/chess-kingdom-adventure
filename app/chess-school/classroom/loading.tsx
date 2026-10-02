import { TabPageShell } from "@/components/nav/TabPageShell";
import { WorldScope } from "@/components/layout/WorldScope";
import { SkeletonBlock } from "@/components/ui/Skeleton";

/**
 * V1 P1 fix #3 — streamed instantly by Next.js while page.tsx resolves the
 * child/progress/access context (loadSchoolPageContext), so a tap on the
 * "School" tab gets immediate visual feedback instead of a blank screen for
 * the round trip. Mirrors SchoolHome's real shape (header, one big
 * continue-style action, an "up next" card, a "what you can do now" card) —
 * only shapes, never numbers: no session count, no claim text, no Premium
 * state is guessed here, since all of that is real progress data this
 * skeleton has no access to yet.
 */
export default function ChessSchoolClassroomLoading() {
  return (
    <WorldScope>
    <TabPageShell>
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pb-20 pt-4">
        <header className="flex flex-col gap-2">
          <div className="h-3 w-24 rounded bg-premium-navy/70 animate-pulse" />
          <div className="h-8 w-full max-w-sm rounded bg-premium-navy/70 animate-pulse" />
          <div className="h-3 w-40 rounded bg-premium-navy/60 animate-pulse" />
        </header>

        <p className="font-classic-body text-sm text-premium-ivory/40" role="status">
          Loading your classroom…
        </p>

        <SkeletonBlock className="w-full h-20" />

        <SkeletonBlock className="w-full h-14" />

        <SkeletonBlock className="w-full h-28" />

        <SkeletonBlock className="w-full h-24" />
      </div>
    </TabPageShell>
    </WorldScope>
  );
}

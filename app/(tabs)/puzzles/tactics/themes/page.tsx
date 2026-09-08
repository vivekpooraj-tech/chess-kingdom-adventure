import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { resolveActiveChild, getSolvedPuzzleIds } from "@/lib/supabase/queries";
import { ACTIVE_CHILD_COOKIE_NAME } from "@/lib/childSession";
import { getTacticsLibrary } from "@/lib/puzzles/tacticsLibrary.server";
import { themeProgress, totalThemesSolved, startedThemeCount } from "@/lib/puzzles/tacticsProgress";
import { getSkill } from "@/lib/analysis/skills";
import { TabPageShell } from "@/components/nav/TabPageShell";
import { TEXT } from "@/lib/designSystem";

export const metadata = {
  title: "Puzzle Themes · Chess Mind",
  description: "Browse the tactics library by theme — forks, pins, skewers and more.",
};

/**
 * The Puzzle Theme Browser (Phase E1).
 *
 * The 5,000-puzzle tactics library already has real themes — every puzzle is
 * tagged with one of 10 skills across 3 tiers, 30 buckets total (see
 * lib/puzzles/tacticsLibrary.server.ts) — but the only way to reach one
 * before this page was the `?skill=` handoff from a Stats recommendation.
 * This surfaces the same real categories directly, with real per-child
 * progress, and nothing invented: a theme with zero puzzles in the library
 * still shows 0/0 rather than being silently hidden or given a fake count.
 *
 * A server component: the tactics library is server-only by design (a
 * 1.8MB file that must never reach the client bundle), and this page needs
 * nothing from the browser to render.
 */
export default async function PuzzleThemesPage() {
  const supabase = createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/sign-in");

  const cookieChildId = cookies().get(ACTIVE_CHILD_COOKIE_NAME)?.value ?? null;
  const resolution = await resolveActiveChild(supabase, user.id, cookieChildId);
  if (resolution.needsSelection) redirect("/choose-child");
  const child = resolution.child!;

  const [library, solvedIds] = await Promise.all([
    Promise.resolve(getTacticsLibrary()),
    getSolvedPuzzleIds(supabase, child.id),
  ]);

  const progress = themeProgress(library, solvedIds);
  const solved = totalThemesSolved(progress);
  const started = startedThemeCount(progress);

  return (
    <TabPageShell maxWidth="wide">
      <header className="w-full">
        <p className={`${TEXT.meta} text-premium-gold`}>🎯 Puzzle Themes</p>
        <h1 className={`${TEXT.display} mt-1`}>Practise by pattern</h1>
        <p className={`${TEXT.body} mt-2`}>
          {library.length.toLocaleString()} tactics puzzles, sorted into the patterns that actually
          win games. Pick one to start.
        </p>
        {solved > 0 && (
          <p className={`${TEXT.caption} normal-case mt-1`}>
            {solved} solved across {started} theme{started === 1 ? "" : "s"}.
          </p>
        )}
      </header>

      <div
        className="auto-grid w-full"
        style={{ "--grid-min": "16rem", "--grid-gap": "0.85rem" } as React.CSSProperties}
      >
        {progress.map((theme) => {
          const info = getSkill(theme.skill);
          const empty = theme.total === 0;
          return (
            <Link
              key={theme.skill}
              href={empty ? "#" : `/puzzles/tactics?skill=${theme.skill}`}
              aria-disabled={empty}
              className={`rounded-premiumCard border p-4 flex flex-col gap-2 transition-colors ${
                empty
                  ? "border-white/5 bg-white/[0.02] opacity-50 pointer-events-none"
                  : "border-white/10 bg-premium-navy hover:border-premium-gold/40 active:scale-[0.98]"
              } transition-transform duration-100 motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/60`}
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl" aria-hidden="true">
                  {info.emoji}
                </span>
                <p className="font-classic-display text-base text-premium-ivory">{info.name}</p>
              </div>
              <p className={`${TEXT.caption} normal-case`}>{info.description}</p>

              {!empty && (
                <>
                  <div
                    role="progressbar"
                    aria-valuenow={theme.solved}
                    aria-valuemin={0}
                    aria-valuemax={theme.total}
                    aria-label={`${info.name}: ${theme.solved} of ${theme.total} solved`}
                    className="h-1.5 w-full rounded-full bg-premium-ivory/10 overflow-hidden mt-1"
                  >
                    <div
                      className="h-full rounded-full bg-premium-gold transition-[width] duration-500 ease-out motion-reduce:transition-none"
                      style={{ width: `${theme.percentComplete}%` }}
                    />
                  </div>
                  <p className={`${TEXT.caption} normal-case tabular-nums`}>
                    {theme.solved} / {theme.total} solved
                  </p>
                </>
              )}
              {empty && <p className={`${TEXT.caption} normal-case`}>Not in the library yet.</p>}
            </Link>
          );
        })}
      </div>

      <Link
        href="/puzzles/tactics"
        className={`${TEXT.caption} normal-case underline underline-offset-4 hover:text-premium-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/60 rounded`}
      >
        Or just start practising, any theme →
      </Link>
    </TabPageShell>
  );
}

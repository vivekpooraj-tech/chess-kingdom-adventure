import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { resolveActiveChild, getCompletedDays } from "@/lib/supabase/queries";
import { ACTIVE_CHILD_COOKIE_NAME } from "@/lib/childSession";
import { PARENT_PREMIUM_COLUMNS, resolvePremiumState } from "@/lib/premium/entitlement";
import { LESSONS } from "@/content/lessons";
import { isDayFree } from "@/content/kingdomZones";
import { TabPageShell } from "@/components/nav/TabPageShell";
import { TEXT } from "@/lib/designSystem";
import { CourseJourney } from "@/components/school/CourseJourney";
import { GraduationPanel } from "@/components/school/GraduationPanel";
import {
  COURSE_NAME,
  COURSE_TITLE,
  COURSE_TAGLINE,
  chessSchoolProgress,
  schoolSummary,
  continueLabel,
  continueHref,
  dayOfLabel,
} from "@/lib/school/chessSchool";
import { prefersNeutralHomeTone } from "@/lib/learner/experienceLevel";

export const metadata = {
  title: "Chess School · Chess Mind",
  description: "Speak Chess in 30 Days — learn chess step by step, one day at a time.",
};

/**
 * Chess School — the course home.
 *
 * Home lists the thirty day cards and answers "what next"; this page answers
 * "what is this course, what am I learning, and how far through am I". It is
 * deliberately the LIGHTEST personalised page in the app: the active child,
 * their completed days and the premium row. Three reads, two of them in
 * parallel. No stats, no quests, no achievements — those live on Home and
 * re-fetching them here would be the redundant work the performance pass
 * removed elsewhere.
 *
 * Every number on this page comes from child_lesson_progress. There is no
 * placeholder progress anywhere on it: when a learner has finished nothing,
 * it says so.
 */
export default async function ChessSchoolPage() {
  const supabase = createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/sign-in");

  const cookieChildId = cookies().get(ACTIVE_CHILD_COOKIE_NAME)?.value ?? null;

  const parentPromise = Promise.resolve(
    supabase.from("parents").select(PARENT_PREMIUM_COLUMNS).eq("auth_user_id", user.id).single()
  );
  void parentPromise.catch(() => {});

  const resolution = await resolveActiveChild(supabase, user.id, cookieChildId);
  if (resolution.needsSelection) redirect("/choose-child");
  const child = resolution.child!;

  const [completedDays, { data: parent }] = await Promise.all([
    getCompletedDays(supabase, child.id),
    parentPromise,
  ]);

  const isPremium = resolvePremiumState(parent).isPremium;
  const progress = chessSchoolProgress({
    currentDay: child.current_day ?? 1,
    completedDays,
  });
  const neutralTone = prefersNeutralHomeTone(child.experience_level, child.age_band);
  const lockedDays = isPremium
    ? []
    : LESSONS.map((l) => l.dayNumber).filter((d) => !isDayFree(d));

  const resumeLesson = LESSONS.find((l) => l.dayNumber === progress.resumeDay);

  return (
    <TabPageShell maxWidth="wide">
      <header className="w-full">
        <p className={`${TEXT.meta} text-premium-gold`}>🏫 {COURSE_NAME}</p>
        <h1 className={`${TEXT.display} mt-1`}>{COURSE_TITLE}</h1>
        <p className={`${TEXT.body} mt-2`}>{COURSE_TAGLINE}</p>
      </header>

      <section
        aria-label="Your progress"
        className="w-full rounded-premiumCard bg-gradient-to-br from-premium-navyLight to-premium-navy border border-premium-gold/25 p-5 sm:p-6 flex flex-col gap-4 shadow-premiumCard"
      >
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <p className="font-classic-display text-lg text-premium-ivory">
            {progress.isComplete
              ? "Course complete"
              : dayOfLabel(progress.resumeDay, progress.totalDays)}
          </p>
          <span className="font-classic-body text-[11px] text-premium-ivory/55 tabular-nums border border-white/10 rounded-full px-2.5 py-1">
            {progress.completedCount} / {progress.totalDays}
          </span>
        </div>

        <div>
          <div
            role="progressbar"
            aria-valuenow={progress.completedCount}
            aria-valuemin={0}
            aria-valuemax={progress.totalDays}
            aria-label={`${progress.completedCount} of ${progress.totalDays} days complete`}
            className="h-2 w-full rounded-full bg-premium-ivory/10 overflow-hidden"
          >
            <div
              className="h-full rounded-full bg-premium-gold transition-[width] duration-500 ease-out motion-reduce:transition-none"
              style={{ width: `${progress.percentComplete}%` }}
            />
          </div>
          <p className={`${TEXT.caption} normal-case mt-2`}>
            {schoolSummary(progress, neutralTone)}
          </p>
        </div>

        {!progress.isComplete && resumeLesson && (
          <p className={`${TEXT.caption} normal-case`}>
            Up next: <span className="text-premium-ivory/85">{resumeLesson.title}</span>
          </p>
        )}

        <Link
          href={continueHref(progress)}
          className="self-start font-classic-body text-sm font-semibold text-premium-midnight bg-premium-gold rounded-full px-5 py-2.5 min-h-[44px] flex items-center active:scale-[0.98] transition-transform duration-100 motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/60"
        >
          {continueLabel(progress)}
        </Link>
      </section>

      {/* Graduation only exists once every day is genuinely finished. */}
      {progress.isComplete && (
        <GraduationPanel completedDays={completedDays} neutralTone={neutralTone} />
      )}

      <CourseJourney
        currentDay={progress.currentDay}
        completedDays={completedDays}
        lockedDays={lockedDays}
      />

      <Link
        href="/kingdom-map#journey"
        className={`${TEXT.caption} normal-case underline underline-offset-4 hover:text-premium-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/60 rounded`}
      >
        See all {progress.totalDays} days →
      </Link>
    </TabPageShell>
  );
}

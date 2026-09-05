import { NextResponse } from "next/server";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { ACTIVE_CHILD_COOKIE_NAME } from "@/lib/childSession";
import { resolveActiveChildCached, getSkillSignals } from "@/lib/supabase/queries";
import { deriveLearnerProfile } from "@/lib/ollie/learnerContext";
import { recommendPractice, type PracticeLessonItem } from "@/lib/training/recommendation";
import { getSkill } from "@/lib/analysis/skills";

/**
 * The Learn page's "what should I learn next, and why".
 *
 * This exists as a route rather than being computed in the card itself for one
 * concrete reason: recommendPractice imports the whole content library
 * (content/puzzles.ts alone is ~192KB of source, plus ~51KB of tactics
 * lessons). Doing that work in a client component shipped all of it to the
 * browser just to choose a lesson href -- a large download and parse cost on
 * exactly the low-end phones this product is for. Computing it here keeps the
 * content server-side and sends back the handful of fields the card renders.
 *
 * Keeping it out of the page also preserves Learn's static render: the page
 * still has no server-side per-child work, and this is fetched after paint.
 *
 * Returns `{}` when there is nothing honest to recommend -- no active child,
 * no recurring weakness, or no lesson that teaches it.
 */
export async function GET() {
  const supabase = createClient();
  const user = await getSessionUser(supabase);
  if (!user) return NextResponse.json({}, { status: 401 });

  const cookieChildId = cookies().get(ACTIVE_CHILD_COOKIE_NAME)?.value ?? null;
  // Scopes to a child this user actually owns: the underlying read goes through
  // RLS on `children`, so another account's id simply resolves to nothing.
  const resolution = await resolveActiveChildCached(supabase, user.id, cookieChildId);
  const child = resolution.child;
  if (!child) return NextResponse.json({});

  const signals = await getSkillSignals(supabase, child.id).catch(() => ({}));
  const profile = deriveLearnerProfile(signals, []);
  if (!profile.focusSkill || !profile.focusSkillWeakCount) return NextResponse.json({});

  const practice = recommendPractice({
    skill: profile.focusSkill,
    experienceLevel: child.experience_level,
    ageBand: child.age_band ?? null,
  });
  const lesson = practice.items.find((i): i is PracticeLessonItem => i.kind === "lesson");
  if (!lesson) return NextResponse.json({});

  return NextResponse.json({
    title: lesson.title,
    href: lesson.href,
    skillName: getSkill(profile.focusSkill).name,
    weakCount: profile.focusSkillWeakCount,
  });
}

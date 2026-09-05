"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient, getVerifiedUser } from "@/lib/supabase/client";
import { resolveActiveChild, getSkillSignals, getRecentGameReviews } from "@/lib/supabase/queries";
import { getActiveChildIdClient } from "@/lib/childSession";
import { deriveLearnerProfile } from "@/lib/ollie/learnerContext";
import { recommendPractice, type PracticeLessonItem } from "@/lib/training/recommendation";
import { getSkill } from "@/lib/analysis/skills";
import { TEXT } from "@/lib/designSystem";

/**
 * "What should I learn next, and why?" on the Learn index.
 *
 * Learn is otherwise a flat library: six Academy sections and the Chess Mind
 * categories, identical for every child. That answers "what exists" but never
 * "what is worth my time today", which is the question a learner actually
 * arrives with.
 *
 * This is a deliberate client island rather than a server fetch. The page's
 * own comment explains why it is static -- a personalized query on every visit
 * was exactly the redundant request an earlier performance pass removed -- so
 * the static shell still renders and paints unchanged, and this card fills in
 * afterwards without ever blocking it.
 *
 * The recommendation reuses the review flow's existing skill-to-lesson mapping
 * (lib/training/recommendation.ts) rather than inventing a second one, so the
 * lesson suggested here is the same lesson the Game Review would send them to
 * for that skill.
 *
 * It renders NOTHING unless there is a genuine recurring weakness (3+ flags,
 * the existing threshold) AND a real Academy lesson that teaches it. No
 * weakness, or no lesson for it, means no card -- rather than a generic
 * "keep learning!" nudge, which teaches nothing and trains children to ignore
 * the slot.
 */
export function NextLessonCard() {
  const [rec, setRec] = useState<{ lesson: PracticeLessonItem; skillName: string; weakCount: number } | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const supabase = createClient();
        const user = await getVerifiedUser(supabase);
        if (!user) return;
        const resolution = await resolveActiveChild(supabase, user.id, getActiveChildIdClient());
        const child = resolution.child;
        if (!child) return;

        const [signals, reviews] = await Promise.all([
          getSkillSignals(supabase, child.id).catch(() => ({})),
          getRecentGameReviews(supabase, child.id).catch(() => []),
        ]);
        if (cancelled) return;

        const profile = deriveLearnerProfile(signals, reviews);
        if (!profile.focusSkill || !profile.focusSkillWeakCount) return;

        const practice = recommendPractice({
          skill: profile.focusSkill,
          experienceLevel: child.experience_level ?? null,
          ageBand: child.age_band ?? null,
        });
        const lesson = practice.items.find((i): i is PracticeLessonItem => i.kind === "lesson");
        if (!lesson) return;

        setRec({
          lesson,
          skillName: getSkill(profile.focusSkill).name,
          weakCount: profile.focusSkillWeakCount,
        });
      } catch {
        // Best-effort: Learn is fully usable without this card.
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!rec) return null;

  return (
    <Link
      href={rec.lesson.href}
      className="block w-full rounded-premiumCard border border-premium-gold/25 bg-premium-navy p-5 shadow-premiumCard transition-transform duration-100 active:scale-[0.98]"
    >
      <p className={`${TEXT.meta} text-premium-gold`}>Recommended for you</p>
      <p className="mt-1 font-classic-display text-lg text-premium-ivory">{rec.lesson.title}</p>
      {/* The "why" is the whole point of this card -- a recommendation without
          a reason is indistinguishable from a banner ad. */}
      <p className={`${TEXT.body} mt-1`}>
        {rec.skillName} has come up in {rec.weakCount} of your reviewed games. This lesson is about
        exactly that.
      </p>
      <p className="mt-2 font-classic-body text-sm font-semibold text-premium-gold">Start lesson →</p>
    </Link>
  );
}

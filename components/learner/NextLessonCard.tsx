"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TEXT } from "@/lib/designSystem";

/**
 * "What should I learn next, and why?" on the Learn index.
 *
 * Learn is otherwise a flat library: six Academy sections and the Chess Mind
 * categories, identical for every child. That answers "what exists" but never
 * "what is worth my time today", which is the question a learner arrives with.
 *
 * All of the thinking happens in /api/learn/next-lesson, deliberately. The
 * recommendation needs the content library to resolve a lesson, and importing
 * that here would ship ~240KB of puzzle and lesson source to the browser just
 * to pick a link -- a real download and parse cost on the low-end phones this
 * product targets. This component only renders the four fields it gets back.
 *
 * The page itself stays static and paints unchanged; this fills in afterwards
 * and never blocks it.
 *
 * Renders NOTHING unless there is a genuine recurring weakness (3+ flags, the
 * existing threshold) AND a real lesson teaching it -- never a generic "keep
 * learning!" nudge, which teaches nothing and trains children to ignore the
 * slot.
 */
interface NextLesson {
  title: string;
  href: string;
  skillName: string;
  weakCount: number;
}

export function NextLessonCard() {
  const [rec, setRec] = useState<NextLesson | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/learn/next-lesson")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.href) return;
        setRec(data as NextLesson);
      })
      .catch(() => {
        // Best-effort: Learn is fully usable without this card.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!rec) return null;

  return (
    <Link
      href={rec.href}
      className="block w-full rounded-premiumCard border border-premium-gold/25 bg-premium-navy p-5 shadow-premiumCard transition-transform duration-100 active:scale-[0.98]"
    >
      <p className={`${TEXT.meta} text-premium-gold`}>Recommended for you</p>
      <p className="mt-1 font-classic-display text-lg text-premium-ivory">{rec.title}</p>
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

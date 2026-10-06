"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TEXT } from "@/lib/designSystem";
import { useAtelierBranchActive } from "@/components/layout/AtelierBranch";

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

// Concurrent mounts share one request: before the page knows its world (AtelierBranch) both layouts mount for a
// moment. Only the IN-FLIGHT request is shared -- it is dropped as soon as it settles, so nothing is cached and
// every later visit to Learn asks again.
let inflight: Promise<NextLesson | null> | null = null;

function loadNextLesson(): Promise<NextLesson | null> {
  if (!inflight) {
    inflight = fetch("/api/learn/next-lesson")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => (data?.href ? (data as NextLesson) : null))
      // Best-effort: Learn is fully usable without this card.
      .catch(() => null);
    const clear = () => {
      inflight = null;
    };
    inflight.then(clear, clear);
  }
  return inflight;
}

/**
 * `variant="atelier"` is the Training Academy presentation of the SAME recommendation (same endpoint, same
 * rule, same copy): an appointment in the programme rather than a banner. It only fetches while the Atelier
 * layout is the one being shown.
 */
export function NextLessonCard({ variant = "default" }: { variant?: "default" | "atelier" }) {
  const [rec, setRec] = useState<NextLesson | null>(null);
  const active = useAtelierBranchActive();

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    loadNextLesson().then((data) => {
      if (cancelled || !data) return;
      setRec(data);
    });
    return () => {
      cancelled = true;
    };
  }, [active]);

  if (!rec) return null;

  if (variant === "atelier") {
    return (
      <Link href={rec.href} className="ta-next">
        <span className="ta-eyebrow">Next session</span>
        <span className="ta-next__title">{rec.title}</span>
        <span className="ta-next__why">
          {rec.skillName} has come up in {rec.weakCount} of your reviewed games. This lesson is about exactly that.
        </span>
        <span className="ta-cta ta-cta--ghost">Continue training <span aria-hidden="true">→</span></span>
      </Link>
    );
  }

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

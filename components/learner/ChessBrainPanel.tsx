"use client";

import Link from "next/link";
import { TEXT } from "@/lib/designSystem";
import { brainStatusLabel, type BrainSkillRow, type ChessBrainView } from "@/lib/learner/chessBrain";

/**
 * "Your Chess Brain" — what the child is good at, what keeps costing them
 * games, and what to do next.
 *
 * Shows statuses, not scores. See lib/learner/chessBrain.ts for why: the
 * recorded counters support a direction but not a magnitude, and a single
 * invented percentage would undermine every real number next to it. Each row
 * therefore carries the count it came from, so the child can see where the
 * claim came from rather than being asked to trust a bar.
 *
 * Renders nothing until there is real history — a brand-new learner gets no
 * empty scaffolding implying they should already have results.
 */

const STATUS_STYLE: Record<BrainSkillRow["status"], string> = {
  strong: "text-premium-gold border-premium-gold/30 bg-premium-gold/10",
  getting_stronger: "text-premium-gold border-premium-gold/30 bg-premium-gold/10",
  working_on_it: "text-premium-ivory/75 border-white/10 bg-premium-navyLight/50",
  needs_practice: "text-premium-ivory/75 border-white/10 bg-premium-navyLight/50",
};

function SkillRow({ row }: { row: BrainSkillRow }) {
  return (
    <li className="flex items-start gap-3 rounded-premiumBtn border border-white/5 bg-premium-navyLight/40 px-3 py-2.5">
      <span aria-hidden="true" className="text-lg leading-none pt-0.5">
        {row.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-classic-display text-sm text-premium-ivory">{row.name}</span>
          <span
            className={`rounded-full border px-2 py-0.5 font-classic-body text-[11px] ${STATUS_STYLE[row.status]}`}
          >
            {brainStatusLabel(row.status)}
          </span>
        </div>
        <p className={`${TEXT.caption} normal-case mt-0.5`}>{row.detail}</p>
      </div>
    </li>
  );
}

export function ChessBrainPanel({ view, className }: { view: ChessBrainView; className?: string }) {
  if (view.isEmpty) return null;

  return (
    <section
      aria-label="Your Chess Brain"
      className={`rounded-premiumCard bg-premium-navy shadow-premiumCard p-5 w-full flex flex-col gap-4 ${className ?? ""}`}
    >
      <div className="flex flex-col gap-1">
        <p className={`${TEXT.meta} text-premium-gold`}>Your Chess Brain</p>
        <p className={`${TEXT.caption} normal-case`}>
          Built from {view.reviewCount > 0 ? `${view.reviewCount} reviewed ` : ""}
          {view.reviewCount === 1 ? "game" : "games"} and your practice — not a score.
        </p>
      </div>

      {view.trend === "improving" && (
        <p className="rounded-premiumBtn border border-premium-gold/25 bg-premium-gold/10 px-3 py-2 font-classic-body text-sm text-premium-gold">
          Your accuracy has been climbing across recent games.
        </p>
      )}

      {view.strengths.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="font-classic-body text-[11px] font-semibold uppercase tracking-wide text-premium-ivory/50">
            What you&apos;re good at
          </p>
          <ul className="flex flex-col gap-2">
            {view.strengths.map((r) => (
              <SkillRow key={r.skill} row={r} />
            ))}
          </ul>
        </div>
      )}

      {view.areasToImprove.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="font-classic-body text-[11px] font-semibold uppercase tracking-wide text-premium-ivory/50">
            What to work on
          </p>
          <ul className="flex flex-col gap-2">
            {view.areasToImprove.map((r) => (
              <SkillRow key={r.skill} row={r} />
            ))}
          </ul>
        </div>
      )}

      {view.focus && (
        <div className="rounded-premiumBtn border border-premium-gold/20 bg-premium-navyLight/60 p-3 flex flex-col gap-2">
          <p className={`${TEXT.meta} text-premium-gold`}>Next step</p>
          <p className={TEXT.body}>
            Practise {view.focus.name.toLowerCase()} — it&apos;s the one costing you most right now.
          </p>
          {/* Points at the trainer rather than claiming a skill-filtered puzzle
              feed exists; Ollie's challenge on this same page runs the
              skill-specific set. */}
          <Link
            href="/puzzles"
            className="self-start rounded-premiumBtn bg-premium-gold px-4 py-2 font-classic-display text-sm font-semibold text-premium-midnightDeep"
          >
            Open Puzzle Trainer →
          </Link>
        </div>
      )}
    </section>
  );
}

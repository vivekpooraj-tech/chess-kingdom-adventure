import Link from "next/link";
import type { HomeLeadRecommendation } from "@/lib/home/getHomeLead";

export function HeroJourneyCard({ recommendation }: { recommendation: HomeLeadRecommendation }) {
  if (recommendation.kind === "practice") {
    return (
      <Link
        href="/puzzles"
        className="w-full h-full min-h-[180px] rounded-premiumCard bg-gradient-to-br from-premium-emerald to-premium-emeraldDeep p-5 sm:p-6 flex flex-col gap-3 shadow-premiumCard active:scale-[0.99] transition-transform duration-100"
      >
        <p className="font-classic-body text-[11px] font-bold uppercase tracking-wider text-premium-ivory/80">
          Puzzle Trainer
        </p>
        <p className="font-classic-display text-lg sm:text-xl text-premium-ivory leading-snug">
          You&apos;ve completed every lesson — time to sharpen your skills!
        </p>
        <span className="self-start mt-auto font-classic-body text-sm font-semibold text-premium-midnight bg-premium-gold rounded-full px-5 py-2.5 min-h-[44px] flex items-center">
          Solve Today&apos;s Puzzle →
        </span>
      </Link>
    );
  }

  if (recommendation.kind === "puzzles") {
    return (
      <Link
        href="/puzzles"
        className="w-full h-full min-h-[180px] rounded-premiumCard bg-gradient-to-br from-premium-emerald to-premium-emeraldDeep p-5 sm:p-6 flex flex-col gap-3 shadow-premiumCard active:scale-[0.99] transition-transform duration-100"
      >
        <p className="font-classic-body text-[11px] font-bold uppercase tracking-wider text-premium-ivory/80">
          Recommended
        </p>
        <p className="font-classic-display text-lg sm:text-xl text-premium-ivory leading-snug">
          {recommendation.title}
        </p>
        <p className="font-classic-body text-sm text-premium-ivory/65">{recommendation.subtitle}</p>
        <span className="self-start mt-auto font-classic-body text-sm font-semibold text-premium-midnight bg-premium-gold rounded-full px-5 py-2.5 min-h-[44px] flex items-center">
          Open Puzzle Trainer →
        </span>
      </Link>
    );
  }

  if (recommendation.kind === "academy") {
    return (
      <Link
        href={recommendation.href}
        className="w-full h-full min-h-[180px] rounded-premiumCard bg-gradient-to-br from-premium-navyLight to-premium-navy p-5 sm:p-6 flex flex-col gap-3 shadow-premiumCard border border-premium-gold/15 active:scale-[0.99] transition-transform duration-100"
      >
        <p className="font-classic-body text-[11px] font-bold uppercase tracking-wider text-premium-gold/90">
          Academy
        </p>
        <p className="font-classic-display text-lg sm:text-xl text-premium-ivory leading-snug">
          {recommendation.title}
        </p>
        <p className="font-classic-body text-sm text-premium-ivory/60">{recommendation.subtitle}</p>
        <span className="self-start mt-auto font-classic-body text-sm font-semibold text-premium-midnight bg-premium-gold rounded-full px-5 py-2.5 min-h-[44px] flex items-center">
          Start Training →
        </span>
      </Link>
    );
  }

  if (recommendation.kind === "play") {
    return (
      <Link
        href="/play"
        className="w-full h-full min-h-[180px] rounded-premiumCard bg-gradient-to-br from-premium-navyLight to-premium-navy p-5 sm:p-6 flex flex-col gap-3 shadow-premiumCard border border-premium-gold/15 active:scale-[0.99] transition-transform duration-100"
      >
        <p className="font-classic-body text-[11px] font-bold uppercase tracking-wider text-premium-gold/90">
          Play
        </p>
        <p className="font-classic-display text-lg sm:text-xl text-premium-ivory leading-snug">
          {recommendation.title}
        </p>
        <p className="font-classic-body text-sm text-premium-ivory/60">{recommendation.subtitle}</p>
        <span className="self-start mt-auto font-classic-body text-sm font-semibold text-premium-midnight bg-premium-gold rounded-full px-5 py-2.5 min-h-[44px] flex items-center">
          Play Now →
        </span>
      </Link>
    );
  }

  const { dayNumber, title, storyBeat, zoneEmoji, locked } = recommendation;

  return (
    <Link
      href={`/lesson/${dayNumber}`}
      className="w-full h-full min-h-[180px] rounded-premiumCard bg-gradient-to-br from-premium-navyLight to-premium-navy p-5 sm:p-6 flex flex-col gap-3 shadow-premiumCard border border-premium-gold/15 active:scale-[0.99] transition-transform duration-100"
    >
      <div className="flex items-center gap-2 flex-wrap">
        <p className="font-classic-body text-[11px] font-bold uppercase tracking-wider text-premium-gold/90">
          Chess Kingdom
        </p>
        <span className="font-classic-body text-[11px] text-premium-ivory/45 hidden sm:inline">·</span>
        <p className="font-classic-body text-[11px] text-premium-ivory/55 hidden sm:inline">
          Beginner to chess master
        </p>
      </div>

      <div className="flex items-start gap-3 min-w-0">
        <span className="text-3xl leading-none flex-none">{zoneEmoji}</span>
        <div className="min-w-0 flex-1">
          <p className="font-classic-display text-lg sm:text-xl text-premium-ivory leading-snug">
            Day {dayNumber}: {title}
          </p>
          <p className="font-classic-body text-sm text-premium-ivory/60 mt-1 line-clamp-2">
            {storyBeat}
          </p>
        </div>
      </div>

      <span className="self-start mt-auto font-classic-body text-sm font-semibold text-premium-midnight bg-premium-gold rounded-full px-5 py-2.5 min-h-[44px] flex items-center">
        {locked ? "Unlock & Continue →" : "Continue Journey →"}
      </span>
    </Link>
  );
}

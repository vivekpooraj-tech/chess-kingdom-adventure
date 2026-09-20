import Link from "next/link";
import type { PrimaryAction } from "@/lib/home/getPrimaryAction";

/**
 * Home's single primary action card (Phase 3) — replaces the old
 * ChessSchoolCard + HeroJourneyCard pair with exactly one obvious next step,
 * driven by lib/home/getPrimaryAction.ts.
 */
export function PrimaryActionCard({ action }: { action: PrimaryAction }) {
  if (action.kind === "school") {
    const percent = Math.round((action.startedCount / action.totalSessions) * 100);
    return (
      <section className="home-primary-card relative w-full rounded-premiumCard bg-gradient-to-br from-premium-navyLight to-premium-navy border border-premium-gold/25 p-5 sm:p-6 flex flex-col gap-4 shadow-premiumCard overflow-hidden">
        <div
          aria-hidden="true"
          className="home-kingdom-glow pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgb(var(--mode-accent)/0.35),transparent_70%)]"
        />
        <div className="relative flex items-start justify-between gap-3 flex-wrap">
          <p className="font-classic-body text-[11px] font-bold uppercase tracking-wider text-premium-gold/90">
            🏫 Chess School
          </p>
          <span className="font-classic-body text-[11px] text-premium-ivory/55 flex-none tabular-nums border border-white/10 rounded-full px-2.5 py-1">
            {action.startedCount} / {action.totalSessions}
          </span>
        </div>

        <div
          role="progressbar"
          aria-valuenow={action.startedCount}
          aria-valuemin={0}
          aria-valuemax={action.totalSessions}
          aria-label={`Chess School: ${action.startedCount} of ${action.totalSessions} sessions complete`}
          className="h-2 w-full rounded-full bg-premium-ivory/10 overflow-hidden"
        >
          <div
            className="h-full rounded-full bg-premium-gold transition-[width] duration-500 ease-out motion-reduce:transition-none"
            style={{ width: `${percent}%` }}
          />
        </div>

        <Link href={action.href} className="flex flex-col gap-1 active:scale-[0.99] transition-transform duration-100">
          <p className="font-classic-display text-lg sm:text-xl text-premium-ivory leading-snug">
            {action.title}
          </p>
          <p className="font-classic-body text-sm text-premium-ivory/65">{action.subtitle}</p>
        </Link>

        <div className="flex items-center gap-4 flex-wrap mt-auto">
          <Link
            href={action.href}
            className="font-classic-body text-sm font-semibold text-premium-midnight bg-premium-gold rounded-full px-5 py-2.5 min-h-[44px] flex items-center active:scale-[0.98] transition-transform duration-100"
          >
            {action.isFirstSession ? "Start Session 1 →" : `Continue Session ${action.sessionNumber} →`}
          </Link>
          {/* The course overview — what all the sessions teach, stage by
              stage. Secondary on purpose: the primary action is always to
              keep learning, not to go and read about learning. Carried over
              from the old ChessSchoolCard, which this replaces. */}
          <Link
            href="/chess-school"
            className="font-classic-body text-xs text-premium-ivory/65 underline underline-offset-4 hover:text-premium-gold min-h-[44px] flex items-center"
          >
            View the course
          </Link>
        </div>
      </section>
    );
  }

  if (action.kind === "focus") {
    return (
      <Link
        href={action.href}
        className="home-primary-card w-full rounded-premiumCard bg-gradient-to-br from-premium-navyLight to-premium-navy p-5 sm:p-6 flex flex-col gap-3 shadow-premiumCard border border-premium-gold/25 active:scale-[0.99] transition-transform duration-100"
      >
        <p className="font-classic-body text-[11px] font-bold uppercase tracking-wider text-premium-gold/90">
          Your focus
        </p>
        <p className="font-classic-display text-lg sm:text-xl text-premium-ivory leading-snug">
          {action.skillName}
        </p>
        <p className="font-classic-body text-sm text-premium-ivory/65">
          It came up in {action.weakCount} of your reviewed games. Let&apos;s work on it.
        </p>
        <span className="self-start mt-auto font-classic-body text-sm font-semibold text-premium-midnight bg-premium-gold rounded-full px-5 py-2.5 min-h-[44px] flex items-center">
          Work on {action.skillName} →
        </span>
      </Link>
    );
  }

  if (action.kind === "practice") {
    return (
      <Link
        href="/puzzles"
        className="home-surface-card w-full rounded-premiumCard border border-transparent bg-gradient-to-br from-premium-emerald to-premium-emeraldDeep p-5 sm:p-6 flex flex-col gap-3 shadow-premiumCard active:scale-[0.99] transition-transform duration-100"
      >
        <p className="font-classic-body text-[11px] font-bold uppercase tracking-wider text-premium-ivory/80">
          Puzzle Trainer
        </p>
        <p className="font-classic-display text-lg sm:text-xl text-premium-ivory leading-snug">
          Sharpen your skills with a fresh puzzle.
        </p>
        <span className="self-start mt-auto font-classic-body text-sm font-semibold text-premium-midnight bg-premium-gold rounded-full px-5 py-2.5 min-h-[44px] flex items-center">
          Solve Today&apos;s Puzzle →
        </span>
      </Link>
    );
  }

  if (action.kind === "puzzles") {
    return (
      <Link
        href="/puzzles"
        className="home-surface-card w-full rounded-premiumCard border border-transparent bg-gradient-to-br from-premium-emerald to-premium-emeraldDeep p-5 sm:p-6 flex flex-col gap-3 shadow-premiumCard active:scale-[0.99] transition-transform duration-100"
      >
        <p className="font-classic-body text-[11px] font-bold uppercase tracking-wider text-premium-ivory/80">
          Recommended
        </p>
        <p className="font-classic-display text-lg sm:text-xl text-premium-ivory leading-snug">
          {action.title}
        </p>
        <p className="font-classic-body text-sm text-premium-ivory/65">{action.subtitle}</p>
        <span className="self-start mt-auto font-classic-body text-sm font-semibold text-premium-midnight bg-premium-gold rounded-full px-5 py-2.5 min-h-[44px] flex items-center">
          Open Puzzle Trainer →
        </span>
      </Link>
    );
  }

  if (action.kind === "academy") {
    return (
      <Link
        href={action.href}
        className="home-primary-card w-full rounded-premiumCard bg-gradient-to-br from-premium-navyLight to-premium-navy p-5 sm:p-6 flex flex-col gap-3 shadow-premiumCard border border-premium-gold/15 active:scale-[0.99] transition-transform duration-100"
      >
        <p className="font-classic-body text-[11px] font-bold uppercase tracking-wider text-premium-gold/90">
          Academy
        </p>
        <p className="font-classic-display text-lg sm:text-xl text-premium-ivory leading-snug">
          {action.title}
        </p>
        <p className="font-classic-body text-sm text-premium-ivory/60">{action.subtitle}</p>
        <span className="self-start mt-auto font-classic-body text-sm font-semibold text-premium-midnight bg-premium-gold rounded-full px-5 py-2.5 min-h-[44px] flex items-center">
          Start Training →
        </span>
      </Link>
    );
  }

  return (
    <Link
      href="/play"
      className="home-primary-card w-full rounded-premiumCard bg-gradient-to-br from-premium-navyLight to-premium-navy p-5 sm:p-6 flex flex-col gap-3 shadow-premiumCard border border-premium-gold/15 active:scale-[0.99] transition-transform duration-100"
    >
      <p className="font-classic-body text-[11px] font-bold uppercase tracking-wider text-premium-gold/90">
        Play
      </p>
      <p className="font-classic-display text-lg sm:text-xl text-premium-ivory leading-snug">
        {action.title}
      </p>
      <p className="font-classic-body text-sm text-premium-ivory/60">{action.subtitle}</p>
      <span className="self-start mt-auto font-classic-body text-sm font-semibold text-premium-midnight bg-premium-gold rounded-full px-5 py-2.5 min-h-[44px] flex items-center">
        Play Now →
      </span>
    </Link>
  );
}

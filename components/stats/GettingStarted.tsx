import Link from "next/link";
import { PrimaryCard } from "@/components/ui/Card";
import { TEXT } from "@/lib/designSystem";

/**
 * What a new player sees instead of an empty dashboard.
 *
 * A stats page with nothing in it is the worst first impression a learning
 * product can make: it implies the app has nothing to offer until you have
 * already done the work. This replaces that with the actual map — what unlocks,
 * how much is needed, and how far along each one is.
 *
 * Every threshold shown is the real constant the computation uses, imported
 * rather than retyped, so this panel can never drift from what actually
 * unlocks. If a threshold changes, this text changes with it.
 */

export interface UnlockRow {
  label: string;
  have: number;
  need: number;
  detail: string;
}

export function GettingStarted({
  rows,
  hasAnyActivity,
}: {
  rows: UnlockRow[];
  hasAnyActivity: boolean;
}) {
  return (
    <PrimaryCard className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className={`${TEXT.meta} text-premium-gold`}>Your Chess Mind is just getting started</p>
        <p className={TEXT.body}>
          {hasAnyActivity
            ? "You have made a start. Here is what each part of this page needs before it can tell you something true."
            : "Nothing here is invented, so this page fills in as you play. Here is what unlocks, and when."}
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {rows.map((row) => {
          const pct = row.need === 0 ? 0 : Math.min(100, Math.round((row.have / row.need) * 100));
          const done = row.have >= row.need;
          return (
            <li key={row.label} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-classic-body text-sm text-premium-ivory">
                  {/* Unlocked state is marked with a glyph as well as colour. */}
                  {done ? <span aria-hidden="true">✓ </span> : null}
                  {row.label}
                </span>
                <span className={TEXT.caption}>
                  {done ? "Unlocked" : `${row.have} of ${row.need}`}
                </span>
              </div>
              <div
                className="h-1.5 w-full overflow-hidden rounded-full bg-premium-navyLight"
                role="img"
                aria-label={`${row.label}: ${row.have} of ${row.need}`}
              >
                <div
                  className="h-full rounded-full bg-premium-gold"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className={TEXT.caption}>{row.detail}</p>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-2 border-t border-white/10 pt-3">
        <Link
          href="/play"
          className="flex min-h-[48px] items-center justify-between rounded-premiumBtn border border-premium-gold/40 bg-premium-gold/10 px-4 font-classic-body text-sm text-premium-ivory"
        >
          Play a rated game <span aria-hidden="true">→</span>
        </Link>
        <Link
          href="/puzzles/tactics"
          className="flex min-h-[48px] items-center justify-between rounded-premiumBtn border border-white/10 bg-premium-navy/70 px-4 font-classic-body text-sm text-premium-ivory"
        >
          Train tactics <span aria-hidden="true">→</span>
        </Link>
      </div>
    </PrimaryCard>
  );
}

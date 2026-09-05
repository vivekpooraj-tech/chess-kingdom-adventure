import { TEXT } from "@/lib/designSystem";
import type { Stat, Record3, SplitRow } from "@/lib/stats/playerStats";

/**
 * Presentation for statistics that may not exist yet.
 *
 * Every component here takes a `Stat<T>` rather than a number, so a caller
 * physically cannot render a figure without having said what happens when
 * there is not enough evidence for it. The three states are visually distinct
 * on purpose: "not enough games yet (4 of 10)" reads as progress toward
 * something, which is true, whereas a greyed-out "50%" reads as a fact, which
 * it would not be.
 */

export function formatRate(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function recordLine(r: Record3): string {
  return `${r.wins}W · ${r.draws}D · ${r.losses}L`;
}

/** A headline figure with its evidence state. */
export function StatBlock({
  label,
  stat,
  format,
  fallbackNote,
}: {
  label: string;
  stat: Stat<number | string>;
  format?: (v: number | string) => string;
  /** Shown when there is no data at all. */
  fallbackNote?: string;
}) {
  const render = () => {
    if (stat.kind === "ok") {
      const v = stat.value;
      return (
        <p className="font-classic-display text-2xl text-premium-ivory leading-tight">
          {format ? format(v) : String(v)}
        </p>
      );
    }
    if (stat.kind === "insufficient") {
      return (
        <>
          <p className="font-classic-display text-2xl text-premium-ivory/35 leading-tight">—</p>
          <p className={`${TEXT.caption} normal-case`}>
            {stat.have} of {stat.need} games
          </p>
        </>
      );
    }
    return (
      <>
        <p className="font-classic-display text-2xl text-premium-ivory/35 leading-tight">—</p>
        {fallbackNote ? <p className={`${TEXT.caption} normal-case`}>{fallbackNote}</p> : null}
      </>
    );
  };

  return (
    <div className="rounded-premiumCard bg-premium-navy shadow-premiumCard p-4 flex flex-col gap-1 min-h-[76px] justify-center">
      {render()}
      <p className="font-classic-body text-xs text-premium-ivory/50 leading-tight">{label}</p>
    </div>
  );
}

/**
 * One row of a split (a colour, a time control).
 *
 * A bucket without enough games shows its raw record but no rate — the games
 * happened and are worth showing; the percentage is the part that would lie.
 */
export function SplitBar({ row }: { row: SplitRow }) {
  const pct = row.rate === null ? null : Math.round(row.rate * 100);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-classic-body text-sm text-premium-ivory">{row.label}</span>
        <span className={TEXT.caption}>
          {row.record.games === 0
            ? "No games"
            : pct === null
              ? `${recordLine(row.record)} · too few for a rate`
              : `${recordLine(row.record)} · ${pct}%`}
        </span>
      </div>
      {/* The bar is a redundant encoding of the number beside it, never the
          only way to read the value. */}
      {pct !== null && (
        <div
          className="h-1.5 w-full rounded-full bg-premium-navyLight overflow-hidden"
          role="img"
          aria-label={`${row.label}: ${pct} percent score across ${row.record.games} games`}
        >
          <div className="h-full rounded-full bg-premium-gold" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

/** A section that says plainly why it is empty, rather than rendering nothing. */
export function EmptySection({ children }: { children: string }) {
  return (
    <p className="rounded-premiumBtn border border-white/10 bg-premium-navy/50 px-3 py-2.5 font-classic-body text-sm text-premium-ivory/65">
      {children}
    </p>
  );
}

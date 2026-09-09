import Link from "next/link";
import {
  questHref,
  questSummaryLine,
  type DailyQuestSet,
  type DailyQuest,
} from "@/lib/quests/dailyQuests";

/**
 * Today's three quests on Home.
 *
 * A server component with no state and no client JS: the whole card is
 * derived from counts the page already fetched (see lib/quests/questQueries.ts),
 * so it costs the bundle nothing and cannot flash stale progress on rehydrate.
 *
 * Renders nothing at all when there are no measurable quests — a quest source
 * that failed to read is omitted upstream rather than shown as 0, so an empty
 * set means "we genuinely have nothing honest to show", and an empty premium
 * card would be worse than no card.
 */
export function DailyQuestsCard({
  set,
  neutralTone,
}: {
  set: DailyQuestSet;
  neutralTone: boolean;
}) {
  if (set.quests.length === 0) return null;

  const summary = questSummaryLine(set, neutralTone);

  return (
    <section
      aria-labelledby="daily-quests-heading"
      className="w-full rounded-premiumCard bg-premium-navy/70 border border-white/5 p-5 sm:p-6 flex flex-col gap-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id="daily-quests-heading"
          className="font-classic-body text-[11px] font-bold uppercase tracking-wider text-premium-gold/90"
        >
          Today&apos;s Quests
        </h2>
        <p className="font-classic-body text-[11px] text-premium-ivory/45 flex-none">
          {set.completedCount} / {set.quests.length}
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {set.quests.map((quest) => (
          <li key={quest.id}>
            <QuestRow quest={quest} />
          </li>
        ))}
      </ul>

      {summary && (
        <p className="font-classic-body text-sm text-premium-ivory/60">{summary}</p>
      )}
    </section>
  );
}

function QuestRow({ quest }: { quest: DailyQuest }) {
  const pct = quest.target > 0 ? Math.round((quest.progress / quest.target) * 100) : 0;

  return (
    <Link
      href={questHref(quest.kind)}
      // min-h-[44px] keeps the whole row a comfortable tap target on the
      // phone/tablet layouts, matching the other Home cards' hit sizing.
      className="group flex items-center gap-3 min-h-[44px] rounded-xl px-3 py-2.5 -mx-1 bg-premium-midnight/30 border border-white/5 hover:border-premium-gold/25 active:scale-[0.99] transition-[border-color,transform] duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/60"
    >
      <span aria-hidden className="text-xl leading-none flex-none w-6 text-center">
        {quest.icon}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-classic-body text-sm text-premium-ivory/90 truncate">
            {quest.title}
          </p>
          <span
            className={`font-classic-body text-[11px] flex-none tabular-nums ${
              quest.complete ? "text-premium-gold" : "text-premium-ivory/45"
            }`}
          >
            {quest.complete ? "Complete ✓" : `${quest.progress} / ${quest.target}`}
          </span>
        </div>

        {/* The bar is decoration over a value the row already states in text,
            so it carries the ARIA and the text stays the accessible source of
            truth either way. */}
        <div
          role="progressbar"
          aria-valuenow={quest.progress}
          aria-valuemin={0}
          aria-valuemax={quest.target}
          aria-label={`${quest.title}: ${quest.progress} of ${quest.target}`}
          className="mt-1.5 h-1.5 w-full rounded-full bg-premium-ivory/10 overflow-hidden"
        >
          <div
            className={`h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none ${
              quest.complete ? "bg-premium-gold" : "bg-premium-emerald"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </Link>
  );
}

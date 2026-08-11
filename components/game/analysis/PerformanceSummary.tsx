import { TEXT } from "@/lib/designSystem";
import { CATEGORY_INFO, type MoveCategory } from "@/lib/analysis/moveClassification";

const ORDER: MoveCategory[] = ["excellent", "good", "inaccuracy", "mistake", "blunder"];

/** Section 11 + 12 of the brief — the counts + one personalized takeaway,
 * shown once per game (not per mistake). */
export function PerformanceSummary({
  counts,
  biggestLesson,
  insights,
}: {
  counts: Record<MoveCategory, number>;
  biggestLesson: string | null;
  insights: string[];
}) {
  return (
    <div className="rounded-premiumCard bg-premium-navy shadow-premiumCard p-5 w-full max-w-md flex flex-col gap-4">
      <div>
        <p className={`${TEXT.meta} text-premium-gold mb-2`}>Your Game</p>
        <ul className="flex flex-col gap-1">
          {ORDER.map((cat) => (
            <li key={cat} className="flex items-center justify-between font-classic-body text-sm">
              <span className="text-premium-ivory/80">
                <span aria-hidden="true">{CATEGORY_INFO[cat].emoji}</span> {CATEGORY_INFO[cat].label} moves
              </span>
              <span className="text-premium-ivory">{counts[cat]}</span>
            </li>
          ))}
        </ul>
      </div>

      {biggestLesson && (
        <div>
          <p className={`${TEXT.meta} text-premium-gold mb-1`}>Biggest Lesson</p>
          <p className={TEXT.body}>{biggestLesson}</p>
        </div>
      )}

      {insights.length > 0 && (
        <div>
          <p className={`${TEXT.meta} text-premium-gold mb-1`}>🧠 Chess Mind Insight</p>
          <ul className="flex flex-col gap-1.5">
            {insights.map((insight, i) => (
              <li key={i} className={TEXT.body}>
                {insight}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

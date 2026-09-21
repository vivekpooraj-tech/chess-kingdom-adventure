import { DailyQuestsCard } from "@/components/home/DailyQuestsCard";
import type { DailyQuestSet } from "@/lib/quests/dailyQuests";
import { TEXT } from "@/lib/designSystem";

/**
 * Kids' "Daily Kingdom Quests" panel (Phase 2.1-D) — wraps the existing,
 * unchanged DailyQuestsCard (same selectDailyQuests() data every mode
 * already uses). Presentation-only: a themed panel + heading around the
 * real quest titles/progress/completion state DailyQuestsCard already
 * renders. No quest logic duplicated, no rewards/XP invented.
 */
export function DailyKingdomQuestsPanel({
  set,
  neutralTone,
}: {
  set: DailyQuestSet;
  neutralTone: boolean;
}) {
  return (
    <div className="kingdom-panel home-surface-card flex flex-col gap-3 rounded-premiumCard border border-white/5 bg-premium-navy/70 p-4 sm:p-5">
      <p className="kingdom-eyebrow font-classic-body text-[11px] font-semibold uppercase tracking-wide text-premium-ivory/50">
        Daily Kingdom Quests
      </p>
      <p className={TEXT.caption}>
        {set.completedCount} of {set.quests.length} complete today
      </p>
      <DailyQuestsCard set={set} neutralTone={neutralTone} embedded />
    </div>
  );
}

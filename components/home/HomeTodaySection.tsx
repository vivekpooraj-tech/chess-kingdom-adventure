import { SectionHeader } from "@/components/ui/SectionHeader";
import { DailyChallengeCard } from "@/components/home/DailyChallengeCard";
import { DailyQuestsCard } from "@/components/home/DailyQuestsCard";
import type { DailyQuestSet } from "@/lib/quests/dailyQuests";

/**
 * Groups Daily Challenge and Daily Quests under one "Today" heading while
 * keeping each component's logic and data fetching unchanged.
 */
export function HomeTodaySection({
  childId,
  set,
  neutralTone,
}: {
  childId: string;
  set: DailyQuestSet;
  neutralTone: boolean;
}) {
  return (
    <section className="flex w-full flex-col gap-2">
      <SectionHeader title="Today" className="home-section-heading" />
      <div className="flex flex-col gap-3">
        <DailyChallengeCard childId={childId} />
        <DailyQuestsCard set={set} neutralTone={neutralTone} embedded />
      </div>
    </section>
  );
}

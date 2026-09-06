import { TacticsTrainer } from "@/components/puzzles/TacticsTrainer";

/**
 * Tactics Trainer — forks, pins, skewers, discovered attacks and the rest,
 * served one at a time from the 5,000-puzzle server-side library.
 *
 * Sits alongside the mate-only trainer at /puzzles rather than replacing it:
 * that one has its own (correct) "any move that mates counts" model and owns
 * the Daily Challenge, and swapping its data source is a separate, riskier
 * change. See PUZZLE_LIBRARY.md.
 *
 * ?skill= narrows practice to one theme. It is how the Stats page's "Train
 * this skill" recommendation hands off the specific weakness it identified,
 * which is the step that turns an observation into practice.
 */
export default function TacticsPuzzlesPage({
  searchParams,
}: {
  searchParams: { skill?: string };
}) {
  return <TacticsTrainer focusSkill={searchParams.skill ?? null} />;
}

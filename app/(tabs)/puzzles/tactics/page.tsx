import { TacticsTrainer } from "@/components/puzzles/TacticsTrainer";

/**
 * Tactics Trainer — forks, pins, skewers, discovered attacks and the rest,
 * served one at a time from the 5,000-puzzle server-side library.
 *
 * Sits alongside the mate-only trainer at /puzzles rather than replacing it:
 * that one has its own (correct) "any move that mates counts" model and owns
 * the Daily Challenge, and swapping its data source is a separate, riskier
 * change. See PUZZLE_LIBRARY.md.
 */
export default function TacticsPuzzlesPage() {
  return <TacticsTrainer />;
}

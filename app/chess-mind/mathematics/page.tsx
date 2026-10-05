"use client";

import { TrainDrill } from "@/components/trainYourMind/TrainDrill";

/** Chess Mathematics — served by the shared Train Your Chess Mind engine (/api/chess-mind/train). */
export default function ChessMathematicsPage() {
  return (
    <TrainDrill
      category="mathematics"
      title="Chess Mathematics"
      tagline="Count material, follow captures and judge every exchange."
    />
  );
}

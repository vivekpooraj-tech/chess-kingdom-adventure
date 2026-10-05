"use client";

import { TrainDrill } from "@/components/trainYourMind/TrainDrill";

/** Spatial Thinking — served by the shared Train Your Chess Mind engine (/api/chess-mind/train). */
export default function SpatialThinkingPage() {
  return (
    <TrainDrill
      category="spatial"
      title="Spatial Thinking"
      tagline="Understand board geometry — distance, reach, control and king safety."
    />
  );
}

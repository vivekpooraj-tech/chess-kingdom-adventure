"use client";

import { TrainDrill } from "@/components/trainYourMind/TrainDrill";

/** Visualization — served by the shared Train Your Chess Mind engine (/api/chess-mind/train). */
export default function VisualizationPage() {
  return (
    <TrainDrill
      category="visualization"
      title="Visualization"
      tagline="See the board in your mind — then follow the moves without moving a piece."
    />
  );
}

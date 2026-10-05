"use client";

import { TrainDrill } from "@/components/trainYourMind/TrainDrill";

/** Pattern Recognition — served by the shared Train Your Chess Mind engine (/api/chess-mind/train). */
export default function PatternRecognitionPage() {
  return (
    <TrainDrill
      category="pattern"
      title="Pattern Recognition"
      tagline="Real positions, real patterns — learn to see the tactic before you calculate it."
    />
  );
}

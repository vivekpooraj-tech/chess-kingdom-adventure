"use client";

import { TrainDrill } from "@/components/trainYourMind/TrainDrill";

/** Calculation — served by the shared Train Your Chess Mind engine (/api/chess-mind/train). */
export default function CalculationPage() {
  return (
    <TrainDrill
      category="calculation"
      title="Calculation"
      tagline="Think several moves ahead — and know why the line works."
    />
  );
}

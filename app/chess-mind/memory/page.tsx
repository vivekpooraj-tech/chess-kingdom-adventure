"use client";

import { TrainDrill } from "@/components/trainYourMind/TrainDrill";

/** Memory — served by the shared Train Your Chess Mind engine (/api/chess-mind/train). */
export default function MemoryPage() {
  return (
    <TrainDrill
      category="memory"
      title="Memory"
      tagline="Remember positions, pieces and moves — chess memory, not memory tricks."
    />
  );
}

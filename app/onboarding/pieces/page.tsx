"use client";

import { PieceSetPicker } from "@/components/board/PieceSetPicker";

export default function OnboardingPiecesPage() {
  return (
    <PieceSetPicker
      heading="Pick your Pieces! ♟️"
      confirmLabel="Enter the Kingdom! →"
      redirectTo="/kingdom-map"
    />
  );
}

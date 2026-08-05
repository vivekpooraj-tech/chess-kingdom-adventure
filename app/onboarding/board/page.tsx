"use client";

import { BoardSkinPicker } from "@/components/board/BoardSkinPicker";

export default function OnboardingBoardPage() {
  return (
    <BoardSkinPicker
      heading="Pick your Board! 🎨"
      confirmLabel="Enter the Kingdom! →"
      redirectTo="/onboarding/pieces"
    />
  );
}

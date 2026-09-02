"use client";

import { BoardSkinPicker } from "@/components/board/BoardSkinPicker";

export default function OnboardingBoardPage() {
  return (
    <BoardSkinPicker
      heading="Pick your board"
      confirmLabel="Continue →"
      redirectTo="/onboarding/pieces"
    />
  );
}

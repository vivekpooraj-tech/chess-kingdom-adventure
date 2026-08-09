"use client";

import { BoardSkinPicker } from "@/components/board/BoardSkinPicker";

export default function EditBoardSkinPage() {
  return (
    <BoardSkinPicker heading="Choose your Board" confirmLabel="Save →" redirectTo="/profile" tone="premium" />
  );
}

"use client";

import { PieceSetPicker } from "@/components/board/PieceSetPicker";

export default function EditPieceSetPage() {
  return (
    <PieceSetPicker heading="Choose your Pieces" confirmLabel="Save →" redirectTo="/profile" tone="premium" />
  );
}

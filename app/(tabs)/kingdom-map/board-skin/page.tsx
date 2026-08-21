import { redirect } from "next/navigation";

// Superseded by the combined Customize Your Chessboard screen (Phase 13),
// which shows pieces and board together with a live preview instead of two
// separate single-purpose editors. Kept as a redirect, not deleted, so any
// existing link/bookmark to this route still works.
export default function EditBoardSkinPage() {
  redirect("/kingdom-map/customize");
}

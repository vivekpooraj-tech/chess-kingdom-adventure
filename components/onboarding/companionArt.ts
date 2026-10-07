/**
 * Presentation-only extras for the signup character screen (components/onboarding/CompanionPicker). The characters themselves (id, name, emoji,
 * colours) stay in content/avatars.ts and are not changed here.
 *
 * ART: each character's portrait (public/characters/<id>.webp, 3:4). The supplied artwork was cropped, without regeneration or upscaling, from the
 * approved Stitch canvases, so the files are ~275x367 px; replacing a file with a higher-resolution export of the same portrait needs no code change.
 * A character with no entry falls back to its emoji on its own gradient plate (and requests no image), so removing an entry is always safe.
 *
 * BLURBS: one short line each, in the same spirit as the names (chess-flavoured, no stats, no abilities). New copy: edit freely.
 */
export const COMPANION_ART: Partial<Record<string, string>> = {
  "knight-kid": "/characters/knight-kid.webp",
  "star-explorer": "/characters/star-explorer.webp",
  "forest-ranger": "/characters/forest-ranger.webp",
  "royal-heir": "/characters/royal-heir.webp",
};

export const COMPANION_BLURB: Record<string, string> = {
  "knight-kid": "Daring, clever, and loves bold moves.",
  "star-explorer": "Sees whole starry diagonals across the board.",
  "forest-ranger": "Patient and protective with every pawn.",
  "royal-heir": "Builds mighty fortresses to keep you safe.",
};

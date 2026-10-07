/**
 * Presentation-only extras for the signup guide screen (components/onboarding/GuidePicker). The guide itself (id, name, emoji, personality) stays in
 * content/buddies.ts and is not changed here.
 *
 * ART: a guide's portrait goes in `GUIDE_ART` as a public path (portrait 3:4). A guide with no entry falls back to its emoji, large, on a magical plate,
 * and requests no image, so removing an entry is always safe.
 *
 * BLURB: one short, friendly line, written from Ollie's existing personality in content/buddies.ts ("warm, patient, a little bit silly ... never says
 * 'wrong', always 'let's see what happens if...'"). New copy: edit freely.
 */
export const GUIDE_ART: Partial<Record<string, string>> = {
  "wise-owl": "/characters/ollie.webp", // 896x1200, the supplied artwork used as it is
};

export const GUIDE_BLURB: Record<string, string> = {
  "wise-owl": "Warm, patient and a little bit silly. Ollie never says “wrong”, only “let’s see what happens if…”",
};

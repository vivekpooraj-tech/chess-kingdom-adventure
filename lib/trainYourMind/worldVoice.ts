import type { WorldId } from "@/lib/world/worlds";

/**
 * Per-World wording for the Train Your Mind hub. The exercises and progression
 * are identical in every World; only the voice changes:
 *
 *  Enchanted — magical adventure training: friendly, playful, never babyish.
 *  Atelier   — an elite training lab: performance-oriented, modern, sophisticated.
 *  Classic   — professional study: restrained, serious, analytical.
 */
export interface WorldVoice {
  title: string;
  subtitle: string;
  caption: string;
  levelNoun: string;
}

export const WORLD_VOICE: Record<WorldId, WorldVoice> = {
  enchanted: {
    title: "Train Your Mind",
    subtitle: "Train the skills behind stronger chess — and level up your thinking!",
    caption: "Each training path grows with you, from Foundation all the way to Master.",
    levelNoun: "Level",
  },
  atelier: {
    title: "Train Your Mind",
    subtitle: "Train the skills behind stronger chess.",
    caption: "Seven cognitive disciplines. Structured progression from Foundation to Master.",
    levelNoun: "Level",
  },
  classic: {
    title: "Train Your Mind",
    subtitle: "Train the skills behind stronger chess.",
    caption: "Pattern recognition, calculation, visualization, memory, spatial reasoning and more — good practice for the game, not a claim about IQ.",
    levelNoun: "Level",
  },
};

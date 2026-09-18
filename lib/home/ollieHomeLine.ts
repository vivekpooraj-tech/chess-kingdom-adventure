import type { BuddyOption } from "@/lib/types";
import type { PrimaryAction } from "@/lib/home/getPrimaryAction";

/**
 * Deterministic Ollie copy for Home's hero — reuses the buddy persona without
 * any AI or extra backend calls. Presentation-only companion to
 * getPrimaryAction(), which stays unchanged.
 */
export function getOllieHomeLine(
  action: PrimaryAction,
  buddy: BuddyOption,
  neutralTone: boolean
): string {
  const shortName = buddy.name.split(" ")[0];

  if (action.kind === "school") {
    if (neutralTone) {
      return action.isFirstSession
        ? "Your first Chess School session is ready when you are."
        : `Continue Chess School — ${action.title}.`;
    }
    return action.isFirstSession
      ? `${shortName} here! Let's start Chess School together.`
      : `Session ${action.sessionNumber} is next — you've got this!`;
  }

  if (action.kind === "focus") {
    return neutralTone
      ? `A good time to work on ${action.skillName}.`
      : `${action.skillName} came up a lot — let's sharpen it up together!`;
  }

  if (action.kind === "practice" || action.kind === "puzzles") {
    return neutralTone
      ? "A fresh puzzle is a great way to warm up."
      : buddy.encouragement[0] ?? "Let's solve a puzzle together!";
  }

  if (action.kind === "academy") {
    return neutralTone
      ? `${action.title} is a solid next step in the Academy.`
      : `The Academy has something great for you — ${action.title}!`;
  }

  return neutralTone
    ? "Pick an activity below, or follow today's recommendation."
    : buddy.greeting || "Ready when you are!";
}
